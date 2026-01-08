import { Crown, Star, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SubscriberBadgeProps {
  tierName?: string;
  tierPrice?: number;
  badgeUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function SubscriberBadge({
  tierName = 'Subscriber',
  tierPrice = 0,
  badgeUrl,
  size = 'md',
  showTooltip = true,
}: SubscriberBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const badgeSizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-2.5 py-1.5',
  };

  const getTierColor = () => {
    if (tierPrice >= 25) return 'bg-gradient-to-r from-yellow-500 to-amber-500';
    if (tierPrice >= 10) return 'bg-gradient-to-r from-purple-500 to-pink-500';
    return 'bg-gradient-to-r from-blue-500 to-cyan-500';
  };

  const getTierIcon = () => {
    const iconClass = sizeClasses[size];
    if (tierPrice >= 25) return <Crown className={`${iconClass} text-white`} />;
    if (tierPrice >= 10) return <Star className={`${iconClass} text-white`} />;
    return <Sparkles className={`${iconClass} text-white`} />;
  };

  const BadgeContent = () => (
    <Badge
      className={`${getTierColor()} ${badgeSizeClasses[size]} text-white border-0 flex items-center gap-1`}
    >
      {badgeUrl ? (
        <img
          src={badgeUrl}
          alt={tierName}
          className={sizeClasses[size]}
        />
      ) : (
        getTierIcon()
      )}
      {size !== 'sm' && <span>{tierName}</span>}
    </Badge>
  );

  if (!showTooltip) {
    return <BadgeContent />;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <BadgeContent />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tierName} Subscriber</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SubscriberBadge;
