import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Shield,
    Smartphone,
    Key,
    Copy,
    Check,
    AlertTriangle,
    CheckCircle,
    Lock,
    Unlock,
    RefreshCw,
    Download,
    Eye,
    EyeOff
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface TwoFactorStatus {
    enabled: boolean;
    method: 'totp' | 'sms' | 'email' | null;
    backup_codes_remaining: number;
    last_used: string | null;
}

interface TwoFactorSetup {
    secret: string;
    qr_code_url: string;
    backup_codes: string[];
}

// Fetch 2FA status
const fetch2FAStatus = async () => {
    const res = await fetch('/api/v1/auth/2fa/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch 2FA status');
    return res.json();
};

export function TwoFactorSetup() {
    const [step, setStep] = useState<'overview' | 'setup' | 'verify' | 'backup'>('overview');
    const [verificationCode, setVerificationCode] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const { data: status, isLoading } = useQuery({
        queryKey: ['2faStatus'],
        queryFn: fetch2FAStatus
    });

    const initSetup = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/v1/auth/2fa/setup', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
            });
            return res.json();
        },
        onSuccess: () => setStep('setup')
    });

    const verifyAndEnable = useMutation({
        mutationFn: async (code: string) => {
            const res = await fetch('/api/v1/auth/2fa/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });
            if (!res.ok) throw new Error('Invalid code');
            return res.json();
        },
        onSuccess: () => {
            setStep('backup');
            queryClient.invalidateQueries({ queryKey: ['2faStatus'] });
        },
        onError: () => setError('Invalid verification code. Please try again.')
    });

    // Mock setup data
    const mockSetupData: TwoFactorSetup = {
        secret: 'JBSWY3DPEHPK3PXP',
        qr_code_url: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0yMCAyMGgxMHYxMEgyMHpNNDAgMjBoMTB2MTBINDB6TTYwIDIwaDEwdjEwSDYwek04MCAyMGgxMHYxMEg4MHpNMTAwIDIwaDEwdjEwSDEwMHpNMTIwIDIwaDEwdjEwSDEyMHpNMTQwIDIwaDEwdjEwSDE0MHpNMTYwIDIwaDEwdjEwSDE2MHpNMjAgNDBoMTB2MTBIMjB6TTYwIDQwaDEwdjEwSDYwek0xMDAgNDBoMTB2MTBIMTAwek0xNDAgNDBoMTB2MTBIMTQwek0xNjAgNDBoMTB2MTBIMTYweiIvPjwvc3ZnPg==',
        backup_codes: [
            'ABCD-1234-EFGH',
            'IJKL-5678-MNOP',
            'QRST-9012-UVWX',
            'YZAB-3456-CDEF',
            'GHIJ-7890-KLMN',
            'OPQR-1234-STUV',
            'WXYZ-5678-ABCD',
            'EFGH-9012-IJKL'
        ]
    };

    const setupData = initSetup.data || mockSetupData;
    const twoFAStatus = status as TwoFactorStatus || { enabled: false, method: null, backup_codes_remaining: 0 };

    const copyToClipboard = (text: string, index?: number) => {
        navigator.clipboard.writeText(text);
        if (index !== undefined) {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        }
    };

    const downloadBackupCodes = () => {
        const codes = setupData.backup_codes.join('\n');
        const blob = new Blob([`Streamura 2FA Backup Codes\n\nSave these codes in a secure location.\nEach code can only be used once.\n\n${codes}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'streamura-backup-codes.txt';
        a.click();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48 text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading security settings...
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shield className="h-6 w-6 text-purple-400" />
                    Two-Factor Authentication
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Add an extra layer of security to your account
                </p>
            </div>

            {/* Current status */}
            <Card className={`p-4 ${twoFAStatus.enabled ? 'bg-green-500/10 border-green-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${twoFAStatus.enabled ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                            {twoFAStatus.enabled ? <Lock className="w-5 h-5 text-green-400" /> : <Unlock className="w-5 h-5 text-slate-400" />}
                        </div>
                        <div>
                            <div className="text-white font-medium">
                                {twoFAStatus.enabled ? '2FA is enabled' : '2FA is not enabled'}
                            </div>
                            <div className="text-sm text-slate-400">
                                {twoFAStatus.enabled
                                    ? `Using ${twoFAStatus.method?.toUpperCase() || 'authenticator app'} • ${twoFAStatus.backup_codes_remaining} backup codes remaining`
                                    : 'Your account is less secure without 2FA'
                                }
                            </div>
                        </div>
                    </div>
                    {!twoFAStatus.enabled && step === 'overview' && (
                        <Button variant="primary" onClick={() => initSetup.mutate()}>
                            Enable 2FA
                        </Button>
                    )}
                </div>
            </Card>

            {/* Setup flow */}
            {step === 'setup' && (
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-purple-400" />
                        Step 1: Scan QR Code
                    </h2>
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0">
                            <div className="bg-white p-4 rounded-lg w-48 h-48 flex items-center justify-center">
                                <img
                                    src={setupData.qr_code_url}
                                    alt="2FA QR Code"
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                        <div className="flex-1 space-y-4">
                            <p className="text-slate-300 text-sm">
                                Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                            </p>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Or enter this code manually:</div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 px-3 py-2 bg-slate-700 rounded text-sm font-mono text-white">
                                        {showSecret ? setupData.secret : '••••••••••••••••'}
                                    </code>
                                    <button onClick={() => setShowSecret(!showSecret)} className="p-2 text-slate-400 hover:text-white">
                                        {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => copyToClipboard(setupData.secret)} className="p-2 text-slate-400 hover:text-white">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <Button variant="primary" onClick={() => setStep('verify')}>
                                Continue
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {step === 'verify' && (
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-purple-400" />
                        Step 2: Verify Code
                    </h2>
                    <p className="text-slate-300 text-sm mb-4">
                        Enter the 6-digit code from your authenticator app to verify setup.
                    </p>
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg mb-4">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-red-300 text-sm">{error}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            value={verificationCode}
                            onChange={(e) => {
                                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                                setError(null);
                            }}
                            placeholder="000000"
                            className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white text-center text-2xl tracking-widest font-mono w-40"
                            maxLength={6}
                        />
                        <Button
                            variant="primary"
                            onClick={() => verifyAndEnable.mutate(verificationCode)}
                            disabled={verificationCode.length !== 6}
                        >
                            Verify & Enable
                        </Button>
                    </div>
                </Card>
            )}

            {step === 'backup' && (
                <Card className="bg-slate-800/50 border-slate-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <h2 className="text-lg font-semibold text-white">2FA Enabled Successfully!</h2>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="text-yellow-200 font-medium">Save your backup codes</div>
                                <p className="text-yellow-200/70 text-sm">
                                    These codes can be used to access your account if you lose your phone.
                                    Each code can only be used once. Store them in a secure location.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {setupData.backup_codes.map((code: string, index: number) => (
                            <button
                                key={index}
                                onClick={() => copyToClipboard(code, index)}
                                className="flex items-center justify-between px-3 py-2 bg-slate-700 rounded font-mono text-sm text-white hover:bg-slate-600 transition-colors"
                            >
                                <span>{code}</span>
                                {copiedIndex === index ? (
                                    <Check className="w-4 h-4 text-green-400" />
                                ) : (
                                    <Copy className="w-4 h-4 text-slate-400" />
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={downloadBackupCodes}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Codes
                        </Button>
                        <Button variant="primary" onClick={() => setStep('overview')}>
                            Done
                        </Button>
                    </div>
                </Card>
            )}

            {/* Security recommendations */}
            {step === 'overview' && !twoFAStatus.enabled && (
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Why use 2FA?</h3>
                    <ul className="space-y-2 text-sm text-slate-300">
                        <li className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
                            Protects your account even if your password is compromised
                        </li>
                        <li className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
                            Required for withdrawing earnings over $500
                        </li>
                        <li className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-400 mt-0.5" />
                            Prevents unauthorized changes to payout settings
                        </li>
                    </ul>
                </Card>
            )}

            {/* Manage 2FA when enabled */}
            {twoFAStatus.enabled && step === 'overview' && (
                <Card className="bg-slate-800/50 border-slate-700 p-4">
                    <h3 className="text-white font-medium mb-3">Manage 2FA</h3>
                    <div className="space-y-3">
                        <button className="w-full flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors">
                            <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-slate-400" />
                                <span className="text-white">View backup codes</span>
                            </div>
                            <span className="text-xs text-slate-500">{twoFAStatus.backup_codes_remaining} remaining</span>
                        </button>
                        <button className="w-full flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors text-red-400">
                            <div className="flex items-center gap-2">
                                <Unlock className="w-4 h-4" />
                                <span>Disable 2FA</span>
                            </div>
                        </button>
                    </div>
                </Card>
            )}
        </div>
    );
}

export default TwoFactorSetup;
