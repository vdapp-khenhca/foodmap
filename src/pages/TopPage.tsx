import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConfig, leaderboardPlaces, leaderboardReviewers, listAreas } from '../lib/api';
import { LEVEL_LABEL, type Area, type AreaLevel, type LeaderReviewer, type Place } from '../lib/types';
import { FoodieBadge, PlaceCard, Spinner, initial } from '../components/ui';

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

  const levels = useMemo(
    () => (['district', 'city', 'province'] as AreaLevel[]).filter((l) => areas?.some((a) => a.level === l)),
    [areas],
  );
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
    const first = areas?.find((a) => a.level === l);
    setArea(first?.area ?? '');
  }

  if (!areas && !error) return <Spinner label="Đang tải bảng xếp hạng…" />;

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
              🏅 Sành ăn
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
                <div className="big">🏅</div>
                Chưa ai đủ {config.foodie_min_verified ?? 20} review xác thực để xét danh hiệu ở khu vực này.
              </div>
            ) : (
              <div>
                {people.map((p) => (
                  <div className="rank-row" key={p.user_id}>
                    <div className={`rank-no${p.rank <= 3 ? ' top' : ''}`}>{['🥇', '🥈', '🥉'][p.rank - 1] ?? p.rank}</div>
                    <div className="avatar">{initial(p.display_name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="review-name">{p.display_name}</div>
                      <div className="place-meta">
                        {p.verified_count} review xác thực · {Number(p.pts).toFixed(0)} điểm uy tín
                      </div>
                    </div>
                    {p.is_foodie && <FoodieBadge />}
                  </div>
                ))}
              </div>
            ))}

          <div className="card" style={{ padding: 14, marginTop: 20 }}>
            <b>Cách xếp hạng</b>
            <p className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>
              Quán cần ít nhất {config.place_rank_min_reviews ?? 10} review xác thực để vào bảng; điểm ưu tiên review của người uy tín và bỏ qua review được mời/tài trợ.
              Danh hiệu Sành ăn dành cho top {config.foodie_top_n ?? 10} người có điểm uy tín cao nhất khu vực (từ {config.foodie_min_verified ?? 20} review xác thực),
              tính dựa trên việc review của bạn được người đã tới quán xác nhận là đúng.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
