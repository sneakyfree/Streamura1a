import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'https://api.streamura.com/api/v1';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for auth token
apiClient.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = await SecureStore.getItemAsync('refresh_token');
                if (refreshToken) {
                    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, null, {
                        params: { refresh_token: refreshToken },
                    });

                    await SecureStore.setItemAsync('access_token', response.data.access_token);
                    originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;

                    return apiClient(originalRequest);
                }
            } catch {
                await SecureStore.deleteItemAsync('access_token');
                await SecureStore.deleteItemAsync('refresh_token');
            }
        }

        return Promise.reject(error);
    }
);

export interface Stream {
    id: number;
    title: string;
    description: string | null;
    status: string;
    viewer_count: number;
    thumbnail_url: string | null;
    creator_username: string;
    creator_avatar_url: string | null;
}

export interface Event {
    id: number;
    title: string;
    description: string | null;
    location: string | null;
    start_time: string;
    status: string;
    stream_count: number;
    thumbnail_url: string | null;
}

export const api = {
    // Auth
    login: async (email: string, password: string) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await apiClient.post('/auth/token', formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data;
    },

    register: async (data: { username: string; email: string; password: string }) => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },

    getCurrentUser: async () => {
        const response = await apiClient.get('/users/me');
        return response.data;
    },

    // Streams
    getStream: async (streamId: number): Promise<Stream> => {
        const response = await apiClient.get(`/streams/${streamId}`);
        return response.data;
    },

    createStream: async (data: { title: string; description?: string; event_id?: number }) => {
        const response = await apiClient.post('/streams', data);
        return response.data;
    },

    startStream: async (streamId: number) => {
        const response = await apiClient.post(`/streams/${streamId}/start`);
        return response.data;
    },

    endStream: async (streamId: number) => {
        const response = await apiClient.post(`/streams/${streamId}/end`);
        return response.data;
    },

    // Events
    getEvents: async (params?: { status?: string; limit?: number }): Promise<Event[]> => {
        const response = await apiClient.get('/events', { params });
        return response.data.events;
    },

    getEvent: async (eventId: number): Promise<Event> => {
        const response = await apiClient.get(`/events/${eventId}`);
        return response.data;
    },

    // Discovery
    getDiscoveryFeed: async (params?: { latitude?: number; longitude?: number }) => {
        const response = await apiClient.get('/discover', { params });
        return response.data;
    },

    // Notifications
    getNotifications: async () => {
        const response = await apiClient.get('/notifications');
        return response.data;
    },

    markNotificationRead: async (notificationId: number) => {
        const response = await apiClient.post(`/notifications/${notificationId}/read`);
        return response.data;
    },

    // Tips
    sendTip: async (data: { stream_id: number; amount: number; message?: string }) => {
        const response = await apiClient.post('/tips', data);
        return response.data;
    },

    // LiveKit token
    getLiveKitToken: async (streamId: number, role: 'host' | 'viewer') => {
        const response = await apiClient.get(`/streams/${streamId}/token`, {
            params: { role },
        });
        return response.data;
    },
};

export default api;
