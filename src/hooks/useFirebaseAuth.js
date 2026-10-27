import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase.config';
import useQuizStore from '../store/useQuizStore';

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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setLoading(false);
      if (firebaseUser) {
        login({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email,
        });
      } else {
        logout();
      }
    });
    return unsubscribe;
  }, [login, logout]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError(err.message);
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
      setAuthError(err.message);
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