import { useState, useEffect, useCallback, useMemo } from 'react';

// Types
interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isPWA: boolean;
    hasTouch: boolean;
    screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    orientation: 'portrait' | 'landscape';
    pixelRatio: number;
    safeAreaInsets: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
}

interface NetworkInfo {
    isOnline: boolean;
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
    saveData: boolean;
    downlink: number;
}

interface BatteryInfo {
    level: number;
    charging: boolean;
    supported: boolean;
}

// Device detection hook
export function useDeviceInfo(): DeviceInfo {
    const [info, setInfo] = useState<DeviceInfo>(() => getDeviceInfo());

    useEffect(() => {
        const handleResize = () => setInfo(getDeviceInfo());
        const handleOrientation = () => setInfo(getDeviceInfo());

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleOrientation);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleOrientation);
        };
    }, []);

    return info;
}

function getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const isMobile = /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua) || (width >= 768 && width < 1024 && 'ontouchstart' in window);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

    // Screen size breakpoints
    let screenSize: DeviceInfo['screenSize'];
    if (width < 480) screenSize = 'xs';
    else if (width < 768) screenSize = 'sm';
    else if (width < 1024) screenSize = 'md';
    else if (width < 1280) screenSize = 'lg';
    else screenSize = 'xl';

    // Safe area insets from CSS env()
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaInsets = {
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0')
    };

    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
        isIOS,
        isAndroid,
        isPWA,
        hasTouch: 'ontouchstart' in window,
        screenSize,
        orientation: width > height ? 'landscape' : 'portrait',
        pixelRatio: window.devicePixelRatio || 1,
        safeAreaInsets
    };
}

// Network status hook
export function useNetworkStatus(): NetworkInfo {
    const [status, setStatus] = useState<NetworkInfo>(() => getNetworkStatus());

    useEffect(() => {
        const handleOnline = () => setStatus(getNetworkStatus());
        const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Listen for connection changes
        const connection = (navigator as any).connection;
        if (connection) {
            connection.addEventListener('change', () => setStatus(getNetworkStatus()));
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connection) {
                connection.removeEventListener('change', () => setStatus(getNetworkStatus()));
            }
        };
    }, []);

    return status;
}

function getNetworkStatus(): NetworkInfo {
    const connection = (navigator as any).connection;

    return {
        isOnline: navigator.onLine,
        effectiveType: connection?.effectiveType || 'unknown',
        saveData: connection?.saveData || false,
        downlink: connection?.downlink || 0
    };
}

// Battery status hook
export function useBatteryStatus(): BatteryInfo {
    const [battery, setBattery] = useState<BatteryInfo>({ level: 1, charging: true, supported: false });

    useEffect(() => {
        const getBattery = async () => {
            try {
                const batteryManager = await (navigator as any).getBattery?.();
                if (batteryManager) {
                    const updateBattery = () => {
                        setBattery({
                            level: batteryManager.level,
                            charging: batteryManager.charging,
                            supported: true
                        });
                    };

                    updateBattery();
                    batteryManager.addEventListener('levelchange', updateBattery);
                    batteryManager.addEventListener('chargingchange', updateBattery);

                    return () => {
                        batteryManager.removeEventListener('levelchange', updateBattery);
                        batteryManager.removeEventListener('chargingchange', updateBattery);
                    };
                }
            } catch {
                // Battery API not supported
            }
        };

        getBattery();
    }, []);

    return battery;
}

// Adaptive quality hook - adjusts video quality based on device/network
export function useAdaptiveQuality() {
    const device = useDeviceInfo();
    const network = useNetworkStatus();
    const battery = useBatteryStatus();

    const quality = useMemo(() => {
        // Determine optimal quality
        let maxQuality: '1080p' | '720p' | '480p' | '360p' | '240p' = '1080p';

        // Network constraints
        if (!network.isOnline) return '240p';
        if (network.saveData || network.effectiveType === 'slow-2g') maxQuality = '240p';
        else if (network.effectiveType === '2g') maxQuality = '360p';
        else if (network.effectiveType === '3g') maxQuality = '480p';

        // Device constraints
        if (device.isMobile && device.pixelRatio < 2) {
            maxQuality = Math.min(getQualityIndex(maxQuality), getQualityIndex('720p')) === getQualityIndex(maxQuality)
                ? maxQuality : '720p';
        }

        // Battery constraints
        if (battery.supported && !battery.charging && battery.level < 0.2) {
            maxQuality = Math.min(getQualityIndex(maxQuality), getQualityIndex('480p')) === getQualityIndex(maxQuality)
                ? maxQuality : '480p';
        }

        return maxQuality;
    }, [device, network, battery]);

    const autoPlay = useMemo(() => {
        // Don't autoplay on slow connections or low battery
        if (network.saveData) return false;
        if (network.effectiveType === '2g' || network.effectiveType === 'slow-2g') return false;
        if (battery.supported && !battery.charging && battery.level < 0.1) return false;
        return true;
    }, [network, battery]);

    return { quality, autoPlay, device, network, battery };
}

function getQualityIndex(q: string): number {
    const order = ['240p', '360p', '480p', '720p', '1080p'];
    return order.indexOf(q);
}

// Touch gesture handlers
export function useTouchGestures(options: {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onDoubleTap?: () => void;
    onLongPress?: () => void;
    threshold?: number;
    longPressDelay?: number;
}) {
    const [ref, setRef] = useState<HTMLElement | null>(null);

    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        onDoubleTap,
        onLongPress,
        threshold = 50,
        longPressDelay = 500
    } = options;

    useEffect(() => {
        if (!ref) return;

        let startX = 0;
        let startY = 0;
        let lastTap = 0;
        let longPressTimer: ReturnType<typeof setTimeout> | null = null;

        const handleTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;

            // Long press detection
            if (onLongPress) {
                longPressTimer = setTimeout(() => {
                    onLongPress();
                }, longPressDelay);
            }
        };

        const handleTouchMove = () => {
            // Cancel long press on move
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const deltaX = endX - startX;
            const deltaY = endY - startY;

            // Swipe detection
            if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 0) onSwipeRight?.();
                    else onSwipeLeft?.();
                } else {
                    if (deltaY > 0) onSwipeDown?.();
                    else onSwipeUp?.();
                }
            }

            // Double tap detection
            if (onDoubleTap) {
                const now = Date.now();
                if (now - lastTap < 300) {
                    onDoubleTap();
                }
                lastTap = now;
            }
        };

        ref.addEventListener('touchstart', handleTouchStart, { passive: true });
        ref.addEventListener('touchmove', handleTouchMove, { passive: true });
        ref.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            ref.removeEventListener('touchstart', handleTouchStart);
            ref.removeEventListener('touchmove', handleTouchMove);
            ref.removeEventListener('touchend', handleTouchEnd);
            if (longPressTimer) clearTimeout(longPressTimer);
        };
    }, [ref, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTap, onLongPress, threshold, longPressDelay]);

    return setRef;
}

// Haptic feedback
export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[]) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }, []);

    return {
        light: () => vibrate(10),
        medium: () => vibrate(25),
        heavy: () => vibrate(50),
        success: () => vibrate([10, 50, 10]),
        warning: () => vibrate([50, 50, 50]),
        error: () => vibrate([100, 50, 100])
    };
}

// Orientation lock
export function useOrientationLock() {
    const lock = useCallback(async (orientation: 'portrait' | 'landscape' | 'any') => {
        try {
            const screenOrientation = (screen as any).orientation;
            if (screenOrientation?.lock) {
                if (orientation === 'any') {
                    await screenOrientation.unlock();
                } else {
                    await screenOrientation.lock(orientation === 'portrait' ? 'portrait-primary' : 'landscape-primary');
                }
            }
        } catch {
            // Orientation lock not supported or not in fullscreen
        }
    }, []);

    const unlock = useCallback(async () => {
        try {
            const screenOrientation = (screen as any).orientation;
            if (screenOrientation?.unlock) {
                await screenOrientation.unlock();
            }
        } catch { }
    }, []);

    return { lock, unlock };
}

export default {
    useDeviceInfo,
    useNetworkStatus,
    useBatteryStatus,
    useAdaptiveQuality,
    useTouchGestures,
    useHaptics,
    useOrientationLock
};
