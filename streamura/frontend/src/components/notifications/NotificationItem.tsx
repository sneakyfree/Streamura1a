import { Link } from 'react-router-dom';
import {
  UserPlus, DollarSign, Video, Heart, MessageSquare,
  Bell, Award, Users, AlertCircle
} from 'lucide-react';
import type { Notification } from '@/types';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: number) => void;
  compact?: boolean;
}

const notificationConfig: Record<string, {
  icon: typeof Bell;
  color: string;
  bgColor: string;
  getLink: (data: Record<string, unknown>) => string | null;
}> = {
  follow: {
    icon: UserPlus,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    getLink: (data) => data.user_id ? `/users/${data.user_id}` : null,
  },
  tip: {
    icon: DollarSign,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    getLink: (data) => data.stream_id ? `/streams/${data.stream_id}` : '/analytics',
  },
  stream_live: {
    icon: Video,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    getLink: (data) => data.stream_id ? `/streams/${data.stream_id}` : '/discover',
  },
  like: {
    icon: Heart,
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
    getLink: (data) => data.stream_id ? `/streams/${data.stream_id}` : null,
  },
  comment: {
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    getLink: (data) => data.stream_id ? `/streams/${data.stream_id}` : null,
  },
  subscription: {
    icon: Award,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    getLink: () => '/analytics',
  },
  community: {
    icon: Users,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    getLink: (data) => data.community_id ? `/communities/${data.community_id}` : '/communities',
  },
  system: {
    icon: Bell,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    getLink: () => null,
  },
  warning: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    getLink: () => null,
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function NotificationItem({ notification, onMarkRead, compact = false }: NotificationItemProps) {
  const config = notificationConfig[notification.type] || notificationConfig.system;
  const Icon = config.icon;
  const data = (notification.data || {}) as Record<string, unknown>;
  const link = config.getLink(data);

  const handleClick = () => {
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  const content = (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer
        ${notification.read ? 'bg-transparent' : 'bg-slate-700/30'}
        hover:bg-slate-700/50
        ${compact ? 'py-2' : 'py-3'}
      `}
      onClick={handleClick}
    >
      <div className={`p-2 rounded-lg ${config.bgColor} flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.read ? 'text-slate-400' : 'text-white'}`}>
          {notification.message}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
      )}
    </div>
  );

  if (link) {
    return (
      <Link to={link} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
