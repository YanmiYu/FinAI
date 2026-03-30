import type { FinancialResponse } from "@/components/financial/ResponseCard";

const STORAGE_KEY = "finai_saved_queries";

export interface SavedQuery {
  id: string;
  savedAt: number;
  query: string;
  symbol: string;
  assetName: string;
  queryType: "market" | "analysis" | "knowledge";
  response: FinancialResponse;
}

export function loadSavedQueries(): SavedQuery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedQuery[];
  } catch {
    return [];
  }
}

export function saveQuery(query: string, response: FinancialResponse): SavedQuery {
  const all = loadSavedQueries();
  const entry: SavedQuery = {
    id: `sq_${Date.now()}`,
    savedAt: Date.now(),
    query,
    symbol: response.asset.symbol,
    assetName: response.asset.name,
    queryType: response.query_type,
    response,
  };
  const updated = [entry, ...all].slice(0, 50); // cap at 50 entries
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return entry;
}

export function deleteSavedQuery(id: string): SavedQuery[] {
  const updated = loadSavedQueries().filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
