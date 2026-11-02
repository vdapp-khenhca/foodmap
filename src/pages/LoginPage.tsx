import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

function viError(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu';
  if (/Email not confirmed/i.test(msg)) return 'Email chưa được xác nhận, hãy kiểm tra hộp thư của bạn';
  if (/already registered/i.test(msg)) return 'Email này đã được đăng ký, hãy đăng nhập';
  if (/at least \d+ characters/i.test(msg)) return 'Mật khẩu cần ít nhất 6 ký tự';
  if (/rate limit|too many/i.test(msg)) return 'Bạn thao tác hơi nhiều, thử lại sau ít phút';
  if (/valid email|invalid format/i.test(msg)) return 'Email chưa đúng định dạng';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Mất kết nối mạng, thử lại nhé';
  return msg;
}

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from || '/';
  const { user } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (user) nav(from, { replace: true });
  }, [user, from, nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setInfo('Đã gửi email xác nhận. Mở email và bấm vào liên kết để hoàn tất đăng ký.');
      }
    } catch (err) {
      setError(viError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email.trim()) {
      setError('Nhập email của bạn trước nhé');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, data: name.trim() ? { display_name: name.trim() } : undefined },
    });
    setBusy(false);
    if (error) setError(viError(error.message));
    else setInfo('Đã gửi liên kết đăng nhập vào email của bạn.');
  }

  return (
    <div className="auth-wrap" style={{ overflowY: 'auto' }}>
      <div className="card auth-card">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại" style={{ marginBottom: 12 }}>
          <ArrowLeft size={20} />
        </button>
        <img src="/icons/icon.svg" alt="" className="logo" />
        <h1 className="page-title">{mode === 'in' ? 'Chào mừng quay lại' : 'Tạo tài khoản'}</h1>
        <p className="page-sub">Đăng nhập để review, lưu quán và nhận danh hiệu Sành ăn.</p>

        {error && <div className="error">{error}</div>}
        {info && <div className="ok-note">{info}</div>}

        <form onSubmit={submit}>
          {mode === 'up' && (
            <label className="field">
              <span>Tên hiển thị</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Minh Ăn Ngon" minLength={2} maxLength={40} required />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" required />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="Ít nhất 6 ký tự"
              required
            />
          </label>
          <button className="btn block" disabled={busy}>
            {busy ? 'Đang xử lý…' : mode === 'in' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={magicLink} disabled={busy}>
          Gửi liên kết đăng nhập qua email
        </button>
        <p className="center muted" style={{ marginTop: 16 }}>
          {mode === 'in' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button className="link-btn" style={{ fontSize: 14, color: 'var(--brand)' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null); }}>
            {mode === 'in' ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}
