import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Shield,
    Smartphone,
    Key,
    Copy,
    Check,
    X,
    AlertTriangle,
    ChevronRight,
    Download,
    Eye,
    EyeOff
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface TwoFactorSetupProps {
    isEnabled: boolean;
    onComplete?: () => void;
    onCancel?: () => void;
}

type Step = 'method' | 'setup' | 'verify' | 'backup' | 'complete';
type Method = 'totp' | 'sms';

interface SetupData {
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
}

// Mock QR code placeholder
function QRCodePlaceholder({ url: _url }: { url: string }) {
    return (
        <div className="w-48 h-48 bg-white p-2 rounded-lg mx-auto">
            <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 rounded flex items-center justify-center">
                <div className="grid grid-cols-7 gap-0.5">
                    {Array.from({ length: 49 }).map((_, i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 ${Math.random() > 0.4 ? 'bg-black' : 'bg-white'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function TwoFactorSetup({ isEnabled, onComplete, onCancel }: TwoFactorSetupProps) {
    const [step, setStep] = useState<Step>(isEnabled ? 'verify' : 'method');
    const [method, setMethod] = useState<Method>('totp');
    const [setupData, setSetupData] = useState<SetupData | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [showBackupCodes, setShowBackupCodes] = useState(true);
    const [savedBackupCodes, setSavedBackupCodes] = useState(false);

    const initializeSetup = useMutation({
        mutationFn: async (_selectedMethod: Method) => {
            // Mock API call
            await new Promise(r => setTimeout(r, 1000));
            return {
                secret: 'JBSWY3DPEHPK3PXP',
                qrCodeUrl: 'otpauth://totp/Streamura:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Streamura',
                backupCodes: [
                    'A1B2-C3D4', 'E5F6-G7H8', 'I9J0-K1L2',
                    'M3N4-O5P6', 'Q7R8-S9T0', 'U1V2-W3X4'
                ]
            };
        },
        onSuccess: (data) => {
            setSetupData(data);
            setStep('setup');
        }
    });

    const verifySetup = useMutation({
        mutationFn: async (code: string) => {
            await new Promise(r => setTimeout(r, 500));
            if (code !== '123456' && code.length !== 6) {
                throw new Error('Invalid verification code');
            }
            return { success: true };
        },
        onSuccess: () => {
            setStep('backup');
            setVerifyError('');
        },
        onError: () => {
            setVerifyError('Invalid code. Please try again.');
        }
    });

    const disable2FA = useMutation({
        mutationFn: async (_code: string) => {
            await new Promise(r => setTimeout(r, 500));
            return { success: true };
        },
        onSuccess: () => {
            onComplete?.();
        }
    });

    const copySecret = () => {
        if (setupData) {
            navigator.clipboard.writeText(setupData.secret);
            setCopiedSecret(true);
            setTimeout(() => setCopiedSecret(false), 2000);
        }
    };

    const downloadBackupCodes = () => {
        if (setupData) {
            const content = setupData.backupCodes.join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'streamura-backup-codes.txt';
            a.click();
            setSavedBackupCodes(true);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <Shield className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-semibold">
                                {isEnabled ? 'Disable 2FA' : 'Enable Two-Factor Authentication'}
                            </h2>
                        </div>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="text-slate-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Method selection */}
                    {step === 'method' && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm mb-4">
                                Choose your preferred authentication method:
                            </p>

                            <button
                                onClick={() => setMethod('totp')}
                                className={`w-full p-4 rounded-lg border text-left ${method === 'totp'
                                        ? 'bg-purple-500/20 border-purple-500'
                                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Key className="w-5 h-5 text-purple-400" />
                                    <div>
                                        <div className="text-white font-medium">Authenticator App</div>
                                        <div className="text-xs text-slate-400">Use Google Authenticator, Authy, or similar</div>
                                    </div>
                                    <span className="ml-auto px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                        Recommended
                                    </span>
                                </div>
                            </button>

                            <button
                                onClick={() => setMethod('sms')}
                                className={`w-full p-4 rounded-lg border text-left ${method === 'sms'
                                        ? 'bg-purple-500/20 border-purple-500'
                                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-blue-400" />
                                    <div>
                                        <div className="text-white font-medium">SMS Text Message</div>
                                        <div className="text-xs text-slate-400">Receive codes via text message</div>
                                    </div>
                                </div>
                            </button>

                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={() => initializeSetup.mutate(method)}
                                disabled={initializeSetup.isPending}
                            >
                                {initializeSetup.isPending ? 'Setting up...' : 'Continue'}
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    )}

                    {/* Setup step */}
                    {step === 'setup' && setupData && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm text-center mb-4">
                                Scan this QR code with your authenticator app:
                            </p>

                            <QRCodePlaceholder url={setupData.qrCodeUrl} />

                            <div className="text-center">
                                <p className="text-xs text-slate-500 mb-2">Or enter this code manually:</p>
                                <div className="flex items-center justify-center gap-2">
                                    <code className="px-3 py-1.5 bg-slate-700 rounded font-mono text-sm text-white">
                                        {setupData.secret}
                                    </code>
                                    <button
                                        onClick={copySecret}
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
                                    >
                                        {copiedSecret ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <Button variant="primary" className="w-full" onClick={() => setStep('verify')}>
                                I've Added the Code
                            </Button>
                        </div>
                    )}

                    {/* Verify step */}
                    {step === 'verify' && (
                        <div className="space-y-4">
                            <p className="text-slate-400 text-sm text-center mb-4">
                                {isEnabled
                                    ? 'Enter the code from your authenticator to disable 2FA:'
                                    : 'Enter the 6-digit code from your authenticator app:'}
                            </p>

                            <input
                                type="text"
                                value={verifyCode}
                                onChange={(e) => {
                                    setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                    setVerifyError('');
                                }}
                                placeholder="000000"
                                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl font-mono tracking-widest"
                                maxLength={6}
                                autoFocus
                            />

                            {verifyError && (
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    {verifyError}
                                </div>
                            )}

                            <Button
                                variant={isEnabled ? 'danger' : 'primary'}
                                className="w-full"
                                onClick={() => isEnabled ? disable2FA.mutate(verifyCode) : verifySetup.mutate(verifyCode)}
                                disabled={verifyCode.length !== 6 || verifySetup.isPending}
                            >
                                {verifySetup.isPending ? 'Verifying...' : isEnabled ? 'Disable 2FA' : 'Verify & Continue'}
                            </Button>
                        </div>
                    )}

                    {/* Backup codes step */}
                    {step === 'backup' && setupData && (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />
                                <div className="text-sm text-slate-300">
                                    Save these backup codes in a secure place. You'll need them if you lose access to your authenticator.
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
                                >
                                    {showBackupCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <div className="grid grid-cols-2 gap-2 p-4 bg-slate-700/50 rounded-lg">
                                    {setupData.backupCodes.map((code, i) => (
                                        <div
                                            key={i}
                                            className="px-3 py-2 bg-slate-800 rounded text-center font-mono text-sm text-white"
                                        >
                                            {showBackupCodes ? code : '••••-••••'}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="secondary" className="flex-1" onClick={downloadBackupCodes}>
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                </Button>
                                <Button variant="secondary" className="flex-1" onClick={copySecret}>
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                </Button>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={savedBackupCodes}
                                    onChange={(e) => setSavedBackupCodes(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-slate-300">I've saved my backup codes</span>
                            </label>

                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={() => setStep('complete')}
                                disabled={!savedBackupCodes}
                            >
                                Complete Setup
                            </Button>
                        </div>
                    )}

                    {/* Complete step */}
                    {step === 'complete' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">2FA Enabled!</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Your account is now protected with two-factor authentication.
                            </p>
                            <Button variant="primary" onClick={onComplete}>
                                Done
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

export default TwoFactorSetup;
