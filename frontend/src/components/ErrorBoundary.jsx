import React from 'react';

/**
 * ErrorBoundary — catches JS errors in any child component tree and shows
 * a recovery UI instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeModule />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<p>Something broke.</p>}>
 *     <SomeModule />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in dev; swap for a real error reporting service in prod
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-red-500 text-xl">!</span>
        </div>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-5 max-w-sm">
          This section ran into an unexpected error. The rest of the app is unaffected.
        </p>
        <button
          onClick={this.handleReset}
          className="btn-primary px-4 py-2 text-sm"
        >
          Try again
        </button>
        {process.env.NODE_ENV !== 'production' && this.state.error && (
          <pre className="mt-6 text-left text-xs text-red-400 bg-red-50 rounded-lg p-4 max-w-xl overflow-auto">
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    );
  }
}
