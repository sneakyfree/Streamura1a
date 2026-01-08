import { useState } from 'react';
import { ShoppingCart, Gift, Lock, Sparkles, Palette, Image } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type VirtualGood } from '@/lib/api';

interface VirtualGoodCardProps {
  good: VirtualGood;
  onPurchase?: (good: VirtualGood) => void;
  onGift?: (good: VirtualGood) => void;
  owned?: boolean;
  canPurchase?: boolean;
  isSubscriberExclusive?: boolean;
}

export function VirtualGoodCard({
  good,
  onPurchase,
  onGift,
  owned = false,
  canPurchase = true,
  isSubscriberExclusive = false,
}: VirtualGoodCardProps) {
  const [loading, setLoading] = useState(false);

  const getTypeIcon = () => {
    switch (good.type) {
      case 'badge':
        return <Image className="h-4 w-4" />;
      case 'emote':
        return <Sparkles className="h-4 w-4" />;
      case 'effect':
        return <Palette className="h-4 w-4" />;
      case 'sticker':
        return <Image className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = () => {
    switch (good.type) {
      case 'badge':
        return 'bg-yellow-500';
      case 'emote':
        return 'bg-purple-500';
      case 'effect':
        return 'bg-blue-500';
      case 'sticker':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handlePurchase = async () => {
    if (!onPurchase) return;
    setLoading(true);
    try {
      await onPurchase(good);
    } finally {
      setLoading(false);
    }
  };

  const handleGift = async () => {
    if (!onGift) return;
    setLoading(true);
    try {
      await onGift(good);
    } finally {
      setLoading(false);
    }
  };

  const isSoldOut = good.is_limited && good.quantity_available !== null && good.quantity_sold >= good.quantity_available;

  return (
    <Card className={`relative overflow-hidden ${!good.is_active || isSoldOut ? 'opacity-60' : ''}`}>
      {good.is_limited && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-red-500 text-white">
            Limited
          </Badge>
        </div>
      )}

      {owned && (
        <div className="absolute top-2 left-2">
          <Badge variant="default">Owned</Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge className={`${getTypeBadgeColor()} text-white`}>
            {getTypeIcon()}
            <span className="ml-1 capitalize">{good.type}</span>
          </Badge>
        </div>
        <CardTitle className="text-lg mt-2">{good.name}</CardTitle>
        {good.description && (
          <CardDescription className="line-clamp-2">{good.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex justify-center py-4">
        {good.image_url ? (
          <div className="relative">
            {good.animation_url ? (
              <img
                src={good.animation_url}
                alt={good.name}
                className="w-24 h-24 object-contain"
              />
            ) : (
              <img
                src={good.image_url}
                alt={good.name}
                className="w-24 h-24 object-contain"
              />
            )}
          </div>
        ) : (
          <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
            {getTypeIcon()}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
          <span className="text-xl font-bold">
            ${good.price.toFixed(2)}
          </span>
          {good.is_limited && good.quantity_available && (
            <span className="text-sm text-muted-foreground">
              {good.quantity_available - good.quantity_sold} left
            </span>
          )}
        </div>

        {isSubscriberExclusive && !canPurchase ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button className="w-full" variant="secondary" disabled>
                  <Lock className="h-4 w-4 mr-2" />
                  Subscriber Only
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Subscribe to this creator to purchase this item</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : owned ? (
          <Button className="w-full" variant="secondary" disabled>
            Owned
          </Button>
        ) : isSoldOut ? (
          <Button className="w-full" variant="secondary" disabled>
            Sold Out
          </Button>
        ) : (
          <div className="flex gap-2 w-full">
            <Button
              className="flex-1"
              onClick={handlePurchase}
              disabled={loading || !good.is_active}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {loading ? 'Processing...' : 'Buy'}
            </Button>
            {onGift && (
              <Button
                variant="outline"
                onClick={handleGift}
                disabled={loading || !good.is_active}
              >
                <Gift className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {good.tier_name && (
          <p className="text-xs text-muted-foreground text-center">
            Exclusive to {good.tier_name} subscribers
          </p>
        )}
      </CardFooter>
    </Card>
  );
}

export default VirtualGoodCard;
