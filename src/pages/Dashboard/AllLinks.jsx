import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import {
  Link2, Copy, Eye, TrendingUp, Search, Filter,
  MoreHorizontal, ExternalLink, EyeOff, Trash2, Check,
} from 'lucide-react';

/* ─── Dummy Data ───────────────────────────────────── */
const LINKS = [
  { id: 1, originalUrl: 'https://shopee.vn/khuyen-mai-sieu-sale', shortCode: 'abc123', shortUrl: 'traffic68.com/s/abc123', clicks: 1245, earnings: 62250, status: 'active', createdAt: '2026-03-20' },
  { id: 2, originalUrl: 'https://lazada.vn/deal-hot-cuoi-tuan', shortCode: 'def456', shortUrl: 'traffic68.com/s/def456', clicks: 834, earnings: 41700, status: 'active', createdAt: '2026-03-19' },
  { id: 3, originalUrl: 'https://tiki.vn/flash-sale-hang-ngay', shortCode: 'ghi789', shortUrl: 'traffic68.com/s/ghi789', clicks: 567, earnings: 28350, status: 'active', createdAt: '2026-03-18' },
  { id: 4, originalUrl: 'https://sendo.vn/uu-dai-thanh-vien', shortCode: 'jkl012', shortUrl: 'traffic68.com/s/jkl012', clicks: 2103, earnings: 105150, status: 'active', createdAt: '2026-03-17' },
  { id: 5, originalUrl: 'https://fptshop.com.vn/khuyen-mai-laptop', shortCode: 'mno345', shortUrl: 'traffic68.com/s/mno345', clicks: 389, earnings: 19450, status: 'active', createdAt: '2026-03-16' },
  { id: 6, originalUrl: 'https://cellphones.com.vn/dien-thoai', shortCode: 'pqr678', shortUrl: 'traffic68.com/s/pqr678', clicks: 156, earnings: 7800, status: 'active', createdAt: '2026-03-15' },
  { id: 7, originalUrl: 'https://dienmayxanh.com/may-giat-sale', shortCode: 'stu901', shortUrl: 'traffic68.com/s/stu901', clicks: 723, earnings: 36150, status: 'active', createdAt: '2026-03-14' },
  { id: 8, originalUrl: 'https://thegioididong.com/phu-kien', shortCode: 'vwx234', shortUrl: 'traffic68.com/s/vwx234', clicks: 91, earnings: 4550, status: 'active', createdAt: '2026-03-13' },
];

const fmt = (n) => Number(n).toLocaleString('vi-VN');

export default function AllLinks() {
  usePageTitle('Tất cả liên kết');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const filtered = LINKS.filter(
    (l) =>
      l.originalUrl.toLowerCase().includes(search.toLowerCase()) ||
      l.shortCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalClicks = LINKS.reduce((s, l) => s + l.clicks, 0);
  const totalEarnings = LINKS.reduce((s, l) => s + l.earnings, 0);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Tất cả liên kết' },
      ]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tất cả liên kết</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý tất cả liên kết rút gọn của bạn</p>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Link2 size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng liên kết</p>
            <p className="text-xl font-black text-slate-900">{LINKS.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Eye size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng lượt click</p>
            <p className="text-xl font-black text-slate-900">{fmt(totalClicks)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Tổng thu nhập</p>
            <p className="text-xl font-black text-slate-900">{fmt(totalEarnings)} đ</p>
          </div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm liên kết..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
            <Filter size={14} />
            Bộ lọc
          </button>
        </div>

        {/* ── Links Table ── */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Liên kết gốc</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Link rút gọn</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Lượt click</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Ngày tạo</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((link) => (
                <tr key={link.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 pr-4 max-w-[220px]">
                    <div className="flex items-center gap-2">
                      <ExternalLink size={14} className="text-slate-300 flex-shrink-0" />
                      <span className="text-slate-700 font-medium truncate text-xs">{link.originalUrl}</span>
                    </div>
                  </td>
                  <td className="py-3.5">
                    <button
                      onClick={() => handleCopy(`https://${link.shortUrl}`, link.id)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition font-semibold text-xs"
                    >
                      <span>{link.shortUrl}</span>
                      {copiedId === link.id ? (
                        <Check size={13} className="text-green-500" />
                      ) : (
                        <Copy size={13} className="opacity-0 group-hover:opacity-100 transition" />
                      )}
                    </button>
                  </td>
                  <td className="py-3.5 text-center font-bold text-slate-800 text-xs">{fmt(link.clicks)}</td>
                  <td className="py-3.5 text-right font-bold text-green-600 text-xs">{fmt(link.earnings)} đ</td>
                  <td className="py-3.5 text-center text-slate-400 text-xs">{link.createdAt}</td>
                  <td className="py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg transition text-slate-400 hover:text-slate-600" title="Ẩn liên kết">
                        <EyeOff size={14} />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-500" title="Xoá">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Không tìm thấy liên kết nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
