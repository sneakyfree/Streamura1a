import { useState, useEffect } from 'react';
import { Bell, Check, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { NotificationItem } from '@/components/notifications';
import { notificationApi } from '@/lib/api';
import type { Notification } from '@/types';

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'follow', label: 'Follows' },
  { value: 'tip', label: 'Tips' },
  { value: 'stream_live', label: 'Streams' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'community', label: 'Community' },
];

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const perPage = 20;

  // Fetch notifications
  const fetchNotifications = async (pageNum: number = 1) => {
    try {
      setIsLoading(true);
      const data = await notificationApi.getAll();
      if (pageNum === 1) {
        setNotifications(data);
      } else {
        setNotifications((prev) => [...prev, ...data]);
      }
      setHasMore(data.length >= perPage);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Apply filter
  useEffect(() => {
    let filtered = notifications;

    if (filter === 'unread') {
      filtered = notifications.filter((n) => !n.read);
    } else if (filter !== 'all') {
      filtered = notifications.filter((n) => n.type === filter);
    }

    setFilteredNotifications(filtered);
  }, [notifications, filter]);

  // Mark single notification as read
  const handleMarkRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await Promise.all(
        notifications.filter((n) => !n.read).map((n) => notificationApi.markAsRead(n.id))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/20 rounded-lg">
              <Bell className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-slate-400">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
              <Check className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2">
              <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`
                    px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                    ${filter === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }
                  `}
                >
                  {option.label}
                  {option.value === 'unread' && unreadCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {filter === 'all' ? 'All Notifications' : filterOptions.find(f => f.value === filter)?.label}
              </h2>
              <span className="text-sm text-slate-400">
                {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-8 w-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 mt-4">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
                <p className="text-slate-400">
                  {filter === 'all'
                    ? "You're all caught up! Check back later for new activity."
                    : `No ${filterOptions.find(f => f.value === filter)?.label.toLowerCase()} notifications.`
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && filteredNotifications.length > 0 && (
              <div className="p-4 border-t border-slate-700">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
