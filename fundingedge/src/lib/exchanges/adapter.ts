import type { ExchangeId, FundingPoint, OrderBook, PerpMarket } from "../types";

export interface ExchangeAdapter {
  id: ExchangeId;
  /** Fetch and normalize every linear USDT/USDC perpetual with current funding data. */
  fetchMarkets(now: number): Promise<PerpMarket[]>;
  /** Exchange-provided funding history (most recent last). */
  fetchFundingHistory(nativeSymbol: string, limit: number): Promise<FundingPoint[]>;
  fetchOrderBook(market: PerpMarket, depth: number): Promise<OrderBook>;
}

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
