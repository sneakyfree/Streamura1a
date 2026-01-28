import {
    TrendingUp,
    ArrowRight,
    Shield,
    Lock,
    User,
    Camera,
    Star,
    CheckCircle,
    Zap
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface ImprovementTip {
    id: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    estimated_boost: number; // How much it could boost the score (0-1)
    action_type: 'verify_id' | 'enable_2fa' | 'stream_more' | 'complete_profile' | 'add_payment' | 'community';
    action_link: string;
    completed: boolean;
}

interface TrustImprovementTipsProps {
    tips?: ImprovementTip[];
    compact?: boolean;
    onTipAction?: (tip: ImprovementTip) => void;
}

// Action type icons
const actionIcons: Record<string, typeof Shield> = {
    verify_id: User,
    enable_2fa: Lock,
    stream_more: Camera,
    complete_profile: User,
    add_payment: Zap,
    community: Star
};

// Impact colors
const impactStyles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    high: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', label: 'High Impact' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Medium Impact' },
    low: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Low Impact' }
};

function TipCard({ tip, onAction }: { tip: ImprovementTip; onAction?: () => void }) {
    const Icon = actionIcons[tip.action_type] || Shield;
    const style = impactStyles[tip.impact];
    const boostPercent = (tip.estimated_boost * 100).toFixed(0);

    if (tip.completed) {
        return (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3 opacity-60">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                <div className="flex-1">
                    <span className="text-sm text-green-400 line-through">{tip.title}</span>
                    <span className="text-xs text-green-500/70 ml-2">Completed!</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-4 rounded-lg border ${style.border} ${style.bg} transition-all hover:scale-[1.01]`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${style.bg}`}>
                    <Icon className={`h-5 w-5 ${style.text}`} />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-medium text-sm">{tip.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                            +{boostPercent}%
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{tip.description}</p>

                    <Button
                        size="sm"
                        onClick={onAction}
                        className="group"
                    >
                        Take Action
                        <ArrowRight className="h-3 w-3 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>

                <span className={`text-xs ${style.text}`}>{style.label}</span>
            </div>
        </div>
    );
}

export function TrustImprovementTips({
    tips,
    compact = false,
    onTipAction
}: TrustImprovementTipsProps) {
    // Mock tips if none provided
    const mockTips: ImprovementTip[] = [
        {
            id: '1',
            title: 'Enable Two-Factor Authentication',
            description: 'Add an extra layer of security to your account and boost your trust score significantly.',
            impact: 'high',
            estimated_boost: 0.10,
            action_type: 'enable_2fa',
            action_link: '/settings/security',
            completed: false
        },
        {
            id: '2',
            title: 'Verify Your Identity',
            description: 'Complete identity verification to unlock full platform features and maximum trust.',
            impact: 'high',
            estimated_boost: 0.25,
            action_type: 'verify_id',
            action_link: '/settings/verification',
            completed: true
        },
        {
            id: '3',
            title: 'Stream More Content',
            description: 'Increase your streaming hours to build a stronger track record.',
            impact: 'medium',
            estimated_boost: 0.05,
            action_type: 'stream_more',
            action_link: '/stream',
            completed: false
        },
        {
            id: '4',
            title: 'Complete Your Profile',
            description: 'Add a bio, profile picture, and social links to appear more trustworthy.',
            impact: 'low',
            estimated_boost: 0.02,
            action_type: 'complete_profile',
            action_link: '/settings/profile',
            completed: false
        }
    ];

    const displayTips = tips || mockTips;
    const incompleteTips = displayTips.filter(t => !t.completed);
    const completedTips = displayTips.filter(t => t.completed);

    // Calculate potential boost
    const potentialBoost = incompleteTips.reduce((sum, tip) => sum + tip.estimated_boost, 0);

    if (compact) {
        // Show only top 2 high-impact incomplete tips
        const topTips = incompleteTips
            .sort((a, b) => b.estimated_boost - a.estimated_boost)
            .slice(0, 2);

        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Quick wins available</span>
                    <span className="text-green-400">+{(potentialBoost * 100).toFixed(0)}% potential</span>
                </div>
                {topTips.map(tip => (
                    <TipCard
                        key={tip.id}
                        tip={tip}
                        onAction={() => onTipAction?.(tip)}
                    />
                ))}
            </div>
        );
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    <h3 className="text-white font-medium">Improve Your Trust Score</h3>
                </div>
                {potentialBoost > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                        Up to +{(potentialBoost * 100).toFixed(0)}% available
                    </span>
                )}
            </div>

            <div className="p-4 space-y-3">
                {incompleteTips.length === 0 ? (
                    <div className="text-center py-6">
                        <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                        <p className="text-white font-medium">All improvements completed!</p>
                        <p className="text-sm text-slate-400">Your trust score is at its maximum potential.</p>
                    </div>
                ) : (
                    incompleteTips.map(tip => (
                        <TipCard
                            key={tip.id}
                            tip={tip}
                            onAction={() => onTipAction?.(tip)}
                        />
                    ))
                )}

                {completedTips.length > 0 && (
                    <div className="pt-3 border-t border-slate-700">
                        <p className="text-xs text-slate-500 mb-2">Completed ({completedTips.length})</p>
                        <div className="space-y-2">
                            {completedTips.map(tip => (
                                <TipCard key={tip.id} tip={tip} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

export default TrustImprovementTips;
