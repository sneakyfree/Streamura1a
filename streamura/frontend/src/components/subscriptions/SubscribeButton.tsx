import { useState, useEffect } from 'react';
import { Crown, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { subscriptionApi, type SubscriptionTier, type SubscriptionStatus } from '@/lib/api';
import { SubscriptionTierCard } from './SubscriptionTierCard';
import { useToast } from '@/hooks/use-toast';

interface SubscribeButtonProps {
  creatorId: number;
  creatorName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function SubscribeButton({
  creatorId,
  creatorName,
  variant = 'default',
  size = 'default',
  className,
}: SubscribeButtonProps) {
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, creatorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tiersData, statusData] = await Promise.all([
        subscriptionApi.getTiers(creatorId),
        subscriptionApi.isSubscribed(creatorId),
      ]);
      setTiers(tiersData);
      setSubscriptionStatus(statusData);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription options',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    setCheckoutLoading(true);
    try {
      const successUrl = `${window.location.origin}/subscription/success?tier=${tier.id}`;
      const cancelUrl = `${window.location.origin}/subscription/cancel`;

      const { checkout_url } = await subscriptionApi.createCheckout(
        tier.id,
        successUrl,
        cancelUrl
      );

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (error: unknown) {
      console.error('Failed to create checkout session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start subscription';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const isSubscribed = subscriptionStatus?.is_subscribed ?? false;

  return (
    <>
      {/* The project's Dialog renders nothing while closed, so the trigger must
          live OUTSIDE it (it is not a Radix-style context trigger). */}
      <Button
        variant={isSubscribed ? 'secondary' : variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {isSubscribed ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Subscribed
          </>
        ) : (
          <>
            <Crown className="h-4 w-4 mr-2" />
            Subscribe
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isSubscribed ? 'Manage Subscription' : 'Subscribe'} to {creatorName || 'this creator'}
          </DialogTitle>
          <DialogDescription>
            {isSubscribed
              ? 'You can change your subscription tier or manage your current subscription.'
              : 'Choose a subscription tier to support this creator and unlock exclusive benefits.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            This creator hasn't set up any subscription tiers yet.
          </div>
        ) : (
          <div className={`grid gap-4 ${tiers.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : tiers.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {tiers.map((tier) => (
              <SubscriptionTierCard
                key={tier.id}
                tier={tier}
                isSubscribed={isSubscribed}
                currentTierId={subscriptionStatus?.tier_id}
                onSubscribe={handleSubscribe}
                showSubscribeButton={!checkoutLoading}
              />
            ))}
          </div>
        )}

        {checkoutLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mr-2" />
            <span>Redirecting to checkout...</span>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SubscribeButton;
