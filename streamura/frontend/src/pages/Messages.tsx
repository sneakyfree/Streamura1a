import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  Send,
  ArrowLeft,
  MoreVertical,
  Ban,
  Loader2,
  Check,
  CheckCheck,
} from 'lucide-react';
import { messagingApi, blockApi, type Conversation, type DirectMessage } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

export function MessagesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  const selectedConversationId = searchParams.get('conversation');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showMobileConversations, setShowMobileConversations] = useState(!selectedConversationId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch conversations
  const { data: conversationsResponse, isLoading: loadingConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingApi.getConversations(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const conversations = conversationsResponse?.conversations ?? [];

  // Find selected conversation
  const selectedConversation = conversations.find(
    c => c.id === parseInt(selectedConversationId || '0', 10)
  );

  // Get the other user in the conversation
  const otherUser = selectedConversation?.other_user;

  // Fetch messages for selected conversation
  const { data: messagesResponse, isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', selectedConversationId],
    queryFn: () => messagingApi.getMessages(parseInt(selectedConversationId!, 10), { limit: 100 }),
    enabled: !!selectedConversationId && isAuthenticated,
    refetchInterval: 5000,
  });

  const messages = messagesResponse?.messages ?? [];

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      messagingApi.send(otherUser!.id, content),
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: (conversationId: number) => messagingApi.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Block user mutation
  const blockMutation = useMutation({
    mutationFn: (userId: number) => blockApi.block(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSearchParams({});
    },
  });

  // Mark conversation as read when viewing
  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markReadMutation.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSearchParams({ conversation: conversation.id.toString() });
    setShowMobileConversations(false);
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !otherUser) return;
    sendMutation.mutate(messageInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const otherName = c.other_user?.display_name || c.other_user?.username || '';
    return otherName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Format relative time
  const formatTime = (date: string | null) => {
    if (!date) return '';
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return messageDate.toLocaleDateString();
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: DirectMessage[]) => {
    const groups: { date: string; messages: DirectMessage[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString();
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-64px)] bg-slate-900 flex">
      {/* Conversations List */}
      <div
        className={cn(
          'w-full md:w-80 lg:w-96 border-r border-slate-800 flex flex-col',
          showMobileConversations ? 'block' : 'hidden md:flex'
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => {
              const other = conversation.other_user;
              const otherName = other?.display_name || other?.username || 'Unknown';
              const otherAvatar = other?.avatar_url;
              const isSelected = conversation.id === parseInt(selectedConversationId || '0', 10);

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    'w-full p-4 flex items-start gap-3 hover:bg-slate-800/50 transition-colors text-left',
                    isSelected && 'bg-slate-800'
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={otherAvatar ?? undefined} />
                      <AvatarFallback>
                        {otherName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'font-medium truncate',
                        conversation.unread_count > 0 ? 'text-white' : 'text-slate-300'
                      )}>
                        {otherName}
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                        {formatTime(conversation.last_message_at)}
                      </span>
                    </div>
                    {conversation.last_message_preview && (
                      <p className={cn(
                        'text-sm truncate',
                        conversation.unread_count > 0 ? 'text-slate-300' : 'text-slate-500'
                      )}>
                        {conversation.last_message_preview}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                <MessageSquare className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No conversations yet
              </h3>
              <p className="text-slate-400 text-sm">
                Start a conversation by messaging someone from their profile
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={cn(
          'flex-1 flex flex-col',
          !showMobileConversations ? 'block' : 'hidden md:flex'
        )}
      >
        {selectedConversation && otherUser ? (
          <>
            {/* Chat Header */}
            <ChatHeader
              otherUser={otherUser}
              onBack={() => setShowMobileConversations(true)}
              onBlock={() => blockMutation.mutate(otherUser.id)}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : messages.length > 0 ? (
                groupMessagesByDate(messages).map((group) => (
                  <div key={group.date}>
                    <div className="flex items-center justify-center my-4">
                      <span className="text-xs text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                        {group.date}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwn={message.sender_id === user?.id}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  No messages yet. Say hello!
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-800">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 bg-slate-800 border-slate-700"
                  disabled={sendMutation.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-4">
              <MessageSquare className="h-10 w-10 text-slate-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Select a conversation
            </h2>
            <p className="text-slate-400 max-w-sm">
              Choose a conversation from the list or start a new one by messaging someone
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatHeaderProps {
  otherUser: {
    id: number;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  onBack: () => void;
  onBlock: () => void;
}

function ChatHeader({ otherUser, onBack, onBlock }: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const otherName = otherUser.display_name || otherUser.username || 'Unknown';

  return (
    <div className="p-4 border-b border-slate-800 flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <Avatar className="h-10 w-10">
        <AvatarImage src={otherUser.avatar_url ?? undefined} />
        <AvatarFallback>
          {otherName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-white truncate">{otherName}</h2>
      </div>

      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 py-1">
              <button
                onClick={() => {
                  onBlock();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
              >
                <Ban className="h-4 w-4" />
                Block User
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: DirectMessage;
  isOwn: boolean;
}

function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2',
          isOwn
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 rounded-bl-sm'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div className={cn(
          'flex items-center gap-1 mt-1',
          isOwn ? 'justify-end' : 'justify-start'
        )}>
          <span className={cn(
            'text-xs',
            isOwn ? 'text-primary-200' : 'text-slate-500'
          )}>
            {time}
          </span>
          {isOwn && (
            message.is_read ? (
              <CheckCheck className="h-3 w-3 text-primary-200" />
            ) : (
              <Check className="h-3 w-3 text-primary-300" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
