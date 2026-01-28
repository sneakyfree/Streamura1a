import { useQuery } from '@tanstack/react-query';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Star,
    Award,
    Crown,
    Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TrustBadgeProps {
    userId: number;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showScore?: boolean;
    className?: string;
}

interface TrustBadgeData {
    score: number;
    tier: string;
    icon: string;
    color: string;
    label: string;
}

const tierConfig: Record<string, {
    icon: React.ElementType;
    bgColor: string;
    textColor: string;
    borderColor: string;
    glowColor: string;
}> = {
    platinum: {
        icon: Crown,
        bgColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
        textColor: 'text-white',
        borderColor: 'border-purple-400',
        glowColor: 'shadow-purple-500/50',
    },
    gold: {
        icon: Award,
        bgColor: 'bg-gradient-to-r from-yellow-500 to-amber-500',
        textColor: 'text-white',
        borderColor: 'border-yellow-400',
        glowColor: 'shadow-yellow-500/50',
    },
    silver: {
        icon: ShieldCheck,
        bgColor: 'bg-gradient-to-r from-slate-400 to-slate-500',
        textColor: 'text-white',
        borderColor: 'border-slate-400',
        glowColor: 'shadow-slate-500/50',
    },
    bronze: {
        icon: Shield,
        bgColor: 'bg-gradient-to-r from-amber-700 to-amber-800',
        textColor: 'text-white',
        borderColor: 'border-amber-600',
        glowColor: 'shadow-amber-700/50',
    },
    unverified: {
        icon: ShieldAlert,
        bgColor: 'bg-slate-700',
        textColor: 'text-slate-400',
        borderColor: 'border-slate-600',
        glowColor: '',
    },
};

const sizeConfig = {
    sm: {
        container: 'h-5 px-1.5 gap-1 text-xs',
        icon: 'h-3 w-3',
    },
    md: {
        container: 'h-6 px-2 gap-1.5 text-sm',
        icon: 'h-4 w-4',
    },
    lg: {
        container: 'h-8 px-3 gap-2 text-base',
        icon: 'h-5 w-5',
    },
};

export function TrustBadge({
    userId,
    size = 'md',
    showLabel = true,
    showScore = false,
    className,
}: TrustBadgeProps) {
    const { data: badge, isLoading } = useQuery({
        queryKey: ['trust-badge', userId],
        queryFn: async () => {
            const response = await api.get(`/trust-badge/${userId}`);
            return response.data as TrustBadgeData;
        },
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });

    if (isLoading) {
        return (
            <div className={cn(
                'inline-flex items-center rounded-full bg-slate-700/50',
                sizeConfig[size].container,
                className
            )}>
                <Loader2 className={cn(sizeConfig[size].icon, 'animate-spin text-slate-400')} />
            </div>
        );
    }

    if (!badge) {
        return null;
    }

    const tier = tierConfig[badge.tier] || tierConfig.unverified;
    const Icon = tier.icon;
    const sizes = sizeConfig[size];

    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full border font-medium',
                tier.bgColor,
                tier.textColor,
                tier.borderColor,
                tier.glowColor && `shadow-lg ${tier.glowColor}`,
                sizes.container,
                className
            )}
            title={`Trust Score: ${badge.score}/100 - ${badge.label}`}
        >
            <Icon className={sizes.icon} />
            {showLabel && <span>{badge.label}</span>}
            {showScore && <span className="opacity-75">{badge.score}</span>}
        </div>
    );
}

// Compact version for avatars
export function TrustIndicator({
    userId,
    className,
}: {
    userId: number;
    className?: string;
}) {
    const { data: badge } = useQuery({
        queryKey: ['trust-badge', userId],
        queryFn: async () => {
            const response = await api.get(`/trust-badge/${userId}`);
            return response.data as TrustBadgeData;
        },
        staleTime: 1000 * 60 * 5,
    });

    if (!badge || badge.tier === 'unverified') {
        return null;
    }

    const tier = tierConfig[badge.tier];
    const Icon = tier.icon;

    return (
        <div
            className={cn(
                'absolute -bottom-1 -right-1 p-0.5 rounded-full',
                tier.bgColor,
                className
            )}
            title={badge.label}
        >
            <Icon className="h-3 w-3 text-white" />
        </div>
    );
}

// Large card version for profiles
export function TrustScoreCard({
    userId,
    className,
}: {
    userId: number;
    className?: string;
}) {
    const { data: trustData, isLoading } = useQuery({
        queryKey: ['trust-score', userId],
        queryFn: async () => {
            const response = await api.get(`/trust-score/${userId}`);
            return response.data;
        },
        staleTime: 1000 * 60 * 5,
    });

    if (isLoading) {
        return (
            <div className={cn('p-4 bg-slate-800 rounded-xl animate-pulse', className)}>
                <div className="h-20 bg-slate-700 rounded-lg" />
            </div>
        );
    }

    if (!trustData) {
        return null;
    }

    const tier = tierConfig[trustData.tier] || tierConfig.unverified;
    const Icon = tier.icon;
    const score = trustData.score || 0;

    return (
        <div className={cn('p-4 bg-slate-800 rounded-xl border border-slate-700', className)}>
            <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                    'h-14 w-14 rounded-xl flex items-center justify-center',
                    tier.bgColor,
                    tier.glowColor && `shadow-lg ${tier.glowColor}`
                )}>
                    <Icon className="h-7 w-7 text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">{trustData.tier.charAt(0).toUpperCase() + trustData.tier.slice(1)} Creator</h3>
                    <p className="text-sm text-slate-400">Trust Score: {score}/100</p>
                </div>
            </div>

            {/* Score bar */}
            <div className="mb-4">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={cn('h-full transition-all duration-500', tier.bgColor)}
                        style={{ width: `${score}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1 text-xs text-slate-500">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                </div>
            </div>

            {/* Breakdown if available */}
            {trustData.breakdown && (
                <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Score Breakdown</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(trustData.breakdown).slice(0, 6).map(([key, data]: [string, any]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-slate-700/50 rounded-lg">
                                <span className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                <span className="text-xs font-medium text-white">{data.score}/{data.max}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {trustData.recommendations && trustData.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Improve Your Score</h4>
                    <ul className="space-y-1">
                        {trustData.recommendations.slice(0, 3).map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <Star className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
