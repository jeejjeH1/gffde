/**
 * Bybit V5 — public market-data endpoints (base https://api.bybit.com), category=linear:
 *   GET /v5/market/tickers              result.list[].{symbol,markPrice,indexPrice,fundingRate,nextFundingTime,turnover24h}
 *   GET /v5/market/instruments-info     result.list[].{symbol,contractType,status,baseCoin,quoteCoin,settleCoin,fundingInterval(min)}, result.nextPageCursor
 *   GET /v5/market/funding/history      result.list[].{symbol,fundingRate,fundingRateTimestamp}
 *   GET /v5/market/orderbook            result.{b,a,ts}
 * All responses are wrapped as { retCode, retMsg, result, time }.
 * NOTE: not verified against live responses in the build sandbox.
 */
import { cache } from "../cache";
import { fetchJson, HttpError } from "../http";
import { splitMultiplier } from "../calc/matching";
import type { FundingPoint, OrderBook, PerpMarket } from "../types";
import { num, type ExchangeAdapter } from "./adapter";

const BASE = "https://api.bybit.com";

interface Wrapped<T> { retCode: number; retMsg: string; result: T; time?: number }
interface Ticker { symbol: string; markPrice: string; indexPrice: string; fundingRate: string; nextFundingTime: string; turnover24h: string }
interface Instrument { symbol: string; contractType: string; status: string; baseCoin: string; quoteCoin: string; settleCoin: string; fundingInterval?: number }

async function call<T>(path: string): Promise<Wrapped<T>> {
  const r = await fetchJson<Wrapped<T>>(`${BASE}${path}`);
  if (r.retCode !== 0) throw new HttpError(`api.bybit.com: retCode ${r.retCode}`);
  return r;
}

async function allInstruments(): Promise<Instrument[]> {
  const out: Instrument[] = [];
  let cursor = "";
  for (let page = 0; page < 10; page++) {
    const r = await call<{ list: Instrument[]; nextPageCursor?: string }>(
      `/v5/market/instruments-info?category=linear&limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    out.push(...r.result.list);
    cursor = r.result.nextPageCursor ?? "";
    if (!cursor) break;
  }
  return out;
}

export const bybit: ExchangeAdapter = {
  id: "bybit",

  async fetchMarkets(now) {
    const [tickers, inst] = await Promise.all([
      call<{ list: Ticker[] }>("/v5/market/tickers?category=linear"),
      cache.get("bb:inst", 10 * 60_000, allInstruments),
    ]);
    return normalizeBybit(tickers.result.list, inst.value, tickers.time ?? null, now);
  },

  async fetchFundingHistory(symbol, limit) {
    const r = await call<{ list: Array<{ fundingRate: string; fundingRateTimestamp: string }> }>(
      `/v5/market/funding/history?category=linear&symbol=${encodeURIComponent(symbol)}&limit=${Math.min(limit, 200)}`,
    );
    return r.result.list.flatMap((x): FundingPoint[] => {
      const rate = num(x.fundingRate), ts = num(x.fundingRateTimestamp);
      return rate == null || ts == null ? [] : [{ ts, rate }];
    }).sort((a, b) => a.ts - b.ts);
  },

  async fetchOrderBook(m, depth): Promise<OrderBook> {
    const r = await call<{ b: string[][]; a: string[][]; ts?: number }>(
      `/v5/market/orderbook?category=linear&symbol=${encodeURIComponent(m.nativeSymbol)}&limit=${Math.min(depth, 200)}`,
    );
    const conv = (l: string[][]) => l.map(([p, q]) => [Number(p), Number(q)] as [number, number]);
    return { exchange: "bybit", nativeSymbol: m.nativeSymbol, bids: conv(r.result.b), asks: conv(r.result.a), ts: r.result.ts ?? null };
  },
};

export function normalizeBybit(tickers: Ticker[], instruments: Instrument[], serverTime: number | null, now: number): PerpMarket[] {
  const meta = new Map(instruments.filter((i) => i.contractType === "LinearPerpetual").map((i) => [i.symbol, i]));
  const out: PerpMarket[] = [];
  for (const t of tickers) {
    const i = meta.get(t.symbol);
    if (!i) continue;
    const { base, multiplier } = splitMultiplier(i.baseCoin);
    const minutes = num(i.fundingInterval);
    out.push({
      exchange: "bybit",
      nativeSymbol: t.symbol,
      base, priceMultiplier: multiplier,
      quote: i.quoteCoin, settle: i.settleCoin,
      linear: true,
      fundingRate: num(t.fundingRate),
      nextFundingTime: num(t.nextFundingTime) || null,
      fundingIntervalHours: minutes != null && minutes > 0 ? minutes / 60 : null,
      intervalSource: minutes != null && minutes > 0 ? "exchange" : "unavailable",
      markPrice: num(t.markPrice),
      indexPrice: num(t.indexPrice),
      volume24hQuote: num(t.turnover24h),
      tradable: i.status === "Trading",
      fetchedAt: now,
      exchangeTs: serverTime,
    });
  }
  return out;
}
