import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase.config';
import useQuizStore from '../store/useQuizStore';
import { getAuthErrorMessage, shouldUseRedirectFlow } from '../utils/authErrors';

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

let redirectResultPromise = null;

const REDIRECT_PENDING_KEY = 'apex-quiz-auth-redirect';

function markRedirectPending() {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, '1');
  } catch {
    /* storage can be unavailable in private mode */
  }
}

function readRedirectPending() {
  try {
    return sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

function clearRedirectPending() {
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** `getRedirectResult` may be called by several hook instances; share one call. */
function resolveRedirectResult() {
  if (!redirectResultPromise) redirectResultPromise = getRedirectResult(auth);
  return redirectResultPromise;
}

function toAppUser(firebaseUser) {
  return {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || 'User',
    photoURL: firebaseUser.photoURL,
    email: firebaseUser.email,
  };
}

/**
 * Firebase Auth hook — manages real authentication state.
 * Syncs the Firebase user into the quiz store.
 */
export function useFirebaseAuth() {
  const user = useQuizStore((s) => s.user);
  const login = useQuizStore((s) => s.login);
  const logout = useQuizStore((s) => s.logout);
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    resolveRedirectResult()
      .then((result) => {
        if (!active) return;
        const pending = readRedirectPending();
        clearRedirectPending();
        if (pending && !result && !auth.currentUser) {
          setAuthError('Google sign-in did not complete. Please try again.');
        }
      })
      .catch((err) => {
        if (!active) return;
        clearRedirectPending();
        const message = getAuthErrorMessage(err);
        if (message) setAuthError(message);
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (active) setLoading(false);
      if (firebaseUser) {
        clearRedirectPending();
        login(toAppUser(firebaseUser));
      } else {
        logout();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [login, logout]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (shouldUseRedirectFlow()) {
        markRedirectPending();
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      if (cred?.user) login(toAppUser(cred.user));
    } catch (err) {
      clearRedirectPending();
      let finalError = err;
      if (POPUP_FALLBACK_CODES.has(err?.code)) {
        try {
          markRedirectPending();
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          clearRedirectPending();
          finalError = redirectErr;
        }
      }
      setAuthError(getAuthErrorMessage(finalError));
      throw finalError;
    }
  };

  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (cred?.user) login(toAppUser(cred.user));
    } catch (err) {
      setAuthError(getAuthErrorMessage(err));
      throw err;
    }
  };

  const registerWithEmail = async (name, email, password) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      login({
        uid: cred.user.uid,
        displayName: name,
        photoURL: null,
        email: cred.user.email,
      });
    } catch (err) {
      setAuthError(getAuthErrorMessage(err));
      throw err;
    }
  };

  const logoutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const clearAuthError = () => setAuthError(null);

  return {
    user,
    loading,
    authError,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logoutUser,
    clearAuthError,
  };
}
