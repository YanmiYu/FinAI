import test from 'node:test'
import assert from 'node:assert/strict'
import { routeQuery } from '../services/router.js'

test('routes market queries by keyword', async () => {
  const r = await routeQuery("What's the price of AAPL?")
  assert.equal(r.query_type, 'market')
  assert.equal(r.method, 'rule')
})

test('routes knowledge queries by keyword', async () => {
  const r = await routeQuery('What is P/E ratio?')
  assert.equal(r.query_type, 'knowledge')
})

test('routes analysis queries by keyword', async () => {
  const r = await routeQuery('Why did AAPL go up today?')
  assert.equal(r.query_type, 'analysis')
})

test('defaults to market when no rule matches and LLM key absent', async () => {
  const saved = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  const r = await routeQuery('Tell me about AAPL')
  assert.equal(r.query_type, 'market')
  assert.equal(r.method, 'llm_fallback')
  if (saved !== undefined) process.env.OPENAI_API_KEY = saved
})
