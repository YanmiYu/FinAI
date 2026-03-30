import type { NewsItem, SourceRef } from '../../shared/queryContract.js'

type FinnhubNewsItem = {
  category: string
  datetime: number
  headline: string
  id: number
  image: string
  related: string
  source: string
  summary: string
  url: string
}

export type NewsPipelineResult = {
  news: NewsItem[]
  sources: SourceRef[]
}

const EMPTY_NEWS_RESULT: NewsPipelineResult = { news: [], sources: [] }
export { EMPTY_NEWS_RESULT }

// 5-minute cache — news doesn't change by the second
type CacheEntry = { value: NewsPipelineResult; expiresAt: number }
const newsCache = new Map<string, CacheEntry>()
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000

function getCachedNews(key: string): NewsPipelineResult | null {
  const entry = newsCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    newsCache.delete(key)
    return null
  }
  return entry.value
}

function setCachedNews(key: string, value: NewsPipelineResult): void {
  newsCache.set(key, { value, expiresAt: Date.now() + NEWS_CACHE_TTL_MS })
}

function toDateString(tsMs: number): string {
  return new Date(tsMs).toISOString().slice(0, 10)
}

export async function fetchCompanyNews(
  symbol: string,
  token: string,
  maxItems = 5,
): Promise<NewsPipelineResult> {
  const cacheKey = `${symbol}:${toDateString(Date.now())}`
  const cached = getCachedNews(cacheKey)
  if (cached) return cached

  const toDate = toDateString(Date.now())
  const fromDate = toDateString(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const url = new URL('https://finnhub.io/api/v1/company-news')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('from', fromDate)
  url.searchParams.set('to', toDate)
  url.searchParams.set('token', token)

  const timeoutMs = (() => {
    const raw = process.env.REQUEST_TIMEOUT_MS
    const n = raw ? Number(raw) : 10000
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10000
  })()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let raw: FinnhubNewsItem[]
  try {
    const res = await fetch(url.toString(), { signal: controller.signal })
    if (!res.ok) throw new Error(`Finnhub news HTTP ${res.status}`)
    raw = (await res.json()) as FinnhubNewsItem[]
  } finally {
    clearTimeout(timer)
  }

  if (!Array.isArray(raw)) raw = []

  const news: NewsItem[] = raw
    .filter((item) => item.url && item.headline)
    .slice(0, maxItems)
    .map((item) => ({
      title: item.headline,
      url: item.url,
      published_at: item.datetime,
      source: item.source || 'Finnhub',
    }))

  const sources: SourceRef[] = news.length > 0
    ? [{ type: 'news_api', name: 'Finnhub News', url: 'https://finnhub.io/', meta: { symbol } }]
    : []

  const result: NewsPipelineResult = { news, sources }
  setCachedNews(cacheKey, result)
  return result
}
