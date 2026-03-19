import { createContext, useContext, useState } from 'react';

/* ─────────────────────────────────────────────────────────
   Mock data — replace with real API calls later
───────────────────────────────────────────────────────── */
const INITIAL_WALLETS = {
  main: {
    balance: 1000000,    // VNĐ — dùng để mua traffic
    transactions: [
      { id: 1, type: 'deposit',   label: 'Nạp tiền (Momo)',            amount: 5000000, date: '2026-03-15', ref: 'MM-20260315-001' },
      { id: 2, type: 'spend',     label: 'Mua traffic – Campaign #12', amount: -1200000, date: '2026-03-14', ref: 'SYS-20260314-001' },
      { id: 3, type: 'deposit',   label: 'Nạp tiền (Chuyển khoản)',    amount: 3000000, date: '2026-03-13', ref: 'VCB-20260313-002' },
      { id: 4, type: 'spend',     label: 'Mua traffic – Campaign #11', amount: -850000, date: '2026-03-12', ref: 'SYS-20260312-003' },
    ],
  },
  commission: {
    balance: 1000000,    // VNĐ — nhận từ hoa hồng giới thiệu
    transactions: [
      { id: 1, type: 'commission', label: 'Hoa hồng ref – user_abc123', amount: 75000,  date: '2026-03-16', ref: 'REF-20260316-001' },
      { id: 2, type: 'commission', label: 'Hoa hồng ref – user_xyz789', amount: 120000, date: '2026-03-14', ref: 'REF-20260314-002' },
      { id: 3, type: 'withdraw',   label: 'Rút hoa hồng (Momo)',        amount: -100000, date: '2026-03-10', ref: 'WD-20260310-001' },
    ],
  },
};

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallets, setWallets] = useState(INITIAL_WALLETS);

  /** Nạp tiền vào ví chính */
  const depositMain = (amount) => {
    setWallets(w => ({
      ...w,
      main: {
        balance: w.main.balance + amount,
        transactions: [
          {
            id: Date.now(),
            type: 'deposit',
            label: 'Nạp tiền',
            amount,
            date: new Date().toISOString().slice(0, 10),
            ref: `DEP-${Date.now()}`,
          },
          ...w.main.transactions,
        ],
      },
    }));
  };

  /** Trừ tiền ví chính khi mua traffic */
  const spendMain = (amount, label = 'Mua dịch vụ traffic') => {
    setWallets(w => ({
      ...w,
      main: {
        balance: Math.max(0, w.main.balance - amount),
        transactions: [
          {
            id: Date.now(),
            type: 'spend',
            label,
            amount: -amount,
            date: new Date().toISOString().slice(0, 10),
            ref: `SYS-${Date.now()}`,
          },
          ...w.main.transactions,
        ],
      },
    }));
  };

  /** Nhận hoa hồng vào ví hoa hồng */
  const addCommission = (amount, refUser = 'user') => {
    setWallets(w => ({
      ...w,
      commission: {
        balance: w.commission.balance + amount,
        transactions: [
          {
            id: Date.now(),
            type: 'commission',
            label: `Hoa hồng ref – ${refUser}`,
            amount,
            date: new Date().toISOString().slice(0, 10),
            ref: `REF-${Date.now()}`,
          },
          ...w.commission.transactions,
        ],
      },
    }));
  };

  /** Rút hoa hồng về tài khoản ngoài */
  const withdrawCommission = (amount, method = 'Momo') => {
    setWallets(w => {
      if (amount > w.commission.balance) return w;
      return {
        ...w,
        commission: {
          balance: w.commission.balance - amount,
          transactions: [
            {
              id: Date.now(),
              type: 'withdraw',
              label: `Rút hoa hồng (${method})`,
              amount: -amount,
              date: new Date().toISOString().slice(0, 10),
              ref: `WD-${Date.now()}`,
            },
            ...w.commission.transactions,
          ],
        },
      };
    });
  };

  /** Chuyển hoa hồng → Ví Traffic */
  const transferToMain = (amount) => {
    setWallets(w => {
      if (amount > w.commission.balance) return w;
      const ref = `TRF-${Date.now()}`;
      const date = new Date().toISOString().slice(0, 10);
      return {
        main: {
          balance: w.main.balance + amount,
          transactions: [
            { id: Date.now() + 1, type: 'transfer_in',  label: 'Nhận từ Ví Hoa Hồng', amount,   date, ref },
            ...w.main.transactions,
          ],
        },
        commission: {
          balance: w.commission.balance - amount,
          transactions: [
            { id: Date.now(),     type: 'transfer_out', label: 'Chuyển sang Ví Traffic', amount: -amount, date, ref },
            ...w.commission.transactions,
          ],
        },
      };
    });
  };

  return (
    <WalletContext.Provider value={{ wallets, depositMain, spendMain, addCommission, withdrawCommission, transferToMain }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
