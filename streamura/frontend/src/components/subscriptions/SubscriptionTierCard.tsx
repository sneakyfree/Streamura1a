import { useState } from 'react';
import { Check, Crown, Star, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionTier } from '@/lib/api';

interface SubscriptionTierCardProps {
  tier: SubscriptionTier;
  isSubscribed?: boolean;
  currentTierId?: number | null;
  onSubscribe?: (tier: SubscriptionTier) => void;
  showSubscribeButton?: boolean;
  isOwner?: boolean;
  onEdit?: (tier: SubscriptionTier) => void;
}

export function SubscriptionTierCard({
  tier,
  isSubscribed = false,
  currentTierId,
  onSubscribe,
  showSubscribeButton = true,
  isOwner = false,
  onEdit,
}: SubscriptionTierCardProps) {
  const [loading, setLoading] = useState(false);

  const isCurrentTier = currentTierId === tier.id;
  const isFull = tier.max_subscribers !== null && tier.current_subscribers >= tier.max_subscribers;

  const handleSubscribe = async () => {
    if (!onSubscribe) return;

    setLoading(true);
    try {
      onSubscribe(tier);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string, period: string) => {
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
    return `${formattedPrice}/${period === 'yearly' ? 'year' : 'mo'}`;
  };

  const getTierIcon = () => {
    if (tier.price >= 25) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (tier.price >= 10) return <Star className="h-5 w-5 text-purple-500" />;
    return <Sparkles className="h-5 w-5 text-blue-500" />;
  };

  return (
    <Card className={`relative ${isCurrentTier ? 'ring-2 ring-primary' : ''} ${!tier.is_active ? 'opacity-60' : ''}`}>
      {isCurrentTier && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="default">Current Plan</Badge>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2">
          {getTierIcon()}
          <CardTitle className="text-xl">{tier.name}</CardTitle>
        </div>
        {tier.badge_url && (
          <img
            src={tier.badge_url}
            alt={`${tier.name} badge`}
            className="w-12 h-12 mx-auto mt-2"
          />
        )}
        <CardDescription className="mt-2">
          {tier.description || 'Support this creator'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-center">
          <span className="text-3xl font-bold">
            {formatPrice(tier.price, tier.currency, tier.billing_period)}
          </span>
        </div>

        {tier.benefits && tier.benefits.length > 0 && (
          <ul className="space-y-2">
            {tier.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {tier.emote_slots > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span>{tier.emote_slots} custom emote{tier.emote_slots > 1 ? 's' : ''}</span>
          </div>
        )}

        {tier.max_subscribers && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{tier.current_subscribers}/{tier.max_subscribers} slots</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {showSubscribeButton && !isOwner && (
          <>
            {isCurrentTier ? (
              <Button variant="secondary" className="w-full" disabled>
                Subscribed
              </Button>
            ) : isSubscribed ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSubscribe}
                disabled={loading || isFull}
              >
                {isFull ? 'Tier Full' : 'Change Tier'}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleSubscribe}
                disabled={loading || isFull || !tier.is_active}
              >
                {loading ? 'Loading...' : isFull ? 'Tier Full' : 'Subscribe'}
              </Button>
            )}
          </>
        )}

        {isOwner && onEdit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onEdit(tier)}
          >
            Edit Tier
          </Button>
        )}

        {!tier.is_active && (
          <Badge variant="secondary" className="mt-2">Inactive</Badge>
        )}
      </CardFooter>
    </Card>
  );
}

export default SubscriptionTierCard;
