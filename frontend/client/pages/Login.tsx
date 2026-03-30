import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { cn } from "@/lib/utils";
import { TrendingUp, Globe, UserX } from "lucide-react";

type Mode = "login" | "register";

export default function Login() {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, loginAnonymously } = useAuth();
  const { lang, setLang, t } = useLang();

  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const friendlyError = (e: unknown): string => {
    const code = (e as { code?: string })?.code ?? "";
    const zh = lang === "zh";
    const map: Record<string, string> = {
      "auth/user-not-found":        zh ? "该邮箱未注册" : "No account with that email",
      "auth/wrong-password":        zh ? "密码错误" : "Incorrect password",
      "auth/invalid-credential":    zh ? "邮箱或密码错误" : "Incorrect email or password",
      "auth/email-already-in-use":  zh ? "该邮箱已注册" : "Email already in use",
      "auth/weak-password":         zh ? "密码至少需要6位" : "Password must be at least 6 characters",
      "auth/invalid-email":         zh ? "邮箱格式无效" : "Invalid email address",
      "auth/popup-closed-by-user":  zh ? "弹窗被关闭，请重试" : "Popup was closed — please try again",
      "auth/popup-blocked":         zh ? "弹窗被浏览器拦截，请允许弹窗后重试" : "Popup was blocked by the browser",
      "auth/operation-not-supported-in-this-environment": zh
        ? "当前浏览器环境不支持该登录流程，请重试或更换浏览器"
        : "This browser environment does not support this sign-in flow",
      "auth/unauthorized-domain":   zh ? "当前域名未加入 Firebase 授权域名（请添加 localhost）" : "This domain is not authorized in Firebase (add localhost)",
      "auth/operation-not-allowed": zh ? "该登录方式未在 Firebase 开启" : "This sign-in method is not enabled in Firebase",
      "auth/invalid-api-key":       zh ? "Firebase API Key 无效" : "Firebase API key is invalid",
      "auth/network-request-failed": zh ? "网络请求失败，请检查网络或代理" : "Network request failed, please check connectivity",
      "auth/configuration-not-found": zh
        ? "Firebase Auth 尚未启用，请在 Firebase Console 中点击 \"Get started\""
        : 'Firebase Auth not enabled yet — go to Firebase Console → Authentication → click "Get started"',
    };
    return map[code] ?? (e instanceof Error ? e.message : String(e));
  };

  const wrap = async (fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try { await fn(); }
    catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      wrap(() => loginWithEmail(email, password));
    } else {
      wrap(() => registerWithEmail(email, password, name));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Language toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface border border-border transition-colors"
        >
          <Globe size={14} />
          {lang === "en" ? "中文" : "English"}
        </button>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <TrendingUp size={20} className="text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.appName}</h1>
          <p className="text-xs text-muted-foreground">{t.tagline}</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-lg">
        <h2 className="text-lg font-bold text-foreground mb-5 text-center">
          {mode === "login" ? t.login : t.register}
        </h2>

        {/* OAuth buttons */}
        <div className="space-y-2 mb-4">
          {/* Google */}
          <button
            onClick={() => wrap(loginWithGoogle)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-muted transition-colors text-sm font-medium text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
              <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
              <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
              <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
            </svg>
            {t.loginWithGoogle}
          </button>

        </div>

        <div className="flex items-center gap-3 mb-4">
          <hr className="flex-1 border-border" />
          <span className="text-xs text-muted-foreground">{t.orEmail}</span>
          <hr className="flex-1 border-border" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder={t.displayName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}
          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            type="password"
            placeholder={t.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity",
              loading ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"
            )}
          >
            {loading ? "…" : mode === "login" ? t.login : t.register}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {mode === "login" ? t.switchToRegister : t.switchToLogin}
        </button>

        {/* Anonymous / Guest */}
        <div className="relative my-3">
          <hr className="border-border" />
        </div>
        <button
          onClick={() => wrap(loginAnonymously)}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-surface border border-dashed border-border transition-colors"
        >
          <UserX size={14} />
          {lang === "zh" ? "以访客身份继续（不保存数据）" : "Continue as guest (data not saved)"}
        </button>
      </div>
    </div>
  );
}
