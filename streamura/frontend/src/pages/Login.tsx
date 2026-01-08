import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { LanguageSelector } from '@/components/common/LanguageSelector';

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const { login, loginAnonymous, isLoading, error, clearError } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(identifier, password);
      navigate('/discover');
    } catch {
      // Error is handled by the store
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      await loginAnonymous();
      navigate('/discover');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader>
          <div className="flex flex-col items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-white">
              <Radio className="h-10 w-10 text-primary-500" />
              <span className="text-2xl font-bold">Streamura</span>
            </Link>
            <h1 className="text-xl font-semibold text-white">{t('login.title')}</h1>
            <p className="text-slate-400 text-center">
              {t('login.subtitle')}
            </p>
            <LanguageSelector />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="identifier"
              label={t('login.emailPlaceholder')}
              type="text"
              placeholder={t('login.emailPlaceholder')}
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                clearError();
              }}
              required
            />

            <Input
              id="password"
              label={t('login.passwordPlaceholder')}
              type="password"
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError();
              }}
              required
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" className="rounded border-slate-600" />
                {t('login.rememberMe')}
              </label>
              <Link to="/forgot-password" className="text-primary-400 hover:text-primary-300">
                {t('login.forgotPassword')}
              </Link>
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              {t('login.submitButton')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            size="lg"
            onClick={handleAnonymousLogin}
            isLoading={isLoading}
          >
            Continue as Guest
          </Button>

          <p className="text-center text-slate-400 text-sm">
            {t('login.noAccount')}{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300">
              {t('login.signUpLink')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
