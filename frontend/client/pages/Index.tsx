import { useState, useRef, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/financial/Sidebar";
import { ChatInput } from "@/components/financial/ChatInput";
import { UserMessage } from "@/components/financial/MessageBubble";
import { ResponseCard, type FinancialResponse } from "@/components/financial/ResponseCard";
import { queryBackend, isQueryFailure, type ChatHistoryMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import {
  subscribeSavedQueriesCloud,
  saveQueryCloud,
  deleteSavedQueryCloud,
  type SavedQuery,
} from "@/lib/cloudSavedQueries";
import {
  createChatSessionCloud,
  createTurnCloud,
  updateTurnCloud,
  subscribeChatSessionsCloud,
  loadSessionTurnsCloud,
  type ChatSession,
} from "@/lib/chatHistoryCloud";
import type { SidebarTab } from "@/components/financial/Sidebar";

// ── Message types ─────────────────────────────────────────────────────────────

interface Message {
  id: string;
  type: "user" | "system" | "error";
  content: string | FinancialResponse;
  rawQuery?: string;
  timestamp: Date;
  correlationId?: string;
}

const uid = () => crypto.randomUUID();

function makeWelcome(text: string): Message {
  return { id: "welcome", type: "system", content: text, timestamp: new Date() };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Index() {
  const { user } = useAuth();
  const { lang, t } = useLang();

  const [activeTab, setActiveTab]   = useState<SidebarTab>("history");
  const [messages, setMessages]     = useState<Message[]>([makeWelcome(t.welcome)]);
  const [isLoading, setIsLoading]   = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions]       = useState<ChatSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Real-time saved queries listener ──────────────────────────────────────
  useEffect(() => {
    if (!user) { setSavedQueries([]); return; }
    const unsub = subscribeSavedQueriesCloud(user.uid, setSavedQueries);
    return unsub;
  }, [user?.uid]);

  // ── Real-time chat sessions listener ──────────────────────────────────────
  useEffect(() => {
    if (!user) { setChatSessions([]); return; }
    const unsub = subscribeChatSessionsCloud(user.uid, setChatSessions);
    return unsub;
  }, [user?.uid]);

  // Derive bookmark state from the live list so it survives page reloads.
  // Maps correlationId → savedQuery.id for every saved query that has one.
  const savedByCorrelation = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of savedQueries) {
      if (q.correlationId) map.set(q.correlationId, q.id);
    }
    return map;
  }, [savedQueries]);

  // Open a new persisted chat session when user becomes available
  useEffect(() => {
    if (!user) {
      setActiveSessionId(null);
      setMessages([makeWelcome(t.welcome)]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sid = await createChatSessionCloud(user.uid, lang);
        if (cancelled) return;
        setActiveSessionId(sid);
        setMessages([makeWelcome(t.welcome)]);
      } catch (err) {
        console.error("Failed to create chat session:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  // Update welcome message when language changes
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => m.id === "welcome" ? { ...m, content: t.welcome } : m)
    );
  }, [t.welcome]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleNewChat() {
    setActiveTab("history");
    setMessages([makeWelcome(t.welcome)]);
    if (!user) return;
    try {
      const sid = await createChatSessionCloud(user.uid, lang);
      setActiveSessionId(sid);
    } catch (err) {
      console.error("Failed to start new chat:", err);
    }
  }

  async function handleSave(msg: Message) {
    if (!user || typeof msg.content !== "object" || !msg.rawQuery) return;
    try {
      const entry = await saveQueryCloud(user.uid, msg.rawQuery, msg.content as FinancialResponse, {
        chatSessionId: activeSessionId ?? undefined,
        correlationId: msg.correlationId,
      });
      // The onSnapshot listener will update savedQueries automatically;
      // setSavedQueries here is an optimistic update for instant feedback.
      setSavedQueries((prev) => [entry, ...prev]);
    } catch (e) {
      console.error("Save failed:", e);
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!user) return;
    try {
      await deleteSavedQueryCloud(user.uid, id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  function handleSelectSaved(q: SavedQuery) {
    setActiveTab("saved");
    setMessages([
      makeWelcome(t.welcome),
      { id: `user_${q.id}`, type: "user",   content: q.query,    timestamp: new Date(q.savedAt) },
      { id: `saved_${q.id}`, type: "system", content: q.response, rawQuery: q.query, timestamp: new Date(q.savedAt) },
    ]);
  }

  async function handleSelectSession(session: ChatSession) {
    setActiveTab("history");
    setActiveSessionId(session.id);
    if (!user) return;
    try {
      const turns = await loadSessionTurnsCloud(user.uid, session.id);
      const msgs: Message[] = [makeWelcome(t.welcome)];
      for (const turn of turns) {
        msgs.push({
          id: `turn_user_${turn.id}`,
          type: "user",
          content: turn.userQuery,
          timestamp: new Date(turn.askedAt),
        });
        if (turn.status === "answered" && turn.response) {
          msgs.push({
            id: `turn_resp_${turn.id}`,
            type: "system",
            content: turn.response,
            rawQuery: turn.userQuery,
            timestamp: new Date(turn.answeredAt ?? turn.askedAt),
            correlationId: turn.correlationId ?? undefined,
          });
        } else if (turn.status === "error" && turn.errorText) {
          msgs.push({
            id: `turn_err_${turn.id}`,
            type: "error",
            content: turn.errorText,
            timestamp: new Date(turn.answeredAt ?? turn.askedAt),
          });
        }
      }
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load session turns:", err);
    }
  }

  async function handleSendMessage(message: string) {
    // Build conversation history from existing messages
    const history: ChatHistoryMessage[] = [];
    for (const msg of messages) {
      if (msg.type === "user") {
        history.push({ role: "user", content: msg.content as string });
      } else if (msg.type === "system" && typeof msg.content !== "string") {
        history.push({ role: "assistant", content: (msg.content as FinancialResponse).summary });
      }
    }

    const userMsg: Message = { id: uid(), type: "user", content: message, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // ── Ensure we have a session ────────────────────────────────────────────
    let sessionId = activeSessionId;
    if (!sessionId && user) {
      try {
        sessionId = await createChatSessionCloud(user.uid, lang);
        setActiveSessionId(sessionId);
      } catch (err) {
        console.error("Failed to create session:", err);
      }
    }

    // ── Step 1: create a pending turn in Firestore ─────────────────────────
    // We do this before calling the backend so the turn exists even if the
    // backend call fails. We store the turnId so we can update it later.
    let turnId: string | null = null;
    if (user && sessionId) {
      try {
        turnId = await createTurnCloud(user.uid, sessionId, message);
      } catch (err) {
        console.error("Failed to create turn:", err);
      }
    }

    try {
      const result = await queryBackend(message, history, lang);

      // ── Step 2: fill in the response / error on the pending turn ──────────
      if (isQueryFailure(result)) {
        const errorMsg: Message = {
          id: uid(),
          type: "error",
          content: `${result.code}: ${result.error}`,
          timestamp: new Date(),
          correlationId: result.correlationId,
        };
        setMessages((prev) => [...prev, errorMsg]);
        if (user && sessionId && turnId) {
          await updateTurnCloud(user.uid, sessionId, turnId, {
            status: "error",
            errorText: `${result.code}: ${result.error}`,
          }).catch((err) => console.error("Failed to update turn with error:", err));
        }
      } else {
        const assistantMsg: Message = {
          id: uid(),
          type: "system",
          content: result.data,
          rawQuery: message,
          timestamp: new Date(),
          correlationId: result.correlationId,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (user && sessionId && turnId) {
          await updateTurnCloud(user.uid, sessionId, turnId, {
            status: "answered",
            response: result.data,
            correlationId: result.correlationId,
          }).catch((err) => console.error("Failed to update turn with response:", err));
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Network error — is the backend running?";
      const errorMsg: Message = { id: uid(), type: "error", content: errMsg, timestamp: new Date() };
      setMessages((prev) => [...prev, errorMsg]);
      if (user && sessionId && turnId) {
        updateTurnCloud(user.uid, sessionId, turnId, {
          status: "error",
          errorText: errMsg,
        }).catch((err) => console.error("Failed to persist error turn:", err));
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-full bg-background text-foreground flex overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewChat={handleNewChat}
        savedQueries={savedQueries}
        onDeleteSaved={handleDeleteSaved}
        onSelectSaved={handleSelectSaved}
        chatSessions={chatSessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold">{lang === "zh" ? "金融助手" : "Financial Assistant"}</h2>
          <p className="text-sm text-muted-foreground">{t.tagline}</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((msg) => {
            if (msg.type === "user") return <UserMessage key={msg.id} message={msg.content as string} />;

            if (msg.type === "error") {
              return (
                <div key={msg.id} className="mb-6">
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                    <p className="text-sm text-destructive font-medium">{t.error}</p>
                    <p className="text-sm text-foreground mt-1">{msg.content as string}</p>
                    {msg.correlationId && (
                      <p className="text-xs text-muted-foreground mt-2 font-mono">id: {msg.correlationId}</p>
                    )}
                  </div>
                </div>
              );
            }

            if (typeof msg.content === "string") {
              return (
                <div key={msg.id} className="mb-6">
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <p className="text-sm text-foreground">{msg.content}</p>
                  </div>
                </div>
              );
            }

            const isSaved = msg.correlationId ? savedByCorrelation.has(msg.correlationId) : false;
            return (
              <ResponseCard
                key={msg.id}
                response={msg.content as FinancialResponse}
                isSaved={isSaved}
                onSave={() => handleSave(msg)}
              />
            );
          })}

          {isLoading && (
            <div className="flex justify-start mb-6">
              <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={handleSendMessage} disabled={isLoading} isLoading={isLoading} />
      </div>
    </div>
  );
}
