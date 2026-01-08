import { useState, useEffect } from 'react';
import { CreditCard, ExternalLink, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { stripeApi, type StripeAccountStatus } from '@/lib/api';

interface PayoutSettingsProps {
  className?: string;
  onStatusChange?: (status: StripeAccountStatus) => void;
}

export function PayoutSettings({ className = '', onStatusChange }: PayoutSettingsProps) {
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const data = await stripeApi.getAccountStatus();
      setStatus(data);
      onStatusChange?.(data);
      setError(null);
    } catch {
      setError('Failed to load payout settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSetupPayouts = async () => {
    try {
      setIsOnboarding(true);
      setError(null);

      // Create account if doesn't exist
      if (!status?.account_id) {
        await stripeApi.createConnectAccount();
      }

      // Get onboarding link
      const returnUrl = `${window.location.origin}/profile?stripe=complete`;
      const refreshUrl = `${window.location.origin}/profile?stripe=refresh`;
      const { onboarding_url } = await stripeApi.getOnboardingLink(returnUrl, refreshUrl);

      // Redirect to Stripe
      window.location.href = onboarding_url;
    } catch {
      setError('Failed to start payout setup');
      setIsOnboarding(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const isComplete = status?.onboarding_complete && status?.payouts_enabled;
  const needsAttention = status?.account_id && !status?.onboarding_complete;

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payout Settings
        </h3>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Status Display */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Payout Method</span>
            <span className="text-white">
              {isComplete ? 'Stripe Connected' : 'Not set'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Account Status</span>
            <span className={`flex items-center gap-1 ${
              isComplete ? 'text-green-400' : needsAttention ? 'text-yellow-400' : 'text-slate-400'
            }`}>
              {isComplete ? (
                <>
                  <CheckCircle className="w-3 h-3" />
                  Active
                </>
              ) : needsAttention ? (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Needs Attention
                </>
              ) : (
                'Not connected'
              )}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Charges Enabled</span>
            <span className={status?.charges_enabled ? 'text-green-400' : 'text-slate-400'}>
              {status?.charges_enabled ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Payouts Enabled</span>
            <span className={status?.payouts_enabled ? 'text-green-400' : 'text-slate-400'}>
              {status?.payouts_enabled ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Minimum Payout</span>
            <span className="text-white">$5.00</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Revenue Split</span>
            <span className="text-white">70% (you keep)</span>
          </div>
        </div>

        {/* Action Button */}
        {!isComplete && (
          <Button
            onClick={handleSetupPayouts}
            disabled={isOnboarding}
            className="w-full"
            variant={needsAttention ? 'secondary' : 'primary'}
          >
            {isOnboarding ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                {needsAttention ? 'Complete Setup' : 'Setup Payouts'}
              </>
            )}
          </Button>
        )}

        {isComplete && (
          <Button
            variant="secondary"
            onClick={handleSetupPayouts}
            disabled={isOnboarding}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage Payout Settings
          </Button>
        )}

        {/* Info Text */}
        <p className="text-xs text-slate-500 text-center">
          Payouts are processed via Stripe. You'll need to provide your bank details to receive payments.
        </p>
      </CardContent>
    </Card>
  );
}
