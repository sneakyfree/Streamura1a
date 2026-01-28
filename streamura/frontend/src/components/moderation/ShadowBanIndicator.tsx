import { useState } from 'react';
import {
    EyeOff,
    Eye,
    AlertTriangle,
    Clock,
    MessageSquare,
    Shield,
    CheckCircle,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ShadowBanIndicatorProps {
    isShadowBanned: boolean;
    bannedAt?: string;
    reason?: string;
    expiresAt?: string;
    onToggle?: (newState: boolean) => void;
    showControls?: boolean;
}

export function ShadowBanIndicator({
    isShadowBanned,
    bannedAt,
    reason,
    expiresAt,
    onToggle,
    showControls = true
}: ShadowBanIndicatorProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmReason, setConfirmReason] = useState('');

    const formatDate = (date?: string) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleToggle = () => {
        if (isShadowBanned) {
            // Lifting ban - confirm
            setShowConfirm(true);
        } else {
            // Applying ban - need reason
            setShowConfirm(true);
        }
    };

    const confirmAction = () => {
        onToggle?.(!isShadowBanned);
        setShowConfirm(false);
        setConfirmReason('');
    };

    return (
        <div className="space-y-2">
            {/* Status badge */}
            <div className={`flex items-center justify-between p-3 rounded-lg border ${isShadowBanned
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-slate-700/30 border-slate-600'
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isShadowBanned ? 'bg-orange-500/20' : 'bg-slate-700'}`}>
                        {isShadowBanned ? (
                            <EyeOff className="w-5 h-5 text-orange-400" />
                        ) : (
                            <Eye className="w-5 h-5 text-slate-400" />
                        )}
                    </div>
                    <div>
                        <div className={`font-medium ${isShadowBanned ? 'text-orange-400' : 'text-slate-300'}`}>
                            {isShadowBanned ? 'Shadow Banned' : 'Visible'}
                        </div>
                        {isShadowBanned && reason && (
                            <div className="text-sm text-slate-400">
                                Reason: {reason}
                            </div>
                        )}
                    </div>
                </div>

                {showControls && (
                    <Button
                        variant={isShadowBanned ? 'secondary' : 'danger'}
                        size="sm"
                        onClick={handleToggle}
                    >
                        {isShadowBanned ? 'Lift Ban' : 'Shadow Ban'}
                    </Button>
                )}
            </div>

            {/* Details when banned */}
            {isShadowBanned && (bannedAt || expiresAt) && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span>Applied: {formatDate(bannedAt)}</span>
                    </div>
                    {expiresAt && (
                        <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="w-4 h-4" />
                            <span>Expires: {formatDate(expiresAt)}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Info tooltip */}
            {isShadowBanned && (
                <div className="flex items-start gap-2 p-2 bg-slate-800/50 rounded text-xs text-slate-400">
                    <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <span>
                        User's content is hidden from others but they can still post.
                        They are not notified of the ban.
                    </span>
                </div>
            )}

            {/* Confirmation modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${isShadowBanned ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                                {isShadowBanned ? (
                                    <CheckCircle className="w-6 h-6 text-green-400" />
                                ) : (
                                    <EyeOff className="w-6 h-6 text-orange-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">
                                    {isShadowBanned ? 'Lift Shadow Ban?' : 'Apply Shadow Ban?'}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {isShadowBanned
                                        ? 'User content will become visible again'
                                        : 'User content will be hidden from others'}
                                </p>
                            </div>
                        </div>

                        {!isShadowBanned && (
                            <div className="mb-4">
                                <label className="block text-sm text-slate-400 mb-1">Reason (required)</label>
                                <textarea
                                    value={confirmReason}
                                    onChange={(e) => setConfirmReason(e.target.value)}
                                    placeholder="Why is this user being shadow banned?"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm resize-none"
                                    rows={2}
                                />
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant={isShadowBanned ? 'primary' : 'danger'}
                                className="flex-1"
                                onClick={confirmAction}
                                disabled={!isShadowBanned && !confirmReason.trim()}
                            >
                                {isShadowBanned ? 'Confirm Lift' : 'Confirm Ban'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Compact badge for user lists
export function ShadowBanBadge({ isShadowBanned }: { isShadowBanned: boolean }) {
    if (!isShadowBanned) return null;

    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded">
            <EyeOff className="w-3 h-3" />
            Shadow
        </span>
    );
}

export default ShadowBanIndicator;
