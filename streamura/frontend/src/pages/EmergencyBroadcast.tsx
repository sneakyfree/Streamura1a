import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Radio,
    AlertTriangle,
    Send,
    MapPin,
    Clock,
    Users,
    Zap,
    XCircle,
    CheckCircle,
    Bell
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface EmergencyBroadcast {
    id: string;
    type: 'weather' | 'safety' | 'breaking' | 'amber' | 'evacuation';
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    location?: string;
    sent_at: string;
    reach: number;
}

const emergencyTypes = [
    { value: 'weather', label: 'Weather Alert', icon: '🌪️', color: 'bg-blue-500' },
    { value: 'safety', label: 'Public Safety', icon: '🚨', color: 'bg-red-500' },
    { value: 'breaking', label: 'Breaking News', icon: '📰', color: 'bg-purple-500' },
    { value: 'amber', label: 'AMBER Alert', icon: '⚠️', color: 'bg-amber-500' },
    { value: 'evacuation', label: 'Evacuation Order', icon: '🚪', color: 'bg-orange-500' }
] as const;

const severityLevels = [
    { value: 'info', label: 'Informational', color: 'bg-blue-500', description: 'Non-urgent updates' },
    { value: 'warning', label: 'Warning', color: 'bg-yellow-500', description: 'Potential danger' },
    { value: 'critical', label: 'Critical', color: 'bg-red-500', description: 'Immediate action required' }
] as const;

export function EmergencyBroadcastConsole() {
    const [formData, setFormData] = useState({
        type: 'breaking' as typeof emergencyTypes[number]['value'],
        severity: 'info' as typeof severityLevels[number]['value'],
        title: '',
        message: '',
        location: '',
        notifyFollowers: true,
        interruptStreams: false
    });
    const [showConfirm, setShowConfirm] = useState(false);
    const [recentBroadcasts, setRecentBroadcasts] = useState<EmergencyBroadcast[]>([]);

    const sendBroadcast = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await fetch('/api/v1/emergency/broadcast', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: (data) => {
            setRecentBroadcasts(prev => [data.broadcast, ...prev].slice(0, 5));
            setFormData({
                type: 'breaking',
                severity: 'info',
                title: '',
                message: '',
                location: '',
                notifyFollowers: true,
                interruptStreams: false
            });
            setShowConfirm(false);
        }
    });

    const selectedType = emergencyTypes.find(t => t.value === formData.type);
    const selectedSeverity = severityLevels.find(s => s.value === formData.severity);

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Radio className="h-6 w-6 text-red-400" />
                        Emergency Broadcast Console
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Send priority alerts to your audience and the platform
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Verified Organization
                </div>
            </div>

            {/* Warning banner */}
            <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <div className="text-yellow-200 font-medium">Use Responsibly</div>
                        <p className="text-yellow-200/70 text-sm">
                            Emergency broadcasts interrupt user experiences and should only be used for genuine
                            emergencies. Misuse may result in verification suspension.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Broadcast form */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Compose Alert</h2>

                <div className="space-y-4">
                    {/* Alert type */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Alert Type</label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {emergencyTypes.map(({ value, label, icon }) => (
                                <button
                                    key={value}
                                    onClick={() => setFormData({ ...formData, type: value })}
                                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${formData.type === value
                                            ? 'bg-purple-500/20 border-purple-500 text-white'
                                            : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <span className="text-2xl">{icon}</span>
                                    <span className="text-xs">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Severity */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Severity Level</label>
                        <div className="grid grid-cols-3 gap-2">
                            {severityLevels.map(({ value, label, color, description }) => (
                                <button
                                    key={value}
                                    onClick={() => setFormData({ ...formData, severity: value })}
                                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${formData.severity === value
                                            ? 'bg-slate-700 border-white/30 text-white'
                                            : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <span className={`w-3 h-3 rounded-full ${color}`} />
                                    <div className="text-left">
                                        <div className="text-sm font-medium">{label}</div>
                                        <div className="text-xs text-slate-500">{description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Alert Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                            placeholder="Brief, clear headline"
                            maxLength={100}
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Message</label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                            placeholder="Provide details and any necessary instructions..."
                            maxLength={500}
                        />
                        <div className="text-xs text-slate-500 mt-1 text-right">
                            {formData.message.length}/500
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Affected Area (optional)
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                            placeholder="City, region, or 'National'"
                        />
                    </div>

                    {/* Options */}
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.notifyFollowers}
                                onChange={(e) => setFormData({ ...formData, notifyFollowers: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500"
                            />
                            <span className="text-slate-300 text-sm flex items-center gap-1">
                                <Bell className="w-4 h-4" />
                                Push notify followers
                            </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.interruptStreams}
                                onChange={(e) => setFormData({ ...formData, interruptStreams: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500"
                            />
                            <span className="text-slate-300 text-sm flex items-center gap-1">
                                <Zap className="w-4 h-4" />
                                Show on active streams
                            </span>
                        </label>
                    </div>

                    {/* Send button */}
                    <Button
                        variant="danger"
                        className="w-full"
                        onClick={() => setShowConfirm(true)}
                        disabled={!formData.title || !formData.message}
                    >
                        <Radio className="w-4 h-4 mr-2" />
                        Send Emergency Broadcast
                    </Button>
                </div>
            </Card>

            {/* Confirmation modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${selectedSeverity?.color}/20`}>
                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">Confirm Broadcast</h3>
                                <p className="text-slate-400 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{selectedType?.icon}</span>
                                <span className="text-white font-medium">{formData.title}</span>
                            </div>
                            <p className="text-slate-300 text-sm">{formData.message}</p>
                            {formData.location && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                                    <MapPin className="w-3 h-3" />
                                    {formData.location}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                            <Users className="w-4 h-4" />
                            <span>Estimated reach: ~50,000 users</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
                                <XCircle className="w-4 h-4 mr-1" />
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                className="flex-1"
                                onClick={() => sendBroadcast.mutate(formData)}
                            >
                                <Send className="w-4 h-4 mr-1" />
                                Confirm & Send
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Recent broadcasts */}
            {recentBroadcasts.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        Recent Broadcasts
                    </h3>
                    <div className="space-y-2">
                        {recentBroadcasts.map((broadcast) => (
                            <div key={broadcast.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{emergencyTypes.find(t => t.value === broadcast.type)?.icon}</span>
                                    <div>
                                        <div className="text-white text-sm">{broadcast.title}</div>
                                        <div className="text-xs text-slate-500">{broadcast.sent_at}</div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400">
                                    <Users className="w-3 h-3 inline mr-1" />
                                    {broadcast.reach.toLocaleString()} reached
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

export default EmergencyBroadcastConsole;
