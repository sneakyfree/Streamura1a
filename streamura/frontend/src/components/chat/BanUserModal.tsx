import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { moderationApi } from '@/lib/api';

interface BanUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamId: number;
    userId: number;
    username: string;
}

export function BanUserModal({
    isOpen,
    onClose,
    streamId,
    userId,
    username
}: BanUserModalProps) {
    const [reason, setReason] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleBan = async () => {
        setIsProcessing(true);
        try {
            await moderationApi.muteUser(streamId, userId, undefined, reason || undefined); // undefined duration = ban
            onClose();
        } catch (error) {
            console.error('Failed to ban user:', error);
            // TODO: Show toast error
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-red-400">Ban {username}?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to permanently ban <strong>{username}</strong> from this stream?
                        They will no longer be able to send messages.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                        Reason (Optional)
                    </label>
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white focus:outline-none focus:border-red-500"
                        placeholder="e.g. Harassment, Spam"
                    />
                </div>

                <DialogFooter>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleBan}
                            disabled={isProcessing}
                        >
                            {isProcessing ? 'Banning...' : 'Ban User'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
