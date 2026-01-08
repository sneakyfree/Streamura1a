import { Loader2 } from 'lucide-react';
import { EventCard } from './EventCard';
import type { Event } from '@/types';

interface EventGridProps {
  events: Event[];
  isLoading?: boolean;
  emptyMessage?: string;
  showTrending?: boolean;
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'compact';
}

export function EventGrid({
  events,
  isLoading = false,
  emptyMessage = 'No events found',
  showTrending = false,
  columns = 3,
  variant = 'default',
}: EventGridProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            showTrending={showTrending}
            variant="compact"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-6`}>
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          showTrending={showTrending}
        />
      ))}
    </div>
  );
}
