import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { ThemeProvider } from './src/hooks/useTheme';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 2,
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    },
});

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <AuthProvider>
                        <NavigationContainer>
                            <StatusBar style="light" />
                            <RootNavigator />
                        </NavigationContainer>
                    </AuthProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}
