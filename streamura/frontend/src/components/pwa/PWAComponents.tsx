import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Wifi, WifiOff, RefreshCw, Bell } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useInstallPrompt, useServiceWorker, useOfflineData } from '@/hooks/useOfflineSupport';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// PWA Install Banner
export function InstallBanner() {
    const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if banner was previously dismissed
        const wasDismissed = localStorage.getItem('streamura_install_dismissed');
        if (wasDismissed) {
            const dismissedAt = new Date(wasDismissed);
            // Show again after 7 days
            if (Date.now() - dismissedAt.getTime() < 7 * 24 * 60 * 60 * 1000) {
                setDismissed(true);
            }
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('streamura_install_dismissed', new Date().toISOString());
    };

    const handleInstall = async () => {
        const installed = await promptInstall();
        if (installed) {
            setDismissed(true);
        }
    };

    if (isInstalled || !canInstall || dismissed) {
        return null;
    }

    return (
        <div className="fixed bottom-0 inset-x-0 p-4 z-50 md:bottom-4 md:right-4 md:left-auto md:w-80">
            <Card className="bg-gradient-to-r from-purple-900 to-purple-700 border-purple-500/50 p-4 shadow-xl">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 text-white/60 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1">Install Streamura</h3>
                        <p className="text-white/80 text-sm mb-3">
                            Get the full app experience with offline access and notifications.
                        </p>
                        <Button variant="secondary" size="sm" onClick={handleInstall}>
                            <Download className="w-4 h-4 mr-1" />
                            Install App
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// Offline Status Indicator
export function OfflineIndicator() {
    const { isOnline, pendingActions } = useOfflineData();
    const [show, setShow] = useState(!isOnline);

    useEffect(() => {
        if (!isOnline) {
            setShow(true);
        } else if (pendingActions === 0) {
            // Hide after a moment when coming back online
            const timer = setTimeout(() => setShow(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [isOnline, pendingActions]);

    if (!show) return null;

    return (
        <div className={`fixed top-0 inset-x-0 z-50 p-2 text-center text-sm font-medium transition-colors ${isOnline
                ? 'bg-green-500 text-white'
                : 'bg-yellow-500 text-yellow-900'
            }`}>
            <div className="flex items-center justify-center gap-2">
                {isOnline ? (
                    <>
                        <Wifi className="w-4 h-4" />
                        Back online{pendingActions > 0 ? ` - Syncing ${pendingActions} actions...` : ''}
                    </>
                ) : (
                    <>
                        <WifiOff className="w-4 h-4" />
                        You're offline. Some features may be limited.
                    </>
                )}
            </div>
        </div>
    );
}

// Update Available Banner
export function UpdateBanner() {
    const { updateAvailable, update } = useServiceWorker();

    if (!updateAvailable) return null;

    return (
        <div className="fixed bottom-20 inset-x-0 p-4 z-50 md:bottom-4 md:right-4 md:left-auto md:w-72">
            <Card className="bg-blue-900 border-blue-500/50 p-4 shadow-xl">
                <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                        <p className="text-white text-sm font-medium">Update available</p>
                        <p className="text-blue-300 text-xs">Refresh to get the latest features</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={update}>
                        Refresh
                    </Button>
                </div>
            </Card>
        </div>
    );
}

// Notification Permission Prompt
export function NotificationPrompt() {
    const { permission, isSupported, subscribe } = usePushNotifications();
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const wasDismissed = localStorage.getItem('streamura_notif_prompt_dismissed');
        if (wasDismissed) {
            setDismissed(true);
        }
    }, []);

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('streamura_notif_prompt_dismissed', 'true');
    };

    const handleEnable = async () => {
        await subscribe();
        setDismissed(true);
    };

    // Don't show if not supported, already granted/denied, or dismissed
    if (!isSupported || permission !== 'default' || dismissed) {
        return null;
    }

    return (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
            <Card className="bg-slate-800 border-slate-700 p-4 shadow-xl">
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Bell className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-medium mb-1">Stay Updated</h3>
                        <p className="text-slate-400 text-sm mb-3">
                            Get notified when your favorite streamers go live.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={handleDismiss}>
                                Later
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleEnable}>
                                Enable
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

// Combined PWA UI Components
export function PWAComponents() {
    return (
        <>
            <InstallBanner />
            <OfflineIndicator />
            <UpdateBanner />
            <NotificationPrompt />
        </>
    );
}

export default PWAComponents;
