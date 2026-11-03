-- Cờ is_demo cho quán và hồ sơ, hiển thị trong thẻ quán (đã áp dụng trên project).
alter table public.places add column if not exists is_demo boolean not null default false;
alter table public.profiles add column if not exists is_demo boolean not null default false;
-- Các view/hàm trả về place_card được cập nhật để có thêm cột is_demo (xem lịch sử migration trên Supabase).
