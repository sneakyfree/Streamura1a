import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, Filter, Package, Loader2 } from 'lucide-react';
import { virtualGoodsApi, type VirtualGood } from '@/lib/api';
import { VirtualGoodCard } from '@/components/shop/VirtualGoodCard';
import { GiftDialog } from '@/components/shop/GiftDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';

type GoodType = 'all' | 'badge' | 'emote' | 'effect' | 'sticker';

export function ShopPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<GoodType>('all');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [selectedGoodForGift, setSelectedGoodForGift] = useState<VirtualGood | null>(null);
  const { toast } = useToast();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: goods = [], isLoading, error, refetch } = useQuery({
    queryKey: ['virtual-goods', typeFilter],
    queryFn: () => virtualGoodsApi.getAll({
      type: typeFilter === 'all' ? undefined : typeFilter,
      limit: 100,
    }),
  });

  const filteredGoods = goods.filter((good) =>
    good.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    good.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedGoods = {
    badge: filteredGoods.filter((g) => g.type === 'badge'),
    emote: filteredGoods.filter((g) => g.type === 'emote'),
    effect: filteredGoods.filter((g) => g.type === 'effect'),
    sticker: filteredGoods.filter((g) => g.type === 'sticker'),
  };

  const handlePurchase = async (good: VirtualGood) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign in Required',
        description: 'Please sign in to purchase items.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await virtualGoodsApi.purchase(good.id);
      toast({
        title: 'Purchase Successful!',
        description: `You now own ${good.name}. New balance: $${result.new_balance.toFixed(2)}`,
      });
      queryClient.invalidateQueries({ queryKey: ['virtual-goods'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: unknown) {
      console.error('Purchase failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase';
      toast({
        title: 'Purchase Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleGiftClick = (good: VirtualGood) => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign in Required',
        description: 'Please sign in to gift items.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedGoodForGift(good);
    setGiftDialogOpen(true);
  };

  const handleGiftComplete = () => {
    setGiftDialogOpen(false);
    setSelectedGoodForGift(null);
    queryClient.invalidateQueries({ queryKey: ['virtual-goods'] });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Shop</h1>
                <p className="text-muted-foreground">Browse badges, emotes, effects, and more</p>
              </div>
            </div>
            {isAuthenticated && (
              <Link to="/inventory">
                <Button variant="outline">
                  <Package className="h-4 w-4 mr-2" />
                  My Inventory
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search virtual goods"
            />
          </div>

          {/* Type Filter */}
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

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading items...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <p className="text-destructive mb-4">Failed to load shop items</p>
            <Button onClick={() => refetch()} variant="secondary">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredGoods.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try adjusting your search terms'
                : 'Check back later for new items'}
            </p>
            {searchQuery && (
              <Button onClick={() => setSearchQuery('')} variant="secondary">
                Clear Search
              </Button>
            )}
          </div>
        )}

        {/* Products Display */}
        {!isLoading && !error && filteredGoods.length > 0 && (
          typeFilter === 'all' ? (
            <Tabs defaultValue="badge" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
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
                <TabsContent key={type} value={type}>
                  {items.length === 0 ? (
                    <p className="text-center py-12 text-muted-foreground">
                      No {type}s available
                    </p>
                  ) : (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                      role="list"
                      aria-label={`${type} items`}
                    >
                      {items.map((good) => (
                        <VirtualGoodCard
                          key={good.id}
                          good={good}
                          onPurchase={handlePurchase}
                          onGift={handleGiftClick}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              role="list"
              aria-label="Virtual goods"
            >
              {filteredGoods.map((good) => (
                <VirtualGoodCard
                  key={good.id}
                  good={good}
                  onPurchase={handlePurchase}
                  onGift={handleGiftClick}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Gift Dialog */}
      {selectedGoodForGift && (
        <GiftDialog
          open={giftDialogOpen}
          onOpenChange={setGiftDialogOpen}
          good={selectedGoodForGift}
          onComplete={handleGiftComplete}
        />
      )}
    </div>
  );
}

export default ShopPage;
