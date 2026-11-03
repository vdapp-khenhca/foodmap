export default function SetupPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card stack">
        <img src="/icons/icon.svg" alt="" className="logo-mark" />
        <h1 className="page-title">Cần kết nối Supabase</h1>
        <p className="muted">
          Ứng dụng chưa có thông tin kết nối cơ sở dữ liệu. Thêm hai biến môi trường sau (trên Vercel: Settings → Environment Variables) rồi deploy lại:
        </p>
        <pre style={{ background: '#fff6ee', padding: 12, borderRadius: 12, overflowX: 'auto', fontSize: 13 }}>
{`VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY`}
        </pre>
        <p className="muted">
          Lấy ở Supabase: Project Settings → API (Project URL và anon public key). Sau đó chạy file <code>supabase/migrations/0001_init.sql</code> trong SQL Editor.
        </p>
      </div>
    </div>
  );
}
