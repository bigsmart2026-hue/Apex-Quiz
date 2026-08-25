import { Component } from 'react';
import { motion } from 'framer-motion';

/**
 * Catches render errors anywhere in the tree and shows a
 * recoverable fallback instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4 shadow-sm">
            <h1 className="text-2xl font-heading text-slate-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An unexpected error occurred. Your progress is safe — reload to continue.
            </p>
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