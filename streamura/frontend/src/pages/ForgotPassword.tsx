import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { api } from '@/lib/api';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/password-reset/request', { email });
      setSubmitted(true);
    } catch (err: unknown) {
      console.error('Password reset request failed:', err);
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <h1 className="sr-only">{t('auth.forgotPassword.title', 'Reset your password')}</h1>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <CardTitle>{t('auth.forgotPassword.checkEmail', 'Check your email')}</CardTitle>
            <CardDescription>
              {t('auth.forgotPassword.emailSent', "We've sent a password reset link to your email")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t('auth.forgotPassword.noEmail', "Didn't receive the email? Check your spam folder or try again.")}
            </p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              {t('auth.forgotPassword.tryAgain', 'Try another email')}
            </Button>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-primary hover:underline">
              <ArrowLeft className="inline h-4 w-4 mr-1" />
              {t('auth.forgotPassword.backToLogin', 'Back to login')}
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <h1 className="sr-only">{t('auth.forgotPassword.title', 'Reset your password')}</h1>
      {/* Language selector */}
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t('auth.forgotPassword.title', 'Reset your password')}</CardTitle>
          <CardDescription>
            {t('auth.forgotPassword.description', "Enter your email and we'll send you a link to reset your password")}
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
              <Label htmlFor="email">{t('auth.forgotPassword.emailLabel', 'Email address')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.forgotPassword.emailPlaceholder', 'Enter your email')}
                required
                autoFocus
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('auth.forgotPassword.sending', 'Sending...')}
                </>
              ) : (
                t('auth.forgotPassword.sendButton', 'Send reset link')
              )}
            </Button>

            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="inline h-4 w-4 mr-1" />
              {t('auth.forgotPassword.backToLogin', 'Back to login')}
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default ForgotPasswordPage;
