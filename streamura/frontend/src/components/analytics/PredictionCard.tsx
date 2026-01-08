import { TrendingUp, Users, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

interface PredictionData {
  prediction_type: string;
  predicted_value: number;
  confidence: number;
  range_low: number;
  range_high: number;
  model_version: string;
}

interface PredictionCardProps {
  prediction: PredictionData;
  className?: string;
}

const predictionIcons: Record<string, typeof TrendingUp> = {
  peak_viewers: Users,
  engagement: TrendingUp,
  duration: Clock,
  revenue: DollarSign,
};

const predictionTitles: Record<string, string> = {
  peak_viewers: 'Peak Viewers',
  engagement: 'Engagement Rate',
  duration: 'Stream Duration',
  revenue: 'Expected Tips',
};


function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatValue(type: string, value: number): string {
  switch (type) {
    case 'duration':
      return formatDuration(value);
    case 'revenue':
      return `$${value.toFixed(2)}`;
    case 'engagement':
      return `${value.toFixed(1)}%`;
    case 'peak_viewers':
      return Math.round(value).toLocaleString();
    default:
      return value.toString();
  }
}

function formatRange(type: string, low: number, high: number): string {
  switch (type) {
    case 'duration':
      return `${formatDuration(low)} - ${formatDuration(high)}`;
    case 'revenue':
      return `$${low.toFixed(2)} - $${high.toFixed(2)}`;
    case 'engagement':
      return `${low.toFixed(1)}% - ${high.toFixed(1)}%`;
    case 'peak_viewers':
      return `${Math.round(low).toLocaleString()} - ${Math.round(high).toLocaleString()}`;
    default:
      return `${low} - ${high}`;
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-400';
  if (confidence >= 0.5) return 'text-yellow-400';
  return 'text-orange-400';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}

export function PredictionCard({ prediction, className = '' }: PredictionCardProps) {
  const Icon = predictionIcons[prediction.prediction_type] || TrendingUp;
  const title = predictionTitles[prediction.prediction_type] || prediction.prediction_type;
  const confidenceColor = getConfidenceColor(prediction.confidence);
  const confidenceLabel = getConfidenceLabel(prediction.confidence);

  return (
    <Card className={`bg-slate-800/50 border-slate-700 ${className}`} variant="elevated">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <Icon className="h-5 w-5 text-primary-400" />
            </div>
            <h3 className="text-sm font-medium text-slate-300">{title}</h3>
          </div>
          <div className={`text-xs ${confidenceColor} flex items-center gap-1`}>
            <AlertCircle className="h-3 w-3" />
            {confidenceLabel} confidence
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-3xl font-bold text-white">
            {formatValue(prediction.prediction_type, prediction.predicted_value)}
          </div>
          <div className="text-sm text-slate-400">
            Expected range: {formatRange(prediction.prediction_type, prediction.range_low, prediction.range_high)}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary-500 to-accent-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${prediction.confidence * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{Math.round(prediction.confidence * 100)}% confidence</span>
            <span>v{prediction.model_version}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
