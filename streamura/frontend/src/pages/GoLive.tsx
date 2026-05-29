import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Video, MapPin, DollarSign, Globe, Lock, Tag, Loader2 } from 'lucide-react';
import { streamApi, stripeApi, type StripeAccountStatus } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { BroadcastView, BroadcastSetup } from '@/components/stream/BroadcastView';
import { StripeOnboarding } from '@/components/payments';
import { OptimalTimeWidget } from '@/components/analytics';
import { predictionsApi } from '@/lib/api';
import type { StreamCreate, Stream } from '@/types';

const CATEGORIES = [
  { value: 'music', label: 'Music & Concerts' },
  { value: 'sports', label: 'Sports' },
  { value: 'news', label: 'News & Politics' },
  { value: 'festival', label: 'Festivals' },
  { value: 'conference', label: 'Conferences' },
  { value: 'other', label: 'Other' },
];

type PageState = 'form' | 'setup' | 'live' | 'ended';

export function GoLivePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>('form');
  const [createdStream, setCreatedStream] = useState<Stream | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [formData, setFormData] = useState<StreamCreate>({
    title: '',
    description: '',
    is_public: true,
    is_monetized: false,
    location_name: '',
    category: 'other',
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [useLocation, setUseLocation] = useState(false);
  const [optimalTimes, setOptimalTimes] = useState<any[]>([]);
  const [optimalTimesLoading, setOptimalTimesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Check Stripe account status
  useEffect(() => {
    const checkStripeStatus = async () => {
      try {
        const status = await stripeApi.getAccountStatus();
        setStripeStatus(status);
      } catch {
        // User may not have a Stripe account yet
      } finally {
        setStripeLoading(false);
      }
    };

    if (isAuthenticated) {
      checkStripeStatus();
    }
  }, [isAuthenticated]);

  // Fetch optimal streaming times
  useEffect(() => {
    const fetchOptimalTimes = async () => {
      setOptimalTimesLoading(true);
      try {
        const times = await predictionsApi.getOptimalTimes(selectedCategory || undefined, 10);
        setOptimalTimes(times);
      } catch (error) {
        console.error('Failed to fetch optimal times:', error);
        setOptimalTimes([]);
      } finally {
        setOptimalTimesLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchOptimalTimes();
    }
  }, [isAuthenticated, selectedCategory]);

  // Sync category selection with form data
  useEffect(() => {
    if (formData.category && formData.category !== 'other') {
      setSelectedCategory(formData.category);
    }
  }, [formData.category]);

  const canMonetize = stripeStatus?.onboarding_complete && stripeStatus?.payouts_enabled;

  const createStreamMutation = useMutation({
    mutationFn: (data: StreamCreate) => streamApi.create(data),
    onSuccess: (stream) => {
      setCreatedStream(stream);
      setPageState('setup');
    },
  });

  const endStreamMutation = useMutation({
    mutationFn: (streamId: number) => streamApi.end(streamId),
    onSuccess: () => {
      setPageState('ended');
    },
  });

  const handleChange = (field: keyof StreamCreate) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = e.target.type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags && formData.tags.length < 5) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim().toLowerCase()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setUseLocation(true);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createStreamMutation.mutate(formData);
  };

  const handleStartBroadcast = () => {
    setPageState('live');
  };

  const handleEndStream = async () => {
    if (createdStream) {
      endStreamMutation.mutate(createdStream.id);
    }
  };

  const handleCancelSetup = () => {
    setPageState('form');
    setCreatedStream(null);
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md" variant="elevated">
          <CardContent className="py-8 text-center">
            <Video className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Sign in to Go Live</h1>
            <p className="text-slate-400 mb-6">
              You need to be logged in to start streaming.
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/login">
                <Button>Sign In</Button>
              </Link>
              <Link to="/register">
                <Button variant="secondary">Create Account</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pre-broadcast setup (camera/mic check)
  if (pageState === 'setup' && createdStream) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <BroadcastSetup
              onReady={handleStartBroadcast}
              onCancel={handleCancelSetup}
            />
          </Card>
        </div>
      </div>
    );
  }

  // Live broadcasting
  if (pageState === 'live' && createdStream) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-white truncate max-w-md">
                {createdStream.title || 'Untitled Stream'}
              </h1>
              {createdStream.category && (
                <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-sm">
                  {createdStream.category}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400">
              Streaming as <span className="text-white">{user?.username}</span>
            </div>
          </div>

          {/* Broadcast view */}
          <div className="flex-1">
            <BroadcastView
              streamId={createdStream.id}
              onStreamEnd={handleEndStream}
            />
          </div>
        </div>
      </div>
    );
  }

  // Stream ended
  if (pageState === 'ended') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md" variant="elevated">
          <CardContent className="py-8 text-center">
            <Video className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Stream Ended</h2>
            <p className="text-slate-400 mb-6">
              Your stream has ended successfully. Thanks for broadcasting!
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={() => {
                  setPageState('form');
                  setCreatedStream(null);
                }}
              >
                Start New Stream
              </Button>
              <Link to="/profile">
                <Button>View Profile</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Stream creation form
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Go Live</h1>
          <p className="text-slate-400">
            Set up your stream and start broadcasting to the world
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Stream Details */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary-500" />
                  Stream Details
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  id="title"
                  label="Stream Title"
                  placeholder="What are you streaming?"
                  value={formData.title || ''}
                  onChange={handleChange('title')}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    placeholder="Tell viewers what this stream is about..."
                    value={formData.description || ''}
                    onChange={handleChange('description')}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || 'other'}
                    onChange={handleChange('category')}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary-500" />
                  Location
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  id="location_name"
                  label="Location Name"
                  placeholder="e.g., Madison Square Garden, NYC"
                  value={formData.location_name || ''}
                  onChange={handleChange('location_name')}
                />

                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGetLocation}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Use My Location
                  </Button>
                  {useLocation && formData.latitude && (
                    <span className="text-sm text-green-400">
                      Location captured
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visibility & Monetization */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary-500" />
                  Visibility & Monetization
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    {formData.is_public ? (
                      <Globe className="h-5 w-5 text-green-400" />
                    ) : (
                      <Lock className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <p className="text-white font-medium">
                        {formData.is_public ? 'Public Stream' : 'Private Stream'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        {formData.is_public
                          ? 'Anyone can discover and watch'
                          : 'Only people with the link can watch'}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_public}
                      onChange={handleChange('is_public')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className={`h-5 w-5 ${formData.is_monetized ? 'text-green-400' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-white font-medium">Monetization</p>
                      <p className="text-slate-400 text-sm">
                        {formData.is_monetized
                          ? 'Earn money from ads and tips'
                          : 'Enable to earn from your stream'}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_monetized}
                      onChange={(e) => {
                        // Only allow enabling monetization if Stripe is set up
                        if (e.target.checked && !canMonetize) {
                          return; // Don't enable
                        }
                        handleChange('is_monetized')(e);
                      }}
                      disabled={!canMonetize && !formData.is_monetized}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 ${!canMonetize ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>

                {/* Stripe Setup Warning */}
                {!stripeLoading && !canMonetize && (
                  <StripeOnboarding variant="banner" />
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary-500" />
                  Tags
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
                {formData.tags && formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-slate-400 hover:text-white"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-slate-500 text-xs mt-2">
                  Add up to 5 tags to help viewers find your stream
                </p>
              </CardContent>
            </Card>

            {/* Optimal Times Widget */}
            <OptimalTimeWidget
              optimalTimes={optimalTimes}
              isLoading={optimalTimesLoading}
              category={selectedCategory || undefined}
              onCategoryChange={(cat) => setSelectedCategory(cat)}
              className="bg-slate-800/50"
            />

            {/* Submit */}
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-sm">
                Streaming as <span className="text-white">{user?.username}</span>
              </p>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createStreamMutation.isPending}
                  className="bg-accent-500 hover:bg-accent-600"
                >
                  {createStreamMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-2" />
                      Continue
                    </>
                  )}
                </Button>
              </div>
            </div>

            {createStreamMutation.isError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400">
                  Failed to create stream. Please try again.
                </p>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
