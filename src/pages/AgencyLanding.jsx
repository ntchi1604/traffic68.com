import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, Shield, TrendingUp, Users } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

export default function AgencyLanding({ config }) {
  usePageTitle(config?.name || 'Hệ thống Traffic');
  const brandColor = config?.primary_color || '#3B82F6';

  const benefits = [
    { icon: Zap, title: 'Tốc độ cực nhanh', desc: 'Hệ thống xử lý lưu lượng truy cập mượt mà, thời gian thực.' },
    { icon: Shield, title: 'An toàn 100%', desc: 'Cam kết nguồn traffic chất lượng cao, an toàn cho SEO.' },
    { icon: TrendingUp, title: 'Tối ưu tỷ lệ chuyển đổi', desc: 'Tăng cường hiển thị, giúp website của bạn đạt thứ hạng tốt hơn.' },
    { icon: Users, title: 'Hỗ trợ tận tình', desc: 'Đội ngũ CSKH chuyên nghiệp luôn sẵn sàng hỗ trợ 24/7.' }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {config?.logo_url ? (
              <img src={config.logo_url} alt={config.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-xl font-black tracking-tight" style={{ color: brandColor }}>
                {config?.name || 'Hệ Thống Traffic'}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/dang-nhap" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Đăng nhập
            </Link>
            <Link 
              to="/dang-ky" 
              className="text-sm font-bold text-white px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: brandColor }}
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        <div className="absolute inset-0 bg-slate-50 -z-10" />
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: brandColor }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20" style={{ backgroundColor: brandColor }} />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
            Giải pháp <span style={{ color: brandColor }}>Tăng Trưởng</span><br className="hidden sm:block" /> Traffic Chuyên Nghiệp
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Hệ thống cung cấp lưu lượng truy cập chất lượng cao giúp tăng cường thứ hạng SEO và đột phá doanh thu cho doanh nghiệp của bạn.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/dang-ky" 
              className="w-full sm:w-auto px-8 py-3.5 rounded-full text-white font-black text-lg shadow-xl flex items-center justify-center gap-2 hover:-translate-y-1 transition-all"
              style={{ backgroundColor: brandColor, boxShadow: `0 20px 40px -15px ${brandColor}80` }}
            >
              Bắt đầu miễn phí <ArrowRight size={20} />
            </Link>
            <Link 
              to="/dang-nhap" 
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-slate-700 font-bold text-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
            >
              Đăng nhập hệ thống
            </Link>
          </div>
          
          <div className="mt-14 flex items-center justify-center gap-6 sm:gap-10 text-sm font-semibold text-slate-400 flex-wrap">
            <div className="flex items-center gap-2"><CheckCircle2 size={18} style={{ color: brandColor }} /> Nhanh chóng</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={18} style={{ color: brandColor }} /> An toàn 100%</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={18} style={{ color: brandColor }} /> Chi phí tối ưu</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 mb-4">Tại sao chọn chúng tôi?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Cung cấp những tính năng và giải pháp vượt trội, đáp ứng hoàn hảo nhu cầu đẩy Top SEO của bạn.</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-xl transition-all hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm transition-colors" style={{ backgroundColor: `${brandColor}15`, color: brandColor }}>
                  <b.icon size={26} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-slate-900">{b.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl p-10 sm:p-16 text-center text-white relative overflow-hidden" style={{ backgroundColor: brandColor }}>
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-black mb-6">Sẵn sàng để tăng tốc?</h2>
              <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10">Tạo tài khoản ngay hôm nay và nhận hàng ngàn lượt truy cập thực cho website của bạn.</p>
              <Link 
                to="/dang-ky" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 font-black rounded-full text-lg shadow-2xl hover:scale-105 transition-transform"
              >
                Tạo chiến dịch ngay <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            {config?.logo_url ? (
              <img src={config.logo_url} alt={config.name} className="h-6 w-auto grayscale opacity-70" />
            ) : (
              <span className="font-bold">{config?.name || 'Hệ Thống Traffic'}</span>
            )}
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-600 transition-colors">Điều khoản</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Bảo mật</a>
            {config?.contact_email && <a href={`mailto:${config.contact_email}`} className="hover:text-slate-600 transition-colors">Liên hệ</a>}
          </div>
        </div>
      </footer>
    </div>
  );
}
