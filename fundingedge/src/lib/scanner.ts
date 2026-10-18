import { cache } from "./cache";
import { DEMO, STALE_AFTER_SEC } from "./config";
import { adapters, EXCHANGE_IDS } from "./exchanges";
import { demoMarkets } from "../fixtures/demo";
import type { ExchangeId, ExchangeStatus, PerpMarket, Snapshot } from "./types";

interface ExState { markets: PerpMarket[]; lastSuccessAt: number | null; lastError: string | null; latencyMs: number | null }
const state = new Map<ExchangeId, ExState>(
  EXCHANGE_IDS.map((id) => [id, { markets: [], lastSuccessAt: null, lastError: null, latencyMs: null }]),
);

const SNAPSHOT_TTL_MS = 15_000;

async function refreshExchange(id: ExchangeId): Promise<void> {
  const s = state.get(id)!;
  const t0 = Date.now();
  try {
    const markets = await adapters[id].fetchMarkets(t0);
    s.markets = markets;
    s.lastSuccessAt = Date.now();
    s.lastError = null;
    s.latencyMs = Date.now() - t0;
  } catch (e) {
    // Keep previous markets (their fetchedAt ages, so they surface as stale).
    s.lastError = e instanceof Error ? e.message : "unknown error";
    console.error(`[scanner] ${id} refresh failed: ${s.lastError}`);
  }
}

function statusOf(id: ExchangeId, now: number): ExchangeStatus {
  const s = state.get(id)!;
  const age = s.lastSuccessAt == null ? Infinity : (now - s.lastSuccessAt) / 1000;
  const st: ExchangeStatus["state"] =
    s.lastSuccessAt == null ? "down" : s.lastError == null ? "connected" : age > STALE_AFTER_SEC * 3 ? "down" : "degraded";
  return { exchange: id, state: st, lastSuccessAt: s.lastSuccessAt, lastError: s.lastError, marketCount: s.markets.length, latencyMs: s.latencyMs };
}

export async function getSnapshot(): Promise<Snapshot> {
  const now = Date.now();
  if (DEMO) {
    const markets = demoMarkets(now);
    return {
      generatedAt: now, mode: "demo", staleAfterSec: STALE_AFTER_SEC, markets,
      statuses: EXCHANGE_IDS.map((exchange) => ({
        exchange, state: "connected", lastSuccessAt: now, lastError: null,
        marketCount: markets.filter((m) => m.exchange === exchange).length, latencyMs: null,
      })),
    };
  }
  const r = await cache.get("snapshot", SNAPSHOT_TTL_MS, async () => {
    await Promise.all(EXCHANGE_IDS.map(refreshExchange));
    return Date.now();
  });
  const t = Date.now();
  return {
    generatedAt: r.at, mode: "live", staleAfterSec: STALE_AFTER_SEC,
    markets: EXCHANGE_IDS.flatMap((id) => state.get(id)!.markets),
    statuses: EXCHANGE_IDS.map((id) => statusOf(id, t)),
  };
}
