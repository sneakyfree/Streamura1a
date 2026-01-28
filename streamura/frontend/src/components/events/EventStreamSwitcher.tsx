import { useState, useRef, useCallback } from 'react';
import {
  Users,
  Radio,
  ChevronLeft,
  ChevronRight,
  PictureInPicture2,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  TrendingUp
} from 'lucide-react';
import { StreamPlayer } from '../stream/StreamPlayer';
import { VelocityBadge } from './VelocityIndicator';
import type { Stream } from '@/types';

interface EventStreamSwitcherProps {
  streams: Stream[];
  primaryStream?: Stream | null;
  eventTitle: string;
  onStreamChange?: (stream: Stream) => void;
}

export function EventStreamSwitcher({
  streams,
  primaryStream,
  eventTitle,
  onStreamChange,
}: EventStreamSwitcherProps) {
  const [selectedStream, setSelectedStream] = useState<Stream | null>(
    primaryStream || streams[0] || null
  );
  const [thumbnailOffset, setThumbnailOffset] = useState(0);
  const [pipStream, setPipStream] = useState<Stream | null>(null);
  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const pipRef = useRef<HTMLDivElement>(null);

  const liveStreams = streams.filter((s) => s.status === 'live');
  const visibleThumbnails = 4;
  const maxOffset = Math.max(0, liveStreams.length - visibleThumbnails);

  const handlePrevious = () => {
    setThumbnailOffset(Math.max(0, thumbnailOffset - 1));
  };

  const handleNext = () => {
    setThumbnailOffset(Math.min(maxOffset, thumbnailOffset + 1));
  };

  // Smooth stream transition
  const handleStreamSelect = useCallback((stream: Stream) => {
    if (stream.id === selectedStream?.id) return;

    setIsTransitioning(true);

    setTimeout(() => {
      setSelectedStream(stream);
      onStreamChange?.(stream);
      setIsTransitioning(false);
    }, 300);
  }, [selectedStream, onStreamChange]);

  // Toggle PiP for a stream
  const togglePip = useCallback((stream: Stream) => {
    if (pipStream?.id === stream.id) {
      setPipStream(null);
    } else {
      setPipStream(stream);
    }
  }, [pipStream]);

  // PiP drag handling
  const handlePipDrag = useCallback((e: React.DragEvent) => {
    if (pipRef.current) {
      const container = pipRef.current.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        setPipPosition({
          x: Math.max(0, Math.min(e.clientX - rect.left - 120, rect.width - 240)),
          y: Math.max(0, Math.min(e.clientY - rect.top - 67, rect.height - 135))
        });
      }
    }
  }, []);

  if (!selectedStream) {
    return (
      <div className="aspect-video bg-slate-800 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <Radio className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No live streams available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Player Container */}
      <div className="relative">
        {/* Main Player with transition effect */}
        <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
          {audioOnlyMode ? (
            // Audio-only mode
            <div className="aspect-video bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <Volume2 className="h-12 w-12 text-purple-400 animate-pulse" />
                </div>
                <p className="text-white font-medium text-lg">
                  {selectedStream.title || 'Untitled Stream'}
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Audio Only Mode - {selectedStream.location_name}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-300">
                  <Users className="h-4 w-4" />
                  <span>{selectedStream.viewer_count.toLocaleString()} viewers</span>
                </div>
              </div>
              {/* Hidden audio player would go here */}
            </div>
          ) : (
            <StreamPlayer stream={selectedStream} autoPlay />
          )}
        </div>

        {/* Stream Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-auto">
            <p className="text-white font-medium text-sm">
              {selectedStream.title || 'Untitled Stream'}
            </p>
            <p className="text-slate-300 text-xs">
              {selectedStream.location_name || 'Unknown location'}
            </p>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Velocity indicator */}
            {(selectedStream as unknown as { velocity?: number }).velocity && (
              <VelocityBadge velocity={(selectedStream as unknown as { velocity?: number }).velocity || 0} />
            )}

            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">
                {selectedStream.viewer_count.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Control buttons */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Audio only toggle */}
          <button
            onClick={() => setAudioOnlyMode(!audioOnlyMode)}
            className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${audioOnlyMode
              ? 'bg-purple-500/80 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
              }`}
            title="Audio Only Mode"
          >
            <Volume2 className="h-4 w-4" />
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${isMuted
              ? 'bg-red-500/80 text-white'
              : 'bg-black/50 text-white hover:bg-black/70'
              }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* PiP button */}
          <button
            onClick={() => togglePip(selectedStream)}
            className="p-2 bg-black/50 text-white rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
            title="Picture-in-Picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="p-2 bg-black/50 text-white rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* Picture-in-Picture overlay */}
        {pipStream && pipStream.id !== selectedStream.id && (
          <div
            ref={pipRef}
            draggable
            onDragEnd={handlePipDrag}
            className="absolute w-60 aspect-video bg-slate-900 rounded-lg overflow-hidden border-2 border-white/20 shadow-2xl cursor-move z-20"
            style={{ right: pipPosition.x, bottom: pipPosition.y }}
          >
            <StreamPlayer stream={pipStream} autoPlay />

            {/* PiP controls */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors group">
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    handleStreamSelect(pipStream);
                    setPipStream(selectedStream);
                  }}
                  className="p-1 bg-black/50 text-white rounded"
                  title="Switch to main"
                >
                  <Maximize2 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setPipStream(null)}
                  className="p-1 bg-black/50 text-white rounded"
                  title="Close PiP"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* PiP stream info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="flex items-center justify-between text-xs text-white">
                  <span className="truncate">{pipStream.title}</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {pipStream.viewer_count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stream Thumbnails */}
      {liveStreams.length > 1 && (
        <div className="relative">
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            {thumbnailOffset > 0 && (
              <button
                onClick={handlePrevious}
                className="flex-shrink-0 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
            )}

            {/* Thumbnails */}
            <div className="flex-1 overflow-hidden">
              <div
                className="flex gap-3 transition-transform duration-300"
                style={{
                  transform: `translateX(-${thumbnailOffset * (100 / visibleThumbnails)}%)`,
                }}
              >
                {liveStreams.map((stream) => {
                  const streamVelocity = (stream as unknown as { velocity?: number }).velocity || 0;
                  const isTrending = streamVelocity > 10;

                  return (
                    <button
                      key={stream.id}
                      onClick={() => handleStreamSelect(stream)}
                      className={`flex-shrink-0 w-1/4 rounded-lg overflow-hidden border-2 transition-all ${selectedStream?.id === stream.id
                        ? 'border-primary-500 ring-2 ring-primary-500/30'
                        : 'border-transparent hover:border-slate-600'
                        }`}
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
                            <Radio className="h-6 w-6 text-slate-600" />
                          </div>
                        )}

                        {/* Live indicator */}
                        <div className="absolute top-1 left-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />

                        {/* Trending indicator */}
                        {isTrending && (
                          <div className="absolute top-1 right-1 bg-orange-500/90 text-white text-xs px-1 py-0.5 rounded flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" />
                          </div>
                        )}

                        {/* Viewer count */}
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {stream.viewer_count.toLocaleString()}
                        </div>

                        {/* PiP indicator */}
                        {pipStream?.id === stream.id && (
                          <div className="absolute top-1 right-1 bg-purple-500/90 text-white text-xs px-1 py-0.5 rounded">
                            PiP
                          </div>
                        )}

                        {/* Selected overlay */}
                        {selectedStream?.id === stream.id && (
                          <div className="absolute inset-0 bg-primary-500/20" />
                        )}

                        {/* Hover actions */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors group flex items-center justify-center">
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePip(stream);
                              }}
                              className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30"
                              title="Picture-in-Picture"
                            >
                              <PictureInPicture2 className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Next Button */}
            {thumbnailOffset < maxOffset && (
              <button
                onClick={handleNext}
                className="flex-shrink-0 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
            )}
          </div>

          {/* Stream Count and Quick Stats */}
          <div className="flex items-center justify-between mt-3">
            <div className="text-slate-400 text-sm">
              {liveStreams.length} live streams from {eventTitle}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <Users className="h-3 w-3" />
                {liveStreams.reduce((sum, s) => sum + s.viewer_count, 0).toLocaleString()} total
              </span>
              {liveStreams.some(s => (s as unknown as { velocity?: number }).velocity ?? 0 > 10) && (
                <span className="flex items-center gap-1 text-orange-400">
                  <TrendingUp className="h-3 w-3" />
                  Trending
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

