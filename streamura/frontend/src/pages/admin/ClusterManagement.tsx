import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    MapPin,
    Users,
    Merge,
    Split,
    Trash2,
    Edit3,
    Save,
    X,
    RefreshCw,
    Search,
    Filter,
    ChevronDown,
    ChevronUp,
    Radio,
    TrendingUp,
    Eye,
    MoreVertical,
    Wand2,
    Check,
    AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Types
interface ClusterStream {
    stream_id: number;
    title: string;
    streamer_name: string;
    viewer_count: number;
    latitude: number;
    longitude: number;
    is_live: boolean;
}

interface EventCluster {
    cluster_id: string;
    event_id?: number;
    title: string;
    centroid: [number, number];
    radius_meters: number;
    stream_count: number;
    total_viewers: number;
    velocity: number;
    velocity_trend: 'rising' | 'stable' | 'falling';
    is_trending: boolean;
    is_featured: boolean;
    category?: string;
    auto_generated: boolean;
    locked: boolean; // Prevents auto-updates
    streams: ClusterStream[];
    created_at: string;
    updated_at: string;
}

interface ClusterManagementProps {
    maxClusters?: number;
}

// Fetch clusters with admin data
const fetchClusters = async () => {
    const res = await fetch('/api/v1/admin/clusters', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch clusters');
    return res.json();
};

// Color by velocity trend
const velocityColors = {
    rising: 'text-green-400',
    stable: 'text-slate-400',
    falling: 'text-red-400'
};

// Cluster card component
function ClusterCard({
    cluster,
    isSelected,
    onSelect,
    onEdit,
    onMerge,
    onSplit,
    onDelete,
    onToggleLock,
    onFeature
}: {
    cluster: EventCluster;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onMerge: () => void;
    onSplit: () => void;
    onDelete: () => void;
    onToggleLock: () => void;
    onFeature: () => void;
}) {
    const [showActions, setShowActions] = useState(false);
    const [showStreams, setShowStreams] = useState(false);

    return (
        <Card className={`bg-slate-800/50 border transition-all ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-700 hover:border-slate-600'
            }`}>
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1" onClick={onSelect}>
                        <div className={`p-2 rounded-lg ${cluster.is_trending ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
                            <MapPin className={`h-5 w-5 ${cluster.is_trending ? 'text-purple-400' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-white font-medium truncate">{cluster.title}</h3>
                                {cluster.auto_generated && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">AI</span>
                                )}
                                {cluster.locked && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Locked</span>
                                )}
                                {cluster.is_featured && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Featured</span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Radio className="h-3 w-3" />
                                    {cluster.stream_count} streams
                                </span>
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {cluster.total_viewers.toLocaleString()}
                                </span>
                                <span className={`flex items-center gap-1 ${velocityColors[cluster.velocity_trend]}`}>
                                    <TrendingUp className="h-3 w-3" />
                                    {cluster.velocity > 0 ? '+' : ''}{cluster.velocity.toFixed(1)}/min
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowActions(!showActions)}
                            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                        >
                            <MoreVertical className="h-4 w-4 text-slate-400" />
                        </button>

                        {showActions && (
                            <div className="absolute right-0 top-10 z-10 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1">
                                <button onClick={onEdit} className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                                    <Edit3 className="h-4 w-4" /> Rename Cluster
                                </button>
                                <button onClick={onMerge} className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                                    <Merge className="h-4 w-4" /> Merge With...
                                </button>
                                <button onClick={onSplit} className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                                    <Split className="h-4 w-4" /> Split Cluster
                                </button>
                                <button onClick={onToggleLock} className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                                    {cluster.locked ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {cluster.locked ? 'Unlock' : 'Lock'} Cluster
                                </button>
                                <button onClick={onFeature} className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2">
                                    <Eye className="h-4 w-4" /> {cluster.is_featured ? 'Unfeature' : 'Feature'}
                                </button>
                                <hr className="my-1 border-slate-700" />
                                <button onClick={onDelete} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" /> Delete Cluster
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Streams list toggle */}
                {cluster.streams.length > 0 && (
                    <button
                        onClick={() => setShowStreams(!showStreams)}
                        className="mt-3 w-full flex items-center justify-between px-3 py-2 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                        <span className="text-xs text-slate-400">
                            {showStreams ? 'Hide' : 'Show'} {cluster.streams.length} streams
                        </span>
                        {showStreams ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                )}

                {showStreams && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {cluster.streams.map((stream) => (
                            <div
                                key={stream.stream_id}
                                className="flex items-center justify-between px-3 py-2 bg-slate-700/20 rounded-lg"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${stream.is_live ? 'bg-green-400' : 'bg-slate-500'}`} />
                                    <span className="text-sm text-white truncate max-w-[150px]">{stream.title}</span>
                                    <span className="text-xs text-slate-500">by {stream.streamer_name}</span>
                                </div>
                                <span className="text-xs text-slate-400">{stream.viewer_count.toLocaleString()} viewers</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}

// Merge modal component
function MergeModal({
    sourceCluster,
    clusters,
    onMerge,
    onClose
}: {
    sourceCluster: EventCluster;
    clusters: EventCluster[];
    onMerge: (targetId: string, newName: string) => void;
    onClose: () => void;
}) {
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [newName, setNewName] = useState(sourceCluster.title);

    const eligibleClusters = clusters.filter(c => c.cluster_id !== sourceCluster.cluster_id);

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-slate-800 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-700">
                    <div className="flex items-center gap-2">
                        <Merge className="h-5 w-5 text-purple-400" />
                        <h2 className="text-lg font-semibold text-white">Merge Clusters</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700">
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Source Cluster</label>
                        <div className="p-3 bg-slate-700/50 rounded-lg">
                            <span className="text-white">{sourceCluster.title}</span>
                            <span className="text-xs text-slate-400 ml-2">({sourceCluster.stream_count} streams)</span>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">Merge Into</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {eligibleClusters.map(cluster => (
                                <button
                                    key={cluster.cluster_id}
                                    onClick={() => setSelectedTarget(cluster.cluster_id)}
                                    className={`w-full p-3 rounded-lg border transition-colors text-left ${selectedTarget === cluster.cluster_id
                                            ? 'border-purple-500 bg-purple-500/10'
                                            : 'border-slate-700 bg-slate-700/30 hover:border-slate-600'
                                        }`}
                                >
                                    <span className="text-white">{cluster.title}</span>
                                    <span className="text-xs text-slate-400 ml-2">({cluster.stream_count} streams)</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-slate-400 mb-1 block">New Cluster Name</label>
                        <Input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Combined cluster name"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => selectedTarget && onMerge(selectedTarget, newName)}
                            disabled={!selectedTarget || !newName.trim()}
                            className="flex-1"
                        >
                            <Merge className="h-4 w-4 mr-2" />
                            Merge Clusters
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function ClusterManagement({ maxClusters = 100 }: ClusterManagementProps) {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'viewers' | 'velocity' | 'streams'>('viewers');
    const [mergeSource, setMergeSource] = useState<EventCluster | null>(null);
    const [editingCluster, setEditingCluster] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['adminClusters'],
        queryFn: fetchClusters,
        refetchInterval: 30000,
    });

    // Mock data for demo
    const mockClusters: EventCluster[] = [
        {
            cluster_id: '1', event_id: 101, title: 'Downtown Music Festival', centroid: [40.7128, -74.006], radius_meters: 500, stream_count: 12, total_viewers: 45200, velocity: 125.5, velocity_trend: 'rising', is_trending: true, is_featured: true, category: 'music', auto_generated: false, locked: true, streams: [
                { stream_id: 1, title: 'Main Stage Live', streamer_name: 'MusicFanatic', viewer_count: 12500, latitude: 40.7128, longitude: -74.006, is_live: true },
                { stream_id: 2, title: 'Crowd View', streamer_name: 'EventCam', viewer_count: 8300, latitude: 40.7129, longitude: -74.0055, is_live: true }
            ], created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-15T12:30:00Z'
        },
        {
            cluster_id: '2', event_id: 102, title: 'City Marathon 2024', centroid: [40.758, -73.9855], radius_meters: 2000, stream_count: 8, total_viewers: 23400, velocity: 45.2, velocity_trend: 'stable', is_trending: true, is_featured: false, category: 'sports', auto_generated: true, locked: false, streams: [
                { stream_id: 3, title: 'Start Line Coverage', streamer_name: 'SportsCast', viewer_count: 9800, latitude: 40.758, longitude: -73.9855, is_live: true }
            ], created_at: '2024-01-15T06:00:00Z', updated_at: '2024-01-15T11:45:00Z'
        },
        { cluster_id: '3', title: 'Street Art Exhibition', centroid: [40.7829, -73.9654], radius_meters: 300, stream_count: 4, total_viewers: 5600, velocity: -12.3, velocity_trend: 'falling', is_trending: false, is_featured: false, category: 'art', auto_generated: true, locked: false, streams: [], created_at: '2024-01-14T14:00:00Z', updated_at: '2024-01-15T10:00:00Z' },
        { cluster_id: '4', title: 'Tech Conference Day 2', centroid: [40.7484, -73.9857], radius_meters: 150, stream_count: 15, total_viewers: 67800, velocity: 234.1, velocity_trend: 'rising', is_trending: true, is_featured: true, category: 'technology', auto_generated: false, locked: true, streams: [], created_at: '2024-01-14T08:00:00Z', updated_at: '2024-01-15T13:00:00Z' }
    ];

    const clusters = data?.clusters || mockClusters;

    // Mutations
    const renameMutation = useMutation({
        mutationFn: async ({ clusterId, name }: { clusterId: string; name: string }) => {
            const res = await fetch(`/api/v1/admin/clusters/${clusterId}/rename`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error('Failed to rename');
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminClusters'] })
    });

    const mergeMutation = useMutation({
        mutationFn: async ({ sourceId, targetId, name }: { sourceId: string; targetId: string; name: string }) => {
            const res = await fetch(`/api/v1/admin/clusters/merge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ source_cluster_id: sourceId, target_cluster_id: targetId, new_name: name })
            });
            if (!res.ok) throw new Error('Failed to merge');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminClusters'] });
            setMergeSource(null);
        }
    });

    // Filtered and sorted clusters
    const filteredClusters = useMemo(() => {
        let result = clusters;

        if (searchQuery) {
            result = result.filter((c: EventCluster) =>
                c.title.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (filterCategory) {
            result = result.filter((c: EventCluster) => c.category === filterCategory);
        }

        result = [...result].sort((a: EventCluster, b: EventCluster) => {
            if (sortBy === 'viewers') return b.total_viewers - a.total_viewers;
            if (sortBy === 'velocity') return b.velocity - a.velocity;
            return b.stream_count - a.stream_count;
        });

        return result.slice(0, maxClusters);
    }, [clusters, searchQuery, filterCategory, sortBy, maxClusters]);

    // Get unique categories
    const categories = useMemo(() => {
        const cats = new Set(clusters.map((c: EventCluster) => c.category).filter(Boolean));
        return Array.from(cats) as string[];
    }, [clusters]);

    const handleSelectCluster = (id: string) => {
        const newSelected = new Set(selectedClusters);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedClusters(newSelected);
    };

    const handleStartEdit = (cluster: EventCluster) => {
        setEditingCluster(cluster.cluster_id);
        setEditName(cluster.title);
    };

    const handleSaveEdit = () => {
        if (editingCluster && editName.trim()) {
            renameMutation.mutate({ clusterId: editingCluster, name: editName });
            setEditingCluster(null);
        }
    };

    const handleMerge = (targetId: string, newName: string) => {
        if (mergeSource) {
            mergeMutation.mutate({
                sourceId: mergeSource.cluster_id,
                targetId,
                name: newName
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <h1 className="sr-only">Cluster Management</h1>
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading clusters...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <MapPin className="h-6 w-6 text-purple-400" />
                        Cluster Management
                    </h1>
                    <p className="text-slate-400">Manage event clusters, merge/split, and override AI groupings</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => refetch()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Suggest Names
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search clusters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <select
                            value={filterCategory || ''}
                            onChange={(e) => setFilterCategory(e.target.value || null)}
                            className="bg-slate-700 border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                        <span className="text-sm text-slate-400">Sort by:</span>
                        {(['viewers', 'velocity', 'streams'] as const).map(sort => (
                            <button
                                key={sort}
                                onClick={() => setSortBy(sort)}
                                className={`px-3 py-1 rounded-lg text-sm ${sortBy === sort
                                        ? 'bg-purple-500/20 text-purple-400'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {sort.charAt(0).toUpperCase() + sort.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Stats bar */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Clusters', value: clusters.length, icon: MapPin, color: 'purple' },
                    { label: 'Total Viewers', value: clusters.reduce((s: number, c: EventCluster) => s + c.total_viewers, 0).toLocaleString(), icon: Users, color: 'blue' },
                    { label: 'Trending', value: clusters.filter((c: EventCluster) => c.is_trending).length, icon: TrendingUp, color: 'green' },
                    { label: 'AI Generated', value: clusters.filter((c: EventCluster) => c.auto_generated).length, icon: Wand2, color: 'cyan' }
                ].map(stat => (
                    <Card key={stat.label} className="bg-slate-800/50 border-slate-700 p-4">
                        <div className="flex items-center gap-3">
                            <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
                            <div>
                                <div className="text-xl font-bold text-white">{stat.value}</div>
                                <div className="text-xs text-slate-400">{stat.label}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Selected actions */}
            {selectedClusters.size > 1 && (
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-purple-400" />
                    <span className="text-sm text-purple-300">{selectedClusters.size} clusters selected</span>
                    <Button size="sm" onClick={() => { }}>
                        <Merge className="h-4 w-4 mr-1" />
                        Merge Selected
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedClusters(new Set())}>
                        Clear Selection
                    </Button>
                </div>
            )}

            {/* Cluster list */}
            <div className="grid md:grid-cols-2 gap-4">
                {filteredClusters.map((cluster: EventCluster) => (
                    <ClusterCard
                        key={cluster.cluster_id}
                        cluster={cluster}
                        isSelected={selectedClusters.has(cluster.cluster_id)}
                        onSelect={() => handleSelectCluster(cluster.cluster_id)}
                        onEdit={() => handleStartEdit(cluster)}
                        onMerge={() => setMergeSource(cluster)}
                        onSplit={() => { }}
                        onDelete={() => { }}
                        onToggleLock={() => { }}
                        onFeature={() => { }}
                    />
                ))}
            </div>

            {filteredClusters.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No clusters found matching your criteria</p>
                </div>
            )}

            {/* Merge modal */}
            {mergeSource && (
                <MergeModal
                    sourceCluster={mergeSource}
                    clusters={clusters}
                    onMerge={handleMerge}
                    onClose={() => setMergeSource(null)}
                />
            )}

            {/* Edit name modal */}
            {editingCluster && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md bg-slate-800 border-slate-700">
                        <CardHeader className="border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <Edit3 className="h-5 w-5 text-purple-400" />
                                <h2 className="text-lg font-semibold text-white">Rename Cluster</h2>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Cluster name"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setEditingCluster(null)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveEdit} disabled={!editName.trim()} className="flex-1">
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default ClusterManagement;
