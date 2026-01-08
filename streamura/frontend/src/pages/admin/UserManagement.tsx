import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Shield,
  Ban,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  Check,
} from 'lucide-react';
import { adminApi, type AdminUser } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showBannedOnly, setShowBannedOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionModal, setActionModal] = useState<'ban' | 'warn' | 'unban' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [banDuration, setBanDuration] = useState<number | undefined>(undefined);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, showBannedOnly],
    queryFn: () => adminApi.getUsers({
      search: search || undefined,
      is_banned: showBannedOnly ? true : undefined,
      limit: 50,
    }),
    enabled: !!currentUser?.is_admin,
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, reason, duration }: { userId: number; reason?: string; duration?: number }) =>
      adminApi.banUser(userId, { action_type: 'ban', reason, duration }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      closeModal();
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => adminApi.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      closeModal();
    },
  });

  const warnMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) =>
      adminApi.warnUser(userId, { action_type: 'warning', reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      closeModal();
    },
  });

  const closeModal = () => {
    setActionModal(null);
    setSelectedUser(null);
    setActionReason('');
    setBanDuration(undefined);
  };

  const handleAction = () => {
    if (!selectedUser) return;

    if (actionModal === 'ban') {
      banMutation.mutate({
        userId: selectedUser.id,
        reason: actionReason || undefined,
        duration: banDuration,
      });
    } else if (actionModal === 'unban') {
      unbanMutation.mutate(selectedUser.id);
    } else if (actionModal === 'warn') {
      warnMutation.mutate({
        userId: selectedUser.id,
        reason: actionReason || undefined,
      });
    }
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
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-slate-400">View and manage platform users</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users by username or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant={showBannedOnly ? 'default' : 'secondary'}
                onClick={() => setShowBannedOnly(!showBannedOnly)}
              >
                <Ban className="h-4 w-4 mr-2" />
                {showBannedOnly ? 'Showing Banned' : 'Show Banned Only'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                <Users className="h-5 w-5 inline-block mr-2" />
                Users ({users?.length || 0})
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              </div>
            ) : users?.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">User</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Trust</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Warnings</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">Joined</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((user) => (
                      <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-white font-medium flex items-center gap-2">
                              {user.username || 'Anonymous'}
                              {user.is_admin && (
                                <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
                                  Admin
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-slate-400">{user.email || 'No email'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {user.is_banned ? (
                            <span className="flex items-center gap-1 text-red-400 text-sm">
                              <Ban className="h-4 w-4" />
                              Banned
                            </span>
                          ) : user.is_verified ? (
                            <span className="flex items-center gap-1 text-green-400 text-sm">
                              <Check className="h-4 w-4" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">Active</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-16 bg-slate-700 rounded-full overflow-hidden`}
                            >
                              <div
                                className={`h-full ${
                                  user.trust_score >= 0.7 ? 'bg-green-500' :
                                  user.trust_score >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${user.trust_score * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-slate-400">
                              {(user.trust_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={user.warning_count > 0 ? 'text-yellow-400' : 'text-slate-400'}>
                            {user.warning_count}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!user.is_admin && (
                            <div className="flex items-center justify-end gap-2">
                              {user.is_banned ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setActionModal('unban');
                                  }}
                                >
                                  Unban
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setActionModal('warn');
                                    }}
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="text-red-400 hover:text-red-300"
                                    onClick={() => {
                                      setSelectedUser(user);
                                      setActionModal('ban');
                                    }}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Modal */}
        <Dialog open={!!actionModal} onOpenChange={() => closeModal()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionModal === 'ban' && 'Ban User'}
                {actionModal === 'unban' && 'Unban User'}
                {actionModal === 'warn' && 'Issue Warning'}
              </DialogTitle>
              <DialogDescription>
                {actionModal === 'ban' && `Are you sure you want to ban ${selectedUser?.username}?`}
                {actionModal === 'unban' && `Are you sure you want to unban ${selectedUser?.username}?`}
                {actionModal === 'warn' && `Issue a warning to ${selectedUser?.username}`}
              </DialogDescription>
            </DialogHeader>

            {actionModal !== 'unban' && (
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Reason (optional)
                  </label>
                  <Input
                    placeholder="Enter reason..."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>

                {actionModal === 'ban' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Ban Duration
                    </label>
                    <select
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                      value={banDuration || ''}
                      onChange={(e) => setBanDuration(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">Permanent</option>
                      <option value="3600">1 Hour</option>
                      <option value="86400">1 Day</option>
                      <option value="604800">1 Week</option>
                      <option value="2592000">30 Days</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={banMutation.isPending || unbanMutation.isPending || warnMutation.isPending}
                className={actionModal === 'ban' ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                {(banMutation.isPending || unbanMutation.isPending || warnMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {actionModal === 'ban' && 'Ban User'}
                {actionModal === 'unban' && 'Unban User'}
                {actionModal === 'warn' && 'Issue Warning'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
