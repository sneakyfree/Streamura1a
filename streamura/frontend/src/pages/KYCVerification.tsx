import { useState } from 'react';
import {
    Shield,
    CheckCircle,
    Clock,
    Camera,
    FileText,
    User,
    AlertTriangle,
    ArrowRight,
    Lock
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function KYCVerificationPage() {
    const [step, setStep] = useState<'start' | 'document' | 'selfie' | 'review' | 'complete'>('start');

    const verificationSteps = [
        { id: 'document', label: 'Upload ID', icon: FileText, complete: step !== 'start' && step !== 'document' },
        { id: 'selfie', label: 'Take Selfie', icon: Camera, complete: step === 'review' || step === 'complete' },
        { id: 'review', label: 'Under Review', icon: Clock, complete: step === 'complete' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary-500/10 rounded-xl">
                        <Shield className="h-8 w-8 text-primary-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Identity Verification</h1>
                        <p className="text-slate-400">Verify your identity to unlock all features</p>
                    </div>
                </div>

                {/* Benefits Card */}
                <Card className="mb-8 bg-gradient-to-r from-primary-500/10 to-primary-600/5 border-primary-500/20">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-white mb-4">Benefits of Verification</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <span className="text-sm text-slate-300">Unlimited payouts</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <span className="text-sm text-slate-300">Higher trust score</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <span className="text-sm text-slate-300">Priority support</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <CheckCircle className="h-5 w-5 text-green-400" />
                                <span className="text-sm text-slate-300">Verified badge</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8 px-4">
                    {verificationSteps.map((vstep, index) => (
                        <div key={vstep.id} className="flex items-center">
                            <div className={`
                flex items-center justify-center w-10 h-10 rounded-full
                ${vstep.complete ? 'bg-green-500' : step === vstep.id ? 'bg-primary-500' : 'bg-slate-700'}
              `}>
                                {vstep.complete ? (
                                    <CheckCircle className="h-5 w-5 text-white" />
                                ) : (
                                    <vstep.icon className="h-5 w-5 text-white" />
                                )}
                            </div>
                            <span className={`ml-2 text-sm ${vstep.complete || step === vstep.id ? 'text-white' : 'text-slate-500'}`}>
                                {vstep.label}
                            </span>
                            {index < verificationSteps.length - 1 && (
                                <ArrowRight className="h-4 w-4 text-slate-600 mx-4" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Start Step */}
                {step === 'start' && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <User className="h-10 w-10 text-primary-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Ready to get verified?</h2>
                            <p className="text-slate-400 mb-6 max-w-md mx-auto">
                                The verification process takes about 5 minutes. You'll need a government-issued ID
                                and a well-lit space for a selfie.
                            </p>

                            <div className="flex flex-col items-center gap-4">
                                <Button size="lg" onClick={() => setStep('document')}>
                                    <Shield className="h-5 w-5 mr-2" />
                                    Start Verification
                                </Button>

                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Your data is encrypted and secure
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Document Step */}
                {step === 'document' && (
                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white">Upload Government ID</h2>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="cursor-pointer hover:border-primary-500 transition-colors">
                                    <CardContent className="py-6 text-center">
                                        <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm text-white">Driver's License</p>
                                    </CardContent>
                                </Card>
                                <Card className="cursor-pointer hover:border-primary-500 transition-colors">
                                    <CardContent className="py-6 text-center">
                                        <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm text-white">Passport</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Coming Soon Notice */}
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-yellow-400">Coming Soon</h4>
                                        <p className="text-sm text-slate-300 mt-1">
                                            KYC verification is currently being integrated with our identity provider (Persona).
                                            This feature will be available in the next update.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between pt-4">
                                <Button variant="secondary" onClick={() => setStep('start')}>
                                    Back
                                </Button>
                                <Button onClick={() => setStep('selfie')} disabled>
                                    Continue
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Selfie Step Placeholder */}
                {step === 'selfie' && (
                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold text-white">Take a Selfie</h2>
                        </CardHeader>
                        <CardContent className="py-12 text-center">
                            <Camera className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                            <p className="text-slate-400">Camera access required</p>
                            <Button className="mt-4" onClick={() => setStep('review')}>
                                Skip for Demo
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Review Step */}
                {step === 'review' && (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Clock className="h-10 w-10 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white mb-2">Under Review</h2>
                            <p className="text-slate-400 mb-6">
                                Your documents are being reviewed. This usually takes 1-2 business days.
                                We'll notify you when complete.
                            </p>
                            <Button variant="secondary" onClick={() => setStep('start')}>
                                Done
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Info Card */}
                <Card className="mt-8 border-slate-700">
                    <CardContent className="p-4">
                        <h3 className="font-medium text-slate-300 mb-2">Privacy & Security</h3>
                        <ul className="text-sm text-slate-400 space-y-1">
                            <li>• Your documents are encrypted and stored securely</li>
                            <li>• We never share your data with third parties</li>
                            <li>• Documents are automatically deleted after verification</li>
                            <li>• You can request data deletion at any time</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default KYCVerificationPage;
