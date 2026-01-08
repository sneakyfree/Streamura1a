import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone_number: '',
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState('');

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
    clearError();
    setValidationError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }

    try {
      await register({
        username: formData.username || undefined,
        email: formData.email || undefined,
        phone_number: formData.phone_number || undefined,
        password: formData.password,
      });
      navigate('/discover');
    } catch {
      // Error is handled by the store
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md" variant="elevated">
        <CardHeader>
          <div className="flex flex-col items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-white">
              <Radio className="h-10 w-10 text-primary-500" />
              <span className="text-2xl font-bold">Streamura</span>
            </Link>
            <h1 className="text-xl font-semibold text-white">Create your account</h1>
            <p className="text-slate-400 text-center">
              Join the global live event network
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {displayError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="username"
              label="Username"
              type="text"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleChange('username')}
            />

            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange('email')}
            />

            <Input
              id="phone"
              label="Phone number (optional)"
              type="tel"
              placeholder="+1 234 567 8900"
              value={formData.phone_number}
              onChange={handleChange('phone_number')}
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Create a password (min 8 characters)"
              value={formData.password}
              onChange={handleChange('password')}
              required
            />

            <Input
              id="confirmPassword"
              label="Confirm password"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              required
            />

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                className="mt-1 rounded border-slate-600"
                required
              />
              <label htmlFor="terms" className="text-sm text-slate-300">
                I agree to the{' '}
                <Link to="/terms" className="text-primary-400 hover:text-primary-300">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-primary-400 hover:text-primary-300">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <p className="text-center text-slate-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
