import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, TrendingUp, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { StreamCard } from '@/components/stream/StreamCard';
import { feedApi, discoveryApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { Stream } from '@/types';

type TabType = 'following' | 'foryou';

export function FeedPage() {
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('following');
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = async () => {
    // Don't hit the auth-gated endpoint when the user isn't logged in.
    if (activeTab === 'following' && !isAuthenticated) {
      setIsLoading(false);
      setStreams([]);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'following') {
        const data = await feedApi.getFollowingFeed();
        setStreams(data);
      } else {
        const data = await discoveryApi.getFeed();
        setStreams(data.live_streams || []);
      }
    } catch (err) {
      console.error('Failed to fetch streams:', err);
      setError('Failed to load streams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, [activeTab, isAuthenticated]);

  // Redirect to discover if not authenticated
  if (!isAuthenticated && activeTab === 'following') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center py-16">
            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Sign in to see your feed</h1>
            <p className="text-slate-400 mb-6">
              Follow your favorite creators to see their streams here.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/login">
                <Button>Sign In</Button>
              </Link>
              <Link to="/discover">
                <Button variant="outline">Explore Streams</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Your Feed</h1>
          <Button variant="ghost" size="sm" onClick={fetchStreams} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-700 pb-4">
          <button
            onClick={() => setActiveTab('following')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeTab === 'following'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }
            `}
          >
            <Users className="h-4 w-4" />
            Following
          </button>
          <button
            onClick={() => setActiveTab('foryou')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${activeTab === 'foryou'
                ? 'bg-primary-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }
            `}
          >
            <Compass className="h-4 w-4" />
            For You
          </button>
        </div>

        {/* Content */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700 overflow-hidden">
                <div className="aspect-video bg-slate-700 animate-pulse" />
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-700 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-700 rounded animate-pulse" />
                      <div className="h-3 bg-slate-700 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-16">
            {activeTab === 'following' ? (
              <>
                <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">No streams from people you follow</h2>
                <p className="text-slate-400 mb-6">
                  When creators you follow go live, their streams will appear here.
                </p>
                <Link to="/discover">
                  <Button>
                    <Compass className="h-4 w-4 mr-2" />
                    Find Creators to Follow
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">No streams available</h2>
                <p className="text-slate-400 mb-6">
                  Check back later for new content!
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                isFollowing={activeTab === 'following'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
