import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    MapPin,
    Users,
    TrendingUp,
    Radio,
    Maximize2,
    Minimize2,
    Layers,
    ZoomIn,
    ZoomOut,
    Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Types for cluster data
interface StreamInCluster {
    stream_id: number;
    title: string;
    streamer_name: string;
    viewer_count: number;
    thumbnail_url?: string;
    latitude: number;
    longitude: number;
    is_live: boolean;
}

interface EventCluster {
    event_id: number;
    title: string;
    centroid: [number, number]; // [lat, lng]
    radius_meters: number;
    confidence: number;
    stream_count: number;
    total_viewers: number;
    velocity: number; // viewers per minute
    velocity_trend: 'rising' | 'stable' | 'falling';
    is_trending: boolean;
    is_featured: boolean;
    streams: StreamInCluster[];
    category?: string;
    started_at: string;
}

interface ClusterMapProps {
    initialCenter?: [number, number];
    initialZoom?: number;
    onClusterSelect?: (cluster: EventCluster) => void;
    onStreamSelect?: (stream: StreamInCluster) => void;
    showHeatmap?: boolean;
    maxClusters?: number;
}

// Fetch clusters API
const fetchClusters = async (bounds?: { north: number; south: number; east: number; west: number }) => {
    const params = new URLSearchParams();
    if (bounds) {
        params.set('north', bounds.north.toString());
        params.set('south', bounds.south.toString());
        params.set('east', bounds.east.toString());
        params.set('west', bounds.west.toString());
    }

    const res = await fetch(`/api/v1/events/clusters?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch clusters');
    return res.json();
};

// Velocity badge colors
const getVelocityColor = (velocity: number, trend: string) => {
    if (velocity > 50) return 'bg-red-500';
    if (velocity > 20) return 'bg-orange-500';
    if (velocity > 10) return 'bg-yellow-500';
    if (trend === 'rising') return 'bg-green-500';
    return 'bg-slate-500';
};

// Cluster marker sizing based on viewer count
const getClusterSize = (viewers: number): number => {
    if (viewers > 10000) return 80;
    if (viewers > 5000) return 70;
    if (viewers > 1000) return 60;
    if (viewers > 500) return 50;
    if (viewers > 100) return 40;
    return 32;
};

export function ClusterMap({
    initialCenter = [40.7128, -74.0060], // NYC default
    initialZoom = 12,
    onClusterSelect,
    onStreamSelect,
    showHeatmap = true,
    maxClusters = 100
}: ClusterMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const [_center, setCenter] = useState(initialCenter);
    const [_zoom, setZoom] = useState(initialZoom);
    const [selectedCluster, setSelectedCluster] = useState<EventCluster | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mapBounds] = useState<{ north: number; south: number; east: number; west: number } | undefined>();
    const [showStreamList, setShowStreamList] = useState(false);

    // Fetch clusters based on current map bounds
    const { data: clustersData, isLoading } = useQuery({
        queryKey: ['eventClusters', mapBounds],
        queryFn: () => fetchClusters(mapBounds),
        refetchInterval: 10000, // Refresh every 10s for real-time updates
    });

    const clusters: EventCluster[] = clustersData?.clusters || [];

    // Handle cluster click
    const handleClusterClick = useCallback((cluster: EventCluster) => {
        setSelectedCluster(cluster);
        onClusterSelect?.(cluster);
    }, [onClusterSelect]);

    // Handle stream click within cluster
    const handleStreamClick = useCallback((stream: StreamInCluster) => {
        onStreamSelect?.(stream);
    }, [onStreamSelect]);

    // Zoom controls
    const handleZoomIn = () => setZoom(z => Math.min(z + 1, 20));
    const handleZoomOut = () => setZoom(z => Math.max(z - 1, 1));

    // Center on user location
    const handleCenterOnUser = () => {
        navigator.geolocation?.getCurrentPosition(
            (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
            () => { } // Silent fail
        );
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!isFullscreen && mapContainerRef.current) {
            mapContainerRef.current.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
        setIsFullscreen(!isFullscreen);
    };

    // Calculate mock positions for demo (in production, use actual Mapbox/Leaflet)
    const getClusterPosition = (cluster: EventCluster, index: number) => {
        // Distribute clusters in a grid pattern for demo
        const cols = 4;
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
            left: `${10 + col * 22}%`,
            top: `${15 + row * 25}%`
        };
    };

    return (
        <div
            ref={mapContainerRef}
            className={`relative bg-slate-900 rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[600px]'}`}
        >
            {/* Map Background (placeholder for Mapbox/Leaflet) */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
                {/* Grid overlay for visual effect */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: 'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)',
                        backgroundSize: '40px 40px'
                    }}
                />

                {/* Heatmap layer (simplified) */}
                {showHeatmap && clusters.length > 0 && (
                    <div className="absolute inset-0">
                        {clusters.slice(0, 5).map((cluster, i) => (
                            <div
                                key={`heat-${cluster.event_id}`}
                                className="absolute rounded-full blur-3xl opacity-20"
                                style={{
                                    ...getClusterPosition(cluster, i),
                                    width: `${getClusterSize(cluster.total_viewers) * 3}px`,
                                    height: `${getClusterSize(cluster.total_viewers) * 3}px`,
                                    background: cluster.is_trending
                                        ? 'radial-gradient(circle, #ef4444, transparent)'
                                        : 'radial-gradient(circle, #8b5cf6, transparent)',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Cluster Markers */}
            <div className="absolute inset-0">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <Radio className="w-6 h-6 animate-spin mr-2" />
                        Loading clusters...
                    </div>
                ) : clusters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <MapPin className="w-12 h-12 mb-4 opacity-50" />
                        <p>No live events in this area</p>
                        <p className="text-sm text-slate-500 mt-1">Try zooming out or panning to a different location</p>
                    </div>
                ) : (
                    clusters.slice(0, maxClusters).map((cluster, index) => {
                        const size = getClusterSize(cluster.total_viewers);
                        const position = getClusterPosition(cluster, index);

                        return (
                            <div
                                key={cluster.event_id}
                                className="absolute cursor-pointer transition-transform hover:scale-110 z-10"
                                style={{
                                    left: position.left,
                                    top: position.top,
                                    transform: 'translate(-50%, -50%)'
                                }}
                                onClick={() => handleClusterClick(cluster)}
                            >
                                {/* Cluster marker */}
                                <div
                                    className={`relative flex items-center justify-center rounded-full border-2 ${selectedCluster?.event_id === cluster.event_id
                                        ? 'border-white ring-4 ring-purple-500/50'
                                        : 'border-white/50'
                                        } ${cluster.is_featured ? 'bg-gradient-to-br from-purple-600 to-pink-600' : 'bg-slate-700'}`}
                                    style={{ width: size, height: size }}
                                >
                                    {/* Pulsing ring for trending */}
                                    {cluster.is_trending && (
                                        <div className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
                                    )}

                                    {/* Viewer count */}
                                    <div className="text-center">
                                        <div className="text-white font-bold text-sm">
                                            {cluster.total_viewers >= 1000
                                                ? `${(cluster.total_viewers / 1000).toFixed(1)}K`
                                                : cluster.total_viewers}
                                        </div>
                                        <div className="text-white/70 text-xs flex items-center justify-center">
                                            <Radio className="w-2 h-2 mr-0.5" />
                                            {cluster.stream_count}
                                        </div>
                                    </div>

                                    {/* Velocity badge */}
                                    {cluster.velocity > 5 && (
                                        <div
                                            className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-xs font-bold text-white flex items-center ${getVelocityColor(cluster.velocity, cluster.velocity_trend)}`}
                                        >
                                            <TrendingUp className="w-3 h-3 mr-0.5" />
                                            +{Math.round(cluster.velocity)}
                                        </div>
                                    )}
                                </div>

                                {/* Cluster label */}
                                <div className="text-center mt-1 max-w-[100px]">
                                    <p className="text-white text-xs font-medium truncate">
                                        {cluster.title || 'Event'}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800/80 backdrop-blur-sm"
                    onClick={handleZoomIn}
                >
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800/80 backdrop-blur-sm"
                    onClick={handleZoomOut}
                >
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800/80 backdrop-blur-sm"
                    onClick={handleCenterOnUser}
                >
                    <Navigation className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    className="bg-slate-800/80 backdrop-blur-sm"
                    onClick={toggleFullscreen}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                    size="sm"
                    variant={showStreamList ? 'primary' : 'secondary'}
                    className="bg-slate-800/80 backdrop-blur-sm"
                    onClick={() => setShowStreamList(!showStreamList)}
                >
                    <Layers className="w-4 h-4" />
                </Button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 text-xs">
                <div className="flex items-center gap-3 text-slate-300">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-br from-purple-600 to-pink-600" />
                        <span>Featured</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span>Trending</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span>Rising</span>
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2">
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-purple-400">
                        <MapPin className="w-4 h-4" />
                        <span className="font-bold">{clusters.length}</span>
                        <span className="text-slate-400">events</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400">
                        <Users className="w-4 h-4" />
                        <span className="font-bold">
                            {clusters.reduce((sum, c) => sum + c.total_viewers, 0).toLocaleString()}
                        </span>
                        <span className="text-slate-400">viewers</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-400">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-bold">{clusters.filter(c => c.is_trending).length}</span>
                        <span className="text-slate-400">trending</span>
                    </div>
                </div>
            </div>

            {/* Selected Cluster Detail Panel */}
            {selectedCluster && (
                <Card className="absolute bottom-4 right-4 w-80 bg-slate-800/95 backdrop-blur-sm border-slate-700">
                    <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="font-bold text-white text-lg">{selectedCluster.title || 'Live Event'}</h3>
                                <p className="text-sm text-slate-400">{selectedCluster.category || 'General'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedCluster(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                                <div className="text-xl font-bold text-white">{selectedCluster.stream_count}</div>
                                <div className="text-xs text-slate-400">Streams</div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                                <div className="text-xl font-bold text-white">
                                    {selectedCluster.total_viewers >= 1000
                                        ? `${(selectedCluster.total_viewers / 1000).toFixed(1)}K`
                                        : selectedCluster.total_viewers}
                                </div>
                                <div className="text-xs text-slate-400">Viewers</div>
                            </div>
                            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                                <div className={`text-xl font-bold ${selectedCluster.velocity > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {selectedCluster.velocity > 0 ? '+' : ''}{Math.round(selectedCluster.velocity)}
                                </div>
                                <div className="text-xs text-slate-400">/min</div>
                            </div>
                        </div>

                        {/* Stream list */}
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {selectedCluster.streams.slice(0, 5).map((stream) => (
                                <div
                                    key={stream.stream_id}
                                    className="flex items-center gap-2 p-2 bg-slate-700/30 rounded-lg cursor-pointer hover:bg-slate-700/50"
                                    onClick={() => handleStreamClick(stream)}
                                >
                                    <div className="w-12 h-8 bg-slate-600 rounded flex items-center justify-center">
                                        <Radio className="w-4 h-4 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">{stream.title}</p>
                                        <p className="text-xs text-slate-400">{stream.streamer_name}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <Users className="w-3 h-3" />
                                        {stream.viewer_count}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full mt-3 bg-gradient-to-r from-purple-600 to-pink-600"
                            onClick={() => window.location.href = `/events/${selectedCluster.event_id}`}
                        >
                            View All Streams
                        </Button>
                    </div>
                </Card>
            )}

            {/* Stream List Panel (toggleable) */}
            {showStreamList && (
                <div className="absolute left-4 top-16 bottom-16 w-64 bg-slate-800/95 backdrop-blur-sm rounded-lg overflow-hidden">
                    <div className="p-3 border-b border-slate-700">
                        <h3 className="font-semibold text-white">All Events</h3>
                    </div>
                    <div className="overflow-y-auto h-full pb-12">
                        {clusters.map((cluster) => (
                            <div
                                key={cluster.event_id}
                                className={`p-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 ${selectedCluster?.event_id === cluster.event_id ? 'bg-purple-500/20' : ''
                                    }`}
                                onClick={() => handleClusterClick(cluster)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-white truncate">{cluster.title || 'Event'}</span>
                                    {cluster.is_trending && (
                                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">🔥</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Radio className="w-3 h-3" />{cluster.stream_count}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />{cluster.total_viewers}
                                    </span>
                                    {cluster.velocity > 0 && (
                                        <span className="flex items-center gap-0.5 text-green-400">
                                            <TrendingUp className="w-3 h-3" />+{Math.round(cluster.velocity)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClusterMap;
