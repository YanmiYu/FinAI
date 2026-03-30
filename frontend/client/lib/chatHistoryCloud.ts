/**
 * Firestore-backed chat history.
 *
 * Data model
 * ──────────
 * users/{uid}/chatSessions/{sessionId}
 *   locale          "en" | "zh"
 *   title           string          first user query (truncated to 64 chars)
 *   turnCount       number
 *   createdAt       Timestamp
 *   updatedAt       Timestamp
 *   lastUserQuery   string
 *
 * users/{uid}/chatSessions/{sessionId}/turns/{turnId}
 *   userQuery       string                  what the user asked
 *   askedAt         Timestamp
 *   status          "pending"|"answered"|"error"
 *   response        FinancialResponse | null LLM structured response
 *   errorText       string | null           set when status = "error"
 *   correlationId   string | null
 *   answeredAt      Timestamp | null
 *   updatedAt       Timestamp
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FinancialResponse } from "@/components/financial/ResponseCard";
import type { Lang } from "@/contexts/LangContext";

// Firestore rejects `undefined` field values — JSON round-trip strips them.
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

// ── Ref helpers ───────────────────────────────────────────────────────────────

function sessionsRef(uid: string) {
  return collection(db, "users", uid, "chatSessions");
}
function sessionRef(uid: string, sessionId: string) {
  return doc(db, "users", uid, "chatSessions", sessionId);
}
function turnsRef(uid: string, sessionId: string) {
  return collection(db, "users", uid, "chatSessions", sessionId, "turns");
}
function turnRef(uid: string, sessionId: string, turnId: string) {
  return doc(db, "users", uid, "chatSessions", sessionId, "turns", turnId);
}

// ── Public types ──────────────────────────────────────────────────────────────

export type TurnStatus = "pending" | "answered" | "error";

export interface ChatSession {
  id: string;
  locale: string;
  title: string;
  turnCount: number;
  lastUserQuery: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionTurn {
  id: string;
  userQuery: string;
  askedAt: number;
  status: TurnStatus;
  response: FinancialResponse | null;
  errorText: string | null;
  correlationId: string | null;
  answeredAt: number | null;
}

// ── Session ───────────────────────────────────────────────────────────────────

export async function createChatSessionCloud(
  uid: string,
  locale: Lang,
): Promise<string> {
  try {
    const ref = await addDoc(sessionsRef(uid), {
      locale,
      title: "New Chat",
      turnCount: 0,
      lastUserQuery: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[Firestore] ✅ chat session created:", ref.id);
    return ref.id;
  } catch (err) {
    console.error("[Firestore] ❌ failed to create chat session:", err);
    throw err;
  }
}

// ── Turns ─────────────────────────────────────────────────────────────────────

/**
 * Called immediately when the user submits a query.
 * Creates a pending turn document and returns its ID so we can update it later.
 */
export async function createTurnCloud(
  uid: string,
  sessionId: string,
  userQuery: string,
): Promise<string> {
  const ref = await addDoc(turnsRef(uid, sessionId), {
    userQuery,
    askedAt: serverTimestamp(),
    status: "pending" as TurnStatus,
    response: null,
    errorText: null,
    correlationId: null,
    answeredAt: null,
    updatedAt: serverTimestamp(),
  });

  // Update session metadata — use the first query as the session title.
  await updateDoc(sessionRef(uid, sessionId), {
    title: userQuery.slice(0, 64),
    lastUserQuery: userQuery.slice(0, 120),
    turnCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

// ── Read (list sessions) ──────────────────────────────────────────────────────

/**
 * Real-time listener: fires immediately from cache, then on every change.
 * Sessions are ordered newest-first.
 */
export function subscribeChatSessionsCloud(
  uid: string,
  onChange: (sessions: ChatSession[]) => void,
): Unsubscribe {
  const q = query(sessionsRef(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, { includeMetadataChanges: false }, (snap) => {
    const sessions: ChatSession[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        locale: data.locale ?? "en",
        title: data.title ?? "Untitled",
        turnCount: data.turnCount ?? 0,
        lastUserQuery: data.lastUserQuery ?? "",
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
        updatedAt: data.updatedAt?.toMillis?.() ?? Date.now(),
      };
    });
    onChange(sessions);
  });
}

/**
 * One-time fetch of all turns in a session, ordered chronologically.
 */
export async function loadSessionTurnsCloud(
  uid: string,
  sessionId: string,
): Promise<SessionTurn[]> {
  const q = query(turnsRef(uid, sessionId), orderBy("askedAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      userQuery: data.userQuery ?? "",
      askedAt: data.askedAt?.toMillis?.() ?? Date.now(),
      status: data.status ?? "answered",
      response: data.response ?? null,
      errorText: data.errorText ?? null,
      correlationId: data.correlationId ?? null,
      answeredAt: data.answeredAt?.toMillis?.() ?? null,
    };
  });
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Called once the LLM responds (or fails).
 * Fills in the response / error on the existing pending turn.
 */
export async function updateTurnCloud(
  uid: string,
  sessionId: string,
  turnId: string,
  result:
    | { status: "answered"; response: FinancialResponse; correlationId?: string }
    | { status: "error";    errorText: string },
): Promise<void> {
  if (result.status === "answered") {
    await updateDoc(turnRef(uid, sessionId, turnId), {
      status: "answered" as TurnStatus,
      response: stripUndefined(result.response),
      correlationId: result.correlationId ?? null,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(turnRef(uid, sessionId, turnId), {
      status: "error" as TurnStatus,
      errorText: result.errorText,
      answeredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
