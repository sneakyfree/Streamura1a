import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { Token, User, UserCreate, Stream, StreamCreate, Event, EventCreate, Notification } from '@/types';

const API_BASE_URL = '/api/v1';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest) {
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post<Token>(`${API_BASE_URL}/auth/refresh`, null, {
            params: { refresh_token: refreshToken },
          });

          localStorage.setItem('access_token', response.data.access_token);
          originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;

          return api(originalRequest);
        } catch {
          // Refresh failed, clear tokens
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }

    // Surface the backend's human-readable error instead of the opaque
    // "Request failed with status code 4xx" that axios puts on error.message.
    // FastAPI returns either {detail: "msg"} or {detail: [{msg, loc}, ...]} for
    // validation errors — normalise both into error.message so UI code that
    // shows error.message (login, forms, toasts) displays something useful.
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      error.message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      error.message = detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? (d as { msg: string }).msg : String(d)))
        .join(', ');
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (identifier: string, password: string): Promise<Token> => {
    const formData = new URLSearchParams();
    formData.append('username', identifier);
    formData.append('password', password);

    const response = await api.post<Token>('/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  register: async (data: UserCreate): Promise<User> => {
    const response = await api.post<User>('/auth/register', data);
    return response.data;
  },

  createAnonymous: async (): Promise<User> => {
    const response = await api.post<User>('/auth/anonymous');
    return response.data;
  },

  migrateAnonymous: async (anonymousUserId: number, data: UserCreate): Promise<User> => {
    const response = await api.post<User>(`/auth/migrate/${anonymousUserId}`, data);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<Token> => {
    const response = await api.post<Token>('/auth/refresh', null, {
      params: { refresh_token: refreshToken },
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },
};

// Stream API
export const streamApi = {
  create: async (data: StreamCreate): Promise<Stream> => {
    const response = await api.post<Stream>('/streams', data);
    return response.data;
  },

  get: async (streamId: number): Promise<Stream> => {
    const response = await api.get<Stream>(`/streams/${streamId}`);
    return response.data;
  },

  start: async (streamId: number): Promise<{ message: string; status: string }> => {
    const response = await api.post(`/streams/${streamId}/start`);
    return response.data;
  },

  end: async (streamId: number): Promise<{ message: string; status: string }> => {
    const response = await api.post(`/streams/${streamId}/end`);
    return response.data;
  },
};

// Event Detail Response type
interface EventDetailResponse extends Event {
  streams: Stream[];
  primary_stream: Stream | null;
}

// Event List Response type
interface EventListResponse {
  events: Event[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Discovery Feed Response type
interface DiscoveryFeedResponse {
  featured_events: Event[];
  trending_events: Event[];
  nearby_events: Event[];
  live_streams: Stream[];
  categories: { name: string; count: number }[];
}

// Category type
interface Category {
  name: string;
  event_count: number;
  total_viewers: number;
}

// Event API
export const eventApi = {
  create: async (data: EventCreate): Promise<Event> => {
    const response = await api.post<Event>('/events', data);
    return response.data;
  },

  get: async (eventId: number): Promise<EventDetailResponse> => {
    const response = await api.get<EventDetailResponse>(`/events/${eventId}`);
    return response.data;
  },

  getList: async (params: {
    status?: string;
    category?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<EventListResponse> => {
    const response = await api.get<EventListResponse>('/events', { params });
    return response.data;
  },

  getStreams: async (eventId: number, params: {
    status?: string;
    sort_by?: string;
    limit?: number;
  } = {}): Promise<Stream[]> => {
    const response = await api.get<Stream[]>(`/events/${eventId}/streams`, { params });
    return response.data;
  },

  addStream: async (eventId: number, streamId: number): Promise<{ message: string; event_id: number }> => {
    const response = await api.post(`/events/${eventId}/add-stream`, null, {
      params: { stream_id: streamId },
    });
    return response.data;
  },

  removeStream: async (eventId: number, streamId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/events/${eventId}/remove-stream/${streamId}`);
    return response.data;
  },

  update: async (eventId: number, data: Partial<Event>): Promise<Event> => {
    const response = await api.put<Event>(`/events/${eventId}`, data);
    return response.data;
  },

  getTrending: async (params: {
    limit?: number;
    category?: string;
    time_window?: string;
  } = {}): Promise<Event[]> => {
    const response = await api.get<Event[]>('/events/trending', { params });
    return response.data;
  },

  getFeatured: async (limit: number = 5): Promise<Event[]> => {
    const response = await api.get<Event[]>('/events/featured', { params: { limit } });
    return response.data;
  },

  getNearby: async (params: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    limit?: number;
  }): Promise<Event[]> => {
    const response = await api.get<Event[]>('/events/nearby', { params });
    return response.data;
  },
};

// Discovery API
export const discoveryApi = {
  getFeed: async (params: {
    latitude?: number;
    longitude?: number;
  } = {}): Promise<DiscoveryFeedResponse> => {
    const response = await api.get<DiscoveryFeedResponse>('/discover', { params });
    return response.data;
  },

  search: async (params: {
    q: string;
    type?: 'all' | 'streams' | 'events' | 'users';
    limit?: number;
  }): Promise<{
    streams: Stream[];
    events: Event[];
    users: User[];
  }> => {
    const response = await api.get('/discover/search', { params });
    return response.data;
  },

  getCategories: async (): Promise<Category[]> => {
    const response = await api.get<Category[]>('/discover/categories');
    return response.data;
  },

  getCategoryEvents: async (category: string, limit: number = 20): Promise<Event[]> => {
    const response = await api.get<Event[]>(`/discover/categories/${category}`, {
      params: { limit },
    });
    return response.data;
  },
};

// Transform backend notification to frontend format
function transformNotification(n: Record<string, unknown>): Notification {
  return {
    id: n.id as number,
    user_id: n.user_id as number | undefined,
    event_id: n.event_id as number | null | undefined,
    stream_id: n.stream_id as number | null | undefined,
    from_user_id: n.from_user_id as number | null | undefined,
    transaction_id: n.transaction_id as number | null | undefined,
    type: (n.notification_type || n.type || 'system') as Notification['type'],
    notification_type: n.notification_type as Notification['type'] | undefined,
    title: (n.title || '') as string,
    message: (n.message || '') as string,
    read: Boolean(n.is_read ?? n.read ?? false),
    is_read: n.is_read as boolean | undefined,
    is_pushed: n.is_pushed as boolean | undefined,
    data: (n.extra_data || n.data || null) as Record<string, unknown> | null,
    extra_data: n.extra_data as Record<string, unknown> | null | undefined,
    created_at: (n.created_at || new Date().toISOString()) as string,
    read_at: n.read_at as string | null | undefined,
  };
}

// Notification API
export const notificationApi = {
  getAll: async (): Promise<Notification[]> => {
    const response = await api.get<Record<string, unknown>[]>('/notifications');
    return response.data.map(transformNotification);
  },

  markAsRead: async (notificationId: number): Promise<{ message: string }> => {
    const response = await api.post(`/notifications/${notificationId}/read`);
    return response.data;
  },
};

// Payment Types
export interface StripeAccountStatus {
  account_id: string | null;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export interface WalletBalance {
  balance: number;
  pending_payout: number;
  lifetime_earnings: number;
  stripe_connected: boolean;
  onboarding_complete: boolean;
  payout_enabled: boolean;
}

export interface TipRequest {
  stream_id: number;
  amount: number;
  message?: string;
  currency?: string;
}

export interface TipResponse {
  status: string;
  payment_intent_id: string;
  client_secret: string;
  amount: number;
  creator_amount: number;
  platform_fee: number;
}

export interface Tip {
  id: number;
  amount: number;
  message: string | null;
  created_at: string;
  from_username: string | null;
}

export interface Transaction {
  id: number;
  transaction_type: string;
  amount: number;
  fee: number | null;
  net_amount: number | null;
  status: string;
  description: string | null;
  created_at: string;
}

export interface PayoutRequest {
  amount: number;
  currency?: string;
}

export interface PayoutResponse {
  status: string;
  payout_id: string;
  amount: number;
  estimated_arrival: number;
}

// Stripe Connect API
export const stripeApi = {
  createConnectAccount: async (): Promise<{
    status: string;
    account_id: string;
    message: string;
  }> => {
    const response = await api.post('/stripe/connect/account');
    return response.data;
  },

  getOnboardingLink: async (returnUrl: string, refreshUrl: string): Promise<{
    onboarding_url: string;
  }> => {
    const response = await api.get('/stripe/connect/onboarding', {
      params: { return_url: returnUrl, refresh_url: refreshUrl },
    });
    return response.data;
  },

  getAccountStatus: async (): Promise<StripeAccountStatus> => {
    const response = await api.get<StripeAccountStatus>('/stripe/connect/status');
    return response.data;
  },
};

// Tip API
export const tipApi = {
  sendTip: async (data: TipRequest): Promise<TipResponse> => {
    const response = await api.post<TipResponse>('/tips', data);
    return response.data;
  },

  getStreamTips: async (streamId: number, limit: number = 50): Promise<Tip[]> => {
    const response = await api.get<Tip[]>(`/tips/stream/${streamId}`, {
      params: { limit },
    });
    return response.data;
  },
};

// Payout API
export const payoutApi = {
  getEarnings: async (): Promise<{
    total_earned: number;
    available_balance: number;
    pending_balance: number;
    stripe_connected: boolean;
    stripe_onboarding_url: string | null;
  }> => {
    const response = await api.get('/payouts/earnings');
    return response.data;
  },

  getHistory: async (limit: number = 20, offset: number = 0): Promise<{
    id: number;
    amount: number;
    status: string;
    created_at: string;
  }[]> => {
    const response = await api.get('/payouts/history', { params: { limit, offset } });
    return response.data;
  },

  requestPayout: async (data: PayoutRequest): Promise<PayoutResponse> => {
    const response = await api.post<PayoutResponse>('/payouts', data);
    return response.data;
  },

  requestInstantPayout: async (data: PayoutRequest): Promise<PayoutResponse & { fee_amount: number }> => {
    const response = await api.post<PayoutResponse & { fee_amount: number }>('/payouts/instant', data);
    return response.data;
  },
};

// Transaction API
export const transactionApi = {
  getAll: async (limit: number = 50, offset: number = 0): Promise<Transaction[]> => {
    const response = await api.get<Transaction[]>('/transactions', {
      params: { limit, offset },
    });
    return response.data;
  },
};

// Wallet API
export const walletApi = {
  getBalance: async (): Promise<WalletBalance> => {
    const response = await api.get<WalletBalance>('/wallet/balance');
    return response.data;
  },
};

// Chat Types
export interface ChatMessage {
  id: number;
  stream_id: number;
  user_id: number | null;
  content: string;
  is_deleted: boolean;
  is_highlighted: boolean;
  tip_amount: number | null;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
}

// Chat API
export const chatApi = {
  getHistory: async (streamId: number, limit: number = 50, beforeId?: number): Promise<ChatMessage[]> => {
    const response = await api.get<ChatMessage[]>(`/streams/${streamId}/chat`, {
      params: { limit, before_id: beforeId },
    });
    return response.data;
  },

  sendMessage: async (streamId: number, content: string): Promise<ChatMessage> => {
    const response = await api.post<ChatMessage>(`/streams/${streamId}/chat`, { content });
    return response.data;
  },

  deleteMessage: async (messageId: number, reason?: string): Promise<{ message: string }> => {
    const response = await api.delete(`/chat/${messageId}`, {
      params: reason ? { reason } : undefined,
    });
    return response.data;
  },
};

// Moderation API
export const moderationApi = {
  muteUser: async (streamId: number, userId: number, duration?: number, reason?: string): Promise<{ message: string }> => {
    const response = await api.post(`/streams/${streamId}/moderation/mute`, {
      user_id: userId,
      duration_seconds: duration,
      reason
    });
    return response.data;
  },

  unmuteUser: async (streamId: number, userId: number): Promise<{ message: string }> => {
    const response = await api.post(`/streams/${streamId}/moderation/unmute`, null, {
      params: { user_id: userId }
    });
    return response.data;
  },

  // Stream moderation settings
  getStreamSettings: async (streamId: number): Promise<StreamModerationSettings> => {
    const response = await api.get<StreamModerationSettings>(`/streams/${streamId}/moderation/settings`);
    return response.data;
  },

  updateStreamSettings: async (
    streamId: number,
    settings: Partial<StreamModerationSettings>
  ): Promise<StreamModerationSettings> => {
    const response = await api.put<StreamModerationSettings>(`/streams/${streamId}/moderation/settings`, settings);
    return response.data;
  },

  // Admin: Moderation queue
  getQueue: async (params: {
    status?: string;
    content_type?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ModerationQueueItem[]> => {
    const response = await api.get<ModerationQueueItem[]>('/admin/moderation/queue', { params });
    return response.data;
  },

  reviewQueueItem: async (
    itemId: number,
    action: 'approve' | 'reject',
    notes?: string,
    actionTaken?: string
  ): Promise<{ message: string }> => {
    const response = await api.post(`/admin/moderation/${itemId}/review`, null, {
      params: { action, notes, action_taken: actionTaken },
    });
    return response.data;
  },

  // Admin: Content filters
  getFilters: async (params: {
    filter_type?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<ContentFilter[]> => {
    const response = await api.get<ContentFilter[]>('/admin/content-filters', { params });
    return response.data;
  },

  createFilter: async (data: ContentFilterCreate): Promise<ContentFilter> => {
    const response = await api.post<ContentFilter>('/admin/content-filters', data);
    return response.data;
  },

  deleteFilter: async (filterId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/content-filters/${filterId}`);
    return response.data;
  },
};

// Social Types
export interface UserFollowInfo {
  id: number;
  username: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  followed_at: string;
}

export interface FollowersResponse {
  followers: UserFollowInfo[];
  total: number;
}

export interface FollowingResponse {
  following: UserFollowInfo[];
  total: number;
}

// Social API - Follow System
export const followApi = {
  follow: async (userId: number): Promise<{ message: string; following: boolean }> => {
    const response = await api.post(`/users/${userId}/follow`);
    return response.data;
  },

  unfollow: async (userId: number): Promise<{ message: string; following: boolean }> => {
    const response = await api.delete(`/users/${userId}/follow`);
    return response.data;
  },

  getFollowers: async (userId: number, limit: number = 50, offset: number = 0): Promise<FollowersResponse> => {
    const response = await api.get<FollowersResponse>(`/users/${userId}/followers`, {
      params: { limit, offset },
    });
    return response.data;
  },

  getFollowing: async (userId: number, limit: number = 50, offset: number = 0): Promise<FollowingResponse> => {
    const response = await api.get<FollowingResponse>(`/users/${userId}/following`, {
      params: { limit, offset },
    });
    return response.data;
  },

  isFollowing: async (userId: number): Promise<boolean> => {
    const response = await api.get<{ is_following: boolean }>(`/users/${userId}/is-following`);
    return response.data.is_following;
  },
};

// Social API - Like System
export const likeApi = {
  like: async (streamId: number): Promise<{ message: string; liked: boolean; like_count: number }> => {
    const response = await api.post(`/streams/${streamId}/like`);
    return response.data;
  },

  unlike: async (streamId: number): Promise<{ message: string; liked: boolean; like_count: number }> => {
    const response = await api.delete(`/streams/${streamId}/like`);
    return response.data;
  },

  isLiked: async (streamId: number): Promise<boolean> => {
    const response = await api.get<{ is_liked: boolean }>(`/streams/${streamId}/is-liked`);
    return response.data.is_liked;
  },
};

// Feed API
export const feedApi = {
  getFollowingFeed: async (limit: number = 20, offset: number = 0): Promise<Stream[]> => {
    const response = await api.get<Stream[]>('/feed/following', {
      params: { limit, offset },
    });
    return response.data;
  },
};

// Report Types
export interface ReportCreate {
  reported_user_id?: number;
  reported_stream_id?: number;
  reported_message_id?: number;
  reason: string;
  description?: string;
}

export interface Report {
  id: number;
  reporter_id: number;
  reported_user_id: number | null;
  reported_stream_id: number | null;
  reported_message_id: number | null;
  reason: string;
  description: string | null;
  status: string;
  priority: string;
  action_taken: string | null;
  created_at: string;
  resolved_at: string | null;
}

// Admin Types
export interface AdminUser {
  id: number;
  username: string | null;
  email: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_banned: boolean;
  is_admin: boolean;
  warning_count: number;
  trust_score: number;
  follower_count: number;
  created_at: string;
  last_login: string | null;
}

export interface ModerationAction {
  id: number;
  moderator: string | null;
  target_user: string | null;
  action_type: string;
  reason: string | null;
  duration: number | null;
  expires_at: string | null;
  created_at: string;
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    banned: number;
  };
  streams: {
    total: number;
    live: number;
  };
  events: {
    total: number;
    active: number;
  };
  reports: {
    pending: number;
    high_priority: number;
  };
}

// Report API
export const reportApi = {
  submit: async (data: ReportCreate): Promise<Report> => {
    const response = await api.post<Report>('/reports', data);
    return response.data;
  },

  getMine: async (): Promise<Report[]> => {
    const response = await api.get<Report[]>('/reports/mine');
    return response.data;
  },
};

// Ad Types
export interface Ad {
  id: string;
  title: string;
  description: string;
  image_url: string;
  cta_text: string;
  cta_url: string;
  duration: number;
  skip_after: number;
  priority: number;
}

export interface AdImpressionRequest {
  ad_network: string;
  ad_unit: string;
  impression_count: number;
  click_count: number;
  revenue: number;
}

// Ad API
export const adApi = {
  getActiveAds: async (limit: number = 5): Promise<Ad[]> => {
    const response = await api.get<Ad[]>('/ads/active', {
      params: { limit }
    });
    return response.data;
  },

  trackImpression: async (streamId: number, data: AdImpressionRequest): Promise<{ status: string }> => {
    const response = await api.post<{ status: string }>('/ads/impression', data, {
      params: { stream_id: streamId }
    });
    return response.data;
  }
};

// Admin API
export const adminApi = {
  // User management
  getUsers: async (params: {
    search?: string;
    is_banned?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<AdminUser[]> => {
    const response = await api.get<AdminUser[]>('/admin/users', { params });
    return response.data;
  },

  getUser: async (userId: number): Promise<AdminUser> => {
    const response = await api.get<AdminUser>(`/admin/users/${userId}`);
    return response.data;
  },

  banUser: async (userId: number, data: {
    action_type: string;
    reason?: string;
    duration?: number;
  }): Promise<{ message: string; ban_type: string; expires_at: string | null }> => {
    const response = await api.post(`/admin/users/${userId}/ban`, data);
    return response.data;
  },

  unbanUser: async (userId: number): Promise<{ message: string }> => {
    const response = await api.post(`/admin/users/${userId}/unban`);
    return response.data;
  },

  warnUser: async (userId: number, data: {
    action_type: string;
    reason?: string;
  }): Promise<{ message: string; warning_count: number; trust_score: number }> => {
    const response = await api.post(`/admin/users/${userId}/warn`, data);
    return response.data;
  },

  // Stream management
  getStreams: async (params: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Stream[]> => {
    const response = await api.get<Stream[]>('/admin/streams', { params });
    return response.data;
  },

  deleteStream: async (streamId: number, reason?: string): Promise<{ message: string }> => {
    const response = await api.delete(`/admin/streams/${streamId}`, {
      params: reason ? { reason } : undefined,
    });
    return response.data;
  },

  // Report management
  getReports: async (params: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Report[]> => {
    const response = await api.get<Report[]>('/admin/reports', { params });
    return response.data;
  },

  resolveReport: async (reportId: number, action_taken: string, resolution_notes?: string): Promise<{ message: string }> => {
    const response = await api.post(`/admin/reports/${reportId}/resolve`, null, {
      params: { action_taken, resolution_notes },
    });
    return response.data;
  },

  dismissReport: async (reportId: number, reason?: string): Promise<{ message: string }> => {
    const response = await api.post(`/admin/reports/${reportId}/dismiss`, null, {
      params: reason ? { reason } : undefined,
    });
    return response.data;
  },

  // Moderation log
  getModerationLog: async (params: {
    target_user_id?: number;
    moderator_id?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<ModerationAction[]> => {
    const response = await api.get<ModerationAction[]>('/admin/moderation-log', { params });
    return response.data;
  },

  // Stats
  getStats: async (): Promise<AdminStats> => {
    const response = await api.get<AdminStats>('/admin/stats');
    return response.data;
  },

  // System triggers
  triggerClustering: async (): Promise<{ status: string; result: unknown }> => {
    const response = await api.post('/admin/clustering/run');
    return response.data;
  },

  updateRankings: async (): Promise<{ status: string; result: unknown }> => {
    const response = await api.post('/admin/rankings/update');
    return response.data;
  },
};

// Recording Types
export interface Recording {
  id: number;
  stream_id: number;
  egress_id: string | null;
  title: string | null;
  description: string | null;
  url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  status: string;
  is_public: boolean;
  view_count: number;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface RecordingCreate {
  title?: string;
  is_public?: boolean;
}

export interface RecordingUpdate {
  title?: string;
  description?: string;
  is_public?: boolean;
}

// Recording API
export const recordingApi = {
  // Start recording a live stream
  startRecording: async (streamId: number, data?: RecordingCreate): Promise<{
    recording_id: number;
    egress_id: string;
    status: string;
    message: string;
  }> => {
    const response = await api.post(`/streams/${streamId}/recording/start`, data || {});
    return response.data;
  },

  // Stop recording
  stopRecording: async (streamId: number): Promise<{
    recording_id: number;
    status: string;
    message: string;
  }> => {
    const response = await api.post(`/streams/${streamId}/recording/stop`);
    return response.data;
  },

  // Get recordings for a stream
  getStreamRecordings: async (streamId: number): Promise<Recording[]> => {
    const response = await api.get<Recording[]>(`/streams/${streamId}/recordings`);
    return response.data;
  },

  // Get single recording
  get: async (recordingId: number): Promise<Recording> => {
    const response = await api.get<Recording>(`/recordings/${recordingId}`);
    return response.data;
  },

  // Delete recording
  delete: async (recordingId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/recordings/${recordingId}`);
    return response.data;
  },

  // Get user's recordings
  getUserRecordings: async (userId: number, page: number = 1, perPage: number = 20): Promise<Recording[]> => {
    const response = await api.get<Recording[]>(`/users/${userId}/recordings`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  },

  // Update recording metadata
  update: async (recordingId: number, data: RecordingUpdate): Promise<{
    message: string;
    recording: Recording;
  }> => {
    const response = await api.put(`/recordings/${recordingId}`, null, { params: data });
    return response.data;
  },
};

// Scheduled Stream Types
export interface ScheduledStream {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  tags: string[] | null;
  scheduled_start: string;
  scheduled_end: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  status: string;
  is_public: boolean;
  is_monetized: boolean;
  notify_followers: boolean;
  reminder_sent: boolean;
  stream_id: number | null;
  created_at: string;
}

export interface ScheduledStreamCreate {
  title: string;
  description?: string;
  scheduled_start: string;
  scheduled_end?: string;
  category?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
  location_name?: string;
  is_public?: boolean;
  is_monetized?: boolean;
  notify_followers?: boolean;
}

export interface ScheduledStreamUpdate {
  title?: string;
  description?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  category?: string;
  tags?: string[];
  is_public?: boolean;
  is_monetized?: boolean;
  notify_followers?: boolean;
}

// Scheduling API
export const scheduleApi = {
  // Schedule a new stream
  create: async (data: ScheduledStreamCreate): Promise<ScheduledStream> => {
    const response = await api.post<ScheduledStream>('/streams/schedule', data);
    return response.data;
  },

  // Get my scheduled streams
  getMine: async (status?: string): Promise<ScheduledStream[]> => {
    const response = await api.get<ScheduledStream[]>('/streams/scheduled', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  // Get a scheduled stream by ID
  get: async (scheduleId: number): Promise<ScheduledStream> => {
    const response = await api.get<ScheduledStream>(`/streams/schedule/${scheduleId}`);
    return response.data;
  },

  // Update a scheduled stream
  update: async (scheduleId: number, data: ScheduledStreamUpdate): Promise<ScheduledStream> => {
    const response = await api.put<ScheduledStream>(`/streams/schedule/${scheduleId}`, data);
    return response.data;
  },

  // Cancel a scheduled stream
  cancel: async (scheduleId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/streams/schedule/${scheduleId}`);
    return response.data;
  },

  // Get user's scheduled streams
  getUserScheduled: async (userId: number): Promise<ScheduledStream[]> => {
    const response = await api.get<ScheduledStream[]>(`/users/${userId}/scheduled`);
    return response.data;
  },

  // Get upcoming public streams
  getUpcoming: async (category?: string, limit: number = 20): Promise<ScheduledStream[]> => {
    const response = await api.get<ScheduledStream[]>('/discover/upcoming', {
      params: { category, limit },
    });
    return response.data;
  },

  // Go live from a scheduled stream
  goLive: async (scheduleId: number): Promise<{
    stream_id: number;
    scheduled_id: number;
    room_name: string;
    token: string;
    livekit_url: string;
  }> => {
    const response = await api.post(`/streams/schedule/${scheduleId}/go-live`);
    return response.data;
  },

  // Get calendar download URL for a scheduled stream
  getCalendarUrl: (scheduleId: number): string => {
    return `/api/v1/streams/schedule/${scheduleId}/calendar.ics`;
  },
};

// Analytics Types
export interface StreamAnalytics {
  stream_id: number;
  title: string | null;
  status: string;
  viewer_count: number;
  peak_viewers: number;
  total_watch_time: number;
  like_count: number;
  tip_count: number;
  earnings: number;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface CreatorOverview {
  total_streams: number;
  total_views: number;
  total_watch_time: number;
  total_earnings: number;
  total_tips: number;
  follower_count: number;
  following_count: number;
  total_likes: number;
  avg_viewers_per_stream: number;
}

export interface EarningsBreakdown {
  period: string;
  tips: number;
  ad_revenue: number;
  total: number;
  transaction_count: number;
  start_date: string | null;
  end_date: string;
}

export interface TopStream {
  stream_id: number;
  title: string | null;
  viewer_count: number;
  peak_viewers: number;
  earnings: number;
  like_count: number;
  tip_count: number;
  created_at: string;
}

export interface EngagementMetrics {
  period: string;
  start_date: string;
  end_date: string;
  streams_count: number;
  total_viewers: number;
  total_peak_viewers: number;
  new_followers: number;
  likes: number;
  chat_messages: number;
  avg_engagement_per_stream: number;
}

export interface ActivityItem {
  type: 'tip' | 'follow' | 'like';
  amount?: number;
  message?: string | null;
  from_user_id: number | null;
  from_username?: string | null;
  stream_id?: number;
  stream_title?: string | null;
  created_at: string;
}

// Moderation Types (Phase 9)
export interface StreamModerationSettings {
  id: number;
  stream_id: number;
  moderation_level: 'off' | 'relaxed' | 'standard' | 'strict';
  allow_links: boolean;
  slow_mode_seconds: number;
  subscriber_only: boolean;
  follower_only_minutes: number;
  blocked_words: string[] | null;
  blocked_users: number[] | null;
  auto_mod_caps_percent: number;
  auto_mod_emote_limit: number;
  auto_mod_repeat_limit: number;
  created_at: string;
  updated_at: string | null;
}

export interface ModerationQueueItem {
  id: number;
  content_type: string;
  content_id: number | null;
  content_text: string;
  user_id: number | null;
  stream_id: number | null;
  flagged_reason: string;
  flagged_patterns: string[] | null;
  confidence: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'auto_resolved';
  reviewed_by: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  action_taken: string | null;
  created_at: string;
  username?: string | null;
  stream_title?: string | null;
}

export interface ContentFilter {
  id: number;
  pattern: string;
  filter_type: 'keyword' | 'regex' | 'ml_category';
  action: 'block' | 'flag' | 'warn';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string | null;
  description: string | null;
  is_active: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface ContentFilterCreate {
  pattern: string;
  filter_type: 'keyword' | 'regex' | 'ml_category';
  action?: 'block' | 'flag' | 'warn';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  description?: string;
}

export interface ChatMute {
  id: number;
  user_id: number;
  stream_id: number | null;
  muted_by: number;
  reason: string | null;
  muted_until: string | null;
  is_active: boolean;
  created_at: string;
  username?: string | null;
}



// =========================================================================
// Subscription Types (Phase 10)
// =========================================================================

export interface SubscriptionTier {
  id: number;
  creator_id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: 'monthly' | 'yearly';
  benefits: string[];
  badge_url: string | null;
  emote_slots: number;
  max_subscribers: number | null;
  current_subscribers: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface SubscriptionTierCreate {
  name: string;
  price: number;
  description?: string;
  benefits?: string[];
  billing_period?: 'monthly' | 'yearly';
  currency?: string;
  max_subscribers?: number;
  badge_url?: string;
  emote_slots?: number;
}

export interface SubscriptionTierUpdate {
  name?: string;
  description?: string;
  price?: number;
  benefits?: string[];
  max_subscribers?: number;
  badge_url?: string;
  emote_slots?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface Subscription {
  id: number;
  subscriber_id: number;
  creator_id: number;
  tier_id: number;
  status: 'active' | 'canceled' | 'past_due' | 'paused';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  gift_from_user_id: number | null;
  created_at: string;
}

export interface SubscriberInfo {
  subscription_id: number;
  user_id: number;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier_id: number;
  subscribed_at: string | null;
  current_period_end: string | null;
}

export interface SubscriptionStatus {
  is_subscribed: boolean;
  meets_minimum_tier?: boolean;
  tier_id: number | null;
  tier_name: string | null;
  tier_price?: number;
  benefits?: string[];
  badge_url?: string | null;
  current_period_end?: string | null;
}

export interface SubscriberBenefits {
  has_subscription: boolean;
  tier_id: number | null;
  tier_name: string | null;
  benefits: string[];
  badge_url: string | null;
  emote_slots: number;
}

export interface GiftCode {
  code: string;
  tier_id: number;
  tier_name: string;
  months: number;
  expires_at: string | null;
}

export interface GiftCodeRedemption {
  success: boolean;
  tier_name: string;
  creator_id: number;
  months: number;
  expires_at: string;
}

// Subscription API
export const subscriptionApi = {
  // Subscription Tiers
  createTier: async (creatorId: number, data: SubscriptionTierCreate): Promise<SubscriptionTier> => {
    const response = await api.post<SubscriptionTier>(`/creators/${creatorId}/tiers`, data);
    return response.data;
  },

  getTiers: async (creatorId: number, includeInactive: boolean = false): Promise<SubscriptionTier[]> => {
    const response = await api.get<SubscriptionTier[]>(`/creators/${creatorId}/tiers`, {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  getTier: async (tierId: number): Promise<SubscriptionTier> => {
    const response = await api.get<SubscriptionTier>(`/tiers/${tierId}`);
    return response.data;
  },

  updateTier: async (tierId: number, data: SubscriptionTierUpdate): Promise<SubscriptionTier> => {
    const response = await api.put<SubscriptionTier>(`/tiers/${tierId}`, data);
    return response.data;
  },

  deleteTier: async (tierId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/tiers/${tierId}`);
    return response.data;
  },

  // Subscriptions
  createCheckout: async (tierId: number, successUrl: string, cancelUrl: string): Promise<{
    checkout_url: string;
    session_id: string;
  }> => {
    const response = await api.post('/subscriptions/checkout', {
      tier_id: tierId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return response.data;
  },

  getMySubscriptions: async (status?: string): Promise<Subscription[]> => {
    const response = await api.get<Subscription[]>('/subscriptions/mine', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  getMySubscribers: async (tierId?: number, limit: number = 50, offset: number = 0): Promise<{
    subscribers: SubscriberInfo[];
    total: number;
    limit: number;
    offset: number;
  }> => {
    const response = await api.get('/subscriptions/to-me', {
      params: { tier_id: tierId, limit, offset },
    });
    return response.data;
  },

  cancelSubscription: async (subscriptionId: number, immediately: boolean = false): Promise<{
    success: boolean;
    canceled_immediately: boolean;
    status: string;
    cancel_at_period_end: boolean;
  }> => {
    const response = await api.post(`/subscriptions/${subscriptionId}/cancel`, null, {
      params: { immediately },
    });
    return response.data;
  },

  isSubscribed: async (creatorId: number, minTierId?: number): Promise<SubscriptionStatus> => {
    const response = await api.get<SubscriptionStatus>(`/creators/${creatorId}/is-subscribed`, {
      params: minTierId ? { min_tier_id: minTierId } : undefined,
    });
    return response.data;
  },

  getBenefits: async (creatorId: number): Promise<SubscriberBenefits> => {
    const response = await api.get<SubscriberBenefits>(`/creators/${creatorId}/benefits`);
    return response.data;
  },

  // Gift Codes
  createGiftCode: async (tierId: number, months: number = 1, expiresDays?: number): Promise<GiftCode> => {
    const response = await api.post<GiftCode>(`/tiers/${tierId}/gift-codes`, null, {
      params: { months, expires_days: expiresDays },
    });
    return response.data;
  },

  redeemGiftCode: async (code: string): Promise<GiftCodeRedemption> => {
    const response = await api.post<GiftCodeRedemption>('/gift-codes/redeem', { code });
    return response.data;
  },
};

// =========================================================================
// Virtual Goods Types (Phase 10)
// =========================================================================

export interface VirtualGood {
  id: number;
  creator_id: number | null;
  name: string;
  description: string | null;
  type: 'badge' | 'emote' | 'effect' | 'sticker';
  price: number;
  currency: string;
  image_url: string | null;
  animation_url: string | null;
  is_limited: boolean;
  quantity_available: number | null;
  quantity_sold: number;
  is_active: boolean;
  tier_exclusive_id: number | null;
  created_at: string;
  // Enriched fields
  creator_username?: string | null;
  tier_name?: string | null;
}

export interface VirtualGoodCreate {
  name: string;
  type: 'badge' | 'emote' | 'effect' | 'sticker';
  price: number;
  description?: string;
  currency?: string;
  image_url?: string;
  animation_url?: string;
  is_limited?: boolean;
  quantity_available?: number;
  tier_exclusive_id?: number;
}

export interface VirtualGoodUpdate {
  name?: string;
  description?: string;
  price?: number;
  image_url?: string;
  animation_url?: string;
  is_limited?: boolean;
  quantity_available?: number;
  is_active?: boolean;
  tier_exclusive_id?: number;
}

export interface InventoryItem {
  id: number;
  user_id: number;
  good_id: number;
  quantity: number;
  is_equipped: boolean;
  gifted_from_user_id: number | null;
  purchased_at: string;
  // Enriched fields from VirtualGood
  good_name?: string;
  good_type?: string;
  good_image_url?: string | null;
  good_animation_url?: string | null;
}

export interface PurchaseResult {
  success: boolean;
  inventory_id: number;
  quantity: number;
  new_balance: number;
  message: string;
}

export interface GiftResult {
  success: boolean;
  inventory_id: number;
  recipient_id: number;
  message: string;
}

// Virtual Goods API
export const virtualGoodsApi = {
  // CRUD operations
  create: async (data: VirtualGoodCreate): Promise<VirtualGood> => {
    const response = await api.post<VirtualGood>('/virtual-goods', data);
    return response.data;
  },

  getAll: async (params: {
    type?: 'badge' | 'emote' | 'effect' | 'sticker';
    creator_id?: number;
    include_inactive?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<VirtualGood[]> => {
    const response = await api.get<VirtualGood[] | { goods: VirtualGood[] }>('/virtual-goods', { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.goods ?? []);
  },

  get: async (goodId: number): Promise<VirtualGood> => {
    const response = await api.get<VirtualGood>(`/virtual-goods/${goodId}`);
    return response.data;
  },

  update: async (goodId: number, data: VirtualGoodUpdate): Promise<VirtualGood> => {
    const response = await api.put<VirtualGood>(`/virtual-goods/${goodId}`, data);
    return response.data;
  },

  delete: async (goodId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/virtual-goods/${goodId}`);
    return response.data;
  },

  // Purchase and gift
  purchase: async (goodId: number, quantity: number = 1): Promise<PurchaseResult> => {
    const response = await api.post<PurchaseResult>(`/virtual-goods/${goodId}/purchase`, null, {
      params: { quantity },
    });
    return response.data;
  },

  gift: async (goodId: number, recipientId: number, quantity: number = 1): Promise<GiftResult> => {
    const response = await api.post<GiftResult>(`/virtual-goods/${goodId}/gift`, null, {
      params: { recipient_id: recipientId, quantity },
    });
    return response.data;
  },

  // Inventory
  getInventory: async (type?: string): Promise<InventoryItem[]> => {
    const response = await api.get<InventoryItem[]>('/inventory', {
      params: type ? { type } : undefined,
    });
    return response.data;
  },

  equipItem: async (inventoryId: number, equip: boolean = true): Promise<{
    success: boolean;
    is_equipped: boolean;
  }> => {
    const response = await api.post(`/inventory/${inventoryId}/equip`, null, {
      params: { equip },
    });
    return response.data;
  },

  getUserEquipped: async (userId: number, type?: string): Promise<InventoryItem[]> => {
    const response = await api.get<InventoryItem[]>(`/users/${userId}/equipped`, {
      params: type ? { type } : undefined,
    });
    return response.data;
  },
};

// Analytics API
export const analyticsApi = {
  // Get analytics for a specific stream
  getStreamAnalytics: async (streamId: number): Promise<StreamAnalytics> => {
    const response = await api.get<StreamAnalytics>(`/analytics/streams/${streamId}`);
    return response.data;
  },

  // Get creator overview (dashboard)
  getOverview: async (): Promise<CreatorOverview> => {
    const response = await api.get<CreatorOverview>('/analytics/overview');
    return response.data;
  },

  // Get earnings breakdown
  getEarnings: async (period: string = 'month'): Promise<EarningsBreakdown> => {
    const response = await api.get<EarningsBreakdown>('/analytics/earnings', {
      params: { period },
    });
    return response.data;
  },

  // Get top performing streams
  getTopStreams: async (sortBy: string = 'viewers', limit: number = 10): Promise<TopStream[]> => {
    const response = await api.get<TopStream[]>('/analytics/top-streams', {
      params: { sort_by: sortBy, limit },
    });
    return response.data;
  },

  // Get engagement metrics
  getEngagement: async (period: string = 'month'): Promise<EngagementMetrics> => {
    const response = await api.get<EngagementMetrics>('/analytics/engagement', {
      params: { period },
    });
    return response.data;
  },

  // Get recent activity
  getRecentActivity: async (limit: number = 20): Promise<ActivityItem[]> => {
    const response = await api.get<ActivityItem[]>('/analytics/recent-activity', {
      params: { limit },
    });
    return response.data;
  },
};

// =========================================================================
// Community Types (Phase 12)
// =========================================================================

export interface Community {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  image_url: string | null;
  banner_url: string | null;
  member_count: number;
  is_public: boolean;
  is_active: boolean;
  rules: string[] | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string | null;
  // Enriched fields
  owner_username?: string | null;
  is_member?: boolean;
  user_role?: string | null;
}

export interface CommunityCreate {
  name: string;
  description?: string;
  image_url?: string;
  banner_url?: string;
  is_public?: boolean;
  rules?: string[];
  tags?: string[];
}

export interface CommunityUpdate {
  name?: string;
  description?: string;
  image_url?: string;
  banner_url?: string;
  is_public?: boolean;
  rules?: string[];
  tags?: string[];
}

export interface CommunityMember {
  id: number;
  community_id: number;
  user_id: number;
  role: 'owner' | 'moderator' | 'member';
  joined_at: string;
  is_muted: boolean;
  muted_until: string | null;
  // Enriched fields
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface CommunityListResponse {
  communities: Community[];
  total: number;
  limit: number;
  offset: number;
}

// Community API
export const communityApi = {
  // CRUD operations
  create: async (data: CommunityCreate): Promise<Community> => {
    const response = await api.post<Community>('/communities', data);
    return response.data;
  },

  getAll: async (params: {
    search?: string;
    is_public?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<CommunityListResponse> => {
    const response = await api.get<CommunityListResponse>('/communities', { params });
    return response.data;
  },

  get: async (communityId: number): Promise<Community> => {
    const response = await api.get<Community>(`/communities/${communityId}`);
    return response.data;
  },

  update: async (communityId: number, data: CommunityUpdate): Promise<Community> => {
    const response = await api.put<Community>(`/communities/${communityId}`, data);
    return response.data;
  },

  delete: async (communityId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/communities/${communityId}`);
    return response.data;
  },

  // Membership
  join: async (communityId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/communities/${communityId}/join`);
    return response.data;
  },

  leave: async (communityId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/communities/${communityId}/leave`);
    return response.data;
  },

  getMembers: async (communityId: number, params: {
    role?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    members: CommunityMember[];
    total: number;
    limit: number;
    offset: number;
  }> => {
    const response = await api.get(`/communities/${communityId}/members`, { params });
    return response.data;
  },

  checkMembership: async (communityId: number): Promise<{
    is_member: boolean;
    role: string | null;
  }> => {
    const response = await api.get(`/communities/${communityId}/membership`);
    return response.data;
  },

  getMyCommunities: async (limit: number = 50, offset: number = 0): Promise<Community[]> => {
    const response = await api.get<Community[]>('/communities/mine', {
      params: { limit, offset },
    });
    return response.data;
  },

  // Role management (owner/moderator only)
  setMemberRole: async (communityId: number, userId: number, role: 'moderator' | 'member'): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.put(`/communities/${communityId}/members/${userId}/role`, null, {
      params: { role },
    });
    return response.data;
  },

  kickMember: async (communityId: number, userId: number, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.delete(`/communities/${communityId}/members/${userId}`, {
      params: reason ? { reason } : undefined,
    });
    return response.data;
  },
};

// =========================================================================
// Direct Messaging Types (Phase 12)
// =========================================================================

export interface DirectMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  is_read: boolean;
  read_at: string | null;
  is_deleted_by_sender: boolean;
  is_deleted_by_recipient: boolean;
  created_at: string;
  // Enriched fields
  sender_username?: string | null;
  sender_avatar_url?: string | null;
}

export interface Conversation {
  id: number;
  other_user: {
    id: number;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageListResponse {
  messages: DirectMessage[];
  total: number;
  limit: number;
  offset: number;
  conversation_id: number;
}

export interface MessageCreate {
  recipient_id: number;
  content: string;
}

// Direct Messaging API
export const messagingApi = {
  // Send a message
  send: async (recipientId: number, content: string): Promise<DirectMessage> => {
    const response = await api.post<DirectMessage>('/messages', {
      recipient_id: recipientId,
      content,
    });
    return response.data;
  },

  // Get conversations list
  getConversations: async (limit: number = 20, offset: number = 0): Promise<ConversationListResponse> => {
    const response = await api.get<ConversationListResponse>('/messages/conversations', {
      params: { limit, offset },
    });
    return response.data;
  },

  // Get messages in a conversation
  getMessages: async (conversationId: number, params: {
    limit?: number;
    offset?: number;
    before_id?: number;
  } = {}): Promise<MessageListResponse> => {
    const response = await api.get<MessageListResponse>(`/messages/conversations/${conversationId}`, {
      params,
    });
    return response.data;
  },

  // Mark conversation as read
  markRead: async (conversationId: number): Promise<{
    success: boolean;
    messages_marked_read: number;
  }> => {
    const response = await api.post(`/messages/conversations/${conversationId}/read`);
    return response.data;
  },

  // Delete a message
  delete: async (messageId: number): Promise<{ success: boolean }> => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  // Get unread count
  getUnreadCount: async (): Promise<{ unread_count: number }> => {
    const response = await api.get('/messages/unread-count');
    return response.data;
  },

  // Get or start conversation with a user
  getOrStartConversation: async (userId: number): Promise<Conversation> => {
    const response = await api.get<Conversation>(`/messages/with/${userId}`);
    return response.data;
  },
};

// =========================================================================
// User Blocking Types (Phase 12)
// =========================================================================

export interface UserBlock {
  id: number;
  blocker_id: number;
  blocked_id: number;
  reason: string | null;
  created_at: string;
  // Enriched fields
  blocked_username?: string | null;
  blocked_avatar_url?: string | null;
}

export interface BlockListResponse {
  blocks: UserBlock[];
  total: number;
  limit: number;
  offset: number;
}

// Blocking API
export const blockApi = {
  // Block a user
  block: async (userId: number, reason?: string): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.post(`/users/${userId}/block`, null, {
      params: reason ? { reason } : undefined,
    });
    return response.data;
  },

  // Unblock a user
  unblock: async (userId: number): Promise<{
    success: boolean;
    message: string;
  }> => {
    const response = await api.delete(`/users/${userId}/block`);
    return response.data;
  },

  // Check if a user is blocked
  isBlocked: async (userId: number): Promise<{
    is_blocked: boolean;
    blocked_by_them: boolean;
    blocked_by_you: boolean;
  }> => {
    const response = await api.get(`/users/${userId}/is-blocked`);
    return response.data;
  },

  // Get list of blocked users
  getBlockedUsers: async (limit: number = 50, offset: number = 0): Promise<BlockListResponse> => {
    const response = await api.get<BlockListResponse>('/users/blocked', {
      params: { limit, offset },
    });
    return response.data;
  },
};

// =========================================================================
// ML Predictions Types (Phase 14)
// =========================================================================

export interface PredictionData {
  prediction_type: string;
  predicted_value: number;
  confidence: number;
  range_low: number;
  range_high: number;
  model_version: string;
}

export interface StreamPredictionsResponse {
  peak_viewers: PredictionData;
  engagement: PredictionData;
  duration: PredictionData;
  revenue: PredictionData;
  generated_at: string;
}

export interface PredictionRequest {
  category?: string;
  title?: string;
  tags?: string[];
  scheduled_start?: string;
}

export interface OptimalTime {
  day_of_week: number;
  day_name: string;
  hour_utc: number;
  score: number;
  expected_viewers: number | null;
  competition_level: string | null;
  confidence: number;
}

export interface StreamPrediction {
  id: number;
  prediction_type: string;
  predicted_value: number;
  predicted_range_low: number;
  predicted_range_high: number;
  confidence: number;
  actual_value: number | null;
  error: number | null;
  model_version: string;
  created_at: string;
  evaluated_at: string | null;
}

export interface CreatorHistoryPeriod {
  id: number;
  period_start: string;
  period_end: string;
  streams_count: number;
  total_stream_duration: number;
  avg_stream_duration: number | null;
  total_viewers: number;
  unique_viewers: number;
  avg_concurrent_viewers: number | null;
  peak_concurrent_viewers: number;
  total_chat_messages: number;
  total_likes: number;
  engagement_rate: number | null;
  new_followers: number;
  new_subscribers: number;
  total_tips: number;
  avg_tip_amount: number | null;
  best_category: string | null;
  categories_streamed: Record<string, number> | null;
}

export interface ModelAccuracy {
  prediction_type: string;
  mae: number | null;
  mape: number | null;
  within_range_pct: number | null;
  sample_size: number;
}

// Predictions API
export const predictionsApi = {
  // Generate predictions for a planned stream
  predict: async (data: PredictionRequest): Promise<StreamPredictionsResponse> => {
    const response = await api.post<StreamPredictionsResponse>('/analytics/predictions', data);
    return response.data;
  },

  // Get predictions for a specific stream
  getStreamPredictions: async (streamId: number): Promise<{
    stream_id: number;
    predictions: StreamPrediction[];
  }> => {
    const response = await api.get(`/analytics/predictions/${streamId}`);
    return response.data;
  },

  // Get optimal streaming times
  getOptimalTimes: async (category?: string, limit: number = 10): Promise<OptimalTime[]> => {
    const response = await api.get<OptimalTime[]>('/analytics/optimal-time', {
      params: { category, limit },
    });
    return response.data;
  },

  // Submit actual value for a prediction (feedback)
  submitFeedback: async (predictionId: number, actualValue: number): Promise<{
    id: number;
    prediction_type: string;
    predicted_value: number;
    actual_value: number;
    error: number;
    evaluated_at: string;
  }> => {
    const response = await api.post(`/analytics/predictions/${predictionId}/feedback`, null, {
      params: { actual_value: actualValue },
    });
    return response.data;
  },

  // Get creator performance history
  getCreatorHistory: async (
    periodType: 'daily' | 'weekly' | 'monthly' = 'weekly',
    limit: number = 12
  ): Promise<{
    user_id: number;
    period_type: string;
    history: CreatorHistoryPeriod[];
  }> => {
    const response = await api.get('/analytics/creator-history', {
      params: { period_type: periodType, limit },
    });
    return response.data;
  },

  // Get model accuracy metrics (admin only)
  getModelAccuracy: async (days: number = 30): Promise<ModelAccuracy[]> => {
    const response = await api.get<ModelAccuracy[]>('/analytics/model-accuracy', {
      params: { days },
    });
    return response.data;
  },
};
