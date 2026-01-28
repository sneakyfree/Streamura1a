import { useState } from 'react';
import {
    ShieldAlert,
    AlertTriangle,
    CheckCircle,
    Clock,
    XCircle,
    Eye,
    Activity,
    Zap,
    TrendingUp,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface ThreatSignal {
    id: string;
    type: 'spam' | 'bot' | 'harassment' | 'suspicious_activity' | 'fraud' | 'violation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    confidence: number;
    detectedAt: string;
    resolved?: boolean;
}

interface ThreatProfile {
    userId?: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number; // 0-100
    signals: ThreatSignal[];
    lastActivity: string;
    isMonitored: boolean;
}

interface ThreatDetectionIndicatorProps {
    profile: ThreatProfile;
    onAction?: (action: 'monitor' | 'block' | 'review') => void;
    compact?: boolean;
}

const riskConfig = {
    low: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle, label: 'Low Risk' },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertTriangle, label: 'Medium Risk' },
    high: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: ShieldAlert, label: 'High Risk' },
    critical: { color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle, label: 'Critical Risk' }
};

const signalTypeConfig = {
    spam: { icon: Activity, label: 'Spam' },
    bot: { icon: Zap, label: 'Bot Activity' },
    harassment: { icon: AlertTriangle, label: 'Harassment' },
    suspicious_activity: { icon: Eye, label: 'Suspicious' },
    fraud: { icon: ShieldAlert, label: 'Fraud' },
    violation: { icon: XCircle, label: 'Violation' }
};

// Risk gauge component
function RiskGauge({ score, size = 80 }: { score: number; size?: number }) {
    const radius = (size - 8) / 2;
    const circumference = Math.PI * radius; // Half circle
    const progress = (score / 100) * circumference;

    const getColor = () => {
        if (score < 25) return 'text-green-500';
        if (score < 50) return 'text-yellow-500';
        if (score < 75) return 'text-orange-500';
        return 'text-red-500';
    };

    return (
        <div className="relative" style={{ width: size, height: size / 2 + 10 }}>
            <svg width={size} height={size / 2 + 10} className="overflow-visible">
                {/* Background arc */}
                <path
                    d={`M 4 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 4} ${size / 2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={4}
                    className="text-slate-700"
                />
                {/* Progress arc */}
                <path
                    d={`M 4 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 4} ${size / 2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={4}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    className={getColor()}
                />
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center">
                <span className={`text-xl font-bold ${getColor()}`}>{score}</span>
            </div>
        </div>
    );
}

// Signal item component
function SignalItem({ signal }: { signal: ThreatSignal }) {
    const config = signalTypeConfig[signal.type];
    const Icon = config.icon;
    const severity = riskConfig[signal.severity];

    const timeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
        return `${Math.floor(mins / 1440)}d ago`;
    };

    return (
        <div className={`flex items-start gap-3 p-2 rounded ${signal.resolved ? 'opacity-50' : ''}`}>
            <div className={`p-1.5 rounded ${severity.bg}`}>
                <Icon className={`w-3 h-3 ${severity.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{config.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${severity.bg} ${severity.color}`}>
                        {signal.severity}
                    </span>
                    {signal.resolved && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                            Resolved
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400 truncate">{signal.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{Math.round(signal.confidence * 100)}% confidence</span>
                    <span>•</span>
                    <span>{timeAgo(signal.detectedAt)}</span>
                </div>
            </div>
        </div>
    );
}

export function ThreatDetectionIndicator({
    profile,
    onAction,
    compact = false
}: ThreatDetectionIndicatorProps) {
    const [expanded, setExpanded] = useState(!compact);

    const risk = riskConfig[profile.riskLevel];
    const RiskIcon = risk.icon;
    const activeSignals = profile.signals.filter(s => !s.resolved);

    if (compact) {
        return (
            <button
                onClick={() => setExpanded(!expanded)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${risk.bg} ${risk.color}`}
            >
                <RiskIcon className="w-3 h-3" />
                {profile.riskScore}%
                {activeSignals.length > 0 && (
                    <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">
                        {activeSignals.length}
                    </span>
                )}
            </button>
        );
    }

    return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${risk.bg}`}>
                        <RiskIcon className={`w-5 h-5 ${risk.color}`} />
                    </div>
                    <div>
                        <h3 className="text-white font-medium flex items-center gap-2">
                            Threat Detection
                            {profile.isMonitored && (
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px]">
                                    <Eye className="w-2.5 h-2.5 inline mr-0.5" />
                                    Monitored
                                </span>
                            )}
                        </h3>
                        <p className={`text-sm ${risk.color}`}>{risk.label}</p>
                    </div>
                </div>
                <RiskGauge score={profile.riskScore} />
            </div>

            {/* Signals */}
            {profile.signals.length > 0 && (
                <div className="mb-4">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center justify-between w-full text-sm text-slate-400 mb-2"
                    >
                        <span>Active Signals ({activeSignals.length})</span>
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {expanded && (
                        <div className="space-y-1 max-h-48 overflow-y-auto bg-slate-800/50 rounded p-1">
                            {profile.signals.map(signal => (
                                <SignalItem key={signal.id} signal={signal} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            {onAction && (
                <div className="flex items-center gap-2">
                    {!profile.isMonitored && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => onAction('monitor')}
                        >
                            <Eye className="w-3 h-3 mr-1" />
                            Monitor
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => onAction('review')}
                    >
                        Review
                    </Button>
                    {profile.riskLevel !== 'low' && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onAction('block')}
                        >
                            <XCircle className="w-3 h-3 mr-1" />
                            Block
                        </Button>
                    )}
                </div>
            )}
        </Card>
    );
}

// Compact badge for user lists
export function ThreatBadge({ riskLevel, riskScore }: { riskLevel: ThreatProfile['riskLevel']; riskScore: number }) {
    const config = riskConfig[riskLevel];
    const Icon = config.icon;

    if (riskLevel === 'low') return null;

    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bg} ${config.color}`}>
            <Icon className="w-3 h-3" />
            {riskScore}%
        </span>
    );
}

export default ThreatDetectionIndicator;
