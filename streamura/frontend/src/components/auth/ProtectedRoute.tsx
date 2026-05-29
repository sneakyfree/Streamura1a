import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  /** Optional explicit children. When omitted, renders <Outlet /> so the
   *  component can be used as a React Router layout route element. */
  children?: React.ReactNode;
  requireVerified?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireVerified = false,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !user?.is_admin) {
    // Authenticated but not an admin — send back to the app shell.
    return <Navigate to="/" replace />;
  }

  if (requireVerified && user && !user.is_verified) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-white mb-2">
            Verification Required
          </h2>
          <p className="text-slate-400 mb-4">
            You need to verify your account to access this feature.
          </p>
        </div>
      </div>
    );
  }

  return <>{children ?? <Outlet />}</>;
}
