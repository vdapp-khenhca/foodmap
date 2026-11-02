// Tìm địa chỉ và đổi toạ độ -> địa chỉ bằng Nominatim (dữ liệu OpenStreetMap, miễn phí).
// Bản công cộng chỉ dành cho lưu lượng thấp (tối đa ~1 yêu cầu/giây): chỉ gọi khi người dùng chủ động
// bấm tìm hoặc sau khi dừng kéo bản đồ. Khi đông người dùng nên chuyển sang bản tự host hoặc nhà cung cấp trả phí.

const BASE = 'https://nominatim.openstreetmap.org';

export interface AddressResult {
  label: string;
  lat: number;
  lng: number;
}

export interface Region {
  district: string | null;
  city: string | null;
  province: string | null;
}

interface NominatimAddress {
  [key: string]: string | undefined;
}

function clean(s?: string | null): string | null {
  if (!s) return null;
  const v = s.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim();
  return v || null;
}

export function parseRegion(a: NominatimAddress): Region {
  const isDistrict = (s?: string) => !!s && /^(Quận|Huyện|Thị xã|Thành phố|Thị trấn)\s/i.test(s);
  const district =
    a.city_district ||
    (isDistrict(a.suburb) ? a.suburb : undefined) ||
    (isDistrict(a.county) ? a.county : undefined) ||
    a.district ||
    (isDistrict(a.quarter) ? a.quarter : undefined);
  const city = a.city || a.town || a.municipality || (a.county && /^Thành phố/i.test(a.county) ? a.county : undefined);
  const province = a.state || a.province || city;
  return { district: clean(district), city: clean(city), province: clean(province) };
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<AddressResult[]> {
  const url = `${BASE}/search?format=jsonv2&limit=6&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Không tìm được địa chỉ lúc này');
  const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ address: string; region: Region } | null> {
  const url = `${BASE}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=vi&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const d = (await res.json()) as { display_name?: string; address?: NominatimAddress };
  if (!d.address) return null;
  const a = d.address;
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const ward = a.quarter || a.neighbourhood || (a.suburb && !/^Quận/i.test(a.suburb) ? a.suburb : undefined);
  const region = parseRegion(a);
  const parts = [street, ward, region.district, region.city ?? region.province].filter(Boolean);
  return { address: parts.length ? parts.join(', ') : d.display_name ?? '', region };
}
