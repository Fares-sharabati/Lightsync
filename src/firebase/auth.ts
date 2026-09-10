import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from './config';

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function signInOrganizer(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

let anonymousAuthPromise: Promise<User> | null = null;

export async function ensureAnonymousAuth() {
  if (!anonymousAuthPromise) {
    anonymousAuthPromise = (async () => {
      // Firebase restores browser-local auth asynchronously during startup.
      // If we check auth.currentUser before that restoration finishes, it can
      // still be null and signInAnonymously() creates a NEW anonymous UID.
      // That was the root cause of the same phone being able to appear as a
      // second participant and submit the same poll twice after reopening the
      // QR page.
      await auth.authStateReady();

      if (auth.currentUser) return auth.currentUser;

      await setPersistence(auth, browserLocalPersistence);

      // setPersistence() can itself finish after auth initialization, so check
      // one more time before creating a new anonymous account.
      if (auth.currentUser) return auth.currentUser;

      const result = await signInAnonymously(auth);
      return result.user;
    })().finally(() => {
      anonymousAuthPromise = null;
    });
  }
  return anonymousAuthPromise;
}

export async function logout() {
  await signOut(auth);
}
