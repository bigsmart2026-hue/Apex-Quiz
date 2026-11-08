/**
 * Maps Firebase Auth error codes to messages that make sense to users.
 * Returns `null` for cancellations (no message should be shown).
 */
export function getAuthErrorMessage(err) {
  const code = err?.code || '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
    return null;
  }

  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
  }

  if (code === 'auth/operation-not-supported-in-this-environment') {
    return 'Google sign-in is not supported in this browser. Try opening the app in Chrome or Safari.';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'Google sign-in is not authorized for this domain. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
  }

  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled. Enable the Google provider in Firebase Console → Authentication → Sign-in method.';
  }

  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email using a different sign-in method. Sign in with that method instead.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (code.startsWith('auth/api-key-not-valid') || code === 'auth/invalid-api-key') {
    return 'Firebase is misconfigured (invalid API key). Check the VITE_FIREBASE_* environment variables.';
  }

  if (code === 'auth/internal-error') {
    return 'Sign-in failed due to an internal error. Please try again.';
  }

  if (code === 'auth/web-storage-unsupported') {
    return 'Your browser blocks the storage required for sign-in. Enable cookies and site data, then try again.';
  }

  return err?.message || 'Sign-in failed. Please try again.';
}

/**
 * Use the redirect flow on touch/mobile browsers and installed PWAs, where
 * popups are frequently blocked or lose the Firebase session.
 */
export function shouldUseRedirectFlow() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Opera Mini/i.test(ua);
  const standalone =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches;
  return mobile || Boolean(standalone);
}
