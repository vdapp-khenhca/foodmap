import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Image as ImageIcon, LocateFixed, MapPinOff, X } from 'lucide-react';
import { createReview, friendlyError, getPlace, uploadPhoto } from '../lib/api';
import { REVIEW_TAGS, categoryOf } from '../lib/categories';
import { compressImage } from '../lib/image';
import { distanceM, formatDistance, getPosition, type Fix } from '../lib/geo';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Place } from '../lib/types';
import { Spinner, StarInput } from '../components/ui';

const RADIUS_M = 150;
const MAX_ACCURACY_M = 200;
const MAX_PHOTOS = 6;

interface Photo {
  blob: Blob;
  preview: string;
}

export default function ReviewPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locState, setLocState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [locError, setLocError] = useState('');
  const [taste, setTaste] = useState(0);
  const [price, setPrice] = useState(0);
  const [service, setService] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sponsored, setSponsored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPlace(id)
      .then(setPlace)
      .catch(() => setPlace(null));
  }, [id]);

  const locate = useCallback(async () => {
    setLocState('loading');
    try {
      setFix(await getPosition(15000));
      setLocState('ready');
    } catch (e) {
      setLocError((e as Error).message);
      setLocState('error');
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  if (place === undefined) return <Spinner label="Đang tải…" />;
  if (!place) return <div className="page no-tabs"><div className="empty">Không tìm thấy quán.</div></div>;

  const cat = categoryOf(place.category);
  const dist = fix ? distanceM(fix.lat, fix.lng, place.lat, place.lng) : null;
  const nearOk = fix && dist != null && dist <= RADIUS_M && fix.accuracy <= MAX_ACCURACY_M;

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) toast(`Chỉ thêm được tối đa ${MAX_PHOTOS} ảnh`);
    try {
      const added: Photo[] = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        const blob = await compressImage(f);
        added.push({ blob, preview: URL.createObjectURL(blob) });
      }
      setPhotos((p) => [...p, ...added]);
    } catch (err) {
      toast((err as Error).message);
    }
  }

  function removePhoto(i: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[i].preview);
      return p.filter((_, k) => k !== i);
    });
  }

  function toggleTag(t: string) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 8 ? cur : [...cur, t]));
  }

  async function submit() {
    if (!user || !place) return;
    if (!taste || !price || !service) {
      setError('Hãy chấm đủ 3 tiêu chí: hương vị, giá cả, phục vụ');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Lấy lại vị trí mới nhất ngay lúc gửi; máy chủ sẽ tự kiểm tra khoảng cách
      let f = fix;
      try {
        f = await getPosition(8000, 30000);
        setFix(f);
      } catch {
        /* dùng vị trí đã có (nếu có) */
      }
      const urls: string[] = [];
      for (const p of photos) urls.push(await uploadPhoto(user.id, place.id, p.blob));
      await createReview({
        placeId: place.id,
        taste,
        price,
        service,
        body: body.trim(),
        tags,
        photoUrls: urls,
        sponsored,
        lat: f?.lat ?? null,
        lng: f?.lng ?? null,
        accuracy: f?.accuracy ?? null,
      });
      toast('Đã đăng review. Cảm ơn bạn!');
      nav(`/place/${place.id}`, { replace: true });
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
        <div style={{ minWidth: 0 }}>
          <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Review {place.name}</h1>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {cat.emoji} {cat.label}
          </div>
        </div>
      </div>

      <div className="form-pad">
        {locState === 'loading' && (
          <div className="verify-box wait">
            <span className="spinner" /> Đang xác định vị trí của bạn…
          </div>
        )}
        {locState === 'error' && (
          <div className="verify-box bad">
            <MapPinOff size={20} />
            <div style={{ flex: 1 }}>
              {locError}. Bạn vẫn đăng được review, nhưng review chưa được xác thực nên có trọng số thấp hơn.
              <div>
                <button className="link-btn" onClick={locate} style={{ padding: '6px 0' }}>
                  Thử lại vị trí
                </button>
              </div>
            </div>
          </div>
        )}
        {locState === 'ready' && fix && dist != null && (
          <div className={`verify-box ${nearOk ? 'ok' : 'bad'}`}>
            {nearOk ? <CheckCircle2 size={20} /> : <LocateFixed size={20} />}
            <div style={{ flex: 1 }}>
              {nearOk ? (
                <>Đã xác nhận bạn đang ở quán{dist >= 20 ? ` (cách khoảng ${formatDistance(dist)})` : ''}. Review sẽ được tính đầy đủ.</>
              ) : fix.accuracy > MAX_ACCURACY_M ? (
                <>Sóng GPS đang yếu (sai số khoảng {formatDistance(fix.accuracy)}). Hãy ra chỗ thoáng hơn rồi thử lại để được xác thực.</>
              ) : (
                <>Bạn đang cách quán khoảng {formatDistance(dist)}. Review vẫn đăng được nhưng chưa xác thực, nên có trọng số thấp hơn.</>
              )}
              {!nearOk && (
                <div>
                  <button className="link-btn" onClick={locate} style={{ padding: '6px 0' }}>
                    Kiểm tra lại vị trí
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="card" style={{ padding: '4px 16px' }}>
          <div className="rate-row">
            <b>Hương vị</b>
            <StarInput value={taste} onChange={setTaste} label="Hương vị" />
          </div>
          <div className="rate-row">
            <b>Giá cả</b>
            <StarInput value={price} onChange={setPrice} label="Giá cả" />
          </div>
          <div className="rate-row">
            <b>Phục vụ</b>
            <StarInput value={service} onChange={setService} label="Phục vụ" />
          </div>
        </div>

        <div className="section-title">Thẻ nhanh</div>
        <div className="tag-pick">
          {REVIEW_TAGS.map((t) => (
            <button key={t} type="button" className={`chip${tags.includes(t) ? ' on-leaf' : ''}`} onClick={() => toggleTag(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="section-title">Cảm nhận của bạn</div>
        <textarea
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder="Món nào ngon, món nào nên tránh, giá khoảng bao nhiêu… (không bắt buộc)"
        />

        <div className="section-title">Ảnh thật ({photos.length}/{MAX_PHOTOS})</div>
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div className="photo-tile" key={p.preview}>
              <img src={p.preview} alt={`Ảnh ${i + 1}`} />
              <button type="button" onClick={() => removePhoto(i)} aria-label="Xóa ảnh">
                <X size={14} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <>
              <button type="button" className="photo-add" onClick={() => camRef.current?.click()}>
                <Camera size={22} /> Chụp ảnh
              </button>
              <button type="button" className="photo-add" onClick={() => libRef.current?.click()}>
                <ImageIcon size={22} /> Từ thư viện
              </button>
            </>
          )}
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={addFiles} />
        <input ref={libRef} type="file" accept="image/*" multiple hidden onChange={addFiles} />
        <p className="hint">Ảnh chụp trực tiếp tại quán giúp review đáng tin hơn.</p>

        <label className="switch-row" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} />
          <span>
            <b>Tôi được mời hoặc được tài trợ bữa này</b>
            <div className="muted" style={{ fontSize: 13 }}>
              Review vẫn được đăng với nhãn minh bạch nhưng không tính vào điểm xếp hạng quán. Che giấu tài trợ sẽ bị trừ điểm uy tín.
            </div>
          </span>
        </label>

        <button className="btn block" style={{ marginTop: 20 }} onClick={submit} disabled={busy}>
          {busy ? 'Đang đăng…' : 'Đăng review'}
        </button>
      </div>
    </div>
  );
}
