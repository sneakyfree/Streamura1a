import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useTheme } from '../hooks/useTheme';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
}

export function NotificationsScreen() {
    const theme = useTheme();

    const { data: notifications, isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.getNotifications(),
    });

    const getIcon = (type: string) => {
        switch (type) {
            case 'tip': return 'cash-outline';
            case 'follow': return 'person-add-outline';
            case 'stream': return 'videocam-outline';
            case 'event': return 'calendar-outline';
            default: return 'notifications-outline';
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => (
        <TouchableOpacity
            style={[styles.notification, !item.read && styles.unread]}
            onPress={() => api.markNotificationRead(item.id)}
        >
            <View style={styles.iconContainer}>
                <Ionicons name={getIcon(item.type)} size={24} color="#6366f1" />
            </View>
            <View style={styles.content}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {notifications && notifications.length > 0 ? (
                <FlatList
                    data={notifications}
                    renderItem={renderNotification}
                    keyExtractor={(item) => `notif-${item.id}`}
                    contentContainerStyle={styles.list}
                />
            ) : (
                <View style={styles.empty}>
                    <Ionicons name="notifications-off-outline" size={48} color="#666" />
                    <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    list: {
        padding: 16,
    },
    notification: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    unread: {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderLeftWidth: 3,
        borderLeftColor: '#6366f1',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    message: {
        color: '#888',
        fontSize: 14,
        marginBottom: 4,
    },
    time: {
        color: '#666',
        fontSize: 12,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#6366f1',
    },
    empty: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        marginTop: 12,
    },
});
