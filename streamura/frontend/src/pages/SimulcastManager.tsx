import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Monitor,
    Youtube,
    Twitch,
    Facebook,
    Twitter,
    PlayCircle,
    StopCircle,
    Settings,
    AlertTriangle,
    RefreshCw,
    Copy,
    Eye,
    Users,
    Wifi,
    WifiOff,
    Link2
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface Platform {
    id: string;
    name: string;
    icon: React.ElementType;
    color: string;
    connected: boolean;
    streamKey?: string;
    rtmpUrl?: string;
    status: 'idle' | 'connecting' | 'live' | 'error';
    viewers?: number;
    bitrate?: number;
}


// Platform icons mapping
const platformIcons: Record<string, React.ElementType> = {
    streamura: Monitor,
    youtube: Youtube,
    twitch: Twitch,
    facebook: Facebook,
    twitter: Twitter
};

// Fetch simulcast data
const fetchSimulcastData = async () => {
    const res = await fetch('/api/v1/simulcast/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch simulcast data');
    return res.json();
};

// Platform status indicator
function PlatformStatus({ status }: { status: Platform['status'] }) {
    const statusConfig: Record<Platform['status'], { color: string; label: string; icon: typeof PlayCircle; animate?: boolean }> = {
        idle: { color: 'text-slate-400', label: 'Ready', icon: PlayCircle },
        connecting: { color: 'text-yellow-400', label: 'Connecting...', icon: RefreshCw, animate: true },
        live: { color: 'text-green-400', label: 'LIVE', icon: Wifi },
        error: { color: 'text-red-400', label: 'Error', icon: WifiOff }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-1.5 text-sm ${config.color}`}>
            <Icon className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`} />
            <span>{config.label}</span>
        </div>
    );
}

// Platform card
function PlatformCard({
    platform,
    onToggle,
    onConfigure,
    isSimulcasting
}: {
    platform: Platform;
    onToggle: () => void;
    onConfigure: () => void;
    isSimulcasting: boolean;
}) {
    const [showKey, setShowKey] = useState(false);
    const Icon = platform.icon;

    const copyStreamKey = () => {
        if (platform.streamKey) {
            navigator.clipboard.writeText(platform.streamKey);
        }
    };

    return (
        <Card className={`bg-slate-800/50 border-slate-700 p-4 ${platform.status === 'live' ? 'ring-2 ring-green-500/50' : ''}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${platform.color}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-white font-medium">{platform.name}</div>
                        <PlatformStatus status={platform.status} />
                    </div>
                </div>
                <button
                    onClick={onConfigure}
                    className="p-2 text-slate-400 hover:text-white"
                >
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {platform.connected ? (
                <>
                    {/* Stream key (hidden by default) */}
                    {platform.streamKey && (
                        <div className="mb-3 p-2 bg-slate-700/50 rounded-lg text-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-slate-400 text-xs">Stream Key</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => setShowKey(!showKey)} className="text-xs text-purple-400">
                                        {showKey ? 'Hide' : 'Show'}
                                    </button>
                                    <button onClick={copyStreamKey} className="p-1 text-slate-400 hover:text-white">
                                        <Copy className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <code className="text-slate-300 text-xs break-all">
                                {showKey ? platform.streamKey : '••••••••••••••••••••'}
                            </code>
                        </div>
                    )}

                    {/* Stats when live */}
                    {platform.status === 'live' && (
                        <div className="flex items-center gap-4 mb-3 text-sm">
                            <div className="flex items-center gap-1 text-slate-300">
                                <Users className="w-4 h-4" />
                                <span>{platform.viewers?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-300">
                                <Wifi className="w-4 h-4" />
                                <span>{platform.bitrate ? `${(platform.bitrate / 1000).toFixed(1)}Mbps` : '--'}</span>
                            </div>
                        </div>
                    )}

                    {/* Toggle button */}
                    <Button
                        variant={platform.status === 'live' ? 'danger' : 'primary'}
                        className="w-full"
                        onClick={onToggle}
                        disabled={!isSimulcasting && platform.status !== 'idle'}
                    >
                        {platform.status === 'live' ? (
                            <>
                                <StopCircle className="w-4 h-4 mr-2" />
                                Stop on {platform.name}
                            </>
                        ) : platform.status === 'connecting' ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Go Live on {platform.name}
                            </>
                        )}
                    </Button>
                </>
            ) : (
                <Button variant="secondary" className="w-full" onClick={onConfigure}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect {platform.name}
                </Button>
            )}
        </Card>
    );
}

export function SimulcastManager() {
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['streamura']);
    const [isStreaming, setIsStreaming] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['simulcast'],
        queryFn: fetchSimulcastData,
        refetchInterval: isStreaming ? 5000 : 30000
    });

    const startSimulcast = useMutation({
        mutationFn: async (platformIds: string[]) => {
            const res = await fetch('/api/v1/simulcast/start', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ platforms: platformIds })
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['simulcast'] });
            setIsStreaming(true);
        }
    });

    const stopSimulcast = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/v1/simulcast/stop', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['simulcast'] });
            setIsStreaming(false);
        }
    });

    // Mock data
    const mockPlatforms: Platform[] = [
        { id: 'streamura', name: 'Streamura', icon: platformIcons.streamura, color: 'bg-purple-500/20 text-purple-400', connected: true, status: isStreaming ? 'live' : 'idle', viewers: 1247, bitrate: 6000000, streamKey: 'strm_live_abc123xyz' },
        { id: 'youtube', name: 'YouTube', icon: platformIcons.youtube, color: 'bg-red-500/20 text-red-400', connected: true, status: isStreaming && selectedPlatforms.includes('youtube') ? 'live' : 'idle', viewers: 3842, bitrate: 6000000, streamKey: 'yt_key_secret123', rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2' },
        { id: 'twitch', name: 'Twitch', icon: platformIcons.twitch, color: 'bg-violet-500/20 text-violet-400', connected: true, status: isStreaming && selectedPlatforms.includes('twitch') ? 'live' : 'idle', viewers: 892, bitrate: 6000000, streamKey: 'live_abc123_secret' },
        { id: 'facebook', name: 'Facebook', icon: platformIcons.facebook, color: 'bg-blue-500/20 text-blue-400', connected: false, status: 'idle' },
        { id: 'twitter', name: 'X (Twitter)', icon: platformIcons.twitter, color: 'bg-slate-500/20 text-slate-400', connected: false, status: 'idle' }
    ];

    const platforms = data?.platforms || mockPlatforms;
    const totalViewers = platforms.reduce((sum: number, p: Platform) => sum + (p.viewers || 0), 0);

    const handleTogglePlatform = (platformId: string) => {
        if (selectedPlatforms.includes(platformId)) {
            setSelectedPlatforms(prev => prev.filter(id => id !== platformId));
        } else {
            setSelectedPlatforms(prev => [...prev, platformId]);
        }
    };

    const handleConfigurePlatform = (platformId: string) => {
        // Would open configuration modal
        console.log('Configure platform:', platformId);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading simulcast settings...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Monitor className="h-6 w-6 text-purple-400" />
                        Multi-Platform Simulcast
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Stream to multiple platforms simultaneously</p>
                </div>
                {isStreaming && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="font-medium">LIVE</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                            <Eye className="w-4 h-4" />
                            <span className="font-medium">{totalViewers.toLocaleString()}</span>
                            <span className="text-slate-500">total viewers</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick actions */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium">
                            {isStreaming ? 'Currently streaming to' : 'Ready to stream to'} {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''}
                        </h3>
                        <p className="text-sm text-slate-400">
                            {isStreaming
                                ? 'Your stream is being distributed to all selected platforms'
                                : 'Select platforms below and click "Start Simulcast" to begin'
                            }
                        </p>
                    </div>
                    <Button
                        variant={isStreaming ? 'danger' : 'primary'}
                        size="lg"
                        onClick={() => isStreaming ? stopSimulcast.mutate() : startSimulcast.mutate(selectedPlatforms)}
                        disabled={selectedPlatforms.length === 0}
                    >
                        {isStreaming ? (
                            <>
                                <StopCircle className="w-5 h-5 mr-2" />
                                End Simulcast
                            </>
                        ) : (
                            <>
                                <PlayCircle className="w-5 h-5 mr-2" />
                                Start Simulcast
                            </>
                        )}
                    </Button>
                </div>
            </Card>

            {/* Platform selection */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Platforms</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {platforms.map((platform: Platform) => (
                        <div key={platform.id} className="relative">
                            {platform.connected && !isStreaming && (
                                <label className="absolute top-3 right-12 z-10 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedPlatforms.includes(platform.id)}
                                        onChange={() => handleTogglePlatform(platform.id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                                    />
                                </label>
                            )}
                            <PlatformCard
                                platform={platform}
                                onToggle={() => handleTogglePlatform(platform.id)}
                                onConfigure={() => handleConfigurePlatform(platform.id)}
                                isSimulcasting={isStreaming}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Stream settings summary */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-3">Stream Settings</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-slate-400">Resolution</div>
                        <div className="text-white font-medium">1920x1080</div>
                    </div>
                    <div>
                        <div className="text-slate-400">Framerate</div>
                        <div className="text-white font-medium">60 FPS</div>
                    </div>
                    <div>
                        <div className="text-slate-400">Video Bitrate</div>
                        <div className="text-white font-medium">6000 Kbps</div>
                    </div>
                    <div>
                        <div className="text-slate-400">Audio Bitrate</div>
                        <div className="text-white font-medium">320 Kbps</div>
                    </div>
                </div>
            </Card>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-200">
                    <strong>Note:</strong> Multi-platform streaming requires significant upload bandwidth.
                    We recommend at least 20 Mbps upload speed for optimal performance.
                </div>
            </div>
        </div>
    );
}

export default SimulcastManager;
