import { useState, useEffect } from 'react';
import { followApi, type UserFollowInfo } from '@/lib/api';
import { FollowButton } from './FollowButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowersListProps {
  userId: number;
  type: 'followers' | 'following';
  currentUserId?: number;
  className?: string;
  onUserClick?: (userId: number) => void;
}

export function FollowersList({
  userId,
  type,
  currentUserId,
  className,
  onUserClick,
}: FollowersListProps) {
  const [users, setUsers] = useState<UserFollowInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadUsers();
  }, [userId, type]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      if (type === 'followers') {
        const response = await followApi.getFollowers(userId, limit, 0);
        setUsers(response.followers);
        setTotal(response.total);
      } else {
        const response = await followApi.getFollowing(userId, limit, 0);
        setUsers(response.following);
        setTotal(response.total);
      }
      setOffset(limit);
    } catch (error) {
      console.error(`Failed to load ${type}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || users.length >= total) return;

    setIsLoadingMore(true);
    try {
      if (type === 'followers') {
        const response = await followApi.getFollowers(userId, limit, offset);
        setUsers(prev => [...prev, ...response.followers]);
      } else {
        const response = await followApi.getFollowing(userId, limit, offset);
        setUsers(prev => [...prev, ...response.following]);
      }
      setOffset(prev => prev + limit);
    } catch (error) {
      console.error(`Failed to load more ${type}:`, error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">
          No {type} yet
        </h3>
        <p className="text-muted-foreground text-sm">
          {type === 'followers'
            ? "When people follow this user, they'll appear here."
            : "When this user follows people, they'll appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <Avatar
            className="h-10 w-10 cursor-pointer"
            onClick={() => onUserClick?.(user.id)}
          >
            <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
            <AvatarFallback>
              {user.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => onUserClick?.(user.id)}
          >
            <p className="font-medium truncate">
              {user.username || 'Anonymous'}
            </p>
            <p className="text-xs text-muted-foreground">
              {user.follower_count.toLocaleString()} followers
              {' · '}
              {type === 'followers' ? 'Followed' : 'Following since'} {formatDate(user.followed_at)}
            </p>
          </div>

          {currentUserId && currentUserId !== user.id && (
            <FollowButton
              userId={user.id}
              size="sm"
              variant="outline"
            />
          )}
        </div>
      ))}

      {users.length < total && (
        <div className="pt-4 text-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              `Load more (${total - users.length} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
