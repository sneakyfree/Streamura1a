/**
 * StreamPlayer Component
 *
 * Real video player for watching live streams using LiveKit.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRoomContext,
  useConnectionState,
  useRemoteParticipants,
} from '@livekit/components-react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Users,
  Loader2,
  AlertCircle,
  Video,
  RefreshCw,
} from 'lucide-react';
import { Track, ConnectionState } from 'livekit-client';
import type { Stream } from '@/types';
import { fetchViewerToken } from '@/lib/livekit';
import { Button } from '@/components/ui/Button';

interface StreamPlayerProps {
  stream: Stream;
  autoPlay?: boolean;
}

// Video display component
function VideoDisplay() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  // Find the main video track (prefer screen share if available)
  const screenShareTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare
  );
  const cameraTrack = tracks.find((t) => t.source === Track.Source.Camera);
  const mainTrack = screenShareTrack || cameraTrack;

  if (!mainTrack) {
    return (
      <div className="w-full h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Video className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">Waiting for broadcaster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <VideoTrack
        trackRef={mainTrack}
        className="w-full h-full object-contain"
      />
      {/* Picture-in-picture for camera when screen sharing */}
      {screenShareTrack && cameraTrack && (
        <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-slate-700 shadow-lg">
          <VideoTrack
            trackRef={cameraTrack}
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

// Connection status indicator
function ConnectionIndicator() {
  const connectionState = useConnectionState();

  if (connectionState === ConnectionState.Connected) {
    return null;
  }

  const getMessage = () => {
    switch (connectionState) {
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Reconnecting:
        return 'Reconnecting...';
      case ConnectionState.Disconnected:
        return 'Disconnected';
      default:
        return 'Connecting...';
    }
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-3" />
        <p className="text-white">{getMessage()}</p>
      </div>
    </div>
  );
}

// Viewer count display
function ViewerCount() {
  const participants = useRemoteParticipants();
  // Count includes us + other viewers (but we count from remote participants + 1)
  const count = participants.length + 1;

  return (
    <div className="flex items-center gap-1.5 bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm">
      <Users className="h-4 w-4" />
      {count.toLocaleString()}
    </div>
  );
}

// Player controls
function PlayerControls({
  isPlaying,
  isMuted,
  isFullscreen,
  onPlayPause,
  onMuteToggle,
  onFullscreenToggle,
}: {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onMuteToggle: () => void;
  onFullscreenToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          className="text-white hover:text-primary-400 transition-colors"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6" />
          )}
        </button>

        {/* Volume */}
        <button
          onClick={onMuteToggle}
          className="text-white hover:text-primary-400 transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <VolumeX className="h-6 w-6" />
          ) : (
            <Volume2 className="h-6 w-6" />
          )}
        </button>

        {/* Live indicator */}
        <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
          <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Settings */}
        <button
          className="text-white hover:text-primary-400 transition-colors"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* Fullscreen */}
        <button
          onClick={onFullscreenToggle}
          className="text-white hover:text-primary-400 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

// Room content component
function RoomContent({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const room = useRoomContext();

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    // Mute/unmute all audio tracks
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        if (publication.track) {
          publication.track.setMuted(!isMuted);
        }
      });
    });
    setIsMuted(!isMuted);
  }, [room, isMuted]);

  // Handle fullscreen toggle
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, [containerRef]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (showControls) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [showControls]);

  return (
    <div
      className="relative w-full h-full"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video */}
      <VideoDisplay />

      {/* Connection indicator */}
      <ConnectionIndicator />

      {/* Live Badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-lg font-medium z-20">
        <span className="h-2 w-2 bg-white rounded-full animate-pulse" />
        LIVE
      </div>

      {/* Viewer Count */}
      <div className="absolute top-4 right-4 z-20">
        <ViewerCount />
      </div>

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity z-10 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <PlayerControls
            isPlaying={isPlaying}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onMuteToggle={handleMuteToggle}
            onFullscreenToggle={handleFullscreenToggle}
          />
        </div>
      </div>
    </div>
  );
}

// Main StreamPlayer component
export function StreamPlayer({ stream, autoPlay = true }: StreamPlayerProps) {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useState<HTMLDivElement | null>(null);

  const isLive = stream.status === 'live';

  // Fetch viewer token
  useEffect(() => {
    async function getToken() {
      if (!isLive) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const { token, livekitUrl } = await fetchViewerToken(stream.id);
        setToken(token);
        setLivekitUrl(livekitUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to connect to stream'
        );
      } finally {
        setIsLoading(false);
      }
    }

    getToken();
  }, [stream.id, isLive]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    // Re-fetch token
    fetchViewerToken(stream.id)
      .then(({ token, livekitUrl }) => {
        setToken(token);
        setLivekitUrl(livekitUrl);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to connect');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [stream.id]);

  // Not live - show placeholder
  if (!isLive) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          {stream.thumbnail_url ? (
            <img
              src={stream.thumbnail_url}
              alt={stream.title || 'Stream'}
              className="w-full h-full object-cover opacity-50"
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Video className="h-16 w-16 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Stream has ended</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Connecting to stream...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Connection Failed
            </h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <Button onClick={handleRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No token yet
  if (!token || !livekitUrl) {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </div>
      </div>
    );
  }

  // Connected - show LiveKit room
  return (
    <div
      ref={(el) => containerRef[1](el)}
      className="relative aspect-video bg-black rounded-xl overflow-hidden"
    >
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={autoPlay}
        audio={true}
        video={false}
        className="w-full h-full"
        onDisconnected={() => {
          setError('Disconnected from stream');
        }}
      >
        <RoomContent
          containerRef={{ current: containerRef[0] }}
        />
      </LiveKitRoom>
    </div>
  );
}
