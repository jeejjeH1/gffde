import type { FundingPoint } from "../types";

export interface SpreadPoint { ts: number; value: number }

/**
 * Historical spread between two legs with different schedules: at each event
 * timestamp of either series, take the most recent known rate of each leg (step-hold)
 * and difference their 8h-normalized rates. Points before both series have started
 * are omitted. Output is derived analytics, not an exchange-reported figure.
 */
export function spreadSeries(a: FundingPoint[], b: FundingPoint[], intervalA: number, intervalB: number): SpreadPoint[] {
  if (!a.length || !b.length || !(intervalA > 0) || !(intervalB > 0)) return [];
  const times = [...new Set([...a.map((p) => p.ts), ...b.map((p) => p.ts)])].sort((x, y) => x - y);
  const out: SpreadPoint[] = [];
  let ia = -1, ib = -1;
  for (const t of times) {
    while (ia + 1 < a.length && a[ia + 1].ts <= t) ia++;
    while (ib + 1 < b.length && b[ib + 1].ts <= t) ib++;
    if (ia < 0 || ib < 0) continue;
    out.push({ ts: t, value: a[ia].rate * (8 / intervalA) - b[ib].rate * (8 / intervalB) });
  }
  return out;
}
