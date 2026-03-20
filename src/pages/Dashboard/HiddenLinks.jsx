import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { EyeOff, Search, Eye, Trash2, RotateCcw } from 'lucide-react';

const HIDDEN_LINKS = [
  { id: 1, originalUrl: 'https://example.com/old-promo-1', shortCode: 'old001', shortUrl: 'traffic68.com/s/old001', clicks: 342, earnings: 17100, hiddenAt: '2026-03-10' },
  { id: 2, originalUrl: 'https://example.com/expired-deal', shortCode: 'old002', shortUrl: 'traffic68.com/s/old002', clicks: 89, earnings: 4450, hiddenAt: '2026-03-08' },
  { id: 3, originalUrl: 'https://example.com/test-link', shortCode: 'old003', shortUrl: 'traffic68.com/s/old003', clicks: 12, earnings: 600, hiddenAt: '2026-03-05' },
];

const fmt = (n) => Number(n).toLocaleString('vi-VN');

export default function HiddenLinks() {
  usePageTitle('Liên kết ẩn');
  const [search, setSearch] = useState('');

  const filtered = HIDDEN_LINKS.filter(l =>
    l.originalUrl.toLowerCase().includes(search.toLowerCase()) ||
    l.shortCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Liên kết ẩn' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Liên kết ẩn</h1>
        <p className="text-slate-500 text-sm mt-1">Các liên kết đã bị ẩn hoặc lưu trữ</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm liên kết ẩn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <EyeOff size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">Không có liên kết ẩn nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-3 font-medium text-xs uppercase tracking-wider">Liên kết gốc</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider">Link rút gọn</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Lượt click</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Ngày ẩn</th>
                  <th className="py-3 font-medium text-xs uppercase tracking-wider text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(link => (
                  <tr key={link.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 pr-4 max-w-[200px]">
                      <span className="text-slate-500 truncate text-xs block">{link.originalUrl}</span>
                    </td>
                    <td className="py-3.5 text-slate-400 text-xs line-through">{link.shortUrl}</td>
                    <td className="py-3.5 text-center text-slate-500 text-xs">{fmt(link.clicks)}</td>
                    <td className="py-3.5 text-right font-bold text-slate-500 text-xs">{fmt(link.earnings)} đ</td>
                    <td className="py-3.5 text-center text-slate-400 text-xs">{link.hiddenAt}</td>
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 hover:bg-green-50 rounded-lg transition text-slate-400 hover:text-green-600" title="Hiện lại">
                          <Eye size={14} />
                        </button>
                        <button className="p-1.5 hover:bg-red-50 rounded-lg transition text-slate-400 hover:text-red-500" title="Xoá vĩnh viễn">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
