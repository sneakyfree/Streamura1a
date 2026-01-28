import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Clock, CheckCircle, AlertCircle, ExternalLink, Loader2, ArrowRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { payoutApi } from '@/lib/api';
import { toast } from 'sonner';
import { RevenueShareBanner } from '@/components/payments/RevenueShareBanner';

export default function PayoutsPage() {
    const queryClient = useQueryClient();
    const [isRequesting, setIsRequesting] = useState(false);

    // Fetch earnings summary
    const { data: earnings, isLoading: earningsLoading, error: earningsError, refetch } = useQuery({
        queryKey: ['earnings'],
        queryFn: () => payoutApi.getEarnings(),
    });

    // Fetch payout history
    const { data: payouts, isLoading: payoutsLoading } = useQuery({
        queryKey: ['payouts-history'],
        queryFn: () => payoutApi.getHistory(),
    });

    // Request payout mutation
    const requestPayout = useMutation({
        mutationFn: (amount: number) => payoutApi.requestPayout({ amount, currency: 'usd' }),
        onSuccess: () => {
            toast.success('Payout requested successfully! Funds will arrive in 2-3 business days.');
            queryClient.invalidateQueries({ queryKey: ['earnings'] });
            queryClient.invalidateQueries({ queryKey: ['payouts-history'] });
            setIsRequesting(false);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to request payout');
            setIsRequesting(false);
        },
    });

    const handleRequestPayout = () => {
        if (!earnings?.available_balance || earnings.available_balance < 1) {
            toast.error('Minimum payout amount is $1');
            return;
        }
        setIsRequesting(true);
        requestPayout.mutate(earnings.available_balance);
    };

    const isLoading = earningsLoading || payoutsLoading;

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                <span className="ml-3 text-slate-400">Loading earnings...</span>
            </div>
        );
    }

    // Error state
    if (earningsError) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">Failed to load earnings</h2>
                    <p className="text-slate-400 mb-4">Please try again later</p>
                    <Button onClick={() => refetch()}>Try Again</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Payouts</h1>
                        <p className="text-slate-400">Manage your earnings and withdrawals</p>
                    </div>
                </div>

                {/* Earnings Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <p className="text-slate-400 text-sm mb-1">Available Balance</p>
                            <p className="text-3xl font-bold text-white">
                                ${earnings?.available_balance?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Ready to withdraw</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <p className="text-slate-400 text-sm mb-1">Pending</p>
                            <p className="text-3xl font-bold text-yellow-400">
                                ${earnings?.pending_balance?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Processing, available in 7 days</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="p-6">
                            <p className="text-slate-400 text-sm mb-1">Total Earned</p>
                            <p className="text-3xl font-bold text-green-400">
                                ${earnings?.total_earned?.toFixed(2) || '0.00'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">Lifetime earnings</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Revenue Share Banner */}
                <div className="mb-8">
                    <RevenueShareBanner variant="compact" showComparison={false} />
                </div>

                {/* Instant Payout Section */}
                {earnings?.stripe_connected && earnings?.available_balance >= 10 && (
                    <Card className="mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
                        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                    <Zap className="h-5 w-5 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white flex items-center gap-2">
                                        Instant Payout
                                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">NEW</span>
                                    </h3>
                                    <p className="text-slate-400 text-sm">
                                        Get ${(earnings.available_balance * 0.985).toFixed(2)} now (1.5% fee)
                                    </p>
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    toast.promise(
                                        payoutApi.requestInstantPayout({ amount: earnings.available_balance }),
                                        {
                                            loading: 'Processing instant payout...',
                                            success: 'Instant payout sent! Funds arriving within minutes.',
                                            error: 'Instant payout failed. Please try again.',
                                        }
                                    );
                                }}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                Instant Payout
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Stripe Connect Status */}
                {!earnings?.stripe_connected && (
                    <Card className="mb-8 border-yellow-500/30 bg-yellow-500/5">
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white">Connect your bank account</h3>
                                    <p className="text-slate-400 text-sm">
                                        Complete Stripe onboarding to receive payouts. This only takes a few minutes.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => window.open(earnings?.stripe_onboarding_url || '/settings/payments', '_blank')}
                                    className="bg-yellow-600 hover:bg-yellow-700"
                                >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Connect with Stripe
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Request Payout Button */}
                {earnings?.stripe_connected && (
                    <Card className="mb-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
                        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-semibold text-white">Request Payout</h3>
                                <p className="text-slate-400 text-sm">
                                    {earnings.available_balance >= 1
                                        ? `Withdraw $${earnings.available_balance.toFixed(2)} to your bank account`
                                        : `Minimum payout is $1. Current balance: $${earnings.available_balance.toFixed(2)}`
                                    }
                                </p>
                            </div>
                            <Button
                                onClick={handleRequestPayout}
                                disabled={isRequesting || earnings.available_balance < 1}
                                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                            >
                                {isRequesting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                )}
                                {isRequesting ? 'Processing...' : 'Request Payout'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Payout History */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white">Payout History</h2>
                    </CardHeader>
                    <CardContent className="p-0">
                        {!payouts || payouts.length === 0 ? (
                            <div className="text-center py-12">
                                <Clock className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-white mb-2">No payouts yet</h3>
                                <p className="text-slate-500 text-sm mb-4">Your payout history will appear here</p>
                                <Link to="/go-live">
                                    <Button variant="secondary">Start Streaming to Earn</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-700">
                                {payouts.map((payout) => (
                                    <div
                                        key={payout.id}
                                        className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {payout.status === 'completed' ? (
                                                <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                </div>
                                            ) : payout.status === 'pending' ? (
                                                <div className="h-8 w-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                                    <Clock className="h-4 w-4 text-yellow-500" />
                                                </div>
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                                    <AlertCircle className="h-4 w-4 text-red-500" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-white font-medium">${payout.amount.toFixed(2)}</p>
                                                <p className="text-slate-400 text-sm">
                                                    {new Date(payout.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-medium capitalize px-3 py-1 rounded-full ${payout.status === 'completed' ? 'text-green-400 bg-green-500/10' :
                                            payout.status === 'pending' ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10'
                                            }`}>
                                            {payout.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
