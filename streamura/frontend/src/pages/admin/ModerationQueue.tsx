import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ChevronLeft,
  Loader2,
  Check,
  X,
  Clock,
  User,
  MessageSquare,
  AlertTriangle,
  Filter,
  Eye,
  Ban,
  Plus,
  Trash2,
} from 'lucide-react';
import { moderationApi, type ModerationQueueItem } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';

const SEVERITY_COLORS = {
  critical: 'text-red-500 bg-red-500/10',
  high: 'text-orange-500 bg-orange-500/10',
  medium: 'text-yellow-500 bg-yellow-500/10',
  low: 'text-slate-400 bg-slate-400/10',
};

const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-400',
  approved: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  auto_resolved: 'bg-blue-500/10 text-blue-400',
};

const CONTENT_TYPE_ICONS: Record<string, typeof MessageSquare> = {
  chat: MessageSquare,
  stream_title: Eye,
  username: User,
  bio: User,
};

export function ModerationQueue() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);
  const [actionModal, setActionModal] = useState<'review' | 'filter' | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('none');

  // Filter form state
  const [newFilter, setNewFilter] = useState({
    pattern: '',
    filter_type: 'keyword' as 'keyword' | 'regex' | 'ml_category',
    action: 'block' as 'block' | 'flag' | 'warn',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    category: '',
    description: '',
  });

  // Queries
  const { data: queueItems, isLoading: queueLoading } = useQuery({
    queryKey: ['admin', 'moderation-queue', statusFilter, contentTypeFilter],
    queryFn: () =>
      moderationApi.getQueue({
        status: statusFilter || undefined,
        content_type: contentTypeFilter || undefined,
        limit: 50,
      }),
    enabled: !!currentUser?.is_admin,
  });

  const { data: filters, isLoading: filtersLoading } = useQuery({
    queryKey: ['admin', 'content-filters'],
    queryFn: () => moderationApi.getFilters({ limit: 100 }),
    enabled: !!currentUser?.is_admin,
  });

  // Mutations
  const reviewMutation = useMutation({
    mutationFn: ({
      itemId,
      action,
      notes,
      actionTaken,
    }: {
      itemId: number;
      action: 'approve' | 'reject';
      notes?: string;
      actionTaken?: string;
    }) => moderationApi.reviewQueueItem(itemId, action, notes, actionTaken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation-queue'] });
      closeModal();
    },
  });

  const createFilterMutation = useMutation({
    mutationFn: moderationApi.createFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'content-filters'] });
      setNewFilter({
        pattern: '',
        filter_type: 'keyword',
        action: 'block',
        severity: 'medium',
        category: '',
        description: '',
      });
      setActionModal(null);
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: moderationApi.deleteFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'content-filters'] });
    },
  });

  const closeModal = () => {
    setActionModal(null);
    setSelectedItem(null);
    setReviewAction('approve');
    setReviewNotes('');
    setActionTaken('none');
  };

  const handleReview = () => {
    if (!selectedItem) return;
    reviewMutation.mutate({
      itemId: selectedItem.id,
      action: reviewAction,
      notes: reviewNotes || undefined,
      actionTaken: actionTaken !== 'none' ? actionTaken : undefined,
    });
  };

  const handleCreateFilter = () => {
    if (!newFilter.pattern.trim()) return;
    createFilterMutation.mutate({
      pattern: newFilter.pattern,
      filter_type: newFilter.filter_type,
      action: newFilter.action,
      severity: newFilter.severity,
      category: newFilter.category || undefined,
      description: newFilter.description || undefined,
    });
  };

  // Check if user is admin
  if (!currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const ContentTypeIcon = (type: string) => {
    const IconComponent = CONTENT_TYPE_ICONS[type] || MessageSquare;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="secondary" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Content Moderation</h1>
              <p className="text-slate-400">Review flagged content and manage filters</p>
            </div>
          </div>
          <Button onClick={() => setActionModal('filter')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Moderation Queue ({queueItems?.length || 0})
                  </h2>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex gap-1">
                    {['pending', 'approved', 'rejected', 'auto_resolved'].map((status) => (
                      <Button
                        key={status}
                        variant={statusFilter === status ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status.replace('_', ' ')}
                      </Button>
                    ))}
                    <Button
                      variant={!statusFilter ? 'default' : 'secondary'}
                      size="sm"
                      onClick={() => setStatusFilter('')}
                    >
                      All
                    </Button>
                  </div>
                  <select
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1 text-sm text-white"
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="chat">Chat</option>
                    <option value="stream_title">Stream Title</option>
                    <option value="username">Username</option>
                    <option value="bio">Bio</option>
                  </select>
                </div>

                {/* Queue Items */}
                {queueLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                  </div>
                ) : queueItems?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    No items in queue
                  </div>
                ) : (
                  <div className="space-y-3">
                    {queueItems?.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                SEVERITY_COLORS[
                                  item.confidence && item.confidence > 0.8
                                    ? 'high'
                                    : item.confidence && item.confidence > 0.5
                                      ? 'medium'
                                      : 'low'
                                ]
                              }`}
                            >
                              {ContentTypeIcon(item.content_type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white capitalize">
                                  {item.content_type.replace('_', ' ')}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[item.status]}`}
                                >
                                  {item.status}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                  {item.flagged_reason}
                                </span>
                              </div>
                              <p className="text-sm text-slate-300 bg-slate-700/50 p-2 rounded mb-2 font-mono">
                                "{item.content_text}"
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                {item.username && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {item.username}
                                  </span>
                                )}
                                {item.confidence && (
                                  <span>Confidence: {(item.confidence * 100).toFixed(0)}%</span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(item.created_at).toLocaleString()}
                                </span>
                              </div>
                              {item.flagged_patterns && item.flagged_patterns.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {item.flagged_patterns.map((pattern, i) => (
                                    <span
                                      key={i}
                                      className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 rounded"
                                    >
                                      {pattern}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {item.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setReviewAction('approve');
                                  setActionModal('review');
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setReviewAction('reject');
                                  setActionModal('review');
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filters Panel */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Content Filters ({filters?.length || 0})
                </h2>
              </CardHeader>
              <CardContent>
                {filtersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                  </div>
                ) : filters?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Ban className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    No filters configured
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filters?.map((filter) => (
                      <div
                        key={filter.id}
                        className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${SEVERITY_COLORS[filter.severity]}`}
                              >
                                {filter.severity}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                                {filter.filter_type}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  filter.action === 'block'
                                    ? 'bg-red-500/10 text-red-400'
                                    : filter.action === 'flag'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-blue-500/10 text-blue-400'
                                }`}
                              >
                                {filter.action}
                              </span>
                            </div>
                            <p className="text-sm text-white font-mono truncate">{filter.pattern}</p>
                            {filter.category && (
                              <p className="text-xs text-slate-400 mt-1">{filter.category}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => deleteFilterMutation.mutate(filter.id)}
                            disabled={deleteFilterMutation.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Review Modal */}
        <Dialog open={actionModal === 'review'} onOpenChange={() => closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewAction === 'approve' ? 'Approve Content' : 'Reject Content'}
              </DialogTitle>
              <DialogDescription>
                {reviewAction === 'approve'
                  ? 'This content will be marked as approved'
                  : 'This content will be rejected and action may be taken'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {selectedItem && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Content:</p>
                  <p className="text-white font-mono">"{selectedItem.content_text}"</p>
                </div>
              )}

              {reviewAction === 'reject' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Action to Take
                  </label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                  >
                    <option value="none">No additional action</option>
                    <option value="warned">Warn user</option>
                    <option value="muted">Mute user</option>
                    <option value="banned">Ban user</option>
                    <option value="content_removed">Remove content</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes (optional)
                </label>
                <Input
                  placeholder="Add review notes..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={reviewMutation.isPending}
                variant={reviewAction === 'approve' ? 'default' : 'secondary'}
              >
                {reviewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : reviewAction === 'approve' ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Filter Modal */}
        <Dialog open={actionModal === 'filter'} onOpenChange={() => setActionModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Content Filter</DialogTitle>
              <DialogDescription>Create a new filter rule to moderate content</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Pattern *
                </label>
                <Input
                  placeholder="Enter keyword or regex pattern..."
                  value={newFilter.pattern}
                  onChange={(e) => setNewFilter({ ...newFilter, pattern: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Filter Type
                  </label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    value={newFilter.filter_type}
                    onChange={(e) =>
                      setNewFilter({
                        ...newFilter,
                        filter_type: e.target.value as 'keyword' | 'regex' | 'ml_category',
                      })
                    }
                  >
                    <option value="keyword">Keyword</option>
                    <option value="regex">Regex</option>
                    <option value="ml_category">ML Category</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Action</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    value={newFilter.action}
                    onChange={(e) =>
                      setNewFilter({
                        ...newFilter,
                        action: e.target.value as 'block' | 'flag' | 'warn',
                      })
                    }
                  >
                    <option value="block">Block</option>
                    <option value="flag">Flag for Review</option>
                    <option value="warn">Warn User</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Severity</label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    value={newFilter.severity}
                    onChange={(e) =>
                      setNewFilter({
                        ...newFilter,
                        severity: e.target.value as 'low' | 'medium' | 'high' | 'critical',
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                  <Input
                    placeholder="e.g., profanity, spam"
                    value={newFilter.category}
                    onChange={(e) => setNewFilter({ ...newFilter, category: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (optional)
                </label>
                <Input
                  placeholder="Describe what this filter catches..."
                  value={newFilter.description}
                  onChange={(e) => setNewFilter({ ...newFilter, description: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setActionModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateFilter}
                disabled={createFilterMutation.isPending || !newFilter.pattern.trim()}
              >
                {createFilterMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Filter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
