import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Bot,
    Clock,
    Filter,
    Search,
    ChevronRight,
    ChevronDown,
    Download,
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Eye,
    User,
    Shield,
    TrendingUp,
    MessageSquare,
    DollarSign,
    Users
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface AgentDecision {
    id: string;
    timestamp: string;
    agent_type: 'orchestrator' | 'scout' | 'verify' | 'cluster' | 'moderation' | 'revenue' | 'support';
    action: string;
    target_type: 'user' | 'stream' | 'event' | 'transaction' | 'content' | 'system';
    target_id: string;
    decision: 'approve' | 'reject' | 'escalate' | 'defer' | 'auto';
    confidence: number;
    factors: { name: string; weight: number; value: string }[];
    outcome?: 'success' | 'failure' | 'pending';
    human_override?: boolean;
    notes?: string;
}

interface AuditFilters {
    agent_type: string;
    decision: string;
    date_from: string;
    date_to: string;
    search: string;
}

// Agent type config
const agentConfig: Record<string, { icon: typeof Bot; color: string; label: string }> = {
    orchestrator: { icon: Bot, color: 'text-purple-400', label: 'Orchestrator' },
    scout: { icon: Search, color: 'text-blue-400', label: 'Scout' },
    verify: { icon: Shield, color: 'text-green-400', label: 'Verify' },
    cluster: { icon: Users, color: 'text-cyan-400', label: 'Cluster' },
    moderation: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Moderation' },
    revenue: { icon: DollarSign, color: 'text-emerald-400', label: 'Revenue' },
    support: { icon: MessageSquare, color: 'text-pink-400', label: 'Support' }
};

const decisionConfig = {
    approve: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20' },
    reject: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
    escalate: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    defer: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/20' },
    auto: { icon: Bot, color: 'text-blue-400', bg: 'bg-blue-500/20' }
};

// Mock data
const mockDecisions: AgentDecision[] = [
    {
        id: 'dec-001',
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        agent_type: 'moderation',
        action: 'Content Review',
        target_type: 'stream',
        target_id: 'stream-12345',
        decision: 'approve',
        confidence: 0.94,
        factors: [
            { name: 'Toxicity Score', weight: 0.4, value: '0.12' },
            { name: 'User Trust', weight: 0.3, value: '85' },
            { name: 'Content Type', weight: 0.3, value: 'Gaming' }
        ],
        outcome: 'success'
    },
    {
        id: 'dec-002',
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        agent_type: 'verify',
        action: 'Identity Verification',
        target_type: 'user',
        target_id: 'user-67890',
        decision: 'escalate',
        confidence: 0.65,
        factors: [
            { name: 'Document Match', weight: 0.5, value: '72%' },
            { name: 'Face Match', weight: 0.3, value: '68%' },
            { name: 'Address Verify', weight: 0.2, value: 'Partial' }
        ],
        outcome: 'pending',
        notes: 'Document clarity issues, requires human review'
    },
    {
        id: 'dec-003',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        agent_type: 'revenue',
        action: 'Payout Processing',
        target_type: 'transaction',
        target_id: 'payout-11111',
        decision: 'approve',
        confidence: 0.99,
        factors: [
            { name: 'Amount', weight: 0.3, value: '$150.00' },
            { name: 'Account Age', weight: 0.3, value: '8 months' },
            { name: 'Fraud Score', weight: 0.4, value: '0.02' }
        ],
        outcome: 'success'
    },
    {
        id: 'dec-004',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        agent_type: 'cluster',
        action: 'Event Merge',
        target_type: 'event',
        target_id: 'event-22222',
        decision: 'auto',
        confidence: 0.88,
        factors: [
            { name: 'Geo Distance', weight: 0.4, value: '0.3 km' },
            { name: 'Time Overlap', weight: 0.3, value: '95%' },
            { name: 'Content Similarity', weight: 0.3, value: '0.82' }
        ],
        outcome: 'success'
    }
];

// Decision row component
function DecisionRow({ decision, expanded, onToggle }: {
    decision: AgentDecision;
    expanded: boolean;
    onToggle: () => void;
}) {
    const agent = agentConfig[decision.agent_type];
    const decisionStyle = decisionConfig[decision.decision];
    const AgentIcon = agent.icon;
    const DecisionIcon = decisionStyle.icon;

    const timeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
            >
                <div className={`p-2 rounded-lg bg-slate-700`}>
                    <AgentIcon className={`w-4 h-4 ${agent.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{decision.action}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${decisionStyle.bg} ${decisionStyle.color}`}>
                            {decision.decision.toUpperCase()}
                        </span>
                        {decision.human_override && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                                HITL Override
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-slate-400">
                        {agent.label} → {decision.target_type}: {decision.target_id}
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-400">{timeAgo(decision.timestamp)}</div>
                    <div className="text-xs text-slate-500">
                        Confidence: {(decision.confidence * 100).toFixed(0)}%
                    </div>
                </div>
                {expanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
            </button>

            {expanded && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-700 space-y-3">
                    <div>
                        <div className="text-xs text-slate-500 mb-2">DECISION FACTORS</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {decision.factors.map((factor, idx) => (
                                <div key={idx} className="bg-slate-800 rounded p-2">
                                    <div className="text-xs text-slate-400">{factor.name}</div>
                                    <div className="text-white font-medium">{factor.value}</div>
                                    <div className="text-xs text-slate-500">
                                        Weight: {(factor.weight * 100).toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {decision.notes && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                            <div className="text-xs text-yellow-400 mb-1">NOTES</div>
                            <div className="text-sm text-yellow-200">{decision.notes}</div>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Decision ID: {decision.id}</span>
                        <span>Timestamp: {new Date(decision.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export function AgentAuditLog() {
    const [filters, setFilters] = useState<AuditFilters>({
        agent_type: '',
        decision: '',
        date_from: '',
        date_to: '',
        search: ''
    });
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['agentAudit', filters],
        queryFn: async () => {
            // Would fetch from API
            return { decisions: mockDecisions, total: mockDecisions.length };
        }
    });

    const decisions = data?.decisions || [];

    const exportToCsv = () => {
        const headers = ['ID', 'Timestamp', 'Agent', 'Action', 'Target', 'Decision', 'Confidence'];
        const rows = decisions.map(d => [
            d.id, d.timestamp, d.agent_type, d.action,
            `${d.target_type}:${d.target_id}`, d.decision, d.confidence
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-audit-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Stats
    const stats = {
        total: decisions.length,
        approved: decisions.filter(d => d.decision === 'approve').length,
        escalated: decisions.filter(d => d.decision === 'escalate').length,
        avgConfidence: decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length || 0
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Bot className="h-6 w-6 text-purple-400" />
                        Agent Decision Audit Log
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Review and analyze all AI agent decisions with full transparency
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Refresh
                    </Button>
                    <Button variant="secondary" onClick={exportToCsv}>
                        <Download className="w-4 h-4 mr-1" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                    <div className="text-xs text-slate-500">Total Decisions</div>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
                    <div className="text-xs text-slate-500">Auto-Approved</div>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-yellow-400">{stats.escalated}</div>
                    <div className="text-xs text-slate-500">Escalated to Human</div>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-white">{(stats.avgConfidence * 100).toFixed(0)}%</div>
                    <div className="text-xs text-slate-500">Avg Confidence</div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-white font-medium w-full"
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {showFilters ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>

                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Agent Type</label>
                            <select
                                value={filters.agent_type}
                                onChange={(e) => setFilters({ ...filters, agent_type: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            >
                                <option value="">All Agents</option>
                                {Object.entries(agentConfig).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Decision</label>
                            <select
                                value={filters.decision}
                                onChange={(e) => setFilters({ ...filters, decision: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            >
                                <option value="">All Decisions</option>
                                <option value="approve">Approved</option>
                                <option value="reject">Rejected</option>
                                <option value="escalate">Escalated</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Search</label>
                            <input
                                type="text"
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                placeholder="Search ID, target..."
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Date Range</label>
                            <input
                                type="date"
                                value={filters.date_from}
                                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            />
                        </div>
                    </div>
                )}
            </Card>

            {/* Decision list */}
            <div className="space-y-2">
                {isLoading ? (
                    <div className="text-center py-12 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading decisions...
                    </div>
                ) : decisions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No decisions found
                    </div>
                ) : (
                    decisions.map(decision => (
                        <DecisionRow
                            key={decision.id}
                            decision={decision}
                            expanded={expandedId === decision.id}
                            onToggle={() => setExpandedId(expandedId === decision.id ? null : decision.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default AgentAuditLog;
