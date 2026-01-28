import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Shield, AlertTriangle, Clock, BarChart3,
    RefreshCw, TrendingUp, Users, Zap,
    XCircle, CheckCircle, Timer, Activity
} from 'lucide-react';

/**
 * Rate Limit Observability Dashboard
 * 
 * Monitors rate limiting across the platform including:
 * - Current rate limit status by endpoint
 * - Rate limit violations over time
 * - Top offending IPs/users
 * - Endpoint-level throttling stats
 */

interface RateLimitConfig {
    endpoint: string;
    limit: number;
    windowSeconds: number;
    penalty: string;
}

interface EndpointStats {
    endpoint: string;
    requestCount: number;
    blockedCount: number;
    blockRate: number;
    avgResponseTime: number;
    currentLoad: number;
    limit: number;
}

interface ViolationEvent {
    id: string;
    timestamp: string;
    endpoint: string;
    identifier: string;
    identifierType: 'ip' | 'user' | 'api_key';
    requestCount: number;
    limit: number;
    action: 'blocked' | 'throttled' | 'warning';
}

interface TopOffender {
    identifier: string;
    type: 'ip' | 'user' | 'api_key';
    violationCount: number;
    totalBlocked: number;
    lastViolation: string;
    status: 'active' | 'banned' | 'warned';
}

// Mock data
const mockRateLimitConfigs: RateLimitConfig[] = [
    { endpoint: '/api/v1/auth/login', limit: 5, windowSeconds: 60, penalty: 'block' },
    { endpoint: '/api/v1/auth/register', limit: 3, windowSeconds: 300, penalty: 'block' },
    { endpoint: '/api/v1/streams', limit: 100, windowSeconds: 60, penalty: 'throttle' },
    { endpoint: '/api/v1/chat/*', limit: 30, windowSeconds: 10, penalty: 'throttle' },
    { endpoint: '/api/v1/search', limit: 60, windowSeconds: 60, penalty: 'throttle' },
    { endpoint: '/api/v1/tips', limit: 10, windowSeconds: 60, penalty: 'block' },
    { endpoint: '/api/v1/payouts/*', limit: 5, windowSeconds: 300, penalty: 'block' },
];

const mockEndpointStats: EndpointStats[] = [
    { endpoint: '/api/v1/streams', requestCount: 45230, blockedCount: 234, blockRate: 0.52, avgResponseTime: 45, currentLoad: 78, limit: 100 },
    { endpoint: '/api/v1/chat/*', requestCount: 123456, blockedCount: 1234, blockRate: 1.0, avgResponseTime: 12, currentLoad: 65, limit: 30 },
    { endpoint: '/api/v1/auth/login', requestCount: 8934, blockedCount: 567, blockRate: 6.3, avgResponseTime: 89, currentLoad: 45, limit: 5 },
    { endpoint: '/api/v1/search', requestCount: 34567, blockedCount: 123, blockRate: 0.36, avgResponseTime: 156, currentLoad: 52, limit: 60 },
    { endpoint: '/api/v1/tips', requestCount: 5678, blockedCount: 45, blockRate: 0.79, avgResponseTime: 234, currentLoad: 23, limit: 10 },
];

const mockViolations: ViolationEvent[] = [
    { id: '1', timestamp: new Date().toISOString(), endpoint: '/api/v1/auth/login', identifier: '192.168.1.100', identifierType: 'ip', requestCount: 15, limit: 5, action: 'blocked' },
    { id: '2', timestamp: new Date(Date.now() - 60000).toISOString(), endpoint: '/api/v1/chat/*', identifier: 'user_42356', identifierType: 'user', requestCount: 45, limit: 30, action: 'throttled' },
    { id: '3', timestamp: new Date(Date.now() - 120000).toISOString(), endpoint: '/api/v1/search', identifier: '10.0.0.55', identifierType: 'ip', requestCount: 72, limit: 60, action: 'warning' },
    { id: '4', timestamp: new Date(Date.now() - 180000).toISOString(), endpoint: '/api/v1/streams', identifier: 'api_key_xyz', identifierType: 'api_key', requestCount: 150, limit: 100, action: 'throttled' },
];

const mockTopOffenders: TopOffender[] = [
    { identifier: '185.234.12.45', type: 'ip', violationCount: 234, totalBlocked: 1567, lastViolation: '5m ago', status: 'banned' },
    { identifier: 'user_suspicious_123', type: 'user', violationCount: 89, totalBlocked: 456, lastViolation: '12m ago', status: 'warned' },
    { identifier: '192.168.50.100', type: 'ip', violationCount: 67, totalBlocked: 234, lastViolation: '1h ago', status: 'active' },
    { identifier: 'api_key_abused', type: 'api_key', violationCount: 45, totalBlocked: 189, lastViolation: '2h ago', status: 'warned' },
];

export function RateLimitDashboard() {
    const [endpointStats, setEndpointStats] = useState<EndpointStats[]>(mockEndpointStats);
    const [violations, setViolations] = useState<ViolationEvent[]>(mockViolations);
    const [topOffenders, setTopOffenders] = useState<TopOffender[]>(mockTopOffenders);
    const [configs] = useState<RateLimitConfig[]>(mockRateLimitConfigs);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate data changes
        setEndpointStats(prev => prev.map(stat => ({
            ...stat,
            requestCount: stat.requestCount + Math.floor(Math.random() * 100),
            currentLoad: Math.max(0, Math.min(100, stat.currentLoad + (Math.random() * 10 - 5))),
        })));

        setIsRefreshing(false);
    }, []);

    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(refreshData, 15000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshData]);

    const getLoadColor = (load: number) => {
        if (load >= 90) return 'text-red-400 bg-red-500/20';
        if (load >= 70) return 'text-yellow-400 bg-yellow-500/20';
        return 'text-green-400 bg-green-500/20';
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'blocked': return 'text-red-400 bg-red-500/20';
            case 'throttled': return 'text-yellow-400 bg-yellow-500/20';
            case 'warning': return 'text-blue-400 bg-blue-500/20';
            default: return 'text-gray-400 bg-gray-500/20';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'banned': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'warned': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    // Summary stats
    const totalRequests = endpointStats.reduce((sum, s) => sum + s.requestCount, 0);
    const totalBlocked = endpointStats.reduce((sum, s) => sum + s.blockedCount, 0);
    const overallBlockRate = totalBlocked / totalRequests * 100;
    const highLoadEndpoints = endpointStats.filter(s => s.currentLoad >= 70).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                        <Shield className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Rate Limit Observability</h1>
                        <p className="text-gray-400 text-sm">Monitor and manage API rate limiting</p>
                    </div>
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
                    <Button
                        onClick={refreshData}
                        disabled={isRefreshing}
                        size="sm"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Activity className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Requests</p>
                            <p className="text-2xl font-bold text-white">{totalRequests.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Blocked</p>
                            <p className="text-2xl font-bold text-red-400">{totalBlocked.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                            <TrendingUp className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Block Rate</p>
                            <p className="text-2xl font-bold text-yellow-400">{overallBlockRate.toFixed(2)}%</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${highLoadEndpoints > 0 ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                            <Zap className={`w-5 h-5 ${highLoadEndpoints > 0 ? 'text-orange-400' : 'text-green-400'}`} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">High Load</p>
                            <p className={`text-2xl font-bold ${highLoadEndpoints > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                {highLoadEndpoints} endpoints
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Endpoint Stats */}
                <Card className="col-span-2 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Endpoint Rate Limits
                    </h2>
                    <div className="space-y-3">
                        {endpointStats.map((stat) => (
                            <div
                                key={stat.endpoint}
                                className={`p-3 rounded-lg bg-gray-800/50 cursor-pointer transition-all hover:bg-gray-800 ${selectedEndpoint === stat.endpoint ? 'ring-1 ring-purple-500' : ''
                                    }`}
                                onClick={() => setSelectedEndpoint(
                                    selectedEndpoint === stat.endpoint ? null : stat.endpoint
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-mono text-gray-300">{stat.endpoint}</span>
                                    <span className={`text-xs px-2 py-1 rounded ${getLoadColor(stat.currentLoad)}`}>
                                        {stat.currentLoad.toFixed(0)}% load
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${stat.currentLoad >= 90 ? 'bg-red-500' :
                                                stat.currentLoad >= 70 ? 'bg-yellow-500' :
                                                    'bg-green-500'
                                            }`}
                                        style={{ width: `${stat.currentLoad}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-xs text-gray-500">
                                    <span>{stat.requestCount.toLocaleString()} requests</span>
                                    <span>{stat.blockedCount.toLocaleString()} blocked ({stat.blockRate.toFixed(1)}%)</span>
                                    <span>Limit: {stat.limit}/min</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Top Offenders */}
                <Card className="p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        Top Offenders
                    </h2>
                    <div className="space-y-3">
                        {topOffenders.map((offender, i) => (
                            <div key={i} className="p-3 rounded-lg bg-gray-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-mono text-gray-300 truncate max-w-[150px]">
                                        {offender.identifier}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded border ${getStatusBadge(offender.status)}`}>
                                        {offender.status}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{offender.type}</span>
                                    <span>{offender.violationCount} violations</span>
                                    <span>{offender.lastViolation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Violations */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-400" />
                    Recent Violations
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-400 text-left">
                                <th className="pb-3">Time</th>
                                <th className="pb-3">Endpoint</th>
                                <th className="pb-3">Identifier</th>
                                <th className="pb-3">Type</th>
                                <th className="pb-3">Requests</th>
                                <th className="pb-3">Limit</th>
                                <th className="pb-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {violations.map((violation) => (
                                <tr key={violation.id} className="border-t border-gray-800">
                                    <td className="py-3 text-gray-400">
                                        {new Date(violation.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="py-3 font-mono text-xs">{violation.endpoint}</td>
                                    <td className="py-3 font-mono text-xs truncate max-w-[150px]">
                                        {violation.identifier}
                                    </td>
                                    <td className="py-3">{violation.identifierType}</td>
                                    <td className="py-3 text-red-400">{violation.requestCount}</td>
                                    <td className="py-3">{violation.limit}</td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-xs ${getActionColor(violation.action)}`}>
                                            {violation.action}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Rate Limit Configurations */}
            <Card className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Timer className="w-5 h-5 text-purple-400" />
                    Rate Limit Configurations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {configs.map((config, i) => (
                        <div key={i} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                            <p className="font-mono text-sm text-gray-300 mb-2">{config.endpoint}</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Limit</span>
                                <span className="text-white">{config.limit} / {config.windowSeconds}s</span>
                            </div>
                            <div className="flex justify-between text-sm mt-1">
                                <span className="text-gray-400">Penalty</span>
                                <span className={`${config.penalty === 'block' ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                    {config.penalty}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

export default RateLimitDashboard;
