import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { communityApi, type Community } from '@/lib/api';
import { Users, Lock, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommunityCardProps {
  community: Community;
  currentUserId?: number;
  onJoinChange?: (communityId: number, isMember: boolean) => void;
  onClick?: () => void;
  className?: string;
}

export function CommunityCard({
  community,
  currentUserId,
  onJoinChange,
  onClick,
  className,
}: CommunityCardProps) {
  const [isMember, setIsMember] = useState(community.is_member ?? false);
  const [memberCount, setMemberCount] = useState(community.member_count);
  const [isLoading, setIsLoading] = useState(false);

  const isOwner = currentUserId === community.owner_id;

  const handleJoinLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading || isOwner) return;

    setIsLoading(true);
    try {
      if (isMember) {
        await communityApi.leave(community.id);
        setIsMember(false);
        setMemberCount(prev => Math.max(0, prev - 1));
        onJoinChange?.(community.id, false);
      } else {
        await communityApi.join(community.id);
        setIsMember(true);
        setMemberCount(prev => prev + 1);
        onJoinChange?.(community.id, true);
      }
    } catch (error) {
      console.error('Failed to update membership:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={cn(
        'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {/* Banner image */}
      {community.banner_url && (
        <div className="h-24 w-full overflow-hidden rounded-t-lg">
          <img
            src={community.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={community.image_url ?? undefined} alt={community.name} />
            <AvatarFallback>{community.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{community.name}</h3>
              {community.is_public ? (
                <Globe className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{memberCount.toLocaleString()} members</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-2">
        {community.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {community.description}
          </p>
        )}
        {community.tags && community.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {community.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {community.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{community.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter>
        {isOwner ? (
          <Badge variant="default" className="w-full justify-center">
            Owner
          </Badge>
        ) : (
          <Button
            variant={isMember ? 'outline' : 'default'}
            size="sm"
            className={cn(
              'w-full',
              isMember && 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive'
            )}
            onClick={handleJoinLeave}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isMember ? (
              'Leave'
            ) : (
              'Join'
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
