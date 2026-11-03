import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import maplibregl from '../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, LocateFixed } from 'lucide-react';
import { createPlace, friendlyError, placesInBounds } from '../lib/api';
import { CATEGORIES } from '../lib/categories';
import { DEFAULT_VIEW, MAP_STYLE, getBestPosition, loadView, setUserFix } from '../lib/geo';
import { reverseGeocode } from '../lib/nominatim';
import type { Place } from '../lib/types';

export default function AddPlacePage() {
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geoAbort = useRef<AbortController | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('khac');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [addrBusy, setAddrBusy] = useState(false);
  const [nearby, setNearby] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = useRef(false); // người dùng đã tự sửa địa chỉ -> không ghi đè nữa
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const v = loadView() ?? DEFAULT_VIEW;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [v.lng, v.lat],
      zoom: Math.max(v.zoom, 16),
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const settle = () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
    };
    map.on('moveend', settle);
    map.on('load', settle);
    getBestPosition({ maxWaitMs: 8000, goodEnough: 40 })
      .then((f) => {
        setUserFix(f);
        map.jumpTo({ center: [f.lng, f.lat], zoom: f.accuracy > 1500 ? 15 : 17 });
      })
      .catch(() => {})
      .finally(() => setLocating(false));
    return () => {
      window.clearTimeout(settleTimer.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sau khi dừng kéo bản đồ: tìm địa chỉ và kiểm tra quán trùng gần đó
  useEffect(() => {
    if (!center) return;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(async () => {
      geoAbort.current?.abort();
      const ac = new AbortController();
      geoAbort.current = ac;
      setAddrBusy(true);
      try {
        const [rev, near] = await Promise.all([
          reverseGeocode(center.lat, center.lng, ac.signal).catch(() => null),
          placesInBounds(
            { minLat: center.lat - 0.0007, maxLat: center.lat + 0.0007, minLng: center.lng - 0.0007, maxLng: center.lng + 0.0007 },
            null,
            false,
          ).catch(() => [] as Place[]),
        ]);
        if (ac.signal.aborted) return;
        setNearby(near);
        if (rev && !edited.current) {
          setAddress(rev.address);
          setDistrict(rev.region.district ?? '');
          setCity(rev.region.city ?? '');
          setProvince(rev.region.province ?? '');
        }
      } finally {
        if (!ac.signal.aborted) setAddrBusy(false);
      }
    }, 800);
  }, [center]);

  async function myLocation() {
    setLocating(true);
    try {
      const f = await getBestPosition({ maxWaitMs: 9000, goodEnough: 40 });
      setUserFix(f);
      mapRef.current?.flyTo({ center: [f.lng, f.lat], zoom: f.accuracy > 1500 ? 15 : 17 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (!center) return;
    if (name.trim().length < 2) {
      setError('Hãy nhập tên quán');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createPlace({
        name: name.trim(),
        address: address.trim(),
        district: district.trim() || null,
        city: city.trim() || null,
        province: province.trim() || null,
        category,
        lat: Number(center.lat.toFixed(6)),
        lng: Number(center.lng.toFixed(6)),
      });
      nav(`/place/${id}/review`, { replace: true });
    } catch (e) {
      setError(friendlyError((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page no-tabs" style={{ padding: 0 }}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại">
          <ArrowLeft size={20} />
        </button>
        <h1>Thêm quán mới</h1>
      </div>

      <div className="picker">
        <div ref={containerRef} className="map-canvas" aria-label="Chọn vị trí quán trên bản đồ" />
        <div className="pin-pick-dot" />
        <div className="pin-pick">📍</div>
        <button className="btn small picker-loc" onClick={myLocation} disabled={locating}>
          <LocateFixed size={16} /> {locating ? 'Đang định vị…' : 'Vị trí của tôi'}
        </button>
      </div>

      <div className="form-pad">
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          Kéo bản đồ để đặt đầu ghim đúng cửa quán. Vị trí càng chính xác, review xác thực càng đáng tin.
        </p>

        {nearby.length > 0 && (
          <div className="note">
            Quanh đây đã có quán:{' '}
            {nearby.slice(0, 3).map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link to={`/place/${p.id}`} style={{ textDecoration: 'underline', fontWeight: 600 }}>
                  {p.name}
                </Link>
              </span>
            ))}
            . Hãy kiểm tra để không thêm trùng nhé.
          </div>
        )}
        {error && <div className="error">{error}</div>}

        <label className="field">
          <span>Tên quán</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Phở Hòa" maxLength={120} />
        </label>

        <div className="field">
          <span>Loại quán</span>
          <div className="tag-pick">
            {CATEGORIES.map((c) => (
              <button key={c.key} type="button" className={`chip${category === c.key ? ' on' : ''}`} onClick={() => setCategory(c.key)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Địa chỉ {addrBusy && <span className="muted">(đang tìm…)</span>}</span>
          <input
            className="input"
            value={address}
            onChange={(e) => {
              edited.current = true;
              setAddress(e.target.value);
            }}
            placeholder="Số nhà, đường, phường"
            maxLength={300}
          />
        </label>

        <div className="field">
          <span>Khu vực (dùng cho bảng xếp hạng)</span>
          <div style={{ display: 'grid', gap: 8 }}>
            <input className="input" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Quận / Huyện" />
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Thành phố" />
            <input className="input" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Tỉnh / Thành phố trực thuộc TW" />
          </div>
          <p className="hint">Tự điền theo vị trí ghim, bạn có thể sửa lại cho đúng.</p>
        </div>

        <button className="btn block" onClick={submit} disabled={busy || !center}>
          {busy ? 'Đang thêm…' : 'Thêm quán và viết review'}
        </button>
      </div>
    </div>
  );
}
