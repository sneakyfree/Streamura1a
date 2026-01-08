import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TipModal } from './TipModal';
import type { TipResponse } from '@/lib/api';

interface TipButtonProps {
  streamId: number;
  creatorName: string;
  disabled?: boolean;
  onTipSuccess?: (response: TipResponse) => void;
}

export function TipButton({ streamId, creatorName, disabled, onTipSuccess }: TipButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
      >
        <DollarSign className="w-4 h-4 mr-1" />
        Tip
      </Button>

      <TipModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        streamId={streamId}
        creatorName={creatorName}
        onSuccess={onTipSuccess}
      />
    </>
  );
}
