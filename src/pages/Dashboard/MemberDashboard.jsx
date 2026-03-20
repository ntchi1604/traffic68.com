import { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LabelList,
} from 'recharts';
import { Eye, TrendingUp, Zap, Wallet } from 'lucide-react';
import Breadcrumb from '../../components/Breadcrumb';

/* ─── Dummy Data ────────────────────────────────────── */
const earningsData = [
  { day: 'T5', value: 20000, label: '20k' },
  { day: 'T6', value: 35000, label: '35k' },
  { day: 'T7', value: 25000, label: '25k' },
  { day: 'T3', value: 20000, label: '20k' },
  { day: 'T4', value: 25000, label: '25k' },
  { day: 'T5', value: 20000, label: '20k' },
  { day: 'T6', value: 18000, label: '18k' },
];

const deviceData = [
  { name: 'Điện thoại', value: 65, color: '#3B82F6' },
  { name: 'Máy tính', value: 35, color: '#F97316' },
];

const completionData = [
  { name: 'Web', value: 35 },
  { name: 'App', value: 29 },
  { name: 'SEO', value: 24 },
  { name: 'Social', value: 24 },
  { name: 'Khác', value: 3 },
];

const recentTasks = [
  { id: 1, name: 'Traffic user Web Shopee', status: 'done', earning: '2.500 đ' },
  { id: 2, name: 'Traffic user Web Lazada', status: 'done', earning: '3.000 đ' },
  { id: 3, name: 'Traffic user Web Tiki', status: 'pending', earning: '1.500 đ' },
  { id: 4, name: 'Traffic user App MoMo', status: 'done', earning: '2.000 đ' },
  { id: 5, name: 'Traffic user Web Sendo', status: 'failed', earning: '0 đ' },
  { id: 6, name: 'Traffic user Web FPT Shop', status: 'done', earning: '2.500 đ' },
];

const STAT_CARDS = [
  {
    label: 'Nhiệm vụ hoàn thành hôm nay',
    value: '15 nhiệm vụ',
    subtext: 'Hôm nay',
    Icon: Eye,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentGradient: 'from-blue-500 to-blue-600',
  },
  {
    label: 'Tổng số nhiệm vụ đã làm',
    value: '324 nhiệm vụ',
    subtext: 'Tổng cộng',
    Icon: TrendingUp,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    accentGradient: 'from-green-500 to-green-600',
  },
  {
    label: 'Nhiệm vụ đang xử lý',
    value: '2 nhiệm vụ',
    subtext: 'Chờ duyệt',
    Icon: Zap,
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    accentGradient: 'from-orange-400 to-orange-500',
  },
  {
    label: 'Thu nhập khả dụng',
    value: '450.750 đ',
    subtext: 'Ví tiền của tôi',
    Icon: Wallet,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    accentGradient: 'from-purple-500 to-purple-600',
  },
];

/* ─── Custom Tooltip ────────────────────────────────── */
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xl">
      <p className="text-sm font-bold text-slate-800">
        {Number(payload[0].value).toLocaleString('vi-VN')} đ
      </p>
    </div>
  );
}

/* ─── Custom Label on AreaChart dots ────────────────── */
function CustomDot(props) {
  const { cx, cy, payload } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#F97316" stroke="#fff" strokeWidth={2.5} />
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fill="#f97316"
        fontSize={11}
        fontWeight={700}
      >
        {payload.label}
      </text>
    </g>
  );
}

/* ─── Status Badge ──────────────────────────────────── */
function StatusBadge({ status }) {
  const config = {
    done: { label: 'Hoàn thành', bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-500/20' },
    pending: { label: 'Chờ duyệt', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-500/20' },
    failed: { label: 'Thất bại', bg: 'bg-red-50', text: 'text-red-500', ring: 'ring-red-500/20' },
  };
  const c = config[status] || config.done;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text} ring-1 ${c.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'done' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {c.label}
    </span>
  );
}

/* ─── MAIN COMPONENT ────────────────────────────────── */
export default function MemberDashboard() {
  usePageTitle('Dashboard Thành Viên');

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* ── Breadcrumb ── */}
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/worker/dashboard' },
        { label: 'Tổng quan thành viên' },
      ]} />

      {/* ── Page Title ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Dashboard Thành Viên
        </h1>
        <p className="text-slate-500 text-sm mt-1">Tổng quan hoạt động và thu nhập của bạn</p>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 min-w-0">
        {STAT_CARDS.map(({ label, value, subtext, Icon, iconBg, iconColor, accentGradient }, i) => (
          <div
            key={i}
            className="group relative bg-white rounded-xl border border-slate-200/80 p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
          >
            {/* Accent top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <Icon size={22} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{subtext}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Earnings Chart ═══ */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-6 min-w-0 hover:shadow-md transition-shadow duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Thu nhập 7 ngày qua</h2>
            <p className="text-xs text-slate-400 mt-0.5">Biểu đồ thu nhập hàng ngày từ nhiệm vụ</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-orange-400" />
              <span className="text-slate-500">Thu nhập (VNĐ)</span>
            </span>
          </div>
        </div>
        <div className="h-64 sm:h-72 w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={earningsData} margin={{ left: 0, right: 20, top: 30, bottom: 0 }}>
              <defs>
                <linearGradient id="orangeGradientFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              <YAxis
                width={44}
                tick={{ fill: '#94A3B8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                name="Thu nhập"
                stroke="#F97316"
                fill="url(#orangeGradientFill)"
                strokeWidth={2.5}
                dot={<CustomDot />}
                activeDot={{ r: 7, fill: '#EA580C', stroke: '#fff', strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ Bottom Analytics Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">

        {/* ── Recent Tasks Table ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 min-w-0 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
            Chi tiết nhiệm vụ gần đây
          </h3>
          <div className="overflow-x-auto w-full min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 font-medium text-xs uppercase tracking-wider">Tên Nhiệm Vụ</th>
                  <th className="py-2.5 font-medium text-xs uppercase tracking-wider">Trạng thái</th>
                  <th className="py-2.5 font-medium text-xs uppercase tracking-wider text-right">Thu nhập</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 font-medium text-slate-700 text-xs">{task.name}</td>
                    <td className="py-3"><StatusBadge status={task.status} /></td>
                    <td className="py-3 text-right font-bold text-slate-800 text-xs">{task.earning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Device Distribution Donut ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 min-w-0 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-orange-500 rounded-full" />
            Phân bổ nhiệm vụ theo thiết bị
          </h3>
          <div className="h-48 sm:h-52 flex items-center justify-center w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  cornerRadius={4}
                  stroke="none"
                >
                  {deviceData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value}%`, '']}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2.5">
            {deviceData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm text-slate-600">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Completion Rate Bar Chart ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 min-w-0 hover:shadow-md transition-shadow duration-300">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-indigo-500 rounded-full" />
            Tỷ lệ hoàn thành theo loại
          </h3>
          <div className="h-48 sm:h-52 w-full overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionData} margin={{ left: -10, right: 10, top: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={32}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 20px rgba(0,0,0,.08)',
                  }}
                />
                <Bar dataKey="value" name="Hoàn thành" radius={[8, 8, 0, 0]} fill="#3B82F6" barSize={36}>
                  <LabelList dataKey="value" position="top" fill="#3B82F6" fontSize={12} fontWeight={700} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
