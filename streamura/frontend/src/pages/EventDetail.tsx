import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Users,
  Radio,
  Star,
  TrendingUp,
  Share2,
  Clock,
  DollarSign,
  ArrowLeft,
  Loader2,
  MessageCircle,
  Bell,
  Video,
} from 'lucide-react';
import { eventApi } from '@/lib/api';
import { EventStreamSwitcher } from '@/components/events/EventStreamSwitcher';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventApi.get(Number(eventId)),
    enabled: !!eventId,
  });

  // Fetch related/nearby events
  const { data: relatedEvents } = useQuery({
    queryKey: ['events', 'trending', event?.category],
    queryFn: () => eventApi.getTrending({
      limit: 4,
      category: event?.category || undefined,
    }),
    enabled: !!event,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Event Not Found</h1>
          <p className="text-slate-400 mb-4">The event you're looking for doesn't exist or has ended.</p>
          <Link to="/discover">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Discover
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isLive = event.status === 'active';
  const liveStreams = event.streams?.filter(s => s.status === 'live') || [];
  const isTrending = event.ranking_score >= 0.5;

  // Format duration
  const getEventDuration = () => {
    if (!event.starts_at) return 'Unknown';
    const start = new Date(event.starts_at);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);

    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    return `${Math.floor(diff / 1440)}d`;
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: event.title,
        text: `Watch ${event.title} live on Streamura`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Discover
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Stream Viewer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Multi-Stream Viewer */}
            <EventStreamSwitcher
              streams={event.streams || []}
              primaryStream={event.primary_stream}
              eventTitle={event.title}
            />

            {/* Event Info */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isLive && (
                      <span className="inline-flex items-center gap-1.5 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                        <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {event.is_featured && (
                      <span className="inline-flex items-center gap-1 bg-accent-500 text-white px-2 py-1 rounded text-xs font-medium">
                        <Star className="h-3 w-3" />
                        Featured
                      </span>
                    )}
                    {isTrending && (
                      <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">
                        <TrendingUp className="h-3 w-3" />
                        Trending
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold text-white">{event.title}</h1>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Bell className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {event.description && (
                <p className="text-slate-300 mb-4">{event.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{event.location_name}</span>
                </div>
                {event.category && (
                  <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">
                    {event.category}
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>Live for {getEventDuration()}</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <Users className="h-4 w-4" />
                  Viewers
                </div>
                <div className="text-2xl font-bold text-white">
                  {event.total_viewers.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <Radio className="h-4 w-4" />
                  Streams
                </div>
                <div className="text-2xl font-bold text-white">
                  {event.total_streams}
                </div>
                <div className="text-xs text-green-400">
                  {liveStreams.length} live
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Ranking
                </div>
                <div className="text-2xl font-bold text-white">
                  #{Math.max(1, Math.floor((1 - event.ranking_score) * 100))}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                  <DollarSign className="h-4 w-4" />
                  Earned
                </div>
                <div className="text-2xl font-bold text-accent-400">
                  ${event.total_earnings.toLocaleString()}
                </div>
              </div>
            </div>

            {/* All Streams List */}
            {event.streams && event.streams.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">
                  All Streams ({event.streams.length})
                </h2>
                <div className="space-y-3">
                  {event.streams.map((stream) => (
                    <Link
                      key={stream.id}
                      to={`/streams/${stream.id}`}
                      className="flex items-center gap-4 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden bg-slate-600">
                        {stream.thumbnail_url ? (
                          <img
                            src={stream.thumbnail_url}
                            alt={stream.title || 'Stream'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Radio className="h-5 w-5 text-slate-500" />
                          </div>
                        )}
                        {stream.status === 'live' && (
                          <div className="absolute top-1 left-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm line-clamp-1">
                          {stream.title || 'Untitled Stream'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {stream.location_name || 'Unknown location'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Users className="h-4 w-4" />
                          {stream.viewer_count.toLocaleString()}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          stream.status === 'live'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-slate-600 text-slate-400'
                        }`}>
                          {stream.status === 'live' ? 'LIVE' : 'Ended'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Chat Section (Placeholder) */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary-400" />
                <h2 className="font-semibold text-white">Event Chat</h2>
                <span className="text-xs text-slate-500 ml-auto">
                  {event.total_viewers} watching
                </span>
              </div>
              <div className="h-[400px] flex items-center justify-center text-slate-500">
                <div className="text-center p-4">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Chat coming soon</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Join the conversation with other viewers
                  </p>
                </div>
              </div>
            </div>

            {/* Join Event CTA */}
            <Card className="border-primary-500/30 bg-primary-500/5">
              <CardContent className="py-4 text-center">
                <Video className="h-10 w-10 text-primary-400 mx-auto mb-3" />
                <h3 className="font-semibold text-white mb-2">
                  Stream This Event
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  Are you at this event? Start streaming and join the coverage.
                </p>
                <Link to="/stream/new">
                  <Button className="w-full bg-accent-500 hover:bg-accent-600">
                    Go Live
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Related Events */}
            {relatedEvents && relatedEvents.length > 0 && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="font-semibold text-white mb-4">
                  Related {event.category || 'Events'}
                </h2>
                <div className="space-y-3">
                  {relatedEvents
                    .filter(e => e.id !== event.id)
                    .slice(0, 3)
                    .map((relatedEvent) => (
                      <EventCard
                        key={relatedEvent.id}
                        event={relatedEvent}
                        variant="compact"
                        showTrending
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Event Location Map (Placeholder) */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary-400" />
                  Event Location
                </h2>
              </div>
              <div className="aspect-video bg-slate-700 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{event.location_name}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Coverage radius: {event.radius}m
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
