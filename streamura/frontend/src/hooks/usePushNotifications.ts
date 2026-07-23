import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

interface PushSubscriptionOptions {
    onSubscribe?: () => void;
    onUnsubscribe?: () => void;
    onError?: (error: Error) => void;
}

interface UsePushNotificationsReturn {
    permission: PermissionState;
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    requestPermission: () => Promise<PermissionState>;
}

// VAPID public key - should be loaded from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications({
    onSubscribe,
    onUnsubscribe,
    onError,
}: PushSubscriptionOptions = {}): UsePushNotificationsReturn {
    const { isAuthenticated } = useAuthStore();
    const [permission, setPermission] = useState<PermissionState>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

    // Check if push is supported
    const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

    // Initialize and check current state
    useEffect(() => {
        if (!isPushSupported) {
            setPermission('unsupported');
            return;
        }

        // Check current permission
        setPermission(Notification.permission as PermissionState);

        // Register service worker and check subscription
        navigator.serviceWorker.ready.then((reg) => {
            setRegistration(reg);

            reg.pushManager.getSubscription().then((sub) => {
                setIsSubscribed(!!sub);
            });
        });
    }, [isPushSupported]);

    const requestPermission = useCallback(async (): Promise<PermissionState> => {
        if (!isPushSupported) return 'unsupported';

        try {
            const result = await Notification.requestPermission();
            setPermission(result as PermissionState);
            return result as PermissionState;
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            return 'denied';
        }
    }, [isPushSupported]);

    const subscribe = useCallback(async () => {
        if (!registration || !isAuthenticated) return;

        setIsLoading(true);
        try {
            // Request permission if not already granted
            if (permission !== 'granted') {
                const newPermission = await requestPermission();
                if (newPermission !== 'granted') {
                    throw new Error('Notification permission denied');
                }
            }

            // Subscribe to push
            const applicationServerKey = VAPID_PUBLIC_KEY ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : undefined;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey as BufferSource,
            });

            // Send subscription to backend
            await api.post('/notifications/push/subscribe', {
                subscription: subscription.toJSON(),
            });

            setIsSubscribed(true);
            onSubscribe?.();
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            onError?.(error instanceof Error ? error : new Error('Subscription failed'));
        } finally {
            setIsLoading(false);
        }
    }, [registration, isAuthenticated, permission, requestPermission, onSubscribe, onError]);

    const unsubscribe = useCallback(async () => {
        if (!registration) return;

        setIsLoading(true);
        try {
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                // Notify backend
                await api.post('/notifications/push/unsubscribe', {
                    endpoint: subscription.endpoint,
                });
            }

            setIsSubscribed(false);
            onUnsubscribe?.();
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
            onError?.(error instanceof Error ? error : new Error('Unsubscribe failed'));
        } finally {
            setIsLoading(false);
        }
    }, [registration, onUnsubscribe, onError]);

    return {
        permission,
        isSupported: isPushSupported,
        isSubscribed,
        isLoading,
        subscribe,
        unsubscribe,
        requestPermission,
    };
}

// Notification preferences types
export interface NotificationPreferences {
    stream_live: boolean;
    tips: boolean;
    follows: boolean;
    comments: boolean;
    earnings: boolean;
    system: boolean;
    marketing: boolean;
}

interface UseNotificationPreferencesReturn {
    preferences: NotificationPreferences | null;
    isLoading: boolean;
    updatePreference: (key: keyof NotificationPreferences, value: boolean) => Promise<void>;
    updateAllPreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

export function useNotificationPreferences(): UseNotificationPreferencesReturn {
    const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch preferences on mount
    useEffect(() => {
        api.get('/notifications/preferences')
            .then((response) => {
                setPreferences(response.data);
            })
            .catch((error) => {
                console.error('Failed to fetch notification preferences:', error);
                // Default preferences
                setPreferences({
                    stream_live: true,
                    tips: true,
                    follows: true,
                    comments: true,
                    earnings: true,
                    system: true,
                    marketing: false,
                });
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const updatePreference = useCallback(async (
        key: keyof NotificationPreferences,
        value: boolean
    ) => {
        if (!preferences) return;

        const updated = { ...preferences, [key]: value };
        setPreferences(updated);

        try {
            await api.patch('/notifications/preferences', { [key]: value });
        } catch (error) {
            // Revert on error
            setPreferences(preferences);
            console.error('Failed to update preference:', error);
            throw error;
        }
    }, [preferences]);

    const updateAllPreferences = useCallback(async (
        prefs: Partial<NotificationPreferences>
    ) => {
        if (!preferences) return;

        const updated = { ...preferences, ...prefs };
        setPreferences(updated);

        try {
            await api.patch('/notifications/preferences', prefs);
        } catch (error) {
            setPreferences(preferences);
            console.error('Failed to update preferences:', error);
            throw error;
        }
    }, [preferences]);

    return {
        preferences,
        isLoading,
        updatePreference,
        updateAllPreferences,
    };
}
