import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Phone, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useToast } from '../components/Toast';
import useHCaptcha from '../hooks/useHCaptcha';

export default function AgencyDangKy({ config }) {
  usePageTitle(`Đăng ký - ${config?.name || 'Hệ thống'}`);
  const navigate = useNavigate();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { captchaRef, token: captchaToken, resetCaptcha } = useHCaptcha();

  const brandColor = config?.primary_color || '#3B82F6';

  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    repassword: '',
    agree: false,
  });

  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/buyer/dashboard');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agree) {
      setError('Bạn phải đồng ý với Điều khoản dịch vụ');
      return;
    }
    if (form.password !== form.repassword) {
      setError('Mật khẩu không khớp');
      return;
    }
    if (!captchaToken) {
      setError('Vui lòng xác nhận captcha');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          phone: form.phone,
          password: form.password,
          captchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng ký thất bại');
        resetCaptcha();
        return;
      }

      toast.success('Đăng ký thành công! Đang đăng nhập...', 'Thành công');
      
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          captchaToken,
        }),
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.token) {
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));
        navigate('/buyer/dashboard');
      } else {
        navigate('/dang-nhap');
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-row-reverse">
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative"
        style={{ backgroundColor: brandColor }}
      >
        <div className="absolute inset-0 bg-black/20 rounded-none" />
        <div className="relative z-10 text-center max-w-md">
          <h2 className="text-3xl font-black text-white mb-4 uppercase leading-tight">
            Tạo tài khoản<br /><span className="text-white opacity-90">{config?.name || 'Hệ thống'}</span>
          </h2>
          <p className="text-white/80 text-base mb-10 leading-relaxed">
            Đăng ký ngay để bắt đầu sử dụng các dịch vụ của chúng tôi.
          </p>
          <ul className="space-y-3 text-left">
            <li className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              Tài khoản miễn phí, thao tác nhanh chóng
            </li>
            <li className="flex items-center gap-3 text-sm text-white/90">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              Bảo mật an toàn, thông tin tuyệt mật
            </li>
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-6">
              {config?.logo_url ? (
                <img src={config.logo_url} alt={config.name} className="h-16 w-auto mx-auto object-contain" />
              ) : (
                <div className="text-3xl font-black" style={{ color: brandColor }}>{config?.name || 'Hệ thống'}</div>
              )}
            </Link>
            <h1 className="text-2xl font-black text-slate-800 mb-1">Đăng ký tài khoản</h1>
            <p className="text-gray-500 text-sm">Điền thông tin để bắt đầu</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tên đăng nhập <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type="text" name="username" value={form.username} onChange={handleChange} placeholder="vd: nguyenvan_a" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input required type="email" name="email" value={form.email} onChange={handleChange} placeholder="email@example.com" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="0987654321" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mật khẩu <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input required type={show ? 'text' : 'password'} name="password" value={form.password} onChange={handleChange} placeholder="••••••••" className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nhập lại MK <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input required type={show ? 'text' : 'password'} name="repassword" value={form.repassword} onChange={handleChange} placeholder="••••••••" className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 transition" style={{ '--tw-ring-color': brandColor }} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => setShow(!show)} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: brandColor }}>
                  {show ? <><EyeOff className="w-3 h-3"/> Ẩn MK</> : <><Eye className="w-3 h-3"/> Hiện MK</>}
                </button>
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="agree"
                  name="agree"
                  checked={form.agree}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 cursor-pointer"
                  style={{ accentColor: brandColor }}
                />
                <label htmlFor="agree" className="text-sm text-gray-600 cursor-pointer select-none leading-tight">
                  Tôi đồng ý với <a href="#" className="font-semibold hover:underline" style={{ color: brandColor }}>Điều khoản dịch vụ</a> và <a href="#" className="font-semibold hover:underline" style={{ color: brandColor }}>Chính sách bảo mật</a>
                </label>
              </div>

              <div className="flex justify-center pt-2">
                <div ref={captchaRef}></div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2.5 text-sm disabled:opacity-70 transition-all hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang xử lý...</span>
                ) : (
                  <><span>ĐĂNG KÝ TÀI KHOẢN</span> <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Đã có tài khoản?{' '}
                <Link to="/dang-nhap" className="font-bold hover:underline" style={{ color: brandColor }}>Đăng nhập</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
