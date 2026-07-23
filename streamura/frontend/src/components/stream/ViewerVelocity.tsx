import { useEffect, useState } from 'react';
import { Flame, TrendingUp, TrendingDown, Minus, Rocket, Zap } from 'lucide-react';

interface ViewerVelocityProps {
    streamId: string;
    currentViewers: number;
    previousViewers?: number;
    velocityPerMinute?: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

type VelocityTrend = 'surging' | 'rising' | 'steady' | 'declining' | 'dropping';

interface VelocityState {
    trend: VelocityTrend;
    rate: number; // viewers per minute
    percentChange: number;
}

function calculateVelocity(
    current: number,
    previous: number,
    velocityPerMinute?: number
): VelocityState {
    if (velocityPerMinute !== undefined) {
        // Use provided velocity
        const percentChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        let trend: VelocityTrend = 'steady';

        if (velocityPerMinute >= 50) trend = 'surging';
        else if (velocityPerMinute >= 10) trend = 'rising';
        else if (velocityPerMinute <= -50) trend = 'dropping';
        else if (velocityPerMinute <= -10) trend = 'declining';

        return { trend, rate: velocityPerMinute, percentChange };
    }

    // Calculate from current/previous
    const diff = current - previous;
    const percentChange = previous > 0 ? (diff / previous) * 100 : 0;

    let trend: VelocityTrend = 'steady';
    if (percentChange >= 20) trend = 'surging';
    else if (percentChange >= 5) trend = 'rising';
    else if (percentChange <= -20) trend = 'dropping';
    else if (percentChange <= -5) trend = 'declining';

    return { trend, rate: diff, percentChange };
}

const trendConfig: Record<VelocityTrend, {
    icon: typeof Flame;
    color: string;
    bgColor: string;
    label: string;
    animate?: boolean;
}> = {
    surging: {
        icon: Rocket,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        label: 'Surging',
        animate: true
    },
    rising: {
        icon: TrendingUp,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        label: 'Rising'
    },
    steady: {
        icon: Minus,
        color: 'text-slate-400',
        bgColor: 'bg-slate-500/20',
        label: 'Steady'
    },
    declining: {
        icon: TrendingDown,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        label: 'Declining'
    },
    dropping: {
        icon: Zap,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        label: 'Dropping'
    }
};

const sizeConfig = {
    sm: {
        container: 'px-1.5 py-0.5 gap-1',
        icon: 'w-3 h-3',
        text: 'text-xs'
    },
    md: {
        container: 'px-2 py-1 gap-1.5',
        icon: 'w-4 h-4',
        text: 'text-sm'
    },
    lg: {
        container: 'px-3 py-1.5 gap-2',
        icon: 'w-5 h-5',
        text: 'text-base'
    }
};

export function ViewerVelocity({
    currentViewers,
    previousViewers = 0,
    velocityPerMinute,
    showLabel = false,
    size = 'md'
}: ViewerVelocityProps) {
    const [velocity, setVelocity] = useState<VelocityState>(() =>
        calculateVelocity(currentViewers, previousViewers, velocityPerMinute)
    );

    useEffect(() => {
        setVelocity(calculateVelocity(currentViewers, previousViewers, velocityPerMinute));
    }, [currentViewers, previousViewers, velocityPerMinute]);

    const config = trendConfig[velocity.trend];
    const sizes = sizeConfig[size];
    const Icon = config.icon;

    // Don't show if steady with very small movements
    if (velocity.trend === 'steady' && Math.abs(velocity.rate) < 2) {
        return null;
    }

    const formatRate = (rate: number) => {
        const absRate = Math.abs(rate);
        if (absRate >= 1000) return `${(rate / 1000).toFixed(1)}k`;
        return rate > 0 ? `+${rate}` : `${rate}`;
    };

    return (
        <div
            className={`inline-flex items-center rounded-full ${config.bgColor} ${sizes.container}`}
            title={`${config.label}: ${formatRate(velocity.rate)}/min (${velocity.percentChange.toFixed(1)}% change)`}
        >
            <Icon
                className={`${sizes.icon} ${config.color} ${config.animate ? 'animate-pulse' : ''}`}
            />
            {showLabel && (
                <span className={`${sizes.text} ${config.color} font-medium`}>
                    {config.label}
                </span>
            )}
            {velocity.rate !== 0 && (
                <span className={`${sizes.text} ${config.color} font-mono`}>
                    {formatRate(velocity.rate)}/m
                </span>
            )}
        </div>
    );
}

// Compact version for stream cards
export function ViewerVelocityBadge({
    currentViewers,
    previousViewers = 0,
    velocityPerMinute
}: {
    currentViewers: number;
    previousViewers?: number;
    velocityPerMinute?: number;
}) {
    const velocity = calculateVelocity(currentViewers, previousViewers, velocityPerMinute);
    const config = trendConfig[velocity.trend];
    const Icon = config.icon;

    if (velocity.trend === 'steady') return null;

    return (
        <span className={`inline-flex items-center gap-0.5 ${config.color}`}>
            <Icon className={`w-3 h-3 ${config.animate ? 'animate-pulse' : ''}`} />
        </span>
    );
}

// Hook for real-time velocity tracking
export function useViewerVelocity(_streamId: string) {
    const [history, setHistory] = useState<{ time: number; viewers: number }[]>([]);
    const [velocity, setVelocity] = useState<VelocityState>({
        trend: 'steady',
        rate: 0,
        percentChange: 0
    });

    const recordViewerCount = (viewers: number) => {
        const now = Date.now();
        setHistory(prev => {
            const updated = [...prev, { time: now, viewers }];
            // Keep last 5 minutes of data
            const fiveMinutesAgo = now - 5 * 60 * 1000;
            return updated.filter(h => h.time >= fiveMinutesAgo);
        });
    };

    useEffect(() => {
        if (history.length < 2) return;

        const latest = history[history.length - 1];
        const oneMinuteAgo = latest.time - 60 * 1000;
        const earlier = history.find(h => h.time <= oneMinuteAgo) || history[0];

        const timeDiffMinutes = (latest.time - earlier.time) / 60000;
        const viewerDiff = latest.viewers - earlier.viewers;
        const ratePerMinute = timeDiffMinutes > 0 ? viewerDiff / timeDiffMinutes : 0;

        setVelocity(calculateVelocity(latest.viewers, earlier.viewers, ratePerMinute));
    }, [history]);

    return { velocity, recordViewerCount };
}

export default ViewerVelocity;
