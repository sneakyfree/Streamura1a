import { useState, useRef } from 'react';
import {
    MapPin,
    Users,
    Clock,
    ZoomIn,
    ZoomOut,
    Layers,
    Radio,
    Play
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface StreamPoint {
    id: string;
    lat: number;
    lng: number;
    title: string;
    streamer: string;
    viewers: number;
    isLive: boolean;
    thumbnail?: string;
}

interface EventCluster {
    id: string;
    name: string;
    center: { lat: number; lng: number };
    radius: number; // km
    streams: StreamPoint[];
    totalViewers: number;
    startTime: string;
    status: 'emerging' | 'active' | 'declining';
}

interface EventClusterMapProps {
    clusters?: EventCluster[];
    onClusterSelect?: (cluster: EventCluster) => void;
    onStreamSelect?: (stream: StreamPoint) => void;
}

// Mock data
const mockClusters: EventCluster[] = [
    {
        id: 'cluster-1',
        name: 'Downtown Music Festival',
        center: { lat: 34.0522, lng: -118.2437 },
        radius: 0.5,
        streams: [
            { id: 's1', lat: 34.0525, lng: -118.2440, title: 'Main Stage View', streamer: 'MusicFan99', viewers: 1250, isLive: true },
            { id: 's2', lat: 34.0520, lng: -118.2430, title: 'Crowd Energy!', streamer: 'VibeCheck', viewers: 890, isLive: true },
            { id: 's3', lat: 34.0518, lng: -118.2445, title: 'Backstage Access', streamer: 'Insider_John', viewers: 2100, isLive: true }
        ],
        totalViewers: 4240,
        startTime: new Date(Date.now() - 2 * 3600000).toISOString(),
        status: 'active'
    },
    {
        id: 'cluster-2',
        name: 'City Marathon',
        center: { lat: 34.0622, lng: -118.2537 },
        radius: 1.2,
        streams: [
            { id: 's4', lat: 34.0630, lng: -118.2540, title: 'Finish Line', streamer: 'RunnerLife', viewers: 3200, isLive: true },
            { id: 's5', lat: 34.0615, lng: -118.2530, title: 'Mile 20', streamer: 'MarathonCam', viewers: 1500, isLive: true }
        ],
        totalViewers: 4700,
        startTime: new Date(Date.now() - 4 * 3600000).toISOString(),
        status: 'active'
    }
];

// Cluster status badge
function ClusterStatusBadge({ status }: { status: EventCluster['status'] }) {
    const config = {
        emerging: { color: 'bg-blue-500/20 text-blue-400', label: 'Emerging' },
        active: { color: 'bg-green-500/20 text-green-400', label: 'Active' },
        declining: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Declining' }
    };

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config[status].color}`}>
            {config[status].label}
        </span>
    );
}

// Stream card within cluster
function StreamCard({ stream, onClick }: { stream: StreamPoint; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors w-full text-left"
        >
            <div className="w-16 h-10 bg-slate-600 rounded overflow-hidden flex-shrink-0">
                {stream.thumbnail ? (
                    <img src={stream.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Radio className="w-4 h-4 text-red-400" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{stream.title}</div>
                <div className="text-xs text-slate-400">{stream.streamer}</div>
            </div>
            <div className="text-right">
                <div className="flex items-center gap-1 text-red-400 text-xs">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    LIVE
                </div>
                <div className="text-xs text-slate-400">
                    <Users className="w-3 h-3 inline" /> {stream.viewers.toLocaleString()}
                </div>
            </div>
        </button>
    );
}

export function EventClusterMap({
    clusters = mockClusters,
    onClusterSelect,
    onStreamSelect
}: EventClusterMapProps) {
    const [selectedCluster, setSelectedCluster] = useState<EventCluster | null>(null);
    const [zoom, setZoom] = useState(12);
    const [showLayers, setShowLayers] = useState(false);
    const [mapStyle, setMapStyle] = useState<'default' | 'satellite' | 'dark'>('dark');
    const mapRef = useRef<HTMLDivElement>(null);

    const handleClusterClick = (cluster: EventCluster) => {
        setSelectedCluster(cluster);
        onClusterSelect?.(cluster);
    };

    const handleStreamClick = (stream: StreamPoint) => {
        onStreamSelect?.(stream);
    };

    const formatDuration = (startTime: string) => {
        const diff = Date.now() - new Date(startTime).getTime();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div className="relative h-[600px] bg-slate-900 rounded-xl overflow-hidden">
            {/* Map placeholder - would integrate with Mapbox/Leaflet */}
            <div
                ref={mapRef}
                className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}
            >
                {/* Cluster markers */}
                {clusters.map((cluster, idx) => (
                    <button
                        key={cluster.id}
                        onClick={() => handleClusterClick(cluster)}
                        className={`absolute transform -translate-x-1/2 -translate-y-1/2 
                            ${selectedCluster?.id === cluster.id ? 'z-20' : 'z-10'}
                            transition-transform hover:scale-110`}
                        style={{
                            left: `${30 + idx * 25}%`,
                            top: `${40 + idx * 10}%`
                        }}
                    >
                        <div className={`relative`}>
                            {/* Pulse ring */}
                            <div className={`absolute inset-0 rounded-full animate-ping 
                                ${cluster.status === 'emerging' ? 'bg-blue-500/30' :
                                    cluster.status === 'active' ? 'bg-green-500/30' : 'bg-yellow-500/30'}`}
                                style={{ animationDuration: '2s' }}
                            />
                            {/* Cluster circle */}
                            <div className={`relative w-14 h-14 rounded-full flex flex-col items-center justify-center
                                ${selectedCluster?.id === cluster.id ? 'ring-2 ring-white' : ''}
                                ${cluster.status === 'emerging' ? 'bg-blue-500/80' :
                                    cluster.status === 'active' ? 'bg-green-500/80' : 'bg-yellow-500/80'}`}
                            >
                                <span className="text-white font-bold text-sm">{cluster.streams.length}</span>
                                <span className="text-white/70 text-[10px]">streams</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Map controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                <Button
                    variant="secondary"
                    className="w-10 h-10 p-0"
                    onClick={() => setZoom(z => Math.min(z + 1, 18))}
                >
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                    variant="secondary"
                    className="w-10 h-10 p-0"
                    onClick={() => setZoom(z => Math.max(z - 1, 5))}
                >
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                    variant="secondary"
                    className="w-10 h-10 p-0"
                    onClick={() => setShowLayers(!showLayers)}
                >
                    <Layers className="w-4 h-4" />
                </Button>
                {showLayers && (
                    <Card className="absolute right-12 top-0 bg-slate-800 border-slate-700 p-2 w-32">
                        {(['default', 'satellite', 'dark'] as const).map(style => (
                            <button
                                key={style}
                                onClick={() => { setMapStyle(style); setShowLayers(false); }}
                                className={`w-full text-left px-2 py-1 rounded text-sm ${mapStyle === style ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {style.charAt(0).toUpperCase() + style.slice(1)}
                            </button>
                        ))}
                    </Card>
                )}
            </div>

            {/* Cluster list sidebar */}
            <div className="absolute left-4 top-4 bottom-4 w-72 z-30">
                <Card className="h-full bg-slate-800/95 backdrop-blur border-slate-700 p-4 overflow-hidden flex flex-col">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-400" />
                        Active Event Clusters
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3">
                        {clusters.map(cluster => (
                            <button
                                key={cluster.id}
                                onClick={() => handleClusterClick(cluster)}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${selectedCluster?.id === cluster.id
                                        ? 'bg-purple-500/20 border border-purple-500/50'
                                        : 'bg-slate-700/50 hover:bg-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <span className="text-white font-medium text-sm">{cluster.name}</span>
                                    <ClusterStatusBadge status={cluster.status} />
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Radio className="w-3 h-3" />
                                        {cluster.streams.length} streams
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {cluster.totalViewers.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(cluster.startTime)}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Selected cluster detail */}
            {selectedCluster && (
                <div className="absolute right-4 bottom-4 w-80 z-30">
                    <Card className="bg-slate-800/95 backdrop-blur border-slate-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-white font-semibold">{selectedCluster.name}</h4>
                            <button
                                onClick={() => setSelectedCluster(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex items-center gap-3 mb-3 text-sm text-slate-400">
                            <ClusterStatusBadge status={selectedCluster.status} />
                            <span>{selectedCluster.totalViewers.toLocaleString()} total viewers</span>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedCluster.streams.map(stream => (
                                <StreamCard
                                    key={stream.id}
                                    stream={stream}
                                    onClick={() => handleStreamClick(stream)}
                                />
                            ))}
                        </div>

                        <Button variant="primary" className="w-full mt-3">
                            <Play className="w-4 h-4 mr-1" />
                            Watch Multi-View
                        </Button>
                    </Card>
                </div>
            )}

            {/* Zoom indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-800/80 rounded-full text-xs text-slate-400 z-20">
                Zoom: {zoom}x
            </div>
        </div>
    );
}

export default EventClusterMap;
