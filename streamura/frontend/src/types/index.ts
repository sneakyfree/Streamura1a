// User types
export interface User {
  id: number;
  username: string | null;
  email: string | null;
  phone_number: string | null;
  display_name?: string | null;
  is_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  balance: number;
  lifetime_earnings: number;
  follower_count: number;
  following_count: number;
  avatar_url: string | null;
}

export interface UserCreate {
  username?: string;
  email?: string;
  phone_number?: string;
  password: string;
}

// Auth types
export interface Token {
  access_token: string;
  token_type: string;
  refresh_token?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Stream types
export interface StreamUser {
  id: number;
  username: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface Stream {
  id: number;
  stream_key: string;
  user_id: number | null;
  title: string | null;
  description: string | null;
  status: 'created' | 'live' | 'ended' | 'archived';
  is_public: boolean;
  is_monetized: boolean;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  viewer_count: number;
  peak_viewers: number;
  total_watch_time: number;
  earnings: number;
  like_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string | null;
  thumbnail_url: string | null;
  category: string | null;
  tags: string[] | null;
  event_id: number | null;
  livekit_room_name: string | null;
  // Optional user info - included in some API responses
  user?: StreamUser;
}

export interface StreamCreate {
  title?: string;
  description?: string;
  is_public?: boolean;
  is_monetized?: boolean;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  category?: string;
  tags?: string[];
}

// Event types
export interface Event {
  id: number;
  title: string;
  description: string | null;
  status: 'active' | 'ended' | 'archived';
  creator_id: number | null;
  latitude: number;
  longitude: number;
  location_name: string;
  radius: number;
  total_viewers: number;
  total_streams: number;
  total_earnings: number;
  ranking_score: number;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string | null;
  thumbnail_url: string | null;
  category: string | null;
  is_featured: boolean;
}

export interface EventCreate {
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  location_name: string;
  category?: string;
}

// Notification types
export type NotificationType =
  | 'follow'
  | 'tip'
  | 'stream_live'
  | 'stream_scheduled'
  | 'like'
  | 'comment'
  | 'subscription'
  | 'community'
  | 'system'
  | 'warning'
  | 'earnings'
  | 'event'
  | 'social'
  | 'moderation'
  | 'payout';

export interface Notification {
  id: number;
  user_id?: number;
  event_id?: number | null;
  stream_id?: number | null;
  from_user_id?: number | null;
  transaction_id?: number | null;
  type: NotificationType;  // alias for notification_type (frontend uses 'type')
  notification_type?: NotificationType;  // backend field name
  title: string;
  message: string;
  read: boolean;  // alias for is_read (frontend uses 'read')
  is_read?: boolean;  // backend field name
  is_pushed?: boolean;
  data?: Record<string, unknown> | null;  // alias for extra_data (frontend uses 'data')
  extra_data?: Record<string, unknown> | null;  // backend field name
  created_at: string;
  read_at?: string | null;
}

// API response types
export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
}
