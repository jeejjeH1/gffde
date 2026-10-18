/**
 * Binance USDⓈ-M Futures — public market-data endpoints (base https://fapi.binance.com):
 *   GET /fapi/v1/exchangeInfo      symbols[].{symbol,contractType,status,baseAsset,quoteAsset,marginAsset}
 *   GET /fapi/v1/premiumIndex      [].{symbol,markPrice,indexPrice,lastFundingRate,nextFundingTime,time}
 *   GET /fapi/v1/fundingInfo       [].{symbol,fundingIntervalHours}  (only symbols with non-default settings)
 *   GET /fapi/v1/ticker/24hr       [].{symbol,quoteVolume}
 *   GET /fapi/v1/fundingRate       [].{symbol,fundingRate,fundingTime}
 *   GET /fapi/v1/depth             {bids,asks,T}
 * NOTE: field names are from the official docs as known when this was written;
 * they could not be verified against live responses in the build sandbox.
 */
import { cache } from "../cache";
import { fetchJson } from "../http";
import { splitMultiplier } from "../calc/matching";
import type { FundingPoint, OrderBook, PerpMarket } from "../types";
import { num, type ExchangeAdapter } from "./adapter";

const BASE = "https://fapi.binance.com";
const DEFAULT_INTERVAL_H = 8; // documented default for symbols absent from fundingInfo

interface ExchangeInfo { symbols: Array<{ symbol: string; contractType: string; status: string; baseAsset: string; quoteAsset: string; marginAsset: string }> }
interface PremiumIndex { symbol: string; markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number; time: number }
interface FundingInfo { symbol: string; fundingIntervalHours: number }
interface Ticker24 { symbol: string; quoteVolume: string }

export const binance: ExchangeAdapter = {
  id: "binance",

  async fetchMarkets(now) {
    const [info, premium, fi, tickers] = await Promise.all([
      cache.get("bn:info", 10 * 60_000, () => fetchJson<ExchangeInfo>(`${BASE}/fapi/v1/exchangeInfo`)),
      fetchJson<PremiumIndex[]>(`${BASE}/fapi/v1/premiumIndex`),
      cache.get("bn:fi", 10 * 60_000, () => fetchJson<FundingInfo[]>(`${BASE}/fapi/v1/fundingInfo`)).catch(() => null),
      cache.get("bn:t24", 30_000, () => fetchJson<Ticker24[]>(`${BASE}/fapi/v1/ticker/24hr`)).catch(() => null),
    ]);
    return normalizeBinance(info.value, premium, fi?.value ?? null, tickers?.value ?? null, now);
  },

  async fetchFundingHistory(symbol, limit) {
    const rows = await fetchJson<Array<{ fundingRate: string; fundingTime: number }>>(
      `${BASE}/fapi/v1/fundingRate?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    );
    return rows.flatMap((r): FundingPoint[] => {
      const rate = num(r.fundingRate);
      return rate == null ? [] : [{ ts: r.fundingTime, rate }];
    }).sort((a, b) => a.ts - b.ts);
  },

  async fetchOrderBook(m, depth): Promise<OrderBook> {
    const r = await fetchJson<{ bids: string[][]; asks: string[][]; T?: number }>(
      `${BASE}/fapi/v1/depth?symbol=${encodeURIComponent(m.nativeSymbol)}&limit=${depth}`,
    );
    const conv = (l: string[][]) => l.map(([p, q]) => [Number(p), Number(q)] as [number, number]);
    return { exchange: "binance", nativeSymbol: m.nativeSymbol, bids: conv(r.bids), asks: conv(r.asks), ts: r.T ?? null };
  },
};

export function normalizeBinance(
  info: ExchangeInfo,
  premium: PremiumIndex[],
  fundingInfo: FundingInfo[] | null,
  tickers: Ticker24[] | null,
  now: number,
): PerpMarket[] {
  const meta = new Map(info.symbols.filter((s) => s.contractType === "PERPETUAL").map((s) => [s.symbol, s]));
  const intervals = new Map((fundingInfo ?? []).map((f) => [f.symbol, f.fundingIntervalHours]));
  const vols = new Map((tickers ?? []).map((t) => [t.symbol, num(t.quoteVolume)]));
  const out: PerpMarket[] = [];
  for (const p of premium) {
    const s = meta.get(p.symbol);
    if (!s) continue; // dated futures or unknown symbols are skipped
    const { base, multiplier } = splitMultiplier(s.baseAsset);
    const exIv = intervals.get(p.symbol);
    const fundingInterval = exIv ?? (fundingInfo ? DEFAULT_INTERVAL_H : null);
    out.push({
      exchange: "binance",
      nativeSymbol: p.symbol,
      base, priceMultiplier: multiplier,
      quote: s.quoteAsset, settle: s.marginAsset,
      linear: true,
      fundingRate: num(p.lastFundingRate),
      nextFundingTime: num(p.nextFundingTime) || null,
      fundingIntervalHours: fundingInterval,
      intervalSource: exIv != null ? "exchange" : fundingInfo ? "exchange-default" : "unavailable",
      markPrice: num(p.markPrice),
      indexPrice: num(p.indexPrice),
      volume24hQuote: vols.get(p.symbol) ?? null,
      tradable: s.status === "TRADING",
      fetchedAt: now,
      exchangeTs: num(p.time),
    });
  }
  return out;
}
