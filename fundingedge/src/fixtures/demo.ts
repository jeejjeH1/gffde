/**
 * SYNTHETIC demonstration data. Values are invented for UI development when the
 * exchanges are unreachable. The API labels these snapshots `mode: "demo"` and the
 * UI shows a persistent banner. Never treat this as market data.
 */
import type { ExchangeId, PerpMarket } from "../lib/types";

const H = 3_600_000;
const SYMS: Array<[string, number, number, number, number]> = [
  // base, price, binance rate, bybit rate, okx rate
  ["BTC", 64000, 0.0001, 0.00008, 0.00006],
  ["ETH", 3100, 0.00012, 0.00005, 0.0001],
  ["SOL", 145, 0.0003, -0.0001, 0.00015],
  ["DOGE", 0.12, 0.00045, 0.0001, 0.0002],
  ["XRP", 0.55, -0.00008, 0.00012, 0.00004],
  ["AVAX", 28, 0.0006, 0.00005, 0.0003],
  ["LINK", 14, 0.00002, 0.00015, -0.00005],
  ["ARB", 0.9, 0.0008, -0.0002, 0.0001],
];

export function demoMarkets(now: number): PerpMarket[] {
  const out: PerpMarket[] = [];
  const nextHour = (h: number) => Math.ceil(now / (h * H)) * h * H;
  const ex: Array<[ExchangeId, number, number, string]> = [
    ["binance", 8, 0, "USDT"], ["bybit", 8, 1, "USDT"], ["okx", 8, 2, "USDT"],
  ];
  SYMS.forEach(([base, px, ...rates], si) => {
    ex.forEach(([exchange, iv, ri, quote]) => {
      // Bybit uses a 4h interval for one symbol to exercise mixed-interval logic.
      const interval = exchange === "bybit" && base === "ARB" ? 4 : iv;
      out.push({
        exchange, nativeSymbol: exchange === "okx" ? `${base}-USDT-SWAP` : `${base}USDT`,
        base, priceMultiplier: 1, quote, settle: "USDT", linear: true,
        fundingRate: rates[ri], nextFundingTime: nextHour(interval), fundingIntervalHours: interval,
        intervalSource: "exchange", markPrice: px * (1 + (ri - 1) * 0.0004), indexPrice: px,
        volume24hQuote: 5e7 * (8 - si) * (1 + ri * 0.3), tradable: true, fetchedAt: now, exchangeTs: now,
        contractValue: exchange === "okx" ? 1 : null,
      });
    });
  });
  return out;
}
