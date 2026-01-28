import React from 'react';
import {
    View,
    Text,
    FlatList,
    Image,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { api, Stream, Event } from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
    const navigation = useNavigation<NavigationProp>();
    const theme = useTheme();

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['discovery-feed'],
        queryFn: () => api.getDiscoveryFeed(),
    });

    const renderLiveStream = ({ item }: { item: Stream }) => (
        <TouchableOpacity
            style={styles.streamCard}
            onPress={() => navigation.navigate('Stream', { streamId: item.id })}
        >
            <View style={styles.thumbnailContainer}>
                {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                        <Ionicons name="videocam" size={32} color="#666" />
                    </View>
                )}
                <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
                <View style={styles.viewerCount}>
                    <Ionicons name="eye" size={12} color="#fff" />
                    <Text style={styles.viewerText}>{item.viewer_count}</Text>
                </View>
            </View>
            <View style={styles.streamInfo}>
                <Image
                    source={{ uri: item.creator_avatar_url || 'https://via.placeholder.com/40' }}
                    style={styles.avatar}
                />
                <View style={styles.streamText}>
                    <Text style={styles.streamTitle} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.creatorName}>{item.creator_username}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderEvent = ({ item }: { item: Event }) => (
        <TouchableOpacity
            style={styles.eventCard}
            onPress={() => navigation.navigate('Event', { eventId: item.id })}
        >
            <View style={styles.eventImageContainer}>
                {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.eventImage} />
                ) : (
                    <View style={[styles.eventImage, styles.placeholderThumbnail]}>
                        <Ionicons name="calendar" size={24} color="#666" />
                    </View>
                )}
            </View>
            <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                    {item.title}
                </Text>
                <Text style={styles.eventLocation} numberOfLines={1}>
                    <Ionicons name="location-outline" size={12} color="#888" />{' '}
                    {item.location || 'Online'}
                </Text>
                <Text style={styles.eventStreams}>
                    {item.stream_count} stream{item.stream_count !== 1 ? 's' : ''}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <FlatList
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={
                    <>
                        {/* Live Streams Section */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔴 Live Now</Text>
                            {data?.live_streams && data.live_streams.length > 0 ? (
                                <FlatList
                                    horizontal
                                    data={data.live_streams}
                                    renderItem={renderLiveStream}
                                    keyExtractor={(item) => `stream-${item.id}`}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalList}
                                />
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="videocam-off-outline" size={32} color="#666" />
                                    <Text style={styles.emptyText}>No live streams right now</Text>
                                </View>
                            )}
                        </View>

                        {/* Trending Events */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>🔥 Trending Events</Text>
                            {data?.trending_events && data.trending_events.length > 0 ? (
                                <FlatList
                                    horizontal
                                    data={data.trending_events}
                                    renderItem={renderEvent}
                                    keyExtractor={(item) => `event-${item.id}`}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalList}
                                />
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="calendar-outline" size={32} color="#666" />
                                    <Text style={styles.emptyText}>No trending events</Text>
                                </View>
                            )}
                        </View>

                        {/* Featured Events */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>⭐ Featured</Text>
                            {data?.featured_events && data.featured_events.length > 0 ? (
                                <FlatList
                                    horizontal
                                    data={data.featured_events}
                                    renderItem={renderEvent}
                                    keyExtractor={(item) => `featured-${item.id}`}
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalList}
                                />
                            ) : null}
                        </View>
                    </>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={refetch}
                        tintColor="#6366f1"
                    />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginLeft: 16,
        marginBottom: 12,
    },
    horizontalList: {
        paddingHorizontal: 16,
        gap: 12,
    },
    streamCard: {
        width: 280,
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        overflow: 'hidden',
    },
    thumbnailContainer: {
        position: 'relative',
        height: 160,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    placeholderThumbnail: {
        backgroundColor: '#252540',
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveTag: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
    },
    liveText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    viewerCount: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        gap: 4,
    },
    viewerText: {
        color: '#fff',
        fontSize: 12,
    },
    streamInfo: {
        flexDirection: 'row',
        padding: 12,
        gap: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    streamText: {
        flex: 1,
    },
    streamTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    creatorName: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    eventCard: {
        width: 200,
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        overflow: 'hidden',
    },
    eventImageContainer: {
        height: 120,
    },
    eventImage: {
        width: '100%',
        height: '100%',
    },
    eventInfo: {
        padding: 12,
    },
    eventTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    eventLocation: {
        color: '#888',
        fontSize: 12,
        marginBottom: 4,
    },
    eventStreams: {
        color: '#6366f1',
        fontSize: 12,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
    },
});
