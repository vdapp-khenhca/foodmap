// Tìm đường bằng dịch vụ miễn phí dựa trên dữ liệu OpenStreetMap.
// Chính: Valhalla (FOSSGIS) hỗ trợ xe máy, ô tô, đi bộ. Dự phòng: OSRM (chỉ tính theo đường ô tô).
// Cả hai bản công cộng chỉ nên dùng cho lưu lượng thấp; khi đông người dùng nên tự host hoặc dùng nhà cung cấp trả phí.

export type Mode = 'motor_scooter' | 'auto' | 'pedestrian';

export const MODES: { key: Mode; label: string; emoji: string; google: string }[] = [
  { key: 'motor_scooter', label: 'Xe máy', emoji: '🛵', google: 'two-wheeler' },
  { key: 'auto', label: 'Ô tô', emoji: '🚗', google: 'driving' },
  { key: 'pedestrian', label: 'Đi bộ', emoji: '🚶', google: 'walking' },
];

export interface Step {
  text: string;
  distance_m: number;
  time_s: number;
  lng: number;
  lat: number;
}

export interface Route {
  coords: [number, number][]; // [lng, lat]
  distance_m: number;
  duration_s: number;
  steps: Step[];
  provider: 'valhalla' | 'osrm';
  approx: boolean; // true khi tuyến được tính theo đường ô tô cho phương tiện khác
}

export interface Point {
  lat: number;
  lng: number;
}

export function decodePolyline(str: string, precision = 6): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    out.push([lng / factor, lat / factor]);
  }
  return out;
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

interface ValhallaManeuver {
  instruction: string;
  length: number;
  time: number;
  begin_shape_index: number;
}

async function valhalla(a: Point, b: Point, mode: Mode): Promise<Route> {
  const body = {
    locations: [
      { lat: a.lat, lon: a.lng },
      { lat: b.lat, lon: b.lng },
    ],
    costing: mode,
    directions_options: { units: 'kilometers', language: 'vi-VN' },
  };
  const data = (await fetchJson(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`)) as {
    trip?: { summary: { length: number; time: number }; legs: { shape: string; maneuvers: ValhallaManeuver[] }[] };
  };
  const trip = data.trip;
  if (!trip || !trip.legs?.[0]) throw new Error('Không có tuyến đường');
  const coords = decodePolyline(trip.legs[0].shape, 6);
  const steps: Step[] = trip.legs[0].maneuvers.map((m) => {
    const c = coords[Math.min(m.begin_shape_index, coords.length - 1)];
    return { text: m.instruction, distance_m: m.length * 1000, time_s: m.time, lng: c[0], lat: c[1] };
  });
  return { coords, distance_m: trip.summary.length * 1000, duration_s: trip.summary.time, steps, provider: 'valhalla', approx: false };
}

const TURN: Record<string, string> = {
  left: 'Rẽ trái',
  right: 'Rẽ phải',
  'slight left': 'Chếch sang trái',
  'slight right': 'Chếch sang phải',
  'sharp left': 'Quay gắt sang trái',
  'sharp right': 'Quay gắt sang phải',
  straight: 'Đi thẳng',
  uturn: 'Quay đầu',
};

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
}

async function osrm(a: Point, b: Point, mode: Mode): Promise<Route> {
  const data = (await fetchJson(
    `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=true`,
  )) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] };
  const r = data.routes?.[0];
  if (!r) throw new Error('Không có tuyến đường');
  const steps: Step[] = r.legs[0].steps.map((s) => {
    const t = s.maneuver.type;
    const base = t === 'depart' ? 'Xuất phát' : t === 'arrive' ? 'Đã đến nơi' : t === 'roundabout' ? 'Đi vào vòng xuyến' : TURN[s.maneuver.modifier ?? 'straight'] ?? 'Đi thẳng';
    const text = s.name && t !== 'arrive' ? `${base} vào ${s.name}` : base;
    return { text, distance_m: s.distance, time_s: s.duration, lng: s.maneuver.location[0], lat: s.maneuver.location[1] };
  });
  return { coords: r.geometry.coordinates, distance_m: r.distance, duration_s: r.duration, steps, provider: 'osrm', approx: mode !== 'auto' };
}

export async function getRoute(a: Point, b: Point, mode: Mode): Promise<Route> {
  try {
    return await valhalla(a, b, mode);
  } catch {
    return await osrm(a, b, mode);
  }
}

export function googleMapsUrl(dest: Point, mode: Mode, origin?: Point | null): string {
  const m = MODES.find((x) => x.key === mode)?.google ?? 'driving';
  const o = origin ? `&origin=${origin.lat},${origin.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${o}&travelmode=${m}`;
}
