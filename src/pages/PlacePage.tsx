import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import maplibregl from '../lib/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, Bookmark, Flag, Navigation, PenLine, Share2, ThumbsDown, ThumbsUp, Trash2, Flame, BadgeCheck } from 'lucide-react';
import { deleteReview, getPlace, getReviews, isSaved, reportReview, setSaved, voteReview } from '../lib/api';
import { categoryOf } from '../lib/categories';
import { MAP_STYLE, distanceM, formatDistance, useUserFix } from '../lib/geo';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import type { Place, Review } from '../lib/types';
import { Avatar, ScoreBadge, Spinner, Stars, VerifiedStamp, timeAgo } from '../components/ui';

function applyVote(r: Review, next: boolean | null): Review {
  let acc = r.accurate_count;
  let inacc = r.inaccurate_count;
  if (r.my_vote === true) acc -= 1;
  if (r.my_vote === false) inacc -= 1;
  if (next === true) acc += 1;
  if (next === false) inacc += 1;
  return { ...r, my_vote: next, accurate_count: acc, inaccurate_count: inacc };
}

export default function PlacePage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const fix = useUserFix();
  const [place, setPlace] = useState<Place | null | undefined>(undefined);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [saved, setSavedState] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Review | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const miniRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([getPlace(id), getReviews(id)]);
      setPlace(p);
      setReviews(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setPlace(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      setSavedState(false);
      return;
    }
    isSaved(user.id, id).then(setSavedState).catch(() => {});
  }, [user, id]);

  const lat = place?.lat;
  const lng = place?.lng;
  useEffect(() => {
    if (!miniRef.current || lat == null || lng == null) return;
    const map = new maplibregl.Map({
      container: miniRef.current,
      style: MAP_STYLE,
      center: [lng, lat],
      zoom: 16,
      interactive: false,
      attributionControl: { compact: true },
    });
    const el = document.createElement('div');
    el.textContent = '📍';
    el.style.cssText = 'font-size:36px;line-height:1;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))';
    new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map);
    return () => map.remove();
  }, [lat, lng]);

  if (place === undefined) return <Spinner label="Đang tải quán…" />;
  if (!place) {
    return (
      <div className="page">
        <div className="empty">
          <div className="big">🤷</div>
          <div>{error ?? 'Không tìm thấy quán này.'}</div>
          <Link to="/" className="btn small" style={{ marginTop: 12 }}>
            Về bản đồ
          </Link>
        </div>
      </div>
    );
  }

  const c = categoryOf(place.category);
  const photos = reviews.flatMap((r) => r.photo_urls);
  const mine = reviews.find((r) => r.is_mine);
  const dist = fix ? distanceM(fix.lat, fix.lng, place.lat, place.lng) : null;

  async function toggleSave() {
    if (!user) {
      nav('/login', { state: { from: `/place/${id}` } });
      return;
    }
    const next = !saved;
    setSavedState(next);
    try {
      await setSaved(user.id, id, next);
      toast(next ? 'Đã lưu vào danh sách Muốn thử' : 'Đã bỏ lưu');
    } catch (e) {
      setSavedState(!next);
      toast((e as Error).message);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: place!.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Đã sao chép liên kết');
      }
    } catch {
      /* người dùng huỷ chia sẻ */
    }
  }

  async function vote(r: Review, v: boolean) {
    if (!user) {
      nav('/login', { state: { from: `/place/${id}` } });
      return;
    }
    const next = r.my_vote === v ? null : v;
    setReviews((rs) => rs.map((x) => (x.id === r.id ? applyVote(x, next) : x)));
    try {
      await voteReview(r.id, next);
      getPlace(id).then((p) => p && setPlace(p)).catch(() => {});
    } catch (e) {
      setReviews((rs) => rs.map((x) => (x.id === r.id ? r : x)));
      toast((e as Error).message);
    }
  }

  async function remove(r: Review) {
    if (!window.confirm('Xóa review của bạn?')) return;
    try {
      await deleteReview(r.id);
      toast('Đã xóa review');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function sendReport() {
    if (!reporting) return;
    try {
      await reportReview(reporting.id, reason.trim());
      toast('Đã gửi báo cáo, cảm ơn bạn');
      setReporting(null);
      setReason('');
      load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="page">
      <header className="shop-hero">
        <div className="awning" aria-hidden="true" />
        <div className="shop-photo" style={{ ['--tint' as string]: c.tint }}>
          {photos[0] ? <img src={photos[0]} alt={`Ảnh món tại ${place.name}`} onClick={() => setLightbox(photos[0])} /> : <span aria-hidden="true">{c.emoji}</span>}
        </div>
        <div className="hero-actions">
          <button className="icon-btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="Quay lại">
            <ArrowLeft size={20} />
          </button>
          <div className="row">
            <button className="icon-btn" onClick={toggleSave} aria-label={saved ? 'Bỏ lưu' : 'Lưu quán'} aria-pressed={saved}>
              <Bookmark size={20} fill={saved ? 'currentColor' : 'none'} color={saved ? '#1f3fd0' : undefined} />
            </button>
            <button className="icon-btn" onClick={share} aria-label="Chia sẻ">
              <Share2 size={19} />
            </button>
          </div>
        </div>
      </header>

      <div className="shop-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{place.name}</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            {c.emoji} {c.label}
            {place.address ? `, ${place.address}` : ''}
          </div>
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
            {place.is_hot && (
              <span className="badge hot">
                <Flame size={12} /> Đang hot
              </span>
            )}
            {place.verified_count > 0 && (
              <span className="badge jade">
                <BadgeCheck size={12} /> {place.verified_count} review xác thực
              </span>
            )}
            {dist != null && <span className="badge plain">Cách bạn {formatDistance(dist)}</span>}
            {place.is_demo && <span className="badge demo">Dữ liệu demo</span>}
          </div>
        </div>
        <div>
          <ScoreBadge score={place.score} big />
          <div className="score-meta">{place.review_count > 0 ? `${place.review_count} review` : 'Chưa có review'}</div>
        </div>
      </div>

      {place.suspicious && <div className="note">Quán đang nhận nhiều review từ tài khoản mới trong thời gian ngắn, hệ thống tạm giảm độ hot để tránh sai lệch.</div>}

      <div className="action-row">
        <Link to={`/place/${id}/directions`} className="btn">
          <Navigation size={18} /> Chỉ đường
        </Link>
        {mine ? (
          <span className="btn ghost" style={{ cursor: 'default' }}>
            <BadgeCheck size={18} color="#13a075" /> Bạn đã review
          </span>
        ) : (
          <Link to={`/place/${id}/review`} className="btn sign">
            <PenLine size={18} /> Viết review
          </Link>
        )}
      </div>

      <div ref={miniRef} className="mini-map" aria-label="Vị trí quán trên bản đồ" />

      {photos.length > 0 && (
        <>
          <h2 className="section-title">Ảnh từ thực khách</h2>
          <div className="photo-strip">
            {photos.map((u) => (
              <img key={u} src={u} alt="Ảnh món ăn" loading="lazy" onClick={() => setLightbox(u)} />
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Review ({reviews.length})</h2>
      <p className="muted" style={{ marginTop: -4, marginBottom: 12, fontSize: 13.5 }}>
        Review của người Sành ăn và review được nhiều người đã tới quán xác nhận được xếp lên đầu.
      </p>
      {reviews.length === 0 && (
        <div className="empty">
          <div className="big">✍️</div>
          Chưa có review nào. Hãy là người đầu tiên kể về quán này.
        </div>
      )}
      {reviews.map((r) => (
        <article key={r.id} className={`card review${r.is_foodie ? ' foodie' : ''}`}>
          <div className="review-head">
            <Avatar name={r.display_name} url={r.avatar_url} size={44} foodie={r.is_foodie} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="review-name">{r.display_name}</div>
              <div className="review-badges">
                {r.is_foodie && <span className="badge sign">Sành ăn</span>}
                {r.verified && <VerifiedStamp />}
                {r.sponsored && <span className="badge plain">Được mời hoặc tài trợ</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Stars value={Number(r.rating_overall)} size={14} />
              <div className="muted" style={{ fontSize: 12.5 }}>
                {timeAgo(r.created_at)}
              </div>
            </div>
          </div>

          <div className="sub-ratings">
            <div className="sub-rating">
              <b>{r.rating_taste}</b>Hương vị
            </div>
            <div className="sub-rating">
              <b>{r.rating_price}</b>Giá cả
            </div>
            <div className="sub-rating">
              <b>{r.rating_service}</b>Phục vụ
            </div>
          </div>

          {r.body && <p style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p>}
          {r.tags.length > 0 && (
            <div className="tags">
              {r.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          )}
          {r.photo_urls.length > 0 && (
            <div className="photo-strip" style={{ marginTop: 8 }}>
              {r.photo_urls.map((u) => (
                <img key={u} src={u} alt="Ảnh trong review" loading="lazy" onClick={() => setLightbox(u)} />
              ))}
            </div>
          )}
          {r.sponsored && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Review này không được tính vào điểm của quán.</p>}

          <div className="vote-row">
            {!r.is_mine && (
              <>
                <button className={`vote${r.my_vote === true ? ' on-yes' : ''}`} onClick={() => vote(r, true)} aria-pressed={r.my_vote === true}>
                  <ThumbsUp size={15} /> Đúng thực tế · {r.accurate_count}
                </button>
                <button className={`vote${r.my_vote === false ? ' on-no' : ''}`} onClick={() => vote(r, false)} aria-pressed={r.my_vote === false}>
                  <ThumbsDown size={15} /> Chưa đúng · {r.inaccurate_count}
                </button>
              </>
            )}
            <span className="spacer" />
            {r.is_mine ? (
              <button className="link-btn" onClick={() => remove(r)}>
                <Trash2 size={13} style={{ verticalAlign: -2 }} /> Xóa
              </button>
            ) : (
              user && (
                <button className="link-btn" onClick={() => setReporting(r)}>
                  <Flag size={13} style={{ verticalAlign: -2 }} /> Báo cáo sai sự thật
                </button>
              )
            )}
          </div>
        </article>
      ))}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Xem ảnh">
          <img src={lightbox} alt="Ảnh phóng to" />
        </div>
      )}

      {reporting && (
        <div className="modal-back" onClick={() => setReporting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="display" style={{ marginBottom: 8, fontSize: 22 }}>
              Báo cáo review sai sự thật
            </h2>
            <p className="muted" style={{ marginBottom: 12, fontSize: 14 }}>
              Ví dụ: quảng cáo trá hình, chưa từng tới quán, nội dung không đúng thực tế. Khi đủ người đã tới quán báo cáo, review sẽ được ẩn để xem xét.
            </p>
            <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do (không bắt buộc)" maxLength={500} />
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setReporting(null)}>
                Hủy
              </button>
              <span className="spacer" />
              <button className="btn" onClick={sendReport}>
                Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
