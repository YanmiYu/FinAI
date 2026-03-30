import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import {
  QueryApiResponseSchema,
  QueryRequestSchema,
  type ChartPoint,
  type DebugStep,
  type HistoryMessage,
  type KeyMetrics,
  type NewsItem,
  type QueryApiResponse,
  type SourceRef,
} from '../../shared/queryContract.js'
import { routeQuery } from '../services/router.js'
import { extractSymbolFromQuery, extractSymbolFromHistory, runMarketPipeline } from '../services/market.js'
import { summarizeIfPossible, answerKnowledgeQuery, answerOpenQuery } from '../services/llm.js'
import { runAnalysisPipeline } from '../services/analysis.js'
import { retrieveKnowledgeTerms } from '../services/rag.js'

type PipelineResult = {
  symbol: string
  asset_name: string | null
  industry: string | null
  key_metrics: KeyMetrics
  chart_data: ChartPoint[]
  news: NewsItem[]
  sources: SourceRef[]
  summary: string
  used_llm: boolean
  risk_note: string | null
}

const router = Router()

function msSince(start: number): number {
  return Math.max(0, Math.floor(Date.now() - start))
}

function errorResponse(
  correlation_id: string,
  trace: DebugStep[],
  code: 'ASSET_NOT_FOUND' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'INVALID_QUERY',
  message: string,
  details?: Record<string, unknown>,
): QueryApiResponse {
  return {
    schema_version: 'v1',
    error: { code, message, details },
    trace,
    correlation_id,
  }
}

function respondJson(res: Response, status: number, payload: QueryApiResponse): void {
  if (res.headersSent) return
  res.status(status).json(payload)
}

const EMPTY_METRICS: KeyMetrics = {
  price: 0,
  change_1d_pct: null,
  change_7d_pct: null,
  high_52w: null,
  low_52w: null,
  pe_ratio: null,
  eps: null,
  beta: null,
  market_cap_bn: null,
  analyst_rating: null,
  volume_10d_avg: null,
}

router.post('/query', async (req: Request, res: Response) => {
  const correlation_id = crypto.randomUUID()
  const trace: DebugStep[] = []

  const parsed = QueryRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    respondJson(res, 400, errorResponse(correlation_id, trace, 'INVALID_QUERY', 'Invalid request body'))
    return
  }

  const query   = parsed.data.query
  const history: HistoryMessage[] = parsed.data.history ?? []
  const locale  = parsed.data.user_locale

  // Step 1: extract ticker — fall back to most recent symbol in history
  const s0 = Date.now()
  const symbol = extractSymbolFromQuery(query) ?? extractSymbolFromHistory(history)
  trace.push({
    name: 'ticker_extracted',
    ok: Boolean(symbol),
    dt_ms: msSince(s0),
    info: symbol ? { symbol, from_history: !extractSymbolFromQuery(query) } : undefined,
  })

  // Step 2: route query
  const s1 = Date.now()
  const { query_type, method, matched } = await routeQuery(query)
  trace.push({
    name: 'route_decision',
    ok: true,
    dt_ms: msSince(s1),
    info: { method, matched: matched ?? query_type, query_type },
  })

  // Step 3: retrieve glossary context for all query types (market/analysis/knowledge)
  const sRag = Date.now()
  let retrievedTerms: Awaited<ReturnType<typeof retrieveKnowledgeTerms>>['terms'] = []
  let ragSources: SourceRef[] = []
  try {
    const retrieved = await retrieveKnowledgeTerms(query, { topK: 3 })
    retrievedTerms = retrieved.terms
    ragSources = retrieved.sources
    trace.push({
      name: 'rag_retrieval',
      ok: true,
      dt_ms: msSince(sRag),
      info: {
        matched_terms: retrieved.terms.map((t) => t.id),
        count: retrieved.terms.length,
        applied_to: query_type,
      },
    })
  } catch (err) {
    trace.push({
      name: 'rag_retrieval',
      ok: false,
      dt_ms: msSince(sRag),
      info: {
        message: err instanceof Error ? err.message : 'rag retrieval failed',
        applied_to: query_type,
      },
    })
  }

  // Step 3 + 4 + 5: pipeline (branches on query_type)
  let pipelineResult: PipelineResult

  if (symbol && query_type === 'analysis') {
    const s2 = Date.now()
    try {
      const result = await runAnalysisPipeline(symbol, query, history, locale, retrievedTerms)
      trace.push({ name: 'market_api_called', ok: true, dt_ms: msSince(s2), info: { provider: 'finnhub', news_fetched: result.news.length } })
      trace.push({ name: 'metrics_computed', ok: true, dt_ms: 0 })
      trace.push({ name: 'llm_called', ok: true, dt_ms: 0, info: { used_llm: result.used_llm } })
      pipelineResult = result
    } catch (e) {
      trace.push({ name: 'market_api_called', ok: false, dt_ms: msSince(s2), info: { provider: 'finnhub' } })
      const msg = e instanceof Error ? e.message : 'Analysis pipeline error'
      respondJson(res, 502, errorResponse(correlation_id, trace, 'PROVIDER_ERROR', msg, { provider: 'finnhub' }))
      return
    }
  } else if (symbol) {
    const s2 = Date.now()
    let market
    try {
      market = await runMarketPipeline(symbol)
      trace.push({ name: 'market_api_called', ok: true, dt_ms: msSince(s2), info: { provider: 'finnhub' } })
    } catch (e) {
      trace.push({ name: 'market_api_called', ok: false, dt_ms: msSince(s2), info: { provider: 'finnhub' } })
      const msg = e instanceof Error ? e.message : 'Market provider error'
      respondJson(res, 502, errorResponse(correlation_id, trace, 'PROVIDER_ERROR', msg, { provider: 'finnhub' }))
      return
    }

    trace.push({ name: 'metrics_computed', ok: true, dt_ms: 0 })

    const s4 = Date.now()
    const asset = { symbol: market.symbol, name: market.asset_name ?? undefined, industry: market.industry ?? undefined }
    const llmInput = { query, asset, key_metrics: market.key_metrics, sources: market.sources, history, locale }
    let answered
    if (query_type === 'knowledge') {
      answered = await answerKnowledgeQuery({ ...llmInput, knowledge_terms: retrievedTerms })
    } else {
      answered = await summarizeIfPossible({ ...llmInput, knowledge_terms: retrievedTerms })
    }
    trace.push({ name: 'llm_called', ok: true, dt_ms: msSince(s4), info: { used_llm: answered.used_llm, query_type } })

    pipelineResult = {
      symbol: market.symbol,
      asset_name: market.asset_name,
      industry: market.industry,
      key_metrics: market.key_metrics,
      chart_data: market.chart_data,
      news: [],
      sources: market.sources,
      summary: answered.summary,
      used_llm: answered.used_llm,
      risk_note: answered.risk_note ?? (answered.used_llm ? null : 'LLM unavailable (missing OPENAI_API_KEY); showing deterministic summary.'),
    }
  } else {
    // No ticker found:
    // - if glossary terms matched => run glossary-grounded knowledge response
    // - if nothing matched => run open LLM response
    const s4 = Date.now()
    const asset = { symbol: 'UNKNOWN' }
    const answered = retrievedTerms.length > 0
      ? await answerKnowledgeQuery({
          query,
          asset,
          key_metrics: EMPTY_METRICS,
          sources: [],
          history,
          locale,
          knowledge_terms: retrievedTerms,
        })
      : await answerOpenQuery({
          query,
          history,
          locale,
          knowledge_terms: retrievedTerms,
        })

    trace.push({
      name: 'llm_called',
      ok: true,
      dt_ms: msSince(s4),
      info: {
        used_llm: answered.used_llm,
        query_type,
        no_symbol: true,
        used_glossary_only: retrievedTerms.length > 0,
      },
    })

    pipelineResult = {
      symbol: 'UNKNOWN',
      asset_name: null,
      industry: null,
      key_metrics: EMPTY_METRICS,
      chart_data: [],
      news: [],
      sources: [],
      summary: answered.summary,
      used_llm: answered.used_llm,
      risk_note: answered.risk_note,
    }
  }

  const confidence =
    typeof pipelineResult.key_metrics.change_7d_pct === 'number' ? 'high' : 'medium'

  const success: QueryApiResponse = {
    schema_version: 'v1',
    query_type,
    asset: {
      symbol: pipelineResult.symbol,
      name: pipelineResult.asset_name ?? undefined,
      industry: pipelineResult.industry ?? undefined,
    },
    summary: pipelineResult.summary,
    key_metrics: pipelineResult.key_metrics,
    chart_data: pipelineResult.chart_data,
    news: pipelineResult.news,
    sources: [
      ...pipelineResult.sources,
        ...ragSources,
      { type: 'internal', name: 'router', meta: { method, matched: matched ?? query_type } },
    ],
    confidence,
    risk_note: pipelineResult.risk_note,
    trace,
    correlation_id,
  }

  const validated = QueryApiResponseSchema.safeParse(success)
  if (!validated.success) {
    respondJson(res, 500, errorResponse(correlation_id, trace, 'PROVIDER_ERROR', 'Response schema validation failed'))
    return
  }

  if (res.headersSent) return
  res.status(200).json(validated.data)
})

export default router
