import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function StreamScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Stream Player (LiveKit integration)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' },
    text: { color: '#888' },
});
