import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Crown, Calendar, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { subscriptionApi, type Subscription, type SubscriptionTier } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionWithTier extends Subscription {
  tier?: SubscriptionTier;
  creator_name?: string;
}

export function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionWithTier | null>(null);
  const [canceling, setCanceling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const data = await subscriptionApi.getMySubscriptions();

      // Fetch tier details for each subscription
      const withTiers = await Promise.all(
        data.map(async (sub) => {
          try {
            const tier = await subscriptionApi.getTier(sub.tier_id);
            return { ...sub, tier };
          } catch {
            return sub;
          }
        })
      );

      setSubscriptions(withTiers);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your subscriptions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (subscription: SubscriptionWithTier) => {
    setSelectedSubscription(subscription);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedSubscription) return;

    setCanceling(true);
    try {
      await subscriptionApi.cancelSubscription(selectedSubscription.id, false);
      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription will end at the current billing period.',
      });
      loadSubscriptions();
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setCanceling(false);
      setCancelDialogOpen(false);
      setSelectedSubscription(null);
    }
  };

  const getStatusBadge = (subscription: SubscriptionWithTier) => {
    switch (subscription.status) {
      case 'active':
        if (subscription.cancel_at_period_end) {
          return <Badge variant="secondary">Canceling</Badge>;
        }
        return <Badge variant="default">Active</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      default:
        return <Badge variant="outline">{subscription.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Crown className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Subscriptions</h3>
          <p className="text-muted-foreground text-center">
            Subscribe to your favorite creators to support them and unlock exclusive benefits.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Subscriptions</h2>

      {subscriptions.map((subscription) => (
        <Card key={subscription.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {subscription.tier?.badge_url && (
                  <img src={subscription.tier.badge_url} alt="" className="h-6 w-6" />
                )}
                {subscription.tier?.name || 'Subscription'}
              </CardTitle>
              <CardDescription>
                {subscription.tier
                  ? `$${subscription.tier.price}/${subscription.tier.billing_period === 'yearly' ? 'year' : 'mo'}`
                  : 'Loading...'}
              </CardDescription>
            </div>
            {getStatusBadge(subscription)}
          </CardHeader>

          <CardContent className="space-y-4">
            {subscription.current_period_end && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {subscription.cancel_at_period_end
                    ? `Ends ${format(new Date(subscription.current_period_end), 'MMM d, yyyy')}`
                    : `Renews ${formatDistanceToNow(new Date(subscription.current_period_end), { addSuffix: true })}`}
                </span>
              </div>
            )}

            {subscription.gift_from_user_id && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Gifted subscription</span>
              </div>
            )}

            {subscription.status === 'past_due' && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Payment failed. Please update your payment method.</span>
              </div>
            )}

            {subscription.tier?.benefits && subscription.tier.benefits.length > 0 && (
              <div className="text-sm">
                <span className="font-medium">Benefits:</span>
                <ul className="list-disc list-inside mt-1 text-muted-foreground">
                  {subscription.tier.benefits.slice(0, 3).map((benefit, i) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {subscription.status === 'active' && !subscription.cancel_at_period_end && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelClick(subscription)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Your subscription will remain active until the end of the current billing period.
              You won't be charged again, but you'll lose access to subscriber benefits after{' '}
              {selectedSubscription?.current_period_end &&
                format(new Date(selectedSubscription.current_period_end), 'MMM d, yyyy')}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? 'Canceling...' : 'Cancel Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SubscriptionsList;
