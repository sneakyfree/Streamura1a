import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { followApi } from '@/lib/api';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  userId: number;
  initialFollowing?: boolean;
  followerCount?: number;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
  onFollowChange?: (following: boolean, newCount: number) => void;
}

export function FollowButton({
  userId,
  initialFollowing = false,
  followerCount = 0,
  showCount = false,
  size = 'default',
  variant = 'default',
  className,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check initial follow status
  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        const following = await followApi.isFollowing(userId);
        setIsFollowing(following);
      } catch (error) {
        // User might not be logged in, keep initial state
        console.error('Failed to check follow status:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkFollowStatus();
  }, [userId]);

  // Update state when props change
  useEffect(() => {
    setCount(followerCount);
  }, [followerCount]);

  const handleClick = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        await followApi.unfollow(userId);
        setIsFollowing(false);
        const newCount = Math.max(0, count - 1);
        setCount(newCount);
        onFollowChange?.(false, newCount);
      } else {
        await followApi.follow(userId);
        setIsFollowing(true);
        const newCount = count + 1;
        setCount(newCount);
        onFollowChange?.(true, newCount);
      }
    } catch (error) {
      console.error('Failed to update follow status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Button
        size={size}
        variant={variant}
        className={className}
        disabled
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={isFollowing ? 'outline' : variant}
      className={cn(
        isFollowing && 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
        className
      )}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="h-4 w-4 mr-2" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </>
      )}
      {showCount && count > 0 && (
        <span className="ml-2 text-xs opacity-75">
          ({count.toLocaleString()})
        </span>
      )}
    </Button>
  );
}
