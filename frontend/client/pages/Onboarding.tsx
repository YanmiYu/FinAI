import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, type Lang } from "@/contexts/LangContext";
import { cn } from "@/lib/utils";
import type { RiskLevel, InvestingExperience } from "@/lib/userProfile";

// ── Label maps ────────────────────────────────────────────────────────────────

const EXPERIENCE_LABELS: Record<InvestingExperience, { en: string; zh: string }> = {
  less_than_1: { en: "Less than 1 year",    zh: "不足 1 年"  },
  "1_to_3":    { en: "1 – 3 years",         zh: "1–3 年"    },
  "3_to_5":    { en: "3 – 5 years",         zh: "3–5 年"    },
  more_than_5: { en: "More than 5 years",   zh: "5 年以上"  },
};

const RISK_LABELS: Record<RiskLevel, { en: string; zh: string; desc_en: string; desc_zh: string }> = {
  conservative: {
    en: "Conservative",  zh: "保守型",
    desc_en: "Preserve capital, low risk",
    desc_zh: "保本为主，低风险",
  },
  moderate: {
    en: "Moderate",      zh: "稳健型",
    desc_en: "Balanced growth and safety",
    desc_zh: "兼顾收益与安全",
  },
  aggressive: {
    en: "Aggressive",    zh: "激进型",
    desc_en: "Maximize returns, high risk",
    desc_zh: "追求高收益，承受高风险",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, profile, saveBasicProfile } = useAuth();
  const { lang, setLang } = useLang();
  const navigate = useNavigate();

  const zh = lang === "zh";

  // Pre-fill from any partial profile that may already exist.
  const [displayName,          setDisplayName]          = useState(profile?.displayName ?? "");
  const [preferredLanguage,    setPreferredLanguage]    = useState<Lang>(profile?.preferredLanguage ?? lang);
  const [age,                  setAge]                  = useState<string>(profile?.age ? String(profile.age) : "");
  const [occupation,           setOccupation]           = useState(profile?.occupation ?? "");
  const [investingExperience,  setInvestingExperience]  = useState<InvestingExperience | "">(profile?.investingExperience ?? "");
  const [riskLevel,            setRiskLevel]            = useState<RiskLevel | "">(profile?.riskLevel ?? "");
  const [saving,               setSaving]               = useState(false);
  const [error,                setError]                = useState("");

  // ── Validation
  // Note: redirect guards live in OnboardingRoute (App.tsx) — duplicating them
  // here causes two <Navigate> elements to fire concurrently, which produces
  // the React DOM "removeChild" NotFoundError. ──────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!displayName.trim())      return zh ? "请输入姓名"            : "Please enter your name";
    const ageNum = Number(age);
    if (!age || isNaN(ageNum) || ageNum < 10 || ageNum > 120)
                                  return zh ? "请输入有效年龄（10–120）" : "Please enter a valid age (10–120)";
    if (!occupation.trim())       return zh ? "请输入职业"            : "Please enter your occupation";
    if (!investingExperience)     return zh ? "请选择投资经验"         : "Please select your investing experience";
    if (!riskLevel)               return zh ? "请选择风险承受能力"      : "Please select your risk level";
    return null;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      await saveBasicProfile({
        displayName,
        preferredLanguage,
        age: Number(age),
        occupation,
        investingExperience: investingExperience as InvestingExperience,
        riskLevel: riskLevel as RiskLevel,
      });
      setLang(preferredLanguage);
      // Navigate imperatively — do not rely on a declarative <Navigate> in
      // render because profile state may not have re-rendered yet at that point.
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false); // only reset spinner on error; on success we navigate away
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-lg">

        {/* Header */}
        <h2 className="text-xl font-bold text-foreground">
          {zh ? "完善基础资料" : "Complete your profile"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          {zh
            ? "仅需一次，帮助我们为您提供个性化的投资分析"
            : "One-time setup — helps us tailor financial analysis to your needs"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Display name ──────────────────────────────────────────────── */}
          <Field label={zh ? "姓名" : "Display name"}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={zh ? "您的姓名" : "Your name"}
              className={inputCls}
              required
            />
          </Field>

          {/* ── Age ──────────────────────────────────────────────────────── */}
          <Field label={zh ? "年龄" : "Age"}>
            <input
              type="number"
              min={10}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder={zh ? "例：28" : "e.g. 28"}
              className={inputCls}
              required
            />
          </Field>

          {/* ── Occupation ───────────────────────────────────────────────── */}
          <Field label={zh ? "职业" : "Occupation"}>
            <input
              type="text"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder={zh ? "例：软件工程师" : "e.g. Software Engineer"}
              className={inputCls}
              required
            />
          </Field>

          {/* ── Investing experience ─────────────────────────────────────── */}
          <Field label={zh ? "投资经验" : "Investing experience"}>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(Object.keys(EXPERIENCE_LABELS) as InvestingExperience[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInvestingExperience(key)}
                  className={cn(chipCls, investingExperience === key && chipActiveCls)}
                >
                  {EXPERIENCE_LABELS[key][lang]}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Risk level ───────────────────────────────────────────────── */}
          <Field label={zh ? "风险承受能力" : "Risk tolerance"}>
            <div className="mt-1 space-y-2">
              {(Object.keys(RISK_LABELS) as RiskLevel[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRiskLevel(key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                    riskLevel === key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <RiskDot level={key} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {RISK_LABELS[key][lang]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "zh" ? RISK_LABELS[key].desc_zh : RISK_LABELS[key].desc_en}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {/* ── Language ─────────────────────────────────────────────────── */}
          <Field label={zh ? "界面语言" : "Preferred language"}>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPreferredLanguage("en")}
                className={cn(chipCls, preferredLanguage === "en" && chipActiveCls)}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setPreferredLanguage("zh")}
                className={cn(chipCls, preferredLanguage === "zh" && chipActiveCls)}
              >
                中文
              </button>
            </div>
          </Field>

          {/* ── Error ────────────────────────────────────────────────────── */}
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={saving}
            className={cn(
              "w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-opacity",
              saving ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
            )}
          >
            {saving ? "…" : zh ? "开始使用" : "Get started"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full mt-1 px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

const chipCls =
  "px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground " +
  "hover:border-primary/40 transition-colors";

const chipActiveCls = "border-primary bg-primary/10 text-foreground";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const RISK_DOT_COLOR: Record<RiskLevel, string> = {
  conservative: "bg-green-500",
  moderate:     "bg-amber-500",
  aggressive:   "bg-red-500",
};

function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", RISK_DOT_COLOR[level])}
    />
  );
}
