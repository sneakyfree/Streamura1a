import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Video,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Shield,
  Activity,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function AdminDashboard() {
  const { user, isAuthenticated } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!user?.is_admin,
  });

  // Anonymous visitors: prompt sign-in instead of scary "Access Denied"
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Shield className="h-12 w-12 text-primary-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Sign in to continue</h1>
          <p className="text-slate-400 mb-4">The admin console requires an authenticated account.</p>
          <Link to="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Authenticated non-admins: real access denied
  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You don't have permission to access this page.</p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleTriggerClustering = async () => {
    setIsRefreshing('clustering');
    try {
      await adminApi.triggerClustering();
    } finally {
      setIsRefreshing(null);
    }
  };

  const handleUpdateRankings = async () => {
    setIsRefreshing('rankings');
    try {
      await adminApi.updateRankings();
    } finally {
      setIsRefreshing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400">Platform overview and management</p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-primary-500/10 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary-500" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats?.users.total.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-500">
                    {stats?.users.active.toLocaleString() || 0} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <Video className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Streams</p>
                  <p className="text-2xl font-bold text-white">{stats?.streams.total.toLocaleString() || 0}</p>
                  <p className="text-xs text-green-400">
                    {stats?.streams.live || 0} live now
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Events</p>
                  <p className="text-2xl font-bold text-white">{stats?.events.total.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-500">
                    {stats?.events.active || 0} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Pending Reports</p>
                  <p className="text-2xl font-bold text-white">{stats?.reports.pending || 0}</p>
                  <p className="text-xs text-red-400">
                    {stats?.reports.high_priority || 0} high priority
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Management Links */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Management</h2>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                to="/admin/users"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <Users className="h-5 w-5 text-primary-400" />
                <div>
                  <span className="text-white block">User Management</span>
                  <span className="text-xs text-slate-400">{stats?.users.banned || 0} banned users</span>
                </div>
              </Link>
              <Link
                to="/admin/reports"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                <div>
                  <span className="text-white block">Report Queue</span>
                  <span className="text-xs text-slate-400">{stats?.reports.pending || 0} pending</span>
                </div>
              </Link>
              <Link
                to="/admin/moderation"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <Video className="h-5 w-5 text-green-400" />
                <div>
                  <span className="text-white block">Stream Moderation</span>
                  <span className="text-xs text-slate-400">{stats?.streams.live || 0} live streams</span>
                </div>
              </Link>
              <Link
                to="/admin/agents"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <Activity className="h-5 w-5 text-purple-400" />
                <div>
                  <span className="text-white block">Agent Dashboard</span>
                  <span className="text-xs text-slate-400">AI agent monitoring</span>
                </div>
              </Link>
              <Link
                to="/admin/analytics"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <div>
                  <span className="text-white block">Platform Analytics</span>
                  <span className="text-xs text-slate-400">Revenue & growth metrics</span>
                </div>
              </Link>
              <Link
                to="/admin/content-filter"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                <div>
                  <span className="text-white block">Content Filters</span>
                  <span className="text-xs text-slate-400">Moderation rules</span>
                </div>
              </Link>
              <Link
                to="/admin/agents/audit"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <Activity className="h-5 w-5 text-cyan-400" />
                <div>
                  <span className="text-white block">Agent Audit Log</span>
                  <span className="text-xs text-slate-400">AI decision history</span>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* System Actions */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">System Actions</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={handleTriggerClustering}
                disabled={isRefreshing === 'clustering'}
              >
                {isRefreshing === 'clustering' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                Run Event Clustering
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={handleUpdateRankings}
                disabled={isRefreshing === 'rankings'}
              >
                {isRefreshing === 'rankings' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Update Rankings
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Activity Summary</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active Users</span>
                <span className="text-white font-medium">{stats?.users.active || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Banned Users</span>
                <span className="text-red-400 font-medium">{stats?.users.banned || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Live Streams</span>
                <span className="text-green-400 font-medium">{stats?.streams.live || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active Events</span>
                <span className="text-purple-400 font-medium">{stats?.events.active || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">High Priority Reports</span>
                <span className="text-red-400 font-medium">{stats?.reports.high_priority || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Info */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary-400" />
              <p className="text-slate-400">
                Logged in as <span className="text-white font-medium">{user.username}</span> (Admin)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
