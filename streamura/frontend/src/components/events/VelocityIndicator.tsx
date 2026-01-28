import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Flame, ArrowUp, ArrowDown } from 'lucide-react';

interface VelocityDataPoint {
    timestamp: string;
    viewer_count: number;
    velocity: number; // viewers per minute
}

interface VelocityIndicatorProps {
    currentVelocity: number;
    velocityHistory?: VelocityDataPoint[];
    trend?: 'rising' | 'stable' | 'falling';
    showChart?: boolean;
    showFlames?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

// Color based on velocity magnitude
const getVelocityColor = (velocity: number): string => {
    if (velocity > 100) return 'text-red-500';
    if (velocity > 50) return 'text-orange-500';
    if (velocity > 20) return 'text-yellow-500';
    if (velocity > 10) return 'text-green-500';
    if (velocity > 0) return 'text-blue-400';
    if (velocity < -10) return 'text-red-400';
    return 'text-slate-400';
};

// Background color for badges
const getVelocityBgColor = (velocity: number): string => {
    if (velocity > 100) return 'bg-red-500/20';
    if (velocity > 50) return 'bg-orange-500/20';
    if (velocity > 20) return 'bg-yellow-500/20';
    if (velocity > 10) return 'bg-green-500/20';
    if (velocity > 0) return 'bg-blue-500/20';
    return 'bg-slate-500/20';
};

// Determine trend from history
const calculateTrend = (history: VelocityDataPoint[]): 'rising' | 'stable' | 'falling' => {
    if (history.length < 2) return 'stable';

    const recent = history.slice(-3);
    const avgRecent = recent.reduce((sum, p) => sum + p.velocity, 0) / recent.length;
    const older = history.slice(-6, -3);
    const avgOlder = older.length > 0
        ? older.reduce((sum, p) => sum + p.velocity, 0) / older.length
        : avgRecent;

    const change = avgRecent - avgOlder;
    if (change > 5) return 'rising';
    if (change < -5) return 'falling';
    return 'stable';
};

// Mini sparkline chart
function VelocitySparkline({ data, width = 80, height = 24 }: { data: VelocityDataPoint[]; width?: number; height?: number }) {
    const points = useMemo(() => {
        if (data.length < 2) return '';

        const velocities = data.map(d => d.velocity);
        const minV = Math.min(...velocities);
        const maxV = Math.max(...velocities);
        const range = maxV - minV || 1;

        return data.map((point, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = height - ((point.velocity - minV) / range) * (height - 4);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    }, [data, width, height]);

    const trend = calculateTrend(data);
    const strokeColor = trend === 'rising' ? '#22c55e' : trend === 'falling' ? '#ef4444' : '#94a3b8';

    return (
        <svg width={width} height={height} className="overflow-visible">
            <path
                d={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Current point dot */}
            {data.length > 0 && (
                <circle
                    cx={width}
                    cy={height - ((data[data.length - 1].velocity - Math.min(...data.map(d => d.velocity))) /
                        (Math.max(...data.map(d => d.velocity)) - Math.min(...data.map(d => d.velocity)) || 1)) * (height - 4)}
                    r={3}
                    fill={strokeColor}
                />
            )}
        </svg>
    );
}

// Animated flames for viral content
function FlameIndicator({ velocity }: { velocity: number }) {
    const flameCount = velocity > 100 ? 3 : velocity > 50 ? 2 : 1;

    return (
        <div className="flex items-center">
            {Array.from({ length: flameCount }).map((_, i) => (
                <Flame
                    key={i}
                    className={`w-4 h-4 text-orange-500 ${i > 0 ? '-ml-1' : ''} animate-pulse`}
                    style={{ animationDelay: `${i * 100}ms` }}
                />
            ))}
        </div>
    );
}

export function VelocityIndicator({
    currentVelocity,
    velocityHistory = [],
    trend: propTrend,
    showChart = false,
    showFlames = true,
    size = 'md',
    className = ''
}: VelocityIndicatorProps) {
    const trend = propTrend || calculateTrend(velocityHistory);
    const color = getVelocityColor(currentVelocity);
    const bgColor = getVelocityBgColor(currentVelocity);

    const sizeClasses = {
        sm: 'text-xs px-1.5 py-0.5',
        md: 'text-sm px-2 py-1',
        lg: 'text-base px-3 py-1.5'
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5'
    };

    const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'falling' ? TrendingDown : Minus;
    const ArrowIcon = currentVelocity > 0 ? ArrowUp : ArrowDown;

    // Format velocity display
    const formatVelocity = (v: number): string => {
        if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
        return v.toFixed(0);
    };

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            {/* Main velocity badge */}
            <div className={`flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${bgColor} ${color}`}>
                {currentVelocity !== 0 && (
                    <ArrowIcon className={iconSizes[size]} />
                )}
                <span>
                    {currentVelocity > 0 ? '+' : ''}
                    {formatVelocity(currentVelocity)}
                </span>
                <span className="text-slate-400 font-normal">/min</span>
            </div>

            {/* Trend indicator */}
            <div className={`flex items-center gap-0.5 ${color}`}>
                <TrendIcon className={iconSizes[size]} />
                {size !== 'sm' && (
                    <span className="text-xs capitalize">{trend}</span>
                )}
            </div>

            {/* Flames for viral content */}
            {showFlames && currentVelocity > 30 && (
                <FlameIndicator velocity={currentVelocity} />
            )}

            {/* Sparkline chart */}
            {showChart && velocityHistory.length >= 2 && (
                <VelocitySparkline
                    data={velocityHistory}
                    width={size === 'lg' ? 100 : size === 'md' ? 80 : 60}
                    height={size === 'lg' ? 32 : size === 'md' ? 24 : 16}
                />
            )}
        </div>
    );
}

// Compact inline version for lists
export function VelocityBadge({ velocity, className = '' }: { velocity: number; className?: string }) {
    if (Math.abs(velocity) < 1) return null;

    const color = getVelocityColor(velocity);
    const bgColor = getVelocityBgColor(velocity);

    return (
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${color} ${className}`}>
            {velocity > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {velocity > 0 ? '+' : ''}{Math.round(velocity)}
        </span>
    );
}

// Large display for event headers
export function VelocityDisplay({
    velocity,
    viewerCount,
    history = [],
    className = ''
}: {
    velocity: number;
    viewerCount: number;
    history?: VelocityDataPoint[];
    className?: string;
}) {
    const color = getVelocityColor(velocity);

    return (
        <div className={`flex flex-col ${className}`}>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                    {viewerCount.toLocaleString()}
                </span>
                <span className="text-slate-400">viewers</span>
            </div>

            <div className={`flex items-center gap-2 mt-1 ${color}`}>
                {velocity > 0 ? (
                    <TrendingUp className="w-5 h-5" />
                ) : velocity < 0 ? (
                    <TrendingDown className="w-5 h-5" />
                ) : (
                    <Minus className="w-5 h-5" />
                )}
                <span className="text-lg font-semibold">
                    {velocity > 0 ? '+' : ''}{Math.round(velocity)} /min
                </span>
                {velocity > 30 && <FlameIndicator velocity={velocity} />}
            </div>

            {history.length >= 5 && (
                <div className="mt-2">
                    <VelocitySparkline data={history} width={120} height={32} />
                </div>
            )}
        </div>
    );
}

export default VelocityIndicator;
