import { Link } from 'react-router-dom';
import { Compass, Home, Radio } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center" data-testid="not-found">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center">
            <Radio className="w-8 h-8 text-primary-400" />
          </div>
        </div>
        <p className="text-6xl font-bold text-primary-400 mb-2">404</p>
        <h1 className="text-2xl font-semibold mb-3">Page not found</h1>
        <p className="text-slate-400 mb-8">
          The page you're looking for doesn't exist or may have moved. Let's get you
          back to the action.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors font-medium"
          >
            <Home className="w-4 h-4" />
            Go home
          </Link>
          <Link
            to="/discover"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors font-medium"
          >
            <Compass className="w-4 h-4" />
            Discover events
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
