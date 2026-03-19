import { CheckCircle2, Medal, Lock, Target, TrendingUp, BarChart2, Globe, Rocket } from 'lucide-react';

const trustBadges = [
  { icon: CheckCircle2, label: '100% Traffic User Thật', color: 'text-emerald-400' },
  { icon: Medal, label: 'Cam Kết Hoàn Tiền', color: 'text-yellow-400' },
  { icon: Lock, label: 'An Toàn SEO', color: 'text-sky-400' },
  { icon: Target, label: 'Tăng CRO', color: 'text-orange-400' },
];

const trafficSources = [
  { label: 'Organic Search', val: 62, color: '#10b981' },
  { label: 'Direct', val: 24, color: '#3b82f6' },
  { label: 'Social Media', val: 14, color: '#f97316' },
];

export default function Hero() {
  return (
    <section id="trang-chu" className="hero-bg min-h-screen pt-[66px] flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 lg:py-20 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-16 items-center">

          {/* ── Left column ─────────────────────────────── */}
          <div className="fade-in-up order-2 lg:order-1">



            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[2.65rem] xl:text-5xl font-black text-white leading-tight mb-6 uppercase">
              Nâng Tầm Website Với<br />
              <span className="text-[#f97316]">Traffic User</span> Chất Lượng<br />
              <span className="text-sky-300">— Tăng Trưởng Bền Vững</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-white/70 mb-9 leading-relaxed max-w-lg">
              Giải pháp Traffic User thực từ người dùng thật tại Việt Nam, cam kết hiệu quả SEO và chuyển đổi, an toàn 100%.
            </p>

            {/* CTA */}
            <div className="flex flex-wrap gap-4 mb-10">
              <a href="#" id="hero-cta-btn" className="orange-btn text-white text-base font-black px-9 py-4 rounded-2xl shadow-xl flex items-center gap-2.5">
                <Rocket className="w-5 h-5" />
                NHẬN TƯ VẤN NGAY
              </a>
              <a href="#" className="bg-white/10 hover:bg-white/20 border border-white/25 text-white text-base font-semibold px-7 py-4 rounded-2xl transition-all flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-400" />
                Xem Demo miễn phí
              </a>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { val: '10K+', label: 'Khách hàng tin dùng' },
                { val: '+500%', label: 'Tăng traffic trung bình' },
                { val: '99%', label: 'Tỷ lệ thành công' },
              ].map((s) => (
                <div key={s.label} className="bg-white/8 border border-white/15 rounded-xl p-3.5 backdrop-blur-sm text-center">
                  <p className="text-xl sm:text-2xl font-black text-[#f97316]">{s.val}</p>
                  <p className="text-[11px] text-white/55 mt-0.5 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right column ────────────────────────────── */}
          <div className="relative order-1 lg:order-2 flex justify-center">
            {/* Main illustration */}
            <div className="float-anim relative">
              <img
                src="/hero-illustration.png"
                alt="Chuyên gia traffic68.com với biểu đồ tăng trưởng"
                className="w-full max-w-md xl:max-w-lg rounded-3xl object-cover shadow-2xl"
                style={{ filter: 'drop-shadow(0 30px 60px rgba(249,115,22,0.2))' }}
              />

              {/* Traffic Sources dashboard card */}
              <div className="absolute -bottom-6 -left-6 sm:-left-10 bg-[#0f1e4a] border border-white/15 rounded-2xl p-4 shadow-2xl backdrop-blur-xl w-52 sm:w-60">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white tracking-wider uppercase">Traffic Sources</span>
                  <span className="ml-auto text-[10px] font-medium text-emerald-400 bg-emerald-400/15 px-1.5 py-0.5 rounded-full">LIVE</span>
                </div>
                {trafficSources.map(({ label, val, color }) => (
                  <div key={label} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-white/65">{label}</span>
                      <span className="text-[11px] font-bold text-white">{val}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${val}%`, background: color }} />
                    </div>
                  </div>
                ))}
                <p className="mt-2.5 text-[10px] text-white/40">Cập nhật: vừa xong</p>
              </div>

              {/* Growth badge */}
              <div className="absolute -top-4 -right-4 sm:-right-8 bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4" />
                +147% Traffic
              </div>
            </div>

            {/* 4 Trust badges floating column */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-2.5 translate-x-4">
              {trustBadges.map(({ icon: Icon, label, color }) => (
                <div key={label} className="bg-white/10 border border-white/20 backdrop-blur-md rounded-xl px-3 py-2.5 flex items-center gap-2.5 shadow-lg w-52">
                  <Icon className={`w-5 h-5 shrink-0 ${color}`} />
                  <span className="text-xs font-semibold text-white leading-snug">{label}</span>
                </div>
              ))}
            </div>

            {/* Glow orb */}
            <div className="absolute inset-0 rounded-3xl bg-orange-500/5 blur-3xl -z-10" />
          </div>
        </div>

        {/* ── 4 Trust badges row (mobile/tablet) ─────── */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 xl:hidden">
          {trustBadges.map(({ icon: Icon, label, color }) => (
            <div key={label} className="bg-white/8 border border-white/15 backdrop-blur-sm rounded-xl px-3 py-3.5 flex flex-col items-center gap-2 text-center">
              <Icon className={`w-6 h-6 ${color}`} />
              <span className="text-xs font-semibold text-white/85 leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
