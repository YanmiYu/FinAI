/**
 * API client for POST /api/query (proxied to backend at :3001).
 * Adapts the backend v1 contract into the FinancialResponse display type
 * consumed by <ResponseCard>.
 */
import type { FinancialResponse } from "@/components/financial/ResponseCard";

// ── Backend contract types (minimal subset) ──────────────────────────────────

type TraceStep = {
  name: string;
  ok: boolean;
  dt_ms: number;
  info?: Record<string, unknown>;
};

type BackendSuccessResponse = {
  schema_version: "v1";
  query_type: "market" | "analysis" | "knowledge";
  asset: { symbol: string; name?: string; industry?: string | null };
  summary: string;
  key_metrics: {
    price: number;
    change_1d_pct: number | null;
    change_7d_pct: number | null;
    high_52w?: number | null;
    low_52w?: number | null;
    pe_ratio?: number | null;
    eps?: number | null;
    beta?: number | null;
    market_cap_bn?: number | null;
    analyst_rating?: string | null;
    volume_10d_avg?: number | null;
  };
  chart_data: Array<{ t: number; p: number }>;
  news: Array<{ title: string; url: string; published_at: number; source: string }>;
  sources: Array<{ type: string; name: string; url?: string }>;
  confidence: "high" | "medium" | "low";
  risk_note: string | null;
  trace: TraceStep[];
  correlation_id: string;
};

type BackendErrorResponse = {
  schema_version: "v1";
  error: { code: string; message: string; details?: Record<string, unknown> };
  trace: unknown[];
  correlation_id: string;
};

type BackendResponse = BackendSuccessResponse | BackendErrorResponse;

function isError(r: BackendResponse): r is BackendErrorResponse {
  return "error" in r;
}

// ── Adapter helpers ───────────────────────────────────────────────────────────

function fmtDate(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Extract used_llm from the llm_called trace step */
function extractUsedLlm(trace: TraceStep[]): boolean {
  const step = trace.find((s) => s.name === "llm_called");
  return step?.info?.["used_llm"] === true;
}

function adaptResponse(r: BackendSuccessResponse): FinancialResponse {
  const adaptedSources = r.sources
    // Keep KB internal sources; hide only router internals.
    .filter((s) => !(s.type === "internal" && s.name === "router"))
    .map((s) => {
      const prettyTitle = s.name === "financial_knowledge_base"
        ? "Financial Knowledge Base"
        : s.name;
      return {
        title: prettyTitle,
        url: s.url,
        type: s.type,
      };
    });

  return {
    query_type: r.query_type,
    asset: {
      symbol: r.asset.symbol,
      name: r.asset.name ?? r.asset.symbol,
      industry: r.asset.industry ?? undefined,
    },
    summary: r.summary,
    used_llm: extractUsedLlm(r.trace),
    key_metrics: {
      price: r.key_metrics.price,
      change_1d: r.key_metrics.change_1d_pct ?? null,
      change_7d_pct: r.key_metrics.change_7d_pct ?? null,
      high_52w: r.key_metrics.high_52w ?? undefined,
      low_52w: r.key_metrics.low_52w ?? undefined,
      pe_ratio: r.key_metrics.pe_ratio ?? undefined,
      eps: r.key_metrics.eps ?? undefined,
      beta: r.key_metrics.beta ?? undefined,
      market_cap_bn: r.key_metrics.market_cap_bn ?? undefined,
      analyst_rating: r.key_metrics.analyst_rating ?? undefined,
      volume_10d_avg: r.key_metrics.volume_10d_avg ?? undefined,
    },
    chart_data: r.chart_data.map((pt) => ({
      date: fmtDate(pt.t),
      price: pt.p,
    })),
    news: r.news.map((n) => ({
      title: n.title,
      source: n.source,
      time: fmtDate(n.published_at),
      url: n.url,
    })),
    sources: adaptedSources,
    confidence: r.confidence,
    risk_note: r.risk_note ?? undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export type QuerySuccess = { ok: true; data: FinancialResponse; correlationId: string };
export type QueryFailure = { ok: false; error: string; code: string; correlationId: string };
export type QueryResult = QuerySuccess | QueryFailure;

export function isQueryFailure(r: QueryResult): r is QueryFailure {
  return r.ok === false;
}

export type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

export async function queryBackend(
  query: string,
  history: ChatHistoryMessage[] = [],
  locale = "en",
): Promise<QueryResult> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, history, user_locale: locale }),
  });

  const json: BackendResponse = await res.json();

  if (isError(json)) {
    return {
      ok: false,
      error: json.error.message,
      code: json.error.code,
      correlationId: json.correlation_id,
    };
  }

  return {
    ok: true,
    data: adaptResponse(json),
    correlationId: json.correlation_id,
  };
}
