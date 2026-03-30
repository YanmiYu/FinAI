import { useMemo, useState } from 'react'
import { QueryApiResponseSchema, type QueryApiResponse } from '@shared/queryContract'
import QueryForm from '@/components/QueryForm'
import ResultRenderer from '@/components/ResultRenderer'

export default function Home() {
  const [query, setQuery] = useState("What's the current price of AAPL?")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<QueryApiResponse | null>(null)

  const canSubmit = useMemo(() => query.trim().length > 0 && !loading, [query, loading])

  async function onSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, user_locale: navigator.language }),
      })
      const json = (await res.json()) as unknown
      const parsed = QueryApiResponseSchema.safeParse(json)
      if (!parsed.success) {
        setError('Response did not match v1 schema')
        return
      }
      setData(parsed.data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">Financial Asset QA (v1)</h1>
          <p className="text-sm text-zinc-300">
            Single entrypoint <span className="font-mono">POST /api/query</span>, strict JSON contract, deterministic router, market-first.
          </p>
        </header>

        <QueryForm
          query={query}
          setQuery={setQuery}
          loading={loading}
          canSubmit={canSubmit}
          onSubmit={onSubmit}
        />

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {data ? <ResultRenderer data={data} /> : null}
      </div>
    </div>
  )
}
