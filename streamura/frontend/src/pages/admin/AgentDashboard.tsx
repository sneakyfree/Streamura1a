import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Bot,
    Shield,
    AlertTriangle,
    DollarSign,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    ChevronDown,
    ChevronRight,
    Activity,
    RefreshCw,
    Loader2,
    Star,
    Eye,
    FileText,
    UserCheck,
    BarChart3
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { AgentMetrics } from '@/components/agents';

interface AgentAction {
    action_id: string;
    agent_type: string;
    action_type: string;
    target_entity: string;
    target_id: number | null;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    reasoning: string;
    confidence: number;
    risk_level: string;
    requires_approval: boolean;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
}

interface AgentPolicy {
    can_do: string[];
    cannot_do: string[];
    requires_approval_for: string[];
}

const agentConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    moderation: { icon: Shield, color: 'text-blue-400', label: 'Moderation' },
    discovery: { icon: Search, color: 'text-purple-400', label: 'Discovery' },
    trust: { icon: Star, color: 'text-yellow-400', label: 'Trust' },
    emergency: { icon: AlertTriangle, color: 'text-red-400', label: 'Emergency' },
    payout: { icon: DollarSign, color: 'text-green-400', label: 'Payout' },
    licensing: { icon: FileText, color: 'text-cyan-400', label: 'Licensing' },
};

const riskColors: Record<string, string> = {
    low: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
};

export function AgentDashboard() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [expandedAction, setExpandedAction] = useState<string | null>(null);

    const { data: actionLog, isLoading: logLoading, refetch } = useQuery({
        queryKey: ['agents', 'log', selectedAgent],
        queryFn: async () => {
            const params = selectedAgent ? `?agent_type=${selectedAgent}&limit=50` : '?limit=50';
            const response = await api.get(`/agents/log${params}`);
            return response.data;
        },
        refetchInterval: 10000,
    });

    const { data: policies } = useQuery({
        queryKey: ['agents', 'policies'],
        queryFn: async () => {
            const response = await api.get('/agents/policies');
            return response.data.policies as Record<string, AgentPolicy>;
        },
    });

    const approvalMutation = useMutation({
        mutationFn: async ({ actionId, approved, notes }: { actionId: string; approved: boolean; notes?: string }) => {
            const response = await api.post(`/agents/approve/${actionId}`, { approved, notes });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents', 'log'] });
        },
    });

    if (!user?.is_admin) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                    <p className="text-slate-400">Admin privileges required.</p>
                </div>
            </div>
        );
    }

    const actions = (actionLog?.actions || []) as AgentAction[];
    const pendingApprovals = actions.filter(a => a.requires_approval && !a.approved_by);

    return (
        <div className="min-h-screen bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Bot className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Agent Dashboard</h1>
                            <p className="text-slate-400">Monitor and control AI agents</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/admin/hitl-queue">
                            <Button variant="secondary">
                                <UserCheck className="h-4 w-4 mr-2" />
                                HITL Queue
                            </Button>
                        </Link>
                        <Button variant="secondary" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Agent Metrics Section */}
                <Card className="mb-8 bg-slate-800/50 border-slate-700">
                    <CardHeader className="flex flex-row items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-white">Agent Performance Metrics</h2>
                    </CardHeader>
                    <CardContent>
                        <AgentMetrics compact />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                    {Object.entries(agentConfig).map(([key, config]) => {
                        const Icon = config.icon;
                        const isSelected = selectedAgent === key;
                        const agentActions = actions.filter(a => a.agent_type === key);

                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedAgent(isSelected ? null : key)}
                                className={`p-4 rounded-xl border-2 transition-all ${isSelected
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                    }`}
                            >
                                <Icon className={`h-8 w-8 ${config.color} mx-auto mb-2`} />
                                <p className="text-white font-medium">{config.label}</p>
                                <p className="text-xs text-slate-400">{agentActions.length} actions</p>
                            </button>
                        );
                    })}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-yellow-400" />
                                <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
                            </div>
                            {pendingApprovals.length > 0 && (
                                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-medium">
                                    {pendingApprovals.length} pending
                                </span>
                            )}
                        </CardHeader>
                        <CardContent>
                            {pendingApprovals.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
                                    <p>No pending approvals</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingApprovals.slice(0, 5).map((action) => {
                                        const cfg = agentConfig[action.agent_type] || { icon: Bot, color: 'text-slate-400', label: action.agent_type };
                                        const Icon = cfg.icon;

                                        return (
                                            <div key={action.action_id} className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                                                        <span className="text-white font-medium">{action.action_type}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[action.risk_level]}`}>
                                                            {action.risk_level}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-400 mb-3">{action.reasoning}</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-500">
                                                        Target: {action.target_entity} #{action.target_id}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => approvalMutation.mutate({
                                                                actionId: action.action_id,
                                                                approved: false,
                                                                notes: 'Rejected by admin'
                                                            })}
                                                            disabled={approvalMutation.isPending}
                                                        >
                                                            <XCircle className="h-4 w-4 mr-1" />
                                                            Reject
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => approvalMutation.mutate({
                                                                actionId: action.action_id,
                                                                approved: true,
                                                                notes: 'Approved by admin'
                                                            })}
                                                            disabled={approvalMutation.isPending}
                                                        >
                                                            <CheckCircle className="h-4 w-4 mr-1" />
                                                            Approve
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary-400" />
                                Agent Policies
                            </h2>
                        </CardHeader>
                        <CardContent>
                            {selectedAgent && policies?.[selectedAgent] ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-green-400 mb-2">Can Do</h3>
                                        <ul className="space-y-1">
                                            {policies[selectedAgent].can_do.slice(0, 5).map((act) => (
                                                <li key={act} className="text-xs text-slate-400 flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                                    {act.replace(/_/g, ' ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-red-400 mb-2">Cannot Do</h3>
                                        <ul className="space-y-1">
                                            {policies[selectedAgent].cannot_do.map((act) => (
                                                <li key={act} className="text-xs text-slate-400 flex items-center gap-1">
                                                    <XCircle className="h-3 w-3 text-red-500" />
                                                    {act.replace(/_/g, ' ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-yellow-400 mb-2">Requires Approval</h3>
                                        <ul className="space-y-1">
                                            {policies[selectedAgent].requires_approval_for.map((act) => (
                                                <li key={act} className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-yellow-500" />
                                                    {act.replace(/_/g, ' ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Select an agent to view policies</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="mt-6">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary-400" />
                            <h2 className="text-lg font-semibold text-white">
                                Action Log
                                {selectedAgent && (
                                    <span className="text-slate-400 font-normal"> - {agentConfig[selectedAgent]?.label}</span>
                                )}
                            </h2>
                        </div>
                        <span className="text-sm text-slate-400">{actions.length} actions</span>
                    </CardHeader>
                    <CardContent>
                        {logLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
                            </div>
                        ) : actions.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>No agent actions recorded yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {actions.slice(0, 20).map((action) => {
                                    const cfg = agentConfig[action.agent_type] || { icon: Bot, color: 'text-slate-400', label: action.agent_type };
                                    const Icon = cfg.icon;
                                    const isExpanded = expandedAction === action.action_id;

                                    return (
                                        <div key={action.action_id} className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                                            <button
                                                onClick={() => setExpandedAction(isExpanded ? null : action.action_id)}
                                                className="w-full p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                                                    <span className="text-white text-sm">{action.action_type.replace(/_/g, ' ')}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${riskColors[action.risk_level]}`}>
                                                        {action.risk_level}
                                                    </span>
                                                    {action.approved_by && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(action.created_at).toLocaleTimeString()}
                                                    </span>
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-slate-700/50">
                                                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                                                        <div>
                                                            <h4 className="text-xs font-medium text-slate-400 mb-1">Reasoning</h4>
                                                            <p className="text-sm text-white">{action.reasoning || 'No reasoning provided'}</p>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-medium text-slate-400 mb-1">Confidence</h4>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary-500"
                                                                        style={{ width: `${action.confidence * 100}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-slate-400">
                                                                    {(action.confidence * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {Object.keys(action.outputs).length > 0 && (
                                                        <div className="mt-3">
                                                            <h4 className="text-xs font-medium text-slate-400 mb-1">Output</h4>
                                                            <pre className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded overflow-x-auto">
                                                                {JSON.stringify(action.outputs, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
