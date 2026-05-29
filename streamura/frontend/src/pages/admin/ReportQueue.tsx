import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  Shield,
  Loader2,
  Flag,
  Check,
  X,
  Clock,
  User,
  Video,
  MessageSquare,
} from 'lucide-react';
import { adminApi, type Report } from '@/lib/api';
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

const PRIORITY_COLORS = {
  urgent: 'text-red-500 bg-red-500/10',
  high: 'text-orange-500 bg-orange-500/10',
  normal: 'text-yellow-500 bg-yellow-500/10',
  low: 'text-slate-400 bg-slate-400/10',
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  violence: 'Violence',
  nudity: 'Nudity/Sexual',
  copyright: 'Copyright',
  hate_speech: 'Hate Speech',
  misinformation: 'Misinformation',
  other: 'Other',
};

export function ReportQueue() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionModal, setActionModal] = useState<'resolve' | 'dismiss' | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>('none');
  const [notes, setNotes] = useState('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['admin', 'reports', statusFilter],
    queryFn: () => adminApi.getReports({
      status: statusFilter || undefined,
      limit: 50,
    }),
    enabled: !!currentUser?.is_admin,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ reportId, action, notes }: { reportId: number; action: string; notes?: string }) =>
      adminApi.resolveReport(reportId, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      closeModal();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ reportId, reason }: { reportId: number; reason?: string }) =>
      adminApi.dismissReport(reportId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      closeModal();
    },
  });

  const closeModal = () => {
    setActionModal(null);
    setSelectedReport(null);
    setSelectedAction('none');
    setNotes('');
  };

  const handleAction = () => {
    if (!selectedReport) return;

    if (actionModal === 'resolve') {
      resolveMutation.mutate({
        reportId: selectedReport.id,
        action: selectedAction,
        notes: notes || undefined,
      });
    } else if (actionModal === 'dismiss') {
      dismissMutation.mutate({
        reportId: selectedReport.id,
        reason: notes || undefined,
      });
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <Shield className="h-12 w-12 text-primary-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Sign in to continue</h1>
          <p className="text-slate-400">The report queue requires an authenticated admin.</p>
        </div>
      </div>
    );
  }
  if (!currentUser?.is_admin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const getTargetIcon = (report: Report) => {
    if (report.reported_user_id) return <User className="h-4 w-4" />;
    if (report.reported_stream_id) return <Video className="h-4 w-4" />;
    if (report.reported_message_id) return <MessageSquare className="h-4 w-4" />;
    return <Flag className="h-4 w-4" />;
  };

  const getTargetLabel = (report: Report) => {
    if (report.reported_user_id) return `User #${report.reported_user_id}`;
    if (report.reported_stream_id) return `Stream #${report.reported_stream_id}`;
    if (report.reported_message_id) return `Message #${report.reported_message_id}`;
    return 'Unknown';
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/admin">
            <Button variant="secondary" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Report Queue</h1>
            <p className="text-slate-400">Review and resolve content reports</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex gap-2">
              {['pending', 'reviewing', 'resolved', 'dismissed'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
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
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                <AlertTriangle className="h-5 w-5 inline-block mr-2" />
                Reports ({reports?.length || 0})
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : reports?.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No reports found
              </div>
            ) : (
              <div className="space-y-4">
                {reports?.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${PRIORITY_COLORS[report.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal}`}>
                          {getTargetIcon(report)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white">
                              {REASON_LABELS[report.reason] || report.reason}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              PRIORITY_COLORS[report.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.normal
                            }`}>
                              {report.priority}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              report.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                              report.status === 'resolved' ? 'bg-green-500/10 text-green-400' :
                              report.status === 'dismissed' ? 'bg-slate-500/10 text-slate-400' :
                              'bg-blue-500/10 text-blue-400'
                            }`}>
                              {report.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mb-2">
                            {getTargetLabel(report)} - Reported by User #{report.reporter_id}
                          </p>
                          {report.description && (
                            <p className="text-sm text-slate-300 bg-slate-700/50 p-2 rounded">
                              "{report.description}"
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(report.created_at).toLocaleString()}
                            </span>
                            {report.action_taken && (
                              <span>Action: {report.action_taken}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {report.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedReport(report);
                              setActionModal('resolve');
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedReport(report);
                              setActionModal('dismiss');
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Dismiss
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

        {/* Action Modal */}
        <Dialog open={!!actionModal} onOpenChange={() => closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionModal === 'resolve' ? 'Resolve Report' : 'Dismiss Report'}
              </DialogTitle>
              <DialogDescription>
                {actionModal === 'resolve'
                  ? 'Choose an action to take on this report'
                  : 'Dismiss this report without taking action'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {actionModal === 'resolve' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Action to Take
                  </label>
                  <select
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                  >
                    <option value="none">No action needed</option>
                    <option value="warning">Issue warning to user</option>
                    <option value="mute">Mute user</option>
                    <option value="ban">Ban user</option>
                    <option value="content_removed">Remove content</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes (optional)
                </label>
                <Input
                  placeholder="Add resolution notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={resolveMutation.isPending || dismissMutation.isPending}
              >
                {(resolveMutation.isPending || dismissMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {actionModal === 'resolve' ? 'Resolve' : 'Dismiss'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
