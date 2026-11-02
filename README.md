# FoodMap – bản đồ ẩm thực review thật (bản thử nghiệm)

Webapp (PWA) React + Vite + Supabase + MapLibre/OpenStreetMap.

## Chạy
1. Tạo project Supabase, chạy `supabase/migrations/0001_init.sql` trong SQL Editor (tuỳ chọn: `supabase/seed.sql` để có quán mẫu).
2. Copy `.env.example` thành `.env`, điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`

## Deploy
Đẩy lên GitHub, import vào Vercel, thêm hai biến môi trường trên. `vercel.json` đã cấu hình định tuyến SPA.

## Điểm chính
- Review chỉ tạo qua hàm `create_review` ở máy chủ: kiểm tra khoảng cách GPS (≤150 m), giới hạn số review/ngày, ảnh phải nằm trong thư mục của chính người dùng.
- Điểm quán = trung bình có trọng số theo uy tín người chấm; review tài trợ không tính điểm; tài khoản mới và đợt dồn review bị giảm trọng số.
- Danh hiệu Sành ăn tính theo quận/huyện, thành phố, tỉnh; ngưỡng chỉnh trong bảng `app_config` mà không cần deploy lại.
