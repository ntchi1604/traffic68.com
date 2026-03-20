import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Code2, Copy, Check, Key, RefreshCw } from 'lucide-react';

export default function WorkerApi() {
  usePageTitle('API');
  const [copiedKey, setCopiedKey] = useState(false);
  const apiKey = 'tf68_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const endpoints = [
    { method: 'GET', path: '/api/v1/links', desc: 'Lấy danh sách liên kết' },
    { method: 'POST', path: '/api/v1/links', desc: 'Tạo liên kết rút gọn mới' },
    { method: 'GET', path: '/api/v1/links/:id/stats', desc: 'Xem thống kê liên kết' },
    { method: 'DELETE', path: '/api/v1/links/:id', desc: 'Xoá liên kết' },
    { method: 'GET', path: '/api/v1/earnings', desc: 'Lấy thống kê thu nhập' },
    { method: 'GET', path: '/api/v1/earnings/daily', desc: 'Thu nhập theo ngày' },
  ];

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'API' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">API</h1>
        <p className="text-slate-500 text-sm mt-1">Tích hợp Traffic68 vào ứng dụng của bạn</p>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Key size={18} className="text-orange-500" />
          API Key
        </h2>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-slate-100 px-4 py-3 rounded-lg text-xs font-mono text-slate-700 overflow-x-auto">
            {apiKey}
          </code>
          <button
            onClick={() => handleCopy(apiKey)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex-shrink-0"
          >
            {copiedKey ? <Check size={14} /> : <Copy size={14} />}
            {copiedKey ? 'Đã copy' : 'Copy'}
          </button>
          <button className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition flex-shrink-0" title="Tạo key mới">
            <RefreshCw size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Thêm header: <code className="bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code></p>
      </div>

      {/* Endpoints */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Code2 size={18} className="text-blue-500" />
          Endpoints
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-xs uppercase tracking-wider w-20">Method</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Endpoint</th>
                <th className="py-3 font-medium text-xs uppercase tracking-wider">Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ep.method === 'GET' ? 'bg-green-100 text-green-700' : ep.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs text-slate-700">{ep.path}</td>
                  <td className="py-3 text-xs text-slate-500">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Example */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Ví dụ tạo link</h2>
        <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`curl -X POST https://traffic68.com/api/v1/links \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/my-page"}'`}
        </pre>
      </div>
    </div>
  );
}
