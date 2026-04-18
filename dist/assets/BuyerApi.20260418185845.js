import{r as e}from"./rolldown-runtime.20260418185845.js";import{g as t}from"./vendor-charts.20260418185845.js";import{t as n}from"./vendor-react.20260418185845.js";import{B as r,Bt as i,Ht as a,Mt as o,Nt as s,en as c,in as l,pn as u,rn as d,t as f,vt as p}from"./vendor-icons.20260418185845.js";import{t as m}from"./api.20260418185845.js";import{a as h,o as g}from"./index.20260418185845.js";import{t as _}from"./Breadcrumb.20260418185845.js";var v=e(t(),1),y=n();function b(){let[e,t]=(0,v.useState)(null);return{copied:e,copy:(e,n)=>{navigator.clipboard.writeText(e),t(n),setTimeout(()=>t(null),2e3)}}}function x({method:e,path:t,desc:n,children:r}){let[i,a]=(0,v.useState)(!1);return(0,y.jsxs)(`div`,{className:`border border-slate-200 rounded-xl overflow-hidden`,children:[(0,y.jsxs)(`button`,{onClick:()=>a(!i),className:`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left`,children:[(0,y.jsx)(`span`,{className:`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${{GET:`bg-green-100 text-green-700`,POST:`bg-blue-100 text-blue-700`,PUT:`bg-amber-100 text-amber-700`,DELETE:`bg-red-100 text-red-700`}[e]||`bg-slate-100 text-slate-700`}`,children:e}),(0,y.jsx)(`code`,{className:`text-xs font-mono text-slate-700 flex-1`,children:t}),(0,y.jsx)(`span`,{className:`text-xs text-slate-400 hidden sm:block mr-2`,children:n}),i?(0,y.jsx)(c,{size:14,className:`text-slate-400 shrink-0`}):(0,y.jsx)(d,{size:14,className:`text-slate-400 shrink-0`})]}),i&&(0,y.jsx)(`div`,{className:`px-4 pb-4 border-t border-slate-100 pt-3 space-y-3`,children:r})]})}function S({children:e,lang:t=`json`,id:n,copy:r,copied:a}){return(0,y.jsxs)(`div`,{className:`relative`,children:[(0,y.jsx)(`pre`,{className:`bg-slate-900 text-green-400 rounded-xl p-4 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap`,children:e}),r&&(0,y.jsx)(`button`,{onClick:()=>r(e,n),className:`absolute top-2 right-2 p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition`,children:a===n?(0,y.jsx)(l,{size:12,className:`text-green-400`}):(0,y.jsx)(i,{size:12,className:`text-slate-400`})})]})}function C({name:e,type:t,required:n,desc:r}){return(0,y.jsxs)(`tr`,{className:`border-b border-slate-50 text-xs`,children:[(0,y.jsx)(`td`,{className:`py-2 pr-3`,children:(0,y.jsx)(`code`,{className:`px-1.5 py-0.5 bg-slate-100 rounded font-bold text-slate-700`,children:e})}),(0,y.jsx)(`td`,{className:`py-2 pr-3 text-slate-400 font-mono`,children:t}),(0,y.jsx)(`td`,{className:`py-2 pr-3`,children:(0,y.jsx)(`span`,{className:`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${n?`bg-red-50 text-red-600`:`bg-slate-100 text-slate-500`}`,children:n?`required`:`optional`})}),(0,y.jsx)(`td`,{className:`py-2 text-slate-500`,children:r})]})}function w(){g(`Buyer API`);let e=h(),{copied:t,copy:n}=b(),[c,d]=(0,v.useState)(null),[w,T]=(0,v.useState)(!0),[E,D]=(0,v.useState)(!1),[O,k]=(0,v.useState)(!1),A=(0,v.useCallback)(async()=>{try{d((await m.get(`/quicklink/key`)).key||null)}catch(e){console.error(e)}finally{T(!1)}},[]);(0,v.useEffect)(()=>{A()},[A]);let j=async()=>{D(!0);try{d((await m.post(`/quicklink/key`)).key),k(!0),e.success(`Tạo API key thành công!`)}catch(t){e.error(t.message)}finally{D(!1)}},M=async()=>{if(await e.confirm(`Đổi API key? Key cũ sẽ ngừng hoạt động ngay lập tức.`)){D(!0);try{d((await m.put(`/quicklink/key`)).key),k(!0),e.success(`Đã đổi API key!`)}catch(t){e.error(t.message)}finally{D(!1)}}},N=e=>e?e.slice(0,10)+`•`.repeat(e.length-14)+e.slice(-4):``,P=window.location.origin,F=c?.api_key||`YOUR_API_KEY`,I=`Authorization: Bearer ${F}`;return(0,y.jsxs)(`div`,{className:`space-y-6 w-full min-w-0`,children:[(0,y.jsx)(_,{items:[{label:`Dashboard`,to:`/buyer/dashboard`},{label:`Buyer API`}]}),(0,y.jsxs)(`div`,{className:`bg-white rounded-2xl border border-slate-200 shadow-sm p-6`,children:[(0,y.jsxs)(`div`,{className:`flex items-center gap-3 mb-4`,children:[(0,y.jsx)(`div`,{className:`w-10 h-10 rounded-xl flex items-center justify-center`,style:{background:`linear-gradient(135deg, #6366f1, #8b5cf6)`,boxShadow:`0 4px 12px rgba(99,102,241,0.25)`},children:(0,y.jsx)(p,{size:18,className:`text-white`})}),(0,y.jsxs)(`div`,{children:[(0,y.jsx)(`h2`,{className:`font-bold text-base text-slate-900`,children:`API Key`}),(0,y.jsxs)(`p`,{className:`text-slate-400 text-[11px]`,children:[`Thêm vào header: `,(0,y.jsx)(`code`,{className:`text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded`,children:`Authorization: Bearer KEY`})]})]})]}),w?(0,y.jsx)(`div`,{className:`flex justify-center py-6`,children:(0,y.jsx)(`div`,{className:`w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin`})}):c?(0,y.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,y.jsx)(`code`,{className:`flex-1 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-xs font-mono text-indigo-700 overflow-x-auto select-all`,children:O?c.api_key:N(c.api_key)}),(0,y.jsx)(`button`,{onClick:()=>k(!O),className:`p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition shrink-0`,children:O?(0,y.jsx)(s,{size:16}):(0,y.jsx)(o,{size:16})}),(0,y.jsx)(`button`,{onClick:()=>n(c.api_key,`key`),className:`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-white rounded-lg transition shrink-0`,style:{background:`linear-gradient(135deg, #6366f1, #8b5cf6)`},children:t===`key`?(0,y.jsxs)(y.Fragment,{children:[(0,y.jsx)(l,{size:14}),` Copied`]}):(0,y.jsxs)(y.Fragment,{children:[(0,y.jsx)(i,{size:14}),` Copy`]})}),(0,y.jsxs)(`button`,{onClick:M,disabled:E,className:`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition shrink-0 disabled:opacity-50`,children:[(0,y.jsx)(r,{size:14,className:E?`animate-spin`:``}),` Đổi key`]})]}):(0,y.jsxs)(`div`,{className:`text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200`,children:[(0,y.jsx)(p,{size:28,className:`text-slate-300 mx-auto mb-3`}),(0,y.jsx)(`p`,{className:`text-sm text-slate-500 mb-3`,children:`Chưa có API key. Tạo key để bắt đầu.`}),(0,y.jsxs)(`button`,{onClick:j,disabled:E,className:`px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 inline-flex items-center gap-2`,style:{background:`linear-gradient(135deg, #6366f1, #8b5cf6)`,boxShadow:`0 4px 12px rgba(99,102,241,0.3)`},children:[(0,y.jsx)(p,{size:14}),` `,E?`Đang tạo...`:`Tạo API key`]})]})]}),(0,y.jsxs)(`div`,{className:`bg-white rounded-2xl border border-indigo-100 p-5`,children:[(0,y.jsxs)(`h3`,{className:`text-sm font-bold text-slate-800 mb-2 flex items-center gap-2`,children:[(0,y.jsx)(f,{size:15,className:`text-indigo-500`}),` Quick Start`]}),(0,y.jsxs)(`p`,{className:`text-xs text-slate-500 mb-3`,children:[`Base URL: `,(0,y.jsxs)(`code`,{className:`font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded`,children:[P,`/api/buyer/v1`]})]}),(0,y.jsx)(S,{id:`qs`,copy:n,copied:t,children:`curl ${P}/api/buyer/v1/me \\
  -H "Authorization: Bearer ${F}"
`})]}),(0,y.jsxs)(`div`,{className:`bg-white rounded-2xl border border-slate-200 p-5 space-y-3`,children:[(0,y.jsxs)(`h2`,{className:`text-lg font-bold text-slate-900 flex items-center gap-2`,children:[(0,y.jsx)(u,{size:18,className:`text-slate-500`}),` API Reference`]}),(0,y.jsxs)(x,{method:`GET`,path:`/api/buyer/v1/me`,desc:`Tài khoản + số dư`,children:[(0,y.jsx)(`p`,{className:`text-xs text-slate-500`,children:`Lấy thông tin tài khoản và số dư ví.`}),(0,y.jsx)(S,{id:`me-req`,copy:n,copied:t,children:`curl ${P}/api/buyer/v1/me \\
  -H "${I}"`}),(0,y.jsx)(S,{id:`me-res`,children:`{
  "user": { "id": 42, "name": "Nguyễn A", "email": "a@example.com" },
  "wallet": {
    "main_balance": 500000,
    "earning_balance": 0
  },
  "campaigns": {
    "total": 5, "running": 2, "paused": 1, "completed": 2,
    "total_budget_allocated": 3000000
  }
}`})]}),(0,y.jsxs)(x,{method:`GET`,path:`/api/buyer/v1/pricing`,desc:`Bảng giá`,children:[(0,y.jsx)(S,{id:`pricing-req`,copy:n,copied:t,children:`curl ${P}/api/buyer/v1/pricing \\
  -H "${I}"`}),(0,y.jsx)(S,{id:`pricing-res`,children:`{
  "pricing": {
    "google_search": [
      { "duration_seconds": 60, "price_v1_per_view": 50, "price_v2_per_view": 80 },
      { "duration_seconds": 120, "price_v1_per_view": 90, "price_v2_per_view": 140 }
    ],
    "direct": [...]
  },
  "currency": "VND"
}`})]}),(0,y.jsxs)(x,{method:`GET`,path:`/api/buyer/v1/campaigns`,desc:`Danh sách chiến dịch`,children:[(0,y.jsxs)(`p`,{className:`text-xs text-slate-500 mb-2`,children:[`Query params: `,(0,y.jsx)(`code`,{className:`bg-slate-100 px-1 rounded font-mono text-[10px]`,children:`status=running|paused|completed`}),`, `,(0,y.jsx)(`code`,{className:`bg-slate-100 px-1 rounded font-mono text-[10px]`,children:`page`}),`, `,(0,y.jsx)(`code`,{className:`bg-slate-100 px-1 rounded font-mono text-[10px]`,children:`limit`})]}),(0,y.jsx)(S,{id:`list-req`,copy:n,copied:t,children:`curl "${P}/api/buyer/v1/campaigns?status=running&page=1&limit=20" \\
  -H "${I}"`}),(0,y.jsx)(S,{id:`list-res`,children:`{
  "campaigns": [
    {
      "id": 1, "name": "SEO Game Bài", "url": "https://example.com",
      "traffic_type": "google_search", "version": "v1",
      "status": "running", "total_views": 1000,
      "budget": 50000, "cpc": 50,
      "completed_views": 312, "cost_spent": 15600
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}`})]}),(0,y.jsxs)(x,{method:`POST`,path:`/api/buyer/v1/campaigns`,desc:`Tạo chiến dịch mới`,children:[(0,y.jsxs)(`table`,{className:`w-full text-xs mb-3`,children:[(0,y.jsx)(`thead`,{children:(0,y.jsxs)(`tr`,{className:`text-left text-[10px] text-slate-400 uppercase border-b`,children:[(0,y.jsx)(`th`,{className:`pb-1.5 pr-2`,children:`Field`}),(0,y.jsx)(`th`,{className:`pb-1.5 pr-2`,children:`Type`}),(0,y.jsx)(`th`,{className:`pb-1.5 pr-2`,children:`Required`}),(0,y.jsx)(`th`,{className:`pb-1.5`,children:`Mô tả`})]})}),(0,y.jsxs)(`tbody`,{children:[(0,y.jsx)(C,{name:`name`,type:`string`,required:!0,desc:`Tên chiến dịch`}),(0,y.jsx)(C,{name:`url`,type:`string`,required:!0,desc:`URL trang cần tăng traffic`}),(0,y.jsx)(C,{name:`traffic_type`,type:`string`,required:!0,desc:`google_search | direct | social`}),(0,y.jsx)(C,{name:`total_views`,type:`number`,required:!0,desc:`Tổng lượt xem (min 100)`}),(0,y.jsx)(C,{name:`duration`,type:`number`,required:!0,desc:`Thời gian xem (giây). Xem /pricing để biết các mốc hợp lệ`}),(0,y.jsx)(C,{name:`version`,type:`string`,desc:`v1 (default) | v2 — kiểu traffic`}),(0,y.jsx)(C,{name:`keyword`,type:`string`,desc:`Từ khóa tìm kiếm (cho google_search)`}),(0,y.jsx)(C,{name:`daily_views`,type:`number`,desc:`Số lượt tối đa mỗi ngày (default 500)`}),(0,y.jsx)(C,{name:`url2`,type:`string`,desc:`URL trang phụ (v2 multi-step)`})]})]}),(0,y.jsx)(S,{id:`create-req`,copy:n,copied:t,children:`curl -X POST ${P}/api/buyer/v1/campaigns \\
  -H "${I}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "SEO từ khóa game bài",
    "url": "https://example.com",
    "traffic_type": "google_search",
    "keyword": "game bài đổi thưởng",
    "total_views": 1000,
    "duration": 60,
    "version": "v1"
  }'`}),(0,y.jsx)(S,{id:`create-res`,children:`{
  "message": "Campaign created successfully",
  "campaign": {
    "id": 7, "name": "SEO từ khóa game bài",
    "status": "running", "total_views": 1000,
    "budget": 50000, "cpc": 50, "currency": "VND",
    "note": "Budget is deducted as views are completed, not upfront."
  }
}`})]}),(0,y.jsxs)(x,{method:`GET`,path:`/api/buyer/v1/campaigns/:id`,desc:`Chi tiết + stats`,children:[(0,y.jsx)(S,{id:`detail-req`,copy:n,copied:t,children:`curl ${P}/api/buyer/v1/campaigns/7 \\
  -H "${I}"`}),(0,y.jsx)(S,{id:`detail-res`,children:`{
  "id": 7, "name": "SEO từ khóa game bài",
  "status": "running", "budget": 50000, "cpc": 50,
  "stats": {
    "completed_views": 312,
    "expired": 44,
    "bot_blocked": 5,
    "cost_spent": 15600,
    "remaining_budget": 34400
  }
}`})]}),(0,y.jsx)(x,{method:`PUT`,path:`/api/buyer/v1/campaigns/:id/status`,desc:`Pause / Resume`,children:(0,y.jsx)(S,{id:`status-req`,copy:n,copied:t,children:`# Dừng chiến dịch
curl -X PUT ${P}/api/buyer/v1/campaigns/7/status \\
  -H "${I}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "paused"}'

# Tiếp tục
curl -X PUT ${P}/api/buyer/v1/campaigns/7/status \\
  -H "${I}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "running"}'`})}),(0,y.jsxs)(x,{method:`GET`,path:`/api/buyer/v1/campaigns/:id/stats`,desc:`Thống kê theo ngày`,children:[(0,y.jsxs)(`p`,{className:`text-xs text-slate-500 mb-2`,children:[`Query params: `,(0,y.jsx)(`code`,{className:`bg-slate-100 px-1 rounded font-mono text-[10px]`,children:`days=7`}),` (max 30)`]}),(0,y.jsx)(S,{id:`stats-req`,copy:n,copied:t,children:`curl "${P}/api/buyer/v1/campaigns/7/stats?days=7" \\
  -H "${I}"`}),(0,y.jsx)(S,{id:`stats-res`,children:`{
  "campaign_id": 7,
  "days": 7,
  "daily": [
    { "date": "2026-03-27", "completed_views": 80, "expired": 5, "bot_blocked": 1, "cost": 4000 },
    { "date": "2026-03-26", "completed_views": 95, "expired": 7, "bot_blocked": 0, "cost": 4750 }
  ],
  "totals": { "completed_views": 312, "cost": 15600 }
}`})]})]}),(0,y.jsxs)(`div`,{className:`bg-white rounded-2xl border border-slate-200 p-5`,children:[(0,y.jsxs)(`h2`,{className:`text-sm font-bold text-slate-900 mb-3 flex items-center gap-2`,children:[(0,y.jsx)(a,{size:15,className:`text-slate-500`}),` HTTP Status Codes`]}),(0,y.jsx)(`div`,{className:`overflow-x-auto`,children:(0,y.jsxs)(`table`,{className:`w-full text-xs`,children:[(0,y.jsx)(`thead`,{children:(0,y.jsxs)(`tr`,{className:`text-left text-slate-400 text-[10px] uppercase border-b border-slate-100`,children:[(0,y.jsx)(`th`,{className:`py-2 pr-4`,children:`Code`}),(0,y.jsx)(`th`,{className:`py-2 pr-4`,children:`Ý nghĩa`}),(0,y.jsx)(`th`,{className:`py-2`,children:`Khi nào`})]})}),(0,y.jsx)(`tbody`,{children:[[`200`,`OK`,`Thành công`],[`201`,`Created`,`Tạo chiến dịch thành công`],[`400`,`Bad Request`,`Thiếu/sai tham số (name, url, traffic_type...)`],[`401`,`Unauthorized`,`Thiếu hoặc sai API key`],[`402`,`Payment Required`,`Số dư ví không đủ để tạo chiến dịch`],[`403`,`Forbidden`,`Tài khoản bị khóa`],[`404`,`Not Found`,`Chiến dịch không tồn tại hoặc không thuộc tài khoản`],[`500`,`Server Error`,`Lỗi hệ thống`]].map(([e,t,n])=>(0,y.jsxs)(`tr`,{className:`border-b border-slate-50`,children:[(0,y.jsx)(`td`,{className:`py-2 pr-4`,children:(0,y.jsx)(`span`,{className:`px-2 py-0.5 rounded font-bold text-[10px] ${e.startsWith(`2`)?`bg-green-100 text-green-700`:e.startsWith(`4`)?`bg-red-50 text-red-600`:`bg-amber-50 text-amber-700`}`,children:e})}),(0,y.jsx)(`td`,{className:`py-2 pr-4 font-semibold text-slate-700`,children:t}),(0,y.jsx)(`td`,{className:`py-2 text-slate-500`,children:n})]},e))})]})})]}),(0,y.jsxs)(`div`,{className:`bg-white rounded-2xl border border-indigo-100 p-5`,children:[(0,y.jsx)(`h3`,{className:`text-sm font-bold text-slate-800 mb-2`,children:`Lưu ý quan trọng`}),(0,y.jsxs)(`ul`,{className:`text-xs text-slate-600 space-y-1.5 list-disc pl-4`,children:[(0,y.jsxs)(`li`,{children:[`Budget `,(0,y.jsx)(`strong`,{children:`không bị trừ ngay`}),` khi tạo chiến dịch — trừ dần theo từng lượt xem hoàn thành.`]}),(0,y.jsxs)(`li`,{children:[`Dùng `,(0,y.jsx)(`code`,{className:`bg-indigo-50 text-indigo-700 px-1 rounded font-mono`,children:`/v1/pricing`}),` để lấy `,(0,y.jsx)(`code`,{className:`bg-indigo-50 text-indigo-700 px-1 rounded font-mono`,children:`duration`}),` hợp lệ trước khi tạo chiến dịch.`]}),(0,y.jsxs)(`li`,{children:[`API key `,(0,y.jsx)(`strong`,{children:`dùng chung`}),` với Worker API (cùng bảng `,(0,y.jsx)(`code`,{className:`bg-indigo-50 text-indigo-700 px-1 rounded font-mono`,children:`api_keys`}),`). Nếu đổi key, cả 2 đều thay đổi.`]}),(0,y.jsxs)(`li`,{children:[`Mỗi tài khoản chỉ có `,(0,y.jsx)(`strong`,{children:`1 API key`}),`.`]}),(0,y.jsxs)(`li`,{children:[`Rate limit: `,(0,y.jsx)(`strong`,{children:`1000 requests/giờ`}),` (sắp ra mắt).`]})]})]})]})}export{w as default};