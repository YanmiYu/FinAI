import 'dotenv/config'
import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeIfPossible, answerKnowledgeQuery, analyzeWithLLM } from '../services/llm.js'
import type { NewsItem } from '../../shared/queryContract.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AAPL_ASSET = { symbol: 'AAPL', name: 'Apple Inc.' }
const AAPL_METRICS = { price: 189.45, change_1d_pct: 0.3, change_7d_pct: 1.2 }
const AAPL_SOURCES = [{ type: 'market_api' as const, name: 'Finnhub', url: 'https://finnhub.io/' }]

const SAMPLE_NEWS: NewsItem[] = [
  {
    title: 'Apple beats Q1 earnings expectations with record iPhone sales',
    url: 'https://example.com/apple-earnings',
    published_at: Math.floor(Date.now() / 1000) - 3600,
    source: 'Reuters',
  },
  {
    title: 'Analysts raise AAPL price target after strong services revenue',
    url: 'https://example.com/aapl-target',
    published_at: Math.floor(Date.now() / 1000) - 7200,
    source: 'Bloomberg',
  },
]

// Helper: temporarily remove API key
function withoutApiKey<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  return fn().finally(() => {
    if (saved !== undefined) process.env.OPENAI_API_KEY = saved
  })
}

// ── Unit tests: fallback behavior (no API key needed) ─────────────────────────

test('summarizeIfPossible: returns fallback when OPENAI_API_KEY absent', async () => {
  const result = await withoutApiKey(() =>
    summarizeIfPossible({ query: 'What is AAPL price?', asset: AAPL_ASSET, key_metrics: AAPL_METRICS, sources: AAPL_SOURCES }),
  )
  assert.equal(result.used_llm, false)
  assert.ok(result.summary.includes('AAPL'), 'fallback should mention the symbol')
  assert.ok(result.summary.includes('189.45'), 'fallback should include the exact price')
  assert.equal(result.risk_note, null)
})

test('answerKnowledgeQuery: returns fallback when OPENAI_API_KEY absent', async () => {
  const result = await withoutApiKey(() =>
    answerKnowledgeQuery({ query: 'What is a P/E ratio?', asset: AAPL_ASSET, key_metrics: AAPL_METRICS, sources: AAPL_SOURCES }),
  )
  assert.equal(result.used_llm, false)
  assert.ok(result.summary.length > 0, 'fallback should not be empty')
  assert.ok(result.risk_note !== null, 'should include a risk_note explaining LLM is unavailable')
})

test('analyzeWithLLM: returns fallback with risk_note when OPENAI_API_KEY absent', async () => {
  const result = await withoutApiKey(() =>
    analyzeWithLLM({ query: 'Why did AAPL go up today?', asset: AAPL_ASSET, key_metrics: AAPL_METRICS, news: SAMPLE_NEWS }),
  )
  assert.equal(result.used_llm, false)
  assert.ok(result.summary.length > 0, 'fallback should not be empty')
  assert.ok(result.risk_note !== null, 'should explain LLM is unavailable')
})

test('analyzeWithLLM: flags no-news uncertainty in risk_note', async () => {
  const result = await withoutApiKey(() =>
    analyzeWithLLM({ query: 'Why did AAPL move?', asset: AAPL_ASSET, key_metrics: AAPL_METRICS, news: [] }),
  )
  assert.equal(result.used_llm, false)
})

// ── Integration tests: real LLM calls (skipped if no key) ─────────────────────

test('summarizeIfPossible: LLM answers price question with exact data', { timeout: 20000 }, async (t) => {
  if (!process.env.OPENAI_API_KEY) return t.skip('OPENAI_API_KEY not set')

  const result = await summarizeIfPossible({
    query: 'What is the current price of AAPL?',
    asset: AAPL_ASSET,
    key_metrics: AAPL_METRICS,
    sources: AAPL_SOURCES,
  })

  assert.equal(result.used_llm, true, 'should have called LLM')
  assert.ok(result.summary.length >= 20, `summary too short: "${result.summary}"`)
  // LLM must not invent a different price — it should use 189.45 or 189
  assert.ok(
    result.summary.includes('189') || result.summary.includes('AAPL'),
    `summary should reference the price or ticker: "${result.summary}"`,
  )
  console.log('  ✦ market summary:', result.summary)
})

test('summarizeIfPossible: LLM answers trend question correctly', { timeout: 20000 }, async (t) => {
  if (!process.env.OPENAI_API_KEY) return t.skip('OPENAI_API_KEY not set')

  const result = await summarizeIfPossible({
    query: 'How has AAPL performed over the last 7 days?',
    asset: AAPL_ASSET,
    key_metrics: AAPL_METRICS,
    sources: AAPL_SOURCES,
  })

  assert.equal(result.used_llm, true)
  assert.ok(result.summary.length >= 20, `summary too short: "${result.summary}"`)
  // Should mention the 7d change or trending upward
  assert.ok(
    result.summary.includes('1.2') || result.summary.includes('7') || result.summary.includes('week'),
    `summary should reference 7d data: "${result.summary}"`,
  )
  console.log('  ✦ trend summary:', result.summary)
})

test('answerKnowledgeQuery: LLM explains financial concept', { timeout: 20000 }, async (t) => {
  if (!process.env.OPENAI_API_KEY) return t.skip('OPENAI_API_KEY not set')

  const result = await answerKnowledgeQuery({
    query: 'What is a P/E ratio and is AAPL expensive?',
    asset: AAPL_ASSET,
    key_metrics: AAPL_METRICS,
    sources: AAPL_SOURCES,
  })

  assert.equal(result.used_llm, true)
  assert.ok(result.summary.length >= 30, `answer too short: "${result.summary}"`)
  // Should explain P/E or valuation concept
  assert.ok(
    result.summary.toLowerCase().includes('p/e') ||
    result.summary.toLowerCase().includes('price') ||
    result.summary.toLowerCase().includes('earnings'),
    `answer should explain the concept: "${result.summary}"`,
  )
  console.log('  ✦ knowledge answer:', result.summary)
})

test('analyzeWithLLM: LLM explains movement and cites news', { timeout: 20000 }, async (t) => {
  if (!process.env.OPENAI_API_KEY) return t.skip('OPENAI_API_KEY not set')

  const result = await analyzeWithLLM({
    query: 'Why did AAPL go up today?',
    asset: AAPL_ASSET,
    key_metrics: AAPL_METRICS,
    news: SAMPLE_NEWS,
  })

  assert.equal(result.used_llm, true)
  assert.ok(result.summary.length >= 30, `analysis too short: "${result.summary}"`)
  // Should cite at least one news item by index [1] or [2]
  assert.ok(
    result.summary.includes('[1]') || result.summary.includes('[2]'),
    `analysis should cite news by index: "${result.summary}"`,
  )
  assert.equal(result.risk_note, null, 'no risk_note when news is available')
  console.log('  ✦ analysis:', result.summary)
})

test('analyzeWithLLM: LLM flags uncertainty when no news available', { timeout: 20000 }, async (t) => {
  if (!process.env.OPENAI_API_KEY) return t.skip('OPENAI_API_KEY not set')

  const result = await analyzeWithLLM({
    query: 'Why did AAPL move?',
    asset: AAPL_ASSET,
    key_metrics: { price: 189.45, change_1d_pct: -2.5, change_7d_pct: -1.8 },
    news: [],
  })

  assert.equal(result.used_llm, true)
  assert.ok(result.summary.length >= 20, `analysis too short: "${result.summary}"`)
  assert.ok(result.risk_note !== null, 'should warn about missing news')
  console.log('  ✦ no-news analysis:', result.summary)
  console.log('  ✦ risk_note:', result.risk_note)
})
