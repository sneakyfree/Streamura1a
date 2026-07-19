import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Activity, CheckCircle, AlertTriangle,
    TrendingUp, TrendingDown, RefreshCw, Zap, Target,
    BarChart3, Timer, Cpu, Gauge
} from 'lucide-react';

/**
 * Agent Performance Metrics Dashboard
 * 
 * Real-time monitoring of agentic system performance including:
 * - Latency metrics per agent type
 * - Success/failure rates
 * - Throughput tracking
 * - Confidence score distributions
 * - HITL approval rates
 */

interface AgentMetrics {
    agentType: string;
    displayName: string;
    totalDecisions: number;
    successRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    avgConfidence: number;
    hitlRate: number;
    throughputPerHour: number;
    lastDecisionAt: string | null;
    status: 'healthy' | 'degraded' | 'unhealthy';
    trend: 'up' | 'down' | 'stable';
}

interface SystemHealth {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    uptime: string;
    totalDecisionsToday: number;
    avgSystemLatency: number;
    hitlQueueSize: number;
    activeAgents: number;
}


const AGENT_TYPES = [
    { key: 'discovery', name: 'Discovery Agent', icon: Target, color: 'blue' },
    { key: 'moderation', name: 'Moderation Agent', icon: AlertTriangle, color: 'orange' },
    { key: 'payout', name: 'Payout Agent', icon: Zap, color: 'green' },
    { key: 'trust', name: 'Trust Agent', icon: CheckCircle, color: 'purple' },
    { key: 'licensing', name: 'Licensing Agent', icon: Activity, color: 'cyan' },
    { key: 'emergency', name: 'Emergency Agent', icon: AlertTriangle, color: 'red' },
];

const mockAgentMetrics: AgentMetrics[] = [
    {
        agentType: 'discovery',
        displayName: 'Discovery Agent',
        totalDecisions: 15234,
        successRate: 99.2,
        avgLatencyMs: 45,
        p95LatencyMs: 120,
        p99LatencyMs: 250,
        avgConfidence: 0.87,
        hitlRate: 2.1,
        throughputPerHour: 523,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'up',
    },
    {
        agentType: 'moderation',
        displayName: 'Moderation Agent',
        totalDecisions: 8456,
        successRate: 97.8,
        avgLatencyMs: 89,
        p95LatencyMs: 200,
        p99LatencyMs: 450,
        avgConfidence: 0.82,
        hitlRate: 8.5,
        throughputPerHour: 312,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'stable',
    },
    {
        agentType: 'payout',
        displayName: 'Payout Agent',
        totalDecisions: 2341,
        successRate: 99.9,
        avgLatencyMs: 156,
        p95LatencyMs: 350,
        p99LatencyMs: 600,
        avgConfidence: 0.94,
        hitlRate: 15.2,
        throughputPerHour: 87,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'up',
    },
    {
        agentType: 'trust',
        displayName: 'Trust Agent',
        totalDecisions: 12890,
        successRate: 98.5,
        avgLatencyMs: 67,
        p95LatencyMs: 150,
        p99LatencyMs: 300,
        avgConfidence: 0.89,
        hitlRate: 4.3,
        throughputPerHour: 445,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'stable',
    },
    {
        agentType: 'licensing',
        displayName: 'Licensing Agent',
        totalDecisions: 1567,
        successRate: 99.1,
        avgLatencyMs: 234,
        p95LatencyMs: 500,
        p99LatencyMs: 800,
        avgConfidence: 0.91,
        hitlRate: 12.8,
        throughputPerHour: 54,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'up',
    },
    {
        agentType: 'emergency',
        displayName: 'Emergency Agent',
        totalDecisions: 89,
        successRate: 100,
        avgLatencyMs: 23,
        p95LatencyMs: 45,
        p99LatencyMs: 80,
        avgConfidence: 0.96,
        hitlRate: 45.0,
        throughputPerHour: 3,
        lastDecisionAt: new Date().toISOString(),
        status: 'healthy',
        trend: 'stable',
    },
];

const mockSystemHealth: SystemHealth = {
    overallStatus: 'healthy',
    uptime: '14d 7h 32m',
    totalDecisionsToday: 4523,
    avgSystemLatency: 78,
    hitlQueueSize: 12,
    activeAgents: 6,
};

export function AgentPerformanceMetrics() {
    const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>(mockAgentMetrics);
    const [systemHealth] = useState<SystemHealth>(mockSystemHealth);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const refreshMetrics = useCallback(async () => {
        setIsRefreshing(true);
        try {
            // In production, fetch from API
            // const response = await fetch('/api/v1/admin/agents/metrics');
            // const data = await response.json();
            // setAgentMetrics(data.agents);
            // setSystemHealth(data.system);

            // Simulate refresh with slight variation
            setAgentMetrics(prev => prev.map(m => ({
                ...m,
                totalDecisions: m.totalDecisions + Math.floor(Math.random() * 10),
                throughputPerHour: m.throughputPerHour + Math.floor(Math.random() * 5) - 2,
            })));
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(refreshMetrics, 10000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshMetrics]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-500';
            case 'degraded': return 'text-yellow-500';
            case 'unhealthy': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-green-500/10 border-green-500/30';
            case 'degraded': return 'bg-yellow-500/10 border-yellow-500/30';
            case 'unhealthy': return 'bg-red-500/10 border-red-500/30';
            default: return 'bg-gray-500/10 border-gray-500/30';
        }
    };

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
            default: return <Activity className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Agent Performance Metrics</h1>
                    <p className="text-gray-400">Real-time monitoring of agentic system performance</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-400">Auto-refresh</label>
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`w-10 h-6 rounded-full transition-colors ${autoRefresh ? 'bg-purple-600' : 'bg-gray-600'
                                }`}
                        >
                            <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-5' : 'translate-x-1'
                                }`} />
                        </button>
                    </div>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                        className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2"
                    >
                        <option value="1h">Last 1 Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                    </select>
                    <Button
                        onClick={refreshMetrics}
                        disabled={isRefreshing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* System Health Overview */}
            <Card className={`p-6 border ${getStatusBg(systemHealth.overallStatus)}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${getStatusBg(systemHealth.overallStatus)}`}>
                            <Gauge className={`w-8 h-8 ${getStatusColor(systemHealth.overallStatus)}`} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">System Health</h2>
                            <p className={`text-sm capitalize ${getStatusColor(systemHealth.overallStatus)}`}>
                                {systemHealth.overallStatus}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-5 gap-8">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{systemHealth.uptime}</p>
                            <p className="text-sm text-gray-400">Uptime</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{systemHealth.totalDecisionsToday.toLocaleString()}</p>
                            <p className="text-sm text-gray-400">Decisions Today</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{systemHealth.avgSystemLatency}ms</p>
                            <p className="text-sm text-gray-400">Avg Latency</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">{systemHealth.hitlQueueSize}</p>
                            <p className="text-sm text-gray-400">HITL Queue</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-400">{systemHealth.activeAgents}/6</p>
                            <p className="text-sm text-gray-400">Active Agents</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Agent Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agentMetrics.map((agent) => {
                    const agentConfig = AGENT_TYPES.find(t => t.key === agent.agentType);
                    const Icon = agentConfig?.icon || Activity;

                    return (
                        <Card
                            key={agent.agentType}
                            className={`p-4 cursor-pointer transition-all hover:border-purple-500/50 ${selectedAgent === agent.agentType ? 'border-purple-500 ring-1 ring-purple-500/30' : ''
                                }`}
                            onClick={() => setSelectedAgent(
                                selectedAgent === agent.agentType ? null : agent.agentType
                            )}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${getStatusBg(agent.status)}`}>
                                        <Icon className={`w-5 h-5 ${getStatusColor(agent.status)}`} />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-white">{agent.displayName}</h3>
                                        <p className={`text-xs ${getStatusColor(agent.status)}`}>
                                            {agent.status}
                                        </p>
                                    </div>
                                </div>
                                {getTrendIcon(agent.trend)}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-400">Success Rate</p>
                                    <p className="text-lg font-semibold text-green-400">{agent.successRate}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Avg Latency</p>
                                    <p className="text-lg font-semibold text-white">{agent.avgLatencyMs}ms</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Throughput/hr</p>
                                    <p className="text-lg font-semibold text-white">{agent.throughputPerHour}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">HITL Rate</p>
                                    <p className="text-lg font-semibold text-yellow-400">{agent.hitlRate}%</p>
                                </div>
                            </div>

                            {selectedAgent === agent.agentType && (
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                            <p className="text-gray-400">P95 Latency</p>
                                            <p className="text-white">{agent.p95LatencyMs}ms</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">P99 Latency</p>
                                            <p className="text-white">{agent.p99LatencyMs}ms</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Avg Confidence</p>
                                            <p className="text-white">{(agent.avgConfidence * 100).toFixed(0)}%</p>
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <p className="text-gray-400 text-xs">Total Decisions</p>
                                        <p className="text-white text-lg font-bold">{agent.totalDecisions.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Latency Distribution Chart Placeholder */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Latency Distribution
                    </h3>
                    <div className="flex items-center gap-2">
                        {AGENT_TYPES.map((agent) => (
                            <span
                                key={agent.key}
                                className={`text-xs px-2 py-1 rounded bg-${agent.color}-500/20 text-${agent.color}-400`}
                            >
                                {agent.name.split(' ')[0]}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-lg">
                    <div className="text-center text-gray-400">
                        <Timer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Latency chart visualization</p>
                        <p className="text-sm">Integration with chart library (Recharts/Visx)</p>
                    </div>
                </div>
            </Card>

            {/* Confidence Score Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-purple-400" />
                        Confidence Score Distribution
                    </h3>
                    <div className="space-y-3">
                        {agentMetrics.map((agent) => (
                            <div key={agent.agentType}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-400">{agent.displayName}</span>
                                    <span className="text-white">{(agent.avgConfidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                        style={{ width: `${agent.avgConfidence * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                        <Cpu className="w-5 h-5 text-purple-400" />
                        HITL Escalation Rates
                    </h3>
                    <div className="space-y-3">
                        {agentMetrics
                            .sort((a, b) => b.hitlRate - a.hitlRate)
                            .map((agent) => (
                                <div key={agent.agentType}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-400">{agent.displayName}</span>
                                        <span className="text-yellow-400">{agent.hitlRate}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                                            style={{ width: `${Math.min(agent.hitlRate * 2, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default AgentPerformanceMetrics;
