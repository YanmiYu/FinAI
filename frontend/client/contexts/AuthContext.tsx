import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import {
  ensureUserProfile,
  getUserProfile,
  completeUserProfile,
  type UserProfile,
  type OnboardingPayload,
} from "@/lib/userProfile";
import type { Lang } from "@/contexts/LangContext";

// ── localStorage profile cache ────────────────────────────────────────────────
// Keeps profile data available instantly on page load so the auth loading
// spinner disappears immediately for returning users, without waiting for
// a Firestore round-trip.

const cacheKey = (uid: string) => `finai_profile_${uid}`;

function readCache(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

function writeCache(profile: UserProfile) {
  try {
    localStorage.setItem(cacheKey(profile.uid), JSON.stringify(profile));
  } catch { /* ignore quota errors */ }
}

function clearCache(uid: string) {
  try { localStorage.removeItem(cacheKey(uid)); } catch { /* ignore */ }
}

// ── Retry helper ─────────────────────────────────────────────────────────────
// Firestore's WebSocket connection is not yet up when onAuthStateChanged fires.
// Any getDoc for a document not yet in IndexedDB throws "client is offline"
// during that window. We retry with exponential backoff instead of giving up.

function isOfflineError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const code = (err as { code?: string }).code ?? "";
  return msg.includes("client is offline") || code === "unavailable";
}

async function retryOnOffline<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn(); }
    catch (err) {
      if (!isOfflineError(err) || i === maxAttempts - 1) throw err;
      lastErr = err;
      // Backoff: 600 ms, 1.2 s, 2.4 s
      await new Promise((r) => setTimeout(r, 600 * 2 ** i));
    }
  }
  throw lastErr;
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAnonymously: () => Promise<void>;
  saveBasicProfile: (payload: OnboardingPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // ── Fast path: serve from localStorage cache immediately ──────────────
      // This makes loading end in < 1 ms for returning users, even before
      // Firestore responds.
      const cached = readCache(u.uid);
      if (cached) {
        setProfile(cached);
        setLoading(false); // unblock UI right away
      }

      // ── Slow path: sync with Firestore in the background ─────────────────
      // Does NOT block loading. Retries automatically if Firestore connection
      // isn't ready yet (common in the first ~1 s after page load).
      const preferred = (localStorage.getItem("finai_lang") as Lang) || "en";
      retryOnOffline(() => ensureUserProfile(u, preferred))
        .then((fresh) => {
          setProfile(fresh);
          writeCache(fresh);
          if (!cached) setLoading(false); // first-ever sign-in: end loading now
        })
        .catch((err) => {
          console.warn("Firestore profile sync failed after retries:", err);
          // If we already served from cache, the user isn't blocked.
          // If there was no cache (first sign-in, fully offline), unblock anyway.
          if (!cached) setLoading(false);
        });
    });
    return unsub;
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  };

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginAnonymously = async () => {
    await signInAnonymously(auth);
  };

  const saveBasicProfile = async (payload: OnboardingPayload) => {
    const current = auth.currentUser;
    if (!current) throw new Error("Not signed in");
    await completeUserProfile(current.uid, payload);
    // Merge optimistically — never do a secondary read that can return stale/null.
    setProfile((prev) => {
      const updated: UserProfile = {
        ...(prev ?? {
          uid: current.uid,
          email: current.email,
          isAnonymous: current.isAnonymous,
          providerIds: current.providerData.map((p) => p.providerId),
          preferredLanguage: payload.preferredLanguage,
        }),
        ...payload,
        profileCompleted: true,
        updatedAt: Date.now(),
      } as UserProfile;
      writeCache(updated); // persist so next load is instant
      return updated;
    });
  };

  const logout = async () => {
    const uid = auth.currentUser?.uid;
    await signOut(auth);
    if (uid) clearCache(uid);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginAnonymously,
        saveBasicProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
