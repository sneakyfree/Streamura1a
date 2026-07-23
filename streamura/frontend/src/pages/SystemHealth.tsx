import { useState } from 'react';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    Server,
    Database,
    Wifi,
    Shield,
    Zap,
    Globe,
    Activity
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
    latency?: number;
    message?: string;
    lastChecked?: string;
}

interface SystemStatus {
    overall: 'operational' | 'degraded' | 'outage';
    services: HealthCheck[];
}

// Service icon mapping
const serviceIcons: Record<string, React.ElementType> = {
    'API Server': Server,
    'Database': Database,
    'WebSocket': Wifi,
    'Auth Service': Shield,
    'CDN': Zap,
    'Media Transcoding': Activity,
    'DNS': Globe
};

// Status indicator
function StatusIndicator({ status }: { status: HealthCheck['status'] }) {
    const config = {
        healthy: { color: 'bg-green-500', icon: CheckCircle, label: 'Healthy' },
        degraded: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Degraded' },
        unhealthy: { color: 'bg-red-500', icon: XCircle, label: 'Unhealthy' },
        checking: { color: 'bg-slate-500', icon: Clock, label: 'Checking' }
    };

    const { color, icon: Icon, label } = config[status];

    return (
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${color} ${status === 'checking' ? 'animate-pulse' : ''}`} />
            <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
            <span className="text-sm text-slate-300">{label}</span>
        </div>
    );
}

export function SystemHealth() {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Mock system status
    const [systemStatus, setSystemStatus] = useState<SystemStatus>({
        overall: 'operational',
        services: [
            { name: 'API Server', status: 'healthy', latency: 45, lastChecked: 'Just now' },
            { name: 'Database', status: 'healthy', latency: 12, lastChecked: 'Just now' },
            { name: 'WebSocket', status: 'healthy', latency: 8, lastChecked: 'Just now' },
            { name: 'Auth Service', status: 'healthy', latency: 23, lastChecked: 'Just now' },
            { name: 'CDN', status: 'healthy', latency: 5, lastChecked: 'Just now' },
            { name: 'Media Transcoding', status: 'healthy', latency: 156, lastChecked: 'Just now' },
            { name: 'DNS', status: 'healthy', latency: 2, lastChecked: 'Just now' }
        ]
    });

    const refreshHealth = async () => {
        setIsRefreshing(true);
        // Set all to checking
        setSystemStatus(prev => ({
            ...prev,
            services: prev.services.map(s => ({ ...s, status: 'checking' as const }))
        }));

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Reset to healthy
        setSystemStatus(prev => ({
            ...prev,
            services: prev.services.map(s => ({
                ...s,
                status: 'healthy' as const,
                lastChecked: 'Just now',
                latency: Math.floor(Math.random() * 50) + 5
            }))
        }));
        setIsRefreshing(false);
    };

    const overallStatusConfig = {
        operational: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'All Systems Operational', icon: CheckCircle },
        degraded: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Some Systems Degraded', icon: AlertTriangle },
        outage: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Major Outage', icon: XCircle }
    };

    const overall = overallStatusConfig[systemStatus.overall];
    const OverallIcon = overall.icon;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="h-6 w-6 text-green-400" />
                        System Health
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Monitor platform status and service health
                    </p>
                </div>
                <Button variant="secondary" onClick={refreshHealth} disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Overall status */}
            <Card className={`p-4 ${overall.color}`}>
                <div className="flex items-center gap-3">
                    <OverallIcon className="w-6 h-6" />
                    <div>
                        <div className="font-medium">{overall.label}</div>
                        <div className="text-sm opacity-70">Last updated: Just now</div>
                    </div>
                </div>
            </Card>

            {/* Services grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemStatus.services.map((service) => {
                    const Icon = serviceIcons[service.name] || Server;
                    return (
                        <Card key={service.name} className="bg-slate-800/50 border-slate-700 p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-700">
                                        <Icon className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{service.name}</div>
                                        <StatusIndicator status={service.status} />
                                    </div>
                                </div>
                                {service.latency && service.status === 'healthy' && (
                                    <div className="text-right">
                                        <div className="text-white font-mono text-sm">{service.latency}ms</div>
                                        <div className="text-xs text-slate-500">{service.lastChecked}</div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Uptime stats */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-4">Uptime Statistics (Last 30 Days)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">99.98%</div>
                        <div className="text-xs text-slate-500">API Uptime</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">99.95%</div>
                        <div className="text-xs text-slate-500">Streaming Uptime</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">42ms</div>
                        <div className="text-xs text-slate-500">Avg Response</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">0</div>
                        <div className="text-xs text-slate-500">Major Incidents</div>
                    </div>
                </div>
            </Card>

            {/* Recent incidents */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-3">Recent Incidents</h3>
                <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                    <p>No recent incidents</p>
                    <p className="text-xs mt-1">All systems have been running smoothly</p>
                </div>
            </Card>
        </div>
    );
}

export default SystemHealth;
