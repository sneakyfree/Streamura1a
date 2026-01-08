import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { likeApi } from '@/lib/api';
import { Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  streamId: number;
  initialLiked?: boolean;
  likeCount?: number;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onLikeChange?: (liked: boolean, newCount: number) => void;
}

export function LikeButton({
  streamId,
  initialLiked = false,
  likeCount = 0,
  showCount = true,
  size = 'default',
  variant = 'ghost',
  className,
  onLikeChange,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check initial like status
  useEffect(() => {
    const checkLikeStatus = async () => {
      try {
        const liked = await likeApi.isLiked(streamId);
        setIsLiked(liked);
      } catch (error) {
        // User might not be logged in, keep initial state
        console.error('Failed to check like status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkLikeStatus();
  }, [streamId]);

  // Update state when props change
  useEffect(() => {
    setCount(likeCount);
  }, [likeCount]);

  const handleClick = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isLiked) {
        const response = await likeApi.unlike(streamId);
        setIsLiked(false);
        setCount(response.like_count);
        onLikeChange?.(false, response.like_count);
      } else {
        const response = await likeApi.like(streamId);
        setIsLiked(true);
        setCount(response.like_count);
        onLikeChange?.(true, response.like_count);
      }
    } catch (error) {
      console.error('Failed to update like status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCount = (n: number): string => {
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1)}M`;
    }
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}K`;
    }
    return n.toString();
  };

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        'group transition-colors',
        isLiked && 'text-red-500 hover:text-red-600',
        className
      )}
      onClick={handleClick}
      disabled={isLoading || isChecking}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn(
            'h-4 w-4 transition-all',
            size !== 'icon' && 'mr-2',
            isLiked ? 'fill-current' : 'group-hover:scale-110'
          )}
        />
      )}
      {size !== 'icon' && showCount && (
        <span>{formatCount(count)}</span>
      )}
    </Button>
  );
}
