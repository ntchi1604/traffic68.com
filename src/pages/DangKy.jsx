import { useState, useEffect } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Rocket, CheckCircle2, TrendingUp, Link2, Gift } from 'lucide-react';
import { useToast } from '../components/Toast';
import useHCaptcha from '../hooks/useHCaptcha';

const testimonials = [
  { quote: 'Tăng 500% traffic chỉ sau 2 tháng. Đội ngũ hỗ trợ tuyệt vời!', name: 'Anh Tuấn', role: 'CEO – TechStartup.vn', initials: 'AT', gradient: 'from-orange-400 to-orange-600' },
  { quote: 'ROI gấp 3 lần quảng cáo Facebook. Không thể tin được!', name: 'Minh Châu', role: 'Marketing – ShopNow.vn', initials: 'MC', gradient: 'from-blue-400 to-blue-600' },
  { quote: 'Dashboard real-time rất tiện, theo dõi chiến dịch 24/7.', name: 'Hải Nam', role: 'Founder – BlogTech.io', initials: 'HN', gradient: 'from-emerald-400 to-emerald-600' },
  { quote: 'Hỗ trợ nhiệt tình, cam kết hoàn tiền nên rất yên tâm.', name: 'Thu Hà', role: 'Owner – CafeOnline.vn', initials: 'TH', gradient: 'from-purple-400 to-purple-600' },
];

const serviceTypes = [
  {
    value: 'traffic',
    label: 'Mua Traffic',
    icon: TrendingUp,
    desc: 'Tăng lưu lượng truy cập thực đến website',
    color: 'border-blue-500 bg-blue-50',
    iconColor: 'text-blue-600',
    activeRing: 'ring-2 ring-blue-500',
  },
  {
    value: 'shortlink',
    label: 'Rút Gọn Link',
    icon: Link2,
    desc: 'Tạo và quản lý liên kết rút gọn chuyên nghiệp',
    color: 'border-orange-500 bg-orange-50',
    iconColor: 'text-orange-600',
    activeRing: 'ring-2 ring-orange-500',
  },
];

const benefits = [
  'Traffic user thật 100%, không bot',
  'Bắt đầu nhận traffic trong 24h',
  'Dashboard báo cáo real-time',
  'Cam kết hoàn tiền 30 ngày',
];

function TestimonialCarousel() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase('out');
      setTimeout(() => {
        setIdx(i => (i + 1) % testimonials.length);
        setPhase('in');
      }, 400);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (i) => {
    if (i === idx) return;
    setPhase('out');
    setTimeout(() => { setIdx(i); setPhase('in'); }, 300);
  };

  const t = testimonials[idx];

  const animStyle = {
    in: { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
    out: { opacity: 0, transform: 'translateY(-12px) scale(0.96)', filter: 'blur(3px)' },
  };

  return (
    <div className="mt-12 bg-white/8 border border-white/15 rounded-2xl p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-xs uppercase tracking-widest">Khách hàng nói gì?</p>
        <div className="flex gap-1.5">
          {testimonials.map((_, i) => (
            <button key={i} onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'bg-orange-400 w-5' : 'bg-white/20 hover:bg-white/40 w-1.5'}`} />
          ))}
        </div>
      </div>
      <div
        style={{ ...animStyle[phase], transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <p className="text-white/90 text-sm italic leading-relaxed min-h-[40px]">"{t.quote}"</p>
        <div className="flex items-center gap-2.5 mt-4">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white text-[11px] font-black shadow-lg`}>
            {t.initials}
          </div>
          <div className="text-left">
            <p className="text-white text-xs font-bold">{t.name}</p>
            <p className="text-white/40 text-[10px]">{t.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DangKy() {
  usePageTitle('Đăng ký');
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const isRefLink = !!refCode;

  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
    service: '',
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { captchaRef, token: captchaToken, resetCaptcha } = useHCaptcha();

  // Auto-select service based on URL param or Ref Code's owner
  useEffect(() => {
    const sv = searchParams.get('svc');
    if (sv === 'shortlink' || sv === 'traffic') {
      set('service', sv);
    } else if (refCode) {
      fetch(`/api/auth/referrer/${refCode}`)
        .then(r => r.json())
        .then(d => {
          if (d.service_type === 'shortlink' || d.service_type === 'traffic') {
            set('service', d.service_type);
          }
        }).catch(() => {});
    }
  }, [searchParams, refCode]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!form.service) {
      setError('Vui lòng chọn loại dịch vụ bạn muốn sử dụng.');
      return;
    }
    if (!captchaToken) {
      setError('Vui lòng xác nhận captcha trước khi đăng ký.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.fullName,
          username: form.username,
          phone: '',
          service: form.service,
          referralCode: refCode || '',
          captchaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng ký thất bại');
        resetCaptcha();
        setLoading(false);
        return;
      }
      // Auto-login and redirect to correct dashboard
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Tài khoản đã được tạo thành công!', 'Đăng ký thành công');
        const dashPath = form.service === 'shortlink' ? '/worker/dashboard' : '/buyer/dashboard';
        navigate(dashPath);
      } else {
        setDone(true);
        toast.success('Tài khoản đã được tạo thành công!', 'Đăng ký thành công');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-50 flex">
      {/* ── Left hero panel ──────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative"
        style={{ backgroundImage: 'url(/login_hero_bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-[#0f172a]/60" />
        <div className="relative z-10 text-center max-w-md">
          <h2 className="text-3xl font-black text-white mb-4 uppercase leading-tight">
            Bắt Đầu Tăng Trưởng<br /><span className="text-[#f97316]">Ngay Hôm Nay</span>
          </h2>
          <p className="text-white/70 text-base mb-10 leading-relaxed">
            Đăng ký miễn phí và nhận tư vấn chiến lược traffic từ chuyên gia chỉ sau 5 phút.
          </p>
          <ul className="space-y-3 text-left">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-white/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
          <TestimonialCarousel />
        </div>
      </div>

      {/* ── Right form panel ─────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-6">
              <img src="/traffic68_com.gif" alt="traffic68.com" className="h-14 w-auto mx-auto" />
            </Link>
            <h1 className="text-2xl font-black text-[#1e3a8a] mb-1">Tạo tài khoản miễn phí</h1>
            <p className="text-gray-500 text-sm">Bắt đầu tăng traffic ngay hôm nay</p>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            {done ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-black text-[#1e3a8a] mb-2">Đăng ký thành công!</h3>
                <p className="text-gray-500 text-sm mb-5">
                  Tài khoản <span className="font-bold text-orange-500">@{form.username}</span> đã được tạo.<br />
                  Chuyên gia sẽ liên hệ trong vòng 30 phút.
                </p>
                <Link to="/dang-nhap" className="gradient-btn text-white font-bold px-6 py-3 rounded-xl text-sm shadow-md">
                  Đăng nhập ngay
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Họ tên */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Họ và tên *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      name="fullName"
                      value={form.fullName}
                      onChange={e => set('fullName', e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition"
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Tên đăng nhập (Username) *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      name="username"
                      value={form.username}
                      onChange={e => set('username', e.target.value)}
                      placeholder="Username"
                      pattern="[a-zA-Z0-9_]{3,20}"
                      title="3–20 ký tự, chỉ gồm chữ, số và dấu _"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">3–20 ký tự, chỉ chữ thường, số và dấu _</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="email@example.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Mật khẩu *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type={show ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="Tối thiểu 8 ký tự"
                      minLength={8}
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition"
                    />
                    <button type="button" onClick={() => setShow(!show)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type={showConfirm ? 'text' : 'password'}
                      name="confirm"
                      value={form.confirm}
                      onChange={e => set('confirm', e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Service type selector */}
                {isRefLink && (
                  <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Gift size={18} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-orange-800">Đăng ký qua mã giới thiệu</p>
                      <p className="text-xs text-orange-500 mt-0.5 font-mono">Mã: {refCode}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">
                    Bạn muốn sử dụng dịch vụ nào? *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {serviceTypes.map(({ value, label, icon: Icon, desc, color, iconColor, activeRing }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('service', value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${form.service === value
                          ? `${color} ${activeRing}`
                          : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                      >
                        <Icon className={`w-6 h-6 ${form.service === value ? iconColor : 'text-gray-400'}`} />
                        <span className={`text-sm font-bold ${form.service === value ? 'text-gray-800' : 'text-gray-500'}`}>
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400 leading-tight">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <p className="text-red-500 text-xs font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    ❌ {error}
                  </p>
                )}

                {/* hCaptcha */}
                <div className="flex justify-center">
                  <div ref={captchaRef}></div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full gradient-btn text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-70 mt-2"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : 'TẠO TÀI KHOẢN'}
                </button>
              </form>
            )}

            {!done && (
              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  Đã có tài khoản?{' '}
                  <Link to="/dang-nhap" className="text-[#f97316] font-bold hover:underline">Đăng nhập</Link>
                </p>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            Bằng cách đăng ký, bạn đồng ý với{' '}
            <a href="#" className="text-[#1e3a8a] hover:underline">Điều khoản</a> và{' '}
            <a href="#" className="text-[#1e3a8a] hover:underline">Chính sách bảo mật</a>
          </p>
        </div>
      </div>
    </div>
  );
}
