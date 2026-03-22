import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Code2, Copy, Check, Key, Trash2, Plus, RefreshCw, ExternalLink, Zap } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

export default function WorkerApi() {
  usePageTitle('QuickLink API');
  const toast = useToast();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/quicklink/keys');
      setKeys(data.keys || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    setCreating(true);
    try {
      const data = await api.post('/quicklink/keys', { label: label.trim() || 'Default' });
      toast.success('Tạo API key thành công!');
      setLabel('');
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const deleteKey = async (id) => {
    if (!await toast.confirm('Xóa API key này?')) return;
    try {
      await api.delete(`/quicklink/keys/${id}`);
      toast.success('Đã xóa key');
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const BASE = window.location.origin;

  const endpoints = [
    { method: 'POST', path: '/api/quicklink/v1/shorten', desc: 'Tạo link rút gọn', body: '{ "url": "https://...", "title": "optional" }', response: '{ "short_url", "slug", "id" }' },
    { method: 'GET', path: '/api/quicklink/v1/links', desc: 'Danh sách link', body: null, response: '{ "links": [...], "pagination" }' },
    { method: 'GET', path: '/api/quicklink/v1/links/:id', desc: 'Chi tiết link', body: null, response: '{ "id", "short_url", "click_count", ... }' },
    { method: 'DELETE', path: '/api/quicklink/v1/links/:id', desc: 'Xóa link', body: null, response: '{ "message" }' },
    { method: 'GET', path: '/api/quicklink/v1/stats', desc: 'Thống kê tổng', body: null, response: '{ "total_links", "total_clicks", ... }' },
  ];

  const firstKey = keys[0]?.api_key || 'YOUR_API_KEY';

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'QuickLink API' },
      ]} />

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Zap size={24} className="text-orange-500" /> QuickLink API
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Rút gọn link bằng API → tự redirect sang vượt link → kiếm tiền mỗi lượt hoàn thành
        </p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5">
        <h3 className="text-sm font-black text-blue-900 mb-2">⚡ Cách hoạt động</h3>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          {[
            { step: '1', title: 'Gọi API', desc: 'POST /shorten + URL đích' },
            { step: '2', title: 'Nhận short URL', desc: '/vuot-link/abc1234' },
            { step: '3', title: 'Chia sẻ', desc: 'Người dùng click link' },
            { step: '4', title: 'Kiếm tiền', desc: 'Vượt link xong → CPC' },
          ].map(s => (
            <div key={s.step} className="bg-white/80 rounded-xl p-3 border border-blue-100">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center mx-auto mb-1.5">{s.step}</div>
              <p className="font-bold text-blue-900">{s.title}</p>
              <p className="text-blue-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Key size={18} className="text-orange-500" />
          API Keys
          <span className="ml-auto text-xs text-slate-400 font-normal">Tối đa 5 key</span>
        </h2>

        {/* Create new key */}
        <div className="flex items-center gap-2 mb-4">
          <input
            value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Nhãn (VD: Production, Tester...)"
            className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 transition"
          />
          <button onClick={createKey} disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 flex-shrink-0">
            <Plus size={15} /> {creating ? 'Đang tạo...' : 'Tạo key'}
          </button>
        </div>

        {/* Keys list */}
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Đang tải...</p>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <Key size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Chưa có API key. Tạo key để bắt đầu sử dụng API.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-700">{k.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${k.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {k.active ? 'Active' : 'Revoked'}
                    </span>
                  </div>
                  <code className="text-[11px] font-mono text-slate-500 break-all">{k.api_key}</code>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                    <span>{k.request_count} requests</span>
                    <span>•</span>
                    <span>{k.last_used_at ? `Dùng lần cuối: ${new Date(k.last_used_at).toLocaleDateString('vi')}` : 'Chưa sử dụng'}</span>
                  </div>
                </div>
                <button onClick={() => handleCopy(k.api_key, k.id)} title="Copy key"
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0">
                  {copied === k.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
                <button onClick={() => deleteKey(k.id)} title="Xóa key"
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-3">
          Thêm header: <code className="bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer YOUR_API_KEY</code>
        </p>
      </div>

      {/* Endpoints */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Code2 size={18} className="text-blue-500" />
          API Endpoints
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-3 font-medium text-[10px] uppercase tracking-wider w-16">Method</th>
                <th className="py-3 font-medium text-[10px] uppercase tracking-wider">Endpoint</th>
                <th className="py-3 font-medium text-[10px] uppercase tracking-wider">Mô tả</th>
                <th className="py-3 font-medium text-[10px] uppercase tracking-wider">Body</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                      ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-700">{ep.path}</td>
                  <td className="py-3 text-xs text-slate-500">{ep.desc}</td>
                  <td className="py-3 font-mono text-[10px] text-slate-400">{ep.body || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Create link */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">📝 Tạo link rút gọn</h3>
            <button onClick={() => handleCopy(`curl -X POST ${BASE}/api/quicklink/v1/shorten \\\n  -H "Authorization: Bearer ${firstKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://example.com/my-page"}'`, 'curl-create')}
              className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-1">
              {copied === 'curl-create' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
{`curl -X POST ${BASE}/api/quicklink/v1/shorten \\
  -H "Authorization: Bearer ${firstKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/my-page"}'`}
          </pre>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 mb-1">Response:</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`{
  "id": 42,
  "slug": "abc1234",
  "short_url": "${BASE}/vuot-link/abc1234",
  "destination_url": "https://example.com/my-page"
}`}
            </pre>
          </div>
        </div>

        {/* List links */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">📋 Xem danh sách link</h3>
            <button onClick={() => handleCopy(`curl ${BASE}/api/quicklink/v1/links?page=1&limit=10 \\\n  -H "Authorization: Bearer ${firstKey}"`, 'curl-list')}
              className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-1">
              {copied === 'curl-list' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
{`curl ${BASE}/api/quicklink/v1/links?page=1&limit=10 \\
  -H "Authorization: Bearer ${firstKey}"`}
          </pre>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 mb-1">Response:</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`{
  "links": [
    {
      "id": 42,
      "short_url": "${BASE}/vuot-link/abc1234",
      "click_count": 150,
      "completed_count": 48,
      "earning": 24000
    }
  ],
  "pagination": { "page": 1, "total": 15 }
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Rate Limits */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-200 p-5">
        <h3 className="text-sm font-black text-orange-900 mb-2">⚠️ Lưu ý</h3>
        <ul className="text-xs text-orange-800 space-y-1.5 list-disc pl-4">
          <li>Mỗi link rút gọn qua API sẽ redirect sang <strong>/vuot-link/slug</strong> — người dùng phải vượt link trước khi đến URL đích</li>
          <li>Bạn nhận <strong>CPC</strong> cho mỗi lượt vượt link hoàn thành (giống tạo link trong dashboard)</li>
          <li>API key bị lộ → <strong>xóa ngay</strong> và tạo key mới</li>
          <li>Tối đa <strong>5 API key</strong> mỗi tài khoản</li>
        </ul>
      </div>
    </div>
  );
}
