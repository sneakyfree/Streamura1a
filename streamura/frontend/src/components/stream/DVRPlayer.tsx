import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Rewind,
    FastForward,
    Radio,
    Clock,
    Bookmark,
    BookmarkCheck,
    Download,
    Share2,
    Maximize,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';

// Types
interface DVRMarker {
    id: string;
    timestamp: number;
    label: string;
    type: 'bookmark' | 'highlight' | 'chapter';
}

interface DVRPlayerProps {
    streamId: string;
    streamUrl: string;
    isLive: boolean;
    dvrWindowMinutes?: number;  // How far back user can go
    markers?: DVRMarker[];
    onClip?: (startTime: number, endTime: number) => void;
}

// Format time as HH:MM:SS or MM:SS
function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format time ago
function formatTimeAgo(seconds: number): string {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`;
}

export function DVRPlayer({
    streamUrl,
    isLive,
    dvrWindowMinutes = 120,  // 2 hour default DVR window
    markers = [],
    onClip
}: DVRPlayerProps) {
    // Player state
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [isAtLive, setIsAtLive] = useState(true);
    const [liveEdgeOffset, setLiveEdgeOffset] = useState(0);  // How far behind live
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isClipping, setIsClipping] = useState(false);
    const [clipStart, setClipStart] = useState<number | null>(null);
    const [userMarkers, setUserMarkers] = useState<DVRMarker[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Update current time and check if at live edge
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            if (isLive) {
                // Calculate offset from live edge
                const offset = duration - video.currentTime;
                setLiveEdgeOffset(offset);
                setIsAtLive(offset < 10);  // Within 10 seconds of live
            }
        };

        const handleDurationChange = () => {
            setDuration(video.duration);
        };

        const handleProgress = () => {
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('progress', handleProgress);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('progress', handleProgress);
        };
    }, [isLive, duration]);

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

    // Jump to live
    const jumpToLive = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = duration;
            setIsAtLive(true);
        }
    }, [duration]);

    // Seek relative to current position
    const seekRelative = useCallback((seconds: number) => {
        if (videoRef.current) {
            const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
            videoRef.current.currentTime = newTime;
        }
    }, [duration]);

    // Handle seek on progress bar click
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !videoRef.current) return;

        const rect = progressRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = pos * duration;
        videoRef.current.currentTime = newTime;
    };

    // Toggle play/pause
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

    // Add bookmark at current time
    const addBookmark = () => {
        const newMarker: DVRMarker = {
            id: `bookmark-${Date.now()}`,
            timestamp: currentTime,
            label: `Bookmark at ${formatTime(currentTime)}`,
            type: 'bookmark'
        };
        setUserMarkers(prev => [...prev, newMarker]);
    };

    // Start/end clipping
    const handleClipAction = () => {
        if (!isClipping) {
            setClipStart(currentTime);
            setIsClipping(true);
        } else if (clipStart !== null) {
            onClip?.(clipStart, currentTime);
            setIsClipping(false);
            setClipStart(null);
        }
    };

    // Playback speed options
    const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

    const allMarkers = [...markers, ...userMarkers];

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-video bg-black group"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onMouseMove={() => setShowControls(true)}
        >
            {/* Video element */}
            <video
                ref={videoRef}
                src={streamUrl}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                muted={isMuted}
            />

            {/* Live/DVR badge */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
                {isLive && (
                    <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${isAtLive
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                        <Radio className="w-3 h-3" />
                        {isAtLive ? 'LIVE' : formatTimeAgo(liveEdgeOffset)}
                    </div>
                )}
                {!isAtLive && isLive && (
                    <button
                        onClick={jumpToLive}
                        className="px-2 py-1 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
                    >
                        Jump to Live
                    </button>
                )}
            </div>

            {/* Clipping indicator */}
            {isClipping && (
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-purple-500 text-white text-sm font-medium flex items-center gap-2 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    Recording clip from {formatTime(clipStart || 0)}
                </div>
            )}

            {/* Controls overlay */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {/* Center play button */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
                    <button
                        onClick={() => seekRelative(-10)}
                        className="p-2 text-white/70 hover:text-white"
                    >
                        <Rewind className="w-6 h-6" />
                    </button>
                    <button
                        onClick={togglePlayPause}
                        className="p-4 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
                    >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
                    </button>
                    <button
                        onClick={() => seekRelative(10)}
                        className="p-2 text-white/70 hover:text-white"
                    >
                        <FastForward className="w-6 h-6" />
                    </button>
                </div>

                {/* Bottom controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                    {/* Progress bar */}
                    <div
                        ref={progressRef}
                        className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress"
                        onClick={handleProgressClick}
                    >
                        {/* Buffered */}
                        <div
                            className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
                            style={{ width: `${(buffered / duration) * 100}%` }}
                        />
                        {/* Progress */}
                        <div
                            className="absolute inset-y-0 left-0 bg-purple-500 rounded-full"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                        {/* Clip region */}
                        {isClipping && clipStart !== null && (
                            <div
                                className="absolute inset-y-0 bg-purple-500/50 rounded-full"
                                style={{
                                    left: `${(clipStart / duration) * 100}%`,
                                    width: `${((currentTime - clipStart) / duration) * 100}%`
                                }}
                            />
                        )}
                        {/* Markers */}
                        {allMarkers.map((marker) => (
                            <div
                                key={marker.id}
                                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-400 cursor-pointer hover:scale-150 transition-transform"
                                style={{ left: `${(marker.timestamp / duration) * 100}%` }}
                                title={marker.label}
                            />
                        ))}
                        {/* Scrubber */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
                            style={{ left: `${(currentTime / duration) * 100}%`, marginLeft: '-6px' }}
                        />
                    </div>

                    {/* Time display */}
                    <div className="flex items-center justify-between text-white text-sm">
                        <div className="flex items-center gap-2">
                            <span>{formatTime(currentTime)}</span>
                            <span className="text-white/50">/</span>
                            <span className="text-white/70">{formatTime(duration)}</span>
                        </div>

                        {/* DVR timeline indicator */}
                        {isLive && (
                            <div className="flex items-center gap-1 text-xs text-white/50">
                                <Clock className="w-3 h-3" />
                                <span>{dvrWindowMinutes}min DVR window</span>
                            </div>
                        )}
                    </div>

                    {/* Control buttons */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {/* Volume */}
                            <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-white">
                                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                            </button>

                            {/* Skip buttons */}
                            <button onClick={() => seekRelative(-30)} className="p-2 text-white/70 hover:text-white text-xs flex items-center gap-1">
                                <SkipBack className="w-4 h-4" />
                                30s
                            </button>
                            <button onClick={() => seekRelative(30)} className="p-2 text-white/70 hover:text-white text-xs flex items-center gap-1">
                                30s
                                <SkipForward className="w-4 h-4" />
                            </button>

                            {/* Speed */}
                            <select
                                value={playbackRate}
                                onChange={(e) => {
                                    const rate = parseFloat(e.target.value);
                                    setPlaybackRate(rate);
                                    if (videoRef.current) videoRef.current.playbackRate = rate;
                                }}
                                className="bg-white/20 text-white text-xs px-2 py-1 rounded"
                            >
                                {speedOptions.map((speed) => (
                                    <option key={speed} value={speed}>{speed}x</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Bookmark */}
                            <button onClick={addBookmark} className="p-2 text-white/70 hover:text-yellow-400">
                                <Bookmark className="w-5 h-5" />
                            </button>

                            {/* Clip */}
                            <button
                                onClick={handleClipAction}
                                className={`p-2 ${isClipping ? 'text-purple-400' : 'text-white/70 hover:text-purple-400'}`}
                            >
                                <Download className="w-5 h-5" />
                            </button>

                            {/* Share */}
                            <button className="p-2 text-white/70 hover:text-white">
                                <Share2 className="w-5 h-5" />
                            </button>

                            {/* Fullscreen */}
                            <button
                                onClick={() => containerRef.current?.requestFullscreen()}
                                className="p-2 text-white"
                            >
                                <Maximize className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Chapter/bookmark list
export function DVRChapterList({
    markers,
    currentTime,
    onSeek
}: {
    markers: DVRMarker[];
    currentTime: number;
    onSeek: (timestamp: number) => void;
}) {
    const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-yellow-400" />
                Chapters & Bookmarks
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
                {sortedMarkers.length === 0 ? (
                    <p className="text-slate-400 text-sm">No markers yet</p>
                ) : (
                    sortedMarkers.map((marker) => (
                        <button
                            key={marker.id}
                            onClick={() => onSeek(marker.timestamp)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${Math.abs(marker.timestamp - currentTime) < 5
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'hover:bg-slate-700/50 text-slate-300'
                                }`}
                        >
                            <span className="text-xs font-mono text-slate-500">
                                {formatTime(marker.timestamp)}
                            </span>
                            <span className="flex-1 truncate">{marker.label}</span>
                            {marker.type === 'highlight' && (
                                <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs">
                                    Highlight
                                </span>
                            )}
                        </button>
                    ))
                )}
            </div>
        </Card>
    );
}

export default DVRPlayer;
