import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Avoid duplicate app initialisation during hot-reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;

export const auth           = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Use IndexedDB-backed persistent cache so that:
//   1. getDoc() serves instantly from disk on subsequent page loads
//   2. Firestore never throws "client is offline" for cached documents
//   3. Writes are queued and synced automatically when the network returns
// initializeFirestore throws on a second call (hot-reload), so we catch and
// fall back to the already-initialised instance via getFirestore().
function buildDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

export const db = buildDb();
