import { useState, useEffect, type ReactNode } from 'react';

// Types
interface BreakpointConfig {
    mobile: number;
    tablet: number;
    desktop: number;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveLayoutProps {
    children: ReactNode;
    mobileContent?: ReactNode;
    tabletContent?: ReactNode;
    desktopContent?: ReactNode;
    breakpoints?: Partial<BreakpointConfig>;
}

// Default breakpoints
const DEFAULT_BREAKPOINTS: BreakpointConfig = {
    mobile: 640,
    tablet: 1024,
    desktop: 1280
};

// Hook to detect device type and screen size
export function useDeviceType(customBreakpoints?: Partial<BreakpointConfig>): {
    deviceType: DeviceType;
    width: number;
    height: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isLandscape: boolean;
    isTouchDevice: boolean;
} {
    const breakpoints = { ...DEFAULT_BREAKPOINTS, ...customBreakpoints };

    const [state, setState] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1024,
        height: typeof window !== 'undefined' ? window.innerHeight : 768,
        isTouchDevice: typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    });

    useEffect(() => {
        const handleResize = () => {
            setState(prev => ({
                ...prev,
                width: window.innerWidth,
                height: window.innerHeight
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const deviceType: DeviceType =
        state.width < breakpoints.mobile ? 'mobile' :
            state.width < breakpoints.tablet ? 'tablet' : 'desktop';

    return {
        deviceType,
        width: state.width,
        height: state.height,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isLandscape: state.width > state.height,
        isTouchDevice: state.isTouchDevice
    };
}

// Hook for safe area insets (notch, home indicator)
export function useSafeAreaInsets() {
    const [insets, setInsets] = useState({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
    });

    useEffect(() => {
        const computeInsets = () => {
            const style = getComputedStyle(document.documentElement);
            setInsets({
                top: parseInt(style.getPropertyValue('--sat') || '0') || 0,
                bottom: parseInt(style.getPropertyValue('--sab') || '0') || 0,
                left: parseInt(style.getPropertyValue('--sal') || '0') || 0,
                right: parseInt(style.getPropertyValue('--sar') || '0') || 0
            });
        };

        computeInsets();
        window.addEventListener('resize', computeInsets);
        return () => window.removeEventListener('resize', computeInsets);
    }, []);

    return insets;
}

// Responsive layout wrapper
export function ResponsiveLayout({
    children,
    mobileContent,
    tabletContent,
    desktopContent,
    breakpoints
}: ResponsiveLayoutProps) {
    const { deviceType } = useDeviceType(breakpoints);

    // Render device-specific content if provided
    if (deviceType === 'mobile' && mobileContent) return <>{mobileContent}</>;
    if (deviceType === 'tablet' && tabletContent) return <>{tabletContent}</>;
    if (deviceType === 'desktop' && desktopContent) return <>{desktopContent}</>;

    return <>{children}</>;
}

// Mobile-optimized container with safe areas
export function MobileContainer({
    children,
    className = '',
    withBottomNav = true,
    withTopBar = true
}: {
    children: ReactNode;
    className?: string;
    withBottomNav?: boolean;
    withTopBar?: boolean;
}) {
    const insets = useSafeAreaInsets();

    return (
        <div
            className={`min-h-screen bg-slate-900 ${className}`}
            style={{
                paddingTop: withTopBar ? `max(${insets.top}px, 48px)` : insets.top,
                paddingBottom: withBottomNav ? `max(${insets.bottom}px, 60px)` : insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right
            }}
        >
            {children}
        </div>
    );
}

// Touch-friendly button
export function TouchButton({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = ''
}: {
    children: ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    className?: string;
}) {
    const baseClasses = 'font-medium rounded-xl transition-all active:scale-95 touch-manipulation';

    const variantClasses = {
        primary: 'bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700',
        secondary: 'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-800',
        ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 active:bg-slate-700'
    };

    const sizeClasses = {
        sm: 'px-3 py-2 text-sm min-h-[36px]',
        md: 'px-4 py-3 text-base min-h-[44px]',  // 44px minimum for touch targets
        lg: 'px-6 py-4 text-lg min-h-[52px]'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {children}
        </button>
    );
}

// Swipeable card
export function SwipeableCard({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftAction,
    rightAction,
    className = ''
}: {
    children: ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftAction?: ReactNode;
    rightAction?: ReactNode;
    className?: string;
}) {
    const [offset, setOffset] = useState(0);
    const [startX, setStartX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        setStartX(e.touches[0].clientX);
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        // Limit swipe distance with resistance
        const maxOffset = 120;
        const resistance = 0.5;
        let newOffset = diff;

        if (Math.abs(diff) > maxOffset) {
            newOffset = (diff > 0 ? 1 : -1) * (maxOffset + (Math.abs(diff) - maxOffset) * resistance);
        }

        setOffset(newOffset);
    };

    const handleTouchEnd = () => {
        if (offset > THRESHOLD && onSwipeRight) {
            onSwipeRight();
        } else if (offset < -THRESHOLD && onSwipeLeft) {
            onSwipeLeft();
        }

        setOffset(0);
        setIsDragging(false);
    };

    return (
        <div className="relative overflow-hidden">
            {/* Left action background */}
            {rightAction && (
                <div className="absolute inset-y-0 left-0 flex items-center px-4 bg-green-500">
                    {rightAction}
                </div>
            )}

            {/* Right action background */}
            {leftAction && (
                <div className="absolute inset-y-0 right-0 flex items-center px-4 bg-red-500">
                    {leftAction}
                </div>
            )}

            {/* Card content */}
            <div
                className={`relative bg-slate-800 transition-transform ${isDragging ? '' : 'duration-300'} ${className}`}
                style={{ transform: `translateX(${offset}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
}

// Haptic feedback helper
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    if ('vibrate' in navigator) {
        const patterns = {
            light: [10],
            medium: [20],
            heavy: [30]
        };
        navigator.vibrate(patterns[type]);
    }
}

export default ResponsiveLayout;
