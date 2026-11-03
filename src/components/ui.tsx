import { useId } from 'react';
import { Star, Flame, BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { categoryOf, scoreTier } from '../lib/categories';
import { distanceM, formatDistance, useUserFix } from '../lib/geo';
import type { AreaLevel, Place } from '../lib/types';

export function LogoMark({ className = 'logo-mark' }: { className?: string }) {
  return <img src="/icons/icon.svg" alt="FoodMap" className={className} />;
}

export function ScoreBadge({ score, big }: { score: number | null; big?: boolean }) {
  return <span className={`score ${scoreTier(score)}${big ? ' big' : ''}`}>{score == null ? '–' : Number(score).toFixed(1)}</span>;
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={value >= i - 0.25 ? 'currentColor' : 'none'} strokeWidth={1.6} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="star-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} sao`} className={value >= i ? 'on' : ''} onClick={() => onChange(i)}>
          <Star size={30} fill={value >= i ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Huy hiệu Sành ăn: khiên + mũ đầu bếp + sao, màu theo cấp khu vực ---------- */
const TIER_COLORS: Record<AreaLevel, { light: string; mid: string; dark: string }> = {
  district: { light: '#f6d9bd', mid: '#cf8f5a', dark: '#8c5528' },
  city: { light: '#f7f9fd', mid: '#b4bfd2', dark: '#6b7891' },
  province: { light: '#ffeaa0', mid: '#ffc22e', dark: '#c78700' },
};

export function BadgeEmblem({ tier = 'province', size = 40 }: { tier?: AreaLevel; size?: number }) {
  const gid = useId().replace(/:/g, '');
  const c = TIER_COLORS[tier];
  return (
    <svg width={size} height={(size * 72) / 64} viewBox="0 0 64 72" role="img" aria-label="Huy hiệu Sành ăn">
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.5" stopColor={c.mid} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
      </defs>
      <path d="M32 3 56 11.5V34c0 17-11 28-24 34C19 62 8 51 8 34V11.5Z" fill={`url(#g${gid})`} stroke={c.dark} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 9.5 49.5 16v18c0 12-7.5 20.500-17.500 25.500C22 54.500 14.500 46 14.500 34V16Z" fill="#fffdf5" />
      <g fill="#1f3fd0">
        <circle cx="25.500" cy="28" r="5.500" />
        <circle cx="32" cy="24" r="6.800" />
        <circle cx="38.500" cy="28" r="5.500" />
        <rect x="24" y="28" width="16" height="9" />
        <rect x="25" y="37" width="14" height="5.500" rx="1.400" />
      </g>
      <rect x="25" y="38.800" width="14" height="1.500" fill={c.light} />
      <path d="m32 45.500 2 4 4.400.6-3.200 3.100.8 4.400L32 55.500l-4 2.100.8-4.400-3.200-3.100 4.400-.6Z" fill={`url(#g${gid})`} stroke={c.dark} strokeWidth=".6" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Avatar có viền: vàng cho Sành ăn / hạng 1, bạc hạng 2, đồng hạng 3 ---------- */
const AVATAR_COLORS = ['#1f3fd0', '#e5372a', '#13a075', '#8b3fd0', '#d96a00', '#0f7c9c', '#b0307a', '#4b5bd6'];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export type Ring = 'gold' | 'silver' | 'bronze' | null;

export function Avatar({
  name,
  url,
  size = 42,
  ring = null,
  foodie = false,
  tier,
}: {
  name: string;
  url?: string | null;
  size?: number;
  ring?: Ring;
  foodie?: boolean;
  tier?: AreaLevel;
}) {
  const effectiveRing: Ring = ring ?? (foodie ? 'gold' : null);
  const inner = effectiveRing ? size : size;
  const bg = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  return (
    <span className={`avatar-wrap${effectiveRing ? ` ring ring-${effectiveRing}` : ''}`}>
      <span className="avatar" style={{ width: inner, height: inner, fontSize: inner * 0.42, background: url ? '#e8ecf6' : bg }}>
        {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial(name)}
      </span>
      {foodie && (
        <span className="avatar-emblem">
          <BadgeEmblem tier={tier ?? 'province'} size={Math.max(20, Math.round(size * 0.52))} />
        </span>
      )}
    </span>
  );
}

export function PlaceCard({ place, onClick, rank }: { place: Place; onClick?: () => void; rank?: number }) {
  const cat = categoryOf(place.category);
  const fix = useUserFix();
  const dist = fix ? distanceM(fix.lat, fix.lng, place.lat, place.lng) : null;
  const inner = (
    <>
      {rank != null && <div className="rank-no">{['🥇', '🥈', '🥉'][rank - 1] ?? rank}</div>}
      <div className="tile" style={{ background: cat.tint }}>
        {cat.emoji}
      </div>
      <div className="place-info">
        <div className="place-name">{place.name}</div>
        <div className="place-meta">{place.address || [place.district, place.city].filter(Boolean).join(', ') || cat.label}</div>
        <div className="pc-chips">
          {place.is_hot && (
            <span className="badge hot">
              <Flame size={12} /> Đang hot
            </span>
          )}
          {dist != null && <span className="badge plain">{formatDistance(dist)}</span>}
          {place.verified_count > 0 ? (
            <span className="badge jade">
              <BadgeCheck size={12} /> {place.verified_count} xác thực
            </span>
          ) : (
            <span className="badge plain">{place.review_count > 0 ? `${place.review_count} review` : 'Chưa có review'}</span>
          )}
          {place.is_demo && <span className="badge demo">Demo</span>}
        </div>
      </div>
      <ScoreBadge score={place.score} />
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="place-card" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return (
    <Link to={`/place/${place.id}`} className="place-card">
      {inner}
    </Link>
  );
}

export function VerifiedStamp() {
  return (
    <span className="stamp">
      <BadgeCheck size={14} /> Đã tới quán
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="empty">
      <span className="spinner" />
      {label && <div style={{ marginTop: 8 }}>{label}</div>}
    </div>
  );
}

export function initial(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}
