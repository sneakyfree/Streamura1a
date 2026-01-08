/**
 * BroadcastView Component
 *
 * Provides the broadcaster interface for streaming live video.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Users,
  Settings,
  StopCircle,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Track, ConnectionState } from 'livekit-client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { fetchBroadcastToken, getAvailableDevices } from '@/lib/livekit';

interface BroadcastViewProps {
  streamId: number;
  onStreamEnd?: () => void;
  onViewerCountChange?: (count: number) => void;
}

// Connection state component
function ConnectionStatus() {
  const room = useRoomContext();
  const [state, setState] = useState<ConnectionState>(room.state);

  useEffect(() => {
    const handleStateChange = (newState: ConnectionState) => {
      setState(newState);
    };

    room.on('connectionStateChanged', handleStateChange);
    return () => {
      room.off('connectionStateChanged', handleStateChange);
    };
  }, [room]);

  const getStatusColor = () => {
    switch (state) {
      case ConnectionState.Connected:
        return 'text-green-400';
      case ConnectionState.Connecting:
        return 'text-yellow-400';
      case ConnectionState.Reconnecting:
        return 'text-yellow-400';
      default:
        return 'text-red-400';
    }
  };

  const getStatusIcon = () => {
    if (state === ConnectionState.Connected) {
      return <Wifi className="h-4 w-4" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  return (
    <div className={`flex items-center gap-2 ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="text-sm capitalize">{state}</span>
    </div>
  );
}

// Local video preview
function LocalVideoPreview() {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });

  const videoTrack = tracks.find(
    (t) => t.participant.identity === localParticipant.identity
  );

  if (!videoTrack) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
        <VideoOff className="h-12 w-12 text-slate-500" />
      </div>
    );
  }

  return (
    <VideoTrack
      trackRef={videoTrack}
      className="w-full h-full object-cover"
    />
  );
}

// Viewer count display
function ViewerCount({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const room = useRoomContext();
  const [count, setCount] = useState(room.remoteParticipants.size);

  useEffect(() => {
    const updateCount = () => {
      const newCount = room.remoteParticipants.size;
      setCount(newCount);
      onCountChange?.(newCount);
    };

    room.on('participantConnected', updateCount);
    room.on('participantDisconnected', updateCount);

    return () => {
      room.off('participantConnected', updateCount);
      room.off('participantDisconnected', updateCount);
    };
  }, [room, onCountChange]);

  return (
    <div className="flex items-center gap-2 text-white">
      <Users className="h-4 w-4" />
      <span>{count} viewer{count !== 1 ? 's' : ''}</span>
    </div>
  );
}

// Media controls
function MediaControls({ onEndStream }: { onEndStream: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const toggleCamera = async () => {
    await localParticipant.setCameraEnabled(!isCameraOn);
    setIsCameraOn(!isCameraOn);
  };

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicOn);
    setIsMicOn(!isMicOn);
  };

  const toggleScreenShare = async () => {
    await localParticipant.setScreenShareEnabled(!isScreenSharing);
    setIsScreenSharing(!isScreenSharing);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={isCameraOn ? 'secondary' : 'ghost'}
        size="sm"
        onClick={toggleCamera}
        className={!isCameraOn ? 'bg-red-500/20 text-red-400' : ''}
      >
        {isCameraOn ? (
          <Video className="h-4 w-4" />
        ) : (
          <VideoOff className="h-4 w-4" />
        )}
      </Button>

      <Button
        variant={isMicOn ? 'secondary' : 'ghost'}
        size="sm"
        onClick={toggleMic}
        className={!isMicOn ? 'bg-red-500/20 text-red-400' : ''}
      >
        {isMicOn ? (
          <Mic className="h-4 w-4" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
      </Button>

      <Button
        variant={isScreenSharing ? 'primary' : 'secondary'}
        size="sm"
        onClick={toggleScreenShare}
        className={isScreenSharing ? 'bg-primary-500' : ''}
      >
        <Monitor className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-slate-600 mx-2" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onEndStream}
        className="bg-red-500 hover:bg-red-600 text-white"
      >
        <StopCircle className="h-4 w-4 mr-2" />
        End Stream
      </Button>
    </div>
  );
}

// Broadcast room content
function BroadcastRoomContent({
  onEndStream,
  onViewerCountChange,
}: {
  onEndStream: () => void;
  onViewerCountChange?: (count: number) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-medium">LIVE</span>
          </div>
          <ConnectionStatus />
        </div>
        <ViewerCount onCountChange={onViewerCountChange} />
      </div>

      {/* Video preview */}
      <div className="flex-1 relative bg-black">
        <LocalVideoPreview />
      </div>

      {/* Controls */}
      <div className="p-4 bg-slate-800/50 flex justify-center">
        <MediaControls onEndStream={onEndStream} />
      </div>
    </div>
  );
}

// Main broadcast view
export function BroadcastView({
  streamId,
  onStreamEnd,
  onViewerCountChange,
}: BroadcastViewProps) {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  // Fetch broadcast token
  useEffect(() => {
    async function getToken() {
      try {
        setIsLoading(true);
        setError(null);
        const { token, livekitUrl } = await fetchBroadcastToken(streamId);
        setToken(token);
        setLivekitUrl(livekitUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get broadcast token');
      } finally {
        setIsLoading(false);
      }
    }

    getToken();
  }, [streamId]);

  const handleEndStream = useCallback(async () => {
    setIsEnding(true);
    onStreamEnd?.();
  }, [onStreamEnd]);

  if (isLoading) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Preparing broadcast...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Failed to Start Broadcast
            </h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEnding) {
    return (
      <div className="h-full bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Ending stream...</p>
        </div>
      </div>
    );
  }

  if (!token || !livekitUrl) {
    return null;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      video={true}
      audio={true}
      className="h-full"
      onDisconnected={() => {
        if (!isEnding) {
          setError('Disconnected from server');
        }
      }}
    >
      <BroadcastRoomContent
        onEndStream={handleEndStream}
        onViewerCountChange={onViewerCountChange}
      />
    </LiveKitRoom>
  );
}

// Pre-broadcast setup component
export function BroadcastSetup({
  onReady,
  onCancel,
}: {
  onReady: () => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setup() {
      try {
        setIsLoading(true);

        // Request permissions first
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setStream(mediaStream);

        // Get available devices
        const { videoDevices, audioDevices } = await getAvailableDevices();
        setVideoDevices(videoDevices);
        setAudioDevices(audioDevices);

        // Set defaults
        if (videoDevices.length > 0) {
          setSelectedVideo(videoDevices[0].deviceId);
        }
        if (audioDevices.length > 0) {
          setSelectedAudio(audioDevices[0].deviceId);
        }

        // Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to access camera/microphone'
        );
      } finally {
        setIsLoading(false);
      }
    }

    setup();

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleDeviceChange = async (
    type: 'video' | 'audio',
    deviceId: string
  ) => {
    if (type === 'video') {
      setSelectedVideo(deviceId);
    } else {
      setSelectedAudio(deviceId);
    }

    // Update stream with new device
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video' ? { deviceId } : { deviceId: selectedVideo },
        audio: type === 'audio' ? { deviceId } : { deviceId: selectedAudio },
      });

      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      setError('Failed to switch device');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Checking camera and microphone...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">
          Camera Access Required
        </h3>
        <p className="text-slate-400 mb-4">{error}</p>
        <p className="text-slate-500 text-sm mb-4">
          Please allow camera and microphone access to start streaming.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary-500" />
        Pre-Stream Setup
      </h3>

      {/* Video preview */}
      <div className="mb-6">
        <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Device selection */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Camera
          </label>
          <select
            value={selectedVideo}
            onChange={(e) => handleDeviceChange('video', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Microphone
          </label>
          <select
            value={selectedAudio}
            onChange={(e) => handleDeviceChange('audio', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={() => {
            // Stop preview stream before going live
            if (stream) {
              stream.getTracks().forEach((track) => track.stop());
            }
            onReady();
          }}
          className="flex-1 bg-accent-500 hover:bg-accent-600"
        >
          <Video className="h-4 w-4 mr-2" />
          Go Live
        </Button>
      </div>
    </div>
  );
}
