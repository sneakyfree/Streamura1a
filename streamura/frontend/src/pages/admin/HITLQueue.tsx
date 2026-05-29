/**
 * HITL Queue - Human-in-the-Loop Approval Queue
 * 
 * Admin interface for reviewing and approving autonomous agent decisions.
 * Part of Sprint 1: Content Safety Layer.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Shield,
    ChevronLeft,
    Loader2,
    Check,
    X,
    Clock,
    Bot,
    AlertTriangle,
    AlertCircle,
    Zap,
    TrendingUp,
    Eye,
    FileText,
    Target,
    Play,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';

// API client for HITL endpoints
const hitlApi = {
    getQueue: async (params: { category?: string; priority?: string; limit?: number; offset?: number }) => {
        const searchParams = new URLSearchParams();
        if (params.category) searchParams.set('category', params.category);
        if (params.priority) searchParams.set('priority', params.priority);
        if (params.limit) searchParams.set('limit', params.limit.toString());
        if (params.offset) searchParams.set('offset', params.offset.toString());

        const response = await fetch(`/api/v1/admin/hitl/queue?${searchParams}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch HITL queue');
        return response.json();
    },

    assignItem: async (queueId: number) => {
        const response = await fetch(`/api/v1/admin/hitl/queue/${queueId}/assign`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        });
        if (!response.ok) throw new Error('Failed to assign item');
        return response.json();
    },

    approveDecision: async (decisionId: number, notes?: string) => {
        const response = await fetch(`/api/v1/admin/hitl/decisions/${decisionId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notes }),
        });
        if (!response.ok) throw new Error('Failed to approve decision');
        return response.json();
    },

    rejectDecision: async (decisionId: number, notes: string) => {
        const response = await fetch(`/api/v1/admin/hitl/decisions/${decisionId}/reject`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notes }),
        });
        if (!response.ok) throw new Error('Failed to reject decision');
        return response.json();
    },

    executeDecision: async (decisionId: number) => {
        const response = await fetch(`/api/v1/admin/hitl/decisions/${decisionId}/execute`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        });
        if (!response.ok) throw new Error('Failed to execute decision');
        return response.json();
    },

    getAuditTrail: async (params: { agent_name?: string; limit?: number; offset?: number }) => {
        const searchParams = new URLSearchParams();
        if (params.agent_name) searchParams.set('agent_name', params.agent_name);
        if (params.limit) searchParams.set('limit', params.limit.toString());
        if (params.offset) searchParams.set('offset', params.offset.toString());

        const response = await fetch(`/api/v1/admin/hitl/audit-trail?${searchParams}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch audit trail');
        return response.json();
    },
};

interface HITLQueueItem {
    queue_id: number;
    decision_id: number;
    agent_name: string;
    action_type: string;
    target_type: string;
    target_id: number;
    reasoning: string;
    confidence: number;
    factors: Record<string, { weight: number; score: number; value: string }> | null;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    category: string;
    status: string;
    timeout_at: string | null;
    created_at: string;
    assigned_to: number | null;
}

interface AuditDecision {
    id: number;
    agent_name: string;
    action_type: string;
    action_category: string;
    target_type: string;
    target_id: number;
    reasoning: string;
    confidence: number;
    requires_approval: boolean;
    approved: boolean | null;
    approved_by: number | null;
    status: string;
    created_at: string;
    executed_at: string | null;
}

const PRIORITY_COLORS = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    normal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

const PRIORITY_ICONS = {
    urgent: AlertCircle,
    high: AlertTriangle,
    normal: Clock,
    low: Target,
};

const AGENT_ICONS: Record<string, typeof Bot> = {
    orchestrator: Zap,
    moderation: Shield,
    revenue: TrendingUp,
    scout: Eye,
    default: Bot,
};

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    approved: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
    executed: 'bg-blue-500/10 text-blue-400',
    expired: 'bg-slate-500/10 text-slate-400',
};

export function HITLQueue() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();

    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<HITLQueueItem | null>(null);
    const [actionModal, setActionModal] = useState<'review' | 'audit' | null>(null);
    const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
    const [reviewNotes, setReviewNotes] = useState('');

    // Query HITL queue
    const { data: queueData, isLoading: queueLoading } = useQuery({
        queryKey: ['admin', 'hitl-queue', priorityFilter, categoryFilter],
        queryFn: () => hitlApi.getQueue({
            priority: priorityFilter || undefined,
            category: categoryFilter || undefined,
            limit: 50,
        }),
        enabled: !!currentUser?.is_admin,
        refetchInterval: 10000, // Poll every 10 seconds for real-time updates
    });

    // Query audit trail
    const { data: auditData, isLoading: auditLoading } = useQuery({
        queryKey: ['admin', 'hitl-audit'],
        queryFn: () => hitlApi.getAuditTrail({ limit: 20 }),
        enabled: !!currentUser?.is_admin && actionModal === 'audit',
    });

    // Mutations
    const assignMutation = useMutation({
        mutationFn: hitlApi.assignItem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'hitl-queue'] });
        },
    });

    const approveMutation = useMutation({
        mutationFn: ({ decisionId, notes }: { decisionId: number; notes?: string }) =>
            hitlApi.approveDecision(decisionId, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'hitl-queue'] });
            closeModal();
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ decisionId, notes }: { decisionId: number; notes: string }) =>
            hitlApi.rejectDecision(decisionId, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'hitl-queue'] });
            closeModal();
        },
    });

    const executeMutation = useMutation({
        mutationFn: hitlApi.executeDecision,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'hitl-queue'] });
        },
    });

    const closeModal = () => {
        setActionModal(null);
        setSelectedItem(null);
        setReviewAction('approve');
        setReviewNotes('');
    };

    const handleReview = () => {
        if (!selectedItem) return;

        if (reviewAction === 'approve') {
            approveMutation.mutate({
                decisionId: selectedItem.decision_id,
                notes: reviewNotes || undefined,
            });
        } else {
            if (!reviewNotes.trim()) {
                alert('Rejection notes are required');
                return;
            }
            rejectMutation.mutate({
                decisionId: selectedItem.decision_id,
                notes: reviewNotes,
            });
        }
    };

    const getTimeRemaining = (timeoutAt: string | null): string => {
        if (!timeoutAt) return 'No timeout';
        const timeout = new Date(timeoutAt);
        const now = new Date();
        const diff = timeout.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <Shield className="h-12 w-12 text-primary-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-white mb-2">Sign in to continue</h1>
                    <p className="text-slate-400">The HITL queue requires an authenticated admin.</p>
                </div>
            </div>
        );
    }
    if (!currentUser?.is_admin) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400">You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    const AgentIcon = (agentName: string) => {
        const IconComponent = AGENT_ICONS[agentName] || AGENT_ICONS.default;
        return <IconComponent className="h-4 w-4" />;
    };

    const PriorityIcon = (priority: string) => {
        const IconComponent = PRIORITY_ICONS[priority as keyof typeof PRIORITY_ICONS] || Clock;
        return <IconComponent className="h-3 w-3" />;
    };

    const queueItems = queueData?.items || [];
    const auditDecisions = auditData?.decisions || [];

    return (
        <div className="min-h-screen bg-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/admin">
                            <Button variant="secondary" size="sm">
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Bot className="h-6 w-6 text-primary-500" />
                                HITL Approval Queue
                            </h1>
                            <p className="text-slate-400">Review and approve autonomous agent decisions</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setActionModal('audit')}>
                            <FileText className="h-4 w-4 mr-2" />
                            Audit Trail
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    <Card className="bg-red-500/10 border-red-500/30">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-red-400 text-sm">Urgent</p>
                                    <p className="text-2xl font-bold text-white">
                                        {queueItems.filter((i: HITLQueueItem) => i.priority === 'urgent').length}
                                    </p>
                                </div>
                                <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-500/10 border-orange-500/30">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-400 text-sm">High</p>
                                    <p className="text-2xl font-bold text-white">
                                        {queueItems.filter((i: HITLQueueItem) => i.priority === 'high').length}
                                    </p>
                                </div>
                                <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-500/10 border-blue-500/30">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-400 text-sm">Normal</p>
                                    <p className="text-2xl font-bold text-white">
                                        {queueItems.filter((i: HITLQueueItem) => i.priority === 'normal').length}
                                    </p>
                                </div>
                                <Clock className="h-8 w-8 text-blue-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-500/10 border-slate-500/30">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-400 text-sm">Total Pending</p>
                                    <p className="text-2xl font-bold text-white">{queueData?.total || 0}</p>
                                </div>
                                <Target className="h-8 w-8 text-slate-500 opacity-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <div className="flex gap-1">
                        {['', 'urgent', 'high', 'normal', 'low'].map((priority) => (
                            <Button
                                key={priority}
                                variant={priorityFilter === priority ? 'default' : 'secondary'}
                                size="sm"
                                onClick={() => setPriorityFilter(priority)}
                            >
                                {priority || 'All'}
                            </Button>
                        ))}
                    </div>
                    <select
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm text-white"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="account_action">Account Actions</option>
                        <option value="payout">Payouts</option>
                        <option value="content_removal">Content Removal</option>
                        <option value="legal">Legal</option>
                        <option value="emergency">Emergency</option>
                    </select>
                </div>

                {/* Queue */}
                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Pending Approvals
                        </h2>
                    </CardHeader>
                    <CardContent>
                        {queueLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                            </div>
                        ) : queueItems.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Check className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg">All clear!</p>
                                <p className="text-sm">No pending approvals at this time</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {queueItems.map((item: HITLQueueItem) => (
                                    <div
                                        key={item.queue_id}
                                        className={`p-4 rounded-lg border ${PRIORITY_COLORS[item.priority]} transition-all hover:scale-[1.01]`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                {/* Agent Icon */}
                                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                                    {AgentIcon(item.agent_name)}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="font-semibold text-white capitalize">
                                                            {item.action_type.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${PRIORITY_COLORS[item.priority]}`}>
                                                            {PriorityIcon(item.priority)}
                                                            {item.priority}
                                                        </span>
                                                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                                            {item.category}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-slate-300 mb-2">
                                                        <span className="text-slate-500">Agent:</span>{' '}
                                                        <span className="font-medium capitalize">{item.agent_name}</span>
                                                        {' • '}
                                                        <span className="text-slate-500">Target:</span>{' '}
                                                        <span className="font-medium">{item.target_type} #{item.target_id}</span>
                                                    </p>

                                                    <p className="text-sm text-slate-400 bg-slate-800/50 p-2 rounded mb-2">
                                                        {item.reasoning}
                                                    </p>

                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <TrendingUp className="h-3 w-3" />
                                                            Confidence: {((item.confidence || 0) * 100).toFixed(0)}%
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            Timeout: {getTimeRemaining(item.timeout_at)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(item.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        assignMutation.mutate(item.queue_id);
                                                        setSelectedItem(item);
                                                        setReviewAction('approve');
                                                        setActionModal('review');
                                                    }}
                                                >
                                                    <Check className="h-4 w-4 text-green-400" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setReviewAction('reject');
                                                        setActionModal('review');
                                                    }}
                                                >
                                                    <X className="h-4 w-4 text-red-400" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={executeMutation.isPending}
                                                    onClick={() => executeMutation.mutate(item.decision_id)}
                                                    title="Execute approved decision"
                                                >
                                                    <Play className="h-4 w-4 text-blue-400" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Factors breakdown */}
                                        {item.factors && Object.keys(item.factors).length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                                                <p className="text-xs text-slate-500 mb-2">Decision Factors:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(item.factors).map(([key, factor]) => (
                                                        <span
                                                            key={key}
                                                            className="text-xs px-2 py-1 bg-slate-800/50 rounded text-slate-300"
                                                        >
                                                            {key}: {((factor.score || 0) * 100).toFixed(0)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Review Modal */}
                <Dialog open={actionModal === 'review'} onOpenChange={() => closeModal()}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {reviewAction === 'approve' ? 'Approve Decision' : 'Reject Decision'}
                            </DialogTitle>
                            <DialogDescription>
                                {reviewAction === 'approve'
                                    ? 'This decision will be approved and can be executed.'
                                    : 'This decision will be rejected. Please provide a reason.'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {selectedItem && (
                                <>
                                    <div className="p-3 bg-slate-800 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-medium text-white capitalize">
                                                {selectedItem.action_type.replace(/_/g, ' ')}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[selectedItem.priority]}`}>
                                                {selectedItem.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400">{selectedItem.reasoning}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Agent:</span>
                                            <span className="ml-2 text-white capitalize">{selectedItem.agent_name}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Confidence:</span>
                                            <span className="ml-2 text-white">
                                                {((selectedItem.confidence || 0) * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Target:</span>
                                            <span className="ml-2 text-white">
                                                {selectedItem.target_type} #{selectedItem.target_id}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Category:</span>
                                            <span className="ml-2 text-white">{selectedItem.category}</span>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    {reviewAction === 'approve' ? 'Notes (optional)' : 'Rejection Reason (required)'}
                                </label>
                                <Input
                                    placeholder={
                                        reviewAction === 'approve'
                                            ? 'Add optional notes...'
                                            : 'Explain why this decision is being rejected...'
                                    }
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="secondary" onClick={closeModal}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleReview}
                                disabled={
                                    approveMutation.isPending ||
                                    rejectMutation.isPending ||
                                    (reviewAction === 'reject' && !reviewNotes.trim())
                                }
                                variant={reviewAction === 'approve' ? 'default' : 'secondary'}
                            >
                                {(approveMutation.isPending || rejectMutation.isPending) ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : reviewAction === 'approve' ? (
                                    <Check className="h-4 w-4 mr-2" />
                                ) : (
                                    <X className="h-4 w-4 mr-2" />
                                )}
                                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Audit Trail Modal */}
                <Dialog open={actionModal === 'audit'} onOpenChange={() => setActionModal(null)}>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Agent Decision Audit Trail</DialogTitle>
                            <DialogDescription>
                                Complete history of all agent decisions and their outcomes
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            {auditLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                                </div>
                            ) : auditDecisions.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    No decisions recorded yet
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {auditDecisions.map((decision: AuditDecision) => (
                                        <div
                                            key={decision.id}
                                            className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-white capitalize">
                                                            {decision.action_type.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[decision.status] || STATUS_COLORS.pending}`}>
                                                            {decision.status}
                                                        </span>
                                                        {decision.requires_approval && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">
                                                                HITL
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-400">
                                                        <span className="capitalize">{decision.agent_name}</span>
                                                        {' → '}
                                                        {decision.target_type} #{decision.target_id}
                                                    </p>
                                                </div>
                                                <div className="text-xs text-slate-500 text-right">
                                                    <div>{new Date(decision.created_at).toLocaleString()}</div>
                                                    {decision.executed_at && (
                                                        <div className="text-green-400">
                                                            Executed: {new Date(decision.executed_at).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
