import { useState, useEffect, useCallback } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import Breadcrumb from '../../components/Breadcrumb';
import { Code2, Copy, Check, Key, RefreshCw, Zap, Eye, EyeOff, Terminal, Link2 } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/Toast';

export default function WorkerApi() {
  usePageTitle('API Developer');
  const toast = useToast();

  const [keyData, setKeyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState('quicklink'); // 'quicklink' | 'developer'

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

  const TABS = [
    { key: 'quicklink', label: 'QuickLink', icon: Zap },
    { key: 'developer', label: 'Developer API', icon: Terminal },
  ];

  return (
    <div className="space-y-6 w-full min-w-0">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'API Developer' },
      ]} />


      {/* ── API Key Card ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center">
            <Key size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">API Key</h2>
            <p className="text-slate-400 text-xs">Sử dụng key này cho tất cả API requests</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-4">Đang tải...</p>
        ) : !keyData ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-400 mb-4">Chưa có API key. Tạo key để bắt đầu.</p>
            <button onClick={createKey} disabled={regenerating}
              className="px-6 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition disabled:opacity-50 inline-flex items-center gap-2">
              <Key size={15} /> {regenerating ? 'Đang tạo...' : 'Tạo API key'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-800/50 border border-slate-700 px-4 py-3 rounded-xl text-xs font-mono text-green-400 overflow-x-auto select-all">
                {showKey ? keyData.api_key : maskKey(keyData.api_key)}
              </code>
              <button onClick={() => setShowKey(!showKey)} title={showKey ? 'Ẩn' : 'Hiện'}
                className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition flex-shrink-0">
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => handleCopy(keyData.api_key, 'key')} title="Copy key"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition flex-shrink-0">
                {copied === 'key' ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
              <button onClick={regenerateKey} disabled={regenerating} title="Đổi key mới"
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex-shrink-0 disabled:opacity-50">
                <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} /> Đổi key
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: QuickLink ── */}
      {tab === 'quicklink' && (
        <>
          <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-200 p-5">
            <h3 className="text-sm font-black text-indigo-900 mb-2 flex items-center gap-2">
              <Zap size={16} className="text-indigo-500" /> QuickLink — Tạo link & redirect ngay
            </h3>
            <p className="text-xs text-indigo-700 mb-3">Chỉ cần 1 URL duy nhất, tự tạo shortlink và redirect:</p>
            <div className="bg-white rounded-xl border border-indigo-200 p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">GET</span>
              </div>
              <code className="block bg-slate-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                {`${BASE}/api/quicklink/st?api=`}<span className="text-yellow-300">{apiKey}</span>{`&url=`}<span className="text-cyan-300">https://example.com</span>
              </code>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
              {[
                { step: '1', title: 'Dán URL', desc: 'Thay url= bằng link đích', color: 'bg-indigo-500' },
                { step: '2', title: 'Auto tạo link', desc: 'Hệ thống tạo shortlink', color: 'bg-indigo-500' },
                { step: '3', title: 'Redirect', desc: 'Vượt link → nhận CPC', color: 'bg-green-500' },
              ].map(s => (
                <div key={s.step} className="bg-white/80 rounded-xl p-3 border border-indigo-100">
                  <div className={`w-7 h-7 rounded-full ${s.color} text-white font-black text-sm flex items-center justify-center mx-auto mb-1.5`}>{s.step}</div>
                  <p className="font-bold text-slate-800">{s.title}</p>
                  <p className="text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-indigo-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Zap size={14} className="text-indigo-500" /> Ví dụ sử dụng</h3>
              <button onClick={() => handleCopy(`${BASE}/api/quicklink/st?api=${apiKey}&url=https://example.com`, 'curl-st')}
                className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center gap-1">
                {copied === 'curl-st' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-1">Embed trong HTML:</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`<a href="${BASE}/api/quicklink/st?api=${apiKey}&url=https://example.com">
  Click để truy cập
</a>`}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-1">Redirect bằng PHP/JS:</p>
                <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`// PHP
header("Location: ${BASE}/api/quicklink/st?api=KEY&url=" . $url);

// JS
window.location = "${BASE}/api/quicklink/st?api=KEY&url=" + url;`}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Developer API ── */}
      {tab === 'developer' && (
        <>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-5">
            <h3 className="text-sm font-black text-blue-900 mb-2 flex items-center gap-2">
              <Terminal size={16} className="text-indigo-500" /> Developer API — Tạo link qua GET request
            </h3>
            <p className="text-xs text-blue-700 mb-3">Gửi 1 GET request đơn giản để tạo shortlink, nhận lại JSON hoặc text:</p>
            <div className="bg-white rounded-xl border border-blue-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">GET</span>
                <span className="text-xs font-semibold text-slate-600">Format:</span>
              </div>
              <code className="block bg-slate-900 text-green-400 rounded-lg p-3 text-xs font-mono overflow-x-auto">
                {`${BASE}/api/quicklink/api?api=`}<span className="text-yellow-300">{apiKey}</span>
                {`&url=`}<span className="text-cyan-300">yourdestinationlink.com</span>
                {`&alias=`}<span className="text-purple-300">CustomAlias</span>
              </code>
            </div>
          </div>

          {/* Parameters table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Code2 size={15} className="text-indigo-500" /> Parameters
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-100">
                    <th className="py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Param</th>
                    <th className="py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bắt buộc</th>
                    <th className="py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { param: 'api', required: true, desc: 'API key của bạn' },
                    { param: 'url', required: true, desc: 'URL đích cần rút gọn' },
                    { param: 'alias', required: false, desc: 'Custom alias (2-20 ký tự, a-z, 0-9, -, _)' },
                    { param: 'format', required: false, desc: '"text" để chỉ nhận URL rút gọn (không JSON)' },
                  ].map(p => (
                    <tr key={p.param} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5"><code className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">{p.param}</code></td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.required ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                          {p.required ? 'Bắt buộc' : 'Tùy chọn'}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">{p.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Response examples */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> JSON Response
                </h3>
                <button onClick={() => handleCopy(`${BASE}/api/quicklink/api?api=${apiKey}&url=google.com&alias=mylink`, 'dev-json')}
                  className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center gap-1">
                  {copied === 'dev-json' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy URL</>}
                </button>
              </div>
              <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap mb-3">
{`GET ${BASE}/api/quicklink/api?api=${apiKey}&url=google.com`}
              </pre>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`{
  "status": "success",
  "shortenedUrl": "${BASE}/vuot-link/abc1234",
  "slug": "abc1234",
  "destination": "https://google.com"
}`}
              </pre>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Text Response
                </h3>
                <button onClick={() => handleCopy(`${BASE}/api/quicklink/api?api=${apiKey}&url=google.com&format=text`, 'dev-text')}
                  className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center gap-1">
                  {copied === 'dev-text' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy URL</>}
                </button>
              </div>
              <pre className="bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap mb-3">
{`GET ${BASE}/api/quicklink/api?api=${apiKey}&url=google.com&format=text`}
              </pre>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 overflow-x-auto">
{`${BASE}/vuot-link/abc1234`}
              </pre>
              <p className="text-[10px] text-slate-400 mt-2">Chỉ trả về URL rút gọn, không có JSON wrapper. Nếu lỗi → trả chuỗi rỗng.</p>
            </div>
          </div>

          {/* Code examples */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Terminal size={15} className="text-purple-500" /> Code Examples
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-1">Python:</p>
                <pre className="bg-slate-900 text-green-400 rounded-xl p-3 text-[11px] overflow-x-auto">
{`import requests

r = requests.get("${BASE}/api/quicklink/api", params={
    "api": "${apiKey}",
    "url": "https://example.com",
    "alias": "my-custom-link"
})
print(r.json()["shortenedUrl"])`}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-1">JavaScript (fetch):</p>
                <pre className="bg-slate-900 text-green-400 rounded-xl p-3 text-[11px] overflow-x-auto">
{`const url = "${BASE}/api/quicklink/api" +
  "?api=${apiKey}" +
  "&url=https://example.com" +
  "&alias=my-link";

const res = await fetch(url);
const data = await res.json();
console.log(data.shortenedUrl);`}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── REST Endpoints (shared) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Link2 size={18} className="text-slate-500" /> REST Endpoints
        </h2>
        <p className="text-xs text-slate-400 mb-3">Thêm header: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px]">Authorization: Bearer YOUR_API_KEY</code></p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="py-2.5 font-medium text-[10px] uppercase tracking-wider w-16">Method</th>
                <th className="py-2.5 font-medium text-[10px] uppercase tracking-wider">Endpoint</th>
                <th className="py-2.5 font-medium text-[10px] uppercase tracking-wider">Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {[
                { method: 'GET', path: '/api/quicklink/st?api=KEY&url=URL', desc: 'Tạo link & redirect ngay', hl: true },
                { method: 'GET', path: '/api/quicklink/api?api=KEY&url=URL', desc: 'Developer API — trả JSON/text', hl: true },
                { method: 'GET', path: '/api/quicklink/v1/links', desc: 'Danh sách link (phân trang)' },
                { method: 'GET', path: '/api/quicklink/v1/links/:id', desc: 'Chi tiết 1 link' },
                { method: 'GET', path: '/api/quicklink/v1/stats', desc: 'Thống kê tổng' },
              ].map((ep, i) => (
                <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50/50 transition ${ep.hl ? 'bg-blue-50/30' : ''}`}>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">{ep.method}</span>
                  </td>
                  <td className="py-2.5 font-mono text-[11px] text-slate-700">{ep.hl ? <strong>{ep.path}</strong> : ep.path}</td>
                  <td className="py-2.5 text-xs text-slate-500">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-indigo-200 p-5">
        <h3 className="text-sm font-black text-indigo-900 mb-2">Lưu ý</h3>
        <ul className="text-xs text-amber-800 space-y-1.5 list-disc pl-4">
          <li>Dùng <strong>/api/quicklink/st</strong> để redirect ngay, hoặc <strong>/api/quicklink/api</strong> để lấy URL rút gọn qua JSON/text</li>
          <li>Nếu URL đã tạo trước đó → <strong>tái sử dụng</strong> shortlink cũ (không tạo trùng)</li>
          <li>Bạn nhận <strong>CPC</strong> cho mỗi lượt vượt link hoàn thành</li>
          <li>API key bị lộ → nhấn <strong>Đổi key</strong> ngay, key cũ sẽ mất hiệu lực</li>
          <li>Mỗi tài khoản chỉ có <strong>1 API key</strong></li>
        </ul>
      </div>
    </div>
  );
}
