import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from '../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, X, Flame, MapPin, Plus, Crosshair } from 'lucide-react';
import { Link } from 'react-router-dom';
import { placesInBounds, searchPlaces } from '../lib/api';
import { CATEGORIES, categoryOf, scoreTier } from '../lib/categories';
import { DEFAULT_VIEW, MAP_STYLE, loadView, locationPermission, saveView } from '../lib/geo';
import { searchAddress, type AddressResult } from '../lib/nominatim';
import { useToast } from '../lib/toast';
import type { Place } from '../lib/types';
import { PlaceCard } from '../components/ui';

const MIN_ZOOM_FETCH = 12;

function makePin(p: Place): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pin ${scoreTier(p.score)}`;
  btn.setAttribute('aria-label', `${p.name}, ${p.score ? p.score.toFixed(1) : 'chưa có điểm'}`);
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

export default function MapPage() {
  const nav = useNavigate();
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const geoRef = useRef<maplibregl.GeolocateControl | null>(null);
  const pinsRef = useRef(new Map<string, PinRef>());
  const debounceRef = useRef<number | undefined>(undefined);
  const searchTimer = useRef<number | undefined>(undefined);
  const fetchSeq = useRef(0);

  const [places, setPlaces] = useState<Place[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [onlyHot, setOnlyHot] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [sheet, setSheet] = useState<'peek' | 'full'>('peek');
  const [zoomLow, setZoomLow] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (map.getZoom() < MIN_ZOOM_FETCH) {
      setZoomLow(true);
      setPlaces([]);
      return;
    }
    setZoomLow(false);
    const b = map.getBounds();
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const data = await placesInBounds(
        { minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() },
        filtersRef.current.category,
        filtersRef.current.onlyHot,
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

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const view = loadView();
    const start = view ?? DEFAULT_VIEW;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: start.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    const geo = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
      fitBoundsOptions: { maxZoom: 16 },
    });
    geoRef.current = geo;
    map.addControl(geo, 'top-right');

    map.on('moveend', () => {
      const c = map.getCenter();
      saveView({ lng: c.lng, lat: c.lat, zoom: map.getZoom() });
      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(fetchPlaces, 350);
    });
    map.on('load', async () => {
      fetchPlaces();
      if (!view && (await locationPermission()) === 'granted') geo.trigger();
    });
    map.on('click', () => setSelected(null));

    const pins = pinsRef.current;
    return () => {
      window.clearTimeout(debounceRef.current);
      pins.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [fetchPlaces]);

  useEffect(() => {
    fetchPlaces();
  }, [category, onlyHot, fetchPlaces]);

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

  return (
    <div className="map-page">
      <div ref={containerRef} className="map-canvas" aria-label="Bản đồ quán ăn" />

      <div className="map-top">
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            runAddressSearch();
          }}
        >
          <Search size={18} color="#7a6a5e" />
          <input
            value={q}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Tìm quán hoặc địa điểm…"
            aria-label="Tìm quán hoặc địa điểm"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" className="icon-btn" style={{ boxShadow: 'none' }} onClick={clearSearch} aria-label="Xóa">
              <X size={18} />
            </button>
          )}
        </form>

        {showResults ? (
          <div className="search-results">
            {found.length > 0 && <div className="search-label">Quán trên FoodMap</div>}
            {found.map((p) => (
              <button key={p.id} className="search-item" onClick={() => pickPlace(p)}>
                <span className="place-emoji" style={{ width: 38, height: 38, fontSize: 19 }}>
                  {categoryOf(p.category).emoji}
                </span>
                <span style={{ minWidth: 0 }}>
                  <div className="place-name">{p.name}</div>
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
                Không thấy địa điểm phù hợp.
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
          <div className="chips" role="tablist" aria-label="Lọc theo món">
            <button className="chip" onClick={() => geoRef.current?.trigger()}>
              <Crosshair size={14} style={{ verticalAlign: -2 }} /> Gần tôi
            </button>
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

      {zoomLow && <div className="map-hint">Phóng to bản đồ để xem quán</div>}

      {selected ? (
        <div className="preview">
          <PlaceCard place={selected} onClick={() => nav(`/place/${selected.id}`)} />
        </div>
      ) : null}

      <section className={`sheet ${selected ? 'hidden' : sheet}`} aria-label="Danh sách quán trong khu vực">
        <button className="sheet-handle" onClick={() => setSheet(sheet === 'peek' ? 'full' : 'peek')} aria-label="Kéo lên hoặc xuống">
          <i />
        </button>
        <div className="sheet-head">
          <h2>Quanh khu vực này</h2>
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
              <div>Chưa có quán nào ở khu vực này.</div>
              <Link to="/add" className="btn small" style={{ marginTop: 12 }}>
                <Plus size={16} /> Thêm quán đầu tiên
              </Link>
            </div>
          ) : zoomLow ? (
            <div className="empty">Phóng to bản đồ để xem quán quanh bạn.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
