import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Download,
    FileArchive,
    Clock,
    CheckCircle,
    AlertCircle,
    Trash2,
    RefreshCw,
    ShieldAlert,
    Eye,
    EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// API client for data export
const dataExportApi = {
    requestExport: async (exportType: string, includePrivate: boolean) => {
        const res = await fetch(`/api/v1/user/data-export/request?export_type=${exportType}&include_private=${includePrivate}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!res.ok) throw new Error('Failed to request export');
        return res.json();
    },

    getHistory: async () => {
        const res = await fetch('/api/v1/user/data-export/history', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    },

    getStatus: async (requestId: number) => {
        const res = await fetch(`/api/v1/user/data-export/status/${requestId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    },

    getDeletionCode: async () => {
        const res = await fetch('/api/v1/user/account/deletion-code', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!res.ok) throw new Error('Failed to get deletion code');
        return res.json();
    },

    deleteAccount: async (confirmationCode: string, reason: string) => {
        const res = await fetch('/api/v1/user/account', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ confirmation_code: confirmationCode, reason })
        });
        if (!res.ok) throw new Error('Failed to delete account');
        return res.json();
    }
};

// Export types
const EXPORT_TYPES = [
    { value: 'full', label: 'Full Export', description: 'All your data including profile, streams, messages, and transactions' },
    { value: 'profile', label: 'Profile Only', description: 'Just your profile information and settings' },
    { value: 'content', label: 'Content Only', description: 'Your streams, recordings, and related content' },
    { value: 'financial', label: 'Financial Only', description: 'Transactions, tips, and subscription history' },
    { value: 'messages', label: 'Messages Only', description: 'Your private conversations and chat history' }
];

// Status colors and icons
const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'text-yellow-500', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
    processing: { color: 'text-blue-500', icon: <RefreshCw className="w-4 h-4 animate-spin" />, label: 'Processing' },
    completed: { color: 'text-green-500', icon: <CheckCircle className="w-4 h-4" />, label: 'Completed' },
    failed: { color: 'text-red-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Failed' },
    expired: { color: 'text-gray-500', icon: <Clock className="w-4 h-4" />, label: 'Expired' }
};

export function DataExport() {
    const queryClient = useQueryClient();
    const [exportType, setExportType] = useState('full');
    const [includePrivate, setIncludePrivate] = useState(true);
    const [showDeleteSection, setShowDeleteSection] = useState(false);
    const [deletionCode, setDeletionCode] = useState('');
    const [deletionReason, setDeletionReason] = useState('');
    const [deletionStep, setDeletionStep] = useState(0);

    // Fetch export history
    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ['dataExportHistory'],
        queryFn: dataExportApi.getHistory,
        refetchInterval: 30000 // Poll every 30s for updates
    });

    // Request export mutation
    const requestExportMutation = useMutation({
        mutationFn: () => dataExportApi.requestExport(exportType, includePrivate),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dataExportHistory'] });
        }
    });

    // Request deletion code mutation
    const requestDeletionCodeMutation = useMutation({
        mutationFn: dataExportApi.getDeletionCode,
        onSuccess: () => {
            setDeletionStep(1);
        }
    });

    // Delete account mutation
    const deleteAccountMutation = useMutation({
        mutationFn: () => dataExportApi.deleteAccount(deletionCode, deletionReason),
        onSuccess: () => {
            localStorage.removeItem('token');
            window.location.href = '/';
        }
    });

    const exports = historyData?.exports || [];

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '--';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '--';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-2">Data Export & Privacy</h1>
            <p className="text-gray-400 mb-8">
                Manage your data and exercise your privacy rights under GDPR.
            </p>

            {/* Request New Export */}
            <Card className="bg-gray-900/50 border-gray-800 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <FileArchive className="w-5 h-5 text-purple-400" />
                    Request Data Export
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Export Type</label>
                        <select
                            value={exportType}
                            onChange={(e) => setExportType(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                        >
                            {EXPORT_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-gray-500 mt-1">
                            {EXPORT_TYPES.find(t => t.value === exportType)?.description}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIncludePrivate(!includePrivate)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${includePrivate
                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                : 'bg-gray-800 border-gray-700 text-gray-400'
                                }`}
                        >
                            {includePrivate ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {includePrivate ? 'Include Private Data' : 'Exclude Private Data'}
                        </button>
                    </div>

                    <Button
                        onClick={() => requestExportMutation.mutate()}
                        disabled={requestExportMutation.isPending}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                        {requestExportMutation.isPending ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                Requesting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Request Export
                            </>
                        )}
                    </Button>

                    {requestExportMutation.isSuccess && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-300">
                            <CheckCircle className="w-5 h-5 inline mr-2" />
                            Export request submitted! You'll receive an email when it's ready.
                        </div>
                    )}
                </div>
            </Card>

            {/* Export History */}
            <Card className="bg-gray-900/50 border-gray-800 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Export History
                </h2>

                {historyLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : exports.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No exports yet. Request your first export above.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {exports.map((exp: {
                            request_id: number;
                            status: string;
                            export_type: string;
                            created_at: string;
                            completed_at: string;
                            file_size: number;
                            expires_at: string;
                        }) => {
                            const statusConfig = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending;
                            return (
                                <div
                                    key={exp.request_id}
                                    className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <span className={statusConfig.color}>
                                            {statusConfig.icon}
                                        </span>
                                        <div>
                                            <div className="font-medium">
                                                {EXPORT_TYPES.find(t => t.value === exp.export_type)?.label || exp.export_type}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Requested: {formatDate(exp.created_at)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {exp.status === 'completed' && (
                                            <>
                                                <span className="text-sm text-gray-400">
                                                    {formatFileSize(exp.file_size)}
                                                </span>
                                                <a
                                                    href={`/api/v1/user/data-export/download/${exp.request_id}`}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors"
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download
                                                </a>
                                            </>
                                        )}
                                        {exp.status === 'pending' || exp.status === 'processing' ? (
                                            <span className={`text-sm ${statusConfig.color}`}>
                                                {statusConfig.label}
                                            </span>
                                        ) : null}
                                        {exp.expires_at && exp.status === 'completed' && (
                                            <span className="text-xs text-gray-500">
                                                Expires: {formatDate(exp.expires_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Delete Account Section */}
            <Card className="bg-red-500/5 border-red-500/20 p-6">
                <button
                    onClick={() => setShowDeleteSection(!showDeleteSection)}
                    className="flex items-center justify-between w-full"
                >
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-red-400">
                        <Trash2 className="w-5 h-5" />
                        Delete Account
                    </h2>
                    <span className="text-gray-500">
                        {showDeleteSection ? 'Hide' : 'Show'}
                    </span>
                </button>

                {showDeleteSection && (
                    <div className="mt-6 space-y-4">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <ShieldAlert className="w-6 h-6 text-red-400 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-red-300">Warning: This action is permanent</h3>
                                    <p className="text-sm text-gray-400 mt-1">
                                        Deleting your account will permanently remove all your data including streams,
                                        recordings, earnings, and account history. This cannot be undone.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {deletionStep === 0 && (
                            <Button
                                onClick={() => requestDeletionCodeMutation.mutate()}
                                disabled={requestDeletionCodeMutation.isPending}
                                variant="danger"
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {requestDeletionCodeMutation.isPending ? 'Sending...' : 'Request Deletion Code'}
                            </Button>
                        )}

                        {deletionStep === 1 && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400">
                                    A confirmation code has been sent to your email. Enter it below along with
                                    an optional reason for leaving.
                                </p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Confirmation Code
                                    </label>
                                    <input
                                        type="text"
                                        value={deletionCode}
                                        onChange={(e) => setDeletionCode(e.target.value.toUpperCase())}
                                        placeholder="Enter 8-character code"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white uppercase"
                                        maxLength={8}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Reason for Leaving (Optional)
                                    </label>
                                    <textarea
                                        value={deletionReason}
                                        onChange={(e) => setDeletionReason(e.target.value)}
                                        placeholder="We'd appreciate knowing why you're leaving..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white resize-none"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setDeletionStep(0)}
                                        variant="ghost"
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => deleteAccountMutation.mutate()}
                                        disabled={deletionCode.length !== 8 || deleteAccountMutation.isPending}
                                        variant="danger"
                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                    >
                                        {deleteAccountMutation.isPending ? 'Deleting...' : 'Permanently Delete Account'}
                                    </Button>
                                </div>

                                {deleteAccountMutation.isError && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                                        <AlertCircle className="w-4 h-4 inline mr-2" />
                                        Failed to delete account. Please check your confirmation code.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

export default DataExport;
