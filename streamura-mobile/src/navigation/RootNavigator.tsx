import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { GoLiveScreen } from '../screens/GoLiveScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { StreamScreen } from '../screens/StreamScreen';
import { EventScreen } from '../screens/EventScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { useAuth } from '../hooks/useAuth';

export type RootStackParamList = {
    Main: undefined;
    Login: undefined;
    Stream: { streamId: number };
    Event: { eventId: number };
    GoLive: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Discover: undefined;
    GoLive: undefined;
    Notifications: undefined;
    Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Discover') {
                        iconName = focused ? 'compass' : 'compass-outline';
                    } else if (route.name === 'GoLive') {
                        iconName = focused ? 'radio' : 'radio-outline';
                    } else if (route.name === 'Notifications') {
                        iconName = focused ? 'notifications' : 'notifications-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#6366f1',
                tabBarInactiveTintColor: '#888',
                tabBarStyle: {
                    backgroundColor: '#0f0f1a',
                    borderTopColor: '#333',
                },
                headerStyle: {
                    backgroundColor: '#0f0f1a',
                },
                headerTintColor: '#fff',
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Discover" component={DiscoverScreen} />
            <Tab.Screen
                name="GoLive"
                component={GoLiveScreen}
                options={{
                    tabBarLabel: 'Go Live',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="radio" size={size} color="#ef4444" />
                    ),
                }}
            />
            <Tab.Screen name="Notifications" component={NotificationsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

export function RootNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return null; // Or a splash screen
    }

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#0f0f1a' },
                headerTintColor: '#fff',
                contentStyle: { backgroundColor: '#0f0f1a' },
            }}
        >
            {isAuthenticated ? (
                <>
                    <Stack.Screen
                        name="Main"
                        component={MainTabs}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Stream"
                        component={StreamScreen}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="Event"
                        component={EventScreen}
                        options={{ title: 'Event Details' }}
                    />
                </>
            ) : (
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                />
            )}
        </Stack.Navigator>
    );
}
