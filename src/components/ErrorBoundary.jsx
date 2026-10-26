import { Component } from 'react';
import { motion } from 'framer-motion';

/**
 * Catches render errors anywhere in the tree and shows a
 * recoverable fallback instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const msg = err?.message || String(err);
      const isClipboard = msg?.includes('clipboard') || msg?.includes('Clipboard');
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4 shadow-sm">
            <h1 className="text-2xl font-heading text-slate-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An unexpected error occurred. Your progress is safe — reload to continue.
            </p>
            {msg && (
              <details className="text-left p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 overflow-auto max-h-40">
                <summary className="cursor-pointer font-semibold mb-1">Error details</summary>
                <pre className="whitespace-pre-wrap text-left">{msg}</pre>
                {isClipboard && (
                  <p className="mt-2 text-amber-700 dark:text-amber-400 text-xs">
                    This appears to be a clipboard API issue. It may be caused by a browser extension 
                    or running on HTTP instead of HTTPS. Try: disabling extensions, using HTTPS, 
                    or clicking the page before interacting.
                  </p>
                )}
              </details>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={this.handleReload}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Reload app
            </motion.button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}