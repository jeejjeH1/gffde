import { describe, expect, it } from "vitest";
import { normalizeBinance } from "@/lib/exchanges/binance";
import { normalizeBybit } from "@/lib/exchanges/bybit";
import { normalizeOkx } from "@/lib/exchanges/okx";

// Synthetic payloads shaped like the documented responses. NOT real market data.
describe("Binance normalization", () => {
  const info = { symbols: [
    { symbol: "BTCUSDT", contractType: "PERPETUAL", status: "TRADING", baseAsset: "BTC", quoteAsset: "USDT", marginAsset: "USDT" },
    { symbol: "BTCUSDT_261225", contractType: "CURRENT_QUARTER", status: "TRADING", baseAsset: "BTC", quoteAsset: "USDT", marginAsset: "USDT" },
    { symbol: "1000PEPEUSDT", contractType: "PERPETUAL", status: "SETTLING", baseAsset: "1000PEPE", quoteAsset: "USDT", marginAsset: "USDT" },
  ] };
  const premium = [
    { symbol: "BTCUSDT", markPrice: "60000.1", indexPrice: "60001.0", lastFundingRate: "0.00010000", nextFundingTime: 1700000000000, time: 1699999990000 },
    { symbol: "BTCUSDT_261225", markPrice: "61000", indexPrice: "60001", lastFundingRate: "", nextFundingTime: 0, time: 1 },
    { symbol: "1000PEPEUSDT", markPrice: "0.012", indexPrice: "0.012", lastFundingRate: "-0.0002", nextFundingTime: 1700000000000, time: 1 },
  ];
  it("keeps only perpetuals, flags status, splits multipliers", () => {
    const out = normalizeBinance(info, premium, [{ symbol: "1000PEPEUSDT", fundingIntervalHours: 4 }], [{ symbol: "BTCUSDT", quoteVolume: "123456" }], 42);
    expect(out.map((m) => m.nativeSymbol)).toEqual(["BTCUSDT", "1000PEPEUSDT"]);
    const [btc, pepe] = out;
    expect(btc.fundingRate).toBeCloseTo(0.0001);
    expect(btc.fundingIntervalHours).toBe(8);
    expect(btc.intervalSource).toBe("exchange-default");
    expect(btc.volume24hQuote).toBe(123456);
    expect(btc.fetchedAt).toBe(42);
    expect(pepe.base).toBe("PEPE");
    expect(pepe.priceMultiplier).toBe(1000);
    expect(pepe.fundingIntervalHours).toBe(4);
    expect(pepe.intervalSource).toBe("exchange");
    expect(pepe.tradable).toBe(false);
  });
  it("marks interval unavailable when fundingInfo failed (not invented)", () => {
    const [btc] = normalizeBinance(info, premium, null, null, 1);
    expect(btc.fundingIntervalHours).toBeNull();
    expect(btc.intervalSource).toBe("unavailable");
    expect(btc.volume24hQuote).toBeNull();
  });
});

describe("Bybit normalization", () => {
  const inst = [
    { symbol: "ETHUSDT", contractType: "LinearPerpetual", status: "Trading", baseCoin: "ETH", quoteCoin: "USDT", settleCoin: "USDT", fundingInterval: 480 },
    { symbol: "ETHUSDT-27DEC26", contractType: "LinearFutures", status: "Trading", baseCoin: "ETH", quoteCoin: "USDT", settleCoin: "USDT" },
    { symbol: "XYZUSDT", contractType: "LinearPerpetual", status: "Trading", baseCoin: "XYZ", quoteCoin: "USDT", settleCoin: "USDT" },
  ];
  const tickers = [
    { symbol: "ETHUSDT", markPrice: "3000", indexPrice: "3001", fundingRate: "-0.0001", nextFundingTime: "1700000000000", turnover24h: "5000000" },
    { symbol: "ETHUSDT-27DEC26", markPrice: "3100", indexPrice: "3001", fundingRate: "", nextFundingTime: "0", turnover24h: "1" },
    { symbol: "XYZUSDT", markPrice: "1", indexPrice: "1", fundingRate: "0.0001", nextFundingTime: "1700000000000", turnover24h: "1" },
  ];
  it("converts interval minutes to hours, drops dated futures", () => {
    const out = normalizeBybit(tickers, inst, 99, 7);
    expect(out.map((m) => m.nativeSymbol)).toEqual(["ETHUSDT", "XYZUSDT"]);
    expect(out[0].fundingIntervalHours).toBe(8);
    expect(out[0].fundingRate).toBeCloseTo(-0.0001);
    expect(out[0].nextFundingTime).toBe(1700000000000);
    expect(out[1].fundingIntervalHours).toBeNull(); // missing => unavailable
    expect(out[1].intervalSource).toBe("unavailable");
  });
});

describe("OKX normalization", () => {
  const inst = [
    { instId: "SOL-USDT-SWAP", ctType: "linear", ctVal: "1", ctValCcy: "SOL", settleCcy: "USDT", state: "live" },
    { instId: "SOL-USD-SWAP", ctType: "inverse", ctVal: "10", ctValCcy: "USD", settleCcy: "SOL", state: "live" },
  ];
  const funding = [
    { instId: "SOL-USDT-SWAP", fundingRate: "0.0002", fundingTime: "1700000000000", nextFundingTime: "1700028800000" },
    { instId: "SOL-USD-SWAP", fundingRate: "0.0002", fundingTime: "1700000000000", nextFundingTime: "1700028800000" },
  ];
  it("derives interval from fundingTime/nextFundingTime and skips inverse", () => {
    const out = normalizeOkx(inst, funding, [{ instId: "SOL-USDT-SWAP", markPx: "150", ts: "5" }], [{ instId: "SOL-USDT", idxPx: "150.2" }],
      [{ instId: "SOL-USDT-SWAP", last: "150", volCcy24h: "1000" }], 3);
    expect(out).toHaveLength(1);
    const m = out[0];
    expect(m.fundingIntervalHours).toBe(8);
    expect(m.intervalSource).toBe("derived");
    expect(m.nextFundingTime).toBe(1700000000000);
    expect(m.indexPrice).toBe(150.2);
    expect(m.volume24hQuote).toBe(150000);
    expect(m.settle).toBe("USDT");
    expect(m.contractValue).toBe(1);
  });
  it("leaves missing mark/index as null", () => {
    const [m] = normalizeOkx(inst, funding, [], [], [], 3);
    expect(m.markPrice).toBeNull();
    expect(m.indexPrice).toBeNull();
    expect(m.volume24hQuote).toBeNull();
  });
});
