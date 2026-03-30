/**
 * Cloud-backed saved queries using Firestore.
 * Collection path: users/{uid}/savedQueries/{queryId}
 */
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FinancialResponse } from "@/components/financial/ResponseCard";

// Firestore rejects `undefined` field values. JSON round-trip strips them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export interface SavedQuery {
  id: string;
  savedAt: number;        // unix ms — derived from Firestore Timestamp
  query: string;
  symbol: string;
  assetName: string;
  queryType: "market" | "analysis" | "knowledge";
  chatSessionId?: string;
  correlationId?: string;
  response: FinancialResponse;
}

type FirestoreDoc = Omit<SavedQuery, "id" | "savedAt"> & {
  savedAt: Timestamp | number;
};

function collectionRef(uid: string) {
  return collection(db, "users", uid, "savedQueries");
}

function docToSavedQuery(id: string, raw: FirestoreDoc): SavedQuery {
  const ts = raw.savedAt;
  // serverTimestamp() is null locally until confirmed — fall back to now so
  // the item still appears immediately after an optimistic save.
  const savedAt =
    ts == null
      ? Date.now()
      : typeof ts === "number"
        ? ts
        : (ts as Timestamp).toMillis();
  return { ...raw, id, savedAt } as SavedQuery;
}

/** One-time load (kept for ad-hoc use). */
export async function loadSavedQueriesCloud(uid: string): Promise<SavedQuery[]> {
  const q = query(collectionRef(uid), orderBy("savedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => docToSavedQuery(d.id, d.data() as FirestoreDoc));
}

/**
 * Real-time listener — fires immediately from IndexedDB cache then again on
 * every server change. Returns an unsubscribe function for useEffect cleanup.
 */
export function subscribeSavedQueriesCloud(
  uid: string,
  onChange: (queries: SavedQuery[]) => void,
): Unsubscribe {
  const q = query(collectionRef(uid), orderBy("savedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => docToSavedQuery(d.id, d.data() as FirestoreDoc))),
    (err) => console.error("[Firestore] saved queries listener error:", err),
  );
}

export async function saveQueryCloud(
  uid: string,
  queryText: string,
  response: FinancialResponse,
  options?: { chatSessionId?: string; correlationId?: string },
): Promise<SavedQuery> {
  // Strip undefined from the response object first, then re-attach the
  // Firestore sentinel (serverTimestamp is not JSON-serialisable and must
  // not pass through JSON.parse/stringify).
  const payload = {
    ...stripUndefined({
      query: queryText,
      symbol: response.asset.symbol,
      assetName: response.asset.name,
      queryType: response.query_type,
      chatSessionId: options?.chatSessionId,
      correlationId: options?.correlationId,
      response,
    }),
    savedAt: serverTimestamp(),
  };
  let ref;
  try {
    ref = await addDoc(collectionRef(uid), payload);
    console.log("[Firestore] ✅ saved query written:", ref.id);
  } catch (err) {
    console.error("[Firestore] ❌ failed to save query:", err);
    throw err;
  }
  return {
    id: ref.id,
    savedAt: Date.now(),
    query: queryText,
    symbol: response.asset.symbol,
    assetName: response.asset.name,
    queryType: response.query_type,
    chatSessionId: options?.chatSessionId,
    correlationId: options?.correlationId,
    response,
  };
}

export async function deleteSavedQueryCloud(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "savedQueries", id));
}
