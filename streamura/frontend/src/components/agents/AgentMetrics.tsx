import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    CheckCircle,
    XCircle,
    Clock,
    Activity,
    BarChart3,
    Users,
    Zap
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

// Types
interface AgentStats {
    agent_type: string;
    total_decisions: number;
    decisions_today: number;
    approval_rate: number; // 0-1, percentage of approved decisions
    auto_approved: number;
    human_approved: number;
    rejected: number;
    avg_confidence: number;
    avg_execution_time_ms: number;
    success_rate: number; // 0-1, percentage of successful executions
}

interface AgentMetricsProps {
    agentType?: string; // Filter by agent type, or show all
    timeRange?: '24h' | '7d' | '30d';
    compact?: boolean;
}

// Fetch agent metrics
const fetchAgentMetrics = async (agentType?: string, timeRange?: string) => {
    const params = new URLSearchParams();
    if (agentType) params.set('agent_type', agentType);
    if (timeRange) params.set('time_range', timeRange);

    const res = await fetch(`/api/v1/admin/agents/metrics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
};

// Agent colors
const agentColors: Record<string, string> = {
    orchestrator: 'purple',
    discovery: 'blue',
    moderation: 'red',
    payout: 'green',
    trust: 'yellow',
    licensing: 'cyan',
    emergency: 'orange'
};

// Sparkline chart component
function Sparkline({
    data,
    color = 'purple',
    width = 80,
    height = 24
}: {
    data: number[];
    color?: string;
    width?: number;
    height?: number;
}) {
    const points = useMemo(() => {
        if (data.length < 2) return '';

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        return data.map((value, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * (height - 4);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }, [data, width, height]);

    const colorMap: Record<string, string> = {
        purple: '#a855f7',
        blue: '#3b82f6',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        cyan: '#06b6d4',
        orange: '#f97316'
    };

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path
                d={points}
                fill="none"
                stroke={colorMap[color] || '#a855f7'}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// Single metric card
function MetricCard({
    label,
    value,
    subValue,
    icon: Icon,
    trend,
    color = 'slate'
}: {
    label: string;
    value: string | number;
    subValue?: string;
    icon: typeof Activity;
    trend?: 'up' | 'down' | 'stable';
    color?: string;
}) {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400';

    const colorClasses: Record<string, { bg: string; text: string }> = {
        purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
        blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
        green: { bg: 'bg-green-500/20', text: 'text-green-400' },
        red: { bg: 'bg-red-500/20', text: 'text-red-400' },
        yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
        slate: { bg: 'bg-slate-700', text: 'text-slate-400' }
    };

    const colors = colorClasses[color] || colorClasses.slate;

    return (
        <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                {trend && <TrendIcon className={`h-4 w-4 ${trendColor}`} />}
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-sm text-slate-400">{label}</div>
            {subValue && <div className="text-xs text-slate-500 mt-1">{subValue}</div>}
        </div>
    );
}

// Agent row in the metrics table
function AgentMetricRow({ stats, showSparkline = true }: { stats: AgentStats; showSparkline?: boolean }) {
    const color = agentColors[stats.agent_type] || 'purple';

    // Generate mock sparkline data
    const sparklineData = useMemo(() =>
        Array.from({ length: 12 }, () => Math.random() * 50 + 50),
        []);

    return (
        <div className="flex items-center gap-4 p-4 bg-slate-700/20 rounded-lg hover:bg-slate-700/40 transition-colors">
            <div className={`w-2 h-12 rounded-full bg-${color}-500`} />

            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium capitalize">{stats.agent_type}</span>
                    <span className="text-xs text-slate-500">Agent</span>
                </div>
                <div className="text-sm text-slate-400">
                    {stats.decisions_today} decisions today
                </div>
            </div>

            {showSparkline && (
                <div className="hidden md:block">
                    <Sparkline data={sparklineData} color={color} width={100} height={28} />
                </div>
            )}

            <div className="text-right">
                <div className="text-lg font-bold text-white">{stats.total_decisions.toLocaleString()}</div>
                <div className="text-xs text-slate-500">total decisions</div>
            </div>

            <div className="w-20 text-center">
                <div className={`text-lg font-bold ${stats.approval_rate > 0.9 ? 'text-green-400' : stats.approval_rate > 0.7 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(stats.approval_rate * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-500">approved</div>
            </div>

            <div className="w-20 text-center">
                <div className={`text-lg font-bold ${stats.success_rate > 0.95 ? 'text-green-400' : stats.success_rate > 0.8 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(stats.success_rate * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500">success</div>
            </div>

            <div className="w-16 text-center">
                <div className="text-lg font-bold text-blue-400">{stats.avg_execution_time_ms}ms</div>
                <div className="text-xs text-slate-500">avg time</div>
            </div>
        </div>
    );
}

export function AgentMetrics({ agentType, timeRange = '24h', compact = false }: AgentMetricsProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['agentMetrics', agentType, timeRange],
        queryFn: () => fetchAgentMetrics(agentType, timeRange),
        refetchInterval: 30000, // Refresh every 30s
    });

    // Calculate aggregate stats
    const aggregateStats = useMemo(() => {
        if (!data?.agents) return null;

        const agents: AgentStats[] = data.agents;
        return {
            totalDecisions: agents.reduce((sum, a) => sum + a.total_decisions, 0),
            decisionsToday: agents.reduce((sum, a) => sum + a.decisions_today, 0),
            avgApprovalRate: agents.reduce((sum, a) => sum + a.approval_rate, 0) / agents.length,
            avgSuccessRate: agents.reduce((sum, a) => sum + a.success_rate, 0) / agents.length,
            avgConfidence: agents.reduce((sum, a) => sum + a.avg_confidence, 0) / agents.length,
            totalRejected: agents.reduce((sum, a) => sum + a.rejected, 0)
        };
    }, [data]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <Activity className="w-6 h-6 animate-spin mr-2" />
                Loading agent metrics...
            </div>
        );
    }

    if (error || !data?.agents) {
        // Mock data for demo
        const mockAgents: AgentStats[] = [
            { agent_type: 'moderation', total_decisions: 12543, decisions_today: 342, approval_rate: 0.94, auto_approved: 11890, human_approved: 512, rejected: 141, avg_confidence: 0.87, avg_execution_time_ms: 45, success_rate: 0.98 },
            { agent_type: 'discovery', total_decisions: 8721, decisions_today: 156, approval_rate: 0.97, auto_approved: 8421, human_approved: 243, rejected: 57, avg_confidence: 0.92, avg_execution_time_ms: 112, success_rate: 0.99 },
            { agent_type: 'payout', total_decisions: 4532, decisions_today: 89, approval_rate: 0.88, auto_approved: 3890, human_approved: 532, rejected: 110, avg_confidence: 0.79, avg_execution_time_ms: 234, success_rate: 0.96 },
            { agent_type: 'trust', total_decisions: 6234, decisions_today: 124, approval_rate: 0.91, auto_approved: 5612, human_approved: 478, rejected: 144, avg_confidence: 0.85, avg_execution_time_ms: 67, success_rate: 0.97 },
            { agent_type: 'licensing', total_decisions: 1245, decisions_today: 23, approval_rate: 0.82, auto_approved: 987, human_approved: 198, rejected: 60, avg_confidence: 0.76, avg_execution_time_ms: 189, success_rate: 0.94 },
            { agent_type: 'emergency', total_decisions: 234, decisions_today: 12, approval_rate: 0.95, auto_approved: 156, human_approved: 67, rejected: 11, avg_confidence: 0.91, avg_execution_time_ms: 23, success_rate: 0.99 }
        ];

        const mockAgg = {
            totalDecisions: mockAgents.reduce((s, a) => s + a.total_decisions, 0),
            decisionsToday: mockAgents.reduce((s, a) => s + a.decisions_today, 0),
            avgApprovalRate: mockAgents.reduce((s, a) => s + a.approval_rate, 0) / mockAgents.length,
            avgSuccessRate: mockAgents.reduce((s, a) => s + a.success_rate, 0) / mockAgents.length,
            avgConfidence: mockAgents.reduce((s, a) => s + a.avg_confidence, 0) / mockAgents.length,
            totalRejected: mockAgents.reduce((s, a) => s + a.rejected, 0)
        };

        if (compact) {
            return (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCard label="Total Decisions" value={mockAgg.totalDecisions.toLocaleString()} icon={BarChart3} color="purple" />
                    <MetricCard label="Approval Rate" value={`${(mockAgg.avgApprovalRate * 100).toFixed(0)}%`} icon={CheckCircle} color="green" />
                    <MetricCard label="Success Rate" value={`${(mockAgg.avgSuccessRate * 100).toFixed(1)}%`} icon={Zap} color="blue" />
                    <MetricCard label="Rejected" value={mockAgg.totalRejected} icon={XCircle} color="red" />
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <MetricCard label="Total Decisions" value={mockAgg.totalDecisions.toLocaleString()} subValue="all time" icon={BarChart3} color="purple" trend="up" />
                    <MetricCard label="Today" value={mockAgg.decisionsToday} subValue="decisions" icon={Clock} color="blue" trend="up" />
                    <MetricCard label="Approval Rate" value={`${(mockAgg.avgApprovalRate * 100).toFixed(0)}%`} icon={CheckCircle} color="green" />
                    <MetricCard label="Success Rate" value={`${(mockAgg.avgSuccessRate * 100).toFixed(1)}%`} icon={Zap} color="blue" />
                    <MetricCard label="Avg Confidence" value={`${(mockAgg.avgConfidence * 100).toFixed(0)}%`} icon={Activity} color="yellow" />
                    <MetricCard label="Rejected" value={mockAgg.totalRejected} icon={XCircle} color="red" />
                </div>

                {/* Agent breakdown */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="text-white font-medium flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-400" />
                            Agent Performance
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {mockAgents.map((agent) => (
                            <AgentMetricRow key={agent.agent_type} stats={agent} />
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    // Real data rendering
    const agents: AgentStats[] = data.agents;

    if (compact) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Total Decisions" value={aggregateStats?.totalDecisions.toLocaleString() || '0'} icon={BarChart3} color="purple" />
                <MetricCard label="Approval Rate" value={`${((aggregateStats?.avgApprovalRate || 0) * 100).toFixed(0)}%`} icon={CheckCircle} color="green" />
                <MetricCard label="Success Rate" value={`${((aggregateStats?.avgSuccessRate || 0) * 100).toFixed(1)}%`} icon={Zap} color="blue" />
                <MetricCard label="Rejected" value={aggregateStats?.totalRejected || 0} icon={XCircle} color="red" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <MetricCard label="Total Decisions" value={aggregateStats?.totalDecisions.toLocaleString() || '0'} subValue="all time" icon={BarChart3} color="purple" trend="up" />
                <MetricCard label="Today" value={aggregateStats?.decisionsToday || 0} subValue="decisions" icon={Clock} color="blue" trend="up" />
                <MetricCard label="Approval Rate" value={`${((aggregateStats?.avgApprovalRate || 0) * 100).toFixed(0)}%`} icon={CheckCircle} color="green" />
                <MetricCard label="Success Rate" value={`${((aggregateStats?.avgSuccessRate || 0) * 100).toFixed(1)}%`} icon={Zap} color="blue" />
                <MetricCard label="Avg Confidence" value={`${((aggregateStats?.avgConfidence || 0) * 100).toFixed(0)}%`} icon={Activity} color="yellow" />
                <MetricCard label="Rejected" value={aggregateStats?.totalRejected || 0} icon={XCircle} color="red" />
            </div>

            {/* Agent breakdown */}
            <Card className="bg-slate-800/50 border-slate-700">
                <div className="p-4 border-b border-slate-700">
                    <h3 className="text-white font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-purple-400" />
                        Agent Performance
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {agents.map((agent) => (
                        <AgentMetricRow key={agent.agent_type} stats={agent} />
                    ))}
                </div>
            </Card>
        </div>
    );
}

export default AgentMetrics;
