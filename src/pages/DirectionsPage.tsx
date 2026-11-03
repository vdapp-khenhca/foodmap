import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import maplibregl from '../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, ExternalLink, Navigation, Square } from 'lucide-react';
import { getPlace } from '../lib/api';
import { MAP_STYLE, distanceM, formatDistance, formatDuration, getBestPosition, getUserFix, setUserFix, useUserFix } from '../lib/geo';
import { MODES, getRoute, googleMapsUrl, type Mode, type Route } from '../lib/routing';
import { useToast } from '../lib/toast';
import type { Place } from '../lib/types';
import { Spinner } from '../components/ui';

const DESKTOP = () => window.matchMedia('(min-width: 900px)').matches;

export default function DirectionsPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const fix = useUserFix();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('motor_scooter');
  const [route, setRoute] = useState<Route | null>(null);
  const [status, setStatus] = useState<'locating' | 'routing' | 'ready' | 'error'>('locating');
  const [msg, setMsg] = useState('');
  const [navigating, setNavigating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<maplibregl.Marker | null>(null);
  const fittedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getPlace(id)
      .then(setPlace)
      .catch(() => setPlace(null));
  }, [id]);

  // Bản đồ
  const plat = place?.lat;
  const plng = place?.lng;
  useEffect(() => {
    if (!containerRef.current || plat == null || plng == null) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: MAP_STYLE, center: [plng, plat], zoom: 15, attributionControl: { compact: true } });
    mapRef.current = map;
    map.on('load', () => setMapReady(true));
    const el = document.createElement('div');
    el.textContent = '📍';
    el.style.cssText = 'font-size:38px;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))';
    new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([plng, plat]).addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      meRef.current = null;
      setMapReady(false);
    };
  }, [plat, plng]);

  // Vị trí xuất phát
  const locate = useCallback(async () => {
    setStatus('locating');
    setMsg('');
    try {
      const existing = getUserFix();
      if (existing && existing.accuracy <= 80) return;
      setUserFix(await getBestPosition({ maxWaitMs: 8000, goodEnough: 60 }));
    } catch (e) {
      setMsg((e as Error).message);
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    locate();
  }, [locate]);

  // Chấm vị trí
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !fix) return;
    if (!meRef.current) {
      const el = document.createElement('div');
      el.className = 'me-dot';
      meRef.current = new maplibregl.Marker({ element: el }).setLngLat([fix.lng, fix.lat]).addTo(map);
    } else {
      meRef.current.setLngLat([fix.lng, fix.lat]);
    }
  }, [fix, mapReady]);

  // Tìm đường khi có điểm đi và điểm đến (chỉ tính lại khi đổi phương tiện hoặc xuất phát lệch hơn 150 m)
  const originRef = useRef<{ lat: number; lng: number } | null>(null);
  const fixLat = fix?.lat;
  const fixLng = fix?.lng;
  useEffect(() => {
    if (!place || fixLat == null || fixLng == null) return;
    if (originRef.current && distanceM(originRef.current.lat, originRef.current.lng, fixLat, fixLng) < 150 && route && route.provider && status === 'ready') return;
    let alive = true;
    originRef.current = { lat: fixLat, lng: fixLng };
    setStatus('routing');
    getRoute({ lat: fixLat, lng: fixLng }, { lat: place.lat, lng: place.lng }, mode)
      .then((r) => {
        if (!alive) return;
        setRoute(r);
        setStatus('ready');
        fittedRef.current = false;
      })
      .catch(() => {
        if (!alive) return;
        setRoute(null);
        setMsg('Chưa tải được tuyến đường lúc này. Bạn có thể mở Google Maps để dẫn đường.');
        setStatus('error');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, fixLat, fixLng, mode, attempt]);

  function retry() {
    originRef.current = null;
    setAttempt((a) => a + 1);
    locate();
  }

  function changeMode(m: Mode) {
    originRef.current = null;
    setMode(m);
  }

  // Vẽ tuyến
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !route) return;
    const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: route.coords } };
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      map.addSource('route', { type: 'geojson', data });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 11 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1f3fd0', 'line-width': 6.5 } });
    }
    if (!fittedRef.current && route.coords.length > 1) {
      const b = new maplibregl.LngLatBounds(route.coords[0], route.coords[0]);
      for (const c of route.coords) b.extend(c);
      const wide = DESKTOP();
      map.fitBounds(b, { padding: { top: 90, bottom: wide ? 60 : 300, left: wide ? 470 : 40, right: 50 }, maxZoom: 17, duration: 700 });
      fittedRef.current = true;
    }
  }, [route, mapReady]);

  // Chế độ đang đi: theo dõi GPS liên tục
  useEffect(() => {
    if (!navigating) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setUserFix(f);
        mapRef.current?.easeTo({ center: [f.lng, f.lat], zoom: 17, duration: 700 });
      },
      () => toast('Mất tín hiệu GPS'),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [navigating, toast]);

  if (place === undefined) return <Spinner label="Đang tải…" />;
  if (!place) return <div className="page no-tabs"><div className="empty">Không tìm thấy quán.</div></div>;

  const toDest = fix ? distanceM(fix.lat, fix.lng, place.lat, place.lng) : null;
  let nowStep = -1;
  if (navigating && route && fix) {
    let best = Infinity;
    route.steps.forEach((s, i) => {
      const d = distanceM(fix.lat, fix.lng, s.lat, s.lng);
      if (d < best) {
        best = d;
        nowStep = i;
      }
    });
  }
  const gmaps = googleMapsUrl({ lat: place.lat, lng: place.lng }, mode, fix);

  return (
    <div className="dir-page">
      <div ref={containerRef} className="map-canvas" aria-label="Bản đồ chỉ đường" />
      <div className="dir-top">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại">
          <ArrowLeft size={20} />
        </button>
        <div className="dir-title">
          <span className="muted" style={{ fontSize: 12.5 }}>
            Chỉ đường đến
          </span>
          <b>{place.name}</b>
        </div>
      </div>

      <section className="dir-panel" aria-label="Thông tin tuyến đường">
        <div className="dir-summary">
          {status === 'locating' && (
            <div className="row">
              <span className="spinner" /> Đang xác định vị trí của bạn…
            </div>
          )}
          {status === 'routing' && (
            <div className="row">
              <span className="spinner" /> Đang tìm đường đi…
            </div>
          )}
          {status === 'ready' && route && (
            <>
              <div className="dir-big">{formatDuration(route.duration_s)}</div>
              <div className="muted">
                {formatDistance(route.distance_m)}
                {navigating && toDest != null ? `, còn ${formatDistance(toDest)} theo đường chim bay` : ''}
              </div>
              {route.approx && <div className="hint">Tuyến này tính theo đường ô tô, thời gian thực tế bằng {MODES.find((m) => m.key === mode)?.label.toLowerCase()} có thể khác.</div>}
            </>
          )}
          {status === 'error' && (
            <div className="error" style={{ marginBottom: 0 }}>
              {msg}
              <div style={{ marginTop: 8 }}>
                <button className="btn small" onClick={retry}>
                  Thử lại
                </button>
              </div>
            </div>
          )}
          <div className="mode-chips" role="radiogroup" aria-label="Phương tiện">
            {MODES.map((m) => (
              <button key={m.key} role="radio" aria-checked={mode === m.key} className={`mode${mode === m.key ? ' on' : ''}`} onClick={() => changeMode(m.key)}>
                <span style={{ fontSize: 20 }}>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dir-actions">
          {navigating ? (
            <button className="btn ghost" onClick={() => setNavigating(false)}>
              <Square size={16} /> Dừng
            </button>
          ) : (
            <button className="btn" onClick={() => setNavigating(true)} disabled={status !== 'ready'}>
              <Navigation size={17} /> Bắt đầu đi
            </button>
          )}
          <a className="btn ghost" href={gmaps} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Google Maps
          </a>
        </div>

        {status === 'ready' && route && (
          <div className="steps">
            {route.steps.map((s, i) => (
              <div key={i} className="step" style={i === nowStep ? { background: 'var(--cobalt-soft)', margin: '0 -8px', padding: '10px 8px', borderRadius: 12 } : undefined}>
                <span className="step-dot">{i + 1}</span>
                <span>
                  {s.text}
                  {s.distance_m > 0 && <small>{formatDistance(s.distance_m)}</small>}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
