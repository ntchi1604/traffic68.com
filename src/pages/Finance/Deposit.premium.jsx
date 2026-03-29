import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';
import { useToast } from '../../components/Toast';
import {
  Wallet, Gift, Banknote, ArrowRight, ArrowLeftRight,
  Info, LogOut, X, Copy, Check,
  CreditCard, PiggyBank, Coins
} from 'lucide-react';
import api from '../../lib/api';
import Breadcrumb from '../../components/Breadcrumb';

const UsdtIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="16" fill="#26A17B" />
    <path d="M17.9 17.05v-.03c-.1 0-.71.04-2 .04-1 0-1.72-.04-1.96-.04v.03c-3.47-.15-6.06-.8-6.06-1.58 0-.78 2.59-1.43 6.06-1.58v2.52c.25.02.98.06 1.98.06 1.2 0 1.77-.05 1.98-.06v-2.52c3.46.15 6.04.8 6.04 1.58 0 .78-2.58 1.43-6.04 1.58zm0-3.42V11.5h4.46V8.5H9.63v3h4.43v2.13c-3.93.18-6.88 1.02-6.88 2.02s2.95 1.84 6.88 2.02v7.23h3.84v-7.23c3.91-.18 6.85-1.02 6.85-2.02s-2.94-1.84-6.85-2.02z" fill="#fff" />
  </svg>
);

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">{value}</span>
        <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
}

export default function Deposit() {
  usePageTitle('Nạp tiền');
  const toast = useToast();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState({ traffic: { balance: 0 }, commission: { balance: 0 } });
  const [depositConfig, setDepositConfig] = useState(null);
  const [method, setMethod] = useState('bank');
  const [amount, setAmount] = useState('');
  const [modal, setModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n);

  // ── Methods ──
  const bankEnabled = depositConfig?.bank?.enabled;
  const cryptoEnabled = depositConfig?.crypto?.enabled;
  const trc20Enabled = depositConfig?.trc20?.enabled;
  const methods = [
    ...(bankEnabled ? [{ key: 'bank', label: 'Chuyển khoản', icon: <Banknote size={18} className="text-blue-500" /> }] : []),
    ...(cryptoEnabled ? [{ key: 'bep20', label: 'Nạp USDT BEP20', icon: <Coins size={18} className="text-emerald-500" /> }] : []),
    ...(trc20Enabled ? [{ key: 'trc20', label: 'Nạp USDT TRC20', icon: <Coins size={18} className="text-red-500" /> }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <Breadcrumb items={[
        { label: 'Dashboard', to: '/buyer/dashboard' },
        { label: 'Tài chính', to: '/buyer/dashboard/finance' },
        { label: 'Nạp tiền' }
      ]} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nạp tiền</h1>
        <p className="text-gray-600">Quản lý số dư ví Traffic và ví Hoa hồng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Phương thức nạp tiền</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {methods.map(m => (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                    method === m.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}>
                  <div className="mb-2">{m.icon}</div>
                  <span className="text-sm font-medium text-gray-700">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nhập số tiền</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2">Số tiền nạp (VNĐ)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Nhập số tiền (VNĐ)"
                  min="10000"
                  step="1000"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(q => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm font-medium transition">
                    {fmt(q)} đ
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={processing || Number(amount) < 10000}
            className="w-full flex items-center justify-center gap-2 py-3.5 font-black text-white text-base rounded-2xl
              bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg shadow-blue-200
              transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
            {processing
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Đang xử lý...</>
              : (method === 'bep20' || method === 'trc20')
                ? <><UsdtIcon size={18} />Tạo đơn nạp Crypto<ArrowRight size={16} /></>
                : <><Wallet size={16} />Nạp vào Ví Traffic<ArrowRight size={16} /></>
            }
          </button>
        </div>

        <div className="space-y-4">
          {!depositConfig && methods.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
              <p className="text-amber-700 font-bold mb-1">Chưa có phương thức nạp tiền nào được bật</p>
              <p className="text-xs text-amber-600">Vui lòng liên hệ admin để được hỗ trợ nạp tiền.</p>
            </div>
          )}

          {depositConfig?.bank && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <Banknote size={14} className="text-blue-500" /> Thông tin chuyển khoản
              </h3>
              <div className="space-y-0.5 divide-y divide-gray-100">
                <CopyField label="Ngân hàng" value={depositConfig.bank.bankName} />
                <CopyField label="Số TK" value={depositConfig.bank.accountNumber} />
                <CopyField label="Chủ TK" value={depositConfig.bank.accountHolder} />
                {depositConfig.bank.branch && <CopyField label="Chi nhánh" value={depositConfig.bank.branch} />}
              </div>
            </div>
          )}

          {(cryptoEnabled || trc20Enabled) && (
            <div className={`bg-white rounded-2xl border ${method === 'trc20' ? 'border-red-200' : 'border-emerald-200'} shadow-sm p-5`}>
              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                <UsdtIcon size={16} /> Nạp Crypto
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mạng</span>
                  <span className={`font-bold ${method === 'trc20' ? 'text-red-600' : 'text-gray-800'}`}>
                    {method === 'trc20' ? 'Tron (TRC20)' : 'BSC (BEP20)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Token</span>
                  <span className={`font-bold ${method === 'trc20' ? 'text-red-500' : 'text-emerald-600'}`}>USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tỷ giá</span>
                  <span className="font-bold text-gray-800">1 USDT ≈ {fmt(depositConfig?.rate || 25500)} VNĐ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Xác nhận</span>
                  <span className={`font-bold ${(method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {(method === 'trc20' ? depositConfig?.trc20?.auto : depositConfig?.crypto?.auto) ? '⚡ Tự động' : '⏳ Thủ công'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Info size={13} /> Lưu ý quan trọng</p>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>• Nạp tối thiểu <strong>10.000 VNĐ</strong></li>
              {bankEnabled && <li>• Chuyển khoản: Admin xác nhận trong <strong>5-15 phút</strong></li>}
              {(cryptoEnabled || trc20Enabled) && (depositConfig?.crypto?.auto || depositConfig?.trc20?.auto) && (
                <li>• Crypto: Tự động xác nhận sau <strong>1-3 phút</strong></li>
              )}
              <li>• Chuyển ví HH → Traffic: <strong>ngay lập tức</strong></li>
              {cryptoEnabled && (
                <li>• <strong className="text-red-600">Chỉ gửi USDT trên BSC (BEP20)</strong></li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}