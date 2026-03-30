import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChartData,
  computeMarketMetrics,
  extractSymbolFromQuery,
  type FinnhubCandle,
  type FinnhubQuote,
} from '../services/market.js'

test('extracts ticker from $ prefix', () => {
  assert.equal(extractSymbolFromQuery('price of $aapl'), 'AAPL')
})

test('extracts uppercase token ticker', () => {
  assert.equal(extractSymbolFromQuery('What is AAPL price?'), 'AAPL')
})

test('buildChartData returns empty for null candle', () => {
  assert.deepEqual(buildChartData(null), [])
})

test('buildChartData maps close+timestamp pairs to ChartPoints', () => {
  const candle: FinnhubCandle = {
    s: 'ok',
    c: [100, 105, 102],
    t: [1000, 2000, 3000],
  }
  const pts = buildChartData(candle)
  assert.equal(pts.length, 3)
  assert.equal(pts[0]!.t, 1000)
  assert.equal(pts[0]!.p, 100)
  assert.equal(pts[2]!.p, 102)
})

test('computes 1d and 7d percent changes from candles', () => {
  const quote: FinnhubQuote = {
    c: 10,
    d: 0,
    dp: 0,
    h: 0,
    l: 0,
    o: 0,
    pc: 9,
    t: 0,
  }
  const candle: FinnhubCandle = {
    s: 'ok',
    c: [1, 2, 3, 4, 5, 6, 7, 8, 10],
  }

  const m = computeMarketMetrics(quote, candle)
  assert.equal(m.price, 10)
  assert.equal(m.change_1d_pct, 25)
  assert.equal(m.change_7d_pct, 400)
})
