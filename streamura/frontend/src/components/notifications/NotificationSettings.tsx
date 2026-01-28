import { Bell, BellOff, Loader2, CheckCircle, XCircle, Smartphone, Monitor } from 'lucide-react';
import { usePushNotifications, useNotificationPreferences } from '@/hooks/usePushNotifications';
import type { NotificationPreferences } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface NotificationSettingsProps {
    className?: string;
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
    const {
        permission,
        isSubscribed,
        isLoading: pushLoading,
        subscribe,
        unsubscribe,
    } = usePushNotifications();

    const {
        preferences,
        isLoading: prefsLoading,
        updatePreference,
    } = useNotificationPreferences();

    const notificationTypes: { key: keyof NotificationPreferences; label: string; description: string; icon: string }[] = [
        { key: 'stream_live', label: 'Live Streams', description: 'When creators you follow go live', icon: '🎥' },
        { key: 'tips', label: 'Tips Received', description: 'When someone sends you a tip', icon: '💰' },
        { key: 'follows', label: 'New Followers', description: 'When someone follows you', icon: '👤' },
        { key: 'comments', label: 'Comments', description: 'Replies to your streams and posts', icon: '💬' },
        { key: 'earnings', label: 'Earnings Updates', description: 'Payout and revenue notifications', icon: '📈' },
        { key: 'system', label: 'System Alerts', description: 'Important account and security updates', icon: '⚠️' },
        { key: 'marketing', label: 'Promotions', description: 'News, tips, and special offers', icon: '📢' },
    ];

    const handleToggle = async (key: keyof NotificationPreferences) => {
        if (!preferences) return;
        try {
            await updatePreference(key, !preferences[key]);
        } catch (error) {
            console.error('Failed to update preference:', error);
        }
    };

    return (
        <div className={cn('space-y-6', className)}>
            {/* Push Notifications Card */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Bell className="h-5 w-5 text-primary-400" />
                        Push Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {permission === 'unsupported' ? (
                        <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
                            <XCircle className="h-5 w-5 text-red-400" />
                            <div>
                                <p className="text-white font-medium">Not Supported</p>
                                <p className="text-sm text-slate-400">
                                    Your browser doesn't support push notifications.
                                </p>
                            </div>
                        </div>
                    ) : permission === 'denied' ? (
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                            <BellOff className="h-5 w-5 text-red-400" />
                            <div>
                                <p className="text-white font-medium">Notifications Blocked</p>
                                <p className="text-sm text-slate-400">
                                    Enable notifications in your browser settings to receive alerts.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {isSubscribed ? (
                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                ) : (
                                    <Bell className="h-5 w-5 text-slate-400" />
                                )}
                                <div>
                                    <p className="text-white font-medium">
                                        {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
                                    </p>
                                    <p className="text-sm text-slate-400">
                                        {isSubscribed
                                            ? 'You\'ll receive alerts on this device'
                                            : 'Get notified about streams, tips, and more'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant={isSubscribed ? 'secondary' : 'default'}
                                onClick={isSubscribed ? unsubscribe : subscribe}
                                disabled={pushLoading}
                            >
                                {pushLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isSubscribed ? (
                                    'Disable'
                                ) : (
                                    'Enable'
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Device info */}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            <span>Desktop</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            <span>Mobile</span>
                        </div>
                        <span>Notifications work on both devices</span>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Preferences Card */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white">Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                    {prefsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary-400" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {notificationTypes.map((type) => (
                                <div
                                    key={type.key}
                                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{type.icon}</span>
                                        <div>
                                            <p className="text-white font-medium text-sm">{type.label}</p>
                                            <p className="text-xs text-slate-400">{type.description}</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences?.[type.key] ?? false}
                                            onChange={() => handleToggle(type.key)}
                                            className="sr-only peer"
                                            disabled={!isSubscribed}
                                        />
                                        <div className={cn(
                                            'w-11 h-6 rounded-full peer transition-colors',
                                            'peer-focus:ring-2 peer-focus:ring-primary-500',
                                            "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                                            'after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all',
                                            'peer-checked:after:translate-x-full peer-checked:after:border-white',
                                            preferences?.[type.key] ? 'bg-primary-500' : 'bg-slate-600',
                                            !isSubscribed && 'opacity-50 cursor-not-allowed'
                                        )} />
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}

                    {!isSubscribed && (
                        <p className="mt-4 text-xs text-slate-500 text-center">
                            Enable push notifications above to customize your preferences
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
