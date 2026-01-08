import { useState } from 'react';
import { X, DollarSign, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { tipApi, type TipResponse } from '@/lib/api';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: number;
  creatorName: string;
  onSuccess?: (response: TipResponse) => void;
}

const TIP_AMOUNTS = [1, 5, 10, 25, 50, 100];

export function TipModal({ isOpen, onClose, streamId, creatorName, onSuccess }: TipModalProps) {
  const [amount, setAmount] = useState<number>(5);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const effectiveAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleSubmit = async () => {
    if (!effectiveAmount || effectiveAmount < 1 || effectiveAmount > 500) {
      setError('Tip amount must be between $1 and $500');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await tipApi.sendTip({
        stream_id: streamId,
        amount: effectiveAmount,
        message: message || undefined,
      });

      onSuccess?.(response);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process tip';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <Card className="relative z-10 w-full max-w-md mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-white">Send a Tip</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-slate-400 text-sm">
            Support <span className="text-white font-medium">{creatorName}</span> with a tip
          </p>

          {/* Preset Amounts */}
          <div className="grid grid-cols-3 gap-2">
            {TIP_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setAmount(preset);
                  setCustomAmount('');
                }}
                className={`py-2 px-3 rounded-lg font-medium transition-colors ${
                  amount === preset && !customAmount
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Custom Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                min="1"
                max="500"
                step="0.01"
                placeholder="Enter amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full pl-7 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Message (optional)</label>
            <textarea
              placeholder="Add a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">{message.length}/200 characters</p>
          </div>

          {/* Summary */}
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Tip Amount</span>
              <span className="text-white font-medium">${effectiveAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-slate-400">Creator receives (70%)</span>
              <span className="text-green-400">${(effectiveAmount * 0.7).toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={!effectiveAmount || effectiveAmount < 1}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Send className="w-4 h-4 mr-2" />
            Send ${effectiveAmount.toFixed(2)}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
