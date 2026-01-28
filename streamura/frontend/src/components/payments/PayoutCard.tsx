import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    DollarSign,
    Zap,
    Clock,
    TrendingUp,
    ArrowRight,
    Loader2,
    AlertCircle,
    CheckCircle,
    Settings,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PayoutCardProps {
    className?: string;
}

interface BalanceData {
    available: number;
    pending: number;
    instant_available: number;
    currency: string;
    last_payout: string | null;
    can_instant_payout: boolean;
}

export function PayoutCard({ className }: PayoutCardProps) {
    const queryClient = useQueryClient();
    const [payoutSpeed, setPayoutSpeed] = useState<'instant' | 'standard'>('instant');
    const [showSettings, setShowSettings] = useState(false);

    const { data: balance, isLoading: balanceLoading } = useQuery({
        queryKey: ['payouts', 'balance'],
        queryFn: async () => {
            const response = await api.get('/payouts/balance');
            return response.data as BalanceData;
        },
        refetchInterval: 30000,
    });

    const { data: feeData } = useQuery({
        queryKey: ['payouts', 'fee', balance?.available, payoutSpeed],
        queryFn: async () => {
            if (!balance?.available || balance.available < 1) return null;
            const response = await api.post('/payouts/calculate-fee', {
                amount: balance.available,
                speed: payoutSpeed,
            });
            return response.data;
        },
        enabled: !!balance?.available && balance.available >= 1,
    });

    const payoutMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post('/payouts/request', {
                speed: payoutSpeed,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payouts'] });
        },
    });

    if (balanceLoading) {
        return (
            <div className={cn('p-6 bg-slate-800 rounded-xl animate-pulse', className)}>
                <div className="h-32 bg-slate-700 rounded-lg" />
            </div>
        );
    }

    const available = balance?.available || 0;
    const pending = balance?.pending || 0;
    const canPayout = available >= 1;

    return (
        <div className={cn('bg-slate-800 rounded-xl border border-slate-700 overflow-hidden', className)}>
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                            <DollarSign className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Your Earnings</h3>
                            <p className="text-xs text-slate-400">Instant payouts available</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                        <Settings className="h-5 w-5 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Balance Display */}
            <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-xs text-slate-400 mb-1">Available</p>
                        <p className="text-2xl font-bold text-green-400">${available.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                        <p className="text-xs text-slate-400 mb-1">Pending</p>
                        <p className="text-2xl font-bold text-yellow-400">${pending.toFixed(2)}</p>
                    </div>
                </div>

                {/* Payout Speed Selection */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setPayoutSpeed('instant')}
                        disabled={!balance?.can_instant_payout}
                        className={cn(
                            'flex-1 p-3 rounded-lg border-2 transition-all',
                            payoutSpeed === 'instant'
                                ? 'border-green-500 bg-green-500/10'
                                : 'border-slate-600 hover:border-slate-500',
                            !balance?.can_instant_payout && 'opacity-50 cursor-not-allowed'
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-green-400" />
                            <span className="text-sm font-medium text-white">Instant</span>
                        </div>
                        <p className="text-xs text-slate-400">~30 minutes</p>
                        <p className="text-xs text-green-400 mt-1">1% fee (max $5)</p>
                    </button>
                    <button
                        onClick={() => setPayoutSpeed('standard')}
                        className={cn(
                            'flex-1 p-3 rounded-lg border-2 transition-all',
                            payoutSpeed === 'standard'
                                ? 'border-blue-500 bg-blue-500/10'
                                : 'border-slate-600 hover:border-slate-500'
                        )}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">Standard</span>
                        </div>
                        <p className="text-xs text-slate-400">2-3 business days</p>
                        <p className="text-xs text-blue-400 mt-1">Free</p>
                    </button>
                </div>

                {/* Fee Breakdown */}
                {feeData && canPayout && (
                    <div className="p-3 bg-slate-700/30 rounded-lg mb-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">Amount</span>
                            <span className="text-white">${feeData.amount?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">Fee</span>
                            <span className="text-red-400">-${feeData.fee?.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium pt-2 border-t border-slate-600">
                            <span className="text-slate-300">You'll receive</span>
                            <span className="text-green-400">${feeData.net_amount?.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Payout Button */}
                <Button
                    className="w-full"
                    disabled={!canPayout || payoutMutation.isPending}
                    onClick={() => payoutMutation.mutate()}
                >
                    {payoutMutation.isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {canPayout ? `Request ${payoutSpeed === 'instant' ? 'Instant ' : ''}Payout` : 'Minimum $1.00'}
                        </>
                    )}
                </Button>

                {/* Status Messages */}
                {payoutMutation.isSuccess && (
                    <div className="mt-3 p-3 bg-green-500/20 rounded-lg flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-green-400 font-medium">Payout requested!</p>
                            <p className="text-xs text-green-300/70">
                                {payoutSpeed === 'instant'
                                    ? 'Funds will arrive in ~30 minutes.'
                                    : 'Funds will arrive in 2-3 business days.'}
                            </p>
                        </div>
                    </div>
                )}

                {payoutMutation.isError && (
                    <div className="mt-3 p-3 bg-red-500/20 rounded-lg flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm text-red-400 font-medium">Payout failed</p>
                            <p className="text-xs text-red-300/70">Please try again or contact support.</p>
                        </div>
                    </div>
                )}

                {/* Last payout info */}
                {balance?.last_payout && (
                    <p className="text-xs text-slate-500 mt-3 text-center">
                        Last payout: {new Date(balance.last_payout).toLocaleDateString()}
                    </p>
                )}
            </div>

            {/* Competitive Advantage Banner */}
            <div className="px-4 pb-4">
                <div className="p-3 bg-gradient-to-r from-primary-500/10 to-purple-500/10 rounded-lg border border-primary-500/20">
                    <div className="flex items-center gap-2 text-sm">
                        <Zap className="h-4 w-4 text-primary-400" />
                        <span className="text-primary-400 font-medium">90% revenue share</span>
                        <ArrowRight className="h-3 w-3 text-slate-500" />
                        <span className="text-slate-400">You keep more</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
