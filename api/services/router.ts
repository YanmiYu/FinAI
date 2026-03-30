import type { QueryType } from '../../shared/queryContract.js'

const marketKeywords = [
  'price',
  'quote',
  'current',
  'now',
  '$',
  'close',
  'open',
  'high',
  'low',
  'today',
  '1d',
  '7d',
  'trend',
]

const knowledgeKeywords = ['what is', 'definition', 'explain', 'meaning', 'term']

const analysisKeywords = ['why', 'cause', 'reason', 'because', 'due to', 'drivers']

export type RouteMethod = 'rule' | 'llm_fallback'

export type RouteDecision = {
  query_type: QueryType
  method: RouteMethod
  matched?: string
}

function ruleRoute(query: string): RouteDecision | null {
  const q = query.trim().toLowerCase()

  if (analysisKeywords.some((k) => q.includes(k))) {
    return { query_type: 'analysis', method: 'rule', matched: 'analysis' }
  }
  if (marketKeywords.some((k) => q.includes(k))) {
    return { query_type: 'market', method: 'rule', matched: 'market' }
  }
  if (knowledgeKeywords.some((k) => q.includes(k))) {
    return { query_type: 'knowledge', method: 'rule', matched: 'knowledge' }
  }

  return null
}

async function llmFallbackRoute(query: string): Promise<QueryType> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return 'market'

  const model = process.env.LLM_MODEL?.trim() || 'gpt-4.1-mini'

  const system =
    'Classify the financial query into exactly one category: "market", "analysis", or "knowledge". ' +
    'Respond with ONLY the category word. No explanation.'

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 10,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!res.ok) return 'market'

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const raw = json.choices?.[0]?.message?.content?.trim().toLowerCase()
    if (raw === 'market' || raw === 'analysis' || raw === 'knowledge') {
      return raw
    }
  } catch {
    // Fall through to default
  }

  return 'market'
}

export async function routeQuery(query: string): Promise<RouteDecision> {
  const ruleResult = ruleRoute(query)
  if (ruleResult) return ruleResult

  const query_type = await llmFallbackRoute(query)
  return { query_type, method: 'llm_fallback' }
}
