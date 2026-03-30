import {
  QueryErrorResponseSchema,
  type ChartPoint,
  type QueryApiResponse,
  type QueryErrorResponse,
  type QuerySuccessResponse,
} from '@shared/queryContract'

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function Metric({ label, value, positive }: { label: string; value: string; positive?: boolean | null }) {
  const color =
    positive === true ? 'text-emerald-400' :
    positive === false ? 'text-red-400' :
    'text-zinc-50'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className={`mt-1 text-sm font-medium ${color}`}>{value}</div>
    </div>
  )
}

function Sparkline({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null

  const W = 400
  const H = 80
  const PAD = 4

  const prices = points.map((p) => p.p)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const toX = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const toY = (p: number) => PAD + (1 - (p - minP) / range) * (H - PAD * 2)

  const d = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.p).toFixed(1)}`)
    .join(' ')

  const fillD = `${d} L ${toX(points.length - 1).toFixed(1)} ${H} L ${toX(0).toFixed(1)} ${H} Z`

  const isUp = prices[prices.length - 1]! >= prices[0]!
  const stroke = isUp ? '#34d399' : '#f87171'
  const fill = isUp ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)'

  const first = points[0]!
  const last = points[points.length - 1]!
  const fmtDate = (t: number) =>
    new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-50">Price (14d)</div>
        <div className="text-xs text-zinc-400">
          {fmtDate(first.t)} → {fmtDate(last.t)}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 80 }}
        preserveAspectRatio="none"
      >
        <path d={fillD} fill={fill} />
        <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>${minP.toFixed(2)}</span>
        <span>${maxP.toFixed(2)}</span>
      </div>
    </div>
  )
}

export default function ResultRenderer({ data }: { data: QueryApiResponse }) {
  const isError = (d: QueryApiResponse): d is QueryErrorResponse =>
    QueryErrorResponseSchema.safeParse(d).success

  if (isError(data)) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-medium text-zinc-50">Error</div>
        <div className="mt-2 text-sm text-zinc-200">
          <span className="font-mono">{data.error.code}</span>: {data.error.message}
        </div>
        <div className="mt-3 text-xs text-zinc-400">
          correlation_id: <span className="font-mono">{data.correlation_id}</span>
        </div>
        <div className="mt-4 grid gap-3">
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-300">Trace</div>
            <JsonBlock value={data.trace} />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-300">Raw JSON</div>
            <JsonBlock value={data} />
          </div>
        </div>
      </div>
    )
  }

  const ok = data as QuerySuccessResponse

  const m = ok.key_metrics
  const fPct = (v: number | null | undefined) =>
    typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '—'

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">Asset</div>
            <div className="text-sm font-medium text-zinc-50">{ok.asset.symbol}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-400">Confidence</div>
            <div className="text-sm font-medium text-zinc-50">{ok.confidence}</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100">
          {ok.summary}
        </div>

        {ok.risk_note ? (
          <div className="mt-3 text-xs text-zinc-400">{ok.risk_note}</div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Price" value={`$${m.price.toFixed(2)}`} />
        <Metric
          label="Change (1d)"
          value={fPct(m.change_1d_pct)}
          positive={typeof m.change_1d_pct === 'number' ? m.change_1d_pct >= 0 : null}
        />
        <Metric
          label="Change (7d)"
          value={fPct(m.change_7d_pct)}
          positive={typeof m.change_7d_pct === 'number' ? m.change_7d_pct >= 0 : null}
        />
      </div>

      {ok.chart_data.length >= 2 ? (
        <Sparkline points={ok.chart_data} />
      ) : null}

      {ok.news.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 text-sm font-medium text-zinc-50">
            Recent News
            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-normal text-zinc-400">
              {ok.news.length}
            </span>
          </div>
          <div className="grid gap-2">
            {ok.news.map((item, idx) => {
              const date = new Date(item.published_at * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
              return (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-600"
                >
                  <div className="text-xs font-medium text-zinc-100 group-hover:text-white leading-snug">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{date}</span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-medium text-zinc-50">Sources</div>
        <div className="mt-2 grid gap-2">
          {ok.sources.map((s, idx) => (
            <div
              key={`${s.type}-${s.name}-${idx}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-zinc-50">{s.name}</div>
                <div className="font-mono text-zinc-400">{s.type}</div>
              </div>
              {s.url ? (
                <a
                  className="mt-1 block truncate text-zinc-300 underline underline-offset-2 hover:text-white"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.url}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm font-medium text-zinc-50">Trace</div>
          <div className="mt-3 grid gap-2">
            {ok.trace.map((t, idx) => (
              <div
                key={`${t.name}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
              >
                <div className="font-mono text-zinc-200">{t.name}</div>
                <div className="flex items-center gap-3">
                  <div className={t.ok ? 'text-emerald-300' : 'text-red-300'}>
                    {t.ok ? 'ok' : 'fail'}
                  </div>
                  <div className="font-mono text-zinc-400">{t.dt_ms}ms</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-zinc-400">
            correlation_id: <span className="font-mono">{ok.correlation_id}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm font-medium text-zinc-50">Raw JSON</div>
          <div className="mt-3">
            <JsonBlock value={ok} />
          </div>
        </div>
      </div>
    </div>
  )
}
