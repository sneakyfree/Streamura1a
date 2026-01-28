import { useState, useEffect, useRef, TouchEvent } from 'react';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    Settings,
    MessageSquare,
    Heart,
    Share2,
    RotateCcw,
    SkipForward,
    Wifi,
    WifiOff,
    ChevronUp,
    ChevronDown,
    Gift,
    Users
} from 'lucide-react';

// Types
interface MobilePlayerProps {
    streamUrl: string;
    streamerId: number;
    streamerName: string;
    title: string;
    viewerCount: number;
    isLive: boolean;
    onChatToggle?: () => void;
    onTip?: () => void;
}

interface GestureState {
    startX: number;
    startY: number;
    startTime: number;
    direction: 'none' | 'horizontal' | 'vertical';
}

// Mobile-optimized stream player
export function MobileStreamPlayer({
    streamUrl,
    streamerId,
    streamerName,
    title,
    viewerCount,
    isLive,
    onChatToggle,
    onTip
}: MobilePlayerProps) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [volume, setVolume] = useState(1);
    const [quality, setQuality] = useState<'auto' | '1080p' | '720p' | '480p' | '360p'>('auto');
    const [showSettings, setShowSettings] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
    const [brightness, setBrightness] = useState(1);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<GestureState>({ startX: 0, startY: 0, startTime: 0, direction: 'none' });
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();

    // Auto-hide controls
    useEffect(() => {
        if (showControls && isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, [showControls, isPlaying]);

    // Touch gesture handling
    const handleTouchStart = (e: TouchEvent) => {
        const touch = e.touches[0];
        gestureRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            direction: 'none'
        };
    };

    const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const { startX, startY, direction } = gestureRef.current;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        // Determine swipe direction
        if (direction === 'none') {
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                gestureRef.current.direction = 'horizontal';
            } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
                gestureRef.current.direction = 'vertical';
            }
        }

        // Vertical swipe on right side = volume
        if (gestureRef.current.direction === 'vertical') {
            const screenWidth = containerRef.current?.clientWidth || window.innerWidth;
            if (startX > screenWidth / 2) {
                // Right side - volume
                const newVolume = Math.max(0, Math.min(1, volume - deltaY / 200));
                setVolume(newVolume);
                if (videoRef.current) videoRef.current.volume = newVolume;
            } else {
                // Left side - brightness
                const newBrightness = Math.max(0.3, Math.min(1.5, brightness - deltaY / 200));
                setBrightness(newBrightness);
            }
        }
    };

    const handleTouchEnd = (e: TouchEvent) => {
        const { startX, startY, startTime, direction } = gestureRef.current;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const duration = Date.now() - startTime;

        // Tap to toggle controls
        if (Math.abs(endX - startX) < 10 && Math.abs(endY - startY) < 10 && duration < 300) {
            setShowControls(!showControls);
        }

        // Double tap to like
        if (duration < 200) {
            // Would implement double-tap detection here
        }

        gestureRef.current.direction = 'none';
    };

    const togglePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleFullscreen = async () => {
        if (!containerRef.current) return;

        try {
            if (!isFullscreen) {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
                // Lock to landscape on mobile
                if (screen.orientation?.lock) {
                    await screen.orientation.lock('landscape');
                }
            } else {
                await document.exitFullscreen();
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    const qualityOptions = ['auto', '1080p', '720p', '480p', '360p'] as const;

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black touch-none select-none"
            style={{ filter: `brightness(${brightness})` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Video */}
            <video
                ref={videoRef}
                src={streamUrl}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted={isMuted}
            />

            {/* Live badge */}
            {isLive && (
                <div className="absolute top-3 left-3 px-2 py-1 rounded bg-red-500 text-white text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    LIVE
                </div>
            )}

            {/* Viewer count */}
            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/50 text-white text-xs flex items-center gap-1">
                <Users className="w-3 h-3" />
                {viewerCount.toLocaleString()}
            </div>

            {/* Connection quality indicator */}
            <div className={`absolute top-3 left-16 px-2 py-1 rounded text-xs flex items-center gap-1 ${connectionQuality === 'good' ? 'bg-green-500/50 text-green-200' :
                    connectionQuality === 'fair' ? 'bg-yellow-500/50 text-yellow-200' :
                        'bg-red-500/50 text-red-200'
                }`}>
                {connectionQuality === 'poor' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            </div>

            {/* Volume/brightness indicator */}
            {gestureRef.current.direction === 'vertical' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 rounded-lg p-4 flex flex-col items-center gap-2">
                    {gestureRef.current.startX > (containerRef.current?.clientWidth || 0) / 2 ? (
                        <>
                            <Volume2 className="w-6 h-6 text-white" />
                            <div className="w-1 h-20 bg-slate-600 rounded-full overflow-hidden">
                                <div className="w-full bg-white rounded-full" style={{ height: `${volume * 100}%` }} />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-6 h-6 text-yellow-400">☀️</div>
                            <div className="w-1 h-20 bg-slate-600 rounded-full overflow-hidden">
                                <div className="w-full bg-yellow-400 rounded-full" style={{ height: `${(brightness - 0.3) / 1.2 * 100}%` }} />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Controls overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* Top bar */}
                <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">{streamerName}</div>
                        <div className="text-slate-300 text-xs truncate">{title}</div>
                    </div>
                </div>

                {/* Center controls */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
                    <button className="p-2 text-white/70 hover:text-white">
                        <RotateCcw className="w-6 h-6" />
                    </button>
                    <button
                        onClick={togglePlayPause}
                        className="p-4 rounded-full bg-white/20 backdrop-blur-sm text-white"
                    >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                    </button>
                    <button className="p-2 text-white/70 hover:text-white">
                        <SkipForward className="w-6 h-6" />
                    </button>
                </div>

                {/* Bottom bar */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    {/* Action buttons */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className="p-2 text-white"
                            >
                                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-2 text-white"
                            >
                                <Settings className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setIsLiked(!isLiked)}
                                className={`p-2 ${isLiked ? 'text-red-500' : 'text-white'}`}
                            >
                                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                            </button>
                            <button onClick={onTip} className="p-2 text-yellow-400">
                                <Gift className="w-5 h-5" />
                            </button>
                            <button className="p-2 text-white">
                                <Share2 className="w-5 h-5" />
                            </button>
                            <button onClick={onChatToggle} className="p-2 text-white">
                                <MessageSquare className="w-5 h-5" />
                            </button>
                            <button onClick={toggleFullscreen} className="p-2 text-white">
                                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Progress bar for VOD */}
                    {!isLive && (
                        <div className="w-full h-1 bg-white/30 rounded-full">
                            <div className="h-full bg-purple-500 rounded-full w-1/3" />
                        </div>
                    )}
                </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
                <div className="absolute bottom-20 right-3 bg-slate-900/95 backdrop-blur-sm rounded-lg p-3 min-w-[150px]">
                    <div className="text-white text-sm font-medium mb-2">Quality</div>
                    {qualityOptions.map((q) => (
                        <button
                            key={q}
                            onClick={() => { setQuality(q); setShowSettings(false); }}
                            className={`w-full text-left px-3 py-2 rounded text-sm ${quality === q ? 'bg-purple-500 text-white' : 'text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {q === 'auto' ? 'Auto' : q}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Mobile bottom navigation
export function MobileBottomNav({
    activeTab,
    onTabChange,
    hasNotifications = false
}: {
    activeTab: string;
    onTabChange: (tab: string) => void;
    hasNotifications?: boolean;
}) {
    const tabs = [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'discover', icon: '🔍', label: 'Discover' },
        { id: 'live', icon: '📺', label: 'Go Live' },
        { id: 'chat', icon: '💬', label: 'Chat' },
        { id: 'profile', icon: '👤', label: 'Profile' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-t border-slate-800 safe-area-pb">
            <div className="flex items-center justify-around py-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg transition-colors relative ${activeTab === tab.id ? 'text-purple-400' : 'text-slate-400'
                            }`}
                    >
                        <span className={`text-xl ${tab.id === 'live' ? 'p-2 rounded-full bg-red-500 text-white' : ''}`}>
                            {tab.icon}
                        </span>
                        <span className="text-xs">{tab.label}</span>
                        {tab.id === 'chat' && hasNotifications && (
                            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500" />
                        )}
                    </button>
                ))}
            </div>
        </nav>
    );
}

// Pull-to-refresh component
export function PullToRefresh({
    onRefresh,
    children
}: {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
}) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const THRESHOLD = 80;

    const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
        if (containerRef.current?.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
        if (!isPulling) return;

        const currentY = e.touches[0].clientY;
        const distance = Math.max(0, currentY - startY.current);
        setPullDistance(Math.min(distance * 0.5, THRESHOLD * 1.5));
    };

    const handleTouchEnd = async () => {
        if (pullDistance >= THRESHOLD) {
            setIsRefreshing(true);
            await onRefresh();
            setIsRefreshing(false);
        }
        setPullDistance(0);
        setIsPulling(false);
    };

    return (
        <div
            ref={containerRef}
            className="relative overflow-auto h-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-transform"
                style={{
                    transform: `translateY(${pullDistance - 40}px)`,
                    opacity: pullDistance / THRESHOLD
                }}
            >
                <div className={`w-8 h-8 rounded-full border-2 border-purple-500 ${isRefreshing ? 'animate-spin' : ''}`}>
                    {isRefreshing ? (
                        <div className="w-full h-full rounded-full border-t-2 border-purple-500" />
                    ) : (
                        <ChevronDown className={`w-full h-full text-purple-500 transition-transform ${pullDistance >= THRESHOLD ? 'rotate-180' : ''}`} />
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ transform: `translateY(${isRefreshing ? 40 : pullDistance}px)` }}>
                {children}
            </div>
        </div>
    );
}

export default MobileStreamPlayer;
