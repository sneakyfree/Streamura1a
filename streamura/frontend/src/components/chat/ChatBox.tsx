import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { chatApi, type ChatMessage as ChatMessageType } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface ChatBoxProps {
  streamId: number;
  roomName?: string;
  isLive?: boolean;
  isOwner?: boolean;
  viewerCount?: number;
  className?: string;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

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
        } else if (data.type === 'chat_message_deleted') {
          setMessages(prev =>
            prev.filter(msg => msg.id !== data.message_id)
          );
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

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Live Chat
          {wsConnected && (
            <span className="w-2 h-2 bg-green-500 rounded-full" title="Connected" />
          )}
        </h3>
        <span className="text-xs text-slate-400">
          {viewerCount} watching
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
            <AlertCircle className="w-6 h-6 mb-2" />
            <p className="text-sm text-center">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {isLive ? 'No messages yet. Be the first to chat!' : 'Chat is available for live streams'}
          </div>
        ) : (
          <div className="py-2">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwner={isOwner}
                isAdmin={user?.is_admin}
                currentUserId={user?.id}
                onDelete={handleDeleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        disabled={!isLive || !isAuthenticated}
        placeholder={
          !isAuthenticated
            ? 'Sign in to chat'
            : !isLive
            ? 'Chat is only available during live streams'
            : 'Send a message...'
        }
      />
    </div>
  );
}
