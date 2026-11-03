import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { getConfig, leaderboardPlaces, leaderboardReviewers, listAreas } from '../lib/api';
import { LEVEL_LABEL, type Area, type AreaLevel, type LeaderReviewer, type Place } from '../lib/types';
import { Avatar, BadgeEmblem, PlaceCard, Spinner, type Ring } from '../components/ui';

const RINGS: Ring[] = ['gold', 'silver', 'bronze'];

function Pod({ p, level }: { p: LeaderReviewer; level: AreaLevel }) {
  const r = p.rank;
  return (
    <div className={`pod p${r}`}>
      {r === 1 && <Crown size={22} color="#e49a00" fill="#ffd45e" />}
      <Avatar name={p.display_name} url={p.avatar_url} size={r === 1 ? 68 : 56} ring={RINGS[r - 1]} foodie={p.is_foodie} tier={level} />
      <span className={`pod-rank r${r}`}>{r}</span>
      <div className="pod-name">{p.display_name}</div>
      <div className="pod-pts">
        {Number(p.pts).toFixed(0)} điểm
        <br />
        {p.verified_count} xác thực
      </div>
    </div>
  );
}

export default function TopPage() {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [config, setConfig] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<'places' | 'people'>('places');
  const [level, setLevel] = useState<AreaLevel>('city');
  const [area, setArea] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [people, setPeople] = useState<LeaderReviewer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listAreas(), getConfig()])
      .then(([a, c]) => {
        setAreas(a);
        setConfig(c);
        const lv = (['city', 'district', 'province'] as AreaLevel[]).find((l) => a.some((x) => x.level === l));
        if (lv) {
          setLevel(lv);
          setArea(a.find((x) => x.level === lv)!.area);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const levels = useMemo(() => (['district', 'city', 'province'] as AreaLevel[]).filter((l) => areas?.some((a) => a.level === l)), [areas]);
  const options = useMemo(() => (areas ?? []).filter((a) => a.level === level), [areas, level]);

  useEffect(() => {
    if (!area) return;
    setPlaces(null);
    setPeople(null);
    setError(null);
    const run = tab === 'places' ? leaderboardPlaces(level, area).then(setPlaces) : leaderboardReviewers(level, area).then(setPeople);
    run.catch((e) => setError((e as Error).message));
  }, [tab, level, area]);

  function changeLevel(l: AreaLevel) {
    setLevel(l);
    setArea(areas?.find((a) => a.level === l)?.area ?? '');
  }

  if (!areas && !error) return <Spinner label="Đang tải bảng xếp hạng…" />;

  const top3 = (people ?? []).filter((p) => p.rank <= 3).slice(0, 3);
  const rest = (people ?? []).filter((p) => !top3.includes(p));
  // Bục vinh danh: hạng 2, hạng 1, hạng 3
  const podium = [top3.find((p) => p.rank === 2), top3.find((p) => p.rank === 1), top3.find((p) => p.rank === 3)];

  return (
    <div className="page">
      <h1 className="page-title">Bảng xếp hạng</h1>
      <p className="page-sub">Quán ngon và người review đáng tin nhất theo từng khu vực.</p>

      {error && <div className="error">{error}</div>}

      {levels.length === 0 ? (
        <div className="empty">
          <div className="big">🏆</div>
          Chưa có dữ liệu để xếp hạng.
          <div style={{ marginTop: 12 }}>
            <Link to="/add" className="btn small">
              Thêm quán đầu tiên
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="segmented" role="tablist">
            <button className={tab === 'places' ? 'on' : ''} onClick={() => setTab('places')}>
              🍜 Quán ngon
            </button>
            <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>
              Sành ăn
            </button>
          </div>

          <div className="chips" style={{ marginBottom: 6 }}>
            {levels.map((l) => (
              <button key={l} className={`chip${level === l ? ' on' : ''}`} onClick={() => changeLevel(l)}>
                {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
          <select className="select" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Chọn khu vực" style={{ marginBottom: 16 }}>
            {options.map((a) => (
              <option key={a.area} value={a.area}>
                {a.area} ({a.place_count} quán)
              </option>
            ))}
          </select>

          {tab === 'places' &&
            (places === null ? (
              <Spinner />
            ) : places.length === 0 ? (
              <div className="empty">
                <div className="big">⭐</div>
                Chưa có quán nào đủ {config.place_rank_min_reviews ?? 10} review xác thực để vào bảng xếp hạng khu vực này.
              </div>
            ) : (
              <div className="place-list">
                {places.map((p, i) => (
                  <PlaceCard key={p.id} place={p} rank={i + 1} />
                ))}
              </div>
            ))}

          {tab === 'people' &&
            (people === null ? (
              <Spinner />
            ) : people.length === 0 ? (
              <div className="empty">
                <div className="big">
                  <BadgeEmblem tier={level} size={56} />
                </div>
                Chưa ai đủ {config.foodie_min_verified ?? 20} review xác thực để xét danh hiệu ở khu vực này.
              </div>
            ) : (
              <div>
                {top3.length > 0 && (
                  <div className="podium">
                    {podium.map((p, i) => (p ? <Pod key={p.user_id} p={p} level={level} /> : <div key={i} />))}
                  </div>
                )}
                {rest.map((p) => (
                  <div className="rank-row" key={p.user_id}>
                    <div className="rank-no">{p.rank}</div>
                    <Avatar name={p.display_name} url={p.avatar_url} size={42} foodie={p.is_foodie} tier={level} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="review-name">{p.display_name}</div>
                      <div className="place-meta">
                        {p.verified_count} review xác thực, {Number(p.pts).toFixed(0)} điểm uy tín
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          <div className="card" style={{ padding: 15, marginTop: 20 }}>
            <b className="display">Cách xếp hạng</b>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              Quán cần ít nhất {config.place_rank_min_reviews ?? 10} review xác thực để vào bảng. Điểm ưu tiên review của người uy tín và bỏ qua review được mời hoặc tài trợ. Danh hiệu Sành ăn dành cho top {config.foodie_top_n ?? 10} người có điểm uy tín cao nhất khu vực (từ {config.foodie_min_verified ?? 20} review xác thực), tính theo việc review của bạn được người đã tới quán xác nhận là đúng.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
