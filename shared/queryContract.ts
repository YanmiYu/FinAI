import { z } from 'zod'

export const SchemaVersion = 'v1' as const

export const QueryTypeSchema = z.enum(['market', 'analysis', 'knowledge'])
export type QueryType = z.infer<typeof QueryTypeSchema>

export const ConfidenceSchema = z.enum(['high', 'medium', 'low'])
export type Confidence = z.infer<typeof ConfidenceSchema>

export const HistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
})
export type HistoryMessage = z.infer<typeof HistoryMessageSchema>

export const QueryRequestSchema = z.object({
  query: z.string().trim().min(1),
  user_locale: z.string().trim().min(2).optional(),
  // Previous turns in the current chat session (last N exchanges)
  history: z.array(HistoryMessageSchema).max(20).optional(),
})
export type QueryRequest = z.infer<typeof QueryRequestSchema>

export const AssetSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  industry: z.string().optional().nullable(),
})
export type Asset = z.infer<typeof AssetSchema>

export const KeyMetricsSchema = z.object({
  price: z.number().nonnegative(),
  change_1d_pct: z.number().optional().nullable(),
  change_7d_pct: z.number().optional().nullable(),
  // Extended fundamental & technical metrics
  high_52w: z.number().optional().nullable(),
  low_52w: z.number().optional().nullable(),
  pe_ratio: z.number().optional().nullable(),
  eps: z.number().optional().nullable(),
  beta: z.number().optional().nullable(),
  market_cap_bn: z.number().optional().nullable(), // USD billions
  analyst_rating: z.string().optional().nullable(), // "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"
  volume_10d_avg: z.number().optional().nullable(), // shares, millions
})
export type KeyMetrics = z.infer<typeof KeyMetricsSchema>

export const ChartPointSchema = z.object({
  t: z.number().int(),
  p: z.number().nonnegative(),
})
export type ChartPoint = z.infer<typeof ChartPointSchema>

export const NewsItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  published_at: z.number().int(),
  source: z.string().min(1),
})
export type NewsItem = z.infer<typeof NewsItemSchema>

export const SourceRefSchema = z.object({
  type: z.enum(['market_api', 'news_api', 'internal']),
  name: z.string().min(1),
  url: z.string().url().optional(),
  meta: z.record(z.unknown()).optional(),
})
export type SourceRef = z.infer<typeof SourceRefSchema>

export const DebugStepNameSchema = z.enum([
  'ticker_extracted',
  'route_decision',
  'rag_retrieval',
  'market_api_called',
  'metrics_computed',
  'llm_called',
])
export type DebugStepName = z.infer<typeof DebugStepNameSchema>

export const DebugStepSchema = z.object({
  name: DebugStepNameSchema,
  ok: z.boolean(),
  dt_ms: z.number().int().nonnegative(),
  info: z.record(z.unknown()).optional(),
})
export type DebugStep = z.infer<typeof DebugStepSchema>

export const QuerySuccessResponseSchema = z.object({
  schema_version: z.literal(SchemaVersion),
  query_type: QueryTypeSchema,
  asset: AssetSchema,
  summary: z.string(),
  key_metrics: KeyMetricsSchema,
  chart_data: z.array(ChartPointSchema).default([]),
  news: z.array(NewsItemSchema).default([]),
  sources: z.array(SourceRefSchema),
  confidence: ConfidenceSchema,
  risk_note: z.string().optional().nullable(),
  trace: z.array(DebugStepSchema),
  correlation_id: z.string().min(1),
})
export type QuerySuccessResponse = z.infer<typeof QuerySuccessResponseSchema>

export const QueryErrorCodeSchema = z.enum([
  'ASSET_NOT_FOUND',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'INVALID_QUERY',
])
export type QueryErrorCode = z.infer<typeof QueryErrorCodeSchema>

export const QueryErrorResponseSchema = z.object({
  schema_version: z.literal(SchemaVersion),
  error: z.object({
    code: QueryErrorCodeSchema,
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
  }),
  trace: z.array(DebugStepSchema),
  correlation_id: z.string().min(1),
})
export type QueryErrorResponse = z.infer<typeof QueryErrorResponseSchema>

export const QueryApiResponseSchema = z.union([
  QuerySuccessResponseSchema,
  QueryErrorResponseSchema,
])
export type QueryApiResponse = z.infer<typeof QueryApiResponseSchema>

