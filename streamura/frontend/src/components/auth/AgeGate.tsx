import { useState } from 'react';
import {
    Shield,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Lock,
    Eye,
    CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface AgeGateProps {
    onVerified: () => void;
    onCancel?: () => void;
    minimumAge?: number;
    contentType?: string;
}

type VerificationMethod = 'self' | 'dob' | 'id';

export function AgeGate({
    onVerified,
    onCancel,
    minimumAge = 18,
    contentType = 'mature content'
}: AgeGateProps) {
    const [method, setMethod] = useState<VerificationMethod | null>(null);
    const [dob, setDob] = useState({ month: '', day: '', year: '' });
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculateAge = () => {
        const { month, day, year } = dob;
        if (!month || !day || !year) return null;

        const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };

    const handleSelfVerify = () => {
        if (!confirmed) {
            setError('You must confirm you are of legal age');
            return;
        }
        onVerified();
    };

    const handleDobVerify = () => {
        const age = calculateAge();
        if (age === null) {
            setError('Please enter a valid date of birth');
            return;
        }
        if (age < minimumAge) {
            setError(`You must be at least ${minimumAge} years old to view this content`);
            return;
        }
        onVerified();
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 p-6 max-w-md w-full">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-full bg-orange-500/20">
                        <Shield className="w-8 h-8 text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Age Verification Required</h2>
                        <p className="text-sm text-slate-400">
                            You must be {minimumAge}+ to view {contentType}
                        </p>
                    </div>
                </div>

                {!method ? (
                    /* Method selection */
                    <div className="space-y-3">
                        <button
                            onClick={() => setMethod('self')}
                            className="w-full flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            <div>
                                <div className="text-white font-medium">Self-Attestation</div>
                                <div className="text-sm text-slate-400">Confirm you're {minimumAge}+</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMethod('dob')}
                            className="w-full flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <div>
                                <div className="text-white font-medium">Date of Birth</div>
                                <div className="text-sm text-slate-400">Enter your birth date</div>
                            </div>
                        </button>

                        <button
                            onClick={() => setMethod('id')}
                            className="w-full flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                        >
                            <CreditCard className="w-5 h-5 text-purple-400" />
                            <div>
                                <div className="text-white font-medium">ID Verification</div>
                                <div className="text-sm text-slate-400">Verify with government ID</div>
                            </div>
                        </button>
                    </div>
                ) : method === 'self' ? (
                    /* Self attestation */
                    <div className="space-y-4">
                        <div className="p-4 bg-slate-700/50 rounded-lg">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={confirmed}
                                    onChange={(e) => { setConfirmed(e.target.checked); setError(null); }}
                                    className="mt-1 w-4 h-4 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500"
                                />
                                <span className="text-slate-300 text-sm">
                                    I confirm that I am at least {minimumAge} years of age and legally
                                    permitted to view this content in my jurisdiction.
                                </span>
                            </label>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setMethod(null)}>
                                Back
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleSelfVerify}>
                                Confirm Age
                            </Button>
                        </div>
                    </div>
                ) : method === 'dob' ? (
                    /* DOB entry */
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Date of Birth</label>
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    placeholder="MM"
                                    maxLength={2}
                                    value={dob.month}
                                    onChange={(e) => { setDob({ ...dob, month: e.target.value }); setError(null); }}
                                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center"
                                />
                                <input
                                    type="text"
                                    placeholder="DD"
                                    maxLength={2}
                                    value={dob.day}
                                    onChange={(e) => { setDob({ ...dob, day: e.target.value }); setError(null); }}
                                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center"
                                />
                                <input
                                    type="text"
                                    placeholder="YYYY"
                                    maxLength={4}
                                    value={dob.year}
                                    onChange={(e) => { setDob({ ...dob, year: e.target.value }); setError(null); }}
                                    className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-center"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => { setMethod(null); setDob({ month: '', day: '', year: '' }); }}>
                                Back
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleDobVerify}>
                                Verify Age
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* ID verification redirect */
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                            <Lock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                            <p className="text-sm text-slate-300">
                                You will be redirected to our secure ID verification partner to complete age verification.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setMethod(null)}>
                                Back
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={() => window.open('/verify/id', '_blank')}>
                                Continue to Verification
                            </Button>
                        </div>
                    </div>
                )}

                {/* Cancel option */}
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-400"
                    >
                        Leave this page
                    </button>
                )}

                {/* Privacy note */}
                <p className="mt-4 text-xs text-slate-500 text-center">
                    <Eye className="w-3 h-3 inline mr-1" />
                    Your information is handled securely and not stored.
                </p>
            </Card>
        </div>
    );
}

export default AgeGate;
