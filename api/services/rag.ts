import type { SourceRef } from '../../shared/queryContract.js'
import { getAdminDb, hasFirebaseAdminConfig } from './firebaseAdmin.js'

export interface KnowledgeTerm {
  id: string
  term_en: string
  term_zh: string
  definition_en: string
  definition_zh: string
  category: string
  keywords: string[]
  example: {
    en: string
    zh: string
  }
  related_terms: string[]
}

type ScoredTerm = {
  score: number
  term: KnowledgeTerm
}

export type RetrievedKnowledge = {
  terms: KnowledgeTerm[]
  sources: SourceRef[]
}

const COLLECTION = 'financial_knowledge_base'
const MIN_MATCH_SCORE = 6

function normalize(text: string): string {
  return text.toLowerCase().trim()
}

function tokenize(text: string): string[] {
  const t = normalize(text)
  if (!t) return []
  return t
    .split(/[\s,.;:!?()"'`/\\|[\]{}<>+-]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 2)
}

function termText(term: KnowledgeTerm): string {
  return [
    term.term_en,
    term.term_zh,
    term.definition_en,
    term.definition_zh,
    term.category,
    ...term.keywords,
    ...term.related_terms,
    term.example.en,
    term.example.zh,
  ].join(' ')
}

function scoreTerm(query: string, term: KnowledgeTerm): number {
  const q = normalize(query)
  const tokens = tokenize(query)

  let score = 0

  const en = normalize(term.term_en)
  const zh = normalize(term.term_zh)
  const cat = normalize(term.category)
  const keywords = term.keywords.map(normalize)
  const related = term.related_terms.map(normalize)
  const haystack = normalize(termText(term))

  if (q === en || q === zh) score += 30
  if (q.includes(en) || q.includes(zh) || en.includes(q) || zh.includes(q)) score += 16
  if (keywords.some((k) => q.includes(k) || k.includes(q))) score += 10
  if (related.some((r) => q.includes(r) || r.includes(q))) score += 6
  if (q.includes(cat)) score += 3

  for (const token of tokens) {
    if (token === en || token === zh) score += 10
    else if (en.includes(token) || zh.includes(token)) score += 6
    else if (keywords.some((k) => k.includes(token))) score += 4
    else if (related.some((r) => r.includes(token))) score += 2
    else if (haystack.includes(token)) score += 1
  }

  return score
}

function toKnowledgeTerm(data: Record<string, unknown>, fallbackId: string): KnowledgeTerm | null {
  const term_en = typeof data.term_en === 'string' ? data.term_en : null
  const term_zh = typeof data.term_zh === 'string' ? data.term_zh : null
  const definition_en = typeof data.definition_en === 'string' ? data.definition_en : null
  const definition_zh = typeof data.definition_zh === 'string' ? data.definition_zh : null
  const category = typeof data.category === 'string' ? data.category : 'General'
  const keywords = Array.isArray(data.keywords) ? data.keywords.filter((x): x is string => typeof x === 'string') : []
  const related_terms = Array.isArray(data.related_terms) ? data.related_terms.filter((x): x is string => typeof x === 'string') : []

  const rawExample = (data.example && typeof data.example === 'object') ? data.example as Record<string, unknown> : {}
  const exEn = typeof rawExample.en === 'string' ? rawExample.en : ''
  const exZh = typeof rawExample.zh === 'string' ? rawExample.zh : ''

  if (!term_en || !term_zh || !definition_en || !definition_zh) return null

  return {
    id: typeof data.id === 'string' ? data.id : fallbackId,
    term_en,
    term_zh,
    definition_en,
    definition_zh,
    category,
    keywords,
    example: { en: exEn, zh: exZh },
    related_terms,
  }
}

export async function retrieveKnowledgeTerms(
  query: string,
  opts?: { topK?: number },
): Promise<RetrievedKnowledge> {
  if (!hasFirebaseAdminConfig()) {
    return { terms: [], sources: [] }
  }

  const topK = Math.max(1, Math.min(8, opts?.topK ?? 3))
  const db = getAdminDb()
  const snap = await Promise.race([
    db.collection(COLLECTION).get(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('RAG retrieval timed out')), 4000)
    }),
  ])
  const scored: ScoredTerm[] = []

  for (const d of snap.docs) {
    const maybeTerm = toKnowledgeTerm(d.data() as Record<string, unknown>, d.id)
    if (!maybeTerm) continue
    const score = scoreTerm(query, maybeTerm)
    if (score >= MIN_MATCH_SCORE) scored.push({ score, term: maybeTerm })
  }

  scored.sort((a, b) => b.score - a.score || a.term.id.localeCompare(b.term.id))
  const terms = scored.slice(0, topK).map((x) => x.term)

  const sources: SourceRef[] = terms.map((term) => ({
    type: 'internal',
    name: 'financial_knowledge_base',
    meta: {
      kb_id: term.id,
      term_en: term.term_en,
      term_zh: term.term_zh,
      category: term.category,
      definition_en: term.definition_en,
      definition_zh: term.definition_zh,
      example_en: term.example.en,
      example_zh: term.example.zh,
      related_terms: term.related_terms,
    },
  }))

  return { terms, sources }
}

