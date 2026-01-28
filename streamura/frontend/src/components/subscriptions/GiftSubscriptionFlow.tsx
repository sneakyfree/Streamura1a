import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Gift,
    User,
    Search,
    CreditCard,
    Check,
    X,
    Heart,
    Star,
    Sparkles,
    MessageSquare,
    ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface GiftRecipient {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    isFollowing: boolean;
}

interface GiftTier {
    id: string;
    name: string;
    price: number;
    duration: number; // months
    perks: string[];
    popular?: boolean;
}

interface GiftSubscriptionProps {
    creatorId: string;
    creatorName: string;
    creatorAvatar?: string;
    tiers: GiftTier[];
    onComplete?: (giftId: string) => void;
    onCancel?: () => void;
}

// Mock data
const mockTiers: GiftTier[] = [
    { id: 't1', name: 'Supporter', price: 4.99, duration: 1, perks: ['Ad-free viewing', 'Chat badge', 'Emotes'] },
    { id: 't2', name: 'Fan', price: 9.99, duration: 1, perks: ['All Supporter perks', 'Priority chat', 'Exclusive streams'], popular: true },
    { id: 't3', name: 'VIP', price: 24.99, duration: 1, perks: ['All Fan perks', 'Discord access', '1-on-1 chat', 'Merchandise discount'] }
];

const mockRecipients: GiftRecipient[] = [
    { id: 'u1', username: 'viewer123', displayName: 'Viewer 123', isFollowing: true },
    { id: 'u2', username: 'streamfan', displayName: 'Stream Fan', isFollowing: true },
    { id: 'u3', username: 'newuser', displayName: 'New User', isFollowing: false }
];

type Step = 'tier' | 'recipient' | 'message' | 'payment' | 'complete';

export function GiftSubscriptionFlow({
    creatorId,
    creatorName,
    creatorAvatar,
    tiers = mockTiers,
    onComplete,
    onCancel
}: GiftSubscriptionProps) {
    const [step, setStep] = useState<Step>('tier');
    const [selectedTier, setSelectedTier] = useState<GiftTier | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [recipientType, setRecipientType] = useState<'random' | 'specific'>('random');
    const [selectedRecipient, setSelectedRecipient] = useState<GiftRecipient | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [message, setMessage] = useState('');
    const [anonymous, setAnonymous] = useState(false);
    const [giftId, setGiftId] = useState<string | null>(null);

    const queryClient = useQueryClient();

    const purchaseGift = useMutation({
        mutationFn: async () => {
            // Would call API
            await new Promise(r => setTimeout(r, 1500));
            return { giftId: `gift-${Date.now()}`, recipientCount: quantity };
        },
        onSuccess: (data) => {
            setGiftId(data.giftId);
            setStep('complete');
            onComplete?.(data.giftId);
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        }
    });

    const filteredRecipients = searchQuery
        ? mockRecipients.filter(r =>
            r.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : mockRecipients;

    const totalPrice = selectedTier ? selectedTier.price * quantity : 0;

    const canProceed = () => {
        if (step === 'tier') return selectedTier !== null;
        if (step === 'recipient') return recipientType === 'random' || selectedRecipient !== null;
        if (step === 'message') return true;
        if (step === 'payment') return true;
        return false;
    };

    const nextStep = () => {
        if (step === 'tier') setStep('recipient');
        else if (step === 'recipient') setStep('message');
        else if (step === 'message') setStep('payment');
        else if (step === 'payment') purchaseGift.mutate();
    };

    const prevStep = () => {
        if (step === 'recipient') setStep('tier');
        else if (step === 'message') setStep('recipient');
        else if (step === 'payment') setStep('message');
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-purple-500">
                            <Gift className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold">Gift a Subscription</h2>
                            <p className="text-sm text-slate-400">to {creatorName}'s channel</p>
                        </div>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Progress indicator */}
                {step !== 'complete' && (
                    <div className="px-4 py-2 bg-slate-800/50 flex items-center gap-2">
                        {(['tier', 'recipient', 'message', 'payment'] as Step[]).map((s, i) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step === s ? 'bg-purple-500 text-white' :
                                        ['tier', 'recipient', 'message', 'payment'].indexOf(step) > i
                                            ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
                                    }`}>
                                    {['tier', 'recipient', 'message', 'payment'].indexOf(step) > i ? (
                                        <Check className="w-3 h-3" />
                                    ) : i + 1}
                                </div>
                                {i < 3 && <div className="w-8 h-0.5 bg-slate-700 mx-1" />}
                            </div>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {step === 'tier' && (
                        <div className="space-y-3">
                            <h3 className="text-white font-medium mb-3">Select a tier</h3>
                            {tiers.map(tier => (
                                <button
                                    key={tier.id}
                                    onClick={() => setSelectedTier(tier)}
                                    className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedTier?.id === tier.id
                                            ? 'bg-purple-500/20 border-purple-500'
                                            : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white font-medium">{tier.name}</span>
                                        <div className="flex items-center gap-2">
                                            {tier.popular && (
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                                    Popular
                                                </span>
                                            )}
                                            <span className="text-white font-bold">${tier.price}/mo</span>
                                        </div>
                                    </div>
                                    <ul className="text-sm text-slate-400 space-y-1">
                                        {tier.perks.slice(0, 3).map((perk, i) => (
                                            <li key={i} className="flex items-center gap-1">
                                                <Check className="w-3 h-3 text-green-400" />
                                                {perk}
                                            </li>
                                        ))}
                                    </ul>
                                </button>
                            ))}

                            <div className="mt-4">
                                <label className="text-sm text-slate-400 mb-2 block">Quantity</label>
                                <div className="flex items-center gap-2">
                                    {[1, 5, 10, 25].map(q => (
                                        <button
                                            key={q}
                                            onClick={() => setQuantity(q)}
                                            className={`px-3 py-1.5 rounded text-sm font-medium ${quantity === q
                                                    ? 'bg-purple-500 text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'recipient' && (
                        <div className="space-y-4">
                            <h3 className="text-white font-medium">Choose recipient</h3>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setRecipientType('random')}
                                    className={`p-3 rounded-lg border text-center ${recipientType === 'random'
                                            ? 'bg-purple-500/20 border-purple-500'
                                            : 'bg-slate-700/50 border-slate-600'
                                        }`}
                                >
                                    <Sparkles className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                                    <div className="text-sm text-white font-medium">Random</div>
                                    <div className="text-xs text-slate-400">Give to community</div>
                                </button>
                                <button
                                    onClick={() => setRecipientType('specific')}
                                    className={`p-3 rounded-lg border text-center ${recipientType === 'specific'
                                            ? 'bg-purple-500/20 border-purple-500'
                                            : 'bg-slate-700/50 border-slate-600'
                                        }`}
                                >
                                    <User className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                                    <div className="text-sm text-white font-medium">Specific User</div>
                                    <div className="text-xs text-slate-400">Choose someone</div>
                                </button>
                            </div>

                            {recipientType === 'specific' && (
                                <div>
                                    <div className="relative mb-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search users..."
                                            className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                        />
                                    </div>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {filteredRecipients.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => setSelectedRecipient(user)}
                                                className={`w-full flex items-center gap-3 p-2 rounded ${selectedRecipient?.id === user.id
                                                        ? 'bg-purple-500/20'
                                                        : 'hover:bg-slate-700'
                                                    }`}
                                            >
                                                <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-white text-sm">{user.displayName}</div>
                                                    <div className="text-xs text-slate-400">@{user.username}</div>
                                                </div>
                                                {selectedRecipient?.id === user.id && (
                                                    <Check className="w-4 h-4 text-purple-400 ml-auto" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'message' && (
                        <div className="space-y-4">
                            <h3 className="text-white font-medium">Add a message (optional)</h3>

                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Write a message to the recipient..."
                                maxLength={200}
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white resize-none"
                            />
                            <div className="text-xs text-slate-500 text-right">{message.length}/200</div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={anonymous}
                                    onChange={(e) => setAnonymous(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-slate-300">Gift anonymously</span>
                            </label>
                        </div>
                    )}

                    {step === 'payment' && (
                        <div className="space-y-4">
                            <h3 className="text-white font-medium">Confirm purchase</h3>

                            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">{selectedTier?.name} × {quantity}</span>
                                    <span className="text-white">${totalPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Recipient</span>
                                    <span className="text-white">
                                        {recipientType === 'random' ? `${quantity} random viewer(s)` : selectedRecipient?.displayName}
                                    </span>
                                </div>
                                {message && (
                                    <div className="pt-2 border-t border-slate-600">
                                        <div className="text-xs text-slate-400 mb-1">Message:</div>
                                        <div className="text-sm text-white italic">"{message}"</div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-700/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-slate-300 text-sm">
                                    <CreditCard className="w-4 h-4" />
                                    Visa •••• 4242
                                    <button className="text-purple-400 text-xs ml-auto">Change</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Heart className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Gift Sent!</h3>
                            <p className="text-slate-400 mb-4">
                                {recipientType === 'random'
                                    ? `${quantity} lucky viewer(s) received your gift!`
                                    : `${selectedRecipient?.displayName} received your gift!`}
                            </p>
                            <Button variant="primary" onClick={onCancel}>
                                Done
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step !== 'complete' && (
                    <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                        {step !== 'tier' ? (
                            <Button variant="secondary" onClick={prevStep}>
                                Back
                            </Button>
                        ) : (
                            <div />
                        )}
                        <div className="text-right">
                            {selectedTier && (
                                <div className="text-sm text-slate-400 mb-1">
                                    Total: <span className="text-white font-bold">${totalPrice.toFixed(2)}</span>
                                </div>
                            )}
                            <Button
                                variant="primary"
                                onClick={nextStep}
                                disabled={!canProceed() || purchaseGift.isPending}
                            >
                                {step === 'payment' ? (purchaseGift.isPending ? 'Processing...' : 'Complete Gift') : 'Continue'}
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}

export default GiftSubscriptionFlow;
