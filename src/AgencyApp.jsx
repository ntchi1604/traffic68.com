import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// ── Layout wrappers ──
import DashboardLayout from './components/DashboardLayout';

// ── Auth Pages ──
import AgencyLanding from './pages/AgencyLanding';
import AgencyDangNhap from './pages/AgencyDangNhap';
import AgencyDangKy from './pages/AgencyDangKy';

// ── Buyer pages — lazy load ──
const TrafficDashboard              = lazy(() => import('./pages/TrafficDashboard'));
const CreateCampaign                = lazy(() => import('./pages/Campaigns/CreateCampaign'));
const CampaignList                  = lazy(() => import('./pages/Campaigns/CampaignList'));
const TrafficTracking               = lazy(() => import('./pages/Reports/TrafficTracking'));
const Deposit                       = lazy(() => import('./pages/Finance/Deposit'));
const TransactionHistory            = lazy(() => import('./pages/Finance/TransactionHistory'));
const UserProfileAndAccountSettings = lazy(() => import('./pages/General/UserProfileAndAccountSettings'));
const ScriptGenerator               = lazy(() => import('./pages/Script/ScriptGenerator'));
const UserPricing                   = lazy(() => import('./pages/Dashboard/UserPricing'));
const BuyerSupport                  = lazy(() => import('./pages/Campaigns/BuyerSupport'));
const BuyerApi                      = lazy(() => import('./pages/Campaigns/BuyerApi'));

// ── Agency Admin pages — lazy load ──
const AgencyAdminLayout       = lazy(() => import('./pages/AgencyAdmin/AgencyAdminLayout'));
const AgencyAdminDashboard    = lazy(() => import('./pages/AgencyAdmin/AgencyAdminDashboard'));
const AgencyAdminBuyers       = lazy(() => import('./pages/AgencyAdmin/AgencyAdminBuyers'));
const AgencyAdminCampaigns    = lazy(() => import('./pages/AgencyAdmin/AgencyAdminCampaigns'));
const AgencyAdminTransactions = lazy(() => import('./pages/AgencyAdmin/AgencyAdminTransactions'));
const AgencyAdminTickets      = lazy(() => import('./pages/AgencyAdmin/AgencyAdminTickets'));
const AgencyAdminPricing      = lazy(() => import('./pages/AgencyAdmin/AgencyAdminPricing'));
const AgencyAdminConfig       = lazy(() => import('./pages/AgencyAdmin/AgencyAdminConfig'));
const AgencyAdminSettings     = lazy(() => import('./pages/AgencyAdmin/AgencyAdminSettings'));

function PageSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: 'var(--primary-color, #3B82F6)', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function AgencyNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-black mb-3" style={{ color: 'var(--primary-color, #3B82F6)' }}>404</p>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Không tìm thấy trang</h1>
      </div>
    </div>
  );
}

function Layout({ config }) {
  // Apply theme color
  useEffect(() => {
    if (config?.primary_color) {
      document.documentElement.style.setProperty('--primary-color', config.primary_color);
    }
    if (config?.name) {
      document.title = config.name;
    }
  }, [config]);

  // Pass config into localStorage so that Deposit page can read it!
  useEffect(() => {
    if (config) {
      localStorage.setItem('agency_config', JSON.stringify(config));
    }
  }, [config]);

  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/" element={<AgencyLanding config={config} />} />
        <Route path="/dang-nhap" element={<AgencyDangNhap config={config} />} />
        <Route path="/dang-ky" element={<AgencyDangKy config={config} />} />

        {/* Cố tình map về /buyer/dashboard để dùng lại component và navigate cũ */}
        <Route path="/dashboard" element={<Navigate to="/buyer/dashboard" replace />} />

        <Route path="/buyer/dashboard" element={<DashboardLayout agencyConfig={config} />}>
          <Route index element={<TrafficDashboard />} />
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="campaigns/create" element={<CreateCampaign />} />
          <Route path="reports" element={<TrafficTracking />} />
          <Route path="finance/deposit" element={<Deposit />} />
          <Route path="finance/transactions" element={<TransactionHistory />} />
          <Route path="script" element={<ScriptGenerator />} />
          <Route path="support" element={<BuyerSupport />} />
          <Route path="pricing" element={<UserPricing />} />
          <Route path="profile" element={<UserProfileAndAccountSettings />} />
          <Route path="api" element={<BuyerApi />} />
        </Route>

        {/* ═══ Agency Admin ═══ */}
        <Route path="/agency-admin" element={<AgencyAdminLayout config={config} />}>
          <Route index element={<AgencyAdminDashboard />} />
          <Route path="buyers" element={<AgencyAdminBuyers />} />
          <Route path="campaigns" element={<AgencyAdminCampaigns />} />
          <Route path="transactions" element={<AgencyAdminTransactions />} />
          <Route path="tickets" element={<AgencyAdminTickets />} />
          <Route path="pricing" element={<AgencyAdminPricing />} />
          <Route path="config" element={<AgencyAdminConfig />} />
          <Route path="settings" element={<AgencyAdminSettings />} />
        </Route>

        <Route path="*" element={<AgencyNotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function AgencyApp({ config }) {
  return (
    <BrowserRouter>
      <Layout config={config} />
    </BrowserRouter>
  );
}
