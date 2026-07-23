import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    FlaskConical, ArrowRight, RefreshCw, Sparkles,
    TrendingUp, TrendingDown, Minus, AlertCircle,
    CheckCircle, XCircle, HelpCircle, Lightbulb,
    Sliders, Target, DollarSign, Star
} from 'lucide-react';

/**
 * Counterfactual "What-If" UI Component
 * 
 * Interactive simulation tool for exploring how different actions
 * would affect trust scores, visibility, and revenue. Part of the
 * Explanatory Voice chromosome of the DNA Strand architecture.
 */

interface WhatIfResult {
    scenarioId: string;
    originalScore: number;
    predictedScore: number;
    delta: number;
    confidence: number;
    factors: FactorContribution[];
    recommendations: string[];
    warnings: string[];
}

interface FactorContribution {
    name: string;
    contribution: number;
    direction: 'up' | 'down' | 'neutral';
}

// Predefined scenario templates
interface TemplateFactor {
    key: string;
    label: string;
    type: string;
    min?: number;
    max?: number;
    options?: string[];
}

const SCENARIO_TEMPLATES: Record<'trust_score' | 'visibility' | 'revenue', { name: string; icon: typeof Star; factors: TemplateFactor[] }> = {
    trust_score: {
        name: 'Trust Score Simulation',
        icon: Star,
        factors: [
            { key: 'content_violations', label: 'Content Violations', type: 'number', min: 0, max: 10 },
            { key: 'verification_level', label: 'Verification Level', type: 'select', options: ['none', 'email', 'phone', 'id', 'creator'] },
            { key: 'account_age_days', label: 'Account Age (days)', type: 'number', min: 0, max: 3650 },
            { key: 'community_standing', label: 'Community Standing', type: 'slider', min: 0, max: 100 },
            { key: 'payout_reliability', label: 'Payout Reliability %', type: 'slider', min: 0, max: 100 },
            { key: '2fa_enabled', label: '2FA Enabled', type: 'boolean' },
        ],
    },
    visibility: {
        name: 'Discovery Visibility',
        icon: Target,
        factors: [
            { key: 'stream_frequency', label: 'Streams per Week', type: 'number', min: 0, max: 30 },
            { key: 'avg_duration_mins', label: 'Avg Stream Duration (mins)', type: 'number', min: 0, max: 480 },
            { key: 'engagement_rate', label: 'Engagement Rate %', type: 'slider', min: 0, max: 100 },
            { key: 'category_match', label: 'Category Optimization', type: 'select', options: ['poor', 'average', 'good', 'excellent'] },
            { key: 'title_quality', label: 'Title Quality Score', type: 'slider', min: 0, max: 100 },
            { key: 'thumbnail_quality', label: 'Thumbnail Quality', type: 'select', options: ['none', 'low', 'medium', 'high'] },
        ],
    },
    revenue: {
        name: 'Revenue Potential',
        icon: DollarSign,
        factors: [
            { key: 'subscriber_count', label: 'Subscriber Count', type: 'number', min: 0, max: 100000 },
            { key: 'avg_viewers', label: 'Average Viewers', type: 'number', min: 0, max: 10000 },
            { key: 'tier_pricing', label: 'Highest Tier Price ($)', type: 'number', min: 4.99, max: 99.99 },
            { key: 'virtual_goods', label: 'Virtual Goods Listed', type: 'number', min: 0, max: 100 },
            { key: 'donation_enabled', label: 'Donations Enabled', type: 'boolean' },
            { key: 'merchandise', label: 'Merchandise Integration', type: 'boolean' },
        ],
    },
};

interface SliderInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    label: string;
}

function SliderInput({ value, onChange, min, max, label }: SliderInputProps) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="text-white font-medium">{value}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
        </div>
    );
}

export function CounterfactualWhatIf() {
    const [selectedScenario, setSelectedScenario] = useState<keyof typeof SCENARIO_TEMPLATES>('trust_score');
    const [factorValues, setFactorValues] = useState<Record<string, any>>({});
    const [result, setResult] = useState<WhatIfResult | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    const scenario = SCENARIO_TEMPLATES[selectedScenario];

    // Initialize factor values when scenario changes
    const initializeFactors = useCallback(() => {
        const initial: Record<string, any> = {};
        SCENARIO_TEMPLATES[selectedScenario].factors.forEach((factor) => {
            if (factor.type === 'number' || factor.type === 'slider') {
                initial[factor.key] = factor.min || 0;
            } else if (factor.type === 'boolean') {
                initial[factor.key] = false;
            } else if (factor.type === 'select') {
                initial[factor.key] = factor.options?.[0] || '';
            }
        });
        setFactorValues(initial);
        setResult(null);
    }, [selectedScenario]);

    // Mock simulation function
    const runSimulation = async () => {
        setIsSimulating(true);

        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Calculate mock result based on factors
        let score = 50; // Base score
        const contributions: FactorContribution[] = [];
        const recommendations: string[] = [];
        const warnings: string[] = [];

        if (selectedScenario === 'trust_score') {
            // Trust score simulation
            if (factorValues['2fa_enabled']) {
                score += 15;
                contributions.push({ name: '2FA Enabled', contribution: 15, direction: 'up' });
            } else {
                recommendations.push('Enable 2FA to boost your trust score by up to 15 points');
            }

            if (factorValues['verification_level'] === 'creator') {
                score += 20;
                contributions.push({ name: 'Creator Verification', contribution: 20, direction: 'up' });
            } else if (factorValues['verification_level'] === 'id') {
                score += 15;
                contributions.push({ name: 'ID Verification', contribution: 15, direction: 'up' });
            }

            const violations = factorValues['content_violations'] || 0;
            if (violations > 0) {
                const penalty = violations * -5;
                score += penalty;
                contributions.push({ name: 'Content Violations', contribution: penalty, direction: 'down' });
                if (violations >= 3) {
                    warnings.push('High violation count significantly impacts trust score');
                }
            }

            const communityStanding = factorValues['community_standing'] || 0;
            const communityBonus = Math.round((communityStanding - 50) / 5);
            if (communityBonus !== 0) {
                score += communityBonus;
                contributions.push({
                    name: 'Community Standing',
                    contribution: communityBonus,
                    direction: communityBonus > 0 ? 'up' : 'down'
                });
            }
        } else if (selectedScenario === 'visibility') {
            // Visibility simulation
            const streamFreq = factorValues['stream_frequency'] || 0;
            if (streamFreq >= 3 && streamFreq <= 7) {
                score += 20;
                contributions.push({ name: 'Optimal Stream Frequency', contribution: 20, direction: 'up' });
            } else if (streamFreq > 7) {
                score += 15;
                warnings.push('Very high streaming frequency may lead to content fatigue');
            }

            const engagement = factorValues['engagement_rate'] || 0;
            const engagementBonus = Math.round(engagement / 5);
            score += engagementBonus;
            contributions.push({ name: 'Engagement Rate', contribution: engagementBonus, direction: 'up' });

            if (factorValues['thumbnail_quality'] === 'high') {
                score += 15;
                contributions.push({ name: 'High Quality Thumbnail', contribution: 15, direction: 'up' });
            } else {
                recommendations.push('Upgrade to high-quality thumbnails for better click-through rates');
            }
        } else if (selectedScenario === 'revenue') {
            // Revenue simulation
            const subscribers = factorValues['subscriber_count'] || 0;
            const tierPrice = factorValues['tier_pricing'] || 4.99;
            const estimatedRevenue = subscribers * tierPrice * 0.9; // 90% creator cut

            score = Math.min(100, Math.round(estimatedRevenue / 1000));
            contributions.push({
                name: 'Subscription Revenue',
                contribution: score,
                direction: 'up'
            });

            if (!factorValues['donation_enabled']) {
                recommendations.push('Enable donations to increase revenue by an estimated 10-20%');
            }

            if (!factorValues['merchandise']) {
                recommendations.push('Consider merchandise integration for additional revenue streams');
            }
        }

        score = Math.max(0, Math.min(100, score));

        setResult({
            scenarioId: selectedScenario,
            originalScore: 50,
            predictedScore: score,
            delta: score - 50,
            confidence: 0.85 + Math.random() * 0.1,
            factors: contributions,
            recommendations,
            warnings,
        });

        setIsSimulating(false);
    };

    const updateFactor = (key: string, value: any) => {
        setFactorValues(prev => ({ ...prev, [key]: value }));
        setResult(null); // Clear previous result
    };

    const renderFactorInput = (factor: any) => {
        const value = factorValues[factor.key];

        switch (factor.type) {
            case 'number':
                return (
                    <input
                        type="number"
                        min={factor.min}
                        max={factor.max}
                        value={value || factor.min}
                        onChange={(e) => updateFactor(factor.key, Number(e.target.value))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    />
                );

            case 'slider':
                return (
                    <SliderInput
                        value={value || factor.min}
                        onChange={(v) => updateFactor(factor.key, v)}
                        min={factor.min}
                        max={factor.max}
                        label=""
                    />
                );

            case 'select':
                return (
                    <select
                        value={value || factor.options[0]}
                        onChange={(e) => updateFactor(factor.key, e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    >
                        {factor.options.map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case 'boolean':
                return (
                    <button
                        onClick={() => updateFactor(factor.key, !value)}
                        className={`w-12 h-6 rounded-full transition-colors ${value ? 'bg-purple-600' : 'bg-gray-600'
                            }`}
                    >
                        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-7' : 'translate-x-1'
                            }`} />
                    </button>
                );

            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                        <FlaskConical className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">What-If Simulator</h1>
                        <p className="text-gray-400 text-sm">Explore how changes affect your metrics</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={initializeFactors}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                </Button>
            </div>

            {/* Scenario Selector */}
            <div className="flex gap-4">
                {Object.entries(SCENARIO_TEMPLATES).map(([key, template]) => {
                    const TemplateIcon = template.icon;
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                setSelectedScenario(key as keyof typeof SCENARIO_TEMPLATES);
                                setResult(null);
                            }}
                            className={`flex-1 p-4 rounded-xl border transition-all ${selectedScenario === key
                                    ? 'border-purple-500 bg-purple-500/10'
                                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                }`}
                        >
                            <TemplateIcon className={`w-6 h-6 mx-auto mb-2 ${selectedScenario === key ? 'text-purple-400' : 'text-gray-400'
                                }`} />
                            <p className={`text-sm font-medium ${selectedScenario === key ? 'text-white' : 'text-gray-300'
                                }`}>
                                {template.name}
                            </p>
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Factor Inputs */}
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sliders className="w-5 h-5 text-purple-400" />
                        Adjust Factors
                    </h2>
                    <div className="space-y-4">
                        {scenario.factors.map((factor) => (
                            <div key={factor.key} className="space-y-1">
                                <label className="text-sm text-gray-400">{factor.label}</label>
                                {renderFactorInput(factor)}
                            </div>
                        ))}
                    </div>

                    <Button
                        onClick={runSimulation}
                        disabled={isSimulating}
                        className="w-full mt-6 flex items-center justify-center gap-2"
                    >
                        {isSimulating ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Simulating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Run Simulation
                            </>
                        )}
                    </Button>
                </Card>

                {/* Results */}
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-400" />
                        Predicted Outcome
                    </h2>

                    {!result ? (
                        <div className="h-64 flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Adjust factors and run simulation to see predictions</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Score Comparison */}
                            <div className="flex items-center justify-center gap-8">
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 mb-1">Current</p>
                                    <p className="text-3xl font-bold text-gray-400">{result.originalScore}</p>
                                </div>
                                <ArrowRight className="w-6 h-6 text-gray-500" />
                                <div className="text-center">
                                    <p className="text-sm text-gray-400 mb-1">Predicted</p>
                                    <p className={`text-3xl font-bold ${result.delta > 0 ? 'text-green-400' : result.delta < 0 ? 'text-red-400' : 'text-gray-400'
                                        }`}>
                                        {result.predictedScore}
                                    </p>
                                </div>
                            </div>

                            {/* Delta Badge */}
                            <div className="flex justify-center">
                                <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${result.delta > 0
                                        ? 'bg-green-500/20 text-green-400'
                                        : result.delta < 0
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {result.delta > 0 ? (
                                        <TrendingUp className="w-4 h-4" />
                                    ) : result.delta < 0 ? (
                                        <TrendingDown className="w-4 h-4" />
                                    ) : (
                                        <Minus className="w-4 h-4" />
                                    )}
                                    {result.delta > 0 ? '+' : ''}{result.delta} points
                                </span>
                            </div>

                            {/* Confidence */}
                            <div className="text-center text-sm text-gray-400">
                                Confidence: {(result.confidence * 100).toFixed(0)}%
                            </div>

                            {/* Factor Contributions */}
                            {result.factors.length > 0 && (
                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Contributing Factors</p>
                                    <div className="space-y-2">
                                        {result.factors.map((factor, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-300">{factor.name}</span>
                                                <span className={`font-medium ${factor.direction === 'up'
                                                        ? 'text-green-400'
                                                        : factor.direction === 'down'
                                                            ? 'text-red-400'
                                                            : 'text-gray-400'
                                                    }`}>
                                                    {factor.contribution > 0 ? '+' : ''}{factor.contribution}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recommendations */}
                            {result.recommendations.length > 0 && (
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                    <p className="text-sm text-blue-400 font-medium flex items-center gap-2 mb-2">
                                        <Lightbulb className="w-4 h-4" />
                                        Recommendations
                                    </p>
                                    <ul className="text-sm text-gray-300 space-y-1">
                                        {result.recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <CheckCircle className="w-3 h-3 text-blue-400 mt-1 flex-shrink-0" />
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Warnings */}
                            {result.warnings.length > 0 && (
                                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                                    <p className="text-sm text-yellow-400 font-medium flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Warnings
                                    </p>
                                    <ul className="text-sm text-gray-300 space-y-1">
                                        {result.warnings.map((warning, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <XCircle className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
                                                {warning}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export default CounterfactualWhatIf;
