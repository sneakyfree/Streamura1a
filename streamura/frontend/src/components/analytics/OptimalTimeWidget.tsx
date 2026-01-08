import { useState } from 'react';
import { Clock, Calendar, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface OptimalTime {
  day_of_week: number;
  day_name: string;
  hour_utc: number;
  score: number;
  expected_viewers: number | null;
  competition_level: string | null;
  confidence: number;
}

interface OptimalTimeWidgetProps {
  optimalTimes: OptimalTime[];
  isLoading?: boolean;
  category?: string;
  onCategoryChange?: (category: string | null) => void;
  className?: string;
}

const categories = [
  { value: null, label: 'All Categories' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Just Chatting', label: 'Just Chatting' },
  { value: 'Music', label: 'Music' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Education', label: 'Education' },
];

function formatHour(hourUtc: number, userTimezone?: string): string {
  const date = new Date();
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: userTimezone,
  });
}

function getCompetitionColor(level: string | null): string {
  switch (level) {
    case 'low':
      return 'text-green-400 bg-green-400/10';
    case 'medium':
      return 'text-yellow-400 bg-yellow-400/10';
    case 'high':
      return 'text-red-400 bg-red-400/10';
    default:
      return 'text-slate-400 bg-slate-400/10';
  }
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500';
  if (score >= 0.6) return 'bg-yellow-500';
  if (score >= 0.4) return 'bg-orange-500';
  return 'bg-red-500';
}

export function OptimalTimeWidget({
  optimalTimes,
  isLoading = false,
  category,
  onCategoryChange,
  className = '',
}: OptimalTimeWidgetProps) {
  const [showAll, setShowAll] = useState(false);

  const displayTimes = showAll ? optimalTimes : optimalTimes.slice(0, 5);
  const bestTime = optimalTimes[0];

  if (isLoading) {
    return (
      <Card className={`bg-slate-800/50 border-slate-700 ${className}`} variant="elevated">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-semibold text-white">Best Times to Stream</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${className}`} variant="elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-400" />
            <h3 className="text-lg font-semibold text-white">Best Times to Stream</h3>
          </div>
          {onCategoryChange && (
            <select
              value={category || ''}
              onChange={(e) => onCategoryChange(e.target.value || null)}
              className="bg-slate-700 border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-primary-500 focus:border-primary-500"
            >
              {categories.map((cat) => (
                <option key={cat.value || 'all'} value={cat.value || ''}>
                  {cat.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {optimalTimes.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">
              Not enough streaming data yet. Start streaming to get personalized recommendations!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Best time highlight */}
            {bestTime && (
              <div className="bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary-400" />
                  <span className="text-sm font-medium text-primary-400">Top Recommendation</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {bestTime.day_name} at {formatHour(bestTime.hour_utc)}
                    </div>
                    <div className="text-sm text-slate-400">
                      {bestTime.expected_viewers
                        ? `~${bestTime.expected_viewers} expected viewers`
                        : 'Based on your streaming patterns'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-400">
                      {Math.round(bestTime.score * 100)}%
                    </div>
                    <div className="text-xs text-slate-400">success score</div>
                  </div>
                </div>
              </div>
            )}

            {/* Time slots list */}
            <div className="space-y-2">
              {displayTimes.map((time, index) => (
                <div
                  key={`${time.day_of_week}-${time.hour_utc}`}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-semibold text-slate-400 w-6">
                      #{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-white">{time.day_name}</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {formatHour(time.hour_utc)} UTC
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {time.expected_viewers && (
                      <div className="flex items-center gap-1 text-sm text-slate-400">
                        <Users className="h-4 w-4" />
                        <span>~{time.expected_viewers}</span>
                      </div>
                    )}
                    {time.competition_level && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getCompetitionColor(
                          time.competition_level
                        )}`}
                      >
                        {time.competition_level} competition
                      </span>
                    )}
                    <div className="w-16">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-400">Score</span>
                        <span className="text-white font-medium">
                          {Math.round(time.score * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${getScoreColor(time.score)}`}
                          style={{ width: `${time.score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {optimalTimes.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show Less' : `Show All ${optimalTimes.length} Times`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
