import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level error boundary. Catches render-time exceptions anywhere in the
 * tree and shows a recoverable fallback instead of white-screening the SPA.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console (and, when wired, Sentry) for diagnostics.
    console.error('Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-semibold text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. You can try again or reload the page.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-slate-500 bg-slate-800 rounded p-3 mb-6 overflow-auto text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.assign('/')}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
