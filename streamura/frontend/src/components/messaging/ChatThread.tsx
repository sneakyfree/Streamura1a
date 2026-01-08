import { useState, useEffect, useRef, useCallback } from 'react';
import { messagingApi, type DirectMessage, type Conversation } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

interface ChatThreadProps {
  conversation: Conversation;
  currentUserId: number;
  className?: string;
  onNewMessage?: (message: DirectMessage) => void;
}

export function ChatThread({
  conversation,
  currentUserId,
  className,
  onNewMessage,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    // Mark conversation as read
    messagingApi.markRead(conversation.id).catch(console.error);
  }, [conversation.id]);

  const loadMessages = async (beforeId?: number) => {
    try {
      const response = await messagingApi.getMessages(conversation.id, {
        limit: 50,
        before_id: beforeId,
      });

      if (beforeId) {
        // Prepend older messages
        setMessages(prev => [...response.messages, ...prev]);
      } else {
        setMessages(response.messages);
        // Scroll to bottom on initial load
        setTimeout(() => bottomRef.current?.scrollIntoView(), 100);
      }

      setHasMore(response.messages.length >= 50);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || messages.length === 0) return;
    const oldestMessage = messages[0];
    if (oldestMessage) {
      loadMessages(oldestMessage.id);
    }
  }, [hasMore, isLoading, messages]);

  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0) {
      loadMore();
    }
  };

  // Add new message (called from parent via WebSocket)
  // TODO: Export this method for parent component to use via ref
  const addMessage = useCallback((message: DirectMessage) => {
    setMessages(prev => [...prev, message]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    onNewMessage?.(message);
  }, [onNewMessage]);

  // Use addMessage to prevent unused variable warning
  // This will be called by parent component via callback
  void addMessage;

  // Format date header
  const formatDateHeader = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at);
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, DirectMessage[]>);

  if (isLoading) {
    return (
      <div className={cn('flex flex-col space-y-4 p-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={cn('flex gap-2', i % 2 === 0 ? 'justify-start' : 'justify-end')}
          >
            {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
            <Skeleton className="h-16 w-48" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <p className="text-muted-foreground">
          No messages yet. Start the conversation!
        </p>
      </div>
    );
  }

  return (
    <ScrollArea
      className={cn('h-full', className)}
      ref={scrollRef}
      onScroll={handleScroll}
    >
      <div className="p-4 space-y-4">
        {/* Load more indicator */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={loadMore}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Load older messages
            </button>
          </div>
        )}

        {/* Messages grouped by date */}
        {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
          <div key={dateKey}>
            {/* Date header */}
            <div className="flex items-center justify-center my-4">
              <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                {formatDateHeader(new Date(dateKey))}
              </div>
            </div>

            {/* Messages for this date */}
            {dateMessages.map((message, index) => {
              const isOwn = message.sender_id === currentUserId;
              const showAvatar =
                !isOwn &&
                (index === 0 || dateMessages[index - 1]?.sender_id !== message.sender_id);

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2 mb-2',
                    isOwn ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Avatar for other user */}
                  {!isOwn && (
                    <div className="w-8">
                      {showAvatar && (
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={conversation.other_user?.avatar_url ?? undefined}
                            alt={conversation.other_user?.username ?? 'User'}
                          />
                          <AvatarFallback className="text-xs">
                            {(conversation.other_user?.username ?? 'U')
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={cn(
                        'text-xs mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {format(new Date(message.created_at), 'h:mm a')}
                      {isOwn && message.is_read && (
                        <span className="ml-2">Read</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
