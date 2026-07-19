import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Filter,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    AlertTriangle,
    Eye,
    Play,
    Pause
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface ContentFilter {
    id: string;
    name: string;
    type: 'word' | 'regex' | 'phrase' | 'pattern';
    pattern: string;
    action: 'block' | 'flag' | 'replace' | 'shadow';
    replacement?: string;
    priority: number;
    enabled: boolean;
    hits: number;
    lastHit?: string;
    createdAt: string;
}

interface FilterFormData {
    name: string;
    type: ContentFilter['type'];
    pattern: string;
    action: ContentFilter['action'];
    replacement: string;
    priority: number;
}

// Mock data
const mockFilters: ContentFilter[] = [
    {
        id: 'f1',
        name: 'Spam Links',
        type: 'regex',
        pattern: 'https?:\\/\\/[^\\s]*(bit\\.ly|goo\\.gl|tinyurl)',
        action: 'block',
        priority: 1,
        enabled: true,
        hits: 1523,
        lastHit: new Date(Date.now() - 30 * 60000).toISOString(),
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
    },
    {
        id: 'f2',
        name: 'Competitor Mentions',
        type: 'word',
        pattern: 'twitch,youtube,kick',
        action: 'flag',
        priority: 3,
        enabled: true,
        hits: 892,
        lastHit: new Date(Date.now() - 2 * 3600000).toISOString(),
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
    },
    {
        id: 'f3',
        name: 'Crypto Scam',
        type: 'phrase',
        pattern: 'send me crypto,double your money,free bitcoin',
        action: 'block',
        priority: 1,
        enabled: true,
        hits: 456,
        lastHit: new Date(Date.now() - 5 * 3600000).toISOString(),
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString()
    }
];

const actionConfig = {
    block: { color: 'bg-red-500/20 text-red-400', label: 'Block', icon: X },
    flag: { color: 'bg-yellow-500/20 text-yellow-400', label: 'Flag', icon: AlertTriangle },
    replace: { color: 'bg-blue-500/20 text-blue-400', label: 'Replace', icon: Edit2 },
    shadow: { color: 'bg-purple-500/20 text-purple-400', label: 'Shadow', icon: Eye }
};

const typeConfig = {
    word: 'Single words (comma-separated)',
    regex: 'Regular expression pattern',
    phrase: 'Exact phrases (comma-separated)',
    pattern: 'Wildcard pattern (*)'
};

export function ContentFilterManager() {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState<{ matched: boolean; filter?: string } | null>(null);
    const [formData, setFormData] = useState<FilterFormData>({
        name: '',
        type: 'word',
        pattern: '',
        action: 'block',
        replacement: '',
        priority: 5
    });

    const queryClient = useQueryClient();

    const { data: filters = mockFilters } = useQuery({
        queryKey: ['contentFilters'],
        queryFn: async () => mockFilters
    });

    const createFilter = useMutation({
        mutationFn: async (data: FilterFormData) => {
            // Would call API
            return { id: `f${Date.now()}`, ...data, enabled: true, hits: 0, createdAt: new Date().toISOString() };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contentFilters'] });
            setShowForm(false);
            resetForm();
        }
    });

    const toggleFilter = useMutation({
        mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
            // Would call API
            return { id, enabled };
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contentFilters'] })
    });

    const deleteFilter = useMutation({
        mutationFn: async (id: string) => {
            // Would call API
            return id;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contentFilters'] })
    });

    const resetForm = () => {
        setFormData({ name: '', type: 'word', pattern: '', action: 'block', replacement: '', priority: 5 });
        setEditingId(null);
    };

    const testPattern = () => {
        // Simple test logic
        const matched = filters.some(f => {
            if (!f.enabled) return false;
            if (f.type === 'word') {
                return f.pattern.split(',').some(word => testInput.toLowerCase().includes(word.trim().toLowerCase()));
            }
            if (f.type === 'regex') {
                try {
                    return new RegExp(f.pattern, 'i').test(testInput);
                } catch {
                    return false;
                }
            }
            return false;
        });

        setTestResult({ matched, filter: matched ? 'Matched filter' : undefined });
    };

    const sortedFilters = [...filters].sort((a, b) => a.priority - b.priority);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Filter className="h-6 w-6 text-purple-400" />
                        Content Filter Manager
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Create and manage custom content filters
                    </p>
                </div>
                <Button variant="primary" onClick={() => setShowForm(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Filter
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-white">{filters.length}</div>
                    <div className="text-xs text-slate-500">Active Filters</div>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-green-400">
                        {filters.reduce((sum, f) => sum + f.hits, 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">Total Hits</div>
                </Card>
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <div className="text-2xl font-bold text-white">
                        {filters.filter(f => f.enabled).length}
                    </div>
                    <div className="text-xs text-slate-500">Enabled</div>
                </Card>
            </div>

            {/* Test panel */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Test Filters
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="Enter test message..."
                        className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                    />
                    <Button variant="secondary" onClick={testPattern}>
                        Test
                    </Button>
                </div>
                {testResult && (
                    <div className={`mt-2 p-2 rounded text-sm ${testResult.matched
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                        {testResult.matched ? '⚠️ Would be filtered' : '✓ Passes all filters'}
                    </div>
                )}
            </Card>

            {/* Filter list */}
            <div className="space-y-2">
                {sortedFilters.map(filter => {
                    const action = actionConfig[filter.action];

                    return (
                        <Card
                            key={filter.id}
                            className={`bg-slate-800/50 border-slate-700 p-4 ${!filter.enabled ? 'opacity-50' : ''}`}
                        >
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => toggleFilter.mutate({ id: filter.id, enabled: !filter.enabled })}
                                    className={`p-2 rounded-lg ${filter.enabled ? 'bg-green-500/20' : 'bg-slate-700'}`}
                                >
                                    {filter.enabled ? (
                                        <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <Pause className="w-4 h-4 text-slate-400" />
                                    )}
                                </button>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium">{filter.name}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${action.color}`}>
                                            {action.label}
                                        </span>
                                        <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                                            P{filter.priority}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-400 font-mono truncate mt-1">
                                        {filter.pattern}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-white font-medium">{filter.hits.toLocaleString()}</div>
                                    <div className="text-xs text-slate-500">hits</div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                        onClick={() => {
                                            setFormData({
                                                name: filter.name,
                                                type: filter.type,
                                                pattern: filter.pattern,
                                                action: filter.action,
                                                replacement: filter.replacement || '',
                                                priority: filter.priority
                                            });
                                            setEditingId(filter.id);
                                            setShowForm(true);
                                        }}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        className="p-2 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"
                                        onClick={() => deleteFilter.mutate(filter.id)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            {/* Add/Edit form modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-lg w-full">
                        <h3 className="text-white font-semibold mb-4">
                            {editingId ? 'Edit Filter' : 'Create New Filter'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                    placeholder="Filter name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as FilterFormData['type'] })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                >
                                    <option value="word">Word List</option>
                                    <option value="regex">Regex</option>
                                    <option value="phrase">Phrase List</option>
                                    <option value="pattern">Wildcard Pattern</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">{typeConfig[formData.type]}</p>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Pattern</label>
                                <textarea
                                    value={formData.pattern}
                                    onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white font-mono text-sm"
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Action</label>
                                    <select
                                        value={formData.action}
                                        onChange={(e) => setFormData({ ...formData, action: e.target.value as FilterFormData['action'] })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                    >
                                        <option value="block">Block</option>
                                        <option value="flag">Flag for Review</option>
                                        <option value="replace">Replace</option>
                                        <option value="shadow">Shadow Hide</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Priority (1=highest)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                            </div>

                            {formData.action === 'replace' && (
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Replacement Text</label>
                                    <input
                                        type="text"
                                        value={formData.replacement}
                                        onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                        placeholder="***"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <Button variant="secondary" className="flex-1" onClick={() => { setShowForm(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1"
                                onClick={() => createFilter.mutate(formData)}
                                disabled={!formData.name || !formData.pattern}
                            >
                                {editingId ? 'Save Changes' : 'Create Filter'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default ContentFilterManager;
