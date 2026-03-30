import type { ChartPoint, KeyMetrics, SourceRef } from '../../shared/queryContract.js'

// ── Finnhub response shapes ──────────────────────────────────────────────────

export type FinnhubQuote = {
  c: number  // current price
  d: number  // change
  dp: number // change %
  h: number  // high
  l: number  // low
  o: number  // open
  pc: number // prev close
  t: number  // timestamp
}

export type FinnhubCandle = {
  c?: number[]
  t?: number[]
  s: 'ok' | 'no_data'
}

type FinnhubProfile = {
  name?: string
  finnhubIndustry?: string
  marketCapitalization?: number // USD millions
}

type FinnhubBasicFinancials = {
  metric?: {
    '52WeekHigh'?: number
    '52WeekLow'?: number
    '5DayPriceReturnDaily'?: number   // 5-trading-day % return — free tier alternative to candles
    '13WeekPriceReturnDaily'?: number // 13-week % return
    peBasicExclExtraTTM?: number
    epsBasicExclExtraAnnual?: number
    beta?: number
    '10DayAverageTradingVolume'?: number // millions
  }
}

type FinnhubRecommendation = {
  buy: number
  hold: number
  sell: number
  strongBuy: number
  strongSell: number
  period: string
}

// ── Pipeline result ───────────────────────────────────────────────────────────

export type MarketPipelineResult = {
  symbol: string
  asset_name: string | null
  industry: string | null
  key_metrics: KeyMetrics
  chart_data: ChartPoint[]
  sources: SourceRef[]
}

// ── Generic cache ─────────────────────────────────────────────────────────────

type CacheEntry<T> = { value: T; expiresAt: number }

function makeCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>()
  return {
    get(key: string): T | null {
      const entry = store.get(key)
      if (!entry) return null
      if (Date.now() > entry.expiresAt) { store.delete(key); return null }
      return entry.value
    },
    set(key: string, value: T) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },
  }
}

const quoteCache      = makeCache<FinnhubQuote>(15_000)          // 15 s
const profileCache    = makeCache<FinnhubProfile>(30 * 60_000)   // 30 min
const financialsCache = makeCache<FinnhubBasicFinancials>(30 * 60_000)
const recsCache       = makeCache<FinnhubRecommendation[]>(4 * 60 * 60_000) // 4 h

// ── Timeout + retry helpers ───────────────────────────────────────────────────

function withTimeout(ms: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) }
}

function getTimeoutMs(): number {
  const raw = process.env.REQUEST_TIMEOUT_MS
  const n = raw ? Number(raw) : 10000
  if (!Number.isFinite(n) || n <= 0) return 10000
  return Math.floor(n)
}

async function fetchWithRetry(url: string, maxRetries = 2, baseDelayMs = 200): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { signal, cleanup } = withTimeout(getTimeoutMs())
    try {
      const res = await fetch(url, { signal })
      cleanup()
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
        lastErr = new Error(`Finnhub HTTP ${res.status}`)
        continue
      }
      if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`)
      return res
    } catch (err) {
      cleanup()
      if ((err as Error)?.name === 'AbortError') throw new Error('Request timed out')
      lastErr = err
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
    }
  }
  throw lastErr ?? new Error('Fetch failed after retries')
}

async function fetchFinnhubJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url)
  return (await res.json()) as T
}

// ── Individual fetchers ───────────────────────────────────────────────────────

async function fetchQuote(symbol: string, token: string): Promise<FinnhubQuote> {
  const cached = quoteCache.get(symbol)
  if (cached) return cached
  const url = new URL('https://finnhub.io/api/v1/quote')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)
  const q = await fetchFinnhubJson<FinnhubQuote>(url.toString())
  quoteCache.set(symbol, q)
  return q
}

async function fetchDailyCandles(symbol: string, token: string, fromSec: number, toSec: number): Promise<FinnhubCandle> {
  const url = new URL('https://finnhub.io/api/v1/stock/candle')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('resolution', 'D')
  url.searchParams.set('from', String(fromSec))
  url.searchParams.set('to', String(toSec))
  url.searchParams.set('token', token)
  return fetchFinnhubJson<FinnhubCandle>(url.toString())
}

async function fetchProfile(symbol: string, token: string): Promise<FinnhubProfile> {
  const cached = profileCache.get(symbol)
  if (cached) return cached
  const url = new URL('https://finnhub.io/api/v1/stock/profile2')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)
  const profile = await fetchFinnhubJson<FinnhubProfile>(url.toString())
  profileCache.set(symbol, profile)
  return profile
}

async function fetchBasicFinancials(symbol: string, token: string): Promise<FinnhubBasicFinancials> {
  const cached = financialsCache.get(symbol)
  if (cached) return cached
  const url = new URL('https://finnhub.io/api/v1/stock/metric')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('metric', 'all')
  url.searchParams.set('token', token)
  const data = await fetchFinnhubJson<FinnhubBasicFinancials>(url.toString())
  financialsCache.set(symbol, data)
  return data
}

async function fetchRecommendations(symbol: string, token: string): Promise<FinnhubRecommendation[]> {
  const cached = recsCache.get(symbol)
  if (cached) return cached
  const url = new URL('https://finnhub.io/api/v1/stock/recommendation')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('token', token)
  const recs = await fetchFinnhubJson<FinnhubRecommendation[]>(url.toString())
  const result = Array.isArray(recs) ? recs : []
  recsCache.set(symbol, result)
  return result
}

// ── Metric computation ────────────────────────────────────────────────────────

function computeChangePct(now: number, prev: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return null
  return ((now - prev) / prev) * 100
}

function round2(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null
}

function round1(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null
}

function computeAnalystRating(recs: FinnhubRecommendation[]): string | null {
  if (!recs.length) return null
  const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 } = recs[0]!
  const total = strongBuy + buy + hold + sell + strongSell
  if (!total) return null
  const score = (strongBuy * 2 + buy * 1 + hold * 0 + sell * -1 + strongSell * -2) / total
  if (score > 1.2) return 'Strong Buy'
  if (score > 0.4) return 'Buy'
  if (score > -0.4) return 'Hold'
  if (score > -1.2) return 'Sell'
  return 'Strong Sell'
}

export function computeMarketMetrics(
  quote: FinnhubQuote,
  candle: FinnhubCandle | null,
  financials?: FinnhubBasicFinancials | null,
  recs?: FinnhubRecommendation[],
  marketCapBn?: number | null,
): KeyMetrics {
  const price = Number.isFinite(quote.c) && quote.c > 0 ? quote.c : quote.pc

  let change_1d_pct: number | null = null
  let change_7d_pct: number | null = null

  // 1D: use quote.dp directly — always present, no candles needed
  if (Number.isFinite(quote.dp) && quote.dp !== 0) {
    change_1d_pct = round1(quote.dp) ?? null
  } else if (Number.isFinite(quote.c) && Number.isFinite(quote.pc) && quote.pc > 0) {
    change_1d_pct = round1(computeChangePct(quote.c, quote.pc))
  }

  // 5D: use 5DayPriceReturnDaily from basic financials (free tier; candle endpoint requires premium)
  // Falls back to candle-derived 7D if somehow candles are available
  const m5d = financials?.metric?.['5DayPriceReturnDaily']
  if (typeof m5d === 'number' && Number.isFinite(m5d)) {
    change_7d_pct = round1(m5d)
  } else {
    const closes = candle?.c
    if (Array.isArray(closes) && closes.length >= 2) {
      const last = closes[closes.length - 1]!
      const idx7 = Math.max(0, closes.length - 8)
      change_7d_pct = computeChangePct(last, closes[idx7]!)
    }
  }

  const m = financials?.metric

  return {
    price: Math.round(price * 100) / 100,
    change_1d_pct: round1(change_1d_pct),
    change_7d_pct: round1(change_7d_pct),
    high_52w: round2(m?.['52WeekHigh']),
    low_52w: round2(m?.['52WeekLow']),
    pe_ratio: round2(m?.peBasicExclExtraTTM),
    eps: round2(m?.epsBasicExclExtraAnnual),
    beta: round2(m?.beta),
    market_cap_bn: marketCapBn ?? null,
    analyst_rating: recs ? computeAnalystRating(recs) : null,
    volume_10d_avg: round2(m?.['10DayAverageTradingVolume']),
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Scan chat history in reverse order to find the most recently mentioned ticker.
 * Used when a follow-up query like "why did it go up?" has no ticker of its own.
 */
export function extractSymbolFromHistory(
  history: Array<{ role?: string; content?: string }>,
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const content = history[i]?.content
    if (!content) continue
    const sym = extractSymbolFromQuery(content)
    if (sym) return sym
  }
  return null
}

export function extractSymbolFromQuery(query: string): string | null {
  const q = query.trim()
  const m1 = q.match(/\$([A-Za-z]{1,5}(?:\.[A-Za-z])?)/)
  if (m1?.[1]) return m1[1].toUpperCase()

  const tokens = q
    .replace(/[\u2019']/g, "'")
    .split(/[^A-Za-z.]+/)
    .filter(Boolean)

  for (const t of tokens) {
    if (/^[A-Za-z]{1,5}(?:\.[A-Za-z])?$/.test(t) && t === t.toUpperCase()) {
      return t.toUpperCase()
    }
  }
  return null
}

export function buildChartData(candle: FinnhubCandle | null): ChartPoint[] {
  if (!candle || candle.s !== 'ok') return []
  const closes = candle.c
  const timestamps = candle.t
  if (!Array.isArray(closes) || !Array.isArray(timestamps)) return []

  const points: ChartPoint[] = []
  for (let i = 0; i < Math.min(closes.length, timestamps.length); i++) {
    const p = closes[i]
    const t = timestamps[i]
    if (typeof p === 'number' && p > 0 && typeof t === 'number') {
      points.push({ t, p: Math.round(p * 100) / 100 })
    }
  }
  return points
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export async function runMarketPipeline(symbol: string): Promise<MarketPipelineResult> {
  const token = process.env.FINNHUB_API_KEY
  if (!token) throw new Error('Missing FINNHUB_API_KEY')

  // Note: /stock/candle requires a Finnhub premium plan — omitted here.
  // 5D change comes from /stock/metric (5DayPriceReturnDaily), available on free tier.
  const [quote, profileResult, financialsResult, recsResult] = await Promise.all([
    fetchQuote(symbol, token),
    fetchProfile(symbol, token).catch(() => null),
    fetchBasicFinancials(symbol, token).catch(() => null),
    fetchRecommendations(symbol, token).catch(() => []),
  ])

  // Finnhub returns marketCapitalization in USD millions → convert to billions
  const marketCapBn = profileResult?.marketCapitalization != null
    ? Math.round((profileResult.marketCapitalization / 1000) * 100) / 100
    : null

  const key_metrics = computeMarketMetrics(quote, null, financialsResult, recsResult ?? [], marketCapBn)
  const chart_data: ChartPoint[] = []  // candle endpoint requires premium plan

  const sources: SourceRef[] = [
    { type: 'market_api', name: 'Finnhub', url: 'https://finnhub.io/', meta: { symbol } },
  ]

  return {
    symbol,
    asset_name: profileResult?.name ?? null,
    industry: profileResult?.finnhubIndustry ?? null,
    key_metrics,
    chart_data,
    sources,
  }
}
