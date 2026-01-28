import { useState, useEffect } from 'react';
import { AlertTriangle, X, Bell, ExternalLink, Clock } from 'lucide-react';

interface BreakingNewsItem {
    id: string;
    title: string;
    summary: string;
    link?: string;
    priority: 'urgent' | 'high' | 'normal';
    timestamp: string;
    expiresAt?: string;
    source?: string;
}

interface BreakingNewsBannerProps {
    items?: BreakingNewsItem[];
    onDismiss?: (id: string) => void;
    position?: 'top' | 'bottom';
    autoRotate?: boolean;
    rotateInterval?: number;
}

const priorityConfig = {
    urgent: {
        bg: 'bg-red-600',
        border: 'border-red-500',
        text: 'text-white',
        icon: 'text-white',
        pulse: true,
        sound: true
    },
    high: {
        bg: 'bg-orange-600',
        border: 'border-orange-500',
        text: 'text-white',
        icon: 'text-white',
        pulse: false,
        sound: false
    },
    normal: {
        bg: 'bg-blue-600',
        border: 'border-blue-500',
        text: 'text-white',
        icon: 'text-white',
        pulse: false,
        sound: false
    }
};

export function BreakingNewsBanner({
    items = [],
    onDismiss,
    position = 'top',
    autoRotate = true,
    rotateInterval = 5000
}: BreakingNewsBannerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [isVisible, setIsVisible] = useState(true);

    const activeItems = items.filter(item => !dismissed.has(item.id));

    useEffect(() => {
        if (!autoRotate || activeItems.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % activeItems.length);
        }, rotateInterval);

        return () => clearInterval(timer);
    }, [autoRotate, activeItems.length, rotateInterval]);

    if (activeItems.length === 0 || !isVisible) return null;

    const current = activeItems[currentIndex % activeItems.length];
    const config = priorityConfig[current.priority];

    const handleDismiss = (id: string) => {
        setDismissed(prev => new Set(prev).add(id));
        onDismiss?.(id);
    };

    const timeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
    };

    return (
        <div
            className={`fixed ${position === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 z-50
                ${config.bg} ${config.border} border-b-2
                ${config.pulse ? 'animate-pulse' : ''}`}
        >
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex items-center gap-3">
                    {/* Breaking badge */}
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/30 rounded">
                        <AlertTriangle className={`w-4 h-4 ${config.icon}`} />
                        <span className={`text-xs font-bold uppercase ${config.text}`}>
                            {current.priority === 'urgent' ? 'URGENT' : 'BREAKING'}
                        </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className={`font-semibold ${config.text} truncate`}>
                                {current.title}
                            </span>
                            {current.source && (
                                <span className="text-xs opacity-70">— {current.source}</span>
                            )}
                        </div>
                        {current.summary && (
                            <p className={`text-sm ${config.text} opacity-90 truncate`}>
                                {current.summary}
                            </p>
                        )}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs opacity-70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(current.timestamp)}
                        </span>

                        {current.link && (
                            <a
                                href={current.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs underline opacity-80 hover:opacity-100"
                            >
                                Watch <ExternalLink className="w-3 h-3" />
                            </a>
                        )}

                        {/* Pagination dots */}
                        {activeItems.length > 1 && (
                            <div className="flex items-center gap-1">
                                {activeItems.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentIndex % activeItems.length
                                                ? 'bg-white'
                                                : 'bg-white/40'
                                            }`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Dismiss */}
                        <button
                            onClick={() => handleDismiss(current.id)}
                            className="p-1 hover:bg-black/20 rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Mini version for embedding in other components
export function BreakingNewsIndicator({
    count = 0,
    onClick
}: {
    count?: number;
    onClick?: () => void;
}) {
    if (count === 0) return null;

    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1 px-2 py-1 bg-red-600 rounded-full text-white text-xs font-medium animate-pulse"
        >
            <Bell className="w-3 h-3" />
            {count} Breaking
        </button>
    );
}

export default BreakingNewsBanner;
