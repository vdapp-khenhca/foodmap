import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Pencil, Trophy } from 'lucide-react';
import { getConfig, listSaved, myStats, updateDisplayName, userBadges } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { LEVEL_LABEL, type Badge, type Place, type ReviewerStats } from '../lib/types';
import { Avatar, BadgeEmblem, PlaceCard, Spinner } from '../components/ui';

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<ReviewerStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [saved, setSaved] = useState<Place[]>([]);
  const [config, setConfig] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    Promise.all([myStats(user.id), userBadges(user.id), listSaved(user.id), getConfig()])
      .then(([s, b, sv, c]) => {
        if (!alive) return;
        setStats(s);
        setName(s?.display_name ?? '');
        setBadges(b);
        setSaved(sv);
        setConfig(c);
      })
      .catch((e) => toast((e as Error).message))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [user, toast]);

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 24, marginTop: 24, textAlign: 'center' }}>
          <img src="/icons/icon.svg" alt="" className="logo-mark" style={{ margin: '0 auto 12px' }} />
          <h1 className="page-title">Chào bạn</h1>
          <p className="page-sub">Đăng nhập để review, lưu quán muốn thử và nhận danh hiệu Sành ăn.</p>
          <Link to="/login" state={{ from: '/me' }} className="btn block">
            Đăng nhập / Đăng ký
          </Link>
        </div>
      </div>
    );
  }

  async function saveName() {
    if (!user) return;
    const v = name.trim();
    if (v.length < 2) {
      toast('Tên cần ít nhất 2 ký tự');
      return;
    }
    try {
      await updateDisplayName(user.id, v);
      setStats((s) => (s ? { ...s, display_name: v } : s));
      setEditing(false);
      toast('Đã đổi tên hiển thị');
    } catch (e) {
      toast((e as Error).message);
    }
  }

  if (!ready) return <Spinner />;

  const need = Math.max(0, (config.foodie_min_verified ?? 20) - (stats?.verified_count ?? 0));
  const displayName = stats?.display_name ?? user.email ?? 'Bạn';

  return (
    <div className="page">
      <div className="profile-hero">
        <Avatar name={displayName} size={64} foodie={badges.length > 0} tier={badges[0]?.level} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div className="row">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Tên hiển thị" />
              <button className="btn small" onClick={saveName}>
                Lưu
              </button>
            </div>
          ) : (
            <>
              <div className="page-title" style={{ marginBottom: 0 }}>
                {displayName}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {user.email}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Đổi tên">
            <Pencil size={18} />
          </button>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <b>{stats?.review_count ?? 0}</b>
          <span>Review</span>
        </div>
        <div className="stat">
          <b>{stats?.verified_count ?? 0}</b>
          <span>Xác thực</span>
        </div>
        <div className="stat">
          <b>{Math.round(stats?.reputation ?? 0)}</b>
          <span>Điểm uy tín</span>
        </div>
      </div>

      <h2 className="section-title">
        <Trophy size={20} /> Danh hiệu
      </h2>
      {badges.length > 0 ? (
        badges.map((b) => (
          <div className="badge-card" key={b.level + b.area}>
            <BadgeEmblem tier={b.level} size={48} />
            <div>
              <b>Sành ăn {LEVEL_LABEL[b.level]}</b>
              <div className="muted" style={{ fontSize: 13.5 }}>
                {b.area}, hạng {b.rank}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="muted">
          {need > 0
            ? `Cần thêm ${need} review xác thực (check-in tại quán) để được xét danh hiệu Sành ăn.`
            : 'Bạn đã đủ điều kiện xét. Tiếp tục review để vào top khu vực của mình!'}
        </p>
      )}

      <h2 className="section-title">Muốn thử ({saved.length})</h2>
      {saved.length === 0 ? (
        <p className="muted">Bấm “Muốn thử” ở trang quán để lưu lại.</p>
      ) : (
        <div className="place-list">
          {saved.map((p) => (
            <PlaceCard key={p.id} place={p} />
          ))}
        </div>
      )}

      <button className="btn ghost block" style={{ marginTop: 28 }} onClick={() => signOut()}>
        <LogOut size={18} /> Đăng xuất
      </button>
      <p className="center muted" style={{ marginTop: 16, fontSize: 12.5 }}>
        FoodMap – bản thử nghiệm. Dữ liệu và tính năng có thể thay đổi.
      </p>
    </div>
  );
}
