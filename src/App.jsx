import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';

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

/* ── Buyer (traffic) pages ── */
import DashboardLayout from './components/DashboardLayout';
import TrafficDashboard from './pages/TrafficDashboard';
import CreateCampaign from './pages/Campaigns/CreateCampaign';
import CampaignList from './pages/Campaigns/CampaignList';
import TrafficTracking from './pages/Reports/TrafficTracking';
import Deposit from './pages/Finance/Deposit';
import TransactionHistory from './pages/Finance/TransactionHistory';
import SettingsAndSupport from './pages/General/SettingsAndSupport';
import UserProfileAndAccountSettings from './pages/General/UserProfileAndAccountSettings';
import ScriptGenerator from './pages/Script/ScriptGenerator';
import UserPricing from './pages/Dashboard/UserPricing';
import UserReferral from './pages/General/UserReferral';

/* ── Worker (shortlink) pages ── */
import WorkerDashboardLayout from './components/WorkerDashboardLayout';
import MemberDashboard from './pages/Dashboard/MemberDashboard';
import AllLinks from './pages/Dashboard/AllLinks';
import HiddenLinks from './pages/Dashboard/HiddenLinks';
import DailyEarnings from './pages/Dashboard/DailyEarnings';
import Withdraw from './pages/Dashboard/Withdraw';
import WorkerTransactions from './pages/Dashboard/WorkerTransactions';
import WorkerPricing from './pages/Dashboard/WorkerPricing';
import WorkerProfile from './pages/Dashboard/WorkerProfile';
import WorkerSupport from './pages/Dashboard/WorkerSupport';
import WorkerApi from './pages/Dashboard/WorkerApi';
import WorkerShortLinks from './pages/Dashboard/WorkerShortLinks';

/* ── Admin ── */
import AdminLayout from './pages/Admin/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminCampaigns from './pages/Admin/AdminCampaigns';
import AdminTransactions from './pages/Admin/AdminTransactions';
import AdminTickets from './pages/Admin/AdminTickets';
import AdminPricing from './pages/Admin/AdminPricing';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminSecurity from './pages/Admin/AdminSecurity';
import AdminReferrals from './pages/Admin/AdminReferrals';
import AdminWorkerTasks from './pages/Admin/AdminWorkerTasks';
import AdminWorkerWithdrawals from './pages/Admin/AdminWorkerWithdrawals';
import AdminWorkerPricing from './pages/Admin/AdminWorkerPricing';

const DASHBOARD_ROUTES = ['/buyer', '/worker', '/dashboard', '/campaigns', '/reports', '/finance', '/settings', '/profile', '/admin'];

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



        {/* ═══ BUYER Dashboard ═══ */}
        <Route path="/buyer/dashboard" element={<DashboardLayout />}>
          <Route index element={<TrafficDashboard />} />
          <Route path="campaigns" element={<CampaignList />} />
          <Route path="campaigns/create" element={<CreateCampaign />} />
          <Route path="reports" element={<TrafficTracking />} />
          <Route path="finance/deposit" element={<Deposit />} />
          <Route path="finance/transactions" element={<TransactionHistory />} />
          <Route path="script" element={<ScriptGenerator />} />
          <Route path="support" element={<SettingsAndSupport />} />
          <Route path="pricing" element={<UserPricing />} />
          <Route path="referral" element={<UserReferral />} />
          <Route path="profile" element={<UserProfileAndAccountSettings />} />
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
          <Route path="tickets" element={<AdminTickets />} />
          <Route path="pricing" element={<AdminPricing />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="referrals/buyers" element={<AdminReferrals type="buyers" />} />
          <Route path="referrals/workers" element={<AdminReferrals type="workers" />} />
          <Route path="worker-users" element={<AdminUsers type="workers" />} />
          <Route path="worker-tasks" element={<AdminWorkerTasks />} />
          <Route path="worker-withdrawals" element={<AdminWorkerWithdrawals />} />
          <Route path="worker-pricing" element={<AdminWorkerPricing />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
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
