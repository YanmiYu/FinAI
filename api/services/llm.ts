import type { Asset, HistoryMessage, KeyMetrics, NewsItem, SourceRef } from '../../shared/queryContract.js'
import type { KnowledgeTerm } from './rag.js'

// ── Shared input/output types ────────────────────────────────────────────────

type MarketInput = {
  query: string
  asset: Asset
  key_metrics: KeyMetrics
  sources: SourceRef[]
  history?: HistoryMessage[]
  locale?: string
  knowledge_terms?: KnowledgeTerm[]
}

type KnowledgeInput = MarketInput

type AnalyzeInput = {
  query: string
  asset: Asset
  key_metrics: KeyMetrics
  news: NewsItem[]
  history?: HistoryMessage[]
  locale?: string
  knowledge_terms?: KnowledgeTerm[]
}

export type LLMResult = {
  summary: string
  used_llm: boolean
  risk_note: string | null
}

type OpenInput = {
  query: string
  history?: HistoryMessage[]
  locale?: string
  knowledge_terms?: KnowledgeTerm[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getModel(): string {
  const m = process.env.LLM_MODEL?.trim()
  return m && m.length > 0 ? m : 'gpt-4.1-mini'
}

/** Returns a language instruction line to append to any system prompt. */
function langInstruction(locale?: string): string {
  if (!locale) return ''
  const zh = locale.startsWith('zh')
  return zh
    ? '\nRespond entirely in Simplified Chinese (简体中文). Use standard financial terminology.'
    : '\nRespond in English.'
}

function getTemperature(): number {
  const n = Number(process.env.LLM_TEMPERATURE ?? '0.2')
  return Number.isFinite(n) && n >= 0 && n <= 2 ? n : 0.2
}

function fmtPct(v: number | null | undefined): string {
  if (typeof v !== 'number') return 'N/A'
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%'
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (typeof v !== 'number') return 'N/A'
  return v.toFixed(decimals)
}

function fallback(asset: Asset, metrics: KeyMetrics): string {
  const parts = [`${asset.symbol}${asset.name ? ` (${asset.name})` : ''} is trading at $${metrics.price.toFixed(2)}.`]
  if (typeof metrics.change_1d_pct === 'number') parts.push(`1-day change: ${fmtPct(metrics.change_1d_pct)}.`)
  if (typeof metrics.change_7d_pct === 'number') parts.push(`7-day change: ${fmtPct(metrics.change_7d_pct)}.`)
  return parts.join(' ')
}

/**
 * Builds a rich multi-dimensional context block for the LLM.
 * Every field is explicitly labeled and only included if available.
 */
function marketContext(asset: Asset, m: KeyMetrics): string {
  const lines: string[] = [
    `Symbol: ${asset.symbol}${asset.name ? ` (${asset.name})` : ''}`,
  ]
  if (asset.industry) lines.push(`Industry: ${asset.industry}`)

  lines.push(
    '',
    '── Price & Performance ──',
    `Current price:        $${fmtNum(m.price)}`,
    `1-day change:         ${fmtPct(m.change_1d_pct)}`,
    `5-day change:         ${fmtPct(m.change_7d_pct)}`,
  )

  if (m.high_52w != null || m.low_52w != null) {
    lines.push(
      `52-week high:         $${fmtNum(m.high_52w)}`,
      `52-week low:          $${fmtNum(m.low_52w)}`,
    )
    if (m.high_52w != null && m.low_52w != null) {
      const pctFrom52High = ((m.price - m.high_52w) / m.high_52w) * 100
      lines.push(`Distance from 52w high: ${fmtPct(pctFrom52High)}`)
    }
  }

  lines.push('', '── Fundamentals ──')
  if (m.market_cap_bn != null) lines.push(`Market cap:           $${fmtNum(m.market_cap_bn)}B`)
  if (m.pe_ratio != null)      lines.push(`P/E ratio (TTM):      ${fmtNum(m.pe_ratio)}x`)
  if (m.eps != null)           lines.push(`EPS (annual):         $${fmtNum(m.eps)}`)
  if (m.beta != null)          lines.push(`Beta:                 ${fmtNum(m.beta)} (market volatility relative to S&P 500)`)
  if (m.volume_10d_avg != null) lines.push(`Avg daily volume (10d): ${fmtNum(m.volume_10d_avg)}M shares`)

  if (m.analyst_rating) {
    lines.push('', '── Analyst Consensus ──', `Wall Street rating:   ${m.analyst_rating}`)
  }

  return lines.join('\n')
}

function knowledgeContext(terms: KnowledgeTerm[], locale?: string): string {
  if (terms.length === 0) return 'No matched knowledge base terms.'
  const zh = Boolean(locale?.startsWith('zh'))

  return terms.map((term) => {
    const termLabel = zh ? term.term_zh : term.term_en
    const def = zh ? term.definition_zh : term.definition_en
    const ex = zh ? term.example.zh : term.example.en
    const related = term.related_terms.join(', ') || 'N/A'
    return [
      `[KB-${term.id}] ${termLabel}`,
      `Category: ${term.category}`,
      `Definition: ${def}`,
      `Example: ${ex || 'N/A'}`,
      `Related: ${related}`,
    ].join('\n')
  }).join('\n\n')
}

async function callOpenAI(
  system: string,
  user: string,
  maxTokens = 400,
  history: HistoryMessage[] = [],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  // Keep the last 8 messages (4 turns) to bound token usage
  const trimmedHistory = history.slice(-8)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(),
      temperature: getTemperature(),
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        ...trimmedHistory,
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) return null
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return json.choices?.[0]?.message?.content?.trim() ?? null
}

export async function answerOpenQuery(input: OpenInput): Promise<LLMResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      summary: input.locale?.startsWith('zh')
        ? '当前缺少可用的市场数据与术语命中，且未配置 OPENAI_API_KEY。请补充股票代码或更具体的问题。'
        : 'No market data or glossary match was found, and OPENAI_API_KEY is missing. Please include a ticker or ask a more specific question.',
      used_llm: false,
      risk_note: 'General fallback response without market or glossary grounding.',
    }
  }

  const system = [
    'You are a financial assistant.',
    'If glossary excerpts are provided, prefer them and cite [KB-id] inline when used.',
    'If no market data is provided, avoid pretending to know live prices or company-specific metrics.',
    'Be explicit about uncertainty.',
    langInstruction(input.locale),
  ].join('\n')

  const user = [
    `User question: "${input.query}"`,
    '',
    'Financial glossary context (optional):',
    knowledgeContext(input.knowledge_terms ?? [], input.locale),
  ].join('\n')

  const text = await callOpenAI(system, user, 350, input.history)
  if (!text) {
    return {
      summary: input.locale?.startsWith('zh')
        ? '我没有足够的实时行情或术语命中来可靠回答该问题。请提供股票代码或更明确的金融术语。'
        : 'I do not have enough live market data or glossary matches to answer this reliably. Please provide a ticker or a clearer finance term.',
      used_llm: false,
      risk_note: 'LLM unavailable while handling open query.',
    }
  }

  return { summary: text, used_llm: true, risk_note: null }
}

// ── Market query: price + multi-dimensional snapshot ─────────────────────────

export async function summarizeIfPossible(input: MarketInput): Promise<LLMResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: null }
  }

  const system = [
    'You are a sharp financial assistant. Directly answer the user\'s question about a stock.',
    '',
    'Rules:',
    '1. Use ONLY the exact numbers provided — never invent or interpolate values.',
    '2. Lead with a direct answer to what was asked (price, change, trend).',
    '3. Add 1–2 sentences of context using the available metrics: 52-week range, P/E, beta, analyst rating, market cap.',
    '4. If the stock is near its 52-week high/low, mention it — this is meaningful context.',
    '5. If analyst rating is available, cite it.',
    '6. 3–4 sentences total. Conversational tone. No bullet points or headers.',
    '7. Never speculate about future prices.',
    langInstruction(input.locale),
  ].join('\n')

  const user = [
    `User question: "${input.query}"`,
    '',
    'Financial glossary context (optional):',
    knowledgeContext(input.knowledge_terms ?? [], input.locale),
    '',
    'Market data:',
    marketContext(input.asset, input.key_metrics),
  ].join('\n')

  const text = await callOpenAI(system, user, 400, input.history)
  if (!text) return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: null }
  return { summary: text, used_llm: true, risk_note: null }
}

// ── Knowledge query: explain a financial concept using the stock as a case study

export async function answerKnowledgeQuery(input: KnowledgeInput): Promise<LLMResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: 'LLM unavailable (missing OPENAI_API_KEY); showing price data only.' }
  }

  const system = [
    'You are a financial educator and analyst.',
    '',
    'Rules (strict):',
    '1. Use ONLY the provided "Knowledge base excerpts" for concept definitions. Do not add outside facts.',
    '2. If you use a knowledge excerpt, cite it inline like [KB-fin_001].',
    '3. If excerpts are insufficient, explicitly say the knowledge base does not contain enough information.',
    '4. You may use market numbers ONLY for the stock-specific example section.',
    '5. Never invent numbers or references.',
    '6. Keep answer concise: 4–6 sentences, no bullet points.',
    langInstruction(input.locale),
  ].join('\n')

  const user = [
    `User question: "${input.query}"`,
    '',
    'Knowledge base excerpts (the only allowed source for concepts):',
    knowledgeContext(input.knowledge_terms ?? [], input.locale),
    '',
    'Market data (use these numbers to make the answer concrete):',
    marketContext(input.asset, input.key_metrics),
  ].join('\n')

  const text = await callOpenAI(system, user, 500, input.history)
  if (!text) return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: null }
  return { summary: text, used_llm: true, risk_note: null }
}

// ── Analysis query: explain price movement, cite news, reference fundamentals ─

export async function analyzeWithLLM(input: AnalyzeInput): Promise<LLMResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: 'Analysis requires OPENAI_API_KEY; showing price data only.' }
  }

  const noNews = input.news.length === 0

  const system = [
    'You are a financial analyst providing a structured explanation of a stock\'s recent movement.',
    '',
    'Rules (strictly enforced):',
    '1. Directly answer the user\'s specific question — do not give a generic summary.',
    '2. Cite any causal news claims by index, e.g. [1]. Never fabricate events.',
    '3. Use the price data to provide context: where the stock sits relative to its 52-week range, beta vs the market, valuation (P/E).',
    '4. If analyst rating is provided, incorporate it to frame the sentiment.',
    '5. If no news is available, acknowledge it and explain what the price data alone suggests.',
    '6. 4–6 sentences. No bullet points.',
    langInstruction(input.locale),
  ].join('\n')

  const newsSection = noNews
    ? 'No recent news found for this period.'
    : input.news.map((n, i) => `[${i + 1}] "${n.title}" — ${n.source}`).join('\n')

  const user = [
    `User question: "${input.query}"`,
    '',
    'Financial glossary context (optional):',
    knowledgeContext(input.knowledge_terms ?? [], input.locale),
    '',
    'Market data:',
    marketContext(input.asset, input.key_metrics),
    '',
    'Recent news (last 7 days):',
    newsSection,
  ].join('\n')

  const text = await callOpenAI(system, user, 500, input.history)
  if (!text) {
    return { summary: fallback(input.asset, input.key_metrics), used_llm: false, risk_note: 'LLM call failed; showing price data only.' }
  }

  return {
    summary: text,
    used_llm: true,
    risk_note: noNews ? 'No recent news found; analysis based on price & fundamental data only — causal certainty is lower.' : null,
  }
}
