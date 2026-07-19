import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { HomePage } from '@/pages/Home';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { DiscoverPage } from '@/pages/Discover';
import { StreamViewPage } from '@/pages/StreamView';
import { ProfilePage } from '@/pages/Profile';
import { GoLivePage } from '@/pages/GoLive';
import { EventDetailPage } from '@/pages/EventDetail';
import { AdminDashboard, UserManagement, ReportQueue, ModerationQueue, TicketScanner, AgentDashboard, HITLQueue, ClusterManagement, PlatformAnalytics, ContentFilterManager, AgentAuditLog } from '@/pages/admin';
import { RecordingPage } from '@/pages/Recording';
import { AnalyticsPage } from '@/pages/Analytics';
import { CommunitiesPage } from '@/pages/Communities';
import { CommunityDetailPage } from '@/pages/CommunityDetail';
import { MessagesPage } from '@/pages/Messages';
import { AboutPage } from '@/pages/About';
import { TermsPage } from '@/pages/Terms';
import { PrivacyPage } from '@/pages/Privacy';
import { ContactPage } from '@/pages/Contact';
import { NotificationsPage } from '@/pages/Notifications';
import { FeedPage } from '@/pages/Feed';
import { ShopPage } from '@/pages/Shop';
import { InventoryPage } from '@/pages/Inventory';
import { SettingsPage } from '@/pages/Settings';
import PayoutsPage from '@/pages/Payouts';
import { ForgotPasswordPage } from '@/pages/ForgotPassword';
import { ResetPasswordPage } from '@/pages/ResetPassword';
import { AppealsPage } from '@/pages/Appeals';
import { ContentLicensingPage } from '@/pages/ContentLicensing';
import EmergencyBroadcastPage from '@/pages/EmergencyBroadcast';
import { KYCVerificationPage } from '@/pages/KYCVerification';
import { DataExport } from '@/pages/DataExport';
import { CurrencyShop } from '@/pages/CurrencyShop';
import { TaxCenter } from '@/pages/TaxCenter';
import { PricingPage } from '@/pages/Pricing';
import { SitemapPage } from '@/pages/Sitemap';
import { useAuthStore } from '@/stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppContent() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      {/* Public routes without navbar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Routes with navbar */}
      <Route element={<Layout />}>
        {/* Public — browse & watch (anonymous allowed) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/trending" element={<DiscoverPage />} />
        <Route path="/nearby" element={<DiscoverPage />} />
        <Route path="/streams/:streamId" element={<StreamViewPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/recordings/:recordingId" element={<RecordingPage />} />
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/communities/:communityId" element={<CommunityDetailPage />} />

        {/* Legal/Info routes (public) */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/features" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/guidelines" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/cookies" element={<PrivacyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/sitemap" element={<SitemapPage />} />

        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/stream/new" element={<GoLivePage />} />

          {/* Messaging */}
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Shop / currency */}
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/coins" element={<CurrencyShop />} />

          {/* Account / settings / monetization */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/data-export" element={<DataExport />} />
          <Route path="/appeals" element={<AppealsPage />} />
          <Route path="/content-licensing" element={<ContentLicensingPage />} />
          <Route path="/emergency-broadcast" element={<EmergencyBroadcastPage />} />
          <Route path="/kyc-verification" element={<KYCVerificationPage />} />
          <Route path="/payouts" element={<PayoutsPage />} />
          <Route path="/tax" element={<TaxCenter />} />

          {/* Admin routes (require is_admin) */}
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/reports" element={<ReportQueue />} />
            <Route path="/admin/moderation" element={<ModerationQueue />} />
            <Route path="/admin/tickets" element={<TicketScanner />} />
            <Route path="/admin/agents" element={<AgentDashboard />} />
            <Route path="/admin/agents/audit" element={<AgentAuditLog />} />
            <Route path="/admin/hitl-queue" element={<HITLQueue />} />
            <Route path="/admin/clusters" element={<ClusterManagement />} />
            <Route path="/admin/analytics" element={<PlatformAnalytics />} />
            <Route path="/admin/content-filter" element={<ContentFilterManager />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
