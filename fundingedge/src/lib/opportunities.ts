import { bestConfig, evaluate, spreadInfo, type ConfigResult } from "./calc/funding";
import { dataAgeSec, freshness, type Freshness } from "./calc/freshness";
import { buildCandidates, type Candidate } from "./calc/matching";
import type { Settings } from "./settings";
import type { Snapshot } from "./types";

export interface Row {
  cand: Candidate;
  best: ConfigResult;
  spreadPer8h: number;
  rawSpread: number;
  ageSec: number | null;
  fresh: Freshness;
  minVolume: number | null;
}

export function computeRows(snap: Snapshot, s: Settings, now: number) {
  const { candidates, exclusions } = buildCandidates(snap.markets);
  const rows: Row[] = [];
  let incomplete = 0;
  for (const c of candidates) {
    const { a, b } = c;
    if (a.fundingRate == null || b.fundingRate == null || a.nextFundingTime == null || b.nextFundingTime == null ||
        a.fundingIntervalHours == null || b.fundingIntervalHours == null) { incomplete++; continue; }
    const la = { rate: a.fundingRate, nextFundingTime: a.nextFundingTime, intervalHours: a.fundingIntervalHours };
    const lb = { rate: b.fundingRate, nextFundingTime: b.nextFundingTime, intervalHours: b.fundingIntervalHours };
    const best = bestConfig(evaluate({
      a: la, b: lb, notionalA: s.notionalUsd, notionalB: s.notionalUsd,
      fees: { takerA: s.fees[a.exchange], takerB: s.fees[b.exchange] }, otherCostsUsd: s.otherCostsUsd, horizon: s.horizon, now,
    }));
    const sp = spreadInfo(la, lb);
    const age = Math.max(dataAgeSec(a.fetchedAt, now) ?? Infinity, dataAgeSec(b.fetchedAt, now) ?? Infinity);
    const ageSec = Number.isFinite(age) ? age : null;
    rows.push({
      cand: c, best, spreadPer8h: Math.abs(sp.per8h), rawSpread: sp.perEvent, ageSec,
      fresh: freshness(ageSec, snap.staleAfterSec),
      minVolume: a.volume24hQuote != null && b.volume24hQuote != null ? Math.min(a.volume24hQuote, b.volume24hQuote) : null,
    });
  }
  return { rows, incomplete, exclusions, total: candidates.length };
}

export function filterRows(rows: Row[], s: Settings): Row[] {
  const q = s.search.trim().toUpperCase();
  return rows.filter((r) => {
    if (!s.exchanges.includes(r.cand.a.exchange) || !s.exchanges.includes(r.cand.b.exchange)) return false;
    if (q && !r.cand.base.includes(q)) return false;
    if (r.spreadPer8h * 100 < s.minSpreadPct) return false;
    if (r.best.netReturn < s.minNetUsd) return false;
    if (r.best.fees > s.maxFeesUsd) return false;
    if (s.minVolumeUsd > 0 && (r.minVolume == null || r.minVolume < s.minVolumeUsd)) return false;
    if (r.ageSec == null || r.ageSec > s.maxAgeSec) return false;
    return true;
  });
}
