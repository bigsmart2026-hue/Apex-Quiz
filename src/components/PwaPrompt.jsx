import { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles, X } from 'lucide-react';
import { applyServiceWorkerUpdate, promptInstall } from '../pwa/registerServiceWorker';

const DISMISS_KEY = 'apex-quiz-install-dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function PwaPrompt() {
  const [updateWorker, setUpdateWorker] = useState(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onUpdate = (event) => {
      setUpdateWorker(event.detail?.worker ?? null);
      setUpdateVisible(true);
    };
    const onInstall = () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') return;
      } catch {
        // storage unavailable
      }
      setInstallVisible(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallVisible(false);
    };

    window.addEventListener('pwa:update-available', onUpdate);
    window.addEventListener('pwa:install-available', onInstall);
    window.addEventListener('pwa:installed', onInstalled);

    return () => {
      window.removeEventListener('pwa:update-available', onUpdate);
      window.removeEventListener('pwa:install-available', onInstall);
      window.removeEventListener('pwa:installed', onInstalled);
    };
  }, []);

  const dismissInstall = () => {
    setInstallVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // storage unavailable
    }
  };

  const handleUpdate = () => {
    setBusy(true);
    applyServiceWorkerUpdate(updateWorker);
  };

  const handleInstall = async () => {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === 'accepted') {
      setInstalled(true);
      setInstallVisible(false);
    } else if (outcome === 'unavailable') {
      setInstallVisible(false);
    }
  };

  const showUpdate = updateVisible;
  const showInstall = !showUpdate && installVisible && !installed;

  if (!showUpdate && !showInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[190] w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-white p-3.5 shadow-xl dark:bg-slate-800">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
          {showUpdate ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {showUpdate ? 'Update available' : 'Install Apex Quiz'}
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {showUpdate
              ? 'Reload to get the latest version.'
              : 'Add it to your home screen for faster access and offline play.'}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={showUpdate ? handleUpdate : handleInstall}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60 cursor-pointer"
            >
              {showUpdate ? <RefreshCw className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
              {showUpdate ? 'Reload' : 'Install'}
            </button>
            <button
              type="button"
              onClick={showUpdate ? () => setUpdateVisible(false) : dismissInstall}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={showUpdate ? () => setUpdateVisible(false) : dismissInstall}
          aria-label="Dismiss"
          className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
