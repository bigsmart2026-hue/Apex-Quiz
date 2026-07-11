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

export function useFirebaseAuth() {
  const user = useQuizStore((s) => s.user);
  const login = useQuizStore((s) => s.login);
  const logout = useQuizStore((s) => s.logout);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
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
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email, password) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (name, email, password) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    login({
      uid: cred.user.uid,
      displayName: name,
      photoURL: null,
      email: cred.user.email,
    });
  };

  const logoutUser = async () => {
    await signOut(auth);
  };

  const clearAuthError = () => setAuthError(null);

  return { user, authError, loginWithGoogle, loginWithEmail, registerWithEmail, logoutUser, clearAuthError };
}
