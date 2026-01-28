import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileText,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    Eye,
    Download
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';



interface LicenseRequest {
    id: number;
    stream_id: number;
    stream_title: string;
    requester_name: string;
    requester_org: string;
    license_type: 'exclusive' | 'non_exclusive' | 'one_time';
    duration_days: number;
    offered_price: number;
    status: 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'expired';
    message: string;
    created_at: string;
}

interface LicenseAgreement {
    id: number;
    stream_id: number;
    stream_title: string;
    licensee_name: string;
    license_type: string;
    price: number;
    start_date: string;
    end_date: string;
    download_url: string;
    status: 'active' | 'expired' | 'revoked';
}

const statusColors = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    negotiating: 'text-blue-400 bg-blue-500/10',
    accepted: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
    expired: 'text-slate-400 bg-slate-500/10',
    active: 'text-green-400 bg-green-500/10',
    revoked: 'text-red-400 bg-red-500/10',
};

export function ContentLicensingPage() {
    const token = localStorage.getItem('access_token');
    const [activeTab, setActiveTab] = useState<'requests' | 'agreements'>('requests');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch license requests (for content creator)
    const { data: licenseRequests, isLoading: requestsLoading } = useQuery({
        queryKey: ['license-requests'],
        queryFn: async () => {
            // Mock data for demo - in production would fetch from API
            const mockRequests: LicenseRequest[] = [
                {
                    id: 1,
                    stream_id: 1,
                    stream_title: "Tech Conference 2026 Keynote",
                    requester_name: "Sarah Johnson",
                    requester_org: "TechNews Weekly",
                    license_type: "non_exclusive",
                    duration_days: 365,
                    offered_price: 2500,
                    status: "pending",
                    message: "We'd like to feature clips from your stream in our tech recap video series.",
                    created_at: new Date().toISOString(),
                },
                {
                    id: 2,
                    stream_id: 2,
                    stream_title: "Music Festival Main Stage",
                    requester_name: "Mike Chen",
                    requester_org: "Entertainment Tonight",
                    license_type: "exclusive",
                    duration_days: 30,
                    offered_price: 5000,
                    status: "negotiating",
                    message: "Interested in exclusive rights for a documentary we're producing.",
                    created_at: new Date(Date.now() - 86400000).toISOString(),
                },
            ];
            return mockRequests;
        },
        enabled: !!token,
    });

    // Fetch license agreements
    const { data: licenseAgreements, isLoading: agreementsLoading } = useQuery({
        queryKey: ['license-agreements'],
        queryFn: async () => {
            const mockAgreements: LicenseAgreement[] = [
                {
                    id: 1,
                    stream_id: 3,
                    stream_title: "Breaking News Coverage",
                    licensee_name: "CNN Digital",
                    license_type: "non_exclusive",
                    price: 1500,
                    start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
                    end_date: new Date(Date.now() + 335 * 86400000).toISOString(),
                    download_url: "/downloads/license-001.pdf",
                    status: "active",
                },
            ];
            return mockAgreements;
        },
        enabled: !!token,
    });

    const handleAcceptRequest = async (requestId: number) => {
        // Would call API to accept
        console.log('Accepting request', requestId);
    };

    const handleRejectRequest = async (requestId: number) => {
        // Would call API to reject
        console.log('Rejecting request', requestId);
    };

    const isLoading = requestsLoading || agreementsLoading;

    return (
        <div className="min-h-screen bg-slate-900 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary-500" />
                        <div>
                            <h1 className="text-2xl font-bold text-white">Content Licensing</h1>
                            <p className="text-slate-400">Manage license requests and agreements for your content</p>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-8 w-8 text-green-400" />
                                <div>
                                    <p className="text-2xl font-bold text-white">$8,500</p>
                                    <p className="text-sm text-slate-400">Total Earnings</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Clock className="h-8 w-8 text-yellow-400" />
                                <div>
                                    <p className="text-2xl font-bold text-white">{licenseRequests?.filter(r => r.status === 'pending').length || 0}</p>
                                    <p className="text-sm text-slate-400">Pending Requests</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-8 w-8 text-green-400" />
                                <div>
                                    <p className="text-2xl font-bold text-white">{licenseAgreements?.filter(a => a.status === 'active').length || 0}</p>
                                    <p className="text-sm text-slate-400">Active Licenses</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <Eye className="h-8 w-8 text-blue-400" />
                                <div>
                                    <p className="text-2xl font-bold text-white">12</p>
                                    <p className="text-sm text-slate-400">Licensed Streams</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <Button
                        variant={activeTab === 'requests' ? 'primary' : 'secondary'}
                        onClick={() => setActiveTab('requests')}
                    >
                        License Requests
                    </Button>
                    <Button
                        variant={activeTab === 'agreements' ? 'primary' : 'secondary'}
                        onClick={() => setActiveTab('agreements')}
                    >
                        Active Agreements
                    </Button>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <Input
                        placeholder="Search by stream title or organization..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-md"
                    />
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
                    </div>
                ) : activeTab === 'requests' ? (
                    <div className="space-y-4">
                        {licenseRequests && licenseRequests.length > 0 ? (
                            licenseRequests.map((request) => (
                                <Card key={request.id} className="hover:border-slate-600 transition-colors">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-semibold text-white">{request.stream_title}</h3>
                                                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[request.status]}`}>
                                                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 mb-3">
                                                    <span className="text-slate-300">{request.requester_name}</span> from{' '}
                                                    <span className="text-slate-300">{request.requester_org}</span>
                                                </p>
                                                <p className="text-sm text-slate-400 mb-4">{request.message}</p>
                                                <div className="flex items-center gap-6 text-sm">
                                                    <div>
                                                        <span className="text-slate-500">License Type:</span>{' '}
                                                        <span className="text-slate-300">{request.license_type.replace('_', ' ')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Duration:</span>{' '}
                                                        <span className="text-slate-300">{request.duration_days} days</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Offered:</span>{' '}
                                                        <span className="text-green-400 font-semibold">${request.offered_price.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {request.status === 'pending' && (
                                                <div className="flex gap-2 ml-4">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleRejectRequest(request.id)}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Decline
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAcceptRequest(request.id)}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        Accept
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">No License Requests</h3>
                                    <p className="text-slate-400">
                                        When organizations want to license your content, their requests will appear here.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {licenseAgreements && licenseAgreements.length > 0 ? (
                            licenseAgreements.map((agreement) => (
                                <Card key={agreement.id} className="hover:border-slate-600 transition-colors">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="font-semibold text-white">{agreement.stream_title}</h3>
                                                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[agreement.status]}`}>
                                                        {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-400 mb-3">
                                                    Licensed to <span className="text-slate-300">{agreement.licensee_name}</span>
                                                </p>
                                                <div className="flex items-center gap-6 text-sm">
                                                    <div>
                                                        <span className="text-slate-500">Type:</span>{' '}
                                                        <span className="text-slate-300">{agreement.license_type.replace('_', ' ')}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Value:</span>{' '}
                                                        <span className="text-green-400">${agreement.price.toLocaleString()}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500">Valid until:</span>{' '}
                                                        <span className="text-slate-300">{new Date(agreement.end_date).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button variant="secondary" size="sm">
                                                <Download className="h-4 w-4 mr-1" />
                                                Agreement
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <CheckCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-white mb-2">No Active Agreements</h3>
                                    <p className="text-slate-400">
                                        Your active license agreements will appear here.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* Info Card */}
                <Card className="mt-8 border-primary-500/20 bg-primary-500/5">
                    <CardContent className="p-4">
                        <h3 className="font-medium text-primary-400 mb-2">About Content Licensing</h3>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• You retain 90% of all licensing revenue (Streamura keeps 10%)</li>
                            <li>• Exclusive licenses prevent other organizations from licensing the same content</li>
                            <li>• You can negotiate terms before accepting any request</li>
                            <li>• All agreements are legally binding and include takedown rights</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default ContentLicensingPage;
