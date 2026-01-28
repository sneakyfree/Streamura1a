import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Types
interface OfflineState {
    isOnline: boolean;
    lastSyncTime: Date | null;
    pendingActions: number;
    cachedItems: number;
}

interface CachedStream {
    id: string;
    title: string;
    streamerName: string;
    thumbnailUrl?: string;
    cachedAt: Date;
}

interface PendingAction {
    id: string;
    type: 'follow' | 'unfollow' | 'tip' | 'subscribe' | 'message';
    data: Record<string, any>;
    createdAt: Date;
}

const CACHE_KEY = 'streamura_offline_cache';
const PENDING_KEY = 'streamura_pending_actions';
const FAVORITES_KEY = 'streamura_favorites';

// Offline data management hook
export function useOfflineData() {
    const [state, setState] = useState<OfflineState>({
        isOnline: navigator.onLine,
        lastSyncTime: null,
        pendingActions: 0,
        cachedItems: 0
    });

    const queryClient = useQueryClient();

    useEffect(() => {
        const handleOnline = () => {
            setState(prev => ({ ...prev, isOnline: true }));
            syncPendingActions();
        };

        const handleOffline = () => {
            setState(prev => ({ ...prev, isOnline: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Load initial state from storage
        loadCacheState();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadCacheState = useCallback(() => {
        try {
            const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
            const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            const lastSync = localStorage.getItem('streamura_last_sync');

            setState(prev => ({
                ...prev,
                pendingActions: pending.length,
                cachedItems: Object.keys(cached).length,
                lastSyncTime: lastSync ? new Date(lastSync) : null
            }));
        } catch (e) {
            console.error('Failed to load offline state', e);
        }
    }, []);

    const syncPendingActions = useCallback(async () => {
        if (!navigator.onLine) return;

        try {
            const pending: PendingAction[] = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');

            for (const action of pending) {
                try {
                    // Process each pending action
                    // In real implementation, this would call the actual API
                    console.log('Syncing action:', action);
                    await new Promise(r => setTimeout(r, 100));
                } catch (e) {
                    console.error('Failed to sync action', action, e);
                }
            }

            // Clear pending actions
            localStorage.setItem(PENDING_KEY, '[]');
            localStorage.setItem('streamura_last_sync', new Date().toISOString());

            loadCacheState();
            queryClient.invalidateQueries();
        } catch (e) {
            console.error('Sync failed', e);
        }
    }, [queryClient, loadCacheState]);

    const queueAction = useCallback((action: Omit<PendingAction, 'id' | 'createdAt'>) => {
        const pending: PendingAction[] = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');

        pending.push({
            ...action,
            id: `action-${Date.now()}`,
            createdAt: new Date()
        });

        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        loadCacheState();

        // Try to sync immediately if online
        if (navigator.onLine) {
            syncPendingActions();
        }
    }, [loadCacheState, syncPendingActions]);

    const cacheData = useCallback((key: string, data: any) => {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            cache[key] = { data, cachedAt: new Date().toISOString() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
            loadCacheState();
        } catch (e) {
            console.error('Failed to cache data', e);
        }
    }, [loadCacheState]);

    const getCachedData = useCallback(<T>(key: string): T | null => {
        try {
            const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
            return cache[key]?.data || null;
        } catch {
            return null;
        }
    }, []);

    const clearCache = useCallback(() => {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(PENDING_KEY);
        loadCacheState();
    }, [loadCacheState]);

    return {
        ...state,
        syncPendingActions,
        queueAction,
        cacheData,
        getCachedData,
        clearCache
    };
}

// Favorites management with offline support
export function useOfflineFavorites() {
    const [favorites, setFavorites] = useState<CachedStream[]>([]);
    const { queueAction, isOnline } = useOfflineData();

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = useCallback(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
            setFavorites(stored.map((f: any) => ({
                ...f,
                cachedAt: new Date(f.cachedAt)
            })));
        } catch {
            setFavorites([]);
        }
    }, []);

    const addFavorite = useCallback((stream: Omit<CachedStream, 'cachedAt'>) => {
        const updated = [
            ...favorites.filter(f => f.id !== stream.id),
            { ...stream, cachedAt: new Date() }
        ];
        setFavorites(updated);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));

        // Queue sync if offline
        if (!isOnline) {
            queueAction({ type: 'follow', data: { streamId: stream.id } });
        }
    }, [favorites, isOnline, queueAction]);

    const removeFavorite = useCallback((streamId: string) => {
        const updated = favorites.filter(f => f.id !== streamId);
        setFavorites(updated);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));

        if (!isOnline) {
            queueAction({ type: 'unfollow', data: { streamId } });
        }
    }, [favorites, isOnline, queueAction]);

    const isFavorite = useCallback((streamId: string) => {
        return favorites.some(f => f.id === streamId);
    }, [favorites]);

    return {
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        loadFavorites
    };
}

// Service Worker registration hook
export function useServiceWorker() {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    setRegistration(reg);

                    // Check for updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setUpdateAvailable(true);
                                }
                            });
                        }
                    });
                })
                .catch(err => console.error('SW registration failed:', err));
        }
    }, []);

    const update = useCallback(() => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }, [registration]);

    return { registration, updateAvailable, update };
}

// Install prompt hook
export function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        setIsInstalled(isStandalone);

        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferredPrompt) return false;

        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setCanInstall(false);

        return result.outcome === 'accepted';
    }, [deferredPrompt]);

    return { canInstall, isInstalled, promptInstall };
}

export default {
    useOfflineData,
    useOfflineFavorites,
    useServiceWorker,
    useInstallPrompt
};
