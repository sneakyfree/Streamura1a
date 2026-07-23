import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Coins,
    Gift,
    Sparkles,
    Check,
    Star,
    Crown,
    Zap,
    TrendingUp,
    History,
    CreditCard,
    ChevronRight,
    X,
    ShieldCheck
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface CurrencyPack {
    pack_id: string;
    size: string;
    coin_amount: number;
    bonus_coins: number;
    price_usd: number;
    price_per_coin: number;
    discount_percent: number;
    is_featured: boolean;
    limited_time: boolean;
    badge?: string;
    expires_at?: string;
}

interface CurrencyBalance {
    total_coins: number;
    purchased_coins: number;
    bonus_coins: number;
    earned_coins: number;
    spent_coins: number;
    vip_level: number;
    last_purchase?: string;
}

// Fetch data
const fetchPacks = async () => {
    const res = await fetch('/api/v1/currency/packs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
};

const fetchBalance = async () => {
    const res = await fetch('/api/v1/currency/balance', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
};

// VIP level config
const vipLevels = [
    { level: 0, name: 'Standard', icon: Coins, color: 'text-slate-400', bonus: '0%' },
    { level: 1, name: 'Bronze', icon: Star, color: 'text-amber-600', bonus: '+2%' },
    { level: 2, name: 'Silver', icon: Star, color: 'text-slate-300', bonus: '+4%' },
    { level: 3, name: 'Gold', icon: Star, color: 'text-yellow-400', bonus: '+6%' },
    { level: 4, name: 'Platinum', icon: Crown, color: 'text-purple-400', bonus: '+8%' },
    { level: 5, name: 'Diamond', icon: Crown, color: 'text-cyan-400', bonus: '+10%' }
];

// Pack card component
function PackCard({
    pack,
    onSelect,
    isSelected
}: {
    pack: CurrencyPack;
    onSelect: () => void;
    isSelected: boolean;
}) {
    return (
        <button
            onClick={onSelect}
            className={`relative p-4 rounded-xl border-2 transition-all text-left w-full ${isSelected
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                    : pack.is_featured
                        ? 'border-purple-500/50 bg-slate-800/80 hover:border-purple-500'
                        : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
        >
            {/* Badge */}
            {pack.badge && (
                <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold ${pack.badge === 'BEST VALUE' ? 'bg-green-500 text-white' :
                        pack.badge === 'MOST POPULAR' ? 'bg-purple-500 text-white' :
                            'bg-yellow-500 text-black'
                    }`}>
                    {pack.badge}
                </div>
            )}

            {/* Limited time indicator */}
            {pack.limited_time && (
                <div className="absolute top-2 right-2">
                    <Zap className="h-4 w-4 text-yellow-400" />
                </div>
            )}

            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${pack.is_featured ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
                    <Coins className={`h-6 w-6 ${pack.is_featured ? 'text-purple-400' : 'text-yellow-400'}`} />
                </div>
                <div>
                    <div className="text-2xl font-bold text-white">
                        {pack.coin_amount.toLocaleString()}
                    </div>
                    {pack.bonus_coins > 0 && (
                        <div className="text-xs text-green-400 flex items-center gap-1">
                            <Gift className="h-3 w-3" />
                            +{pack.bonus_coins.toLocaleString()} bonus
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-end justify-between">
                <div>
                    <div className="text-xl font-bold text-white">${pack.price_usd.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">
                        ${(pack.price_per_coin * 100).toFixed(2)} per 100
                    </div>
                </div>

                {pack.discount_percent > 0 && (
                    <div className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                        Save {pack.discount_percent.toFixed(0)}%
                    </div>
                )}
            </div>

            {isSelected && (
                <div className="absolute top-2 right-2 p-1 rounded-full bg-purple-500">
                    <Check className="h-3 w-3 text-white" />
                </div>
            )}
        </button>
    );
}

// Balance display
function BalanceCard({ balance }: { balance: CurrencyBalance }) {
    const vip = vipLevels[balance.vip_level] || vipLevels[0];
    const VipIcon = vip.icon;

    return (
        <Card className="bg-gradient-to-br from-purple-900/50 to-slate-800/50 border-purple-500/30 p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="text-sm text-slate-400 mb-1">Your Balance</div>
                    <div className="text-4xl font-bold text-white flex items-center gap-2">
                        <Coins className="h-8 w-8 text-yellow-400" />
                        {balance.total_coins.toLocaleString()}
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 ${vip.color}`}>
                    <VipIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">{vip.name}</span>
                    <span className="text-xs opacity-75">{vip.bonus} bonus</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-2 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">Purchased</div>
                    <div className="text-sm font-medium text-white">{balance.purchased_coins.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">Earned</div>
                    <div className="text-sm font-medium text-green-400">{balance.earned_coins.toLocaleString()}</div>
                </div>
                <div className="p-2 bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500">Spent</div>
                    <div className="text-sm font-medium text-slate-400">{balance.spent_coins.toLocaleString()}</div>
                </div>
            </div>
        </Card>
    );
}

// Purchase modal
function PurchaseModal({
    pack,
    onConfirm,
    onClose,
    isLoading
}: {
    pack: CurrencyPack;
    onConfirm: () => void;
    onClose: () => void;
    isLoading: boolean;
}) {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-slate-800 border-slate-700">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white">Confirm Purchase</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
                            <X className="h-5 w-5 text-slate-400" />
                        </button>
                    </div>

                    <div className="p-4 bg-slate-700/50 rounded-xl mb-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-purple-500/20">
                                <Coins className="h-8 w-8 text-yellow-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {(pack.coin_amount + pack.bonus_coins).toLocaleString()} Coins
                                </div>
                                {pack.bonus_coins > 0 && (
                                    <div className="text-sm text-green-400">
                                        Includes {pack.bonus_coins.toLocaleString()} bonus coins!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Base coins</span>
                            <span className="text-white">{pack.coin_amount.toLocaleString()}</span>
                        </div>
                        {pack.bonus_coins > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Bonus coins</span>
                                <span className="text-green-400">+{pack.bonus_coins.toLocaleString()}</span>
                            </div>
                        )}
                        <hr className="border-slate-700" />
                        <div className="flex justify-between">
                            <span className="text-slate-400">Total</span>
                            <span className="text-xl font-bold text-white">${pack.price_usd.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                        <ShieldCheck className="h-4 w-4" />
                        Secure payment via Stripe
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button onClick={onConfirm} disabled={isLoading} className="flex-1">
                            {isLoading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Pay ${pack.price_usd.toFixed(2)}
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

export function CurrencyShop() {
    const queryClient = useQueryClient();
    const [selectedPack, setSelectedPack] = useState<CurrencyPack | null>(null);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);

    const { data: packsData } = useQuery({
        queryKey: ['currencyPacks'],
        queryFn: fetchPacks
    });

    const { data: balanceData } = useQuery({
        queryKey: ['currencyBalance'],
        queryFn: fetchBalance
    });

    const purchaseMutation = useMutation({
        mutationFn: async (packId: string) => {
            // Backend expects pack_id as a query param (not a JSON body).
            const res = await fetch(`/api/v1/currency/purchase?pack_id=${encodeURIComponent(packId)}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
            });
            if (!res.ok) throw new Error('Purchase failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['currencyBalance'] });
            setShowPurchaseModal(false);
            setSelectedPack(null);
        }
    });

    // Mock data for demo
    const mockPacks: CurrencyPack[] = [
        { pack_id: 'starter', size: 'starter', coin_amount: 100, bonus_coins: 0, price_usd: 0.99, price_per_coin: 0.0099, discount_percent: 0, is_featured: false, limited_time: false },
        { pack_id: 'value', size: 'value', coin_amount: 500, bonus_coins: 25, price_usd: 4.49, price_per_coin: 0.00856, discount_percent: 10, is_featured: false, limited_time: false },
        { pack_id: 'popular', size: 'popular', coin_amount: 1000, bonus_coins: 100, price_usd: 7.99, price_per_coin: 0.00726, discount_percent: 20, is_featured: true, limited_time: false, badge: 'MOST POPULAR' },
        { pack_id: 'super', size: 'super', coin_amount: 2500, bonus_coins: 350, price_usd: 17.99, price_per_coin: 0.00631, discount_percent: 28, is_featured: false, limited_time: false },
        { pack_id: 'mega', size: 'mega', coin_amount: 5000, bonus_coins: 1000, price_usd: 32.99, price_per_coin: 0.00549, discount_percent: 34, is_featured: true, limited_time: false, badge: 'BEST VALUE' },
        { pack_id: 'ultimate', size: 'ultimate', coin_amount: 10000, bonus_coins: 2500, price_usd: 59.99, price_per_coin: 0.00479, discount_percent: 40, is_featured: false, limited_time: false, badge: 'ULTIMATE' }
    ];

    const mockBalance: CurrencyBalance = {
        total_coins: 1250,
        purchased_coins: 1100,
        bonus_coins: 100,
        earned_coins: 50,
        spent_coins: 0,
        vip_level: 2
    };

    const packs = packsData?.packs || mockPacks;
    const balance = balanceData || mockBalance;

    const handlePurchase = () => {
        if (selectedPack) {
            purchaseMutation.mutate(selectedPack.pack_id);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3 mb-2">
                        <Sparkles className="h-8 w-8 text-purple-400" />
                        Streamura Coins
                    </h1>
                    <p className="text-slate-400">
                        Support your favorite creators, unlock reactions, and send gifts
                    </p>
                </div>

                {/* Balance */}
                <BalanceCard balance={balance} />

                {/* Packs grid */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                        Choose a Pack
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {packs.map((pack: CurrencyPack) => (
                            <PackCard
                                key={pack.pack_id}
                                pack={pack}
                                isSelected={selectedPack?.pack_id === pack.pack_id}
                                onSelect={() => setSelectedPack(pack)}
                            />
                        ))}
                    </div>
                </div>

                {/* Purchase button */}
                {selectedPack && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 to-transparent">
                        <div className="max-w-4xl mx-auto">
                            <Button
                                onClick={() => setShowPurchaseModal(true)}
                                className="w-full py-4 text-lg"
                            >
                                <CreditCard className="h-5 w-5 mr-2" />
                                Buy {(selectedPack.coin_amount + selectedPack.bonus_coins).toLocaleString()} coins for ${selectedPack.price_usd.toFixed(2)}
                                <ChevronRight className="h-5 w-5 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* VIP benefits */}
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Crown className="h-5 w-5 text-yellow-400" />
                        VIP Benefits
                    </h2>
                    <p className="text-sm text-slate-400 mb-4">
                        The more you purchase, the better rewards you get!
                    </p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {vipLevels.map((level) => (
                            <div
                                key={level.level}
                                className={`p-3 rounded-lg text-center ${balance.vip_level >= level.level
                                        ? 'bg-purple-500/20 border border-purple-500/30'
                                        : 'bg-slate-700/50'
                                    }`}
                            >
                                <level.icon className={`h-5 w-5 mx-auto mb-1 ${level.color}`} />
                                <div className="text-xs text-slate-300">{level.name}</div>
                                <div className="text-xs text-green-400">{level.bonus}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* History link */}
                <Button variant="secondary" className="w-full">
                    <History className="h-4 w-4 mr-2" />
                    View Purchase History
                </Button>
            </div>

            {/* Purchase modal */}
            {showPurchaseModal && selectedPack && (
                <PurchaseModal
                    pack={selectedPack}
                    onConfirm={handlePurchase}
                    onClose={() => setShowPurchaseModal(false)}
                    isLoading={purchaseMutation.isPending}
                />
            )}
        </div>
    );
}

export default CurrencyShop;
