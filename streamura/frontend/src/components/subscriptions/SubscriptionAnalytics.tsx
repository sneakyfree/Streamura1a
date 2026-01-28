import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Users,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    AlertTriangle,
    Repeat,
    Crown,
    Clock,
    ChevronDown
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface SubscriptionStats {
    total_subscribers: number;
    new_this_month: number;
    churned_this_month: number;
    net_change: number;
    mrr: number;
    churn_rate: number;
    retention_rate: number;
    average_lifetime_months: number;
}

interface TierStats {
    tier_id: number;
    tier_name: string;
    price: number;
    subscriber_count: number;
    revenue_share: number;
    churn_rate: number;
    upgrade_rate: number;
    downgrade_rate: number;
}

interface RenewalPrediction {
    date: string;
    predicted_renewals: number;
    predicted_revenue: number;
    confidence: number;
}

interface ChurnRiskUser {
    user_id: number;
    username: string;
    avatar_url?: string;
    tier_name: string;
    risk_level: 'low' | 'medium' | 'high';
    risk_score: number;
    last_activity: string;
    subscribed_since: string;
}

interface SubscriptionAnalyticsProps {
    creatorId?: number;
    compact?: boolean;
}

// Fetch subscription analytics
const fetchAnalytics = async (creatorId?: number) => {
    const params = new URLSearchParams();
    if (creatorId) params.set('creator_id', creatorId.toString());

    const res = await fetch(`/api/v1/subscriptions/analytics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
};

// Mini chart component
function MiniLineChart({
    data,
    color = '#a855f7',
    height = 40
}: {
    data: number[];
    color?: string;
    height?: number;
}) {
    const points = useMemo(() => {
        if (!data || data.length === 0) return '';
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const width = 100;

        return data.map((val, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }, [data, height]);

    return (
        <svg width="100" height={height} className="overflow-visible">
            <path d={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </svg>
    );
}

// Stat card
function StatCard({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    color,
    trend
}: {
    title: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    icon: React.ElementType;
    color: string;
    trend?: number[];
}) {
    const isPositive = (change || 0) >= 0;

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
            <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                {trend && trend.length > 0 && (
                    <MiniLineChart data={trend} color={isPositive ? '#22c55e' : '#f97316'} />
                )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-xs text-slate-400 mb-2">{title}</div>
            {change !== undefined && (
                <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-orange-400'}`}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
                    <span className="text-slate-500">{changeLabel}</span>
                </div>
            )}
        </Card>
    );
}

// Tier performance row
function TierRow({ tier }: { tier: TierStats }) {
    return (
        <div className="flex items-center gap-4 p-3 bg-slate-700/30 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
                <Crown className="h-4 w-4 text-purple-400" />
                <span className="text-white font-medium">{tier.tier_name}</span>
                <span className="text-xs text-slate-500">${tier.price}/mo</span>
            </div>
            <div className="text-center">
                <div className="text-sm font-medium text-white">{tier.subscriber_count}</div>
                <div className="text-xs text-slate-500">subs</div>
            </div>
            <div className="text-center">
                <div className="text-sm font-medium text-green-400">${tier.revenue_share.toFixed(0)}</div>
                <div className="text-xs text-slate-500">revenue</div>
            </div>
            <div className="text-center">
                <div className={`text-sm font-medium ${tier.churn_rate < 5 ? 'text-green-400' : tier.churn_rate < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {tier.churn_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">churn</div>
            </div>
        </div>
    );
}

// Churn risk row
function ChurnRiskRow({ user }: { user: ChurnRiskUser }) {
    const riskColors = {
        low: 'bg-green-500/20 text-green-400',
        medium: 'bg-yellow-500/20 text-yellow-400',
        high: 'bg-red-500/20 text-red-400'
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-medium text-white">
                {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
                <div className="text-sm font-medium text-white">{user.username}</div>
                <div className="text-xs text-slate-500">{user.tier_name} • {user.subscribed_since}</div>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${riskColors[user.risk_level]}`}>
                {user.risk_level.toUpperCase()}
            </div>
            <Button variant="secondary" size="sm" className="text-xs">
                Reach Out
            </Button>
        </div>
    );
}

export function SubscriptionAnalytics({ creatorId, compact = false }: SubscriptionAnalyticsProps) {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
    const [expandedSection, setExpandedSection] = useState<string | null>('overview');

    const { data, isLoading } = useQuery({
        queryKey: ['subscriptionAnalytics', creatorId, timeRange],
        queryFn: () => fetchAnalytics(creatorId),
        refetchInterval: 60000
    });

    // Mock data for demo
    const mockData = {
        stats: {
            total_subscribers: 847,
            new_this_month: 123,
            churned_this_month: 28,
            net_change: 95,
            mrr: 4235.50,
            churn_rate: 3.3,
            retention_rate: 96.7,
            average_lifetime_months: 7.2
        } as SubscriptionStats,
        tiers: [
            { tier_id: 1, tier_name: 'Supporter', price: 4.99, subscriber_count: 412, revenue_share: 1856, churn_rate: 4.2, upgrade_rate: 8.5, downgrade_rate: 0 },
            { tier_id: 2, tier_name: 'VIP', price: 9.99, subscriber_count: 285, revenue_share: 2565, churn_rate: 2.1, upgrade_rate: 5.2, downgrade_rate: 3.1 },
            { tier_id: 3, tier_name: 'Ultimate', price: 24.99, subscriber_count: 150, revenue_share: 3374, churn_rate: 1.5, upgrade_rate: 0, downgrade_rate: 2.8 }
        ] as TierStats[],
        renewal_predictions: [
            { date: '2024-02-01', predicted_renewals: 245, predicted_revenue: 1835.50, confidence: 0.92 },
            { date: '2024-02-08', predicted_renewals: 198, predicted_revenue: 1456.20, confidence: 0.88 },
            { date: '2024-02-15', predicted_renewals: 167, predicted_revenue: 1234.80, confidence: 0.85 },
            { date: '2024-02-22', predicted_renewals: 189, predicted_revenue: 1678.90, confidence: 0.82 }
        ] as RenewalPrediction[],
        churn_risk: [
            { user_id: 1, username: 'StreamFan92', tier_name: 'VIP', risk_level: 'high' as const, risk_score: 0.78, last_activity: '14 days ago', subscribed_since: '6 months' },
            { user_id: 2, username: 'NightOwl', tier_name: 'Ultimate', risk_level: 'medium' as const, risk_score: 0.52, last_activity: '7 days ago', subscribed_since: '3 months' },
            { user_id: 3, username: 'ChillViewer', tier_name: 'Supporter', risk_level: 'high' as const, risk_score: 0.85, last_activity: '21 days ago', subscribed_since: '1 month' }
        ] as ChurnRiskUser[],
        trends: {
            subscribers: [780, 795, 810, 825, 830, 835, 847],
            mrr: [3850, 3920, 4050, 4100, 4180, 4210, 4235],
            churn: [4.1, 3.8, 3.6, 3.5, 3.4, 3.3, 3.3]
        }
    };

    const analyticsData = data || mockData;
    const stats = analyticsData.stats;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading analytics...
            </div>
        );
    }

    if (compact) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Subscribers"
                    value={stats.total_subscribers.toLocaleString()}
                    change={((stats.net_change / stats.total_subscribers) * 100)}
                    changeLabel="this month"
                    icon={Users}
                    color="bg-purple-500/20 text-purple-400"
                />
                <StatCard
                    title="Monthly Revenue"
                    value={`$${stats.mrr.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-green-500/20 text-green-400"
                />
                <StatCard
                    title="Retention Rate"
                    value={`${stats.retention_rate}%`}
                    icon={Repeat}
                    color="bg-blue-500/20 text-blue-400"
                />
                <StatCard
                    title="Churn Rate"
                    value={`${stats.churn_rate}%`}
                    icon={TrendingDown}
                    color="bg-orange-500/20 text-orange-400"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-400" />
                    Subscription Analytics
                </h2>
                <div className="flex items-center gap-2">
                    {(['7d', '30d', '90d'] as const).map((range) => (
                        <Button
                            key={range}
                            variant={timeRange === range ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setTimeRange(range)}
                        >
                            {range}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Overview stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Subscribers"
                    value={stats.total_subscribers.toLocaleString()}
                    change={((stats.net_change / stats.total_subscribers) * 100)}
                    changeLabel="this month"
                    icon={Users}
                    color="bg-purple-500/20 text-purple-400"
                    trend={analyticsData.trends?.subscribers}
                />
                <StatCard
                    title="Monthly Recurring Revenue"
                    value={`$${stats.mrr.toLocaleString()}`}
                    icon={DollarSign}
                    color="bg-green-500/20 text-green-400"
                    trend={analyticsData.trends?.mrr}
                />
                <StatCard
                    title="Retention Rate"
                    value={`${stats.retention_rate}%`}
                    icon={Repeat}
                    color="bg-blue-500/20 text-blue-400"
                />
                <StatCard
                    title="Avg. Lifetime"
                    value={`${stats.average_lifetime_months} mo`}
                    icon={Clock}
                    color="bg-cyan-500/20 text-cyan-400"
                />
            </div>

            {/* Subscriber flow */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-4">Subscriber Flow (This Month)</h3>
                <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                        <div className="text-2xl font-bold text-green-400">+{stats.new_this_month}</div>
                        <div className="text-xs text-slate-500">New Subscribers</div>
                    </div>
                    <div className="text-3xl text-slate-600">→</div>
                    <div className="text-center flex-1">
                        <div className="text-2xl font-bold text-white">{stats.total_subscribers}</div>
                        <div className="text-xs text-slate-500">Total Active</div>
                    </div>
                    <div className="text-3xl text-slate-600">→</div>
                    <div className="text-center flex-1">
                        <div className="text-2xl font-bold text-orange-400">-{stats.churned_this_month}</div>
                        <div className="text-xs text-slate-500">Churned</div>
                    </div>
                </div>
            </Card>

            {/* Tier performance */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'tiers' ? null : 'tiers')}
                    className="w-full flex items-center justify-between"
                >
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <Crown className="h-4 w-4 text-purple-400" />
                        Tier Performance
                    </h3>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSection === 'tiers' ? 'rotate-180' : ''}`} />
                </button>
                {expandedSection === 'tiers' && (
                    <div className="mt-4 space-y-2">
                        {analyticsData.tiers.map((tier: TierStats) => (
                            <TierRow key={tier.tier_id} tier={tier} />
                        ))}
                    </div>
                )}
            </Card>

            {/* Churn risk alerts */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <button
                    onClick={() => setExpandedSection(expandedSection === 'churn' ? null : 'churn')}
                    className="w-full flex items-center justify-between"
                >
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-400" />
                        Churn Risk Alerts
                        <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                            {analyticsData.churn_risk?.length || 0}
                        </span>
                    </h3>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expandedSection === 'churn' ? 'rotate-180' : ''}`} />
                </button>
                {expandedSection === 'churn' && (
                    <div className="mt-4 space-y-2">
                        {analyticsData.churn_risk?.map((user: ChurnRiskUser) => (
                            <ChurnRiskRow key={user.user_id} user={user} />
                        ))}
                    </div>
                )}
            </Card>

            {/* Renewal predictions */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                    <Calendar className="h-4 w-4 text-blue-400" />
                    Upcoming Renewals
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {analyticsData.renewal_predictions?.map((pred: RenewalPrediction, i: number) => (
                        <div key={i} className="p-3 bg-slate-700/30 rounded-lg text-center">
                            <div className="text-xs text-slate-500 mb-1">
                                {new Date(pred.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-lg font-bold text-white">{pred.predicted_renewals}</div>
                            <div className="text-xs text-green-400">${pred.predicted_revenue.toFixed(0)}</div>
                            <div className="text-xs text-slate-500 mt-1">{(pred.confidence * 100).toFixed(0)}% conf</div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

export default SubscriptionAnalytics;
