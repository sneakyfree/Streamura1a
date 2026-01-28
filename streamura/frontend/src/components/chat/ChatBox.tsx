import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Loader2, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { chatApi, type ChatMessage as ChatMessageType } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { BanUserModal } from './BanUserModal';
import { TimeoutModal } from './TimeoutModal';
import { cn } from '@/lib/utils'; // Assuming this exists, or use utility

interface ChatBoxProps {
  streamId: number;
  roomName?: string;
  isLive?: boolean;
  isOwner?: boolean;
  viewerCount?: number;
  className?: string;
}

interface ChatUser {
  user_id: number;
  username: string;
  avatar_url?: string;
}

export function ChatBox({
  streamId,
  roomName,
  isLive = false,
  isOwner = false,
  viewerCount = 0,
  className = ''
}: ChatBoxProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'viewers'>('chat');
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [showBanModal, setShowBanModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: number, username: string } | null>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load initial chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        const history = await chatApi.getHistory(streamId);
        setMessages(history);
        setError(null);
      } catch {
        setError('Failed to load chat history');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [streamId]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isLive || !roomName) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/ws/stream/${roomName}`;

    const token = localStorage.getItem('access_token');
    const urlWithAuth = token ? `${wsUrl}?token=${token}` : wsUrl;

    const ws = new WebSocket(urlWithAuth);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      console.log('Chat WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_message') {
          const newMessage: ChatMessageType = {
            id: data.message.id,
            stream_id: streamId,
            user_id: data.message.user_id,
            content: data.message.content,
            is_deleted: false,
            is_highlighted: data.message.is_highlighted || false,
            tip_amount: data.message.tip_amount || null,
            created_at: data.message.created_at,
            username: data.message.username,
            avatar_url: data.message.avatar_url || null
          };
          setMessages(prev => [...prev, newMessage]);
        } else if (data.type === 'chat_typing') {
          setTypingUsers(prev => {
            const next = new Set(prev);
            if (data.is_typing) {
              next.add(data.username);
            } else {
              next.delete(data.username);
            }
            return next;
          });
        } else if (data.type === 'user_list') {
          setOnlineUsers(data.users);
        } else if (data.type === 'user_joined') {
          setOnlineUsers(prev => {
            if (prev.some(u => u.user_id === data.user.user_id)) return prev;
            return [...prev, data.user];
          });
        } else if (data.type === 'user_left') {
          setOnlineUsers(prev => prev.filter(u => u.user_id !== data.user_id));
        } else if (data.type === 'chat_message_deleted') {
          setMessages(prev =>
            prev.filter(msg => msg.id !== data.message_id)
          );
        } else if (data.type === 'tip_received') {
          // Trigger confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });

          // Show toast
          toast.success(`Tip of $${data.amount.toFixed(2)} received from ${data.from_user || 'Anonymous'}!`);

          // Add system message (optional, handled by backend usually but nice to have)
          const systemMessage: ChatMessageType = {
            id: Date.now(), // Temporary ID
            stream_id: streamId,
            user_id: 0, // System user
            content: `💰 ${data.from_user || 'Anonymous'} tipped $${data.amount.toFixed(2)}: ${data.message || ''}`,
            is_deleted: false,
            is_highlighted: true,
            tip_amount: data.amount,
            created_at: new Date().toISOString(),
            username: 'System',
            avatar_url: null
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      console.error('Chat WebSocket error');
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('Chat WebSocket closed');
    };

    return () => {
      ws.close();
    };
  }, [isLive, roomName, streamId]);

  const handleSendMessage = async (content: string) => {
    if (!isAuthenticated) {
      setError('Please sign in to chat');
      return;
    }

    const newMessage = await chatApi.sendMessage(streamId, content);

    // If WebSocket isn't connected, add message locally
    if (!wsConnected) {
      setMessages(prev => [...prev, newMessage]);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await chatApi.deleteMessage(messageId);
      // If WebSocket isn't connected, remove locally
      if (!wsConnected) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch {
      setError('Failed to delete message');
    }
  };

  const handleBan = useCallback((userId: number, username: string) => {
    setSelectedUser({ id: userId, username });
    setShowBanModal(true);
  }, []);

  const handleTimeout = useCallback((userId: number, username: string) => {
    setSelectedUser({ id: userId, username });
    setShowTimeoutModal(true);
  }, []);

  const handleTyping = (isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping
      }));
    }
  };

  const typingArray = Array.from(typingUsers);
  const typingText = typingArray.length > 0
    ? `${typingArray.slice(0, 2).join(', ')}${typingArray.length > 2 ? ` and ${typingArray.length - 2} others` : ''} ${typingArray.length === 1 ? 'is' : 'are'} typing...`
    : '';

  return (
    <div className={`flex flex-col h-full bg-slate-800 rounded-lg overflow-hidden border border-slate-700 ${className}`}>
      {/* Header / Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors hover:bg-slate-700/50 flex items-center justify-center gap-2",
            activeTab === 'chat' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-slate-400'
          )}
        >
          <MessageCircle className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('viewers')}
          className={cn(
            "flex-1 py-3 text-sm font-medium transition-colors hover:bg-slate-700/50 flex items-center justify-center gap-2",
            activeTab === 'viewers' ? 'text-primary-400 border-b-2 border-primary-500' : 'text-slate-400'
          )}
        >
          <Users className="w-4 h-4" />
          Viewers
          <span className="text-xs bg-slate-900/50 px-1.5 py-0.5 rounded-full">
            {viewerCount}
          </span>
        </button>
      </div>

      {activeTab === 'chat' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <AlertCircle className="w-6 h-6" />
                <p>{error}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
                <p>Welcome to the chat!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isOwner={isOwner}
                  isAdmin={user?.is_admin}
                  currentUserId={user?.id}
                  onDelete={handleDeleteMessage}
                  onBan={handleBan}
                  onTimeout={handleTimeout}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Indicator */}
          {typingText && (
            <div className="px-4 py-1 text-xs text-slate-400 italic animate-pulse">
              {typingText}
            </div>
          )}

          <ChatInput
            onSend={handleSendMessage}
            disabled={!wsConnected || !isAuthenticated || !isLive}
            onTyping={handleTyping}
            placeholder={
              !isAuthenticated
                ? 'Sign in to chat'
                : !isLive
                  ? 'Chat is only available during live streams'
                  : 'Send a message...'
            }
          />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Online Users</h3>
          {onlineUsers.length > 0 ? (
            onlineUsers.map((u) => (
              <div key={u.user_id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-700/50">
                <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white uppercase overflow-hidden">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} className="h-full w-full object-cover" alt={u.username} />
                  ) : (
                    u.username ? u.username.substring(0, 2) : 'AN'
                  )}
                </div>
                <span className="text-sm text-slate-200 font-medium">{u.username || 'Anonymous'}</span>
              </div>
            ))) : (
            <p className="text-sm text-slate-500 text-center py-4">No logged-in users visible</p>
          )}
        </div>
      )}

      {selectedUser && (
        <>
          <BanUserModal
            isOpen={showBanModal}
            onClose={() => setShowBanModal(false)}
            streamId={streamId}
            userId={selectedUser.id}
            username={selectedUser.username}
          />
          <TimeoutModal
            isOpen={showTimeoutModal}
            onClose={() => setShowTimeoutModal(false)}
            streamId={streamId}
            userId={selectedUser.id}
            username={selectedUser.username}
          />
        </>
      )}
    </div>
  );
}
