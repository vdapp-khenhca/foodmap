-- Siết bảo mật theo gợi ý của Supabase Advisors (đã áp dụng trên project).
alter function public.distance_m(double precision, double precision, double precision, double precision) set search_path = '';
alter function public.vn_unaccent(text) set search_path = '';

-- App không đọc trực tiếp hai view tổng hợp nữa; dùng hàm RPC thay thế.
revoke select on public.place_stats, public.reviewer_stats from anon, authenticated;

create or replace function public.my_stats()
returns setof public.reviewer_stats
language sql stable security definer set search_path = public as
$$ select * from public.reviewer_stats where user_id = auth.uid() $$;

revoke execute on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;
