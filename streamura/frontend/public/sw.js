/// <reference lib="webworker" />

const CACHE_NAME = 'streamura-v1';
const OFFLINE_URL = '/offline.html';

// Install event - cache offline page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.add(OFFLINE_URL);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const data = event.data.json();

        const options = {
            body: data.body || data.message,
            icon: data.icon || '/icons/notification-icon.png',
            badge: '/icons/badge-icon.png',
            tag: data.tag || 'streamura-notification',
            data: {
                url: data.url || '/',
                type: data.type,
                entityId: data.entity_id,
            },
            vibrate: [100, 50, 100],
            actions: getActionsForType(data.type),
            requireInteraction: data.type === 'stream_live' || data.type === 'tip',
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'Streamura', options)
        );
    } catch (error) {
        console.error('Push notification error:', error);
    }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const { url, type, entityId } = event.notification.data || {};
    let targetUrl = url || '/';

    // Handle action buttons
    if (event.action) {
        switch (event.action) {
            case 'watch':
                targetUrl = `/streams/${entityId}`;
                break;
            case 'tip':
                targetUrl = `/streams/${entityId}?action=tip`;
                break;
            case 'view_profile':
                targetUrl = `/profile/${entityId}`;
                break;
            case 'dismiss':
                return; // Just close the notification
        }
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if none found
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});

// Get notification actions based on type
function getActionsForType(type) {
    switch (type) {
        case 'stream_live':
            return [
                { action: 'watch', title: '🎥 Watch Now' },
                { action: 'dismiss', title: 'Later' },
            ];
        case 'tip':
            return [
                { action: 'watch', title: '💰 View Stream' },
            ];
        case 'follow':
            return [
                { action: 'view_profile', title: '👤 View Profile' },
            ];
        default:
            return [];
    }
}

// Sync event - for background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    }
});

async function syncNotifications() {
    // Sync read status with server when back online
    const cache = await caches.open(CACHE_NAME);
    const pendingReads = await cache.match('pending-reads');

    if (pendingReads) {
        const ids = await pendingReads.json();
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_ids: ids }),
            });
            await cache.delete('pending-reads');
        } catch (error) {
            console.error('Failed to sync notification reads:', error);
        }
    }
}
