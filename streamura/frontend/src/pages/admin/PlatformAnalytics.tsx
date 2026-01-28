import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    BarChart2,
    Users,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Eye,
    Clock,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Radio,
    RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface MetricCard {
    label: string;
    value: string | number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
    icon: typeof Users;
}

interface TimeSeriesPoint {
    date: string;
    value: number;
}

interface PlatformStats {
    dau: number;
    mau: number;
    dauChange: number;
    mauChange: number;
    totalRevenue: number;
    revenueChange: number;
    avgSessionDuration: number;
    sessionChange: number;
    activeStreams: number;
    streamChange: number;
    totalWatchTime: number;
    watchTimeChange: number;
}

// Mock data
const mockStats: PlatformStats = {
    dau: 45230,
    mau: 892450,
    dauChange: 12.5,
    mauChange: 8.3,
    totalRevenue: 1250000,
    revenueChange: 15.2,
    avgSessionDuration: 42, // minutes
    sessionChange: 5.1,
    activeStreams: 1842,
    streamChange: 22.4,
    totalWatchTime: 8500000, // hours
    watchTimeChange: 18.7
};

const mockDauTrend: TimeSeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    value: 40000 + Math.random() * 10000
}));

const mockRetention = [
    { day: 'D1', rate: 68 },
    { day: 'D7', rate: 42 },
    { day: 'D14', rate: 35 },
    { day: 'D30', rate: 28 }
];

// Simple sparkline component
function Sparkline({ data, color = 'text-green-400' }: { data: number[]; color?: string }) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((v - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" className="w-24 h-8" preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={color}
            />
        </svg>
    );
}

// Metric card component
function MetricCardComponent({ metric }: { metric: MetricCard }) {
    const Icon = metric.icon;
    const isPositive = metric.trend === 'up';

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-sm text-slate-400 mb-1">{metric.label}</div>
                    <div className="text-2xl font-bold text-white">{metric.value}</div>
                    <div className={`flex items-center gap-1 text-sm mt-1 ${isPositive ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {isPositive ? (
                            <ArrowUpRight className="w-4 h-4" />
                        ) : (
                            <ArrowDownRight className="w-4 h-4" />
                        )}
                        {Math.abs(metric.change)}%
                    </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-700">
                    <Icon className="w-5 h-5 text-purple-400" />
                </div>
            </div>
        </Card>
    );
}

// Simple bar chart
function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
    const max = Math.max(...data.map(d => d.value));

    return (
        <div>
            <div className="text-sm text-slate-400 mb-3">{label}</div>
            <div className="space-y-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-12 text-sm text-slate-400">{item.label}</div>
                        <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded"
                                style={{ width: `${(item.value / max) * 100}%` }}
                            />
                        </div>
                        <div className="w-12 text-right text-sm text-white">{item.value}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function PlatformAnalytics() {
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

    const { data: stats = mockStats, isLoading, refetch } = useQuery({
        queryKey: ['platformStats', dateRange],
        queryFn: async () => mockStats
    });

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
    };

    const metrics: MetricCard[] = [
        { label: 'Daily Active Users', value: formatNumber(stats.dau), change: stats.dauChange, trend: 'up', icon: Users },
        { label: 'Monthly Active Users', value: formatNumber(stats.mau), change: stats.mauChange, trend: 'up', icon: Users },
        { label: 'Total Revenue', value: `$${formatNumber(stats.totalRevenue)}`, change: stats.revenueChange, trend: 'up', icon: DollarSign },
        { label: 'Avg Session Duration', value: `${stats.avgSessionDuration}m`, change: stats.sessionChange, trend: 'up', icon: Clock },
        { label: 'Active Streams', value: formatNumber(stats.activeStreams), change: stats.streamChange, trend: 'up', icon: Radio },
        { label: 'Total Watch Time', value: `${formatNumber(stats.totalWatchTime)}h`, change: stats.watchTimeChange, trend: 'up', icon: Eye }
    ];

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BarChart2 className="h-6 w-6 text-purple-400" />
                        Platform Analytics
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Executive dashboard with key platform metrics
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        {(['7d', '30d', '90d'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1 rounded text-sm ${dateRange === range
                                        ? 'bg-purple-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {metrics.map((metric, i) => (
                    <MetricCardComponent key={i} metric={metric} />
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DAU Trend */}
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-white font-medium">Daily Active Users</h3>
                        <Sparkline
                            data={mockDauTrend.map(d => d.value)}
                            color="text-green-400"
                        />
                    </div>
                    <div className="h-48 flex items-end gap-1">
                        {mockDauTrend.slice(-14).map((point, i) => (
                            <div
                                key={i}
                                className="flex-1 bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-500 hover:to-purple-300 transition-colors"
                                style={{ height: `${(point.value / 50000) * 100}%` }}
                                title={`${new Date(point.date).toLocaleDateString()}: ${formatNumber(point.value)}`}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span>{new Date(mockDauTrend[mockDauTrend.length - 14]?.date || '').toLocaleDateString()}</span>
                        <span>Today</span>
                    </div>
                </Card>

                {/* Retention */}
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-4">User Retention</h3>
                    <BarChart data={mockRetention.map(r => ({ label: r.day, value: r.rate }))} label="" />
                    <div className="mt-4 p-3 bg-slate-700/50 rounded">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">D7 Retention</span>
                            <span className="text-white font-medium">42%</span>
                        </div>
                        <div className="text-xs text-green-400 mt-1">+3.2% vs last month</div>
                    </div>
                </Card>
            </div>

            {/* Additional insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Top categories */}
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Top Categories</h3>
                    <div className="space-y-2">
                        {[
                            { name: 'Gaming', views: 4.2, pct: 35 },
                            { name: 'News', views: 2.8, pct: 23 },
                            { name: 'Sports', views: 2.1, pct: 18 },
                            { name: 'Music', views: 1.5, pct: 12 },
                            { name: 'Other', views: 1.4, pct: 12 }
                        ].map((cat, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-300">{cat.name}</span>
                                        <span className="text-slate-500">{cat.views}M views</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-700 rounded mt-1">
                                        <div
                                            className="h-full bg-purple-500 rounded"
                                            style={{ width: `${cat.pct}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Revenue breakdown */}
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Revenue by Source</h3>
                    <div className="space-y-3">
                        {[
                            { source: 'Subscriptions', amount: 625000, pct: 50 },
                            { source: 'Tips & Donations', amount: 312500, pct: 25 },
                            { source: 'Virtual Goods', amount: 187500, pct: 15 },
                            { source: 'Ads', amount: 125000, pct: 10 }
                        ].map((rev, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-slate-300 text-sm">{rev.source}</span>
                                <span className="text-white text-sm font-medium">${formatNumber(rev.amount)}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Peak hours */}
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Peak Hours (UTC)</h3>
                    <div className="flex items-end gap-0.5 h-24">
                        {Array.from({ length: 24 }, (_, i) => {
                            const activity = Math.sin((i - 6) * Math.PI / 12) * 50 + 50;
                            return (
                                <div
                                    key={i}
                                    className="flex-1 bg-purple-500/50 rounded-t hover:bg-purple-400/50 transition-colors"
                                    style={{ height: `${Math.max(10, activity)}%` }}
                                    title={`${i}:00 - ${Math.round(activity)}% activity`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>0:00</span>
                        <span>12:00</span>
                        <span>23:00</span>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default PlatformAnalytics;
