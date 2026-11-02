export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Lấy vị trí hiện tại, độ chính xác cao. Từ chối bằng Error có thông báo tiếng Việt. */
export function getPosition(timeoutMs = 15000, maxAgeMs = 0): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Thiết bị không hỗ trợ định vị'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Bạn chưa cho phép truy cập vị trí'));
        else if (err.code === err.TIMEOUT) reject(new Error('Không lấy được vị trí, thử lại ở nơi thoáng hơn'));
        else reject(new Error('Không xác định được vị trí'));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: maxAgeMs },
    );
  });
}

export async function locationPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return res.state;
  } catch {
    return 'unknown';
  }
}

export interface SavedView {
  lng: number;
  lat: number;
  zoom: number;
}

const VIEW_KEY = 'foodmap:view';

export function loadView(): SavedView | null {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    return raw ? (JSON.parse(raw) as SavedView) : null;
  } catch {
    return null;
  }
}

export function saveView(v: SavedView) {
  try {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    /* bỏ qua */
  }
}

/** Trung tâm TP.HCM, dùng khi chưa có vị trí người dùng */
export const DEFAULT_VIEW: SavedView = { lng: 106.7009, lat: 10.7769, zoom: 14 };

export const MAP_STYLE: string =
  (import.meta.env.VITE_MAP_STYLE as string | undefined) || 'https://tiles.openfreemap.org/styles/liberty';
