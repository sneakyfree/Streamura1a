import { useState, useEffect, useCallback, useRef } from 'react';
import { adApi, type Ad } from '@/lib/api';

interface UseAdManagerProps {
    streamId?: number;
    pollInterval?: number; // ms
    enabled?: boolean;
}

interface UseAdManagerReturn {
    currentAd: Ad | null;
    isPlaying: boolean;
    timeLeft: number;
    skipAvailable: boolean;
    handleSkip: () => void;
    handleClick: () => void;
    handleAdComplete: () => void;
}

export function useAdManager({
    streamId,
    pollInterval = 300000, // 5 minutes
    enabled = true,
}: UseAdManagerProps): UseAdManagerReturn {
    const [currentAd, setCurrentAd] = useState<Ad | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const adQueueRef = useRef<Ad[]>([]);
    const lastAdTimeRef = useRef<number>(Date.now());

    // Poll for ads
    useEffect(() => {
        if (!enabled) return;

        const fetchAds = async () => {
            try {
                const activeAds = await adApi.getActiveAds();
                adQueueRef.current = activeAds;
            } catch (err) {
                console.error('Failed to fetch ads:', err);
            }
        };

        fetchAds();
        const interval = setInterval(fetchAds, pollInterval);

        return () => clearInterval(interval);
    }, [enabled, pollInterval]);

    // Logic to trigger ads occasionally
    // For demo: Trigger an ad 10 seconds after "connect", then every 2 minutes
    useEffect(() => {
        if (!enabled || isPlaying) return;

        const checkAndTriggerAd = () => {
            const now = Date.now();
            const timeSinceLastAd = now - lastAdTimeRef.current;

            // If > 2 minutes since last ad and we have ads in queue
            if (timeSinceLastAd > 120000 && adQueueRef.current.length > 0) {
                // Pick random ad based on priority (simple random for now)
                const nextAd = adQueueRef.current[Math.floor(Math.random() * adQueueRef.current.length)];
                triggerAd(nextAd);
            }
        };

        const triggerTimer = setInterval(checkAndTriggerAd, 10000); // Check every 10s
        return () => clearInterval(triggerTimer);
    }, [enabled, isPlaying]);

    const triggerAd = useCallback((ad: Ad) => {
        setCurrentAd(ad);
        setTimeLeft(ad.duration);
        setIsPlaying(true);
        lastAdTimeRef.current = Date.now();

        // Track impression start
        if (streamId) {
            adApi.trackImpression(streamId, {
                ad_network: 'internal',
                ad_unit: 'overlay_v1',
                impression_count: 1,
                click_count: 0,
                revenue: 0.01 // Mock revenue
            }).catch(console.error);
        }
    }, [streamId]);

    // Timer countdown
    useEffect(() => {
        if (!isPlaying || !currentAd) return;

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handleAdComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isPlaying, currentAd]);

    const handleSkip = useCallback(() => {
        if (currentAd && currentAd.skip_after <= (currentAd.duration - timeLeft)) {
            handleAdComplete();
        }
    }, [currentAd, timeLeft]);

    const handleAdComplete = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsPlaying(false);
        setCurrentAd(null);
    }, []);

    const handleClick = useCallback(() => {
        if (!currentAd) return;

        // Track click
        if (streamId) {
            adApi.trackImpression(streamId, {
                ad_network: 'internal',
                ad_unit: 'overlay_v1',
                impression_count: 0,
                click_count: 1,
                revenue: 0.05 // Extra revenue for click
            }).catch(console.error);
        }

        if (currentAd.cta_url && currentAd.cta_url !== '#') {
            window.open(currentAd.cta_url, '_blank');
        }
    }, [currentAd, streamId]);

    const skipAvailable = currentAd ? (currentAd.duration - timeLeft) >= currentAd.skip_after : false;

    return {
        currentAd,
        isPlaying,
        timeLeft,
        skipAvailable,
        handleSkip,
        handleClick,
        handleAdComplete
    };
}
