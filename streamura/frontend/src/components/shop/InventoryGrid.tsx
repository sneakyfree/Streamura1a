import { useState, useEffect } from 'react';
import { Package, Star, Sparkles, Image, Palette } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { virtualGoodsApi, type InventoryItem } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface InventoryGridProps {
  userId?: number;
  viewOnly?: boolean;
}

export function InventoryGrid({ userId, viewOnly = false }: InventoryGridProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadInventory();
  }, [userId]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      let items: InventoryItem[];
      if (userId) {
        items = await virtualGoodsApi.getUserEquipped(userId);
      } else {
        items = await virtualGoodsApi.getInventory();
      }
      setInventory(items);
    } catch (error) {
      console.error('Failed to load inventory:', error);
      toast({
        title: 'Error',
        description: 'Failed to load inventory',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEquip = async (item: InventoryItem) => {
    setEquipping(item.id);
    try {
      await virtualGoodsApi.equipItem(item.id, !item.is_equipped);
      loadInventory();
      toast({
        title: item.is_equipped ? 'Item Unequipped' : 'Item Equipped',
        description: `${item.good_name} has been ${item.is_equipped ? 'unequipped' : 'equipped'}.`,
      });
    } catch (error) {
      console.error('Failed to toggle equip:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item',
        variant: 'destructive',
      });
    } finally {
      setEquipping(null);
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'badge':
        return <Image className="h-4 w-4" />;
      case 'emote':
        return <Sparkles className="h-4 w-4" />;
      case 'effect':
        return <Palette className="h-4 w-4" />;
      case 'sticker':
        return <Image className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const groupedInventory = {
    badge: inventory.filter((i) => i.good_type === 'badge'),
    emote: inventory.filter((i) => i.good_type === 'emote'),
    effect: inventory.filter((i) => i.good_type === 'effect'),
    sticker: inventory.filter((i) => i.good_type === 'sticker'),
  };

  const equippedItems = inventory.filter((i) => i.is_equipped);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {viewOnly ? 'No Items Equipped' : 'Your Inventory is Empty'}
          </h3>
          <p className="text-muted-foreground text-center">
            {viewOnly
              ? "This user hasn't equipped any items."
              : 'Visit the shop to purchase badges, emotes, and more!'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!viewOnly && equippedItems.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Equipped Items</h3>
          <div className="flex flex-wrap gap-3">
            {equippedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20"
              >
                {item.good_image_url ? (
                  <img src={item.good_image_url} alt="" className="w-8 h-8 object-contain" />
                ) : (
                  getTypeIcon(item.good_type)
                )}
                <span className="font-medium text-sm">{item.good_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="badge" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="badge">
            Badges ({groupedInventory.badge.length})
          </TabsTrigger>
          <TabsTrigger value="emote">
            Emotes ({groupedInventory.emote.length})
          </TabsTrigger>
          <TabsTrigger value="effect">
            Effects ({groupedInventory.effect.length})
          </TabsTrigger>
          <TabsTrigger value="sticker">
            Stickers ({groupedInventory.sticker.length})
          </TabsTrigger>
        </TabsList>

        {Object.entries(groupedInventory).map(([type, items]) => (
          <TabsContent key={type} value={type} className="mt-4">
            {items.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No {type}s in inventory
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {items.map((item) => (
                  <Card key={item.id} className={item.is_equipped ? 'ring-2 ring-primary' : ''}>
                    <CardHeader className="p-3 pb-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {getTypeIcon(item.good_type)}
                          <span className="ml-1 capitalize">{item.good_type}</span>
                        </Badge>
                        {item.quantity > 1 && (
                          <Badge variant="outline">x{item.quantity}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                        {item.good_animation_url ? (
                          <img
                            src={item.good_animation_url}
                            alt={item.good_name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : item.good_image_url ? (
                          <img
                            src={item.good_image_url}
                            alt={item.good_name}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          getTypeIcon(item.good_type)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm truncate">{item.good_name}</p>
                        {item.gifted_from_user_id && (
                          <p className="text-xs text-muted-foreground">Gifted</p>
                        )}
                      </div>
                      {!viewOnly && (
                        <Button
                          variant={item.is_equipped ? 'secondary' : 'outline'}
                          size="sm"
                          className="w-full"
                          onClick={() => handleToggleEquip(item)}
                          disabled={equipping === item.id}
                        >
                          {equipping === item.id
                            ? 'Updating...'
                            : item.is_equipped
                            ? 'Unequip'
                            : 'Equip'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default InventoryGrid;
