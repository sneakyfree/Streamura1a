import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  MapPin,
  Filter,
  Search,
  Globe,
  Star,
  Radio,
  ChevronRight
} from 'lucide-react';
import { discoveryApi, eventApi } from '@/lib/api';
import { EventCard } from '@/components/events/EventCard';
import { EventGrid } from '@/components/events/EventGrid';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Event } from '@/types';

const CATEGORIES = ['All', 'Music', 'Sports', 'News', 'Festival', 'Conference', 'Other'];

export function DiscoverPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'trending' | 'nearby' | 'all'>('trending');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Location denied or unavailable
        }
      );
    }
  }, []);

  // Fetch discovery feed
  const { data: discoveryFeed, isLoading: feedLoading } = useQuery({
    queryKey: ['discovery', 'feed', userLocation?.lat, userLocation?.lng],
    queryFn: () => discoveryApi.getFeed({
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
    }),
  });

  // Fetch trending events
  const { data: trendingEvents, isLoading: trendingLoading } = useQuery({
    queryKey: ['events', 'trending', selectedCategory],
    queryFn: () => eventApi.getTrending({
      limit: 20,
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
    }),
  });

  // Fetch nearby events (only if we have location)
  const { data: nearbyEvents, isLoading: nearbyLoading } = useQuery({
    queryKey: ['events', 'nearby', userLocation?.lat, userLocation?.lng],
    queryFn: () => eventApi.getNearby({
      latitude: userLocation!.lat,
      longitude: userLocation!.lng,
      radius_km: 50,
      limit: 20,
    }),
    enabled: !!userLocation,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => discoveryApi.getCategories(),
  });

  // Search
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => discoveryApi.search({ q: searchQuery, type: 'events', limit: 20 }),
    enabled: searchQuery.length > 2,
  });

  // Get events based on view mode
  const getDisplayEvents = (): Event[] => {
    if (searchQuery.length > 2 && searchResults) {
      return searchResults.events;
    }

    switch (viewMode) {
      case 'nearby':
        return nearbyEvents || [];
      case 'all':
        return discoveryFeed?.trending_events || [];
      case 'trending':
      default:
        return trendingEvents || [];
    }
  };

  const displayEvents = getDisplayEvents();
  const isLoading = feedLoading || trendingLoading || searchLoading || (viewMode === 'nearby' && nearbyLoading);

  // Filter by category
  const filteredEvents = selectedCategory === 'All'
    ? displayEvents
    : displayEvents.filter(e => e.category?.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Discover Events</h1>
          <p className="text-slate-400">
            Explore live events happening around the world right now
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Search events, locations, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 bg-slate-800 border-slate-700"
          />
        </div>

        {/* Featured Events Section */}
        {discoveryFeed?.featured_events && discoveryFeed.featured_events.length > 0 && !searchQuery && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-accent-500" />
                <h2 className="text-xl font-bold text-white">Featured Events</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {discoveryFeed.featured_events.slice(0, 2).map((event) => (
                <EventCard key={event.id} event={event} variant="featured" showTrending />
              ))}
            </div>
          </section>
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={viewMode === 'trending' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('trending')}
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </Button>
          <Button
            variant={viewMode === 'nearby' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('nearby')}
            className="flex items-center gap-2"
            disabled={!userLocation}
          >
            <MapPin className="h-4 w-4" />
            Near Me
            {!userLocation && (
              <span className="text-xs text-slate-500 ml-1">(enable location)</span>
            )}
          </Button>
          <Button
            variant={viewMode === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setViewMode('all')}
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            All Events
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {category}
              {category !== 'All' && categories && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({categories.find(c => c.name.toLowerCase() === category.toLowerCase())?.event_count || 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Results Label */}
        {searchQuery.length > 2 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">
              Search results for "{searchQuery}"
            </h2>
            <p className="text-slate-400 text-sm">
              {filteredEvents.length} events found
            </p>
          </div>
        )}

        {/* Events Grid */}
        <EventGrid
          events={filteredEvents}
          isLoading={isLoading}
          showTrending={viewMode === 'trending'}
          columns={4}
          emptyMessage={
            searchQuery.length > 2
              ? `No events found for "${searchQuery}"`
              : selectedCategory !== 'All'
                ? `No ${selectedCategory.toLowerCase()} events are currently live.`
                : viewMode === 'nearby'
                  ? 'No events near your location. Try expanding your search.'
                  : 'No live events right now. Check back later!'
          }
        />

        {/* Nearby Events Section (when not in nearby mode) */}
        {viewMode !== 'nearby' && nearbyEvents && nearbyEvents.length > 0 && !searchQuery && (
          <section className="mt-16 pt-8 border-t border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary-400" />
                <h2 className="text-xl font-bold text-white">Events Near You</h2>
              </div>
              <Button
                variant="ghost"
                onClick={() => setViewMode('nearby')}
                className="flex items-center gap-1 text-sm"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <EventGrid
              events={nearbyEvents.slice(0, 4)}
              showTrending
              columns={4}
            />
          </section>
        )}

        {/* Categories Section */}
        {categories && categories.length > 0 && !searchQuery && (
          <section className="mt-16 pt-8 border-t border-slate-800">
            <h2 className="text-xl font-bold text-white mb-6">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.slice(0, 6).map((category) => (
                <Link
                  key={category.name}
                  to={`/discover?category=${category.name}`}
                  onClick={() => setSelectedCategory(category.name)}
                  className="bg-slate-800 rounded-xl p-4 text-center hover:bg-slate-700 transition-colors border border-slate-700 hover:border-primary-500/50"
                >
                  <div className="h-12 w-12 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Radio className="h-6 w-6 text-primary-400" />
                  </div>
                  <h3 className="font-medium text-white mb-1">{category.name}</h3>
                  <p className="text-xs text-slate-400">
                    {category.event_count} events
                  </p>
                  <p className="text-xs text-primary-400 mt-1">
                    {category.total_viewers.toLocaleString()} watching
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Live Streams Section (streams not part of events) */}
        {discoveryFeed?.live_streams && discoveryFeed.live_streams.length > 0 && !searchQuery && (
          <section className="mt-16 pt-8 border-t border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-500" />
                <h2 className="text-xl font-bold text-white">Live Streams</h2>
                <span className="text-sm text-slate-400">(Individual)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {discoveryFeed.live_streams.slice(0, 8).map((stream) => (
                <Link
                  key={stream.id}
                  to={`/streams/${stream.id}`}
                  className="group bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-primary-500/50 transition-all"
                >
                  <div className="relative aspect-video bg-slate-700">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        alt={stream.title || 'Stream'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Radio className="h-8 w-8 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                      <span className="h-1.5 w-1.5 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
                      {stream.viewer_count.toLocaleString()} viewers
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium text-white text-sm line-clamp-1 group-hover:text-primary-400 transition-colors">
                      {stream.title || 'Untitled Stream'}
                    </h4>
                    {stream.location_name && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {stream.location_name}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
