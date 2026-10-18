export type Freshness = "fresh" | "stale" | "unknown";

export function dataAgeSec(fetchedAt: number | null, now: number): number | null {
  return fetchedAt == null ? null : Math.max(0, (now - fetchedAt) / 1000);
}

export function freshness(ageSec: number | null, staleAfterSec: number): Freshness {
  if (ageSec == null) return "unknown";
  return ageSec > staleAfterSec ? "stale" : "fresh";
}
