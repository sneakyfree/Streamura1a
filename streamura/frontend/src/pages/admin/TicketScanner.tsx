import { useState, useCallback } from 'react';
import { Scan, CheckCircle, XCircle, AlertCircle, Loader2, Ticket, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface TicketValidationResult {
    valid: boolean;
    message: string;
    ticket?: {
        id: string;
        event_name: string;
        holder_name: string;
        ticket_type: string;
        used_at?: string;
    };
}

export function TicketScanner() {
    const [manualCode, setManualCode] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const [lastResult, setLastResult] = useState<TicketValidationResult | null>(null);

    const validateTicket = useCallback(async (code: string) => {
        if (!code.trim()) {
            toast.error('Please enter a ticket code');
            return;
        }

        setIsValidating(true);
        setLastResult(null);

        try {
            // Simulate API call - in production, this would call the backend
            const response = await fetch(`/api/v1/events/tickets/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                const error = await response.json();
                setLastResult({
                    valid: false,
                    message: error.detail || 'Ticket validation failed',
                });
                toast.error('Invalid ticket');
                return;
            }

            const data = await response.json();
            setLastResult({
                valid: true,
                message: 'Ticket validated successfully!',
                ticket: data,
            });
            toast.success('Ticket is valid!');
            setManualCode('');
        } catch (error) {
            setLastResult({
                valid: false,
                message: 'Failed to connect to validation service',
            });
            toast.error('Validation service unavailable');
        } finally {
            setIsValidating(false);
        }
    }, []);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        validateTicket(manualCode);
    };

    return (
        <div className="min-h-screen bg-slate-900 py-8">
            <div className="max-w-2xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-12 w-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                        <Scan className="h-6 w-6 text-primary-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Ticket Scanner</h1>
                        <p className="text-slate-400">Validate event tickets</p>
                    </div>
                </div>

                {/* Manual Code Entry */}
                <Card className="mb-6 bg-slate-800/50 border-slate-700">
                    <CardHeader className="border-b border-slate-700">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Ticket className="h-5 w-5 text-primary-400" />
                            Enter Ticket Code
                        </h2>
                    </CardHeader>
                    <CardContent className="p-6">
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <Input
                                    type="text"
                                    placeholder="Enter ticket code or scan QR..."
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                                    className="text-lg font-mono tracking-wider"
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={isValidating || !manualCode.trim()}
                                className="w-full"
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        <Scan className="h-4 w-4 mr-2" />
                                        Validate Ticket
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Validation Result */}
                {lastResult && (
                    <Card className={`mb-6 ${lastResult.valid
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}>
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${lastResult.valid ? 'bg-green-500/20' : 'bg-red-500/20'
                                    }`}>
                                    {lastResult.valid ? (
                                        <CheckCircle className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <XCircle className="h-6 w-6 text-red-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className={`text-lg font-semibold ${lastResult.valid ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        {lastResult.valid ? 'Valid Ticket!' : 'Invalid Ticket'}
                                    </h3>
                                    <p className="text-slate-400">{lastResult.message}</p>

                                    {lastResult.ticket && (
                                        <div className="mt-4 space-y-2 text-sm">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Calendar className="h-4 w-4 text-slate-500" />
                                                <span>{lastResult.ticket.event_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <User className="h-4 w-4 text-slate-500" />
                                                <span>{lastResult.ticket.holder_name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <Ticket className="h-4 w-4 text-slate-500" />
                                                <span>{lastResult.ticket.ticket_type}</span>
                                            </div>
                                            {lastResult.ticket.used_at && (
                                                <div className="mt-2 px-3 py-2 bg-yellow-500/10 rounded text-yellow-400">
                                                    <AlertCircle className="h-4 w-4 inline mr-2" />
                                                    Previously scanned at {new Date(lastResult.ticket.used_at).toLocaleTimeString()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardContent className="p-6">
                        <h3 className="font-semibold text-white mb-3">Instructions</h3>
                        <ul className="space-y-2 text-slate-400 text-sm">
                            <li className="flex items-start gap-2">
                                <span className="text-primary-400">1.</span>
                                Enter the ticket code shown on the attendee's ticket
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary-400">2.</span>
                                Click "Validate Ticket" to check if it's valid
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary-400">3.</span>
                                Green = valid entry, Red = deny entry
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-primary-400">4.</span>
                                Yellow warning = ticket already used (possible duplicate)
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default TicketScanner;
