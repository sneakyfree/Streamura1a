import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Ad } from '@/lib/api';

interface AdOverlayProps {
    ad: Ad;
    timeLeft: number;
    skipAvailable: boolean;
    onSkip: () => void;
    onClick: () => void;
}

export function AdOverlay({
    ad,
    timeLeft,
    skipAvailable,
    onSkip,
    onClick
}: AdOverlayProps) {
    return (
        <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 border border-slate-700 rounded-lg p-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 fade-in">
            {/* Ad content */}
            <div className="relative h-20 w-32 flex-shrink-0 bg-black rounded overflow-hidden cursor-pointer group" onClick={onClick}>
                <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute top-1 left-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                    AD
                </div>
            </div>

            <div className="flex-grow min-w-0">
                <h4 className="text-white font-semibold truncate hover:text-primary-400 cursor-pointer transition-colors" onClick={onClick}>
                    {ad.title} <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" />
                </h4>
                <p className="text-slate-400 text-sm line-clamp-2">{ad.description}</p>
                <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" onClick={onClick} className="h-7 text-xs">
                        {ad.cta_text}
                    </Button>
                    <span className="text-slate-500 text-xs">
                        {timeLeft}s remaining
                    </span>
                </div>
            </div>

            <div className="flex-shrink-0 flex flex-col items-end gap-2">
                {skipAvailable ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onSkip}
                        className="h-8 text-xs bg-slate-800 hover:bg-slate-700 border-slate-600"
                    >
                        Skip Ad
                    </Button>
                ) : (
                    <div className="h-8 w-20 flex items-center justify-center text-slate-500 text-xs bg-slate-800/50 rounded border border-slate-700/50">
                        Skip in {ad.skip_after - (ad.duration - timeLeft)}s
                    </div>
                )}
            </div>
        </div>
    );
}
