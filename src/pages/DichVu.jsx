import { useState } from 'react';
import usePageTitle from '../hooks/usePageTitle';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Shield, TrendingUp, Headphones, Search, BarChart2, BarChart3, FileText, Users, Heart, Megaphone, Video, Link2, Clock, Settings } from 'lucide-react';
import Footer from '../components/Footer';
import BottomCTA from '../components/BottomCTA';

/* ── Service cards data ── */
const services = [
  {
    bg: 'bg-blue-50',
    borderColor: 'border-blue-100',
    icon: (
      <img src="/google_icon.png" alt="Google" className="w-24 h-24 object-contain mx-auto mb-4" />
    ),
    title: 'GOOGLE SEARCH TRAFFIC',
    features: [
      { icon: Search, text: 'Tìm kiếm từ khóa chính xác' },
      { icon: BarChart2, text: 'Tăng SEO CTR tự nhiên' },
      { icon: BarChart3, text: 'Cải thiện SERP' },
      { icon: FileText, text: 'Báo cáo chi tiết thứ hạng' },
    ],
  },
  {
    bg: 'bg-pink-50',
    borderColor: 'border-pink-100',
    icon: (
      <img src="/social_icons.png" alt="Social" className="w-24 h-24 object-contain mx-auto mb-4" />
    ),
    title: 'SOCIAL TRAFFIC',
    features: [
      { icon: Users, text: 'Traffic từ Fanpage/Nhóm' },
      { icon: Heart, text: 'Tăng tương tác thật trên MXH' },
      { icon: Megaphone, text: 'Tăng Reach thương hiệu' },
      { icon: Video, text: 'Traffic từ bài đăng/video xã hội' },
    ],
  },
  {
    bg: 'bg-green-50',
    borderColor: 'border-green-100',
    icon: (
      <img src="/direct_icon.png" alt="Direct" className="w-24 h-24 object-contain mx-auto mb-4" />
    ),
    title: 'DIRECT TRAFFIC',
    features: [
      { icon: Link2, text: 'Truy cập URL trực tiếp' },
      { icon: Clock, text: 'Tăng Time on Page' },
      { icon: TrendingUp, text: 'Giảm Bounce Rate' },
      { icon: Settings, text: 'Tùy chỉnh nền tảng & thiết bị' },
    ],
  },
];

const trustCards = [
  {
    icon: Shield,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    title: 'An toàn & Bảo mật',
    desc: 'Top 1-3 Google trong 60-90 ngày',
  },
  {
    icon: TrendingUp,
    color: 'text-green-500',
    bg: 'bg-green-50',
    title: 'Tăng SEO bền vững',
    desc: 'Time on Page, đọc & tương tác',
  },
  {
    icon: Headphones,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    title: 'Hỗ trợ chuyên nghiệp',
    desc: 'Traffic bền vững, không nhận tạo',
  },
];

const partners = ['Taboola', 'Teads', 'Criteo', 'Outbrain', 'AdRoll', 'The Trade Desk'];

export default function DichVu() {
  usePageTitle('Dịch vụ');
  return (
    <>
      {/* ── Hero (dark, like BangGia) ── */}
      <div className="hero-bg py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 uppercase leading-tight">
            Giải Pháp <span className="text-[#f97316]">Traffic User</span> Toàn Diện
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Dẫn dắt traffic chất lượng cao từ nhiều nguồn để tăng thứ hạng SEO và chuyển đổi cho website của bạn.
          </p>
        </div>
      </div>

      {/* ── Service cards section ── */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* ── Service cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {services.map(({ bg, borderColor, icon, title, features }) => (
              <div
                key={title}
                className={`${bg} border ${borderColor} rounded-2xl p-6 sm:p-8 flex flex-col items-center text-left
                            transition-all hover:shadow-lg hover:-translate-y-1`}
              >
                {icon}
                <h3 className="text-base sm:text-lg font-black text-[#1e3a5f] mb-5 text-center tracking-wide uppercase">
                  {title}
                </h3>
                <ul className="space-y-3 w-full flex-1">
                  {features.map(({ icon: FIcon, text }) => (
                    <li key={text} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <FIcon size={14} className="text-gray-400 shrink-0 mt-0.5" />
                      {text}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/bang-gia"
                  className="mt-6 inline-flex items-center gap-2 bg-[#f97316] hover:bg-[#ea580c] text-white
                             font-bold text-sm px-6 py-2.5 rounded-lg shadow-md shadow-orange-200
                             transition-all hover:-translate-y-0.5 active:scale-95"
                >
                  XEM CHI TIẾT <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>

          {/* ── Trust cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {trustCards.map(({ icon: Icon, color, bg, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4
                           shadow-sm hover:shadow-md transition-all"
              >
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon size={20} className={color} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1e3a5f]">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="py-10 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-6">
            Được tin tưởng & chứng nhận bởi
          </p>
          <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap opacity-30">
            {partners.map(name => (
              <span key={name} className="text-lg sm:text-xl font-black text-gray-600 tracking-wider">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      <BottomCTA />
      <Footer />
    </>
  );
}
