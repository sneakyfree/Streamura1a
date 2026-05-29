import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { api } from '@/lib/api';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords
    if (password !== confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.resetPassword.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/password-reset/confirm', {
        token,
        new_password: password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      console.error('Password reset failed:', err);
      const errorMessage = err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to reset password'
        : 'Failed to reset password. The link may have expired.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <h1 className="sr-only">{t('auth.resetPassword.heading', 'Reset password')}</h1>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{t('auth.resetPassword.invalidLink', 'Invalid reset link')}</CardTitle>
            <CardDescription>
              {t('auth.resetPassword.invalidLinkDescription', 'This password reset link is invalid or has expired.')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/forgot-password">
              <Button>{t('auth.resetPassword.requestNew', 'Request a new link')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <h1 className="sr-only">{t('auth.resetPassword.heading', 'Reset password')}</h1>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>{t('auth.resetPassword.success', 'Password reset successful')}</CardTitle>
            <CardDescription>
              {t('auth.resetPassword.successDescription', 'Your password has been reset. You can now sign in with your new password.')}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button>{t('auth.resetPassword.goToLogin', 'Go to login')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <h1 className="sr-only">{t('auth.resetPassword.heading', 'Reset password')}</h1>
      {/* Language selector */}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('auth.resetPassword.title', 'Set new password')}</CardTitle>
          <CardDescription>
            {t('auth.resetPassword.description', 'Enter your new password below')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.resetPassword.newPassword', 'New password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.resetPassword.newPasswordPlaceholder', 'Enter new password')}
                required
                autoFocus
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                {t('auth.resetPassword.passwordRequirement', 'Must be at least 8 characters')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('auth.resetPassword.confirmPassword', 'Confirm password')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder', 'Confirm new password')}
                required
                minLength={8}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading || !password || !confirmPassword}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('auth.resetPassword.resetting', 'Resetting...')}
                </>
              ) : (
                t('auth.resetPassword.submitButton', 'Reset Password')
              )}
            </Button>

            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="inline h-4 w-4 mr-1" />
              {t('auth.resetPassword.backToLogin', 'Back to login')}
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default ResetPasswordPage;
