type Props = {
  query: string
  setQuery: (v: string) => void
  loading: boolean
  canSubmit: boolean
  onSubmit: () => void
}

export default function QueryForm({
  query,
  setQuery,
  loading,
  canSubmit,
  onSubmit,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium text-zinc-300">
          Query
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit()
            }}
            placeholder="e.g., What's the current price of AAPL?"
            className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 outline-none ring-0 placeholder:text-zinc-500 focus:border-zinc-600"
          />
          <button
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className="h-11 shrink-0 rounded-xl bg-white px-4 text-sm font-medium text-zinc-950 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Running…' : 'Run'}
          </button>
        </div>
        <div className="text-xs text-zinc-400">
          Tip: use a ticker like <span className="font-mono">AAPL</span> or <span className="font-mono">$AAPL</span>. Press <span className="font-mono">Ctrl/⌘ + Enter</span> to submit.
        </div>
      </div>
    </div>
  )
}

