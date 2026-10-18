import { describe, expect, it } from "vitest";
import { buildCandidates, compatibility, splitMultiplier } from "@/lib/calc/matching";
import { mk } from "./helpers";

describe("instrument compatibility", () => {
  const bn = mk();
  const bb = mk({ exchange: "bybit" });
  it("accepts matching linear USDT perps", () => expect(compatibility(bn, bb).ok).toBe(true));
  it("rejects same exchange", () => expect(compatibility(bn, mk()).ok).toBe(false));
  it("rejects inverse contracts", () => expect(compatibility(bn, mk({ exchange: "okx", linear: false })).ok).toBe(false));
  it("rejects different quote / settle", () => {
    expect(compatibility(bn, mk({ exchange: "bybit", quote: "USDC", settle: "USDC" })).ok).toBe(false);
    expect(compatibility(bn, mk({ exchange: "bybit", settle: "BTC" })).ok).toBe(false);
  });
  it("rejects non-trading instruments", () => expect(compatibility(bn, mk({ exchange: "bybit", tradable: false })).ok).toBe(false));
  it("rejects same ticker with wildly different price (different asset)", () => {
    const r = compatibility(bn, mk({ exchange: "bybit", markPrice: 90000 }));
    expect(r.ok).toBe(false);
  });
  it("normalizes 1000x multiplier before comparing prices", () => {
    const a = mk({ base: "PEPE", markPrice: 0.012, priceMultiplier: 1000, nativeSymbol: "1000PEPEUSDT" }); // 12 per 1000 => 0.012 each? stored per-1000 price
    const b = mk({ exchange: "okx", base: "PEPE", markPrice: 0.000012, priceMultiplier: 1 });
    expect(compatibility({ ...a, markPrice: 0.012 }, b).ok).toBe(true);
  });
  it("tolerates unavailable prices without inventing a divergence", () => {
    expect(compatibility(bn, mk({ exchange: "okx", markPrice: null })).ok).toBe(true);
  });
});

describe("buildCandidates", () => {
  it("pairs each exchange combination once and reports exclusions", () => {
    const markets = [
      mk(), mk({ exchange: "bybit" }), mk({ exchange: "okx" }),
      mk({ base: "XYZ", nativeSymbol: "XYZUSDT" }), mk({ exchange: "bybit", base: "XYZ", nativeSymbol: "XYZUSDT", markPrice: 1 }),
    ];
    markets[3].markPrice = 100;
    const { candidates, exclusions } = buildCandidates(markets);
    expect(candidates.map((c) => c.id).sort()).toEqual(["BTC-USDT:binance:bybit", "BTC-USDT:binance:okx", "BTC-USDT:bybit:okx"]);
    expect(exclusions.some((e) => e.base === "XYZ")).toBe(true);
  });
  it("does not pair markets with different quote currencies", () => {
    const { candidates } = buildCandidates([mk(), mk({ exchange: "bybit", quote: "USDC", settle: "USDC" })]);
    expect(candidates).toHaveLength(0);
  });
});

describe("splitMultiplier", () => {
  it("splits numeric prefixes", () => {
    expect(splitMultiplier("1000PEPE")).toEqual({ base: "PEPE", multiplier: 1000 });
    expect(splitMultiplier("1000000MOG")).toEqual({ base: "MOG", multiplier: 1000000 });
    expect(splitMultiplier("BTC")).toEqual({ base: "BTC", multiplier: 1 });
  });
});
