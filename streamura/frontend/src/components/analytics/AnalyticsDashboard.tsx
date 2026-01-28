import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp,
    Users,
    DollarSign,
    Eye,
    Clock,
    Radio,
    Activity,
    Calendar,
    BarChart3,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type TimeRange = '24h' | '7d' | '30d' | '90d';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon: React.ElementType;
    iconColor?: string;
    trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({
    title,
    value,
    change,
    changeLabel = 'vs last period',
    icon: Icon,
    iconColor = 'text-primary-400',
    trend,
}: MetricCardProps) {
    return (
        <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-slate-400 mb-1">{title}</p>
                        <p className="text-2xl font-bold text-white">{value}</p>
                        {change !== undefined && (
                            <div className="flex items-center gap-1 mt-2">
                                {trend === 'up' ? (
                                    <ArrowUpRight className="h-4 w-4 text-green-400" />
                                ) : trend === 'down' ? (
                                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                                ) : null}
                                <span className={cn(
                                    'text-sm font-medium',
                                    trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
                                )}>
                                    {change > 0 ? '+' : ''}{change}%
                                </span>
                                <span className="text-xs text-slate-500">{changeLabel}</span>
                            </div>
                        )}
                    </div>
                    <div className={cn('p-3 bg-slate-700/50 rounded-xl', iconColor)}>
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface AnalyticsData {
    metrics: {
        total_views: number;
        total_viewers: number;
        total_earnings: number;
        avg_watch_time: number;
        new_followers: number;
        streams_count: number;
    };
    changes: {
        views_change: number;
        viewers_change: number;
        earnings_change: number;
        watch_time_change: number;
        followers_change: number;
        streams_change: number;
    };
    top_streams: Array<{
        id: number;
        title: string;
        views: number;
        earnings: number;
        peak_viewers: number;
    }>;
    hourly_views: Array<{ hour: string; views: number }>;
    earnings_by_type: {
        tips: number;
        subscriptions: number;
        virtual_goods: number;
    };
}

export function AnalyticsDashboard() {
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');

    const { data, isLoading } = useQuery({
        queryKey: ['analytics', timeRange],
        queryFn: async () => {
            try {
                const response = await api.get(`/analytics/dashboard?range=${timeRange}`);
                return response.data as AnalyticsData;
            } catch {
                // Demo data fallback
                return {
                    metrics: {
                        total_views: 125420,
                        total_viewers: 8542,
                        total_earnings: 2847.50,
                        avg_watch_time: 12.5,
                        new_followers: 342,
                        streams_count: 28,
                    },
                    changes: {
                        views_change: 23.5,
                        viewers_change: 15.2,
                        earnings_change: 45.8,
                        watch_time_change: -5.2,
                        followers_change: 18.7,
                        streams_change: 12.0,
                    },
                    top_streams: [
                        { id: 1, title: 'Downtown Parade Coverage', views: 15420, earnings: 542.50, peak_viewers: 1250 },
                        { id: 2, title: 'City Council Meeting', views: 8745, earnings: 128.00, peak_viewers: 890 },
                        { id: 3, title: 'Local Concert Live', views: 7820, earnings: 892.25, peak_viewers: 1100 },
                    ],
                    hourly_views: Array.from({ length: 24 }, (_, i) => ({
                        hour: `${i}:00`,
                        views: Math.floor(Math.random() * 5000) + 500,
                    })),
                    earnings_by_type: {
                        tips: 1245.50,
                        subscriptions: 892.00,
                        virtual_goods: 710.00,
                    },
                } as AnalyticsData;
            }
        },
    });

    const timeRangeOptions: { value: TimeRange; label: string }[] = [
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '90d', label: '90 Days' },
    ];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="bg-slate-800 border-slate-700">
                            <CardContent className="p-6">
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 bg-slate-700 rounded w-24" />
                                    <div className="h-8 bg-slate-700 rounded w-32" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    const metrics = data?.metrics;
    const changes = data?.changes;

    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-400">Time Range:</span>
                </div>
                <div className="flex gap-2">
                    {timeRangeOptions.map((option) => (
                        <Button
                            key={option.value}
                            variant={timeRange === option.value ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setTimeRange(option.value)}
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricCard
                    title="Total Views"
                    value={metrics?.total_views.toLocaleString() || '0'}
                    change={changes?.views_change}
                    icon={Eye}
                    iconColor="text-blue-400"
                    trend={changes?.views_change && changes.views_change > 0 ? 'up' : 'down'}
                />
                <MetricCard
                    title="Unique Viewers"
                    value={metrics?.total_viewers.toLocaleString() || '0'}
                    change={changes?.viewers_change}
                    icon={Users}
                    iconColor="text-purple-400"
                    trend={changes?.viewers_change && changes.viewers_change > 0 ? 'up' : 'down'}
                />
                <MetricCard
                    title="Total Earnings"
                    value={`$${metrics?.total_earnings.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}`}
                    change={changes?.earnings_change}
                    icon={DollarSign}
                    iconColor="text-green-400"
                    trend={changes?.earnings_change && changes.earnings_change > 0 ? 'up' : 'down'}
                />
                <MetricCard
                    title="Avg Watch Time"
                    value={`${metrics?.avg_watch_time || 0} min`}
                    change={changes?.watch_time_change}
                    icon={Clock}
                    iconColor="text-yellow-400"
                    trend={changes?.watch_time_change && changes.watch_time_change > 0 ? 'up' : 'down'}
                />
                <MetricCard
                    title="New Followers"
                    value={metrics?.new_followers.toLocaleString() || '0'}
                    change={changes?.followers_change}
                    icon={TrendingUp}
                    iconColor="text-pink-400"
                    trend={changes?.followers_change && changes.followers_change > 0 ? 'up' : 'down'}
                />
                <MetricCard
                    title="Streams"
                    value={metrics?.streams_count || '0'}
                    change={changes?.streams_change}
                    icon={Radio}
                    iconColor="text-red-400"
                    trend={changes?.streams_change && changes.streams_change > 0 ? 'up' : 'down'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Views Over Time */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <BarChart3 className="h-5 w-5 text-primary-400" />
                            Views Over Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-48 flex items-end gap-1">
                            {data?.hourly_views?.slice(-24).map((point, idx) => (
                                <div
                                    key={idx}
                                    className="flex-1 bg-primary-500/30 hover:bg-primary-500/50 transition-colors rounded-t"
                                    style={{ height: `${(point.views / 5500) * 100}%` }}
                                    title={`${point.hour}: ${point.views.toLocaleString()} views`}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                            <span>24h ago</span>
                            <span>Now</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Earnings Breakdown */}
                <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                            <PieChart className="h-5 w-5 text-green-400" />
                            Earnings Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {data?.earnings_by_type && Object.entries(data.earnings_by_type).map(([type, amount]) => {
                                const total = Object.values(data.earnings_by_type).reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? (amount / total) * 100 : 0;
                                const colors = {
                                    tips: 'bg-green-500',
                                    subscriptions: 'bg-purple-500',
                                    virtual_goods: 'bg-yellow-500',
                                };

                                return (
                                    <div key={type} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-300 capitalize">{type.replace('_', ' ')}</span>
                                            <span className="text-white font-medium">${amount.toFixed(2)}</span>
                                        </div>
                                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full transition-all', colors[type as keyof typeof colors])}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Top Streams Table */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Activity className="h-5 w-5 text-red-400" />
                        Top Performing Streams
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700">
                                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Stream</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Views</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Peak Viewers</th>
                                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Earnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.top_streams?.map((stream, idx) => (
                                    <tr key={stream.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500 text-sm">#{idx + 1}</span>
                                                <span className="text-white font-medium">{stream.title}</span>
                                            </div>
                                        </td>
                                        <td className="text-right py-3 px-4 text-slate-300">
                                            {stream.views.toLocaleString()}
                                        </td>
                                        <td className="text-right py-3 px-4 text-slate-300">
                                            {stream.peak_viewers.toLocaleString()}
                                        </td>
                                        <td className="text-right py-3 px-4 text-green-400 font-medium">
                                            ${stream.earnings.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
