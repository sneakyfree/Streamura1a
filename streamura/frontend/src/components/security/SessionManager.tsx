import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Monitor,
    Smartphone,
    Tablet,
    Globe,
    MapPin,
    Clock,
    Shield,
    AlertTriangle,
    LogOut,
    RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface Session {
    id: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    deviceName: string;
    browser: string;
    ipAddress: string;
    location: string;
    lastActive: string;
    createdAt: string;
    isCurrent: boolean;
    isTrusted: boolean;
    suspicious?: boolean;
    suspiciousReason?: string;
}

// Mock data
const mockSessions: Session[] = [
    {
        id: 's1',
        deviceType: 'desktop',
        deviceName: 'MacBook Pro',
        browser: 'Chrome 120',
        ipAddress: '192.168.1.***',
        location: 'Los Angeles, CA',
        lastActive: new Date().toISOString(),
        createdAt: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
        isCurrent: true,
        isTrusted: true
    },
    {
        id: 's2',
        deviceType: 'mobile',
        deviceName: 'iPhone 15 Pro',
        browser: 'Safari',
        ipAddress: '192.168.1.***',
        location: 'Los Angeles, CA',
        lastActive: new Date(Date.now() - 2 * 3600000).toISOString(),
        createdAt: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
        isCurrent: false,
        isTrusted: true
    },
    {
        id: 's3',
        deviceType: 'desktop',
        deviceName: 'Windows PC',
        browser: 'Firefox 121',
        ipAddress: '45.67.89.***',
        location: 'New York, NY',
        lastActive: new Date(Date.now() - 24 * 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        isCurrent: false,
        isTrusted: false,
        suspicious: true,
        suspiciousReason: 'New location detected'
    }
];

const deviceIcons = {
    desktop: Monitor,
    mobile: Smartphone,
    tablet: Tablet,
    unknown: Globe
};

// Relative time helper
function timeAgo(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
    return new Date(date).toLocaleDateString();
}

// Session card component
function SessionCard({
    session,
    onRevoke,
    onTrust
}: {
    session: Session;
    onRevoke: (id: string) => void;
    onTrust: (id: string) => void;
}) {
    const Icon = deviceIcons[session.deviceType];

    return (
        <Card className={`bg-slate-800/50 border-slate-700 p-4 ${session.suspicious ? 'ring-1 ring-orange-500/50' : ''}`}>
            <div className="flex items-start gap-4">
                {/* Device icon */}
                <div className={`p-3 rounded-lg ${session.isCurrent ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                    <Icon className={`w-6 h-6 ${session.isCurrent ? 'text-green-400' : 'text-slate-400'}`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium">{session.deviceName}</span>
                        {session.isCurrent && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                Current
                            </span>
                        )}
                        {session.isTrusted && !session.isCurrent && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                Trusted
                            </span>
                        )}
                        {session.suspicious && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Suspicious
                            </span>
                        )}
                    </div>

                    <div className="text-sm text-slate-400 mb-2">{session.browser}</div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {session.location}
                        </div>
                        <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {session.ipAddress}
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {session.isCurrent ? 'Active now' : timeAgo(session.lastActive)}
                        </div>
                    </div>

                    {session.suspicious && session.suspiciousReason && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
                            <AlertTriangle className="w-3 h-3" />
                            {session.suspiciousReason}
                        </div>
                    )}
                </div>

                {/* Actions */}
                {!session.isCurrent && (
                    <div className="flex flex-col gap-1">
                        {!session.isTrusted && (
                            <button
                                onClick={() => onTrust(session.id)}
                                className="p-2 hover:bg-blue-500/20 rounded text-slate-400 hover:text-blue-400"
                                title="Trust this device"
                            >
                                <Shield className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => onRevoke(session.id)}
                            className="p-2 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                            title="Revoke session"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </Card>
    );
}

export function SessionManager() {
    const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null);
    const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

    const queryClient = useQueryClient();

    const { data: sessions = mockSessions, refetch } = useQuery({
        queryKey: ['activeSessions'],
        queryFn: async () => mockSessions
    });

    const revokeSession = useMutation({
        mutationFn: async (sessionId: string) => sessionId,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
            setShowRevokeConfirm(null);
        }
    });

    const revokeAllSessions = useMutation({
        mutationFn: async () => 'all',
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
            setShowRevokeAllConfirm(false);
        }
    });

    const trustDevice = useMutation({
        mutationFn: async (sessionId: string) => sessionId,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activeSessions'] })
    });

    const suspiciousSessions = sessions.filter(s => s.suspicious);
    const otherSessions = sessions.filter(s => !s.isCurrent);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-purple-400" />
                        Active Sessions
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Manage devices that are signed in to your account
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => refetch()}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    {otherSessions.length > 0 && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setShowRevokeAllConfirm(true)}
                        >
                            Sign Out All Others
                        </Button>
                    )}
                </div>
            </div>

            {/* Suspicious sessions alert */}
            {suspiciousSessions.length > 0 && (
                <Card className="bg-orange-500/10 border-orange-500/30 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                        <div>
                            <h3 className="text-orange-400 font-medium">
                                {suspiciousSessions.length} Suspicious Session{suspiciousSessions.length > 1 ? 's' : ''} Detected
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Review and revoke any sessions you don't recognize.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Session list */}
            <div className="space-y-3">
                {sessions.map(session => (
                    <SessionCard
                        key={session.id}
                        session={session}
                        onRevoke={(id) => setShowRevokeConfirm(id)}
                        onTrust={(id) => trustDevice.mutate(id)}
                    />
                ))}
            </div>

            {/* Revoke confirmation modal */}
            {showRevokeConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-md w-full">
                        <h3 className="text-white font-semibold mb-4">Sign Out Device?</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            This device will be signed out and will need to log in again.
                        </p>
                        <div className="flex items-center gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowRevokeConfirm(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={() => revokeSession.mutate(showRevokeConfirm)}
                            >
                                Sign Out
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Revoke all confirmation modal */}
            {showRevokeAllConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-md w-full">
                        <h3 className="text-white font-semibold mb-4">Sign Out All Other Devices?</h3>
                        <p className="text-sm text-slate-400 mb-4">
                            {otherSessions.length} device{otherSessions.length > 1 ? 's' : ''} will be signed out. They will need to log in again.
                        </p>
                        <div className="flex items-center gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowRevokeAllConfirm(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={() => revokeAllSessions.mutate()}
                            >
                                Sign Out All
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default SessionManager;
