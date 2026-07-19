import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
    FileText,
    Download,
    Calendar,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    Clock,
    Building,
    Globe,
    Upload,
    RefreshCw,
    ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Types
interface TaxDocument {
    id: number;
    type: '1099-K' | '1099-NEC' | 'W-9' | 'W-8BEN';
    year: number;
    status: 'pending' | 'available' | 'submitted';
    generated_at?: string;
    download_url?: string;
}

interface TaxSummary {
    year: number;
    total_earnings: number;
    platform_fees: number;
    net_earnings: number;
    estimated_tax: number;
    payouts_count: number;
    documents: TaxDocument[];
}


// Fetch tax data
const fetchTaxData = async () => {
    const res = await fetch('/api/v1/tax/summary', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch tax data');
    return res.json();
};

// Currency options
const currencyOptions = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' }
];

// Document type row
function DocumentRow({ doc }: { doc: TaxDocument }) {
    const statusColors = {
        pending: 'bg-yellow-500/20 text-yellow-400',
        available: 'bg-green-500/20 text-green-400',
        submitted: 'bg-blue-500/20 text-blue-400'
    };

    const statusIcons = {
        pending: Clock,
        available: CheckCircle,
        submitted: FileText
    };

    const StatusIcon = statusIcons[doc.status];

    return (
        <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
            <div className="p-2 rounded-lg bg-slate-600/50">
                <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
                <div className="text-white font-medium">{doc.type}</div>
                <div className="text-sm text-slate-400">Tax Year {doc.year}</div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[doc.status]}`}>
                <StatusIcon className="h-3 w-3" />
                {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
            </div>
            {doc.status === 'available' && (
                <Button variant="secondary" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                </Button>
            )}
        </div>
    );
}

// Currency selector
function CurrencySelector({
    value,
    onChange
}: {
    value: string;
    onChange: (code: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
        >
            {currencyOptions.map((c) => (
                <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} - {c.name}
                </option>
            ))}
        </select>
    );
}

export function TaxCenter() {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [primaryCurrency, setPrimaryCurrency] = useState('USD');
    const [autoConvert, setAutoConvert] = useState(true);

    const { data, isLoading } = useQuery({
        queryKey: ['taxData', selectedYear],
        queryFn: fetchTaxData
    });

    const generateDocMutation = useMutation({
        mutationFn: async (docType: string) => {
            const res = await fetch('/api/v1/tax/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type: docType, year: selectedYear })
            });
            return res.json();
        }
    });

    // Mock data
    const mockData: TaxSummary = {
        year: selectedYear,
        total_earnings: 42356.78,
        platform_fees: 4235.68,
        net_earnings: 38121.10,
        estimated_tax: 7624.22,
        payouts_count: 24,
        documents: [
            { id: 1, type: '1099-K', year: 2024, status: 'available', download_url: '#' },
            { id: 2, type: 'W-9', year: 2024, status: 'submitted' },
            { id: 3, type: '1099-NEC', year: 2023, status: 'available', download_url: '#' }
        ]
    };

    const taxData = data || mockData;

    // Exchange rates (mock)
    const exchangeRates: Record<string, number> = {
        USD: 1,
        EUR: 0.92,
        GBP: 0.79,
        CAD: 1.35,
        AUD: 1.53,
        JPY: 149.50,
        BRL: 4.97,
        MXN: 17.15
    };

    const formatCurrency = (amount: number, currency: string = primaryCurrency) => {
        const converted = amount * (exchangeRates[currency] || 1);
        const curr = currencyOptions.find(c => c.code === currency);
        return `${curr?.symbol || '$'}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <h1 className="sr-only">Tax Center</h1>
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading tax information...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="h-6 w-6 text-purple-400" />
                        Tax Center
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage your tax documents and financial settings</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    >
                        {[2024, 2023, 2022].map((year) => (
                            <option key={year} value={year}>Tax Year {year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tax filing reminder */}
            <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 p-4">
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1">
                        <div className="text-white font-medium">Tax Filing Reminder</div>
                        <div className="text-sm text-slate-400">
                            US tax deadline: April 15, 2025. Make sure to download your 1099-K if you earned over $600.
                        </div>
                    </div>
                    <Button variant="secondary" size="sm">
                        <Calendar className="h-4 w-4 mr-1" />
                        Set Reminder
                    </Button>
                </div>
            </Card>

            {/* Earnings summary */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    {selectedYear} Earnings Summary
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="text-slate-400 text-xs mb-1">Total Earnings</div>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(taxData.total_earnings)}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="text-slate-400 text-xs mb-1">Platform Fees (10%)</div>
                        <div className="text-xl font-bold text-orange-400">
                            -{formatCurrency(taxData.platform_fees)}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="text-slate-400 text-xs mb-1">Net Earnings</div>
                        <div className="text-2xl font-bold text-green-400">
                            {formatCurrency(taxData.net_earnings)}
                        </div>
                    </div>
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                        <div className="text-slate-400 text-xs mb-1">Est. Tax (20%)</div>
                        <div className="text-xl font-bold text-blue-400">
                            ~{formatCurrency(taxData.estimated_tax)}
                        </div>
                    </div>
                </div>
                <div className="mt-4 text-xs text-slate-500 flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    Based on {taxData.payouts_count} payouts. Consult a tax professional for accurate calculations.
                </div>
            </Card>

            {/* Tax documents */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FileText className="h-5 w-5 text-purple-400" />
                        Tax Documents
                    </h2>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => generateDocMutation.mutate('W-9')}
                    >
                        <Upload className="h-4 w-4 mr-1" />
                        Submit W-9
                    </Button>
                </div>
                <div className="space-y-3">
                    {taxData.documents.map((doc: TaxDocument) => (
                        <DocumentRow key={doc.id} doc={doc} />
                    ))}
                </div>
                {taxData.documents.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                        No tax documents available for {selectedYear}
                    </div>
                )}
            </Card>

            {/* Multi-currency settings */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-400" />
                    Currency Settings
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div>
                            <div className="text-white font-medium">Primary Display Currency</div>
                            <div className="text-sm text-slate-400">All earnings will be displayed in this currency</div>
                        </div>
                        <CurrencySelector value={primaryCurrency} onChange={setPrimaryCurrency} />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                        <div>
                            <div className="text-white font-medium">Auto-Convert on Payout</div>
                            <div className="text-sm text-slate-400">Automatically convert payouts to your local currency</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoConvert}
                                onChange={(e) => setAutoConvert(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                    </div>
                    {primaryCurrency !== 'USD' && (
                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="text-sm text-blue-300 flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Current rate: 1 USD = {exchangeRates[primaryCurrency]} {primaryCurrency}
                                <span className="text-xs text-blue-400/70">(Updated hourly)</span>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-4">
                <button className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-purple-500/50 transition-colors text-left">
                    <Building className="h-5 w-5 text-slate-400" />
                    <div className="flex-1">
                        <div className="text-white font-medium">Business Settings</div>
                        <div className="text-xs text-slate-500">Update business info</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
                <button className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-purple-500/50 transition-colors text-left">
                    <DollarSign className="h-5 w-5 text-slate-400" />
                    <div className="flex-1">
                        <div className="text-white font-medium">Payout History</div>
                        <div className="text-xs text-slate-500">View all transactions</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
            </div>
        </div>
    );
}

export default TaxCenter;
