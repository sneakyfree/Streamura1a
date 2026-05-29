import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, Clock, Eye, Calendar, ArrowLeft, Share2, Trash2, Edit, Lock, Globe } from 'lucide-react';
import { recordingApi, type Recording } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function RecordingPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const { user } = useAuthStore();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!recordingId) return;

    const fetchRecording = async () => {
      try {
        setLoading(true);
        const data = await recordingApi.get(parseInt(recordingId));
        setRecording(data);
      } catch (err) {
        setError('Failed to load recording');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecording();
  }, [recordingId]);

  const handleDelete = async () => {
    if (!recording || !window.confirm('Are you sure you want to delete this recording?')) return;

    try {
      setIsDeleting(true);
      await recordingApi.delete(recording.id);
      window.location.href = '/profile';
    } catch (err) {
      console.error('Failed to delete recording:', err);
      alert('Failed to delete recording');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="sr-only">Loading recording</h1>
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="aspect-video w-full mb-6 rounded-lg" />
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            {error || 'Recording not found'}
          </h1>
          <Link to="/">
            <Button variant="secondary">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user && recording.stream_id && user.id === recording.stream_id;
  const isReady = recording.status === 'ready';
  const isProcessing = recording.status === 'processing';

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          to="/profile"
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Profile
        </Link>

        {/* Video Player */}
        <Card className="mb-6 overflow-hidden">
          <div className="aspect-video bg-slate-800 relative">
            {isReady && recording.url ? (
              <video
                src={recording.url}
                controls
                className="w-full h-full"
                poster={recording.thumbnail_url || undefined}
              >
                Your browser does not support the video tag.
              </video>
            ) : isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4" />
                <p className="text-slate-400">Processing recording...</p>
                <p className="text-slate-500 text-sm">This may take a few minutes</p>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Play className="h-16 w-16 text-slate-600 mb-4" />
                <p className="text-slate-400">
                  {recording.status === 'failed' ? 'Recording failed' : 'Recording unavailable'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Recording Info */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-white">
                {recording.title || 'Untitled Recording'}
              </h1>
              {!recording.is_public && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                  <Lock className="h-3 w-3" />
                  Private
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {recording.view_count.toLocaleString()} views
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(recording.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(recording.created_at)}
              </span>
              <span className="flex items-center gap-1">
                {recording.is_public ? (
                  <>
                    <Globe className="h-4 w-4" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Private
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            {isOwner && (
              <>
                <Button variant="secondary" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {recording.description && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-white">Description</h2>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 whitespace-pre-wrap">{recording.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Status Badge for non-ready recordings */}
        {!isReady && (
          <Card className={`${
            recording.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
            recording.status === 'processing' ? 'border-yellow-500/30 bg-yellow-500/5' :
            'border-slate-700'
          }`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${
                  recording.status === 'failed' ? 'bg-red-500' :
                  recording.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                  recording.status === 'recording' ? 'bg-green-500 animate-pulse' :
                  'bg-slate-500'
                }`} />
                <span className="text-slate-300 capitalize">{recording.status}</span>
                {recording.status === 'processing' && (
                  <span className="text-slate-500 text-sm">- Please check back later</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
