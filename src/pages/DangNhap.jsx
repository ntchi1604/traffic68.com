import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Rocket, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useToast } from '../components/Toast';
import useHCaptcha from '../hooks/useHCaptcha';

export default function DangNhap() {
  usePageTitle('Đăng nhập');
  const navigate = useNavigate();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ login: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { captchaRef, token: captchaToken, resetCaptcha } = useHCaptcha();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        if (u.role === 'admin') navigate('/admin');
        else navigate(u.service_type === 'shortlink' ? '/worker/dashboard' : '/buyer/dashboard');
      } catch {
        navigate('/buyer/dashboard');
      }
    }
  }, []);

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
      if (data.user.role === 'admin') navigate('/admin');
      else navigate(data.user.service_type === 'shortlink' ? '/worker/dashboard' : '/buyer/dashboard');
    } catch (err) {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    'Dashboard quản lý traffic real-time',
    'Báo cáo chi tiết 24/7',
    'Quản lý đa chiến dịch cùng lúc',
    'Hỗ trợ chuyên gia ưu tiên',
  ];

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-50 flex">
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative"
        style={{ backgroundImage: 'url(/login_hero_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-[#0f172a]/60 rounded-none" />
        <div className="relative z-10 text-center max-w-md">
          <h2 className="text-3xl font-black text-white mb-4 uppercase leading-tight">
            Quản Lý Traffic<br /><span className="text-[#f97316]">Thông Minh</span>
          </h2>
          <p className="text-white/70 text-base mb-10 leading-relaxed">
            Theo dõi và tối ưu hóa toàn bộ chiến dịch traffic của bạn trong một dashboard duy nhất.
          </p>
          <ul className="space-y-3 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-12 grid grid-cols-3 gap-3">
            {[{ v: '10K+', l: 'Khách hàng' }, { v: '99%', l: 'Thành công' }, { v: '24/7', l: 'Hỗ trợ' }].map(({ v, l }) => (
              <div key={l} className="bg-white/8 border border-white/15 rounded-xl p-3 text-center">
                <p className="text-xl font-black text-[#f97316]">{v}</p>
                <p className="text-[11px] text-white/55">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-6">
              <img src="/traffic68_com.gif" alt="traffic68.com" className="h-14 w-auto mx-auto" />
            </Link>
            <h1 className="text-2xl font-black text-[#1e3a8a] mb-1">Chào mừng trở lại!</h1>
            <p className="text-gray-500 text-sm">Đăng nhập để quản lý chiến dịch traffic của bạn</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
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
                  <input required type="text" name="login" value={form.login} onChange={handleChange} placeholder="email@example.com hoặc username" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-600">Mật khẩu</label>
                  <button type="button" className="text-xs text-[#f97316] hover:underline font-semibold">Quên mật khẩu?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type={show ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="••••••••" className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition" />
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
                  className="w-4 h-4 rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a] cursor-pointer"
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
                className="w-full gradient-btn text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2.5 text-sm disabled:opacity-70 transition-all"
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
                <Link to="/dang-ky" className="text-[#f97316] font-bold hover:underline">Đăng ký miễn phí</Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Bằng cách đăng nhập, bạn đồng ý với{' '}
            <a href="#" className="text-[#1e3a8a] hover:underline">Điều khoản dịch vụ</a> và{' '}
            <a href="#" className="text-[#1e3a8a] hover:underline">Chính sách bảo mật</a>
          </p>
        </div>
      </div>
    </div>
  );
}
