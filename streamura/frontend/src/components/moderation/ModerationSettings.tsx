import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  Settings,
  Clock,
  Link,
  MessageSquare,
  Users,
  Ban,
  Plus,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { moderationApi, type StreamModerationSettings } from '@/lib/api';

interface ModerationSettingsProps {
  streamId: number;
  className?: string;
  onSettingsChange?: (settings: StreamModerationSettings) => void;
}

type ModerationLevel = 'off' | 'relaxed' | 'standard' | 'strict';

const MODERATION_LEVELS: { value: ModerationLevel; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No automatic moderation' },
  { value: 'relaxed', label: 'Relaxed', description: 'Block critical content only' },
  { value: 'standard', label: 'Standard', description: 'Balanced moderation (recommended)' },
  { value: 'strict', label: 'Strict', description: 'Maximum filtering' },
];

export function ModerationSettings({
  streamId,
  className = '',
  onSettingsChange,
}: ModerationSettingsProps) {
  const [, setSettings] = useState<StreamModerationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newWord, setNewWord] = useState('');

  // Local form state
  const [moderationLevel, setModerationLevel] = useState<ModerationLevel>('standard');
  const [allowLinks, setAllowLinks] = useState(true);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  const [subscriberOnly, setSubscriberOnly] = useState(false);
  const [followerOnlyMinutes, setFollowerOnlyMinutes] = useState(0);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [capsPercent, setCapsPercent] = useState(70);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await moderationApi.getStreamSettings(streamId);
      setSettings(data);

      // Update local state
      setModerationLevel(data.moderation_level);
      setAllowLinks(data.allow_links);
      setSlowModeSeconds(data.slow_mode_seconds);
      setSubscriberOnly(data.subscriber_only);
      setFollowerOnlyMinutes(data.follower_only_minutes);
      setBlockedWords(data.blocked_words || []);
      setCapsPercent(data.auto_mod_caps_percent);

      setError(null);
    } catch {
      // Settings may not exist yet, use defaults
      setModerationLevel('standard');
      setAllowLinks(true);
      setSlowModeSeconds(0);
      setSubscriberOnly(false);
      setFollowerOnlyMinutes(0);
      setBlockedWords([]);
      setCapsPercent(70);
    } finally {
      setIsLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const updatedSettings = await moderationApi.updateStreamSettings(streamId, {
        moderation_level: moderationLevel,
        allow_links: allowLinks,
        slow_mode_seconds: slowModeSeconds,
        subscriber_only: subscriberOnly,
        follower_only_minutes: followerOnlyMinutes,
        blocked_words: blockedWords.length > 0 ? blockedWords : null,
        auto_mod_caps_percent: capsPercent,
      });

      setSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const addBlockedWord = () => {
    const word = newWord.trim().toLowerCase();
    if (word && !blockedWords.includes(word)) {
      setBlockedWords([...blockedWords, word]);
      setNewWord('');
    }
  };

  const removeBlockedWord = (word: string) => {
    setBlockedWords(blockedWords.filter((w) => w !== word));
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Chat Moderation
        </h3>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Moderation Level */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Settings className="w-4 h-4" />
            Moderation Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MODERATION_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setModerationLevel(level.value)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  moderationLevel === level.value
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-sm">{level.label}</div>
                <div className="text-xs text-slate-400 mt-1">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Slow Mode */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Clock className="w-4 h-4" />
            Slow Mode (seconds between messages)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={300}
              value={slowModeSeconds}
              onChange={(e) => setSlowModeSeconds(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-24"
            />
            <span className="text-sm text-slate-400">
              {slowModeSeconds === 0 ? 'Disabled' : `${slowModeSeconds}s cooldown`}
            </span>
          </div>
        </div>

        {/* Allow Links */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Link className="w-4 h-4" />
            Allow Links
          </label>
          <button
            onClick={() => setAllowLinks(!allowLinks)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              allowLinks ? 'bg-blue-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                allowLinks ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Caps Filter */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <MessageSquare className="w-4 h-4" />
            Block messages with excessive caps (%)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={capsPercent}
              onChange={(e) =>
                setCapsPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))
              }
              className="w-24"
            />
            <span className="text-sm text-slate-400">
              {capsPercent === 0 ? 'Disabled' : `Block if >${capsPercent}% caps`}
            </span>
          </div>
        </div>

        {/* Subscriber/Follower Only */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Users className="w-4 h-4" />
              Subscriber Only Chat
            </label>
            <button
              onClick={() => setSubscriberOnly(!subscriberOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                subscriberOnly ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  subscriberOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">Follower-Only Mode (minutes)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={1440}
                value={followerOnlyMinutes}
                onChange={(e) =>
                  setFollowerOnlyMinutes(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-24"
              />
              <span className="text-sm text-slate-400">
                {followerOnlyMinutes === 0
                  ? 'Disabled'
                  : `Must follow for ${followerOnlyMinutes}m`}
              </span>
            </div>
          </div>
        </div>

        {/* Blocked Words */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Ban className="w-4 h-4" />
            Blocked Words
          </label>

          <div className="flex gap-2">
            <Input
              placeholder="Add word to block..."
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBlockedWord()}
              className="flex-1"
            />
            <Button onClick={addBlockedWord} variant="secondary" size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {blockedWords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockedWords.map((word) => (
                <span
                  key={word}
                  className="px-2 py-1 bg-slate-700 rounded-full text-sm text-slate-300 flex items-center gap-1"
                >
                  {word}
                  <button
                    onClick={() => removeBlockedWord(word)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {blockedWords.length === 0 && (
            <p className="text-xs text-slate-500">
              No custom blocked words. Global filters still apply.
            </p>
          )}
        </div>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>

        {/* Info Text */}
        <p className="text-xs text-slate-500 text-center">
          These settings apply to chat in this stream. Global moderation rules are managed by
          administrators.
        </p>
      </CardContent>
    </Card>
  );
}
