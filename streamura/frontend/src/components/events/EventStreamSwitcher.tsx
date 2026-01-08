import { useState } from 'react';
import { Users, Radio, ChevronLeft, ChevronRight } from 'lucide-react';
import { StreamPlayer } from '../stream/StreamPlayer';
import type { Stream } from '@/types';

interface EventStreamSwitcherProps {
  streams: Stream[];
  primaryStream?: Stream | null;
  eventTitle: string;
}

export function EventStreamSwitcher({
  streams,
  primaryStream,
  eventTitle,
}: EventStreamSwitcherProps) {
  const [selectedStream, setSelectedStream] = useState<Stream | null>(
    primaryStream || streams[0] || null
  );
  const [thumbnailOffset, setThumbnailOffset] = useState(0);

  const liveStreams = streams.filter((s) => s.status === 'live');
  const visibleThumbnails = 4;
  const maxOffset = Math.max(0, liveStreams.length - visibleThumbnails);

  const handlePrevious = () => {
    setThumbnailOffset(Math.max(0, thumbnailOffset - 1));
  };

  const handleNext = () => {
    setThumbnailOffset(Math.min(maxOffset, thumbnailOffset + 1));
  };

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
      {/* Main Player */}
      <div className="relative">
        <StreamPlayer stream={selectedStream} autoPlay />

        {/* Stream Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
            <p className="text-white font-medium text-sm">
              {selectedStream.title || 'Untitled Stream'}
            </p>
            <p className="text-slate-300 text-xs">
              {selectedStream.location_name || 'Unknown location'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">
                {selectedStream.viewer_count.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
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
                {liveStreams.map((stream) => (
                  <button
                    key={stream.id}
                    onClick={() => setSelectedStream(stream)}
                    className={`flex-shrink-0 w-1/4 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedStream?.id === stream.id
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

                      {/* Viewer count */}
                      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {stream.viewer_count.toLocaleString()}
                      </div>

                      {/* Selected overlay */}
                      {selectedStream?.id === stream.id && (
                        <div className="absolute inset-0 bg-primary-500/20" />
                      )}
                    </div>
                  </button>
                ))}
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

          {/* Stream Count */}
          <div className="text-center mt-3 text-slate-400 text-sm">
            {liveStreams.length} live streams from {eventTitle}
          </div>
        </div>
      )}
    </div>
  );
}
