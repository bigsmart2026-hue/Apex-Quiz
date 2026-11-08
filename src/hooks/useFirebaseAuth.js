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

    resolveRedirectResult().catch((err) => {
      if (!active) return;
      const message = getAuthErrorMessage(err);
      if (message) setAuthError(message);
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (active) setLoading(false);
      if (firebaseUser) {
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
        await signInWithRedirect(auth, provider);
        return;
      }
      const cred = await signInWithPopup(auth, provider);
      if (cred?.user) login(toAppUser(cred.user));
    } catch (err) {
      let finalError = err;
      if (POPUP_FALLBACK_CODES.has(err?.code)) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
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
