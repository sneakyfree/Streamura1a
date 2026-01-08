import { useState, useEffect } from 'react';
import { CreditCard, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { stripeApi, type StripeAccountStatus } from '@/lib/api';

interface StripeOnboardingProps {
  className?: string;
  onComplete?: () => void;
  variant?: 'card' | 'inline' | 'banner';
}

export function StripeOnboarding({ className = '', onComplete, variant = 'card' }: StripeOnboardingProps) {
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await stripeApi.getAccountStatus();
      setStatus(data);
      if (data.onboarding_complete && data.payouts_enabled) {
        onComplete?.();
      }
    } catch {
      // User may not have an account yet, that's okay
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleStartOnboarding = async () => {
    try {
      setIsRedirecting(true);
      setError(null);

      // Create account if doesn't exist
      if (!status?.account_id) {
        await stripeApi.createConnectAccount();
      }

      // Get onboarding link
      const returnUrl = `${window.location.origin}${window.location.pathname}?stripe=complete`;
      const refreshUrl = `${window.location.origin}${window.location.pathname}?stripe=refresh`;
      const { onboarding_url } = await stripeApi.getOnboardingLink(returnUrl, refreshUrl);

      window.location.href = onboarding_url;
    } catch {
      setError('Failed to start Stripe setup');
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  const isComplete = status?.onboarding_complete && status?.payouts_enabled;

  if (isComplete) {
    if (variant === 'banner') {
      return (
        <div className={`p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 ${className}`}>
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-green-400 text-sm">Stripe account connected</span>
        </div>
      );
    }
    return null;
  }

  if (variant === 'banner') {
    return (
      <div className={`p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg ${className}`}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-400 mb-1">Setup Required</h4>
            <p className="text-slate-400 text-sm mb-3">
              Connect your Stripe account to enable monetization and receive payments.
            </p>
            {error && (
              <p className="text-red-400 text-sm mb-2">{error}</p>
            )}
            <Button
              size="sm"
              onClick={handleStartOnboarding}
              disabled={isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Connect Stripe
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-between gap-4 ${className}`}>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-slate-400" />
          <span className="text-slate-300 text-sm">Stripe not connected</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleStartOnboarding}
          disabled={isRedirecting}
        >
          {isRedirecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={className}>
      <CardContent className="py-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-6 h-6 text-primary-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Connect Stripe</h3>
          <p className="text-slate-400 text-sm mb-4">
            Connect your Stripe account to start receiving payments from tips and earn from your streams.
          </p>
          {error && (
            <p className="text-red-400 text-sm mb-3">{error}</p>
          )}
          <Button
            onClick={handleStartOnboarding}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirecting to Stripe...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Connect Stripe Account
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500 mt-4">
            You'll be redirected to Stripe to securely set up your account.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
