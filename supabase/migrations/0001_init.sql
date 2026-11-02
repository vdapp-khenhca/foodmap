-- =====================================================================
-- FoodMap: database schema, bảo mật (RLS), chống gian lận, xếp hạng
-- Dùng lat/lng + công thức haversine (không cần PostGIS) để đơn giản và dễ chạy.
-- Chạy file này trong Supabase: SQL Editor -> New query -> dán -> Run.
-- =====================================================================

-- ---------- Cấu hình có thể chỉnh không cần deploy lại -------------
create table public.app_config (
  key   text primary key,
  value numeric not null,
  note  text
);

insert into public.app_config (key, value, note) values
  ('foodie_min_verified',    3,   'Số review xác thực tối thiểu để xét Sành ăn (bản chạy thật nên đặt khoảng 20)'),
  ('foodie_top_n',           10,  'Top bao nhiêu người mỗi khu vực được danh hiệu Sành ăn'),
  ('place_rank_min_reviews', 3,   'Số review xác thực tối thiểu để quán vào bảng xếp hạng (bản chạy thật nên đặt khoảng 10)'),
  ('hot_threshold',          5,   'Điểm hot tối thiểu để hiện biểu tượng lửa'),
  ('checkin_radius_m',       150, 'Bán kính (mét) coi là đã tới quán'),
  ('checkin_max_accuracy_m', 200, 'Sai số GPS tối đa (mét) được chấp nhận để xác thực'),
  ('daily_review_limit',     8,   'Số review tối đa mỗi người mỗi ngày'),
  ('daily_place_limit',      10,  'Số quán mới tối đa mỗi người mỗi ngày'),
  ('daily_vote_limit',       60,  'Số lượt vote đúng/sai tối đa mỗi người mỗi ngày');

create or replace function public.cfg(k text)
returns numeric language sql stable security definer set search_path = public as
$$ select value from public.app_config where key = k $$;

-- ---------- Hàm tiện ích -------------------------------------------
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as
$$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

-- Bỏ dấu tiếng Việt để tìm "pho" ra "Phở"
create or replace function public.vn_unaccent(s text)
returns text language sql immutable parallel safe as
$$ select translate(lower(s), 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd') $$;

-- ---------- Hồ sơ người dùng ---------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  avatar_url   text,
  home_city    text,
  created_at   timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as
$$
declare
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                     nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                     'Thực khách');
  if char_length(v_name) < 2 then v_name := 'Thực khách'; end if;
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 40))
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Quán ----------------------------------------------------
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  address     text check (char_length(address) <= 300),
  district    text,
  city        text,
  province    text,
  category    text not null default 'khac'
              check (category in ('pho','bun_mi','com','lau_nuong','an_vat','ca_phe','tra_sua','quan_nhau','khac')),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  name_search text generated always as (public.vn_unaccent(name || ' ' || coalesce(address, ''))) stored
);

create index places_lat_lng_idx on public.places (lat, lng);
create index places_region_idx  on public.places (province, city, district);

create or replace function public.places_before_insert()
returns trigger language plpgsql set search_path = public as
$$
begin
  -- Chỉ áp giới hạn cho người dùng app; quản trị (SQL Editor / service role) được bỏ qua.
  if current_user in ('anon', 'authenticated') then
    new.created_by := auth.uid();
    if new.created_by is null then
      raise exception 'Cần đăng nhập để thêm quán';
    end if;
    if (select count(*) from public.places
         where created_by = new.created_by and created_at > now() - interval '1 day') >= public.cfg('daily_place_limit') then
      raise exception 'Hôm nay bạn đã thêm quá nhiều quán, mai thử lại nhé';
    end if;
    if exists (select 1 from public.places p
                where abs(p.lat - new.lat) < 0.0005 and abs(p.lng - new.lng) < 0.0005
                  and public.distance_m(p.lat, p.lng, new.lat, new.lng) < 30
                  and public.vn_unaccent(p.name) = public.vn_unaccent(new.name)) then
      raise exception 'Quán này đã có trên bản đồ';
    end if;
  end if;
  new.name := trim(new.name);
  return new;
end
$$;

create trigger places_before_insert
  before insert on public.places
  for each row execute function public.places_before_insert();

-- ---------- Review ---------------------------------------------------
create table public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  place_id            uuid not null references public.places (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  rating_taste        smallint not null check (rating_taste   between 1 and 5),
  rating_price        smallint not null check (rating_price   between 1 and 5),
  rating_service      smallint not null check (rating_service between 1 and 5),
  rating_overall      numeric(3, 2) generated always as ((rating_taste * 2 + rating_price + rating_service) / 4.0) stored,
  body                text check (char_length(body) <= 2000),
  tags                text[] not null default '{}',
  photo_urls          text[] not null default '{}',
  verified            boolean not null default false,
  checkin_distance_m  integer,
  sponsored           boolean not null default false,
  hidden              boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (place_id, user_id)
);

create index reviews_place_idx on public.reviews (place_id);
create index reviews_user_idx  on public.reviews (user_id);

create table public.review_votes (
  review_id      uuid not null references public.reviews (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  is_accurate    boolean not null,
  voter_verified boolean not null default false,
  created_at     timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.review_reports (
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.saves (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  place_id   uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ---------- Tính điểm: phiếu vote, uy tín, trọng số ------------------
create view public.v_review_votes as
select review_id,
       coalesce(sum(case when is_accurate     then (case when voter_verified then 1.0 else 0.25 end) end), 0) as acc_w,
       coalesce(sum(case when not is_accurate then (case when voter_verified then 1.0 else 0.25 end) end), 0) as inacc_w,
       count(*) filter (where is_accurate)     as acc_n,
       count(*) filter (where not is_accurate) as inacc_n
from public.review_votes
group by review_id;

create view public.v_reviewer_rep as
select pr.id as user_id,
       count(r.id) filter (where not r.hidden and not r.sponsored)                    as review_count,
       count(r.id) filter (where not r.hidden and not r.sponsored and r.verified)     as verified_count,
       count(distinct r.place_id) filter (where not r.hidden and not r.sponsored)     as distinct_places,
       coalesce(sum(vs.acc_w)   filter (where not r.hidden and not r.sponsored), 0)   as acc_w,
       coalesce(sum(vs.inacc_w) filter (where not r.hidden and not r.sponsored), 0)   as inacc_w
from public.profiles pr
left join public.reviews r        on r.user_id = pr.id
left join public.v_review_votes vs on vs.review_id = r.id
group by pr.id;

-- Điểm uy tín: review xác thực + phiếu "đúng thực tế" từ người đã tới quán, trừ phiếu "chưa đúng".
-- Người chỉ review 1-2 quán bị nhân hệ số 0.3 (chống tài khoản chỉ để khen một nơi).
create view public.reviewer_stats as
select x.*, (1 + least(2, x.reputation / 25.0))::float8 as weight
from (
  select pr.id as user_id, pr.display_name, pr.avatar_url,
         rep.review_count, rep.verified_count, rep.distinct_places,
         rep.acc_w   as accurate_votes,
         rep.inacc_w as inaccurate_votes,
         (greatest(0, rep.verified_count * 2 + rep.review_count * 0.5 + rep.acc_w * 1.5 - rep.inacc_w * 2.5)
            * case when rep.distinct_places >= 3 then 1 else 0.3 end)::float8 as reputation
  from public.profiles pr
  join public.v_reviewer_rep rep on rep.user_id = pr.id
) x;

-- Trọng số của từng review khi tính điểm quán.
create view public.v_review_weights as
select r.id as review_id, r.place_id, r.user_id, r.created_at, r.verified,
       r.rating_overall::float8 as rating,
       (r.created_at - pr.created_at < interval '3 days') as from_new_account,
       ( rs.weight
         * case when r.verified then 1.0 else 0.5 end
         * case when r.created_at - pr.created_at < interval '3 days' then 0.5 else 1.0 end
         * greatest(0.3, least(1.5, 1 + (coalesce(vs.acc_w, 0) - coalesce(vs.inacc_w, 0)) * 0.1))
       )::float8 as weight
from public.reviews r
join public.profiles pr        on pr.id = r.user_id
join public.reviewer_stats rs  on rs.user_id = r.user_id
left join public.v_review_votes vs on vs.review_id = r.id
where not r.hidden and not r.sponsored;      -- review được mời/tài trợ không tính điểm

-- Điểm quán = trung bình có trọng số, kéo về mức trung bình khi quán còn ít review.
-- Độ hot = review/lưu trong 30 ngày; bị giảm mạnh nếu có dấu hiệu dồn review từ tài khoản mới.
create view public.place_stats as
with agg as (
  select w.place_id,
         count(*)                                   as review_count,
         count(*) filter (where w.verified)         as verified_count,
         sum(w.weight)                              as w_sum,
         sum(w.weight * w.rating)                   as wr_sum,
         count(*) filter (where w.verified     and w.created_at > now() - interval '30 days') as recent_verified,
         count(*) filter (where not w.verified and w.created_at > now() - interval '30 days') as recent_other,
         count(*) filter (where w.from_new_account and w.created_at > now() - interval '48 hours') as burst
  from public.v_review_weights w
  group by w.place_id
), sv as (
  select place_id, count(*) as recent_saves
  from public.saves
  where created_at > now() - interval '30 days'
  group by place_id
)
select p.id as place_id,
       coalesce(a.review_count, 0)    as review_count,
       coalesce(a.verified_count, 0)  as verified_count,
       case when coalesce(a.review_count, 0) = 0 then null
            else round(((coalesce(a.wr_sum, 0) + 3 * 3.8) / (coalesce(a.w_sum, 0) + 3))::numeric, 2) end as score,
       (coalesce(a.burst, 0) >= 5)    as suspicious,
       round((coalesce(a.recent_verified, 0) * 3 + coalesce(a.recent_other, 0) + coalesce(sv.recent_saves, 0) * 1.5)
             * case when coalesce(a.burst, 0) >= 5 then 0.2 else 1 end)::int as hot_score
from public.places p
left join agg a on a.place_id = p.id
left join sv    on sv.place_id = p.id;

create type public.place_card as (
  id uuid, name text, address text, district text, city text, province text, category text,
  lat double precision, lng double precision,
  score numeric, review_count bigint, verified_count bigint, hot_score integer,
  suspicious boolean, is_hot boolean
);

create view public.v_place_cards as
select p.id, p.name, p.address, p.district, p.city, p.province, p.category, p.lat, p.lng,
       s.score, s.review_count, s.verified_count, s.hot_score, s.suspicious,
       (s.hot_score >= public.cfg('hot_threshold') and not s.suspicious) as is_hot
from public.places p
join public.place_stats s on s.place_id = p.id;

-- ---------- Danh hiệu Sành ăn theo khu vực ---------------------------
create view public.v_review_region_pts as
select r.id as review_id, r.user_id, pl.province, pl.city, pl.district, r.verified,
       (case when r.verified then 2.0 else 0 end)
         + coalesce(vs.acc_w, 0) * 1.5 - coalesce(vs.inacc_w, 0) * 2.5 as pts
from public.reviews r
join public.places pl on pl.id = r.place_id
left join public.v_review_votes vs on vs.review_id = r.id
where not r.hidden and not r.sponsored;

create view public.v_user_region_scores as
select 'district'::text as level, concat_ws(', ', district, city, province) as area, user_id,
       count(*) filter (where verified) as verified_count, greatest(0, sum(pts)) as pts
from public.v_review_region_pts where district is not null
group by district, city, province, user_id
union all
select 'city'::text, concat_ws(', ', city, province), user_id,
       count(*) filter (where verified), greatest(0, sum(pts))
from public.v_review_region_pts where city is not null
group by city, province, user_id
union all
select 'province'::text, province, user_id,
       count(*) filter (where verified), greatest(0, sum(pts))
from public.v_review_region_pts where province is not null
group by province, user_id;

create view public.v_user_region_rank as
select level, area, user_id, verified_count, pts,
       rank() over (partition by level, area order by pts desc, verified_count desc) as rnk
from public.v_user_region_scores
where verified_count >= public.cfg('foodie_min_verified');

create view public.v_foodie_users as
select distinct user_id from public.v_user_region_rank
where rnk <= public.cfg('foodie_top_n');

-- =====================================================================
-- Bảo mật theo dòng (RLS)
-- =====================================================================
alter table public.app_config     enable row level security;
alter table public.profiles       enable row level security;
alter table public.places         enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_votes   enable row level security;
alter table public.review_reports enable row level security;
alter table public.saves          enable row level security;

create policy "config readable"   on public.app_config for select using (true);
create policy "profiles readable" on public.profiles   for select using (true);
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy "places readable"   on public.places for select using (true);
create policy "places insert own" on public.places for insert to authenticated
  with check (created_by = auth.uid());

create policy "reviews readable" on public.reviews for select
  using (not hidden or user_id = auth.uid());
create policy "reviews delete own" on public.reviews for delete to authenticated
  using (user_id = auth.uid());
-- Không có policy insert/update cho reviews: chỉ tạo qua hàm create_review (có kiểm tra vị trí, giới hạn).

create policy "votes read own" on public.review_votes for select to authenticated using (user_id = auth.uid());

create policy "saves read own"   on public.saves for select to authenticated using (user_id = auth.uid());
create policy "saves insert own" on public.saves for insert to authenticated with check (user_id = auth.uid());
create policy "saves delete own" on public.saves for delete to authenticated using (user_id = auth.uid());

-- Quyền bảng
revoke all on public.app_config, public.profiles, public.places, public.reviews,
              public.review_votes, public.review_reports, public.saves from anon, authenticated;
grant select on public.app_config, public.profiles, public.places, public.reviews to anon, authenticated;
grant insert on public.places to authenticated;
grant update (display_name, avatar_url, home_city) on public.profiles to authenticated;
grant delete on public.reviews to authenticated;
grant select on public.review_votes to authenticated;
grant select, insert, delete on public.saves to authenticated;

-- View công khai chỉ chứa số liệu tổng hợp; view nội bộ không mở cho app
revoke all on public.v_review_votes, public.v_reviewer_rep, public.v_review_weights,
              public.v_review_region_pts, public.v_user_region_scores, public.v_user_region_rank,
              public.v_foodie_users, public.v_place_cards from anon, authenticated;
grant select on public.reviewer_stats, public.place_stats to anon, authenticated;

-- =====================================================================
-- Hàm cho ứng dụng (RPC)
-- =====================================================================

-- Quán trong khung bản đồ
create or replace function public.places_in_bounds(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision,
  p_category text default null, p_only_hot boolean default false, p_limit int default 300
) returns setof public.place_card
language sql stable security definer set search_path = public as
$$
  select c.id, c.name, c.address, c.district, c.city, c.province, c.category, c.lat, c.lng,
         c.score, c.review_count, c.verified_count, c.hot_score, c.suspicious, c.is_hot
  from public.v_place_cards c
  where c.lat between p_min_lat and p_max_lat
    and c.lng between p_min_lng and p_max_lng
    and (p_category is null or c.category = p_category)
    and (not p_only_hot or c.is_hot)
  order by c.is_hot desc, c.score desc nulls last, c.review_count desc
  limit least(greatest(p_limit, 1), 500)
$$;

-- Tìm quán theo tên/địa chỉ (không cần gõ dấu)
create or replace function public.search_places(p_q text, p_limit int default 15)
returns setof public.place_card
language sql stable security definer set search_path = public as
$$
  select c.id, c.name, c.address, c.district, c.city, c.province, c.category, c.lat, c.lng,
         c.score, c.review_count, c.verified_count, c.hot_score, c.suspicious, c.is_hot
  from public.v_place_cards c
  join public.places p on p.id = c.id
  where char_length(trim(coalesce(p_q, ''))) >= 2
    and p.name_search like '%' ||
        replace(replace(replace(public.vn_unaccent(trim(p_q)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by c.is_hot desc, c.score desc nulls last
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.get_place(p_id uuid)
returns setof public.place_card
language sql stable security definer set search_path = public as
$$
  select c.id, c.name, c.address, c.district, c.city, c.province, c.category, c.lat, c.lng,
         c.score, c.review_count, c.verified_count, c.hot_score, c.suspicious, c.is_hot
  from public.v_place_cards c where c.id = p_id
$$;

-- Danh sách review của một quán: Sành ăn lên đầu, rồi theo độ đồng thuận
create or replace function public.place_reviews(p_place_id uuid)
returns table (
  id uuid, user_id uuid, display_name text, avatar_url text, is_foodie boolean,
  rating_taste smallint, rating_price smallint, rating_service smallint, rating_overall numeric,
  body text, tags text[], photo_urls text[], verified boolean, sponsored boolean,
  created_at timestamptz, accurate_count bigint, inaccurate_count bigint,
  my_vote boolean, is_mine boolean
)
language sql stable security definer set search_path = public as
$$
  select r.id, r.user_id, pr.display_name, pr.avatar_url,
         exists (select 1 from public.v_foodie_users f where f.user_id = r.user_id),
         r.rating_taste, r.rating_price, r.rating_service, r.rating_overall,
         r.body, r.tags, r.photo_urls, r.verified, r.sponsored, r.created_at,
         coalesce(vs.acc_n, 0), coalesce(vs.inacc_n, 0),
         (select v.is_accurate from public.review_votes v where v.review_id = r.id and v.user_id = auth.uid()),
         (r.user_id = auth.uid())
  from public.reviews r
  join public.profiles pr on pr.id = r.user_id
  left join public.v_review_votes vs on vs.review_id = r.id
  where r.place_id = p_place_id and (not r.hidden or r.user_id = auth.uid())
  order by 5 desc, (coalesce(vs.acc_n, 0) - coalesce(vs.inacc_n, 0)) desc, r.created_at desc
$$;

-- Tạo review: xác thực vị trí và giới hạn nằm ở máy chủ, không tin dữ liệu từ app
create or replace function public.create_review(
  p_place_id uuid, p_taste int, p_price int, p_service int,
  p_body text default null, p_tags text[] default '{}', p_photo_urls text[] default '{}',
  p_sponsored boolean default false,
  p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_uid      uuid := auth.uid();
  v_place    public.places%rowtype;
  v_dist     double precision;
  v_verified boolean := false;
  v_id       uuid;
  v_url      text;
  v_tag      text;
begin
  if v_uid is null then raise exception 'Cần đăng nhập để review'; end if;

  select * into v_place from public.places where id = p_place_id;
  if not found then raise exception 'Không tìm thấy quán'; end if;

  if exists (select 1 from public.reviews where user_id = v_uid and place_id = p_place_id) then
    raise exception 'Bạn đã review quán này rồi';
  end if;
  if (select count(*) from public.reviews where user_id = v_uid and created_at > now() - interval '1 day')
       >= public.cfg('daily_review_limit') then
    raise exception 'Hôm nay bạn đã review khá nhiều, mai quay lại nhé';
  end if;

  p_tags := coalesce(p_tags, '{}');
  p_photo_urls := coalesce(p_photo_urls, '{}');
  if cardinality(p_tags) > 8 then raise exception 'Tối đa 8 thẻ'; end if;
  foreach v_tag in array p_tags loop
    if char_length(v_tag) > 40 then raise exception 'Thẻ quá dài'; end if;
  end loop;
  if cardinality(p_photo_urls) > 6 then raise exception 'Tối đa 6 ảnh'; end if;
  foreach v_url in array p_photo_urls loop
    if position('/review-photos/' || v_uid::text || '/' in v_url) = 0 then
      raise exception 'Ảnh không hợp lệ';
    end if;
  end loop;

  if p_lat is not null and p_lng is not null then
    v_dist := public.distance_m(p_lat, p_lng, v_place.lat, v_place.lng);
    v_verified := v_dist <= public.cfg('checkin_radius_m')
                  and coalesce(p_accuracy, 1e9) <= public.cfg('checkin_max_accuracy_m');
  end if;

  insert into public.reviews (place_id, user_id, rating_taste, rating_price, rating_service,
                              body, tags, photo_urls, verified, checkin_distance_m, sponsored)
  values (p_place_id, v_uid, p_taste, p_price, p_service,
          nullif(trim(p_body), ''), p_tags, p_photo_urls, v_verified,
          case when v_dist is null then null else round(v_dist)::int end,
          coalesce(p_sponsored, false))
  returning id into v_id;

  return v_id;
end
$$;

-- Vote "Đúng thực tế" / "Chưa đúng" (null = bỏ vote). Phiếu của người đã tới quán nặng hơn.
create or replace function public.vote_review(p_review_id uuid, p_accurate boolean)
returns void
language plpgsql security definer set search_path = public as
$$
declare
  v_uid      uuid := auth.uid();
  v_review   public.reviews%rowtype;
  v_verified boolean;
begin
  if v_uid is null then raise exception 'Cần đăng nhập để vote'; end if;
  select * into v_review from public.reviews where id = p_review_id and not hidden;
  if not found then raise exception 'Không tìm thấy review'; end if;
  if v_review.user_id = v_uid then raise exception 'Không thể tự vote review của mình'; end if;

  if p_accurate is null then
    delete from public.review_votes where review_id = p_review_id and user_id = v_uid;
    return;
  end if;

  if (select count(*) from public.review_votes where user_id = v_uid and created_at > now() - interval '1 day')
       >= public.cfg('daily_vote_limit') then
    raise exception 'Hôm nay bạn đã vote khá nhiều, mai quay lại nhé';
  end if;

  v_verified := exists (select 1 from public.reviews r
                         where r.user_id = v_uid and r.place_id = v_review.place_id and r.verified);

  insert into public.review_votes (review_id, user_id, is_accurate, voter_verified)
  values (p_review_id, v_uid, p_accurate, v_verified)
  on conflict (review_id, user_id)
  do update set is_accurate = excluded.is_accurate, voter_verified = excluded.voter_verified;
end
$$;

-- Báo cáo sai sự thật: đủ 3 người đã tới quán báo cáo thì review tạm ẩn chờ quản trị duyệt
create or replace function public.report_review(p_review_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as
$$
declare
  v_uid    uuid := auth.uid();
  v_review public.reviews%rowtype;
begin
  if v_uid is null then raise exception 'Cần đăng nhập để báo cáo'; end if;
  select * into v_review from public.reviews where id = p_review_id;
  if not found then raise exception 'Không tìm thấy review'; end if;
  if v_review.user_id = v_uid then raise exception 'Không thể tự báo cáo review của mình'; end if;

  insert into public.review_reports (review_id, user_id, reason)
  values (p_review_id, v_uid, left(p_reason, 500))
  on conflict (review_id, user_id) do nothing;

  if (select count(*) from public.review_reports rr
       where rr.review_id = p_review_id
         and exists (select 1 from public.reviews r2
                      where r2.user_id = rr.user_id and r2.place_id = v_review.place_id and r2.verified)) >= 3 then
    update public.reviews set hidden = true where id = p_review_id;
  end if;
end
$$;

-- Khu vực có dữ liệu (để chọn bảng xếp hạng)
create or replace function public.list_areas()
returns table (level text, area text, place_count bigint)
language sql stable security definer set search_path = public as
$$
  select 'district'::text, concat_ws(', ', district, city, province), count(*)
    from public.places where district is not null group by district, city, province
  union all
  select 'city'::text, concat_ws(', ', city, province), count(*)
    from public.places where city is not null group by city, province
  union all
  select 'province'::text, province, count(*)
    from public.places where province is not null group by province
  order by 3 desc
$$;

create or replace function public.leaderboard_places(p_level text, p_area text, p_limit int default 20)
returns setof public.place_card
language sql stable security definer set search_path = public as
$$
  select c.id, c.name, c.address, c.district, c.city, c.province, c.category, c.lat, c.lng,
         c.score, c.review_count, c.verified_count, c.hot_score, c.suspicious, c.is_hot
  from public.v_place_cards c
  where c.verified_count >= public.cfg('place_rank_min_reviews')
    and c.score is not null
    and case p_level
          when 'district' then c.district is not null and concat_ws(', ', c.district, c.city, c.province) = p_area
          when 'city'     then c.city     is not null and concat_ws(', ', c.city, c.province) = p_area
          else c.province = p_area
        end
  order by c.score desc, c.verified_count desc
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.leaderboard_reviewers(p_level text, p_area text, p_limit int default 20)
returns table (rank bigint, user_id uuid, display_name text, avatar_url text,
               verified_count bigint, pts numeric, is_foodie boolean)
language sql stable security definer set search_path = public as
$$
  select k.rnk, k.user_id, pr.display_name, pr.avatar_url, k.verified_count, round(k.pts::numeric, 1),
         (k.rnk <= public.cfg('foodie_top_n'))
  from public.v_user_region_rank k
  join public.profiles pr on pr.id = k.user_id
  where k.level = p_level and k.area = p_area
  order by k.rnk, pr.display_name
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.user_badges(p_user uuid)
returns table (level text, area text, rank bigint)
language sql stable security definer set search_path = public as
$$
  select k.level, k.area, k.rnk
  from public.v_user_region_rank k
  where k.user_id = p_user and k.rnk <= public.cfg('foodie_top_n')
  order by case k.level when 'district' then 1 when 'city' then 2 else 3 end, k.area
$$;

-- Quyền gọi hàm
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.cfg(text), public.distance_m(double precision, double precision, double precision, double precision),
  public.vn_unaccent(text),
  public.places_in_bounds(double precision, double precision, double precision, double precision, text, boolean, int),
  public.search_places(text, int), public.get_place(uuid), public.place_reviews(uuid),
  public.list_areas(), public.leaderboard_places(text, text, int), public.leaderboard_reviewers(text, text, int),
  public.user_badges(uuid)
  to anon, authenticated;
grant execute on function
  public.create_review(uuid, int, int, int, text, text[], text[], boolean, double precision, double precision, double precision),
  public.vote_review(uuid, boolean), public.report_review(uuid, text)
  to authenticated;

-- =====================================================================
-- Kho ảnh review (công khai để xem, chỉ chủ ảnh được tải lên vào thư mục của mình)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "review photos are public" on storage.objects
  for select using (bucket_id = 'review-photos');

create policy "users upload own review photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own review photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
