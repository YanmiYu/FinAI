import type { ChartPoint, HistoryMessage, KeyMetrics, NewsItem, SourceRef } from '../../shared/queryContract.js'
import type { KnowledgeTerm } from './rag.js'
import { runMarketPipeline } from './market.js'
import { EMPTY_NEWS_RESULT, fetchCompanyNews } from './news.js'
import { analyzeWithLLM } from './llm.js'

export type AnalysisPipelineResult = {
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

export async function runAnalysisPipeline(
  symbol: string,
  query: string,
  history: HistoryMessage[] = [],
  locale?: string,
  knowledgeTerms: KnowledgeTerm[] = [],
): Promise<AnalysisPipelineResult> {
  const token = process.env.FINNHUB_API_KEY
  if (!token) throw new Error('Missing FINNHUB_API_KEY')

  // Fetch market data and news in parallel
  const [market, newsResult] = await Promise.all([
    runMarketPipeline(symbol),
    fetchCompanyNews(symbol, token, 5).catch(() => EMPTY_NEWS_RESULT),
  ])

  const asset = { symbol: market.symbol, name: market.asset_name ?? undefined, industry: market.industry ?? undefined }
  const llmResult = await analyzeWithLLM({
    query,
    asset,
    key_metrics: market.key_metrics,
    news: newsResult.news,
    history,
    locale,
    knowledge_terms: knowledgeTerms,
  })

  const allSources: SourceRef[] = [...market.sources, ...newsResult.sources]

  return {
    symbol: market.symbol,
    asset_name: market.asset_name,
    industry: market.industry,
    key_metrics: market.key_metrics,
    chart_data: market.chart_data,
    news: newsResult.news,
    sources: allSources,
    summary: llmResult.summary,
    used_llm: llmResult.used_llm,
    risk_note: llmResult.risk_note,
  }
}
