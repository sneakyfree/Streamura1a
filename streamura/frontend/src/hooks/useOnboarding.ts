import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook to manage onboarding state.
 * Returns whether onboarding should be shown and functions to complete/skip it.
 */
export function useOnboarding() {
    const { user, isAuthenticated } = useAuthStore();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if user needs onboarding
        if (isAuthenticated && user && !user.onboarding_completed && !dismissed) {
            // Small delay to let the page load
            const timer = setTimeout(() => {
                setShowOnboarding(true);
            }, 500);
            return () => clearTimeout(timer);
        } else {
            setShowOnboarding(false);
        }
    }, [isAuthenticated, user, dismissed]);

    const completeOnboarding = () => {
        setShowOnboarding(false);
        // The CreatorOnboarding component handles updating the user
    };

    const skipOnboarding = () => {
        setShowOnboarding(false);
        setDismissed(true);
        // Store in localStorage so it doesn't show again this session
        localStorage.setItem('onboarding_dismissed', 'true');
    };

    // Check localStorage on mount
    useEffect(() => {
        const wasDismissed = localStorage.getItem('onboarding_dismissed') === 'true';
        if (wasDismissed) {
            setDismissed(true);
        }
    }, []);

    return {
        showOnboarding,
        completeOnboarding,
        skipOnboarding,
        resetOnboarding: () => {
            setDismissed(false);
            localStorage.removeItem('onboarding_dismissed');
        },
    };
}
