-- Quán mẫu để thử giao diện (tuỳ chọn). Tên có tiền tố [Mẫu]; xóa bằng: delete from public.places where name like '[Mẫu]%';
insert into public.places (name, address, district, city, province, category, lat, lng) values
  ('[Mẫu] Phở góc phố',     '1 Lê Lợi',        'Quận 1', 'Hồ Chí Minh', 'Hồ Chí Minh', 'pho',       10.77690, 106.70090),
  ('[Mẫu] Bún chả vỉa hè',  '2 Nguyễn Huệ',    'Quận 1', 'Hồ Chí Minh', 'Hồ Chí Minh', 'bun_mi',    10.77520, 106.70310),
  ('[Mẫu] Cơm tấm đêm',     '3 Hai Bà Trưng',  'Quận 1', 'Hồ Chí Minh', 'Hồ Chí Minh', 'com',       10.78010, 106.69950),
  ('[Mẫu] Cà phê sân vườn', '4 Võ Văn Tần',    'Quận 3', 'Hồ Chí Minh', 'Hồ Chí Minh', 'ca_phe',    10.77890, 106.69020),
  ('[Mẫu] Lẩu nướng 2 tầng','5 Điện Biên Phủ', 'Quận 3', 'Hồ Chí Minh', 'Hồ Chí Minh', 'lau_nuong', 10.78120, 106.69530);
