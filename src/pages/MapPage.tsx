import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import maplibregl from '../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, X, Flame, MapPin, Plus, LocateFixed, Navigation, ArrowRight } from 'lucide-react';
import { placesInBounds, searchPlaces } from '../lib/api';
import { CATEGORIES, categoryOf, scoreTier } from '../lib/categories';
import { DEFAULT_VIEW, MAP_STYLE, getBestPosition, loadView, locationPermission, saveView, setUserFix, useUserFix, formatDistance } from '../lib/geo';
import { searchAddress, type AddressResult } from '../lib/nominatim';
import { useToast } from '../lib/toast';
import type { Place } from '../lib/types';
import { LogoMark, PlaceCard } from '../components/ui';

const MIN_ZOOM_FETCH = 9;
const DESKTOP = () => window.matchMedia('(min-width: 900px)').matches;

function makePin(p: Place): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pin ${scoreTier(p.score)}`;
  btn.setAttribute('aria-label', `${p.name}, ${p.score ? Number(p.score).toFixed(1) : 'chưa có điểm'}`);
  btn.innerHTML =
    `<span class="pin-emoji">${categoryOf(p.category).emoji}</span>` +
    `<span>${p.score == null ? '–' : Number(p.score).toFixed(1)}</span>` +
    (p.is_hot ? '<span class="pin-flame">🔥</span>' : '');
  return btn;
}

interface PinRef {
  marker: maplibregl.Marker;
  btn: HTMLButtonElement;
  sig: string;
}

const SNAP = [92, 232, 0.74]; // thu gọn, lưng chừng, mở rộng (tỉ lệ chiều cao bản đồ)

export default function MapPage() {
  const nav = useNavigate();
  const toast = useToast();
  const userFix = useUserFix();
  const pageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<maplibregl.Marker | null>(null);
  const pinsRef = useRef(new Map<string, PinRef>());
  const debounceRef = useRef<number | undefined>(undefined);
  const searchTimer = useRef<number | undefined>(undefined);
  const fetchSeq = useRef(0);

  const [places, setPlaces] = useState<Place[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [onlyHot, setOnlyHot] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [snap, setSnap] = useState(1);
  const [dragH, setDragH] = useState<number | null>(null);
  const [zoomLow, setZoomLow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Place[]>([]);
  const [addr, setAddr] = useState<AddressResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const filtersRef = useRef({ category, onlyHot });
  filtersRef.current = { category, onlyHot };

  const fetchPlaces = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    if (zoom < MIN_ZOOM_FETCH) {
      setZoomLow(true);
      setPlaces([]);
      return;
    }
    setZoomLow(false);
    const b = map.getBounds();
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const limit = zoom < 12 ? 60 : zoom < 14 ? 150 : 300;
      const data = await placesInBounds(
        { minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() },
        filtersRef.current.category,
        filtersRef.current.onlyHot,
        limit,
      );
      if (seq === fetchSeq.current) {
        setPlaces(data);
        setError(null);
      }
    } catch (e) {
      if (seq === fetchSeq.current) setError((e as Error).message);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, []);

  // Định vị: lấy kết quả chính xác nhất trong vài giây, không phóng to theo vòng sai số
  const locate = useCallback(async (silent = false) => {
    setLocating(true);
    try {
      const fix = await getBestPosition({ maxWaitMs: 9000, goodEnough: 40 });
      setUserFix(fix);
      const approx = fix.accuracy > 1500;
      mapRef.current?.flyTo({ center: [fix.lng, fix.lat], zoom: approx ? 14 : 16, duration: 900 });
      if (approx) {
        toast(`Vị trí chỉ là ước lượng theo mạng (sai số khoảng ${formatDistance(fix.accuracy)}). Dùng điện thoại để định vị chính xác hơn, hoặc kéo bản đồ tới nơi bạn đang đứng.`);
      } else if (!silent && fix.accuracy > 150) {
        toast(`Sóng GPS còn yếu (sai số khoảng ${formatDistance(fix.accuracy)}). Ra chỗ thoáng hơn để chính xác hơn.`);
      }
    } catch (e) {
      if (!silent) toast((e as Error).message);
    } finally {
      setLocating(false);
    }
  }, [toast]);

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const saved = loadView();
    const view = saved && saved.zoom >= 10 ? saved : null;
    const start = view ?? DEFAULT_VIEW;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: start.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (DESKTOP()) map.setPadding({ left: 440, top: 0, right: 0, bottom: 0 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('moveend', () => {
      const c = map.getCenter();
      saveView({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(fetchPlaces, 350);
    });
    map.on('load', async () => {
      fetchPlaces();
      if (!view && (await locationPermission()) === 'granted') locate(true);
    });
    map.on('click', () => setSelected(null));

    const pins = pinsRef.current;
    return () => {
      window.clearTimeout(debounceRef.current);
      pins.clear();
      meRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [fetchPlaces, locate]);

  useEffect(() => {
    fetchPlaces();
  }, [category, onlyHot, fetchPlaces]);

  // Chấm vị trí của người dùng
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userFix) {
      meRef.current?.remove();
      meRef.current = null;
      return;
    }
    if (!meRef.current) {
      const el = document.createElement('div');
      el.className = 'me-dot';
      meRef.current = new maplibregl.Marker({ element: el }).setLngLat([userFix.lng, userFix.lat]).addTo(map);
    } else {
      meRef.current.setLngLat([userFix.lng, userFix.lat]);
    }
  }, [userFix]);

  // Đồng bộ marker với danh sách quán
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    const keep = new Set(places.map((p) => p.id));
    if (selected) keep.add(selected.id);
    for (const [id, pin] of pins) {
      if (!keep.has(id)) {
        pin.marker.remove();
        pins.delete(id);
      }
    }
    const all = selected && !places.some((p) => p.id === selected.id) ? [...places, selected] : places;
    for (const p of all) {
      const sig = `${p.score}|${p.is_hot}|${p.category}`;
      const cur = pins.get(p.id);
      if (cur && cur.sig === sig) {
        cur.btn.classList.toggle('selected', p.id === selected?.id);
        continue;
      }
      if (cur) {
        cur.marker.remove();
        pins.delete(p.id);
      }
      const btn = makePin(p);
      btn.classList.toggle('selected', p.id === selected?.id);
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSelected(p);
      });
      const wrap = document.createElement('div');
      wrap.appendChild(btn);
      const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      pins.set(p.id, { marker, btn, sig });
    }
  }, [places, selected]);

  /* ---------- Kéo bảng danh sách ---------- */
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);
  const maxH = () => (pageRef.current?.clientHeight ?? 700) * SNAP[2];
  const snapH = (i: number) => (i === 2 ? maxH() : SNAP[i]);

  function onDragStart(e: RPointerEvent<HTMLElement>) {
    if (DESKTOP()) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startH: snapH(snap), moved: false };
  }
  function onDragMove(e: RPointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setDragH(Math.max(SNAP[0], Math.min(maxH(), d.startH + dy)));
  }
  function onDragEnd() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => (s === 2 ? 1 : s + 1));
    } else if (dragH != null) {
      let best = 0;
      for (let i = 1; i < 3; i++) if (Math.abs(snapH(i) - dragH) < Math.abs(snapH(best) - dragH)) best = i;
      setSnap(best);
    }
    setDragH(null);
  }

  /* ---------- Tìm kiếm ---------- */
  function onQuery(v: string) {
    setQ(v);
    setAddr(null);
    window.clearTimeout(searchTimer.current);
    if (v.trim().length < 2) {
      setFound([]);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        setFound(await searchPlaces(v.trim()));
      } catch {
        setFound([]);
      }
    }, 300);
  }

  async function runAddressSearch() {
    if (q.trim().length < 2) return;
    setSearching(true);
    try {
      setAddr(await searchAddress(q.trim()));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQ('');
    setFound([]);
    setAddr(null);
  }

  function pickPlace(p: Place) {
    clearSearch();
    setSelected(p);
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: Math.max(mapRef.current.getZoom(), 16) });
  }

  function pickAddress(a: AddressResult) {
    clearSearch();
    mapRef.current?.flyTo({ center: [a.lng, a.lat], zoom: 16 });
  }

  const showResults = q.trim().length >= 2;
  const sheetStyle = selected ? undefined : { height: dragH ?? snapH(snap) };

  return (
    <div className="map-page" ref={pageRef}>
      <div ref={containerRef} className="map-canvas" aria-label="Bản đồ quán ăn" />

      <div className="map-top">
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            runAddressSearch();
          }}
        >
          <LogoMark />
          <Search size={18} color="#8a93ad" className="search-icon" />
          <input
            value={q}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Tìm quán, món hoặc địa điểm"
            aria-label="Tìm quán, món hoặc địa điểm"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" className="icon-btn" style={{ boxShadow: 'none', width: 36, height: 36 }} onClick={clearSearch} aria-label="Xóa">
              <X size={18} />
            </button>
          )}
        </form>

        {showResults ? (
          <div className="search-results">
            {found.length > 0 && <div className="search-label">Quán trên FoodMap</div>}
            {found.map((p) => (
              <button key={p.id} className="search-item" onClick={() => pickPlace(p)}>
                <span className="tile" style={{ width: 40, height: 40, fontSize: 20, borderRadius: 12, background: categoryOf(p.category).tint }}>
                  {categoryOf(p.category).emoji}
                </span>
                <span style={{ minWidth: 0 }}>
                  <div className="place-name" style={{ fontSize: 15 }}>
                    {p.name}
                  </div>
                  <div className="place-meta">{p.address || categoryOf(p.category).label}</div>
                </span>
              </button>
            ))}
            <div className="search-label">Địa điểm trên bản đồ</div>
            {addr === null ? (
              <button className="search-item" onClick={runAddressSearch} disabled={searching}>
                <MapPin size={18} />
                <span>{searching ? 'Đang tìm…' : `Tìm “${q.trim()}” trên bản đồ`}</span>
              </button>
            ) : addr.length === 0 ? (
              <div className="place-meta" style={{ padding: 10 }}>
                Không thấy địa điểm phù hợp. Thử thêm tên quận hoặc thành phố.
              </div>
            ) : (
              addr.map((a, i) => (
                <button key={i} className="search-item" onClick={() => pickAddress(a)}>
                  <MapPin size={18} />
                  <span className="place-meta" style={{ whiteSpace: 'normal' }}>
                    {a.label}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="chips" role="group" aria-label="Lọc theo món">
            <button className={`chip${onlyHot ? ' on' : ''}`} onClick={() => setOnlyHot((v) => !v)}>
              🔥 Đang hot
            </button>
            <button className={`chip${category === null ? ' on' : ''}`} onClick={() => setCategory(null)}>
              Tất cả
            </button>
            {CATEGORIES.map((c) => (
              <button key={c.key} className={`chip${category === c.key ? ' on' : ''}`} onClick={() => setCategory(category === c.key ? null : c.key)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button className={`locate-fab${locating ? ' busy' : ''}${userFix ? ' on' : ''}`} onClick={() => locate(false)} aria-label="Về vị trí của tôi" title="Vị trí của tôi">
        <LocateFixed size={22} />
      </button>

      {zoomLow && <div className="map-hint">Phóng to bản đồ để xem quán</div>}

      {selected && (
        <div className="preview">
          <PlaceCard place={selected} onClick={() => nav(`/place/${selected.id}`)} />
          <div className="preview-actions">
            <button className="btn ghost small" onClick={() => nav(`/place/${selected.id}`)}>
              Xem quán <ArrowRight size={15} />
            </button>
            <button className="btn small" onClick={() => nav(`/place/${selected.id}/directions`)}>
              <Navigation size={15} /> Chỉ đường
            </button>
          </div>
        </div>
      )}

      <section className={`sheet${selected ? ' hidden' : ''}${dragH != null ? ' dragging' : ''}`} style={sheetStyle} aria-label="Danh sách quán trong khu vực">
        <button className="sheet-handle" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd} aria-label="Kéo để mở rộng hoặc thu gọn danh sách">
          <i />
        </button>
        <div className="sheet-head" onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
          <h2>{zoomLow ? 'Phóng to để xem quán' : onlyHot ? 'Quán đang hot gần đây' : 'Quán trong khu vực'}</h2>
          <span className="muted">{loading ? 'Đang tải…' : places.length > 0 ? `${places.length} quán` : ''}</span>
          <span className="spacer" />
          {onlyHot && (
            <span className="badge hot">
              <Flame size={12} /> Hot
            </span>
          )}
        </div>
        <div className="sheet-body">
          {error ? (
            <div className="error">{error}</div>
          ) : places.length > 0 ? (
            <div className="place-list">
              {places.map((p) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </div>
          ) : !loading && !zoomLow ? (
            <div className="empty">
              <div className="big">🍜</div>
              <div>Khu vực này chưa có quán nào.</div>
              <Link to="/add" className="btn small" style={{ marginTop: 12 }}>
                <Plus size={16} /> Thêm quán đầu tiên
              </Link>
            </div>
          ) : zoomLow ? (
            <div className="empty">Kéo và phóng to bản đồ vào khu vực bạn muốn tìm quán.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
