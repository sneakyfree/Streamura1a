import { useState } from 'react';
import {
    Brain,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    CheckCircle,
    User,
    Shield,
    TrendingUp,
    Scale,
    MessageSquare,
    FileText,
    BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface DecisionFactor {
    name: string;
    weight: number; // 0-1
    score: number; // 0-1
    contribution: number; // weight * score
    description?: string;
}

interface AgentDecision {
    decision_id: string;
    agent_type: 'orchestrator' | 'discovery' | 'moderation' | 'payout' | 'trust' | 'licensing' | 'emergency';
    action_type: string;
    target_entity: string;
    target_id?: number;
    reasoning: string;
    confidence: number; // 0-1
    factors: DecisionFactor[];
    alternatives_considered: string[];
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    requires_approval: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
    approved_by?: string;
    approved_at?: string;
    created_at: string;
    execution_result?: string;
}

interface AgentDecisionCardProps {
    decision: AgentDecision;
    onApprove?: (decision: AgentDecision) => void;
    onReject?: (decision: AgentDecision) => void;
    onAppeal?: (decision: AgentDecision, reason: string) => void;
    showAppealOption?: boolean;
    expanded?: boolean;
}

// Agent type icons and colors
const agentConfig: Record<string, { icon: typeof Brain; color: string; bgColor: string }> = {
    orchestrator: { icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    discovery: { icon: TrendingUp, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    moderation: { icon: Shield, color: 'text-red-400', bgColor: 'bg-red-500/20' },
    payout: { icon: Scale, color: 'text-green-400', bgColor: 'bg-green-500/20' },
    trust: { icon: CheckCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    licensing: { icon: FileText, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    emergency: { icon: AlertTriangle, color: 'text-orange-400', bgColor: 'bg-orange-500/20' }
};

// Risk level colors
const riskColors: Record<string, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' }
};

// Status colors
const statusColors: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    approved: { bg: 'bg-green-500/20', text: 'text-green-400' },
    rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
    executed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400' }
};

// Factor visualization bar
function FactorBar({ factor }: { factor: DecisionFactor }) {
    const contributionPercent = (factor.contribution * 100).toFixed(1);
    const scorePercent = (factor.score * 100).toFixed(0);
    const weightPercent = (factor.weight * 100).toFixed(0);

    return (
        <div className="mb-3 last:mb-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300">{factor.name}</span>
                <span className="text-xs text-slate-400">
                    {scorePercent}% × {weightPercent}% = <span className="text-white font-medium">{contributionPercent}%</span>
                </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                    style={{ width: `${Math.min(100, factor.score * 100)}%` }}
                />
            </div>
            {factor.description && (
                <p className="text-xs text-slate-500 mt-1">{factor.description}</p>
            )}
        </div>
    );
}

// Confidence gauge
function ConfidenceGauge({ confidence }: { confidence: number }) {
    const percent = Math.round(confidence * 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (confidence * circumference);

    let color = 'text-green-400';
    if (confidence < 0.5) color = 'text-red-400';
    else if (confidence < 0.7) color = 'text-yellow-400';
    else if (confidence < 0.85) color = 'text-blue-400';

    return (
        <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
                <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-700"
                />
                <circle
                    cx="48"
                    cy="48"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={`transition-all duration-500 ${color}`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${color}`}>{percent}%</span>
                <span className="text-xs text-slate-400">confidence</span>
            </div>
        </div>
    );
}

export function AgentDecisionCard({
    decision,
    onApprove,
    onReject,
    onAppeal,
    showAppealOption = false,
    expanded: initialExpanded = false
}: AgentDecisionCardProps) {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const [showAppealForm, setShowAppealForm] = useState(false);
    const [appealReason, setAppealReason] = useState('');

    const agentInfo = agentConfig[decision.agent_type] || agentConfig.orchestrator;
    const riskStyle = riskColors[decision.risk_level];
    const statusStyle = statusColors[decision.status];
    const AgentIcon = agentInfo.icon;

    const handleAppeal = () => {
        if (appealReason.trim() && onAppeal) {
            onAppeal(decision, appealReason);
            setShowAppealForm(false);
            setAppealReason('');
        }
    };

    // Format timestamp
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    return (
        <Card className={`bg-slate-800/50 border ${riskStyle.border} overflow-hidden`}>
            {/* Header */}
            <div
                className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agentInfo.bgColor}`}>
                            <AgentIcon className={`h-5 w-5 ${agentInfo.color}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-white font-medium capitalize">
                                    {decision.agent_type} Agent
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${riskStyle.bg} ${riskStyle.text}`}>
                                    {decision.risk_level} risk
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                                    {decision.status}
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm mt-0.5">
                                {decision.action_type.replace(/_/g, ' ')} → {decision.target_entity}
                                {decision.target_id && ` #${decision.target_id}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <ConfidenceGauge confidence={decision.confidence} />
                        {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                    </div>
                </div>

                {/* Reasoning summary */}
                <div className="mt-3 p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-300 line-clamp-2">{decision.reasoning}</p>
                </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-slate-700">
                    {/* Factor breakdown */}
                    <div className="pt-4">
                        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-purple-400" />
                            Decision Factors
                        </h4>
                        <div className="bg-slate-700/30 rounded-lg p-4">
                            {decision.factors.map((factor, idx) => (
                                <FactorBar key={idx} factor={factor} />
                            ))}
                        </div>
                    </div>

                    {/* Alternatives considered */}
                    {decision.alternatives_considered.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                <Scale className="h-4 w-4 text-blue-400" />
                                Alternatives Considered
                            </h4>
                            <ul className="space-y-1">
                                {decision.alternatives_considered.map((alt, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                        {alt}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-500">Decision ID:</span>
                            <span className="text-slate-300 ml-2 font-mono text-xs">{decision.decision_id.slice(0, 8)}...</span>
                        </div>
                        <div>
                            <span className="text-slate-500">Created:</span>
                            <span className="text-slate-300 ml-2">{formatTime(decision.created_at)}</span>
                        </div>
                        {decision.approved_by && (
                            <>
                                <div>
                                    <span className="text-slate-500">Approved by:</span>
                                    <span className="text-slate-300 ml-2 flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {decision.approved_by}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Approved at:</span>
                                    <span className="text-slate-300 ml-2">{decision.approved_at && formatTime(decision.approved_at)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {decision.status === 'pending' && decision.requires_approval && (
                        <div className="flex gap-3 pt-2">
                            {onApprove && (
                                <Button
                                    onClick={() => onApprove(decision)}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                </Button>
                            )}
                            {onReject && (
                                <Button
                                    onClick={() => onReject(decision)}
                                    variant="danger"
                                    className="flex-1"
                                >
                                    <AlertTriangle className="h-4 w-4 mr-2" />
                                    Reject
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Appeal option */}
                    {showAppealOption && decision.status === 'executed' && (
                        <div className="pt-2">
                            {!showAppealForm ? (
                                <Button
                                    variant="secondary"
                                    className="w-full"
                                    onClick={() => setShowAppealForm(true)}
                                >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Appeal This Decision
                                </Button>
                            ) : (
                                <div className="space-y-3">
                                    <textarea
                                        value={appealReason}
                                        onChange={(e) => setAppealReason(e.target.value)}
                                        placeholder="Explain why you believe this decision should be reviewed..."
                                        className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 resize-none"
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleAppeal}
                                            disabled={!appealReason.trim()}
                                            className="flex-1"
                                        >
                                            Submit Appeal
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                setShowAppealForm(false);
                                                setAppealReason('');
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

export default AgentDecisionCard;
