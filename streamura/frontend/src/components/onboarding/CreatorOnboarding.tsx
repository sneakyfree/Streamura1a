import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    User,
    DollarSign,
    Shield,
    CheckCircle,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Smartphone,
    Video,
    Zap,
    Star,
    ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    completed: boolean;
}

interface CreatorOnboardingProps {
    onComplete: () => void;
    onSkip?: () => void;
}

export function CreatorOnboarding({ onComplete, onSkip }: CreatorOnboardingProps) {
    const { user, updateUser } = useAuthStore();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState({
        displayName: user?.display_name || user?.username || '',
        bio: user?.bio || '',
        streamCategory: 'news',
        enableInstantPayouts: true,
        acceptTerms: false,
    });

    const steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: 'Welcome to Streamura',
            description: 'Start earning from your smartphone in minutes',
            icon: Star,
            completed: true,
        },
        {
            id: 'profile',
            title: 'Set Up Your Profile',
            description: 'Tell viewers who you are',
            icon: User,
            completed: !!formData.displayName,
        },
        {
            id: 'streaming',
            title: 'Streaming Setup',
            description: "Choose what you'll stream",
            icon: Video,
            completed: !!formData.streamCategory,
        },
        {
            id: 'payments',
            title: 'Get Paid Instantly',
            description: 'Set up payouts to start earning',
            icon: DollarSign,
            completed: formData.acceptTerms,
        },
        {
            id: 'complete',
            title: "You're Ready!",
            description: 'Start streaming and earning',
            icon: CheckCircle,
            completed: false,
        },
    ];

    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const response = await api.patch('/users/me', {
                display_name: data.displayName,
                bio: data.bio,
                preferred_category: data.streamCategory,
                instant_payouts_enabled: data.enableInstantPayouts,
                onboarding_completed: true,
            });
            return response.data;
        },
        onSuccess: (data) => {
            updateUser(data);
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = async () => {
        await updateProfileMutation.mutateAsync(formData);
        onComplete();
    };

    const categories = [
        { id: 'news', label: 'Breaking News', icon: '📰' },
        { id: 'sports', label: 'Sports & Events', icon: '⚽' },
        { id: 'music', label: 'Music & Concerts', icon: '🎵' },
        { id: 'protests', label: 'Protests & Rallies', icon: '📢' },
        { id: 'weather', label: 'Weather & Nature', icon: '🌪️' },
        { id: 'community', label: 'Community Events', icon: '🎉' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1 bg-slate-700">
                    <div
                        className="h-full bg-gradient-to-r from-primary-500 to-green-500 transition-all duration-500"
                        style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                    />
                </div>

                {/* Header */}
                <div className="p-6 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === currentStep;
                                const isPast = index < currentStep;

                                return (
                                    <div
                                        key={step.id}
                                        className={cn(
                                            'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                                            isActive && 'bg-primary-500 text-white scale-110',
                                            isPast && 'bg-green-500 text-white',
                                            !isActive && !isPast && 'bg-slate-700 text-slate-400'
                                        )}
                                    >
                                        {isPast ? (
                                            <CheckCircle className="h-5 w-5" />
                                        ) : (
                                            <Icon className="h-5 w-5" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {onSkip && currentStep < steps.length - 1 && (
                            <button
                                onClick={onSkip}
                                className="text-sm text-slate-400 hover:text-white transition-colors"
                            >
                                Skip for now
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="p-8">
                    {/* Step 0: Welcome */}
                    {currentStep === 0 && (
                        <div className="text-center">
                            <div className="h-20 w-20 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Smartphone className="h-10 w-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">Welcome to Streamura</h2>
                            <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                Transform your smartphone into a broadcasting studio. Stream live events,
                                build an audience, and earn money instantly.
                            </p>

                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 bg-slate-700/50 rounded-xl">
                                    <Zap className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                    <p className="text-sm text-white font-medium">90% Revenue</p>
                                    <p className="text-xs text-slate-400">You keep more</p>
                                </div>
                                <div className="p-4 bg-slate-700/50 rounded-xl">
                                    <DollarSign className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                    <p className="text-sm text-white font-medium">$1 Minimum</p>
                                    <p className="text-xs text-slate-400">Cash out fast</p>
                                </div>
                                <div className="p-4 bg-slate-700/50 rounded-xl">
                                    <Shield className="h-8 w-8 text-primary-400 mx-auto mb-2" />
                                    <p className="text-sm text-white font-medium">Trust Score</p>
                                    <p className="text-xs text-slate-400">Build reputation</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Profile */}
                    {currentStep === 1 && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Set Up Your Profile</h2>
                            <p className="text-slate-400 mb-6">Help viewers discover and recognize you</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                        placeholder="Your name or handle"
                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Bio (optional)
                                    </label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Tell viewers about yourself..."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Streaming */}
                    {currentStep === 2 && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">What Will You Stream?</h2>
                            <p className="text-slate-400 mb-6">Choose your primary content type</p>

                            <div className="grid grid-cols-2 gap-3">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setFormData({ ...formData, streamCategory: cat.id })}
                                        className={cn(
                                            'p-4 rounded-xl border-2 transition-all text-left',
                                            formData.streamCategory === cat.id
                                                ? 'border-primary-500 bg-primary-500/10'
                                                : 'border-slate-600 hover:border-slate-500'
                                        )}
                                    >
                                        <span className="text-2xl mb-2 block">{cat.icon}</span>
                                        <span className="text-white font-medium">{cat.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payments */}
                    {currentStep === 3 && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Get Paid Instantly</h2>
                            <p className="text-slate-400 mb-6">Set up payouts to start earning</p>

                            <div className="space-y-4">
                                <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/30">
                                    <div className="flex items-start gap-3">
                                        <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Zap className="h-5 w-5 text-green-400" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-medium">Instant Payouts</h3>
                                            <p className="text-sm text-slate-400">Get your earnings in ~30 minutes (1% fee, max $5)</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.enableInstantPayouts}
                                                onChange={(e) => setFormData({ ...formData, enableInstantPayouts: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-600 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                                        </label>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-700/50 rounded-xl">
                                    <h4 className="text-white font-medium mb-2">Revenue Share: 90/10</h4>
                                    <p className="text-sm text-slate-400">
                                        You keep 90% of all tips, subscriptions, and virtual goods.
                                        That's nearly double what other platforms offer.
                                    </p>
                                </div>

                                <label className="flex items-start gap-3 p-4 bg-slate-700/50 rounded-xl cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.acceptTerms}
                                        onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                                        className="mt-1 h-4 w-4 rounded border-slate-500 text-primary-500 focus:ring-primary-500 bg-slate-600"
                                    />
                                    <span className="text-sm text-slate-300">
                                        I agree to the <a href="/terms" className="text-primary-400 hover:underline">Terms of Service</a> and{' '}
                                        <a href="/privacy" className="text-primary-400 hover:underline">Creator Agreement</a>
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Complete */}
                    {currentStep === 4 && (
                        <div className="text-center">
                            <div className="h-20 w-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <CheckCircle className="h-10 w-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">You're All Set!</h2>
                            <p className="text-slate-400 mb-8 max-w-md mx-auto">
                                Your creator account is ready. Start streaming to build your audience
                                and earn money instantly.
                            </p>

                            <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/30 mb-6">
                                <p className="text-sm text-primary-400">
                                    <Shield className="h-4 w-4 inline mr-1" />
                                    Complete verification to unlock Platinum tier and higher payout limits
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700 flex items-center justify-between">
                    <Button
                        variant="secondary"
                        onClick={handleBack}
                        disabled={currentStep === 0}
                        className={currentStep === 0 ? 'invisible' : ''}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                    </Button>

                    {currentStep < steps.length - 1 ? (
                        <Button
                            onClick={handleNext}
                            disabled={currentStep === 3 && !formData.acceptTerms}
                        >
                            Continue
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleComplete}
                            disabled={updateProfileMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {updateProfileMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Setting up...
                                </>
                            ) : (
                                <>
                                    Start Streaming
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
