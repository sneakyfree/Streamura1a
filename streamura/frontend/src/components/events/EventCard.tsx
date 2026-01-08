import { Link } from 'react-router-dom';
import { MapPin, Users, Radio, Star, TrendingUp, Flame } from 'lucide-react';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
  showTrending?: boolean;
  variant?: 'default' | 'compact' | 'featured';
}

export function EventCard({ event, showTrending = false, variant = 'default' }: EventCardProps) {
  const isLive = event.status === 'active';
  const isTrending = event.ranking_score >= 0.5;
  const isHot = event.ranking_score >= 0.7;

  if (variant === 'compact') {
    return (
      <Link
        to={`/events/${event.id}`}
        className="group flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-primary-500/50 transition-all"
      >
        {/* Compact Thumbnail */}
        <div className="relative w-20 h-14 flex-shrink-0 rounded-md overflow-hidden bg-slate-700">
          {event.thumbnail_url ? (
            <img src={event.thumbnail_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Radio className="h-5 w-5 text-slate-600" />
            </div>
          )}
          {isLive && (
            <div className="absolute top-1 left-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>

        {/* Compact Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm line-clamp-1 group-hover:text-primary-400 transition-colors">
            {event.title}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.total_viewers.toLocaleString()}
            </span>
            <span>{event.total_streams} streams</span>
          </div>
        </div>

        {isTrending && showTrending && (
          <TrendingUp className="h-4 w-4 text-green-400 flex-shrink-0" />
        )}
      </Link>
    );
  }

  if (variant === 'featured') {
    return (
      <Link
        to={`/events/${event.id}`}
        className="group relative block rounded-2xl overflow-hidden border border-slate-700 hover:border-primary-500/50 transition-all hover:shadow-xl hover:shadow-primary-500/20"
      >
        {/* Large Featured Thumbnail */}
        <div className="relative aspect-[16/9] bg-slate-700">
          {event.thumbnail_url ? (
            <img src={event.thumbnail_url} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900/50 to-slate-900">
              <Radio className="h-16 w-16 text-primary-500/50" />
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {isLive && (
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
            )}
            {isHot && (
              <div className="flex items-center gap-1 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                <Flame className="h-3.5 w-3.5" />
                HOT
              </div>
            )}
          </div>

          <div className="absolute top-4 right-4">
            <div className="flex items-center gap-1 bg-accent-500 text-white px-3 py-1.5 rounded-full text-sm font-medium">
              <Star className="h-3.5 w-3.5" />
              Featured
            </div>
          </div>

          {/* Content Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary-400 transition-colors">
              {event.title}
            </h3>

            <div className="flex items-center gap-4 text-white/80">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{event.location_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>{event.total_viewers.toLocaleString()} watching</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Radio className="h-4 w-4" />
                <span>{event.total_streams} streams</span>
              </div>
            </div>

            {event.category && (
              <div className="mt-3">
                <span className="px-3 py-1 bg-white/20 text-white rounded-full text-sm">
                  {event.category}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Default variant
  return (
    <Link
      to={`/events/${event.id}`}
      className="group block bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-primary-500/50 transition-all hover:shadow-lg hover:shadow-primary-500/10"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-700">
        {event.thumbnail_url ? (
          <img
            src={event.thumbnail_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Radio className="h-12 w-12 text-slate-600" />
          </div>
        )}

        {/* Live Badge */}
        {isLive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-medium">
            <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        )}

        {/* Trending/Hot Badge */}
        {isHot && showTrending && (
          <div className="absolute top-3 left-3 ml-16 flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-md text-xs font-medium">
            <Flame className="h-3 w-3" />
            HOT
          </div>
        )}

        {/* Featured Badge */}
        {event.is_featured && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-accent-500 text-white px-2 py-1 rounded-md text-xs font-medium">
            <Star className="h-3 w-3" />
            Featured
          </div>
        )}

        {/* Viewer Count Overlay */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
          <Users className="h-3 w-3" />
          {event.total_viewers.toLocaleString()}
        </div>

        {/* Stream Count */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
          <Radio className="h-3 w-3" />
          {event.total_streams}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors line-clamp-1">
          {event.title}
        </h3>

        <div className="flex items-center gap-1 text-slate-400 text-sm mt-2">
          <MapPin className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{event.location_name}</span>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {event.category && (
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">
                {event.category}
              </span>
            )}
            {isTrending && showTrending && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                <TrendingUp className="h-3 w-3" />
                Trending
              </span>
            )}
          </div>
          <div className="text-slate-400 text-xs">
            {event.total_streams} streams
          </div>
        </div>
      </div>
    </Link>
  );
}
