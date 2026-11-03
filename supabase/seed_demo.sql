-- Dữ liệu demo cho FoodMap (quán, người review, review, vote). Tất cả đều gắn cờ is_demo.
-- Xóa sạch dữ liệu demo bằng:
--   delete from public.places where is_demo;
--   delete from auth.users where email like '%@demo.foodmap.local';

-- 1) Người dùng demo (không đăng nhập được)
insert into auth.users (id, email)
select ('00000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'demo' || i || '@demo.foodmap.local'
from generate_series(1, 10) i
on conflict (id) do nothing;

update public.profiles p
set display_name = v.n, is_demo = true, created_at = now() - interval '200 days'
from (values
  (1, 'Minh Ăn Ngon'), (2, 'Lan Phạm'), (3, 'Hùng Đói Bụng'), (4, 'Thảo Foodie'), (5, 'Quốc Bảo'),
  (6, 'Mai Trà Sữa'), (7, 'Đức Kiên'), (8, 'Ngọc Anh'), (9, 'Việt Hoàng'), (10, 'Phương Thúy')
) v(i, n)
where p.id = ('00000000-0000-4000-8000-0000000000' || lpad(v.i::text, 2, '0'))::uuid;

-- 2) Quán demo (tên và địa chỉ là hư cấu)
create temp table demo_places (
  name text, address text, district text, city text, province text, category text,
  lat double precision, lng double precision, base numeric
);
insert into demo_places values
  ('Phở Bò Gánh Hẻm 12',        'Hẻm 12 Lê Thị Hồng Gấm',  'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'pho',       10.77690, 106.70090, 4.6),
  ('Bún Chả Cô Tư',             '27 Tôn Thất Đạm',         'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi',    10.77540, 106.70330, 4.3),
  ('Cơm Tấm Sườn Bì Chả 88',    '88 Nguyễn Thị Minh Khai', 'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'com',       10.78010, 106.69940, 4.1),
  ('Cà Phê Muối Hẻm Xanh',      '5 Hẻm 20 Lý Tự Trọng',    'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'ca_phe',    10.77850, 106.70410, 4.4),
  ('Trà Sữa Mây Chiều',         '14 Nguyễn Thái Bình',     'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'tra_sua',   10.77290, 106.69880, 3.7),
  ('Lẩu Nướng Đêm Sài Gòn',     '62 Bùi Viện',             'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'lau_nuong', 10.77630, 106.69560, 4.0),
  ('Bánh Mì Xíu Mại Bà Năm',    '9 Cống Quỳnh',            'Quận 1',  'Hồ Chí Minh', 'Hồ Chí Minh', 'an_vat',    10.77470, 106.69780, 4.5),
  ('Ốc Mười Quán Nhậu',         '31 Hoàng Diệu',           'Quận 4',  'Hồ Chí Minh', 'Hồ Chí Minh', 'quan_nhau', 10.76150, 106.70500, 3.5),
  ('Bún Bò Huế Mệ Ơi',          '45 Trần Quốc Thảo',       'Quận 3',  'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi',    10.78350, 106.68710, 4.7),
  ('Hủ Tiếu Nam Vang Cô Hoa',   '120 Nam Kỳ Khởi Nghĩa',   'Quận 3',  'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi',    10.78020, 106.68230, 4.2),
  ('Cà Phê Sân Vườn Nắng',      '33 Võ Văn Tần',           'Quận 3',  'Hồ Chí Minh', 'Hồ Chí Minh', 'ca_phe',    10.78560, 106.69050, 4.0),
  ('Chè Ba Miền',               '8 Lý Chính Thắng',        'Quận 3',  'Hồ Chí Minh', 'Hồ Chí Minh', 'an_vat',    10.78120, 106.68620, 3.9),
  ('Mì Quảng Bếp Mẹ',           '77 Phan Xích Long',       'Quận Phú Nhuận', 'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi', 10.79960, 106.68010, 4.4),
  ('Bò Né Chảo Gang',           '19 Hoàng Văn Thụ',        'Quận Phú Nhuận', 'Hồ Chí Minh', 'Hồ Chí Minh', 'com',    10.80190, 106.67740, 3.6),
  ('Ốc Tối Bình Thạnh',         '210 Điện Biên Phủ',       'Quận Bình Thạnh', 'Hồ Chí Minh', 'Hồ Chí Minh', 'quan_nhau', 10.80420, 106.71190, 4.1),
  ('Phở Gà Cô Ba',              '56 Xô Viết Nghệ Tĩnh',    'Quận Bình Thạnh', 'Hồ Chí Minh', 'Hồ Chí Minh', 'pho',   10.80910, 106.70770, 4.3),
  ('Há Cảo Sủi Cảo Hoa Lầu',    '30 Trần Hưng Đạo B',      'Quận 5',  'Hồ Chí Minh', 'Hồ Chí Minh', 'an_vat',    10.75480, 106.66300, 4.5),
  ('Vịt Quay Phố Chợ',          '104 Nguyễn Trãi',         'Quận 5',  'Hồ Chí Minh', 'Hồ Chí Minh', 'com',       10.75290, 106.66660, 3.8),
  ('Bánh Canh Cua Cô Mai',      '15 Sư Vạn Hạnh',          'Quận 10', 'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi',    10.77310, 106.66680, 4.2),
  ('Gỏi Cuốn Chú Bảy',          '48 Thành Thái',           'Quận 10', 'Hồ Chí Minh', 'Hồ Chí Minh', 'an_vat',    10.76860, 106.67140, 3.4),
  ('Phở Cuốn Chị Dung',         '25 Hàng Bạc',             'Quận Hoàn Kiếm',  'Hà Nội', 'Hà Nội', 'pho',        21.03010, 105.85250, 4.5),
  ('Bún Chả Quán Cây Si',       'Ngõ 3 Hàng Quạt',         'Quận Hoàn Kiếm',  'Hà Nội', 'Hà Nội', 'bun_mi',     21.02860, 105.85680, 4.6),
  ('Chả Cá Anh Khoa',           '17 Hàng Than',            'Quận Ba Đình',    'Hà Nội', 'Hà Nội', 'com',        21.03470, 105.82070, 4.2),
  ('Bún Đậu Ngõ Hoa Sữa',       '9 Ngõ 12 Tây Sơn',        'Quận Đống Đa',    'Hà Nội', 'Hà Nội', 'bun_mi',     21.01920, 105.82810, 4.0),
  ('Cà Phê Trứng Hẻm Cũ',       '4 Hẻm Cũ Nhà Chung',      'Quận Hoàn Kiếm',  'Hà Nội', 'Hà Nội', 'ca_phe',     21.02870, 105.85140, 4.4),
  ('Bánh Cuốn Cô Hạnh',         '66 Phố Huế',              'Quận Hai Bà Trưng', 'Hà Nội', 'Hà Nội', 'an_vat',   21.00520, 105.85710, 4.3),
  ('Nem Rán Bà Thìn',           '32 Chùa Bộc',             'Quận Đống Đa',    'Hà Nội', 'Hà Nội', 'an_vat',     21.01770, 105.83020, 3.8),
  ('Xôi Ngô Cô Yến',            '10 Ngõ 31 Đội Cấn',       'Quận Ba Đình',    'Hà Nội', 'Hà Nội', 'an_vat',     21.03400, 105.81900, 3.6);

insert into public.places (name, address, district, city, province, category, lat, lng, is_demo, created_at)
select name, address, district, city, province, category, lat, lng, true, now() - interval '150 days'
from demo_places;

-- 3) Review demo: người dùng 1-4 là người review tích cực (nhiều review xác thực), 5-8 vừa, 9-10 ít
insert into public.reviews (place_id, user_id, rating_taste, rating_price, rating_service, body, tags, photo_urls, verified, checkin_distance_m, sponsored, created_at)
select
  g.pid, g.uid,
  g.taste, g.price, g.service,
  case
    when g.sponsored then 'Được quán mời thử món mới, mình chia sẻ cảm nhận thật nhất có thể.'
    else (case g.sent
      when 'pos' then (array[
        'Nước dùng đậm đà, món ra nhanh, nhân viên nhiệt tình. Sẽ quay lại thường xuyên.',
        'Ngon hơn mình nghĩ, phần ăn đầy đặn mà giá vẫn dễ chịu.',
        'Quán sạch, ngồi thoải mái. Món nào cũng vừa miệng, nhất là món đặc trưng của quán.',
        'Đi lần đầu đã muốn quay lại. Hương vị rất tròn, không bị gắt hay quá mặn.',
        'Đông khách nhưng phục vụ vẫn nhanh. Mình hay rủ bạn bè ghé.',
        'Ăn một lần là nhớ. Đáng để thử nếu bạn đang ở gần.'])[1 + (g.h / 23) % 6]
      when 'mid' then (array[
        'Món ổn, không có gì để chê nhưng cũng chưa quá nổi bật.',
        'Ăn được, giá hơi cao so với khu vực. Giờ cao điểm phải chờ khá lâu.',
        'Hương vị ổn, không gian hơi chật. Phù hợp ăn nhanh.',
        'Có món ngon có món bình thường, nên gọi đúng món được nhắc nhiều.',
        'Phục vụ nhanh nhưng món hôm đó hơi nhạt so với lần trước.',
        'Tạm được. Mình sẽ thử thêm một lần nữa trước khi kết luận.'])[1 + (g.h / 23) % 6]
      else (array[
        'Hơi thất vọng, món nhạt và phải chờ lâu. Có lẽ hôm đó không may.',
        'Giá không tương xứng với chất lượng. Không gian cũng chưa sạch lắm.',
        'Không đúng như mong đợi, phần ăn ít và phục vụ hơi chậm.',
        'Đi theo lời giới thiệu nhưng thực tế khác khá nhiều. Chưa muốn quay lại.',
        'Món ăn tạm được nhưng quán đông và ồn, ngồi không thoải mái.',
        'Mình ăn xong thấy bình thường, chưa thấy điểm gì đặc biệt.'])[1 + (g.h / 23) % 6]
    end)
  end,
  case g.sent
    when 'pos' then array[
      (array['Đáng quay lại','Giá hợp lý','Phục vụ nhanh','Sạch sẽ','Không gian đẹp'])[1 + (g.h / 41) % 5],
      (array['Đáng quay lại','Giá hợp lý','Phục vụ nhanh','Sạch sẽ','Không gian đẹp'])[1 + ((g.h / 41) % 5 + 1 + (g.h / 43) % 4) % 5]]
    when 'mid' then array[(array['Đông, phải chờ','Hơi đắt'])[1 + (g.h / 41) % 2]]
    else array[(array['Hơi đắt','Không đúng như quảng cáo'])[1 + (g.h / 41) % 2]]
  end,
  '{}'::text[],
  g.verified,
  case when g.verified then (g.h / 37) % 120 else null end,
  g.sponsored,
  now() - (((g.h / 29) % 70) || ' days')::interval - (((g.h / 31) % 24) || ' hours')::interval
from (
  select x.*,
         (case when ((x.rating_avg)) >= 4.5 then 'pos' when x.rating_avg >= 3.5 then 'mid' else 'neg' end) as sent
  from (
    select y.*,
           least(5, greatest(1, round(y.base + ((y.h / 3) % 5 - 2) * 0.5)))::int as taste,
           least(5, greatest(1, round(y.base - 0.3 + ((y.h / 11) % 5 - 2) * 0.5)))::int as price,
           least(5, greatest(1, round(y.base - 0.1 + ((y.h / 17) % 5 - 2) * 0.5)))::int as service,
           (y.base + ((y.h / 3) % 5 - 2) * 0.25) as rating_avg,
           ((y.h / 13) % 100) < (case when y.ui <= 4 then 90 when y.ui <= 8 then 60 else 25 end) as verified,
           (y.ui = 10 and ((y.h / 19) % 100) < 40) as sponsored
    from (
      select u.id as uid, u.ui, p.id as pid, p.city, b.base,
             abs(hashtext(u.id::text || p.id::text)) as h
      from (select id, row_number() over (order by id) as ui from public.profiles where is_demo) u
      cross join public.places p
      join demo_places b on b.name = p.name
      where p.is_demo
        and ((p.city = 'Hồ Chí Minh' and u.ui between 1 and 8) or (p.city = 'Hà Nội' and u.ui in (3, 4, 7, 8, 9, 10)))
    ) y
    where (y.h % 100) < (case when y.ui <= 4 then 85 when y.ui <= 8 then 55 else 35 end)
  ) x
) g;

-- 4) Vote "Đúng thực tế" / "Chưa đúng" giữa các người dùng demo
insert into public.review_votes (review_id, user_id, is_accurate, voter_verified, created_at)
select r.id, v.id,
       case when r.sponsored then (abs(hashtext(r.id::text || v.id::text)) % 10) < 2
            else (abs(hashtext(r.id::text || v.id::text)) % 10) < 8 end,
       exists (select 1 from public.reviews r2 where r2.user_id = v.id and r2.place_id = r.place_id and r2.verified),
       least(now(), r.created_at + interval '1 day')
from public.reviews r
join public.profiles pr on pr.id = r.user_id and pr.is_demo
join public.profiles v on v.is_demo and v.id <> r.user_id
where abs(hashtext('v' || r.id::text || v.id::text)) % 100 < 38
on conflict do nothing;

drop table demo_places;
