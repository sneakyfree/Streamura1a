import { useState, useEffect } from 'react';
import { Wallet, ArrowUpRight, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { walletApi, stripeApi, payoutApi, type WalletBalance } from '@/lib/api';

interface WalletCardProps {
  className?: string;
}

export function WalletCard({ className = '' }: WalletCardProps) {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');

  const fetchBalance = async () => {
    try {
      const data = await walletApi.getBalance();
      setBalance(data);
      setError(null);
    } catch {
      setError('Failed to load wallet');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const handleSetupPayments = async () => {
    setIsSettingUp(true);
    try {
      // First create account if needed
      if (!balance?.stripe_connected) {
        await stripeApi.createConnectAccount();
      }

      // Get onboarding link
      const returnUrl = `${window.location.origin}/profile?setup=complete`;
      const refreshUrl = `${window.location.origin}/profile?setup=refresh`;
      const { onboarding_url } = await stripeApi.getOnboardingLink(returnUrl, refreshUrl);

      // Redirect to Stripe
      window.location.href = onboarding_url;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set up payments';
      setError(errorMessage);
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount < 5) {
      setError('Minimum payout is $5.00');
      return;
    }
    if (balance && amount > balance.balance) {
      setError('Amount exceeds available balance');
      return;
    }

    setIsRequestingPayout(true);
    try {
      await payoutApi.requestPayout({ amount });
      setPayoutAmount('');
      await fetchBalance();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request payout';
      setError(errorMessage);
    } finally {
      setIsRequestingPayout(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-green-500" />
          <h3 className="font-semibold text-white">Wallet</h3>
        </div>
        <button
          onClick={fetchBalance}
          className="p-1 rounded hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Available</p>
            <p className="text-xl font-bold text-white">
              ${balance?.balance.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Pending</p>
            <p className="text-lg font-medium text-yellow-400">
              ${balance?.pending_payout.toFixed(2) || '0.00'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Lifetime</p>
            <p className="text-lg font-medium text-green-400">
              ${balance?.lifetime_earnings.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {/* Stripe Status */}
        {!balance?.stripe_connected ? (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-yellow-200 font-medium">Set up payments to earn</p>
                <p className="text-xs text-yellow-300/70 mt-1">
                  Connect your bank account to receive tips and payouts
                </p>
                <Button
                  size="sm"
                  onClick={handleSetupPayments}
                  isLoading={isSettingUp}
                  className="mt-3 bg-yellow-600 hover:bg-yellow-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Set Up Payments
                </Button>
              </div>
            </div>
          </div>
        ) : !balance?.onboarding_complete ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-blue-200 font-medium">Complete your setup</p>
                <p className="text-xs text-blue-300/70 mt-1">
                  Finish setting up your account to start receiving payments
                </p>
                <Button
                  size="sm"
                  onClick={handleSetupPayments}
                  isLoading={isSettingUp}
                  className="mt-3 bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Continue Setup
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Payout Request */
          balance.payout_enabled && balance.balance >= 5 && (
            <div className="space-y-2">
              <label className="block text-sm text-slate-400">Request Payout</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    min="5"
                    max={balance.balance}
                    step="0.01"
                    placeholder="Min $5.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full pl-7 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <Button
                  onClick={handleRequestPayout}
                  isLoading={isRequestingPayout}
                  disabled={!payoutAmount || parseFloat(payoutAmount) < 5}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  Withdraw
                </Button>
              </div>
            </div>
          )
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
