import { doc, getDoc, getDocFromCache, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Lang } from "@/contexts/LangContext";
import type { User } from "firebase/auth";

// ── Enumerations ─────────────────────────────────────────────────────────────

export type RiskLevel = "conservative" | "moderate" | "aggressive";

export type InvestingExperience =
  | "less_than_1"
  | "1_to_3"
  | "3_to_5"
  | "more_than_5";

// ── Shape ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  preferredLanguage: Lang;
  isAnonymous: boolean;
  providerIds: string[];
  profileCompleted: boolean;

  // ── Investment profile (collected during onboarding) ──────────────────────
  age?: number;
  occupation?: string;
  investingExperience?: InvestingExperience;
  riskLevel?: RiskLevel;

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt?: number;
  updatedAt?: number;
}

export type OnboardingPayload = {
  displayName: string;
  preferredLanguage: Lang;
  age: number;
  occupation: string;
  investingExperience: InvestingExperience;
  riskLevel: RiskLevel;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type FirestoreTimestamp = { toMillis: () => number };
type FirestoreUserProfile = Omit<UserProfile, "createdAt" | "updatedAt"> & {
  createdAt?: FirestoreTimestamp | number;
  updatedAt?: FirestoreTimestamp | number;
};

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function tsToMillis(ts?: FirestoreTimestamp | number): number | undefined {
  if (typeof ts === "number") return ts;
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  return undefined;
}

// ── Public API ────────────────────────────────────────────────────────────────

function snapToProfile(data: FirestoreUserProfile): UserProfile {
  return {
    ...data,
    createdAt: tsToMillis(data.createdAt),
    updatedAt: tsToMillis(data.updatedAt),
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // Try the local IndexedDB cache first — zero network latency and works offline.
  try {
    const cached = await getDocFromCache(userRef(uid));
    if (cached.exists()) return snapToProfile(cached.data() as FirestoreUserProfile);
  } catch {
    // Cache miss (doc not cached yet) — fall through to server read.
  }
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return snapToProfile(snap.data() as FirestoreUserProfile);
}

/** Called once after a new Firebase Auth sign-in. Creates the doc if absent. */
export async function ensureUserProfile(
  user: User,
  preferredLanguage: Lang,
): Promise<UserProfile> {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const seeded: UserProfile = {
    uid: user.uid,
    displayName: user.displayName ?? "",
    email: user.email,
    preferredLanguage,
    isAnonymous: user.isAnonymous,
    providerIds: user.providerData.map((p) => p.providerId).filter(Boolean),
    profileCompleted: false,
  };

  try {
    await setDoc(userRef(user.uid), {
      ...seeded,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[Firestore] ✅ user profile created:", user.uid);
  } catch (err) {
    console.error("[Firestore] ❌ failed to create user profile:", err);
    throw err;
  }
  return seeded;
}

/** Writes the full onboarding payload and marks the profile as completed. */
export async function completeUserProfile(
  uid: string,
  payload: OnboardingPayload,
): Promise<void> {
  try {
    await setDoc(
      userRef(uid),
      {
        displayName: payload.displayName.trim(),
        preferredLanguage: payload.preferredLanguage,
        age: payload.age,
        occupation: payload.occupation.trim(),
        investingExperience: payload.investingExperience,
        riskLevel: payload.riskLevel,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    console.log("[Firestore] ✅ onboarding profile saved:", uid);
  } catch (err) {
    console.error("[Firestore] ❌ failed to save onboarding profile:", err);
    throw err;
  }
}
