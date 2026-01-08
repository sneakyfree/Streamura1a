import { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { transactionApi, type Transaction } from '@/lib/api';

interface TransactionListProps {
  className?: string;
  limit?: number;
}

const TRANSACTION_ICONS: Record<string, React.ElementType> = {
  tip_received: ArrowDownLeft,
  tip_sent: ArrowUpRight,
  stream_earning: ArrowDownLeft,
  ad_revenue: ArrowDownLeft,
  payout_requested: ArrowUpRight,
  payout_completed: ArrowUpRight,
};

const TRANSACTION_COLORS: Record<string, string> = {
  tip_received: 'text-green-400',
  tip_sent: 'text-red-400',
  stream_earning: 'text-green-400',
  ad_revenue: 'text-blue-400',
  payout_requested: 'text-yellow-400',
  payout_completed: 'text-green-400',
};

const TRANSACTION_LABELS: Record<string, string> = {
  tip_received: 'Tip Received',
  tip_sent: 'Tip Sent',
  stream_earning: 'Stream Earning',
  ad_revenue: 'Ad Revenue',
  payout_requested: 'Payout Pending',
  payout_completed: 'Payout Completed',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  processing: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

export function TransactionList({ className = '', limit = 10 }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      const data = await transactionApi.getAll(limit);
      setTransactions(data);
      setError(null);
    } catch {
      setError('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [limit]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-red-400">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <h3 className="font-semibold text-white">Transaction History</h3>
        <button
          onClick={fetchTransactions}
          className="p-1 rounded hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </CardHeader>

      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            No transactions yet
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {transactions.map((transaction) => {
              const Icon = TRANSACTION_ICONS[transaction.transaction_type] || ArrowDownLeft;
              const StatusIcon = STATUS_ICONS[transaction.status] || Clock;
              const iconColor = TRANSACTION_COLORS[transaction.transaction_type] || 'text-slate-400';
              const statusColor = STATUS_COLORS[transaction.status] || 'text-slate-400';
              const label = TRANSACTION_LABELS[transaction.transaction_type] || transaction.transaction_type;
              const isPositive = ['tip_received', 'stream_earning', 'ad_revenue'].includes(transaction.transaction_type);

              return (
                <div key={transaction.id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`p-2 rounded-lg bg-slate-700/50 ${iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{label}</p>
                    {transaction.description && (
                      <p className="text-xs text-slate-400 truncate">{transaction.description}</p>
                    )}
                    <p className="text-xs text-slate-500">{formatDate(transaction.created_at)}</p>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : '-'}${Math.abs(transaction.net_amount || transaction.amount).toFixed(2)}
                    </p>
                    <div className={`flex items-center justify-end gap-1 ${statusColor}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span className="text-xs capitalize">{transaction.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
