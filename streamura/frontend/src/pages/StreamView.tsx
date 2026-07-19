import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Clock, Share2, Loader2 } from 'lucide-react';
import { streamApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { StreamPlayer } from '@/components/stream/StreamPlayer';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { TipButton } from '@/components/payments';
import { ChatBox } from '@/components/chat';
import { LikeButton, FollowButton } from '@/components/social';
import { SubscribeButton } from '@/components/subscriptions';

export function StreamViewPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const { user } = useAuthStore();

  const { data: stream, isLoading, error } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: () => streamApi.get(Number(streamId)),
    enabled: !!streamId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <h1 className="sr-only">Loading stream</h1>
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Stream not found</h1>
          <p className="text-slate-400 mb-4">This stream may have ended or doesn't exist.</p>
          <Link to="/discover">
            <Button>Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isLive = stream.status === 'live';

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            <StreamPlayer stream={stream} />

            {/* Stream Info */}
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {stream.title || 'Untitled Stream'}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-slate-400 text-sm mb-4">
                {stream.location_name && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {stream.location_name}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {stream.viewer_count.toLocaleString()} viewers
                </div>
                {stream.starts_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {isLive ? 'Started ' : 'Streamed '}
                    {new Date(stream.starts_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <LikeButton
                  streamId={stream.id}
                  likeCount={stream.like_count || 0}
                  showCount={true}
                  variant="outline"
                  size="sm"
                />
                <Button variant="secondary" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                {stream.is_monetized && (
                  <TipButton
                    streamId={stream.id}
                    creatorName={stream.title || 'this streamer'}
                  />
                )}
                {/* Follow / subscribe to the streamer (if not own stream) */}
                {user && stream.user_id && user.id !== stream.user_id && (
                  <>
                    <FollowButton
                      userId={stream.user_id}
                      size="sm"
                      variant="outline"
                    />
                    <SubscribeButton
                      creatorId={stream.user_id}
                      creatorName={stream.title || 'this streamer'}
                      size="sm"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            {stream.description && (
              <Card>
                <CardContent className="py-4">
                  <h3 className="font-semibold text-white mb-2">About this stream</h3>
                  <p className="text-slate-400">{stream.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {stream.tags && stream.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stream.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-sm"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Chat Card */}
            <Card className="h-96">
              <ChatBox
                streamId={stream.id}
                roomName={stream.livekit_room_name ?? undefined}
                isLive={isLive}
                isOwner={user?.id === stream.user_id}
                viewerCount={stream.viewer_count}
              />
            </Card>

            {/* Stream Stats */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-white mb-4">Stream Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Peak Viewers</span>
                    <span className="text-white font-medium">
                      {stream.peak_viewers.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watch Time</span>
                    <span className="text-white font-medium">
                      {Math.round(stream.total_watch_time / 60)} min
                    </span>
                  </div>
                  {stream.is_monetized && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Earnings</span>
                      <span className="text-green-400 font-medium">
                        ${stream.earnings.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Related Streams */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-white mb-4">Related Streams</h3>
                <div className="text-center text-slate-500 text-sm py-4">
                  No related streams available
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
