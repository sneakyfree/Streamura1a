import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    FileText,
    AlertTriangle,
    Send,
    Clock,
    CheckCircle,
    XCircle,
    Link,
    User,
    MessageSquare,
    ChevronRight,
    Plus
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface DMCARequest {
    id: string;
    type: 'takedown' | 'counter';
    status: 'pending' | 'in_review' | 'actioned' | 'rejected' | 'counter_filed';
    claimant: {
        name: string;
        email: string;
        company?: string;
    };
    content: {
        type: 'stream' | 'vod' | 'clip';
        id: string;
        url: string;
        title: string;
    };
    copyrightWork: string;
    description: string;
    signedAt: string;
    createdAt: string;
    resolvedAt?: string;
    counterNotice?: {
        filerName: string;
        explanation: string;
        filedAt: string;
    };
}

interface DMCAFormData {
    claimantName: string;
    claimantEmail: string;
    claimantCompany: string;
    contentUrl: string;
    copyrightWork: string;
    description: string;
    goodFaith: boolean;
    accuracy: boolean;
    signature: string;
}

// Mock data
const mockRequests: DMCARequest[] = [
    {
        id: 'dmca-001',
        type: 'takedown',
        status: 'actioned',
        claimant: { name: 'John Smith', email: 'john@musiclabel.com', company: 'Major Music Label' },
        content: { type: 'stream', id: 's123', url: '/stream/s123', title: 'Gaming Stream #42' },
        copyrightWork: 'Song Title by Artist Name',
        description: 'Unauthorized use of copyrighted music during stream',
        signedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        resolvedAt: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
        id: 'dmca-002',
        type: 'takedown',
        status: 'pending',
        claimant: { name: 'Content Studio', email: 'legal@studio.com', company: 'Content Studio LLC' },
        content: { type: 'clip', id: 'c456', url: '/clip/c456', title: 'Highlight Reel' },
        copyrightWork: 'Movie Scene from Film Title',
        description: 'Clip contains footage from our copyrighted film',
        signedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
    }
];

const statusConfig = {
    pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock, label: 'Pending' },
    in_review: { color: 'bg-blue-500/20 text-blue-400', icon: FileText, label: 'In Review' },
    actioned: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'Actioned' },
    rejected: { color: 'bg-red-500/20 text-red-400', icon: XCircle, label: 'Rejected' },
    counter_filed: { color: 'bg-purple-500/20 text-purple-400', icon: MessageSquare, label: 'Counter Filed' }
};

export function DMCATakedown() {
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState<'takedown' | 'counter'>('takedown');
    const [formData, setFormData] = useState<DMCAFormData>({
        claimantName: '',
        claimantEmail: '',
        claimantCompany: '',
        contentUrl: '',
        copyrightWork: '',
        description: '',
        goodFaith: false,
        accuracy: false,
        signature: ''
    });
    const [selectedRequest, setSelectedRequest] = useState<DMCARequest | null>(null);

    const queryClient = useQueryClient();

    const { data: requests = mockRequests } = useQuery({
        queryKey: ['dmcaRequests'],
        queryFn: async () => mockRequests
    });

    const submitRequest = useMutation({
        mutationFn: async (data: DMCAFormData) => {
            // Would call API
            return { id: `dmca-${Date.now()}`, status: 'pending' };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dmcaRequests'] });
            setShowForm(false);
            resetForm();
        }
    });

    const resetForm = () => {
        setFormData({
            claimantName: '',
            claimantEmail: '',
            claimantCompany: '',
            contentUrl: '',
            copyrightWork: '',
            description: '',
            goodFaith: false,
            accuracy: false,
            signature: ''
        });
    };

    const isFormValid = formData.claimantName && formData.claimantEmail &&
        formData.contentUrl && formData.copyrightWork && formData.description &&
        formData.goodFaith && formData.accuracy && formData.signature;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="h-6 w-6 text-purple-400" />
                        DMCA Takedown Requests
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Submit and track copyright takedown requests
                    </p>
                </div>
                <Button variant="primary" onClick={() => { setFormType('takedown'); setShowForm(true); }}>
                    <Plus className="w-4 h-4 mr-1" />
                    New Request
                </Button>
            </div>

            {/* Info alert */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-300">
                        <p className="font-medium text-blue-400 mb-1">Before filing a DMCA request</p>
                        <p>Please ensure you are the copyright owner or authorized to act on their behalf.
                            Filing false DMCA claims may result in legal consequences.</p>
                    </div>
                </div>
            </div>

            {/* Request list */}
            <div className="space-y-3">
                <h2 className="text-white font-medium">Your Requests</h2>

                {requests.length === 0 ? (
                    <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
                        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-400">No DMCA requests filed</p>
                    </Card>
                ) : (
                    requests.map(request => {
                        const status = statusConfig[request.status];
                        const StatusIcon = status.icon;

                        return (
                            <Card
                                key={request.id}
                                className="bg-slate-800/50 border-slate-700 p-4 cursor-pointer hover:bg-slate-800"
                                onClick={() => setSelectedRequest(request)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>
                                                <StatusIcon className="w-3 h-3 inline mr-1" />
                                                {status.label}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {request.type === 'takedown' ? 'Takedown' : 'Counter-Notice'}
                                            </span>
                                        </div>
                                        <div className="text-white font-medium">{request.content.title}</div>
                                        <div className="text-sm text-slate-400 truncate">{request.copyrightWork}</div>
                                    </div>
                                    <div className="text-right text-sm text-slate-500">
                                        {new Date(request.createdAt).toLocaleDateString()}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-500" />
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Form modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-lg w-full my-8">
                        <h3 className="text-white font-semibold mb-4">
                            {formType === 'takedown' ? 'DMCA Takedown Request' : 'Counter-Notification'}
                        </h3>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Your Name *</label>
                                    <input
                                        type="text"
                                        value={formData.claimantName}
                                        onChange={(e) => setFormData({ ...formData, claimantName: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Email *</label>
                                    <input
                                        type="email"
                                        value={formData.claimantEmail}
                                        onChange={(e) => setFormData({ ...formData, claimantEmail: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Company (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.claimantCompany}
                                    onChange={(e) => setFormData({ ...formData, claimantCompany: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Infringing Content URL *</label>
                                <input
                                    type="url"
                                    value={formData.contentUrl}
                                    onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                                    placeholder="https://streamura.com/stream/..."
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Original Copyrighted Work *</label>
                                <input
                                    type="text"
                                    value={formData.copyrightWork}
                                    onChange={(e) => setFormData({ ...formData, copyrightWork: e.target.value })}
                                    placeholder="Title of the copyrighted work"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Description of Infringement *</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white resize-none"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.goodFaith}
                                        onChange={(e) => setFormData({ ...formData, goodFaith: e.target.checked })}
                                        className="mt-1"
                                    />
                                    <span className="text-sm text-slate-300">
                                        I have a good faith belief that use of the material is not authorized by the copyright owner.
                                    </span>
                                </label>

                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.accuracy}
                                        onChange={(e) => setFormData({ ...formData, accuracy: e.target.checked })}
                                        className="mt-1"
                                    />
                                    <span className="text-sm text-slate-300">
                                        The information in this notification is accurate, and under penalty of perjury,
                                        I am authorized to act on behalf of the copyright owner.
                                    </span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Digital Signature *</label>
                                <input
                                    type="text"
                                    value={formData.signature}
                                    onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                                    placeholder="Type your full legal name"
                                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <Button variant="secondary" className="flex-1" onClick={() => { setShowForm(false); resetForm(); }}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                className="flex-1"
                                onClick={() => submitRequest.mutate(formData)}
                                disabled={!isFormValid}
                            >
                                <Send className="w-4 h-4 mr-1" />
                                Submit Request
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Request detail modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <Card className="bg-slate-800 border-slate-700 p-6 max-w-lg w-full">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold">Request Details</h3>
                            <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                {(() => {
                                    const status = statusConfig[selectedRequest.status];
                                    const StatusIcon = status.icon;
                                    return (
                                        <span className={`px-3 py-1 rounded text-sm ${status.color}`}>
                                            <StatusIcon className="w-4 h-4 inline mr-1" />
                                            {status.label}
                                        </span>
                                    );
                                })()}
                            </div>

                            <div>
                                <div className="text-sm text-slate-400">Content</div>
                                <div className="text-white">{selectedRequest.content.title}</div>
                            </div>

                            <div>
                                <div className="text-sm text-slate-400">Copyrighted Work</div>
                                <div className="text-white">{selectedRequest.copyrightWork}</div>
                            </div>

                            <div>
                                <div className="text-sm text-slate-400">Description</div>
                                <div className="text-white">{selectedRequest.description}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-sm text-slate-400">Filed</div>
                                    <div className="text-white">{new Date(selectedRequest.createdAt).toLocaleDateString()}</div>
                                </div>
                                {selectedRequest.resolvedAt && (
                                    <div>
                                        <div className="text-sm text-slate-400">Resolved</div>
                                        <div className="text-white">{new Date(selectedRequest.resolvedAt).toLocaleDateString()}</div>
                                    </div>
                                )}
                            </div>

                            {selectedRequest.status === 'actioned' && (
                                <Button variant="secondary" className="w-full" onClick={() => { setFormType('counter'); setShowForm(true); setSelectedRequest(null); }}>
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    File Counter-Notification
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default DMCATakedown;
