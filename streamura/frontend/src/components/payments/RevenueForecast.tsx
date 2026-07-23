import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    DollarSign,
    Calendar,
    Info,
    ChevronDown,
    ChevronUp,
    Zap,
    ArrowRight
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface ForecastDataPoint {
    date: string;
    predicted: number;
    confidence_low: number;
    confidence_high: number;
    actual?: number;
}

interface SourceBreakdown {
    tips: number;
    subscriptions: number;
    virtual_goods: number;
    events: number;
}

interface Forecast {
    period_start: string;
    period_end: string;
    predicted_revenue: number;
    confidence_low: number;
    confidence_high: number;
    confidence_level: number;
    breakdown: SourceBreakdown;
    assumptions: string[];
}

interface TrendAnalysis {
    direction: 'strong_up' | 'up' | 'stable' | 'down' | 'strong_down';
    velocity: number;
    seasonality_factor: number;
    best_day_of_week: string;
    best_hour_of_day: number;
    growth_contributors: { factor: string; impact: number }[];
    risk_factors: { factor: string; impact: number }[];
}

interface RevenueForecastProps {
    creatorId?: number;
    months?: number;
    showTrends?: boolean;
    showBreakdown?: boolean;
    compact?: boolean;
}

// Fetch forecast data
const fetchForecast = async (creatorId?: number, months?: number) => {
    const params = new URLSearchParams();
    if (creatorId) params.set('creator_id', creatorId.toString());
    if (months) params.set('months', months.toString());

    const res = await fetch(`/api/v1/revenue/forecast?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch forecast');
    return res.json();
};

// Direction icons and colors
const trendConfig = {
    strong_up: { icon: TrendingUp, color: 'text-green-400', label: 'Strong Growth' },
    up: { icon: TrendingUp, color: 'text-green-300', label: 'Growing' },
    stable: { icon: Minus, color: 'text-slate-400', label: 'Stable' },
    down: { icon: TrendingDown, color: 'text-orange-400', label: 'Declining' },
    strong_down: { icon: TrendingDown, color: 'text-red-400', label: 'Sharp Decline' }
};

// Source colors
const sourceColors: Record<string, string> = {
    tips: '#a855f7',
    subscriptions: '#3b82f6',
    virtual_goods: '#22c55e',
    events: '#f97316'
};

// Chart component
function ForecastChart({
    data,
    width = 600,
    height = 200
}: {
    data: ForecastDataPoint[];
    width?: number;
    height?: number;
}) {
    const chartData = useMemo(() => {
        if (data.length === 0) return { points: '', areaPath: '', confidencePath: '' };

        const maxValue = Math.max(...data.map(d => d.confidence_high));
        const minValue = Math.min(...data.map(d => d.confidence_low));
        const range = maxValue - minValue || 1;

        const padding = { left: 50, right: 20, top: 20, bottom: 30 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Main prediction line
        const points = data.map((d, i) => {
            const x = padding.left + (i / Math.max(1, data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.predicted - minValue) / range) * chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        // Confidence area
        const upperPoints = data.map((d, i) => {
            const x = padding.left + (i / Math.max(1, data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.confidence_high - minValue) / range) * chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        const lowerPoints = [...data].reverse().map((d, i) => {
            const x = padding.left + ((data.length - 1 - i) / Math.max(1, data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.confidence_low - minValue) / range) * chartHeight;
            return `L ${x} ${y}`;
        }).join(' ');

        const confidencePath = `${upperPoints} ${lowerPoints} Z`;

        // Actual data points if available
        const actualPoints = data.filter(d => d.actual !== undefined).map((d) => {
            const originalIndex = data.indexOf(d);
            const x = padding.left + (originalIndex / Math.max(1, data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.actual! - minValue) / range) * chartHeight;
            return { x, y, value: d.actual };
        });

        return { points, confidencePath, actualPoints, padding, chartHeight, minValue, maxValue, range };
    }, [data, width, height]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                No forecast data available
            </div>
        );
    }

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Confidence area */}
            <path
                d={chartData.confidencePath}
                fill="url(#confidenceGradient)"
                opacity={0.3}
            />

            {/* Prediction line */}
            <path
                d={chartData.points}
                fill="none"
                stroke="#a855f7"
                strokeWidth={3}
                strokeLinecap="round"
            />

            {/* Actual points */}
            {chartData.actualPoints?.map((point, i) => (
                <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r={5}
                    fill="#22c55e"
                    stroke="#1e293b"
                    strokeWidth={2}
                />
            ))}

            {/* X-axis labels */}
            {data.map((d, i) => (
                <text
                    key={i}
                    x={(chartData.padding?.left || 0) + (i / Math.max(1, data.length - 1)) * (width - (chartData.padding?.left || 0) - (chartData.padding?.right || 0))}
                    y={height - 5}
                    textAnchor="middle"
                    className="fill-slate-500 text-xs"
                >
                    {d.date}
                </text>
            ))}

            {/* Y-axis labels */}
            <text x={5} y={(chartData.padding?.top || 0) + 5} className="fill-slate-500 text-xs">
                ${((chartData.maxValue || 0) / 1000).toFixed(0)}k
            </text>
            <text x={5} y={height - (chartData.padding?.bottom || 0)} className="fill-slate-500 text-xs">
                ${((chartData.minValue || 0) / 1000).toFixed(0)}k
            </text>

            {/* Gradient definition */}
            <defs>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0.1} />
                </linearGradient>
            </defs>
        </svg>
    );
}

// Breakdown bar component
function BreakdownBar({ breakdown, total }: { breakdown: SourceBreakdown; total: number }) {
    const sources = [
        { key: 'tips', label: 'Tips', value: breakdown.tips || 0 },
        { key: 'subscriptions', label: 'Subs', value: breakdown.subscriptions || 0 },
        { key: 'virtual_goods', label: 'Virtual Goods', value: breakdown.virtual_goods || 0 },
        { key: 'events', label: 'Events', value: breakdown.events || 0 }
    ].filter(s => s.value > 0);

    return (
        <div className="space-y-2">
            <div className="h-3 rounded-full overflow-hidden flex bg-slate-700">
                {sources.map(source => (
                    <div
                        key={source.key}
                        className="h-full transition-all"
                        style={{
                            width: `${(source.value / total) * 100}%`,
                            backgroundColor: sourceColors[source.key]
                        }}
                    />
                ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
                {sources.map(source => (
                    <div key={source.key} className="flex items-center gap-1">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: sourceColors[source.key] }}
                        />
                        <span className="text-slate-400">{source.label}:</span>
                        <span className="text-white font-medium">${source.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function RevenueForecast({
    creatorId,
    months = 3,
    showTrends = true,
    showBreakdown = true,
    compact = false
}: RevenueForecastProps) {
    const [expandedPeriod, setExpandedPeriod] = useState<number | null>(0);

    const { data, isLoading } = useQuery({
        queryKey: ['revenueForecast', creatorId, months],
        queryFn: () => fetchForecast(creatorId, months),
        refetchInterval: 60000
    });

    // Mock data for demo
    const mockData = {
        forecasts: [
            { period_start: '2024-02-01', period_end: '2024-02-29', predicted_revenue: 2450, confidence_low: 1800, confidence_high: 3100, confidence_level: 0.85, breakdown: { tips: 980, subscriptions: 850, virtual_goods: 420, events: 200 }, assumptions: ['Based on 8 months history', 'Trend: growing', 'Seasonality: 0.95'] },
            { period_start: '2024-03-01', period_end: '2024-03-31', predicted_revenue: 2780, confidence_low: 1900, confidence_high: 3600, confidence_level: 0.75, breakdown: { tips: 1112, subscriptions: 920, virtual_goods: 528, events: 220 }, assumptions: ['Based on 8 months history', 'Trend: growing'] },
            { period_start: '2024-04-01', period_end: '2024-04-30', predicted_revenue: 3050, confidence_low: 1950, confidence_high: 4150, confidence_level: 0.65, breakdown: { tips: 1220, subscriptions: 1000, virtual_goods: 610, events: 220 }, assumptions: ['Based on 8 months history', 'Trend: growing'] }
        ] as Forecast[],
        trend: {
            direction: 'up' as const,
            velocity: 12.5,
            seasonality_factor: 0.95,
            best_day_of_week: 'Saturday',
            best_hour_of_day: 20,
            growth_contributors: [
                { factor: 'Consistent streaming schedule', impact: 0.3 },
                { factor: 'Community engagement', impact: 0.25 }
            ],
            risk_factors: [
                { factor: 'Platform competition', impact: -0.1 }
            ]
        } as TrendAnalysis,
        chart_data: [
            { date: 'Jan', predicted: 2100, confidence_low: 1600, confidence_high: 2600, actual: 2150 },
            { date: 'Feb', predicted: 2450, confidence_low: 1800, confidence_high: 3100 },
            { date: 'Mar', predicted: 2780, confidence_low: 1900, confidence_high: 3600 },
            { date: 'Apr', predicted: 3050, confidence_low: 1950, confidence_high: 4150 }
        ] as ForecastDataPoint[]
    };

    const forecastData = data || mockData;
    const trend = forecastData.trend;
    const TrendIcon = trendConfig[(trend?.direction || 'stable') as keyof typeof trendConfig]?.icon || Minus;
    const trendColor = trendConfig[(trend?.direction || 'stable') as keyof typeof trendConfig]?.color || 'text-slate-400';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <DollarSign className="w-6 h-6 animate-pulse mr-2" />
                Loading forecast...
            </div>
        );
    }

    if (compact) {
        const nextMonth = forecastData.forecasts?.[0];
        return (
            <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="p-3 rounded-lg bg-purple-500/20">
                    <DollarSign className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                    <div className="text-sm text-slate-400">Next Month Forecast</div>
                    <div className="text-2xl font-bold text-white">
                        ${nextMonth?.predicted_revenue.toLocaleString()}
                    </div>
                </div>
                <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">
                        {trend?.velocity > 0 ? '+' : ''}{trend?.velocity.toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with trend */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-purple-400" />
                            Revenue Forecast
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Projected revenue for the next {months} months
                        </p>
                    </div>

                    {showTrends && trend && (
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 ${trendColor}`}>
                            <TrendIcon className="h-5 w-5" />
                            <div>
                                <div className="text-sm font-medium">
                                    {trendConfig[trend.direction as keyof typeof trendConfig]?.label || 'Unknown'}
                                </div>
                                <div className="text-xs opacity-75">
                                    {trend.velocity > 0 ? '+' : ''}{trend.velocity.toFixed(1)}% / month
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chart */}
                <ForecastChart data={forecastData.chart_data || []} width={600} height={200} />

                <div className="flex items-center gap-6 mt-4 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-0.5 bg-purple-500 rounded" />
                        <span className="text-slate-400">Predicted</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-slate-400">Actual</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded bg-purple-500/30" />
                        <span className="text-slate-400">Confidence Range</span>
                    </div>
                </div>
            </Card>

            {/* Period breakdown */}
            <div className="space-y-3">
                {forecastData.forecasts?.map((forecast: Forecast, idx: number) => (
                    <Card
                        key={idx}
                        className={`bg-slate-800/50 border-slate-700 transition-all ${expandedPeriod === idx ? 'ring-1 ring-purple-500/50' : ''
                            }`}
                    >
                        <button
                            onClick={() => setExpandedPeriod(expandedPeriod === idx ? null : idx)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2 rounded-lg bg-slate-700">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                </div>
                                <div className="text-left">
                                    <div className="text-white font-medium">
                                        {new Date(forecast.period_start).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Confidence: {(forecast.confidence_level * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-xl font-bold text-white">
                                        ${forecast.predicted_revenue.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        ${forecast.confidence_low.toLocaleString()} - ${forecast.confidence_high.toLocaleString()}
                                    </div>
                                </div>
                                {expandedPeriod === idx ? (
                                    <ChevronUp className="h-5 w-5 text-slate-400" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                        </button>

                        {expandedPeriod === idx && showBreakdown && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-700">
                                <BreakdownBar
                                    breakdown={forecast.breakdown}
                                    total={forecast.predicted_revenue}
                                />

                                {forecast.assumptions?.length > 0 && (
                                    <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                            <Info className="h-3 w-3" />
                                            Assumptions
                                        </div>
                                        <ul className="text-xs text-slate-500 space-y-1">
                                            {forecast.assumptions.map((a, i) => (
                                                <li key={i}>• {a}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                ))}
            </div>

            {/* Growth insights */}
            {showTrends && trend?.growth_contributors?.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium flex items-center gap-2 mb-4">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        Growth Insights
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-slate-500 mb-2">Contributing Factors</div>
                            {trend.growth_contributors.map((c: { factor: string; impact: number }, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <span className="text-sm text-slate-300">{c.factor}</span>
                                    <span className="text-sm text-green-400">+{(c.impact * 100).toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 mb-2">Best Performance</div>
                            <div className="text-sm text-slate-300">
                                <p>Best day: <span className="text-white font-medium">{trend.best_day_of_week}</span></p>
                                <p>Peak hour: <span className="text-white font-medium">{trend.best_hour_of_day}:00</span></p>
                            </div>
                        </div>
                    </div>

                    <Button variant="secondary" className="w-full mt-4">
                        View Full Analytics
                        <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                </Card>
            )}
        </div>
    );
}

export default RevenueForecast;
