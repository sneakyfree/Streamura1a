import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export function ProfileScreen() {
    const theme = useTheme();
    const { user, logout } = useAuth();

    const menuItems = [
        { icon: 'wallet-outline', label: 'Earnings', route: 'Earnings' },
        { icon: 'settings-outline', label: 'Settings', route: 'Settings' },
        { icon: 'shield-checkmark-outline', label: 'Verification', route: 'Verification' },
        { icon: 'help-circle-outline', label: 'Help & Support', route: 'Support' },
    ];

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.colors.background }]}
            contentContainerStyle={styles.content}
        >
            {/* Profile Header */}
            <View style={styles.header}>
                <Image
                    source={{ uri: user?.avatar_url || 'https://via.placeholder.com/100' }}
                    style={styles.avatar}
                />
                <Text style={styles.username}>@{user?.username || 'User'}</Text>
                <Text style={styles.email}>{user?.email}</Text>

                {user?.is_verified && (
                    <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                        <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                )}

                {/* Trust Score */}
                <View style={styles.trustScore}>
                    <Text style={styles.trustLabel}>Trust Score</Text>
                    <Text style={styles.trustValue}>{user?.trust_score || 0}</Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Streams</Text>
                </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menu}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.menuItem}>
                        <View style={styles.menuIconContainer}>
                            <Ionicons name={item.icon as any} size={24} color="#6366f1" />
                        </View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    header: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 16,
        borderWidth: 3,
        borderColor: '#6366f1',
    },
    username: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    email: {
        color: '#888',
        marginTop: 4,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 12,
        gap: 6,
    },
    verifiedText: {
        color: '#10b981',
        fontWeight: '600',
    },
    trustScore: {
        marginTop: 16,
        alignItems: 'center',
    },
    trustLabel: {
        color: '#888',
        fontSize: 12,
    },
    trustValue: {
        fontSize: 32,
        fontWeight: '700',
        color: '#6366f1',
    },
    stats: {
        flexDirection: 'row',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        backgroundColor: '#333',
    },
    menu: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    menuLabel: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        borderRadius: 12,
        marginTop: 24,
        gap: 8,
    },
    logoutText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
    },
});
