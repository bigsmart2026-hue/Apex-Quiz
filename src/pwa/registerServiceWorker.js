let registration = null;
let deferredInstallPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    window.dispatchEvent(new CustomEvent('pwa:install-available'));
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa:installed'));
  });
}

function announceUpdate(worker) {
  window.dispatchEvent(new CustomEvent('pwa:update-available', { detail: { worker } }));
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) {
    return;
  }

  const start = async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      if (registration.waiting && navigator.serviceWorker.controller) {
        announceUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration?.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate(worker);
          }
        });
      });

      const checkForUpdates = () => {
        if (document.visibilityState === 'visible') {
          registration?.update().catch(() => {});
        }
      };

      document.addEventListener('visibilitychange', checkForUpdates);
      window.setInterval(checkForUpdates, 60 * 60 * 1000);
    } catch {
      registration = null;
    }
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
}

export function applyServiceWorkerUpdate(worker) {
  const waiting = worker || registration?.waiting;

  if (!waiting) {
    window.location.reload();
    return;
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    },
    { once: true }
  );

  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function hasInstallPrompt() {
  return Boolean(deferredInstallPrompt);
}

export async function promptInstall() {
  if (!deferredInstallPrompt) return 'unavailable';

  const event = deferredInstallPrompt;
  deferredInstallPrompt = null;
  event.prompt();

  const { outcome } = await event.userChoice;
  return outcome;
}
