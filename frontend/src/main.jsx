import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.jsx';
import '@/index.css';

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches any synchronous render error in the entire tree.
// Without this, a crash shows a blank white page with no hint of what went wrong.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const clearAndReload = () => {
        // Clear module-level localStorage keys that could be corrupted.
        // Auth tokens (refreshToken) are left intact so the user stays logged in.
        const keys = Object.keys(localStorage).filter(k =>
          k.startsWith('module_totals_') ||
          k === 'scenario_comparison' ||
          k === 'hvac_changelog' ||
          k === 'rfq_suppliers' ||
          k === 'rfq_rfqs' ||
          k === 'rfq_quotes' ||
          k === 'sidebar_estimating_order' ||
          k === 'demo_mode'
        );
        keys.forEach(k => localStorage.removeItem(k));
        window.location.reload();
      };

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          padding: '2rem',
          fontFamily: 'sans-serif',
        }}>
          <div style={{
            background: '#fff',
            border: '1px solid #fca5a5',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '560px',
            width: '100%',
          }}>
            <h2 style={{ color: '#dc2626', margin: '0 0 .5rem' }}>Something went wrong</h2>
            <p style={{ color: '#6b7280', margin: '0 0 1rem' }}>
              The app crashed. This is usually caused by corrupted data in browser
              storage. Click the button below to clear app data, then try again.
            </p>
            <button
              onClick={clearAndReload}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '.6rem 1.2rem',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Clear app data and reload
            </button>
            <details style={{ marginTop: '1rem', fontSize: '12px', color: '#9ca3af' }}>
              <summary style={{ cursor: 'pointer' }}>Error details</summary>
              <pre style={{ marginTop: '.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
