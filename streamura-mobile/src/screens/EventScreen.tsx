import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function EventScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Event Details</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' },
    text: { color: '#888' },
});
