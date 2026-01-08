import { useState, useEffect } from 'react';
import { messagingApi, type Conversation } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  selectedConversationId?: number;
  onSelectConversation: (conversation: Conversation) => void;
  className?: string;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
  className,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const response = await messagingApi.getConversations();
      setConversations(response.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  // Expose method to refresh from parent
  // TODO: Export this method for parent component to use via ref
  const refresh = () => loadConversations();
  // Use refresh to prevent unused variable warning
  void refresh;

  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <p>{error}</p>
        <button
          onClick={loadConversations}
          className="text-primary underline mt-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <p>No conversations yet.</p>
        <p className="text-sm mt-1">Start a conversation by messaging someone!</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div className="space-y-1 p-2">
        {conversations.map(conversation => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
              selectedConversationId === conversation.id
                ? 'bg-accent'
                : 'hover:bg-accent/50'
            )}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={conversation.other_user?.avatar_url ?? undefined}
                alt={conversation.other_user?.username ?? 'User'}
              />
              <AvatarFallback>
                {(conversation.other_user?.username ?? 'U').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {conversation.other_user?.display_name ||
                    conversation.other_user?.username ||
                    'Unknown User'}
                </span>
                {conversation.last_message_at && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(conversation.last_message_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground truncate">
                  {conversation.last_message_preview || 'No messages yet'}
                </p>
                {conversation.unread_count > 0 && (
                  <Badge variant="default" className="shrink-0">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
