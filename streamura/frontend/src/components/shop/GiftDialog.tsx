import { useState } from 'react';
import { Gift, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { virtualGoodsApi, discoveryApi, type VirtualGood } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface GiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  good: VirtualGood;
  onComplete?: () => void;
}

interface SearchResult {
  id: number;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export function GiftDialog({ open, onOpenChange, good, onComplete }: GiftDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [gifting, setGifting] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await discoveryApi.search({ q: searchQuery, type: 'users', limit: 10 });
      setSearchResults(results.users.map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name ?? null,
        avatar_url: u.avatar_url,
      })));
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleGift = async () => {
    if (!selectedUser) return;

    setGifting(true);
    try {
      await virtualGoodsApi.gift(good.id, selectedUser.id);
      toast({
        title: 'Gift Sent!',
        description: `${good.name} has been gifted to ${selectedUser.username || selectedUser.display_name}!`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (error: unknown) {
      console.error('Gift failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send gift';
      toast({
        title: 'Gift Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setGifting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gift {good.name}
          </DialogTitle>
          <DialogDescription>
            Search for a user to gift this item to. The cost will be deducted from your balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            {good.image_url ? (
              <img src={good.image_url} alt={good.name} className="w-12 h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 bg-background rounded flex items-center justify-center">
                <Gift className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="font-medium">{good.name}</p>
              <p className="text-sm text-muted-foreground">${good.price.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Search Recipient</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recipient"
                  placeholder="Enter username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>Select Recipient</Label>
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors ${
                      selectedUser?.id === user.id ? 'bg-muted' : ''
                    }`}
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="font-medium">
                        {user.display_name || user.username || 'Anonymous'}
                      </p>
                      {user.username && (
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      )}
                    </div>
                    {selectedUser?.id === user.id && (
                      <div className="ml-auto">
                        <div className="w-4 h-4 rounded-full bg-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedUser && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Gifting to:</p>
              <p className="font-medium">
                {selectedUser.display_name || selectedUser.username || 'Anonymous'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGift} disabled={!selectedUser || gifting}>
            <Gift className="h-4 w-4 mr-2" />
            {gifting ? 'Sending...' : `Gift for $${good.price.toFixed(2)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GiftDialog;
