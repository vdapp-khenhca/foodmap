import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { LogoMark } from '../components/ui';

function viError(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu';
  if (/Email not confirmed/i.test(msg)) return 'Email chưa được xác nhận. Hãy dùng đăng nhập bằng mã gửi qua email.';
  if (/already registered/i.test(msg)) return 'Email này đã được đăng ký, hãy đăng nhập';
  if (/at least \d+ characters/i.test(msg)) return 'Mật khẩu cần ít nhất 6 ký tự';
  if (/rate limit|too many|seconds/i.test(msg)) return 'Bạn thao tác hơi nhanh, đợi một chút rồi thử lại';
  if (/valid email|invalid format/i.test(msg)) return 'Email chưa đúng định dạng';
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'Mã không đúng hoặc đã hết hạn. Hãy gửi mã mới.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Mất kết nối mạng, thử lại nhé';
  return msg;
}

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from || '/';
  const { user } = useAuth();
  const [method, setMethod] = useState<'code' | 'password'>('code');
  const [mode, setMode] = useState<'in' | 'up'>('in'); // chỉ dùng cho mật khẩu
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) nav(from, { replace: true });
  }, [user, from, nav]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) {
      setError('Nhập email của bạn trước nhé');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { data: name.trim() ? { display_name: name.trim() } : undefined, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      setError(viError(error.message));
      return;
    }
    setStep('code');
    setCode('');
    setCooldown(45);
    setInfo(`Đã gửi mã tới ${email.trim()}. Mã có hiệu lực trong vài phút.`);
  }

  async function verify(token: string) {
    if (token.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setBusy(false);
    if (error) setError(viError(error.message));
  }

  async function submitPassword(e: FormEvent) {
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
        if (!data.session) setInfo('Đã gửi email xác nhận. Mở email và nhập mã hoặc bấm liên kết để hoàn tất đăng ký.');
      }
    } catch (err) {
      setError(viError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Quay lại" style={{ marginBottom: 14 }}>
          <ArrowLeft size={20} />
        </button>
        <LogoMark />
        <h1 className="page-title" style={{ marginTop: 14 }}>
          {method === 'code' ? (step === 'email' ? 'Đăng nhập hoặc đăng ký' : 'Nhập mã trong email') : mode === 'in' ? 'Đăng nhập bằng mật khẩu' : 'Tạo tài khoản'}
        </h1>
        <p className="page-sub">
          {method === 'code' && step === 'email' && 'Không cần nhớ mật khẩu. Mình gửi một mã gồm 6 số tới email của bạn.'}
          {method === 'code' && step === 'code' && 'Mở email từ FoodMap, nhập mã vào ô dưới đây.'}
          {method === 'password' && 'Đăng nhập để review, lưu quán và nhận danh hiệu Sành ăn.'}
        </p>

        {error && <div className="error">{error}</div>}
        {info && <div className="ok-note">{info}</div>}

        {method === 'code' && step === 'email' && (
          <form onSubmit={sendCode}>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" required />
            </label>
            <label className="field">
              <span>Tên hiển thị (nếu đây là lần đầu)</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Minh Ăn Ngon" maxLength={40} />
            </label>
            <button className="btn block" disabled={busy}>
              <Mail size={18} /> {busy ? 'Đang gửi…' : 'Gửi mã đăng nhập'}
            </button>
          </form>
        )}

        {method === 'code' && step === 'code' && (
          <>
            <input
              className="input otp-input"
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              aria-label="Mã đăng nhập"
              placeholder="••••••"
              autoFocus
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setCode(v);
                if (v.length === 6) verify(v);
              }}
            />
            <button className="btn block" style={{ marginTop: 12 }} onClick={() => verify(code)} disabled={busy || code.length < 6}>
              {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
            </button>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="link-btn" onClick={() => { setStep('email'); setError(null); setInfo(null); }}>
                Đổi email
              </button>
              <span className="spacer" />
              <button className="link-btn" onClick={() => sendCode()} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Gửi lại mã sau ${cooldown} giây` : 'Gửi lại mã'}
              </button>
            </div>
          </>
        )}

        {method === 'password' && (
          <form onSubmit={submitPassword}>
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
            <p className="center muted" style={{ marginTop: 14 }}>
              {mode === 'in' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <button type="button" className="link-btn" style={{ fontSize: 14, color: 'var(--cobalt)' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null); }}>
                {mode === 'in' ? 'Đăng ký' : 'Đăng nhập'}
              </button>
            </p>
          </form>
        )}

        <hr style={{ border: 0, borderTop: '1.5px solid var(--line)', margin: '20px 0 14px' }} />
        <button
          className="btn ghost block"
          onClick={() => {
            setMethod(method === 'code' ? 'password' : 'code');
            setStep('email');
            setError(null);
            setInfo(null);
          }}
        >
          {method === 'code' ? (
            <>
              <KeyRound size={17} /> Dùng mật khẩu
            </>
          ) : (
            <>
              <Mail size={17} /> Đăng nhập bằng mã qua email
            </>
          )}
        </button>
      </div>
    </div>
  );
}
