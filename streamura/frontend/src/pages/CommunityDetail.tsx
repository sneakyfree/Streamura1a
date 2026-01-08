import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Settings,
  ArrowLeft,
  Globe,
  Lock,
  MoreVertical,
  UserPlus,
  UserMinus,
  Shield,
  Trash2,
  Loader2,
  Crown,
  MessageSquare,
} from 'lucide-react';
import { communityApi, type CommunityMember } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

type Tab = 'about' | 'members';

export function CommunityDetailPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('about');
  const [isJoining, setIsJoining] = useState(false);

  const id = parseInt(communityId || '0', 10);

  // Fetch community details
  const { data: community, isLoading: loadingCommunity } = useQuery({
    queryKey: ['community', id],
    queryFn: () => communityApi.get(id),
    enabled: id > 0,
  });

  // Fetch members
  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['community', id, 'members'],
    queryFn: () => communityApi.getMembers(id, { limit: 100 }),
    enabled: id > 0,
  });

  // Join mutation
  const joinMutation = useMutation({
    mutationFn: () => communityApi.join(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  // Leave mutation
  const leaveMutation = useMutation({
    mutationFn: () => communityApi.leave(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', id] });
      queryClient.invalidateQueries({ queryKey: ['community', id, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const handleJoinLeave = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsJoining(true);
    try {
      if (community?.is_member) {
        await leaveMutation.mutateAsync();
      } else {
        await joinMutation.mutateAsync();
      }
    } finally {
      setIsJoining(false);
    }
  };

  // Extract members array from response
  const membersList = members?.members ?? [];

  const isOwner = user?.id === community?.owner_id;
  const currentMember = membersList.find(m => m.user_id === user?.id);
  const isModerator = currentMember?.role === 'moderator' || currentMember?.role === 'owner';

  if (loadingCommunity) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-white mb-4">Community not found</h2>
        <Button onClick={() => navigate('/communities')}>
          Back to Communities
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Banner */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-primary-600 to-primary-800">
        {community.banner_url && (
          <img
            src={community.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />

        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/communities')}
          className="absolute top-4 left-4 bg-black/30 hover:bg-black/50"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Settings (for owner) */}
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 bg-black/30 hover:bg-black/50"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Community Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
          {/* Avatar */}
          <Avatar className="h-32 w-32 border-4 border-slate-900 shadow-xl">
            <AvatarImage src={community.image_url ?? undefined} alt={community.name} />
            <AvatarFallback className="text-3xl">
              {community.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {community.name}
              </h1>
              {community.is_public ? (
                <Globe className="h-5 w-5 text-slate-400" />
              ) : (
                <Lock className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {community.member_count.toLocaleString()} members
              </span>
              <span>
                Created {new Date(community.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {isOwner ? (
              <span className="inline-flex items-center gap-1 px-4 py-2 bg-primary-500/20 text-primary-400 rounded-lg font-medium">
                <Crown className="h-4 w-4" />
                Owner
              </span>
            ) : (
              <Button
                variant={community.is_member ? 'outline' : 'default'}
                onClick={handleJoinLeave}
                disabled={isJoining}
                className={cn(
                  community.is_member && 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive'
                )}
              >
                {isJoining ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : community.is_member ? (
                  <>
                    <UserMinus className="h-4 w-4 mr-2" />
                    Leave
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Join
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Tags */}
        {community.tags && community.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {community.tags.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('about')}
            className={cn(
              'pb-4 px-2 text-sm font-medium transition-colors border-b-2',
              activeTab === 'about'
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              'pb-4 px-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-2',
              activeTab === 'members'
                ? 'text-primary-400 border-primary-400'
                : 'text-slate-400 border-transparent hover:text-white'
            )}
          >
            Members
            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-xs">
              {community.member_count}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'about' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Description */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">About</h2>
                <p className="text-slate-300 whitespace-pre-wrap">
                  {community.description || 'No description provided.'}
                </p>
              </div>

              {/* Rules */}
              {community.rules && community.rules.length > 0 && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mt-6">
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Community Rules
                  </h2>
                  <ol className="space-y-3">
                    {community.rules.map((rule, index) => (
                      <li key={index} className="flex gap-3 text-slate-300">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary-500/20 text-primary-400 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        {rule}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div>
              {/* Quick Actions */}
              {community.is_member && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <Button variant="ghost" className="w-full justify-start">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Community Chat
                    </Button>
                  </div>
                </div>
              )}

              {/* Moderators */}
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Moderators
                </h3>
                <div className="space-y-3">
                  {membersList
                    .filter(m => m.role === 'owner' || m.role === 'moderator')
                    .map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {(member.display_name || member.username || '?').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {member.display_name || member.username}
                          </div>
                          <div className="text-xs text-slate-500 capitalize">
                            {member.role}
                          </div>
                        </div>
                        {member.role === 'owner' && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                        {member.role === 'moderator' && (
                          <Shield className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Members Tab */
          <div className="bg-slate-800 rounded-xl border border-slate-700">
            {loadingMembers ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              </div>
            ) : membersList.length > 0 ? (
              <div className="divide-y divide-slate-700">
                {membersList.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isOwner={isOwner}
                    isModerator={isModerator}
                    currentUserId={user?.id}
                    communityId={id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                No members yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface MemberRowProps {
  member: CommunityMember;
  isOwner: boolean;
  isModerator: boolean;
  currentUserId?: number;
  communityId: number;
}

function MemberRow({ member, isOwner, isModerator, currentUserId, communityId }: MemberRowProps) {
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);

  const canManage = (isOwner || isModerator) && member.user_id !== currentUserId && member.role !== 'owner';

  const setRoleMutation = useMutation({
    mutationFn: (role: 'member' | 'moderator') =>
      communityApi.setMemberRole(communityId, member.user_id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId, 'members'] });
      setShowMenu(false);
    },
  });

  const kickMutation = useMutation({
    mutationFn: () => communityApi.kickMember(communityId, member.user_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', communityId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['community', communityId] });
    },
  });

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url ?? undefined} />
          <AvatarFallback>
            {(member.display_name || member.username || '?').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">
              {member.display_name || member.username}
            </span>
            {member.role === 'owner' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                <Crown className="h-3 w-3" />
                Owner
              </span>
            )}
            {member.role === 'moderator' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                <Shield className="h-3 w-3" />
                Mod
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            Joined {new Date(member.joined_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {canManage && (
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
                {isOwner && member.role !== 'moderator' && (
                  <button
                    onClick={() => setRoleMutation.mutate('moderator')}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Make Moderator
                  </button>
                )}
                {isOwner && member.role === 'moderator' && (
                  <button
                    onClick={() => setRoleMutation.mutate('member')}
                    className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Remove Moderator
                  </button>
                )}
                <button
                  onClick={() => kickMutation.mutate()}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Kick Member
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
