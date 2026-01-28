import { useState } from 'react';
import {
    X,
    Sparkles,
    Clock,
    Users,
    Star,
    Send,
    Eye,
    Gift,
    TrendingUp,
    Crown
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface VirtualGood {
    id: number;
    name: string;
    description: string;
    category: 'effect' | 'badge' | 'emote' | 'profile' | 'gift';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    price_coins: number;
    animation_url?: string;
    preview_url: string;
    duration_seconds?: number;
    creator_id?: number;
    creator_name?: string;
    times_used: number;
    times_purchased: number;
    is_limited: boolean;
    expires_at?: string;
    remaining_stock?: number;
}

interface GoodPreviewProps {
    good: VirtualGood | null;
    onClose: () => void;
    onPurchase?: () => void;
    onSend?: (recipientId: number) => void;
    isOwned?: boolean;
}

// Rarity config
const rarityConfig = {
    common: { color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', label: 'Common' },
    uncommon: { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', label: 'Uncommon' },
    rare: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', label: 'Rare' },
    epic: { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30', label: 'Epic' },
    legendary: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30 border-2', label: 'Legendary' }
};

// Category icons
const categoryIcons = {
    effect: Sparkles,
    badge: Star,
    emote: Send,
    profile: Crown,
    gift: Gift
};

export function GoodPreview({
    good,
    onClose,
    onPurchase,
    onSend,
    isOwned = false
}: GoodPreviewProps) {
    const [showSendModal, setShowSendModal] = useState(false);
    const [recipientSearch, setRecipientSearch] = useState('');

    if (!good) return null;

    const rarity = rarityConfig[good.rarity];
    const CategoryIcon = categoryIcons[good.category] || Sparkles;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className={`w-full max-w-lg bg-slate-800 ${rarity.border}`}>
                {/* Header */}
                <div className="relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors z-10"
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>

                    {/* Preview area */}
                    <div className={`relative h-64 ${rarity.bg} rounded-t-xl overflow-hidden flex items-center justify-center`}>
                        {good.animation_url ? (
                            <video
                                src={good.animation_url}
                                autoPlay
                                loop
                                muted
                                className="max-w-full max-h-full"
                            />
                        ) : (
                            <img
                                src={good.preview_url || '/placeholder-good.png'}
                                alt={good.name}
                                className="max-w-full max-h-full object-contain"
                            />
                        )}

                        {/* Rarity badge */}
                        <div className={`absolute top-4 left-4 px-3 py-1 rounded-full ${rarity.bg} ${rarity.color} text-sm font-medium flex items-center gap-1`}>
                            <Star className="h-3 w-3" />
                            {rarity.label}
                        </div>

                        {/* Limited badge */}
                        {good.is_limited && (
                            <div className="absolute top-4 right-16 px-3 py-1 rounded-full bg-red-500/80 text-white text-sm font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Limited
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className={`flex items-center gap-2 text-xs ${rarity.color} mb-1`}>
                                <CategoryIcon className="h-3 w-3" />
                                {good.category.charAt(0).toUpperCase() + good.category.slice(1)}
                            </div>
                            <h2 className="text-xl font-bold text-white">{good.name}</h2>
                        </div>
                        <div className={`text-2xl font-bold ${rarity.color} flex items-center gap-1`}>
                            <span className="text-yellow-400">🪙</span>
                            {good.price_coins.toLocaleString()}
                        </div>
                    </div>

                    <p className="text-slate-400 text-sm mb-4">{good.description}</p>

                    {/* Creator attribution */}
                    {good.creator_name && (
                        <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg mb-4">
                            <Crown className="h-4 w-4 text-purple-400" />
                            <span className="text-sm text-slate-300">Created by</span>
                            <span className="text-sm text-white font-medium">{good.creator_name}</span>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center p-2 bg-slate-700/30 rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                <Eye className="h-3 w-3" />
                                <span className="text-xs">Uses</span>
                            </div>
                            <div className="text-white font-medium">{good.times_used.toLocaleString()}</div>
                        </div>
                        <div className="text-center p-2 bg-slate-700/30 rounded-lg">
                            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                <TrendingUp className="h-3 w-3" />
                                <span className="text-xs">Purchased</span>
                            </div>
                            <div className="text-white font-medium">{good.times_purchased.toLocaleString()}</div>
                        </div>
                        {good.remaining_stock !== undefined && (
                            <div className="text-center p-2 bg-slate-700/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                    <Users className="h-3 w-3" />
                                    <span className="text-xs">Stock</span>
                                </div>
                                <div className={`font-medium ${good.remaining_stock < 10 ? 'text-red-400' : 'text-white'}`}>
                                    {good.remaining_stock}
                                </div>
                            </div>
                        )}
                        {good.duration_seconds && (
                            <div className="text-center p-2 bg-slate-700/30 rounded-lg">
                                <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-xs">Duration</span>
                                </div>
                                <div className="text-white font-medium">{good.duration_seconds}s</div>
                            </div>
                        )}
                    </div>

                    {/* Expiration warning */}
                    {good.expires_at && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-sm">
                            <Clock className="h-4 w-4 text-red-400" />
                            <span className="text-red-300">
                                Expires {new Date(good.expires_at).toLocaleDateString()}
                            </span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        {isOwned ? (
                            <>
                                <Button variant="secondary" className="flex-1" onClick={() => setShowSendModal(true)}>
                                    <Gift className="h-4 w-4 mr-2" />
                                    Send as Gift
                                </Button>
                                <Button className="flex-1">
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Use Now
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={onClose} className="flex-1">
                                    Cancel
                                </Button>
                                <Button onClick={onPurchase} className="flex-1">
                                    <span className="text-yellow-400 mr-2">🪙</span>
                                    Buy for {good.price_coins.toLocaleString()}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            {/* Send modal */}
            {showSendModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
                    <Card className="w-full max-w-sm bg-slate-800 border-slate-700 p-4">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Gift className="h-5 w-5 text-purple-400" />
                            Send as Gift
                        </h3>
                        <input
                            type="text"
                            placeholder="Search for user..."
                            value={recipientSearch}
                            onChange={(e) => setRecipientSearch(e.target.value)}
                            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white mb-4"
                        />
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setShowSendModal(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    if (onSend) onSend(1); // Mock recipient ID
                                    setShowSendModal(false);
                                }}
                                className="flex-1"
                            >
                                Send Gift
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default GoodPreview;
