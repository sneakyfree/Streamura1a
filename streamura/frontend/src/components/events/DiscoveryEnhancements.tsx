import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Radio, TrendingUp, MapPin, ChevronRight, Flame, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BreakingEvent {
    id: number;
    title: string;
    location_name: string;
    stream_count: number;
    category: string;
    severity: 'high' | 'medium' | 'low';
    detected_at: string;
}

interface BreakingNewsProps {
    className?: string;
    onEventClick?: (eventId: number) => void;
}

export function BreakingNews({ className, onEventClick }: BreakingNewsProps) {
    const { data: breakingEvents, isLoading } = useQuery({
        queryKey: ['discovery', 'breaking'],
        queryFn: async () => {
            try {
                const response = await api.get('/discovery/breaking-news');
                return response.data.events as BreakingEvent[];
            } catch {
                // Return demo data if API not ready
                return [
                    {
                        id: 1,
                        title: 'Major Protest Downtown',
                        location_name: 'City Center',
                        stream_count: 12,
                        category: 'News',
                        severity: 'high' as const,
                        detected_at: new Date().toISOString(),
                    },
                ];
            }
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    if (isLoading || !breakingEvents || breakingEvents.length === 0) {
        return null;
    }

    const topEvent = breakingEvents[0];
    const severityColors = {
        high: 'from-red-600 to-orange-600 border-red-500',
        medium: 'from-orange-500 to-yellow-500 border-orange-500',
        low: 'from-yellow-500 to-green-500 border-yellow-500',
    };

    return (
        <div className={cn('relative overflow-hidden', className)}>
            <div className={cn(
                'bg-gradient-to-r p-4 rounded-xl border',
                severityColors[topEvent.severity]
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                            <AlertTriangle className="h-4 w-4 text-white animate-pulse" />
                            <span className="text-white font-bold text-sm uppercase">Breaking</span>
                        </div>

                        <div className="flex-1">
                            <h3 className="text-white font-bold text-lg">{topEvent.title}</h3>
                            <div className="flex items-center gap-4 text-white/80 text-sm mt-1">
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {topEvent.location_name}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Radio className="h-3 w-3" />
                                    {topEvent.stream_count} streams covering this
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getTimeAgo(topEvent.detected_at)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Link
                        to={`/events/${topEvent.id}`}
                        onClick={() => onEventClick?.(topEvent.id)}
                        className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                    >
                        Watch Now
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                {breakingEvents.length > 1 && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                        <div className="flex items-center gap-4">
                            <span className="text-white/60 text-xs uppercase font-medium">Also Breaking:</span>
                            <div className="flex gap-3 overflow-x-auto">
                                {breakingEvents.slice(1, 4).map((event) => (
                                    <Link
                                        key={event.id}
                                        to={`/events/${event.id}`}
                                        className="text-white/80 hover:text-white text-sm whitespace-nowrap"
                                    >
                                        {event.title} ({event.stream_count} streams)
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return `${Math.floor(diffHours / 24)}d ago`;
}

// Trending Insights Component
interface TrendingInsight {
    type: 'surge' | 'new_cluster' | 'breaking';
    message: string;
    event_id?: number;
    stream_count: number;
}

export function TrendingInsights() {
    const { data: insights } = useQuery({
        queryKey: ['discovery', 'insights'],
        queryFn: async () => {
            try {
                const response = await api.get('/discovery/insights');
                return response.data.insights as TrendingInsight[];
            } catch {
                return [
                    { type: 'surge' as const, message: 'Sports viewership up 40% today', stream_count: 24 },
                    { type: 'new_cluster' as const, message: 'New event forming in Downtown area', stream_count: 5 },
                ];
            }
        },
        refetchInterval: 60000,
    });

    if (!insights || insights.length === 0) return null;

    return (
        <div className="flex items-center gap-4 overflow-x-auto py-3 px-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <TrendingUp className="h-5 w-5 text-primary-400 flex-shrink-0" />
            <div className="flex items-center gap-6">
                {insights.slice(0, 3).map((insight, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm whitespace-nowrap">
                        {insight.type === 'surge' && <Flame className="h-4 w-4 text-orange-400" />}
                        {insight.type === 'new_cluster' && <MapPin className="h-4 w-4 text-primary-400" />}
                        {insight.type === 'breaking' && <AlertTriangle className="h-4 w-4 text-red-400" />}
                        <span className="text-slate-300">{insight.message}</span>
                        <span className="text-slate-500">({insight.stream_count} streams)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Event Cluster Panel
interface EventCluster {
    cluster_id: string;
    name: string;
    description: string;
    event_count: number;
    total_viewers: number;
    top_event_id: number;
    category: string;
    growth_rate: number; // percentage
}

export function EventClusterPanel() {
    const { data: clusters, isLoading } = useQuery({
        queryKey: ['discovery', 'clusters'],
        queryFn: async () => {
            try {
                const response = await api.get('/discovery/clusters');
                return response.data.clusters as EventCluster[];
            } catch {
                // Demo data
                return [
                    {
                        cluster_id: 'protest-la',
                        name: 'LA Climate March',
                        description: 'Multiple angles of downtown climate protest',
                        event_count: 8,
                        total_viewers: 15420,
                        top_event_id: 1,
                        category: 'News',
                        growth_rate: 25,
                    },
                    {
                        cluster_id: 'concert-nyc',
                        name: 'Central Park Concert',
                        description: 'Summer concert series coverage',
                        event_count: 5,
                        total_viewers: 8200,
                        top_event_id: 2,
                        category: 'Music',
                        growth_rate: 10,
                    },
                ];
            }
        },
        refetchInterval: 60000,
    });

    if (isLoading || !clusters || clusters.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Radio className="h-5 w-5 text-primary-400" />
                    AI-Detected Event Clusters
                </h3>
                <span className="text-xs text-slate-500">Powered by Discovery Agent</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clusters.map((cluster) => (
                    <Link
                        key={cluster.cluster_id}
                        to={`/events/${cluster.top_event_id}`}
                        className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 hover:border-primary-500/50 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <h4 className="font-medium text-white group-hover:text-primary-400 transition-colors">
                                {cluster.name}
                            </h4>
                            {cluster.growth_rate > 0 && (
                                <span className="flex items-center gap-1 text-green-400 text-xs bg-green-500/10 px-2 py-0.5 rounded-full">
                                    <TrendingUp className="h-3 w-3" />
                                    +{cluster.growth_rate}%
                                </span>
                            )}
                        </div>

                        <p className="text-sm text-slate-400 mb-3 line-clamp-2">{cluster.description}</p>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{cluster.event_count} events</span>
                            <span>{cluster.total_viewers.toLocaleString()} viewers</span>
                            <span className="text-primary-400">{cluster.category}</span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
