import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { moderationApi } from '@/lib/api';

interface TimeoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamId: number;
    userId: number;
    username: string;
}

const DURATIONS = [
    { label: '60s', value: 60 },
    { label: '5m', value: 300 },
    { label: '10m', value: 600 },
    { label: '1h', value: 3600 },
    { label: '24h', value: 86400 },
];

export function TimeoutModal({
    isOpen,
    onClose,
    streamId,
    userId,
    username
}: TimeoutModalProps) {
    const [duration, setDuration] = useState(300);
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleTimeout = async () => {
        setIsProcessing(true);
        try {
            await moderationApi.muteUser(streamId, userId, duration, reason || undefined);
            onClose();
        } catch (error) {
            console.error('Failed to timeout user:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-yellow-400">Timeout {username}</DialogTitle>
                    <DialogDescription>
                        Temporarily prevent <strong>{username}</strong> from sending messages.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Duration
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {DURATIONS.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => setDuration(d.value)}
                                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${duration === d.value
                                            ? 'bg-yellow-500 text-black'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Reason (Optional)
                        </label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-yellow-500"
                            placeholder="e.g. Spamming"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-yellow-500 hover:bg-yellow-600 text-black"
                            onClick={handleTimeout}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Applying...' : 'Timeout User'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
