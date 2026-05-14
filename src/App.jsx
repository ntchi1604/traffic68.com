import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';

// ── Public pages — static import (cần tải ngay) ──
import Hero from './components/Hero';
import CommitmentCards from './components/CommitmentCards';
import TrustBar from './components/TrustBar';
import Benefits from './components/Benefits';
import Process from './components/Process';
import CaseStudies from './components/CaseStudies';
import Testimonials from './components/Testimonials';
import FAQ from './components/FAQ';
import BottomCTA from './components/BottomCTA';
import Footer from './components/Footer';
import DangNhap from './pages/DangNhap';
import DangKy from './pages/DangKy';
import DichVu from './pages/DichVu';
import BangGia from './pages/BangGia';
import FaqPage from './pages/FaqPage';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import LienHe from './pages/LienHe';
import LinkGateway from './pages/LinkGateway';

// ── Layout wrappers — static import (nhẹ, dùng làm shell) ──
import DashboardLayout from './components/DashboardLayout';
import WorkerDashboardLayout from './components/WorkerDashboardLayout';

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
const UserReferral                  = lazy(() => import('./pages/General/UserReferral'));
const BuyerSupport                  = lazy(() => import('./pages/Campaigns/BuyerSupport'));
const BuyerApi                      = lazy(() => import('./pages/Campaigns/BuyerApi'));
const AgencyDashboard               = lazy(() => import('./pages/Dashboard/AgencyDashboard'));

// ── Worker pages — lazy load ──
const MemberDashboard   = lazy(() => import('./pages/Dashboard/MemberDashboard'));
const AllLinks          = lazy(() => import('./pages/Dashboard/AllLinks'));
const HiddenLinks       = lazy(() => import('./pages/Dashboard/HiddenLinks'));
const DailyEarnings     = lazy(() => import('./pages/Dashboard/DailyEarnings'));
const Withdraw          = lazy(() => import('./pages/Dashboard/Withdraw'));
const WorkerTransactions= lazy(() => import('./pages/Dashboard/WorkerTransactions'));
const WorkerPricing     = lazy(() => import('./pages/Dashboard/WorkerPricing'));
const WorkerProfile     = lazy(() => import('./pages/Dashboard/WorkerProfile'));
const WorkerSupport     = lazy(() => import('./pages/Dashboard/WorkerSupport'));
const WorkerApi         = lazy(() => import('./pages/Dashboard/WorkerApi'));
const WorkerShortLinks  = lazy(() => import('./pages/Dashboard/WorkerShortLinks'));

// ── Admin pages — lazy load ──
const AdminLayout              = lazy(() => import('./pages/Admin/AdminLayout'));
const AdminDashboard           = lazy(() => import('./pages/Admin/AdminDashboard'));
const AdminUsers               = lazy(() => import('./pages/Admin/AdminUsers'));
const AdminCampaigns           = lazy(() => import('./pages/Admin/AdminCampaigns'));
const AdminTransactions        = lazy(() => import('./pages/Admin/AdminTransactions'));
const AdminTickets             = lazy(() => import('./pages/Admin/AdminTickets'));
const AdminPricing             = lazy(() => import('./pages/Admin/AdminPricing'));
const AdminSettings            = lazy(() => import('./pages/Admin/AdminSettings'));
const AdminSecurity            = lazy(() => import('./pages/Admin/AdminSecurity'));
const AdminReferrals           = lazy(() => import('./pages/Admin/AdminReferrals'));
const AdminWorkerTasks         = lazy(() => import('./pages/Admin/AdminWorkerTasks'));
const AdminWorkerWithdrawals   = lazy(() => import('./pages/Admin/AdminWorkerWithdrawals'));
const AdminPricingGroups       = lazy(() => import('./pages/Admin/AdminPricingGroups'));
const AdminConfig              = lazy(() => import('./pages/Admin/AdminConfig'));
const AdminWithdrawalAddresses = lazy(() => import('./pages/Admin/AdminWithdrawalAddresses'));
const AdminSourceApproval      = lazy(() => import('./pages/Admin/AdminSourceApproval'));
const AdminWorkerLinks         = lazy(() => import('./pages/Admin/AdminWorkerLinks'));
const AdminBlog                = lazy(() => import('./pages/Admin/AdminBlog'));

const DASHBOARD_ROUTES = ['/buyer', '/worker', '/dashboard', '/campaigns', '/reports', '/finance', '/settings', '/profile', '/admin'];

// Spinner nhỏ khi lazy-load chunk đang tải (<100ms thường)
function PageSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-[calc(100vh-66px)] flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-black text-orange-500 mb-3">404</p>
        <h1 className="text-2xl font-black text-blue-900 mb-2">Không tìm thấy trang</h1>
        <p className="text-gray-400 text-sm">Trang bạn tìm kiếm không tồn tại.</p>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <>
      <Hero />
      <CommitmentCards />
      <TrustBar />
      <Benefits />
      <Process />
      <CaseStudies />
      <Testimonials />
      <FAQ />
      <BottomCTA />
      <Footer />
    </>
  );
}

function Layout() {
  const { pathname } = useLocation();
  const isDashboard = DASHBOARD_ROUTES.some((r) => pathname.startsWith(r));

  return (
    <>
      {!isDashboard && <Navbar />}
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dich-vu" element={<DichVu />} />
          <Route path="/bang-gia" element={<BangGia />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/lien-he" element={<LienHe />} />
          <Route path="/vuot-link/:slug" element={<><LinkGateway /><Footer /></>} />
          <Route path="/dang-nhap" element={<DangNhap />} />
          <Route path="/dang-ky" element={<DangKy />} />

          <Route path="/dashboard" element={<Navigate to="/buyer/dashboard" replace />} />

          {/* ═══ BUYER Dashboard ═══ */}
          <Route path="/buyer/dashboard" element={<DashboardLayout />}>
            <Route index element={<TrafficDashboard />} />
            <Route path="campaigns" element={<CampaignList />} />
            <Route path="campaigns/create" element={<CreateCampaign />} />
            <Route path="reports" element={<TrafficTracking />} />
            <Route path="finance/deposit" element={<Deposit />} />
            <Route path="finance/transactions" element={<TransactionHistory />} />
            <Route path="script" element={<ScriptGenerator />} />
            <Route path="support" element={<BuyerSupport />} />
            <Route path="pricing" element={<UserPricing />} />
            <Route path="referral" element={<UserReferral />} />
            <Route path="profile" element={<UserProfileAndAccountSettings />} />
            <Route path="api" element={<BuyerApi />} />
            <Route path="agency" element={<AgencyDashboard />} />
          </Route>

          {/* ═══ WORKER Dashboard ═══ */}
          <Route path="/worker/dashboard" element={<WorkerDashboardLayout />}>
            <Route index element={<MemberDashboard />} />
            <Route path="links" element={<AllLinks />} />
            <Route path="links/hidden" element={<HiddenLinks />} />
            <Route path="earnings" element={<DailyEarnings />} />
            <Route path="withdraw" element={<Withdraw />} />
            <Route path="transactions" element={<WorkerTransactions />} />
            <Route path="pricing" element={<WorkerPricing />} />
            <Route path="profile" element={<WorkerProfile />} />
            <Route path="support" element={<WorkerSupport />} />
            <Route path="referral" element={<UserReferral />} />
            <Route path="api" element={<WorkerApi />} />
            <Route path="short-links" element={<WorkerShortLinks />} />
          </Route>

          {/* ═══ Admin ═══ */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers type="buyers" />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="tickets" element={<AdminTickets defaultRole="buyer" />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="security" element={<AdminSecurity />} />
            <Route path="referrals/buyers" element={<AdminReferrals type="buyers" />} />
            <Route path="referrals/workers" element={<AdminReferrals type="workers" />} />
            <Route path="worker-users" element={<AdminUsers type="workers" />} />
            <Route path="worker-tasks" element={<AdminWorkerTasks />} />
            <Route path="worker-withdrawals" element={<AdminWorkerWithdrawals />} />
            <Route path="withdrawal-addresses" element={<AdminWithdrawalAddresses />} />
            <Route path="worker-pricing-groups" element={<AdminPricingGroups />} />
            <Route path="source-approval" element={<AdminSourceApproval />} />
            <Route path="worker-tickets" element={<AdminTickets defaultRole="worker" />} />
            <Route path="worker-links" element={<AdminWorkerLinks />} />
            <Route path="blog" element={<AdminBlog />} />
            <Route path="config" element={<AdminConfig />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
