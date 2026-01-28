import { Link } from 'react-router-dom';
import { Radio, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { TrustIndicator } from '@/components/trust';
import type { Stream } from '@/types';

interface StreamCardProps {
    stream: Stream;
    isFollowing?: boolean;
    showTrustBadge?: boolean;
}

export function StreamCard({ stream, isFollowing, showTrustBadge = true }: StreamCardProps) {
    return (
        <Link to={`/streams/${stream.id}`}>
            <Card className="bg-slate-800/50 border-slate-700 hover:border-primary-500/50 transition-all overflow-hidden group">
                <div className="relative aspect-video bg-slate-900">
                    {stream.thumbnail_url ? (
                        <img
                            src={stream.thumbnail_url}
                            alt={stream.title || 'Stream thumbnail'}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Radio className="h-12 w-12 text-slate-700" />
                        </div>
                    )}
                    {stream.status === 'live' && (
                        <div className="absolute top-2 left-2 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded flex items-center gap-1">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                LIVE
                            </span>
                            {stream.viewer_count !== undefined && (
                                <span className="px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                                    {stream.viewer_count.toLocaleString()} viewers
                                </span>
                            )}
                        </div>
                    )}
                    {isFollowing && (
                        <div className="absolute top-2 right-2">
                            <span className="px-2 py-0.5 bg-primary-500/80 text-white text-xs font-medium rounded">
                                Following
                            </span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                                {stream.user?.avatar_url ? (
                                    <img
                                        src={stream.user.avatar_url}
                                        alt={stream.user.username || 'User avatar'}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Users className="h-5 w-5 text-slate-400" />
                                )}
                            </div>
                            {showTrustBadge && stream.user_id && (
                                <TrustIndicator userId={stream.user_id} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate group-hover:text-primary-400 transition-colors">
                                {stream.title || 'Untitled Stream'}
                            </h3>
                            <p className="text-sm text-slate-400 truncate">
                                {stream.user?.display_name || stream.user?.username || 'Anonymous'}
                            </p>
                            {stream.category && (
                                <p className="text-xs text-slate-500 mt-1">{stream.category}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
