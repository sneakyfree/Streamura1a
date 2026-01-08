import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PredictionCard } from './PredictionCard';
import { api } from '@/lib/api';

interface PredictionData {
  prediction_type: string;
  predicted_value: number;
  confidence: number;
  range_low: number;
  range_high: number;
  model_version: string;
}

interface StreamPredictionsResponse {
  peak_viewers: PredictionData;
  engagement: PredictionData;
  duration: PredictionData;
  revenue: PredictionData;
  generated_at: string;
}

interface StreamPredictionsProps {
  category?: string;
  title?: string;
  tags?: string[];
  scheduledStart?: Date;
  onPredictionsLoaded?: (predictions: StreamPredictionsResponse) => void;
  className?: string;
}

export function StreamPredictions({
  category,
  title,
  tags,
  scheduledStart,
  onPredictionsLoaded,
  className = '',
}: StreamPredictionsProps) {
  const [predictions, setPredictions] = useState<StreamPredictionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchPredictions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<StreamPredictionsResponse>('/analytics/predictions', {
        category,
        title,
        tags,
        scheduled_start: scheduledStart?.toISOString(),
      });

      setPredictions(response.data);
      onPredictionsLoaded?.(response.data);
    } catch (err) {
      console.error('Failed to fetch predictions:', err);
      setError('Failed to generate predictions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount and when key params change
    fetchPredictions();
  }, [category]);

  const predictionsList = predictions
    ? [
        predictions.peak_viewers,
        predictions.engagement,
        predictions.duration,
        predictions.revenue,
      ]
    : [];

  // Calculate overall confidence
  const avgConfidence = predictions
    ? predictionsList.reduce((acc, p) => acc + p.confidence, 0) / predictionsList.length
    : 0;

  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${className}`} variant="elevated">
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-lg">
              <Sparkles className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Stream Predictions</h3>
              <p className="text-sm text-slate-400">
                AI-powered performance forecasts for your stream
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {predictions && (
              <div className="text-sm text-slate-400 mr-2">
                {Math.round(avgConfidence * 100)}% avg confidence
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fetchPredictions();
              }}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 bg-slate-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : predictions ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {predictionsList.map((prediction) => (
                  <PredictionCard key={prediction.prediction_type} prediction={prediction} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Generated at{' '}
                    {new Date(predictions.generated_at).toLocaleString()}
                  </span>
                  <span>
                    These predictions are based on your streaming history and current platform
                    trends
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                Click refresh to generate predictions for your stream
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
