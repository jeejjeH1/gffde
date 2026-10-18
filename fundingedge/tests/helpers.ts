import type { PerpMarket } from "@/lib/types";

/** Synthetic test fixture — NOT market data. */
export function mk(over: Partial<PerpMarket> = {}): PerpMarket {
  return {
    exchange: "binance", nativeSymbol: "BTCUSDT", base: "BTC", priceMultiplier: 1, quote: "USDT", settle: "USDT",
    linear: true, fundingRate: 0.0001, nextFundingTime: 1_000_000, fundingIntervalHours: 8, intervalSource: "exchange",
    markPrice: 60000, indexPrice: 60000, volume24hQuote: 1e9, tradable: true, fetchedAt: 0, exchangeTs: null,
    ...over,
  };
}
