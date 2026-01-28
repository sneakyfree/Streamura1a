import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusIndicatorProps {
    state: ConnectionState;
    className?: string;
    showText?: boolean;
    onReconnect?: () => void;
}

export function ConnectionStatusIndicator({
    state,
    className,
    showText = false,
    onReconnect,
}: ConnectionStatusIndicatorProps) {
    const configs = {
        connected: {
            icon: Wifi,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
            text: 'Connected',
            animate: false,
        },
        connecting: {
            icon: Loader2,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
            text: 'Connecting...',
            animate: true,
        },
        reconnecting: {
            icon: RefreshCw,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/10',
            text: 'Reconnecting...',
            animate: true,
        },
        disconnected: {
            icon: WifiOff,
            color: 'text-red-500',
            bgColor: 'bg-red-500/10',
            text: 'Disconnected',
            animate: false,
        },
    };

    const config = configs[state];
    const Icon = config.icon;

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <div className={cn('p-1.5 rounded-full', config.bgColor)}>
                <Icon
                    className={cn(
                        'h-4 w-4',
                        config.color,
                        config.animate && 'animate-spin'
                    )}
                />
            </div>

            {showText && (
                <span className={cn('text-sm font-medium', config.color)}>
                    {config.text}
                </span>
            )}

            {state === 'disconnected' && onReconnect && (
                <button
                    onClick={onReconnect}
                    className="text-xs text-primary-400 hover:text-primary-300 underline"
                >
                    Retry
                </button>
            )}
        </div>
    );
}

// Compact dot indicator for minimal UI footprint
interface ConnectionDotProps {
    state: ConnectionState;
    className?: string;
}

export function ConnectionDot({ state, className }: ConnectionDotProps) {
    const colors = {
        connected: 'bg-green-500',
        connecting: 'bg-yellow-500 animate-pulse',
        reconnecting: 'bg-orange-500 animate-pulse',
        disconnected: 'bg-red-500',
    };

    return (
        <div
            className={cn(
                'h-2 w-2 rounded-full',
                colors[state],
                className
            )}
            title={state.charAt(0).toUpperCase() + state.slice(1)}
        />
    );
}
