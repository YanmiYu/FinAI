import { Bookmark, Plus, Trash2, TrendingUp, Brain, LineChart, LogOut, Globe, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import type { SavedQuery } from "@/lib/cloudSavedQueries";
import type { ChatSession } from "@/lib/chatHistoryCloud";

export type SidebarTab = "chat" | "history" | "saved";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNewChat: () => void;
  savedQueries: SavedQuery[];
  onDeleteSaved: (id: string) => void;
  onSelectSaved: (q: SavedQuery) => void;
  chatSessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
}

const QUERY_TYPE_ICON: Record<SavedQuery["queryType"], React.ReactNode> = {
  market:    <TrendingUp size={14} />,
  analysis:  <Brain size={14} />,
  knowledge: <LineChart size={14} />,
};

const QUERY_TYPE_COLOR: Record<SavedQuery["queryType"], string> = {
  market:    "text-blue-400",
  analysis:  "text-purple-400",
  knowledge: "text-amber-400",
};

export function Sidebar({
  activeTab,
  onTabChange,
  onNewChat,
  savedQueries,
  onDeleteSaved,
  onSelectSaved,
  chatSessions,
  activeSessionId,
  onSelectSession,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();

  const locale = lang === "zh" ? "zh-CN" : "en-US";

  function formatDate(ms: number) {
    return new Date(ms).toLocaleDateString(locale, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">F</span>
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground">{t.appName}</h1>
        </div>
      </div>

      {/* New Chat button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          {t.newChat}
        </button>
      </div>

      {/* Navigation tabs */}
      <nav className="flex gap-1 px-4 py-2">
        {(["history", "saved"] as const).map((tab) => {
          const Icon = tab === "history" ? Clock : Bookmark;
          const label = tab === "history" ? t.history : t.saved;
          const badge = tab === "saved" && savedQueries.length > 0
            ? savedQueries.length
            : tab === "history" && chatSessions.length > 0
            ? chatSessions.length
            : null;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors",
                activeTab === tab
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon size={14} />
              {label}
              {badge !== null && (
                <span className="bg-sidebar-primary text-sidebar-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* History list */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {chatSessions.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={28} className="mx-auto text-sidebar-foreground/30 mb-2" />
              <p className="text-xs text-sidebar-foreground/50">{t.noHistory}</p>
              <p className="text-xs text-sidebar-foreground/40 mt-1">{t.noHistoryHint}</p>
            </div>
          ) : (
            chatSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s)}
                className={cn(
                  "group relative rounded-lg p-3 cursor-pointer transition-colors",
                  s.id === activeSessionId
                    ? "bg-sidebar-accent/70 ring-1 ring-sidebar-primary/40"
                    : "bg-sidebar-accent/30 hover:bg-sidebar-accent/60"
                )}
              >
                <p className="text-xs font-medium text-sidebar-foreground truncate">
                  {s.title === "New Chat" || !s.title ? (lang === "zh" ? "新对话" : "New Chat") : s.title}
                </p>
                <div className="flex items-center justify-between mt-1 gap-1">
                  <p className="text-xs text-sidebar-foreground/40">{formatDate(s.updatedAt)}</p>
                  {s.turnCount > 0 && (
                    <p className="text-xs text-sidebar-foreground/40 flex-shrink-0">
                      {s.turnCount} {t.turns}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved queries list */}
      {activeTab === "saved" && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {savedQueries.length === 0 ? (
            <div className="text-center py-8">
              <Bookmark size={28} className="mx-auto text-sidebar-foreground/30 mb-2" />
              <p className="text-xs text-sidebar-foreground/50">{t.noSaved}</p>
              <p className="text-xs text-sidebar-foreground/40 mt-1">{t.noSavedHint}</p>
            </div>
          ) : (
            savedQueries.map((q) => (
              <div
                key={q.id}
                className="group relative bg-sidebar-accent/30 hover:bg-sidebar-accent/60 rounded-lg p-3 cursor-pointer transition-colors"
                onClick={() => onSelectSaved(q)}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("flex-shrink-0", QUERY_TYPE_COLOR[q.queryType])}>
                      {QUERY_TYPE_ICON[q.queryType]}
                    </span>
                    <span className="text-xs font-bold text-sidebar-foreground truncate">{q.symbol}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSaved(q.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-sidebar-foreground/40 hover:text-red-400 transition-all flex-shrink-0"
                    title="Remove"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-xs text-sidebar-foreground/70 mt-1 line-clamp-2">{q.query}</p>
                <p className="text-xs text-sidebar-foreground/40 mt-1">{formatDate(q.savedAt)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "chat" && <div className="flex-1" />}

      {/* Footer: language + user */}
      <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
        {/* Language toggle */}
        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
        >
          <Globe size={14} />
          {lang === "en" ? "切换到中文" : "Switch to English"}
        </button>

        {/* User info + sign out */}
        {user && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-6 h-6 rounded-full flex-shrink-0" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-sidebar-primary-foreground">
                    {(user.displayName ?? user.email ?? "?")[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs text-sidebar-foreground/70 truncate">
                {user.isAnonymous
                  ? (lang === "zh" ? "访客" : "Guest")
                  : (user.displayName ?? user.email)}
              </span>
            </div>
            <button
              onClick={logout}
              title={t.signOut}
              className="p-1.5 text-sidebar-foreground/40 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
