import { useState, useEffect } from 'react';
import { Store, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { virtualGoodsApi, subscriptionApi, type VirtualGood, type SubscriptionStatus } from '@/lib/api';
import { VirtualGoodCard } from './VirtualGoodCard';
import { GiftDialog } from './GiftDialog';
import { useToast } from '@/hooks/use-toast';

interface ShopModalProps {
  creatorId?: number;
  creatorName?: string;
  trigger?: React.ReactNode;
}

type GoodType = 'all' | 'badge' | 'emote' | 'effect' | 'sticker';

export function ShopModal({ creatorId, creatorName, trigger }: ShopModalProps) {
  const [open, setOpen] = useState(false);
  const [goods, setGoods] = useState<VirtualGood[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<GoodType>('all');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [selectedGoodForGift, setSelectedGoodForGift] = useState<VirtualGood | null>(null);
  const [, setPurchaseLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadGoods();
      if (creatorId) {
        loadSubscriptionStatus();
      }
    }
  }, [open, creatorId, typeFilter]);

  const loadGoods = async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof virtualGoodsApi.getAll>[0] = {
        creator_id: creatorId,
        limit: 50,
      };
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const data = await virtualGoodsApi.getAll(params);
      setGoods(data);
    } catch (error) {
      console.error('Failed to load goods:', error);
      toast({
        title: 'Error',
        description: 'Failed to load shop items',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubscriptionStatus = async () => {
    if (!creatorId) return;
    try {
      const status = await subscriptionApi.isSubscribed(creatorId);
      setSubscriptionStatus(status);
    } catch {
      // Not logged in or other error - assume not subscribed
      setSubscriptionStatus(null);
    }
  };

  const handlePurchase = async (good: VirtualGood) => {
    setPurchaseLoading(true);
    try {
      const result = await virtualGoodsApi.purchase(good.id);
      toast({
        title: 'Purchase Successful!',
        description: `You now own ${good.name}. New balance: $${result.new_balance.toFixed(2)}`,
      });
      loadGoods(); // Refresh to update sold count
    } catch (error: unknown) {
      console.error('Purchase failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase';
      toast({
        title: 'Purchase Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleGiftClick = (good: VirtualGood) => {
    setSelectedGoodForGift(good);
    setGiftDialogOpen(true);
  };

  const handleGiftComplete = () => {
    setGiftDialogOpen(false);
    setSelectedGoodForGift(null);
    loadGoods();
  };

  const filteredGoods = goods.filter((good) =>
    good.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    good.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canPurchaseExclusive = (good: VirtualGood) => {
    if (!good.tier_exclusive_id) return true;
    if (!subscriptionStatus?.is_subscribed) return false;
    return true; // For simplicity - in production, check tier level
  };

  const groupedGoods = {
    badge: filteredGoods.filter((g) => g.type === 'badge'),
    emote: filteredGoods.filter((g) => g.type === 'emote'),
    effect: filteredGoods.filter((g) => g.type === 'effect'),
    sticker: filteredGoods.filter((g) => g.type === 'sticker'),
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Store className="h-4 w-4 mr-2" />
              Shop
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {creatorName ? `${creatorName}'s Shop` : 'Virtual Goods Shop'}
            </DialogTitle>
            <DialogDescription>
              Browse and purchase badges, emotes, effects, and stickers
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as GoodType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="badge">Badges</SelectItem>
                <SelectItem value="emote">Emotes</SelectItem>
                <SelectItem value="effect">Effects</SelectItem>
                <SelectItem value="sticker">Stickers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredGoods.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery
                ? 'No items match your search.'
                : 'No items available in the shop.'}
            </div>
          ) : typeFilter === 'all' ? (
            <Tabs defaultValue="badge" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="badge">
                  Badges ({groupedGoods.badge.length})
                </TabsTrigger>
                <TabsTrigger value="emote">
                  Emotes ({groupedGoods.emote.length})
                </TabsTrigger>
                <TabsTrigger value="effect">
                  Effects ({groupedGoods.effect.length})
                </TabsTrigger>
                <TabsTrigger value="sticker">
                  Stickers ({groupedGoods.sticker.length})
                </TabsTrigger>
              </TabsList>

              {Object.entries(groupedGoods).map(([type, items]) => (
                <TabsContent key={type} value={type} className="mt-4">
                  {items.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No {type}s available
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map((good) => (
                        <VirtualGoodCard
                          key={good.id}
                          good={good}
                          onPurchase={handlePurchase}
                          onGift={handleGiftClick}
                          canPurchase={canPurchaseExclusive(good)}
                          isSubscriberExclusive={!!good.tier_exclusive_id}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoods.map((good) => (
                <VirtualGoodCard
                  key={good.id}
                  good={good}
                  onPurchase={handlePurchase}
                  onGift={handleGiftClick}
                  canPurchase={canPurchaseExclusive(good)}
                  isSubscriberExclusive={!!good.tier_exclusive_id}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedGoodForGift && (
        <GiftDialog
          open={giftDialogOpen}
          onOpenChange={setGiftDialogOpen}
          good={selectedGoodForGift}
          onComplete={handleGiftComplete}
        />
      )}
    </>
  );
}

export default ShopModal;
