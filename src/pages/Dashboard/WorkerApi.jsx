import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Code2, Copy, Check, Key, RefreshCw, Zap, Eye, EyeOff } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

export default function WorkerApi() {
  usePageTitle('QuickLink API');
  const toast = useToast();

  const [keyData, setKeyData] = useState(null); // single key object or null
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/quicklink/key');
      setKeyData(data.key || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    setRegenerating(true);
    try {
      const data = await api.post('/quicklink/key');
      setKeyData(data.key);
      setShowKey(true);
      toast.success('Tạo API key thành công!');
    } catch (e) { toast.error(e.message); }
    finally { setRegenerating(false); }
  };

  const regenerateKey = async () => {
    if (!await toast.confirm('Đổi API key? Key cũ sẽ ngừng hoạt động ngay lập tức.')) return;
    setRegenerating(true);
    try {
      const data = await api.put('/quicklink/key');
      setKeyData(data.key);
      setShowKey(true);
      toast.success('Đã đổi API key!');
    } catch (e) { toast.error(e.message); }
    finally { setRegenerating(false); }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskKey = (key) => {
    if (!key) return '';
    return key.slice(0, 8) + '•'.repeat(key.length - 12) + key.slice(-4);
  };

  const BASE = window.location.origin;
  const apiKey = keyData?.api_key || 'YOUR_API_KEY';

  const endpoints = [
    { method: 'GET', path: '/st', desc: '⚡ Tạo link & redirect ngay', body: '?api=API_KEY&url=URL_ĐÍCH', highlight: true },
    { method: 'GET', path: '/api/quicklink/v1/links', desc: 'Danh sách link (phân trang)', body: '?page=1&limit=20' },
    { method: 'GET', path: '/api/quicklink/v1/links/:id', desc: 'Chi tiết 1 link', body: null },
    { method: 'GET', path: '/api/quicklink/v1/stats', desc: 'Thống kê tổng', body: null },
  ];

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
          Rút gọn link bằng API → redirect sang vượt link → kiếm tiền mỗi lượt hoàn thành
        </p>
      </div>

      {/* QuickLink URL — Hero */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 p-5">
        <h3 className="text-sm font-black text-orange-900 mb-2 flex items-center gap-2">⚡ QuickLink — Tạo link cực nhanh bằng URL</h3>
        <p className="text-xs text-orange-700 mb-3">Chỉ cần 1 URL duy nhất, tự động tạo shortlink và redirect người dùng đến trang vượt link:</p>
        <div className="bg-white rounded-xl border border-orange-200 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">GET</span>
            <span className="text-xs text-slate-400">Format:</span>
          </div>
          <code className="block bg-slate-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-x-auto">
            {`${BASE}/st?api=`}<span className="text-yellow-300">{apiKey}</span>{`&url=`}<span className="text-cyan-300">https://example.com</span>
          </code>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
          {[
            { step: '1', title: 'Dán URL', desc: 'Thay url= bằng link đích', color: 'bg-orange-500' },
            { step: '2', title: 'Auto tạo link', desc: 'Hệ thống tạo shortlink ngay', color: 'bg-blue-500' },
            { step: '3', title: 'Redirect', desc: 'Người dùng vượt link → CPC', color: 'bg-green-500' },
          ].map(s => (
            <div key={s.step} className="bg-white/80 rounded-xl p-3 border border-orange-100">
              <div className={`w-7 h-7 rounded-full ${s.color} text-white font-black text-sm flex items-center justify-center mx-auto mb-1.5`}>{s.step}</div>
              <p className="font-bold text-slate-800">{s.title}</p>
              <p className="text-slate-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-[11px] text-blue-800">💡 <strong>Mẹo:</strong> Nếu URL đích đã tạo shortlink trước đó, hệ thống sẽ tái sử dụng link cũ (không tạo trùng).</p>
        </div>
      </div>

      {/* API Key — single key */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Key size={18} className="text-orange-500" />
          API Key
        </h2>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Đang tải...</p>
        ) : !keyData ? (
          /* No key yet */
          <div className="text-center py-8">
            <Key size={36} className="text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-4">Chưa có API key. Tạo key để bắt đầu sử dụng QuickLink API.</p>
            <button onClick={createKey} disabled={regenerating}
              className="px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-50 inline-flex items-center gap-2">
              <Key size={15} /> {regenerating ? 'Đang tạo...' : 'Tạo API key'}
            </button>
          </div>
        ) : (
          /* Has key */
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-mono text-slate-700 overflow-x-auto select-all">
                {showKey ? keyData.api_key : maskKey(keyData.api_key)}
              </code>
              <button onClick={() => setShowKey(!showKey)} title={showKey ? 'Ẩn' : 'Hiện'}
                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => handleCopy(keyData.api_key, 'key')} title="Copy key"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex-shrink-0">
                {copied === 'key' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
              <button onClick={regenerateKey} disabled={regenerating} title="Đổi key mới"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex-shrink-0 disabled:opacity-50">
                <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> Đổi key
              </button>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <span>📊 {keyData.request_count || 0} requests</span>
              <span>•</span>
              <span>{keyData.last_used_at ? `Dùng lần cuối: ${new Date(keyData.last_used_at).toLocaleString('vi')}` : 'Chưa sử dụng'}</span>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-4 border-t border-slate-100 pt-3">
          Thêm header vào mỗi request: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">Authorization: Bearer YOUR_API_KEY</code>
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
                <th className="py-3 font-medium text-[10px] uppercase tracking-wider">Params / Body</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${ep.highlight ? 'bg-orange-50/50' : ''}`}>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ep.method === 'GET' ? 'bg-green-100 text-green-700' :
                      ep.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{ep.method}</span>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-700">{ep.highlight ? <strong>{ep.path}</strong> : ep.path}</td>
                  <td className="py-3 text-xs text-slate-500">{ep.desc}</td>
                  <td className="py-3 font-mono text-[10px] text-slate-400">{ep.body || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Curl Examples */}
      <div className="grid grid-cols-1 gap-4">
        {/* QuickLink /st example */}
        <div className="bg-white rounded-2xl border-2 border-orange-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">⚡ QuickLink — Tạo & Redirect</h3>
            <button onClick={() => handleCopy(`${BASE}/st?api=${apiKey}&url=https://example.com`, 'curl-st')}
              className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-1">
              {copied === 'curl-st' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">Dán URL này vào trình duyệt hoặc embed trong website — sẽ tự tạo shortlink rồi redirect đến trang vượt link:</p>
          <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
{`${BASE}/st?api=${apiKey}&url=https://example.com`}
          </pre>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1">Embed trong HTML:</p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`<a href="${BASE}/st?api=${apiKey}&url=https://example.com">
  Click để truy cập
</a>`}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1">Redirect bằng PHP/JS:</p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`// PHP
header("Location: ${BASE}/st?api=KEY&url=" . $url);

// JS
window.location = "${BASE}/st?api=KEY&url=" + url;`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">📋 Danh sách link</h3>
            <button onClick={() => handleCopy(`curl ${BASE}/api/quicklink/v1/links?page=1&limit=20 \\\n  -H "Authorization: Bearer ${apiKey}"`, 'curl-list')}
              className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-1">
              {copied === 'curl-list' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
{`curl ${BASE}/api/quicklink/v1/links?page=1&limit=20 \\
  -H "Authorization: Bearer ${apiKey}"`}
          </pre>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 mb-1">Response:</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`{
  "links": [
    {
      "id": 42,
      "slug": "abc1234",
      "short_url": "${BASE}/vuot-link/abc1234",
      "destination_url": "https://example.com",
      "click_count": 150,
      "completed_count": 45,
      "earning": 22500
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}`}
            </pre>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">📋 Xem stats</h3>
            <button onClick={() => handleCopy(`curl ${BASE}/api/quicklink/v1/stats \\\n  -H "Authorization: Bearer ${apiKey}"`, 'curl-stats')}
              className="text-[10px] text-slate-400 hover:text-blue-500 flex items-center gap-1">
              {copied === 'curl-stats' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
            </button>
          </div>
          <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
{`curl ${BASE}/api/quicklink/v1/stats \\
  -H "Authorization: Bearer ${apiKey}"`}
          </pre>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-slate-500 mb-1">Response:</p>
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`{
  "total_links": 15,
  "total_clicks": 1250,
  "total_completed": 410,
  "total_earning": 205000
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-orange-200 p-5">
        <h3 className="text-sm font-black text-orange-900 mb-2">⚠️ Lưu ý</h3>
        <ul className="text-xs text-orange-800 space-y-1.5 list-disc pl-4">
          <li>Dùng <strong>/st?api=KEY&url=URL</strong> để tạo link & redirect trong 1 bước duy nhất</li>
          <li>Nếu URL đã tạo trước đó → <strong>tái sử dụng</strong> shortlink cũ (không tạo trùng)</li>
          <li>Link redirect sang <strong>/vuot-link/slug</strong> — người dùng phải vượt link trước khi đến URL đích</li>
          <li>Bạn nhận <strong>CPC</strong> cho mỗi lượt vượt link hoàn thành</li>
          <li>API key bị lộ → nhấn <strong>Đổi key</strong> ngay, key cũ sẽ mất hiệu lực</li>
          <li>Mỗi tài khoản chỉ có <strong>1 API key</strong></li>
          <li>Dùng <strong>/api/quicklink/v1/links</strong> và <strong>/v1/stats</strong> để theo dõi thống kê (cần header Authorization)</li>
        </ul>
      </div>
    </div>
  );
}
