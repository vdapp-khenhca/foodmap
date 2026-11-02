import { Star, Flame, BadgeCheck, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { categoryOf, scoreTier } from '../lib/categories';
import type { Place } from '../lib/types';

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
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} sao`}
          className={value >= i ? 'on' : ''}
          onClick={() => onChange(i)}
        >
          <Star size={30} fill={value >= i ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </button>
      ))}
    </div>
  );
}

export function PlaceCard({ place, onClick, rank }: { place: Place; onClick?: () => void; rank?: number }) {
  const cat = categoryOf(place.category);
  const inner = (
    <>
      {rank != null && <div className={`rank-no${rank <= 3 ? ' top' : ''}`}>{['🥇', '🥈', '🥉'][rank - 1] ?? rank}</div>}
      <div className="place-emoji">{cat.emoji}</div>
      <div className="place-info">
        <div className="place-name">{place.name}</div>
        <div className="place-meta">{place.address || [place.district, place.city].filter(Boolean).join(', ') || cat.label}</div>
        <div className="row" style={{ marginTop: 4, gap: 6, flexWrap: 'wrap' }}>
          {place.is_hot && (
            <span className="badge hot">
              <Flame size={12} /> Đang hot
            </span>
          )}
          <span className="place-meta">
            {place.review_count > 0 ? `${place.review_count} review` : 'Chưa có review'}
            {place.verified_count > 0 && ` · ${place.verified_count} xác thực`}
          </span>
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

export function FoodieBadge() {
  return (
    <span className="badge foodie">
      <Trophy size={12} /> Sành ăn
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="badge verified">
      <BadgeCheck size={12} /> Đã check-in
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
