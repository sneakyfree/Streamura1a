import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface WebSocketMessage {
    type: string;
    data: Record<string, unknown>;
    timestamp?: string;
}

interface UseWebSocketOptions {
    room: string;
    onMessage?: (message: WebSocketMessage) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
    connectionState: ConnectionState;
    sendMessage: (type: string, data: Record<string, unknown>) => void;
    disconnect: () => void;
    reconnect: () => void;
}

export function useWebSocket({
    room,
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
    const authState = useAuthStore();
    // Use authState to ensure hook is called (but we get token from localStorage)
    void authState;
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getWebSocketUrl = useCallback(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const token = localStorage.getItem('access_token') || '';
        return `${protocol}//${host}/ws/${room}?token=${encodeURIComponent(token)}`;
    }, [room]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        setConnectionState('connecting');

        try {
            wsRef.current = new WebSocket(getWebSocketUrl());

            wsRef.current.onopen = () => {
                setConnectionState('connected');
                reconnectAttemptsRef.current = 0;
                onConnect?.();
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as WebSocketMessage;
                    onMessage?.(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            wsRef.current.onclose = () => {
                setConnectionState('disconnected');
                onDisconnect?.();

                if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    setConnectionState('reconnecting');
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, reconnectInterval);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            setConnectionState('disconnected');
        }
    }, [getWebSocketUrl, onMessage, onConnect, onDisconnect, autoReconnect, reconnectInterval, maxReconnectAttempts]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
        wsRef.current?.close();
        setConnectionState('disconnected');
    }, [maxReconnectAttempts]);

    const reconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0;
        disconnect();
        connect();
    }, [disconnect, connect]);

    const sendMessage = useCallback((type: string, data: Record<string, unknown>) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type,
                data,
                timestamp: new Date().toISOString(),
            }));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }, []);

    // Connect on mount
    useEffect(() => {
        if (room) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [room, connect, disconnect]);

    return {
        connectionState,
        sendMessage,
        disconnect,
        reconnect,
    };
}

// Stream-specific hook with typed events
interface StreamUpdate {
    viewerCount: number;
    peakViewers: number;
    earnings: number;
    status: 'live' | 'ended' | 'created';
}

interface ChatMessage {
    id: string;
    userId: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    content: string;
    timestamp: string;
    isVerified: boolean;
}

interface TipNotification {
    id: string;
    fromUserId: number;
    fromUsername: string;
    amount: number;
    currency: string;
    message: string;
    timestamp: string;
}

interface UseStreamUpdatesOptions {
    streamId: number | string;
    onChatMessage?: (message: ChatMessage) => void;
    onTipReceived?: (tip: TipNotification) => void;
    onViewerCountUpdate?: (count: number) => void;
    onStreamEnded?: () => void;
}

interface UseStreamUpdatesReturn {
    connectionState: ConnectionState;
    streamData: StreamUpdate;
    sendChatMessage: (content: string) => void;
    sendTypingIndicator: () => void;
}

export function useStreamUpdates({
    streamId,
    onChatMessage,
    onTipReceived,
    onViewerCountUpdate,
    onStreamEnded,
}: UseStreamUpdatesOptions): UseStreamUpdatesReturn {
    const [streamData, setStreamData] = useState<StreamUpdate>({
        viewerCount: 0,
        peakViewers: 0,
        earnings: 0,
        status: 'live',
    });

    const handleMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'viewer_count':
                const count = message.data.count as number;
                setStreamData(prev => ({
                    ...prev,
                    viewerCount: count,
                    peakViewers: Math.max(prev.peakViewers, count),
                }));
                onViewerCountUpdate?.(count);
                break;

            case 'chat_message':
                if (onChatMessage) {
                    onChatMessage({
                        id: message.data.id as string,
                        userId: message.data.user_id as number,
                        username: message.data.username as string,
                        displayName: message.data.display_name as string,
                        avatarUrl: message.data.avatar_url as string | null,
                        content: message.data.content as string,
                        timestamp: message.data.timestamp as string,
                        isVerified: message.data.is_verified as boolean,
                    });
                }
                break;

            case 'tip_received':
                const tip: TipNotification = {
                    id: message.data.id as string,
                    fromUserId: message.data.from_user_id as number,
                    fromUsername: message.data.from_username as string,
                    amount: message.data.amount as number,
                    currency: message.data.currency as string,
                    message: message.data.message as string,
                    timestamp: message.data.timestamp as string,
                };
                setStreamData(prev => ({
                    ...prev,
                    earnings: prev.earnings + tip.amount,
                }));
                onTipReceived?.(tip);
                break;

            case 'stream_status':
                setStreamData(prev => ({
                    ...prev,
                    status: message.data.status as StreamUpdate['status'],
                }));
                break;

            case 'stream_ended':
                setStreamData(prev => ({ ...prev, status: 'ended' }));
                onStreamEnded?.();
                break;
        }
    }, [onChatMessage, onTipReceived, onViewerCountUpdate, onStreamEnded]);

    const { connectionState, sendMessage } = useWebSocket({
        room: `stream_${streamId}`,
        onMessage: handleMessage,
    });

    const sendChatMessage = useCallback((content: string) => {
        sendMessage('chat_message', { content });
    }, [sendMessage]);

    const sendTypingIndicator = useCallback(() => {
        sendMessage('chat_typing', {});
    }, [sendMessage]);

    return {
        connectionState,
        streamData,
        sendChatMessage,
        sendTypingIndicator,
    };
}

// Notifications WebSocket hook
interface NotificationUpdate {
    id: number;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
}

interface UseNotificationsWSReturn {
    connectionState: ConnectionState;
    unreadCount: number;
    latestNotification: NotificationUpdate | null;
}

export function useNotificationsWS(
    onNotification?: (notification: NotificationUpdate) => void
): UseNotificationsWSReturn {
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestNotification, setLatestNotification] = useState<NotificationUpdate | null>(null);

    const handleMessage = useCallback((message: WebSocketMessage) => {
        if (message.type === 'notification') {
            const notification: NotificationUpdate = {
                id: message.data.id as number,
                type: message.data.type as string,
                title: message.data.title as string,
                message: message.data.message as string,
                read: message.data.read as boolean,
                createdAt: message.data.created_at as string,
            };

            setLatestNotification(notification);
            if (!notification.read) {
                setUnreadCount(prev => prev + 1);
            }
            onNotification?.(notification);
        } else if (message.type === 'unread_count') {
            setUnreadCount(message.data.count as number);
        }
    }, [onNotification]);

    const { connectionState } = useWebSocket({
        room: 'notifications',
        onMessage: handleMessage,
    });

    return {
        connectionState,
        unreadCount,
        latestNotification,
    };
}
