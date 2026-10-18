import type { Maybe, PerpMarket } from "../types";

export interface Candidate {
  id: string;
  base: string;
  a: PerpMarket;
  b: PerpMarket;
}

export interface Exclusion {
  base: string;
  exchange: PerpMarket["exchange"];
  nativeSymbol: string;
  reason: string;
}

/** Max tolerated relative divergence between normalized mark prices. */
export const MAX_PRICE_DIVERGENCE = 0.05;

export function normalizedPrice(m: PerpMarket): Maybe<number> {
  return m.markPrice != null && m.markPrice > 0 ? m.markPrice / m.priceMultiplier : null;
}

/**
 * Two markets are comparable only if they are both linear, tradable, share the
 * same underlying/quote/settlement currency and (when prices are known) their
 * multiplier-normalized prices agree. The last check guards against identical
 * tickers that denote different assets on different venues.
 */
export function compatibility(x: PerpMarket, y: PerpMarket): { ok: true } | { ok: false; reason: string } {
  if (x.exchange === y.exchange) return { ok: false, reason: "same exchange" };
  if (!x.linear || !y.linear) return { ok: false, reason: "non-linear (inverse) contract" };
  if (!x.tradable || !y.tradable) return { ok: false, reason: "instrument not in trading status" };
  if (x.base !== y.base) return { ok: false, reason: "different underlying" };
  if (x.quote !== y.quote) return { ok: false, reason: `quote currency differs (${x.quote} vs ${y.quote})` };
  if (x.settle !== y.settle) return { ok: false, reason: `settlement currency differs (${x.settle} vs ${y.settle})` };
  const px = normalizedPrice(x);
  const py = normalizedPrice(y);
  if (px != null && py != null) {
    const div = Math.abs(px - py) / Math.min(px, py);
    if (div > MAX_PRICE_DIVERGENCE) {
      return { ok: false, reason: `normalized mark prices diverge by ${(div * 100).toFixed(1)}% — likely different instruments` };
    }
  }
  return { ok: true };
}

/** Build all comparable exchange pairs for a market list. */
export function buildCandidates(markets: PerpMarket[]): { candidates: Candidate[]; exclusions: Exclusion[] } {
  const byBase = new Map<string, PerpMarket[]>();
  for (const m of markets) {
    const k = `${m.base}/${m.quote}`;
    (byBase.get(k) ?? byBase.set(k, []).get(k)!).push(m);
  }
  const candidates: Candidate[] = [];
  const exclusions: Exclusion[] = [];
  for (const [key, group] of byBase) {
    if (group.length < 2) continue;
    const incompatible = new Set<PerpMarket>();
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [x, y] = group[i].exchange < group[j].exchange ? [group[i], group[j]] : [group[j], group[i]];
        const c = compatibility(x, y);
        if (c.ok) {
          candidates.push({ id: `${key.replace("/", "-")}:${x.exchange}:${y.exchange}`, base: x.base, a: x, b: y });
        } else if (c.reason !== "same exchange") {
          incompatible.add(group[i]);
          incompatible.add(group[j]);
          exclusions.push({ base: x.base, exchange: y.exchange, nativeSymbol: y.nativeSymbol, reason: `vs ${x.exchange}: ${c.reason}` });
        }
      }
    }
  }
  return { candidates, exclusions };
}

/** Split exchange base names like "1000PEPE" into { base: "PEPE", multiplier: 1000 }. */
export function splitMultiplier(rawBase: string): { base: string; multiplier: number } {
  const m = /^(1000000|100000|10000|1000)([A-Z0-9]+)$/.exec(rawBase);
  return m ? { base: m[2], multiplier: Number(m[1]) } : { base: rawBase, multiplier: 1 };
}
