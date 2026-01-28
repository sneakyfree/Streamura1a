import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Scale,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    FileText,
    ChevronRight,
    Plus
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface Appeal {
    id: number;
    moderation_action_id: number;
    reason: string;
    evidence: string | null;
    status: 'pending' | 'under_review' | 'approved' | 'denied' | 'escalated';
    priority: string;
    review_notes: string | null;
    outcome: string | null;
    created_at: string;
    reviewed_at: string | null;
}

interface ModerationAction {
    id: number;
    action_type: string;
    reason: string;
    created_at: string;
    expires_at: string | null;
}

const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Pending Review' },
    under_review: { icon: AlertTriangle, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Under Review' },
    approved: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Approved' },
    denied: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Denied' },
    escalated: { icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Escalated' },
};

export function AppealsPage() {
    const token = localStorage.getItem('access_token');
    const queryClient = useQueryClient();
    const [showNewAppeal, setShowNewAppeal] = useState(false);
    const [selectedAction, setSelectedAction] = useState<number | null>(null);
    const [appealReason, setAppealReason] = useState('');
    const [appealEvidence, setAppealEvidence] = useState('');

    // Fetch user's appeals
    const { data: appeals, isLoading } = useQuery({
        queryKey: ['appeals'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/appeals`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch appeals');
            return res.json() as Promise<Appeal[]>;
        },
        enabled: !!token,
    });

    // Fetch moderation actions against user (for new appeals)
    const { data: moderationActions } = useQuery({
        queryKey: ['my-moderation-actions'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/v1/users/me/moderation-actions`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return [];
            return res.json() as Promise<ModerationAction[]>;
        },
        enabled: !!token,
    });

    // Submit appeal mutation
    const submitAppeal = useMutation({
        mutationFn: async (data: { moderation_action_id: number; reason: string; evidence?: string }) => {
            const res = await fetch(`${API_BASE}/api/v1/appeals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to submit appeal');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appeals'] });
            setShowNewAppeal(false);
            setAppealReason('');
            setAppealEvidence('');
            setSelectedAction(null);
        },
    });

    const handleSubmitAppeal = () => {
        if (!selectedAction || !appealReason.trim()) return;
        submitAppeal.mutate({
            moderation_action_id: selectedAction,
            reason: appealReason,
            evidence: appealEvidence || undefined,
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Scale className="h-8 w-8 text-primary-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">Appeals Center</h1>
                            <p className="text-slate-400">Review and appeal moderation decisions</p>
                        </div>
                    </div>
                    <Button onClick={() => setShowNewAppeal(!showNewAppeal)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Appeal
                    </Button>
                </div>

                {/* New Appeal Form */}
                {showNewAppeal && (
                    <Card className="mb-8" variant="elevated">
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white">Submit New Appeal</h2>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Select Moderation Action */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Select Moderation Action to Appeal
                                </label>
                                <select
                                    value={selectedAction || ''}
                                    onChange={(e) => setSelectedAction(Number(e.target.value))}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                >
                                    <option value="">Select an action...</option>
                                    {moderationActions?.map((action) => (
                                        <option key={action.id} value={action.id}>
                                            {action.action_type} - {action.reason} ({new Date(action.created_at).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Reason for Appeal *
                                </label>
                                <textarea
                                    value={appealReason}
                                    onChange={(e) => setAppealReason(e.target.value)}
                                    placeholder="Explain why you believe this action was incorrect..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white min-h-[100px]"
                                />
                            </div>

                            {/* Evidence */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Additional Evidence (Optional)
                                </label>
                                <textarea
                                    value={appealEvidence}
                                    onChange={(e) => setAppealEvidence(e.target.value)}
                                    placeholder="Provide any additional context or evidence..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white min-h-[80px]"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="secondary" onClick={() => setShowNewAppeal(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmitAppeal}
                                    disabled={!selectedAction || !appealReason.trim() || submitAppeal.isPending}
                                    isLoading={submitAppeal.isPending}
                                >
                                    Submit Appeal
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Appeals List */}
                <div className="space-y-4">
                    {appeals && appeals.length > 0 ? (
                        appeals.map((appeal) => {
                            const config = statusConfig[appeal.status] || statusConfig.pending;
                            const StatusIcon = config.icon;

                            return (
                                <Card key={appeal.id} className="hover:border-slate-600 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg ${config.bg}`}>
                                                    <StatusIcon className={`h-5 w-5 ${config.color}`} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-white">
                                                        Appeal #{appeal.id}
                                                    </h3>
                                                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                        {appeal.reason}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                                        <span>Filed {new Date(appeal.created_at).toLocaleDateString()}</span>
                                                        {appeal.reviewed_at && (
                                                            <span>Reviewed {new Date(appeal.reviewed_at).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-full text-xs ${config.bg} ${config.color}`}>
                                                    {config.label}
                                                </span>
                                                <ChevronRight className="h-5 w-5 text-slate-500" />
                                            </div>
                                        </div>

                                        {/* Review Response */}
                                        {appeal.review_notes && (
                                            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                                <p className="text-sm font-medium text-slate-300 mb-1">Moderator Response:</p>
                                                <p className="text-sm text-slate-400">{appeal.review_notes}</p>
                                                {appeal.outcome && (
                                                    <p className="text-xs text-slate-500 mt-2">
                                                        Outcome: <span className="text-slate-300">{appeal.outcome.replace('_', ' ')}</span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">No Appeals</h3>
                                <p className="text-slate-400">
                                    You haven't submitted any appeals. If you believe a moderation action was incorrect,
                                    you can submit an appeal for review.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Information Card */}
                <Card className="mt-8 border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                        <h3 className="font-medium text-blue-400 mb-2">About Appeals</h3>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• Appeals are typically reviewed within 24-48 hours</li>
                            <li>• You can only appeal each moderation action once</li>
                            <li>• Provide clear reasons and evidence to support your appeal</li>
                            <li>• Frivolous or abusive appeals may result in additional consequences</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default AppealsPage;
