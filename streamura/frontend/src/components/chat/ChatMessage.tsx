import { User, DollarSign } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '@/lib/api';
import { ChatMessageActionMenu } from './ChatMessageActionMenu';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwner?: boolean;
  isAdmin?: boolean;
  currentUserId?: number;
  onDelete?: (messageId: number) => void;
  onTimeout?: (userId: number, username: string) => void;
  onBan?: (userId: number, username: string) => void;
}

export function ChatMessage({
  message,
  isOwner = false,
  isAdmin = false,
  currentUserId,
  onDelete,
  onTimeout,
  onBan
}: ChatMessageProps) {
  const isOwnMessage = message.user_id === currentUserId;
  const canModerate = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin || message.user_id === currentUserId;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`group flex gap-2 px-3 py-1.5 hover:bg-slate-700/30 ${message.is_highlighted ? 'bg-yellow-500/10 border-l-2 border-yellow-500' : ''
        }`}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center mt-0.5">
        {message.avatar_url ? (
          <img
            src={message.avatar_url}
            alt={message.username || 'User'}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <User className="w-3 h-3 text-slate-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isOwnMessage ? 'text-primary-400' : 'text-slate-300'
              }`}
          >
            {message.username || 'Anonymous'}
          </span>

          {/* Tip badge */}
          {message.tip_amount && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
              <DollarSign className="w-3 h-3" />
              {message.tip_amount.toFixed(2)}
            </span>
          )}

          <span className="text-xs text-slate-500">
            {formatTime(message.created_at)}
          </span>

          {/* Actions Menu */}
          {(canDelete || canModerate) && (
            <ChatMessageActionMenu
              isOwner={isOwner}
              isAdmin={isAdmin}
              canDelete={canDelete}
              onDelete={() => onDelete?.(message.id)}
              onTimeout={() => message.user_id && message.username && onTimeout?.(message.user_id, message.username)}
              onBan={() => message.user_id && message.username && onBan?.(message.user_id, message.username)}
            />
          )}
        </div>

        <p className="text-sm text-white break-words">{message.content}</p>
      </div>
    </div>
  );
}
