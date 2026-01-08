import { useState, useEffect } from 'react';
import { communityApi, type Community } from '@/lib/api';
import { CommunityCard } from './CommunityCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Plus, RefreshCw } from 'lucide-react';
import { CreateCommunityModal } from './CreateCommunityModal';
import { Skeleton } from '@/components/ui/skeleton';

interface CommunityFeedProps {
  currentUserId?: number;
  onCommunityClick?: (community: Community) => void;
}

export function CommunityFeed({
  currentUserId,
  onCommunityClick,
}: CommunityFeedProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');

  useEffect(() => {
    loadCommunities();
    if (currentUserId) {
      loadMyCommunities();
    }
  }, [currentUserId]);

  const loadCommunities = async (search?: string) => {
    setIsSearching(!!search);
    try {
      const response = await communityApi.getAll({
        search,
        is_public: true,
        limit: 50,
      });
      setCommunities(response.communities);
    } catch (error) {
      console.error('Failed to load communities:', error);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const loadMyCommunities = async () => {
    try {
      const data = await communityApi.getMyCommunities();
      setMyCommunities(data);
    } catch (error) {
      console.error('Failed to load my communities:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadCommunities(searchQuery.trim() || undefined);
  };

  const handleJoinChange = (communityId: number, isMember: boolean) => {
    // Update the community in the list
    setCommunities(prev =>
      prev.map(c =>
        c.id === communityId
          ? { ...c, is_member: isMember, member_count: c.member_count + (isMember ? 1 : -1) }
          : c
      )
    );

    // Update my communities list
    if (isMember) {
      const community = communities.find(c => c.id === communityId);
      if (community) {
        setMyCommunities(prev => [...prev, { ...community, is_member: true }]);
      }
    } else {
      setMyCommunities(prev => prev.filter(c => c.id !== communityId));
    }
  };

  const handleCreated = (community: Community) => {
    setCommunities(prev => [community, ...prev]);
    setMyCommunities(prev => [community, ...prev]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Create */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search communities..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline" disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>
        {currentUserId && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          {currentUserId && (
            <TabsTrigger value="my-communities">
              My Communities ({myCommunities.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="discover" className="mt-4">
          {communities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No communities found.</p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchQuery('');
                    loadCommunities();
                  }}
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map(community => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  currentUserId={currentUserId}
                  onJoinChange={handleJoinChange}
                  onClick={() => onCommunityClick?.(community)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {currentUserId && (
          <TabsContent value="my-communities" className="mt-4">
            {myCommunities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>You haven't joined any communities yet.</p>
                <Button
                  variant="ghost"
                  onClick={() => setActiveTab('discover')}
                >
                  Discover communities
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myCommunities.map(community => (
                  <CommunityCard
                    key={community.id}
                    community={{ ...community, is_member: true }}
                    currentUserId={currentUserId}
                    onJoinChange={handleJoinChange}
                    onClick={() => onCommunityClick?.(community)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Refresh button */}
      <div className="flex justify-center pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            loadCommunities();
            if (currentUserId) loadMyCommunities();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Create Modal */}
      <CreateCommunityModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleCreated}
      />
    </div>
  );
}
