import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Shield,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    Lock,
    User,
    Camera,
    Calendar,
    Star,
    Award,
    Zap,
    ChevronDown,
    ChevronUp,
    Info,
    AlertTriangle
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface TrustFactor {
    name: string;
    key: string;
    score: number; // 0-1
    weight: number; // 0-1, how much this factor contributes
    status: 'verified' | 'pending' | 'unverified' | 'partial';
    description: string;
    value?: string | number; // e.g., "245 days" or "48 hours"
    maxValue?: string | number;
    actionRequired?: string;
    actionLink?: string;
}

interface TrustBreakdown {
    user_id: number;
    overall_score: number; // 0-10
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    next_tier: { name: string; required_score: number } | null;
    factors: TrustFactor[];
    improvement_tips: { tip: string; impact: 'high' | 'medium' | 'low'; action_link?: string }[];
    history: { date: string; score: number }[];
    last_updated: string;
}

interface TrustScoreBreakdownProps {
    userId?: number;
    compact?: boolean;
    showTips?: boolean;
    showHistory?: boolean;
    onFactorClick?: (factor: TrustFactor) => void;
}

// Fetch trust breakdown
const fetchTrustBreakdown = async (userId?: number) => {
    const url = userId
        ? `/api/v1/trust/breakdown/${userId}`
        : '/api/v1/trust/breakdown/me';

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch trust breakdown');
    return res.json();
};

// Tier configurations
const tierConfig: Record<string, { color: string; bg: string; border: string; icon: typeof Shield; minScore: number }> = {
    bronze: { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30', icon: Shield, minScore: 0 },
    silver: { color: 'text-slate-300', bg: 'bg-slate-400/20', border: 'border-slate-400/30', icon: Shield, minScore: 3 },
    gold: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', icon: Star, minScore: 5 },
    platinum: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', icon: Award, minScore: 7 },
    diamond: { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', icon: Zap, minScore: 9 }
};

// Status icons
const statusIcons: Record<string, { icon: typeof CheckCircle; color: string }> = {
    verified: { icon: CheckCircle, color: 'text-green-400' },
    pending: { icon: Clock, color: 'text-yellow-400' },
    unverified: { icon: XCircle, color: 'text-red-400' },
    partial: { icon: AlertTriangle, color: 'text-orange-400' }
};

// Factor icons
const factorIcons: Record<string, typeof Shield> = {
    identity_verification: User,
    account_age: Calendar,
    streaming_history: Camera,
    two_factor_auth: Lock,
    community_standing: Star,
    content_quality: Award,
    payment_history: Zap,
    verification_badges: Shield
};

// Circular progress gauge
function TrustGauge({ score, size = 120, tier }: { score: number; size?: number; tier: string }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 10) * circumference;
    const tierInfo = tierConfig[tier] || tierConfig.bronze;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="w-full h-full transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-700"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    className={`transition-all duration-1000 ${tierInfo.color}`}
                />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${tierInfo.color}`}>
                    {score.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-wider">{tier}</span>
            </div>
        </div>
    );
}

// Factor bar component
function FactorBar({ factor, onClick }: { factor: TrustFactor; onClick?: () => void }) {
    const Icon = factorIcons[factor.key] || Shield;
    const StatusIcon = statusIcons[factor.status]?.icon || XCircle;
    const statusColor = statusIcons[factor.status]?.color || 'text-slate-400';
    const weightedScore = factor.score * factor.weight;
    const contribution = (weightedScore * 100).toFixed(0);

    return (
        <div
            className={`p-3 bg-slate-700/30 rounded-lg ${onClick ? 'cursor-pointer hover:bg-slate-700/50' : ''} transition-colors`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-white font-medium">{factor.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                    <span className="text-xs text-slate-400">
                        {(factor.score * 100).toFixed(0)}% × {(factor.weight * 100).toFixed(0)}% = <span className="text-white font-medium">{contribution}%</span>
                    </span>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                <div
                    className={`h-full transition-all duration-500 ${factor.score >= 0.8 ? 'bg-green-500' :
                        factor.score >= 0.5 ? 'bg-yellow-500' :
                            'bg-red-500'
                        }`}
                    style={{ width: `${factor.score * 100}%` }}
                />
            </div>

            {/* Value and description */}
            <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-slate-500">{factor.description}</span>
                {factor.value && (
                    <span className="text-xs text-slate-400">
                        {factor.value}{factor.maxValue ? ` / ${factor.maxValue}` : ''}
                    </span>
                )}
            </div>

            {/* Action required */}
            {factor.actionRequired && (
                <div className="mt-2 pt-2 border-t border-slate-600">
                    <Button size="sm" variant="secondary" className="w-full text-xs">
                        {factor.actionRequired}
                    </Button>
                </div>
            )}
        </div>
    );
}

// Improvement tip component
function ImprovementTip({
    tip,
    impact,
    actionLink
}: {
    tip: string;
    impact: 'high' | 'medium' | 'low';
    actionLink?: string;
}) {
    const impactColors = {
        high: 'bg-green-500/20 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        low: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    return (
        <div className={`p-3 rounded-lg border ${impactColors[impact]} flex items-start gap-3`}>
            <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
                <p className="text-sm">{tip}</p>
                {actionLink && (
                    <a href={actionLink} className="text-xs underline mt-1 inline-block">
                        Take action →
                    </a>
                )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${impactColors[impact]}`}>
                {impact} impact
            </span>
        </div>
    );
}

// History sparkline
function HistorySparkline({ history }: { history: { date: string; score: number }[] }) {
    if (history.length < 2) return null;

    const width = 200;
    const height = 40;
    const min = Math.min(...history.map(h => h.score)) - 0.5;
    const max = Math.max(...history.map(h => h.score)) + 0.5;

    const points = history.map((h, i) => {
        const x = (i / (history.length - 1)) * width;
        const y = height - ((h.score - min) / (max - min)) * height;
        return `${x},${y}`;
    }).join(' ');

    const trend = history[history.length - 1].score >= history[0].score ? 'up' : 'down';
    const color = trend === 'up' ? '#22c55e' : '#ef4444';

    return (
        <div className="relative">
            <svg width={width} height={height} className="overflow-visible">
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>{history[0].date}</span>
                <span>{history[history.length - 1].date}</span>
            </div>
        </div>
    );
}

export function TrustScoreBreakdown({
    userId,
    compact = false,
    showTips = true,
    showHistory = true,
    onFactorClick
}: TrustScoreBreakdownProps) {
    const [expandedSection, setExpandedSection] = useState<'factors' | 'tips' | 'history' | null>('factors');

    const { data, isLoading } = useQuery({
        queryKey: ['trustBreakdown', userId],
        queryFn: () => fetchTrustBreakdown(userId),
        refetchInterval: 60000, // Refresh every minute
    });

    // Mock data for demo
    const mockData: TrustBreakdown = {
        user_id: userId || 0,
        overall_score: 7.4,
        tier: 'platinum',
        next_tier: { name: 'diamond', required_score: 9.0 },
        factors: [
            { name: 'Identity Verification', key: 'identity_verification', score: 1.0, weight: 0.25, status: 'verified', description: 'ID verified via government document', value: 'Verified' },
            { name: 'Account Age', key: 'account_age', score: 0.8, weight: 0.15, status: 'verified', description: 'Account created over 6 months ago', value: '245 days', maxValue: '365 days' },
            { name: 'Streaming History', key: 'streaming_history', score: 0.6, weight: 0.15, status: 'partial', description: 'Total hours streamed', value: '48 hours', maxValue: '100 hours', actionRequired: 'Stream 52 more hours' },
            { name: 'Two-Factor Auth', key: 'two_factor_auth', score: 0.0, weight: 0.10, status: 'unverified', description: 'Additional security layer', actionRequired: 'Enable 2FA' },
            { name: 'Community Standing', key: 'community_standing', score: 0.9, weight: 0.15, status: 'verified', description: 'Positive community interactions', value: '4.8 / 5.0' },
            { name: 'Content Quality', key: 'content_quality', score: 0.75, weight: 0.10, status: 'verified', description: 'Based on viewer engagement and retention', value: '75%' },
            { name: 'Payment History', key: 'payment_history', score: 1.0, weight: 0.10, status: 'verified', description: 'Successful payment transactions', value: '12 transactions' }
        ],
        improvement_tips: [
            { tip: 'Enable Two-Factor Authentication to boost your security score by 10%', impact: 'high', action_link: '/settings/security' },
            { tip: 'Stream 52 more hours to reach the next milestone', impact: 'medium', action_link: '/stream' },
            { tip: 'Complete your profile to improve trust visibility', impact: 'low', action_link: '/settings/profile' }
        ],
        history: [
            { date: '30d ago', score: 6.2 },
            { date: '25d ago', score: 6.5 },
            { date: '20d ago', score: 6.8 },
            { date: '15d ago', score: 7.0 },
            { date: '10d ago', score: 7.2 },
            { date: '5d ago', score: 7.3 },
            { date: 'Today', score: 7.4 }
        ],
        last_updated: new Date().toISOString()
    };

    const breakdown = data || mockData;
    const tierInfo = tierConfig[breakdown.tier] || tierConfig.bronze;
    const TierIcon = tierInfo.icon;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <Shield className="w-6 h-6 animate-pulse mr-2" />
                Loading trust score...
            </div>
        );
    }

    if (compact) {
        return (
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <TrustGauge score={breakdown.overall_score} size={80} tier={breakdown.tier} />
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <TierIcon className={`h-4 w-4 ${tierInfo.color}`} />
                        <span className={`text-sm font-medium ${tierInfo.color} capitalize`}>{breakdown.tier} Tier</span>
                    </div>
                    {breakdown.next_tier && (
                        <div className="text-xs text-slate-400">
                            {(breakdown.next_tier.required_score - breakdown.overall_score).toFixed(1)} points to {breakdown.next_tier.name}
                        </div>
                    )}
                    <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                        <div
                            className={`h-full ${tierInfo.bg.replace('/20', '')}`}
                            style={{ width: `${(breakdown.overall_score / 10) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with gauge */}
            <Card className={`bg-slate-800/50 border ${tierInfo.border} p-6`}>
                <div className="flex items-center gap-6">
                    <TrustGauge score={breakdown.overall_score} size={140} tier={breakdown.tier} />
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <TierIcon className={`h-6 w-6 ${tierInfo.color}`} />
                            <h2 className={`text-xl font-bold ${tierInfo.color} capitalize`}>{breakdown.tier} Tier</h2>
                        </div>
                        <p className="text-slate-400 text-sm mb-4">
                            Your trust score is calculated from {breakdown.factors.length} factors
                        </p>

                        {breakdown.next_tier && (
                            <div>
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Progress to {breakdown.next_tier.name}</span>
                                    <span>{breakdown.overall_score.toFixed(1)} / {breakdown.next_tier.required_score}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full bg-gradient-to-r ${tierInfo.color.replace('text-', 'from-')} to-purple-500 transition-all`}
                                        style={{
                                            width: `${((breakdown.overall_score - tierConfig[breakdown.tier].minScore) /
                                                (breakdown.next_tier.required_score - tierConfig[breakdown.tier].minScore)) * 100}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Factors section */}
            <Card className="bg-slate-800/50 border-slate-700">
                <button
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                    onClick={() => setExpandedSection(expandedSection === 'factors' ? null : 'factors')}
                >
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-purple-400" />
                        <h3 className="text-white font-medium">Trust Factors</h3>
                        <span className="text-xs text-slate-400">({breakdown.factors.length} factors)</span>
                    </div>
                    {expandedSection === 'factors' ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                </button>

                {expandedSection === 'factors' && (
                    <div className="px-4 pb-4 space-y-3">
                        {breakdown.factors.map((factor: TrustFactor) => (
                            <FactorBar
                                key={factor.key}
                                factor={factor}
                                onClick={onFactorClick ? () => onFactorClick(factor) : undefined}
                            />
                        ))}
                    </div>
                )}
            </Card>

            {/* Improvement tips */}
            {showTips && breakdown.improvement_tips.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                    <button
                        className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                        onClick={() => setExpandedSection(expandedSection === 'tips' ? null : 'tips')}
                    >
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-400" />
                            <h3 className="text-white font-medium">Improvement Tips</h3>
                            <span className="text-xs text-slate-400">({breakdown.improvement_tips.length} tips)</span>
                        </div>
                        {expandedSection === 'tips' ? (
                            <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                    </button>

                    {expandedSection === 'tips' && (
                        <div className="px-4 pb-4 space-y-3">
                            {breakdown.improvement_tips.map((tip: { tip: string; impact: 'high' | 'medium' | 'low'; action_link?: string }, idx: number) => (
                                <ImprovementTip
                                    key={idx}
                                    tip={tip.tip}
                                    impact={tip.impact}
                                    actionLink={tip.action_link}
                                />
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* History */}
            {showHistory && breakdown.history.length > 1 && (
                <Card className="bg-slate-800/50 border-slate-700">
                    <button
                        className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                        onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
                    >
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-400" />
                            <h3 className="text-white font-medium">Score History</h3>
                        </div>
                        {expandedSection === 'history' ? (
                            <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                    </button>

                    {expandedSection === 'history' && (
                        <div className="px-4 pb-4">
                            <HistorySparkline history={breakdown.history} />
                            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                Last updated: {new Date(breakdown.last_updated).toLocaleString()}
                            </p>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

export default TrustScoreBreakdown;
