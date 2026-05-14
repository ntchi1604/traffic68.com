import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowRight, ShieldOff, CheckCircle2 } from 'lucide-react';
import { useToast } from '../components/Toast';
import useHCaptcha from '../hooks/useHCaptcha';

export default function AgencyDangNhap({ config }) {
  usePageTitle(`Đăng nhập - ${config?.name || 'Hệ thống'}`);
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const isBanned = searchParams.get('banned') === '1';
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ login: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { captchaRef, token: captchaToken, resetCaptcha } = useHCaptcha();

  const brandColor = config?.primary_color || '#3B82F6';

  useEffect(() => {
    if (localStorage.getItem('token')) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        navigate('/buyer/dashboard');
      } catch {
        navigate('/buyer/dashboard');
      }
    }
  }, [navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      setError('Vui lòng xác nhận captcha trước khi đăng nhập.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.login,
          password: form.password,
          remember,
          captchaToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
        resetCaptcha();
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success(`Chào mừng ${data.user.name || 'bạn'}!`, 'Đăng nhập thành công');
      navigate('/buyer/dashboard');
    } catch (err) {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative"
        style={{ backgroundColor: brandColor }}
      >
        <div className="absolute inset-0 bg-black/20 rounded-none" />
        <div className="relative z-10 text-center max-w-md">
          <h2 className="text-3xl font-black text-white mb-4 uppercase leading-tight">
            Chào mừng đến với<br /><span className="text-white opacity-90">{config?.name || 'Hệ thống'}</span>
          </h2>
          <p className="text-white/80 text-base mb-10 leading-relaxed">
            Hệ thống quản lý dịch vụ và khách hàng chuyên nghiệp.
          </p>
          <ul className="space-y-3 text-left">
            <li className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              Đăng nhập để xem báo cáo chi tiết
            </li>
            <li className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              Quản lý tài khoản dễ dàng
            </li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-6">
              {config?.logo_url ? (
                <img src={config.logo_url} alt={config.name} className="h-16 w-auto mx-auto object-contain" />
              ) : (
                <div className="text-3xl font-black" style={{ color: brandColor }}>{config?.name || 'Hệ thống'}</div>
              )}
            </Link>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Đăng nhập</h1>
            <p className="text-gray-500 text-sm">Truy cập vào bảng điều khiển của bạn</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {isBanned && (
              <div className="mb-4 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700">
                <ShieldOff size={18} className="shrink-0" />
                <div>
                  <p className="font-bold text-sm">Tài khoản bị tạm ngưng</p>
                  <p className="text-xs text-red-500 mt-0.5">Tài khoản của bạn đã bị admin tạm ngưng.</p>
                </div>
              </div>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email hoặc Username</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type="text" name="login" value={form.login} onChange={handleChange} placeholder="email@example.com hoặc username" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600">Mật khẩu</label>
                  <button type="button" className="text-xs font-semibold" style={{ color: brandColor }}>Quên mật khẩu?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type={show ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="••••••••" className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                  style={{ accentColor: brandColor }}
                />
                <label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                  Ghi nhớ đăng nhập
                </label>
              </div>

              {/* hCaptcha */}
              <div className="flex justify-center">
                <div ref={captchaRef}></div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2.5 text-sm disabled:opacity-70 transition-all hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang đăng nhập...</span>
                ) : (
                  <><span>ĐĂNG NHẬP</span> <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Chưa có tài khoản?{' '}
                <Link to="/dang-ky" className="font-bold hover:underline" style={{ color: brandColor }}>Đăng ký ngay</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
