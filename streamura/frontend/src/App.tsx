import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/Home';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { DiscoverPage } from '@/pages/Discover';
import { StreamViewPage } from '@/pages/StreamView';
import { ProfilePage } from '@/pages/Profile';
import { GoLivePage } from '@/pages/GoLive';
import { EventDetailPage } from '@/pages/EventDetail';
import { AdminDashboard, UserManagement, ReportQueue, ModerationQueue } from '@/pages/admin';
import { RecordingPage } from '@/pages/Recording';
import { AnalyticsPage } from '@/pages/Analytics';
import { CommunitiesPage } from '@/pages/Communities';
import { CommunityDetailPage } from '@/pages/CommunityDetail';
import { MessagesPage } from '@/pages/Messages';
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

      {/* Routes with navbar */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/trending" element={<DiscoverPage />} />
        <Route path="/nearby" element={<DiscoverPage />} />
        <Route path="/streams/:streamId" element={<StreamViewPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/recordings/:recordingId" element={<RecordingPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/stream/new" element={<GoLivePage />} />

        {/* Community routes */}
        <Route path="/communities" element={<CommunitiesPage />} />
        <Route path="/communities/:communityId" element={<CommunityDetailPage />} />

        {/* Messaging routes */}
        <Route path="/messages" element={<MessagesPage />} />

        {/* Admin routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/reports" element={<ReportQueue />} />
        <Route path="/admin/moderation" element={<ModerationQueue />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
