import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BadgeCheck,
    Building2,
    FileText,
    Upload,
    Check,
    Clock,
    AlertTriangle,
    Shield,
    Globe,
    Users,
    Radio,
    ExternalLink,
    ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface VerificationStatus {
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    organization_name?: string;
    organization_type?: 'news' | 'government' | 'ngo' | 'educational';
    verified_at?: string;
    badge_type?: 'news' | 'official' | 'verified';
    rejection_reason?: string;
}

interface VerificationDocument {
    id: string;
    name: string;
    type: string;
    uploaded_at: string;
    status: 'pending' | 'approved' | 'rejected';
}

// Fetch verification status
const fetchVerificationStatus = async () => {
    const res = await fetch('/api/v1/verification/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
};

// Status badge component
function StatusBadge({ status }: { status: VerificationStatus['status'] }) {
    const config = {
        unverified: { color: 'bg-slate-500/20 text-slate-400', icon: Shield, label: 'Not Verified' },
        pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock, label: 'Pending Review' },
        verified: { color: 'bg-green-500/20 text-green-400', icon: BadgeCheck, label: 'Verified' },
        rejected: { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle, label: 'Rejected' }
    };

    const { color, icon: Icon, label } = config[status];

    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
            <Icon className="w-4 h-4" />
            {label}
        </span>
    );
}

export function NewsVerification() {
    const [step, setStep] = useState<'overview' | 'apply' | 'documents'>('overview');
    const [formData, setFormData] = useState({
        organization_name: '',
        organization_type: 'news' as const,
        website: '',
        description: '',
        contact_email: ''
    });
    const [documents, setDocuments] = useState<File[]>([]);
    const queryClient = useQueryClient();

    const { data: status, isLoading } = useQuery({
        queryKey: ['verificationStatus'],
        queryFn: fetchVerificationStatus
    });

    const submitApplication = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await fetch('/api/v1/verification/apply', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            setStep('documents');
            queryClient.invalidateQueries({ queryKey: ['verificationStatus'] });
        }
    });

    const uploadDocument = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('document', file);
            const res = await fetch('/api/v1/verification/documents', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: formData
            });
            return res.json();
        }
    });

    const verificationStatus = status as VerificationStatus || { status: 'unverified' };

    const organizationTypes = [
        { value: 'news', label: 'News Organization', icon: Radio },
        { value: 'government', label: 'Government Agency', icon: Building2 },
        { value: 'ngo', label: 'Non-Profit / NGO', icon: Users },
        { value: 'educational', label: 'Educational Institution', icon: Globe }
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <Clock className="h-6 w-6 animate-spin mr-2" />
                Loading verification status...
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BadgeCheck className="h-6 w-6 text-blue-400" />
                    Organization Verification
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Get verified to unlock emergency broadcast features and trusted badges
                </p>
            </div>

            {/* Current status */}
            <Card className="bg-slate-800/50 border-slate-700 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-700">
                            <Building2 className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <div className="text-white font-medium">
                                {verificationStatus.organization_name || 'Verification Status'}
                            </div>
                            <StatusBadge status={verificationStatus.status} />
                        </div>
                    </div>
                    {verificationStatus.status === 'unverified' && step === 'overview' && (
                        <Button variant="primary" onClick={() => setStep('apply')}>
                            Apply for Verification
                        </Button>
                    )}
                </div>

                {verificationStatus.status === 'rejected' && verificationStatus.rejection_reason && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                            <div>
                                <div className="text-red-300 font-medium">Application Rejected</div>
                                <p className="text-red-200/70 text-sm">{verificationStatus.rejection_reason}</p>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* Benefits of verification */}
            {verificationStatus.status === 'unverified' && step === 'overview' && (
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Verification Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg">
                            <BadgeCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            <div>
                                <div className="text-white text-sm font-medium">Verified Badge</div>
                                <p className="text-slate-400 text-xs">Display a trust badge on your profile</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg">
                            <Radio className="w-5 h-5 text-red-400 flex-shrink-0" />
                            <div>
                                <div className="text-white text-sm font-medium">Emergency Broadcasts</div>
                                <p className="text-slate-400 text-xs">Send priority alerts during crises</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg">
                            <Shield className="w-5 h-5 text-green-400 flex-shrink-0" />
                            <div>
                                <div className="text-white text-sm font-medium">Content Protection</div>
                                <p className="text-slate-400 text-xs">Enhanced moderation priority</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg">
                            <Globe className="w-5 h-5 text-purple-400 flex-shrink-0" />
                            <div>
                                <div className="text-white text-sm font-medium">Discovery Boost</div>
                                <p className="text-slate-400 text-xs">Higher visibility in search results</p>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Application form */}
            {step === 'apply' && (
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Organization Details</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Organization Name</label>
                            <input
                                type="text"
                                value={formData.organization_name}
                                onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                placeholder="e.g., CNN, BBC, Local News Channel"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Organization Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {organizationTypes.map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        onClick={() => setFormData({ ...formData, organization_type: value as typeof formData.organization_type })}
                                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${formData.organization_type === value
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                                : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span className="text-sm">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Official Website</label>
                            <input
                                type="url"
                                value={formData.website}
                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                placeholder="https://example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Contact Email</label>
                            <input
                                type="email"
                                value={formData.contact_email}
                                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                                placeholder="verification@organization.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none"
                                placeholder="Brief description of your organization..."
                            />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <Button variant="secondary" onClick={() => setStep('overview')}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => submitApplication.mutate(formData)}
                                disabled={!formData.organization_name || !formData.website || !formData.contact_email}
                            >
                                Continue to Documents
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Document upload */}
            {step === 'documents' && (
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-2">Upload Verification Documents</h2>
                    <p className="text-slate-400 text-sm mb-4">
                        Please upload documents that prove your organization's identity (e.g., business registration, press credentials, official letterhead)
                    </p>

                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                        <p className="text-slate-300 mb-2">Drop files here or click to upload</p>
                        <p className="text-slate-500 text-sm mb-4">PDF, JPG, PNG up to 10MB each</p>
                        <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => setDocuments(Array.from(e.target.files || []))}
                            className="hidden"
                            id="doc-upload"
                        />
                        <label htmlFor="doc-upload">
                            <Button variant="secondary" as="span">
                                <FileText className="w-4 h-4 mr-2" />
                                Select Files
                            </Button>
                        </label>
                    </div>

                    {documents.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {documents.map((doc, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="flex-1 text-white text-sm">{doc.name}</span>
                                    <span className="text-xs text-slate-500">{(doc.size / 1024).toFixed(1)} KB</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-6">
                        <Button variant="secondary" onClick={() => setStep('apply')}>
                            Back
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                documents.forEach(doc => uploadDocument.mutate(doc));
                                setStep('overview');
                            }}
                            disabled={documents.length === 0}
                        >
                            Submit Application
                        </Button>
                    </div>
                </Card>
            )}

            {/* Verified features */}
            {verificationStatus.status === 'verified' && (
                <Card className="bg-green-500/10 border-green-500/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Check className="w-5 h-5 text-green-400" />
                        <h3 className="text-white font-medium">Your Verified Features</h3>
                    </div>
                    <div className="space-y-2">
                        <button className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2">
                                <Radio className="w-4 h-4 text-red-400" />
                                <span className="text-white">Emergency Broadcast Console</span>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-500" />
                        </button>
                        <button className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-2">
                                <BadgeCheck className="w-4 h-4 text-blue-400" />
                                <span className="text-white">Badge Settings</span>
                            </div>
                            <ExternalLink className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
}

export default NewsVerification;
