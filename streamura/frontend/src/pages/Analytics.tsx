import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Eye,
  Clock,
  DollarSign,
  Heart,
  Users,
  MessageSquare,
  Video,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  analyticsApi,
  type CreatorOverview,
  type EarningsBreakdown,
  type TopStream,
  type EngagementMetrics,
  type ActivityItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  subtitle?: string;
}

function StatCard({ title, value, icon, trend, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-slate-400 text-sm">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
            {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <div className={`flex items-center mt-2 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {trend >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                <span>{Math.abs(trend)}% from last period</span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsPage() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<CreatorOverview | null>(null);
  const [earnings, setEarnings] = useState<EarningsBreakdown | null>(null);
  const [topStreams, setTopStreams] = useState<TopStream[]>([]);
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [overviewData, earningsData, streamsData, engagementData, activityData] = await Promise.all([
          analyticsApi.getOverview(),
          analyticsApi.getEarnings(period),
          analyticsApi.getTopStreams('viewers', 5),
          analyticsApi.getEngagement(period),
          analyticsApi.getRecentActivity(10),
        ]);
        setOverview(overviewData);
        setEarnings(earningsData);
        setTopStreams(streamsData);
        setEngagement(engagementData);
        setActivity(activityData);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Please sign in</h2>
          <Link to="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
            <p className="text-slate-400">Track your streaming performance</p>
          </div>
          <div className="flex items-center gap-2">
            {['day', 'week', 'month', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Streams"
            value={overview?.total_streams || 0}
            icon={<Video className="h-5 w-5 text-primary-400" />}
          />
          <StatCard
            title="Total Views"
            value={formatNumber(overview?.total_views || 0)}
            icon={<Eye className="h-5 w-5 text-blue-400" />}
          />
          <StatCard
            title="Total Earnings"
            value={formatCurrency(overview?.total_earnings || 0)}
            icon={<DollarSign className="h-5 w-5 text-green-400" />}
          />
          <StatCard
            title="Followers"
            value={formatNumber(overview?.follower_count || 0)}
            icon={<Users className="h-5 w-5 text-purple-400" />}
          />
        </div>

        {/* Engagement Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Likes"
            value={formatNumber(overview?.total_likes || 0)}
            icon={<Heart className="h-5 w-5 text-red-400" />}
          />
          <StatCard
            title="Avg Viewers/Stream"
            value={Math.round(overview?.avg_viewers_per_stream || 0)}
            icon={<TrendingUp className="h-5 w-5 text-accent-400" />}
          />
          <StatCard
            title="Watch Time"
            value={formatDuration(overview?.total_watch_time || 0)}
            icon={<Clock className="h-5 w-5 text-yellow-400" />}
          />
          <StatCard
            title="Chat Messages"
            value={formatNumber(engagement?.chat_messages || 0)}
            icon={<MessageSquare className="h-5 w-5 text-cyan-400" />}
            subtitle={`This ${period}`}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top Streams */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Top Performing Streams</h2>
            </CardHeader>
            <CardContent>
              {topStreams.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No streams yet</p>
                  <Link to="/stream/new" className="mt-4 inline-block">
                    <Button size="sm">Go Live</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {topStreams.map((stream, index) => (
                    <div
                      key={stream.stream_id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50"
                    >
                      <span className="text-lg font-bold text-slate-500 w-6">
                        #{index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/streams/${stream.stream_id}`}
                          className="text-white font-medium hover:text-primary-400 truncate block"
                        >
                          {stream.title || 'Untitled Stream'}
                        </Link>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {formatNumber(stream.peak_viewers)} peak
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3.5 w-3.5" />
                            {formatNumber(stream.like_count)}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(stream.earnings)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Earnings Breakdown */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Earnings ({period})</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-green-400">
                    {formatCurrency(earnings?.total || 0)}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">Total this {period}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                    <span className="text-slate-300">Tips</span>
                    <span className="text-white font-medium">
                      {formatCurrency(earnings?.tips || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                    <span className="text-slate-300">Ad Revenue</span>
                    <span className="text-white font-medium">
                      {formatCurrency(earnings?.ad_revenue || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                    <span className="text-slate-300">Transactions</span>
                    <span className="text-white font-medium">
                      {earnings?.transaction_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      item.type === 'tip' ? 'bg-green-500/10' :
                      item.type === 'follow' ? 'bg-purple-500/10' :
                      'bg-red-500/10'
                    }`}>
                      {item.type === 'tip' ? (
                        <DollarSign className="h-4 w-4 text-green-400" />
                      ) : item.type === 'follow' ? (
                        <Users className="h-4 w-4 text-purple-400" />
                      ) : (
                        <Heart className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      {item.type === 'tip' && (
                        <p className="text-white">
                          <span className="font-medium">{item.from_username || 'Someone'}</span>
                          {' tipped '}
                          <span className="text-green-400 font-medium">{formatCurrency(item.amount || 0)}</span>
                          {item.message && (
                            <span className="text-slate-400"> - "{item.message}"</span>
                          )}
                        </p>
                      )}
                      {item.type === 'follow' && (
                        <p className="text-white">
                          <span className="font-medium">{item.from_username || 'Someone'}</span>
                          {' started following you'}
                        </p>
                      )}
                      {item.type === 'like' && (
                        <p className="text-white">
                          <span className="font-medium">{item.from_username || 'Someone'}</span>
                          {' liked '}
                          <span className="text-slate-300">{item.stream_title || 'your stream'}</span>
                        </p>
                      )}
                    </div>
                    <span className="text-slate-500 text-sm">
                      {formatTimeAgo(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
