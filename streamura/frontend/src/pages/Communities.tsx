import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Users, TrendingUp, Globe, Lock, Loader2 } from 'lucide-react';
import { communityApi, type Community } from '@/lib/api';
import { CommunityCard } from '@/components/community/CommunityCard';
import { CreateCommunityModal } from '@/components/community/CreateCommunityModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';

type ViewMode = 'discover' | 'my-communities';

export function CommunitiesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [viewMode, setViewMode] = useState<ViewMode>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all communities (public)
  const { data: allCommunities, isLoading: loadingAll } = useQuery({
    queryKey: ['communities', 'all', searchQuery],
    queryFn: () => communityApi.getAll({
      search: searchQuery || undefined,
      is_public: true,
      limit: 50,
    }),
  });

  // Fetch user's communities
  const { data: myCommunities, isLoading: loadingMine, refetch: refetchMine } = useQuery({
    queryKey: ['communities', 'mine'],
    queryFn: () => communityApi.getMyCommunities(),
    enabled: isAuthenticated,
  });

  // Extract communities from response
  const allCommunitiesList = allCommunities?.communities ?? [];

  const displayedCommunities: Community[] = viewMode === 'discover'
    ? allCommunitiesList
    : (myCommunities ?? []);

  const isLoading = viewMode === 'discover' ? loadingAll : loadingMine;

  const handleCommunityClick = (community: Community) => {
    navigate(`/communities/${community.id}`);
  };

  const handleJoinChange = (_communityId: number, isMember: boolean) => {
    // Refetch my communities when membership changes
    if (isMember || viewMode === 'my-communities') {
      refetchMine();
    }
  };

  const handleCommunityCreated = () => {
    refetchMine();
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Communities</h1>
            <p className="text-slate-400">
              Join communities to connect with like-minded people
            </p>
          </div>
          {isAuthenticated && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Community
            </Button>
          )}
        </div>

        {/* Search Bar */}
        {viewMode === 'discover' && (
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-slate-800 border-slate-700"
            />
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={viewMode === 'discover' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('discover')}
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            Discover
          </Button>
          {isAuthenticated && (
            <Button
              variant={viewMode === 'my-communities' ? 'secondary' : 'ghost'}
              onClick={() => setViewMode('my-communities')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              My Communities
              {myCommunities && myCommunities.length > 0 && (
                <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">
                  {myCommunities.length}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Communities Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : displayedCommunities && displayedCommunities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayedCommunities.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                currentUserId={user?.id}
                onJoinChange={handleJoinChange}
                onClick={() => handleCommunityClick(community)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
              <Users className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {viewMode === 'my-communities'
                ? "You haven't joined any communities yet"
                : searchQuery
                  ? `No communities found for "${searchQuery}"`
                  : 'No communities available'}
            </h3>
            <p className="text-slate-400 mb-6">
              {viewMode === 'my-communities'
                ? 'Discover communities and join ones that interest you'
                : 'Be the first to create a community'}
            </p>
            {viewMode === 'my-communities' ? (
              <Button onClick={() => setViewMode('discover')}>
                Discover Communities
              </Button>
            ) : isAuthenticated ? (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Community
              </Button>
            ) : (
              <Button onClick={() => navigate('/login')}>
                Sign in to Create
              </Button>
            )}
          </div>
        )}

        {/* Stats Section */}
        {allCommunitiesList.length > 0 && viewMode === 'discover' && !searchQuery && (
          <section className="mt-16 pt-8 border-t border-slate-800">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-400" />
              Community Stats
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-white mb-1">
                  {allCommunitiesList.length}
                </div>
                <div className="text-sm text-slate-400">Total Communities</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-white mb-1">
                  {allCommunitiesList.reduce((acc, c) => acc + c.member_count, 0).toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">Total Members</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-white mb-1 flex items-center justify-center gap-1">
                  <Globe className="h-5 w-5" />
                  {allCommunitiesList.filter(c => c.is_public).length}
                </div>
                <div className="text-sm text-slate-400">Public</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
                <div className="text-3xl font-bold text-white mb-1 flex items-center justify-center gap-1">
                  <Lock className="h-5 w-5" />
                  {allCommunitiesList.filter(c => !c.is_public).length}
                </div>
                <div className="text-sm text-slate-400">Private</div>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Create Community Modal */}
      <CreateCommunityModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={handleCommunityCreated}
      />
    </div>
  );
}
