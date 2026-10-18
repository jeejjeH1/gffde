import { describe, expect, it } from "vitest";
import {
  bestConfig, bookSlippageUsd, evaluate, fundingCashFlow, fundingEvents, HOUR_MS, horizonEnd, spreadInfo, tradingFees,
} from "@/lib/calc/funding";

const NOW = 0;
const fees = { takerA: 0.0005, takerB: 0.0005 };
const leg = (rate: number, next: number, h: number) => ({ rate, nextFundingTime: next, intervalHours: h });

describe("funding cash flow conventions", () => {
  it("long pays positive funding, short receives it", () => {
    expect(fundingCashFlow("long", 0.0001, 10_000)).toBeCloseTo(-1);
    expect(fundingCashFlow("short", 0.0001, 10_000)).toBeCloseTo(1);
  });
  it("long receives negative funding, short pays it", () => {
    expect(fundingCashFlow("long", -0.0002, 10_000)).toBeCloseTo(2);
    expect(fundingCashFlow("short", -0.0002, 10_000)).toBeCloseTo(-2);
  });
  it("scales linearly with notional", () => {
    expect(fundingCashFlow("short", 0.0001, 50_000)).toBeCloseTo(5);
  });
});

describe("funding events respect each exchange's interval", () => {
  it("8h leg gets 3 events in 24h, 1h leg gets 24", () => {
    const end = NOW + 24 * HOUR_MS;
    expect(fundingEvents(leg(0, 8 * HOUR_MS, 8), NOW, end)).toHaveLength(3); // t=8h,16h,24h (boundary inclusive)
  });
  it("includes event exactly on horizon boundary", () => {
    const end = NOW + 24 * HOUR_MS;
    expect(fundingEvents(leg(0, 8 * HOUR_MS, 8), NOW, end).map((e) => e.ts / HOUR_MS)).toEqual([8, 16, 24]);
    expect(fundingEvents(leg(0, 1 * HOUR_MS, 1), NOW, end)).toHaveLength(24);
  });
  it("first event is indicated, rest are assumptions", () => {
    const ev = fundingEvents(leg(0, 4 * HOUR_MS, 4), NOW, NOW + 12 * HOUR_MS);
    expect(ev.map((e) => e.kind)).toEqual(["indicated", "assumed", "assumed"]);
  });
  it("rolls a past next-funding time forward on the grid", () => {
    const ev = fundingEvents(leg(0, -1 * HOUR_MS, 8), NOW, NOW + 8 * HOUR_MS);
    expect(ev.map((e) => e.ts / HOUR_MS)).toEqual([7]);
  });
  it("returns nothing for invalid interval", () => {
    expect(fundingEvents(leg(0, 1, 0), NOW, 1e9)).toEqual([]);
  });
  it("'next' horizon ends when both legs have settled once", () => {
    expect(horizonEnd("next", NOW, [leg(0, 3 * HOUR_MS, 8), leg(0, 5 * HOUR_MS, 4)])).toBe(5 * HOUR_MS);
  });
});

describe("evaluate", () => {
  it("equal notional, same schedule: gross funding is rate difference × notional", () => {
    const [c1, c2] = evaluate({
      a: leg(0.0003, 8 * HOUR_MS, 8), b: leg(0.0001, 8 * HOUR_MS, 8),
      notionalA: 10_000, notionalB: 10_000, fees, horizon: "next", now: NOW,
    });
    // short A (+3) long B (-1) = +2 ; opposite = -2
    expect(c1.id).toBe("shortA-longB");
    expect(c1.grossFunding).toBeCloseTo(2);
    expect(c2.grossFunding).toBeCloseTo(-2);
  });

  it("net = funding - entry/exit fees - slippage - other", () => {
    const [c1] = evaluate({
      a: leg(0.001, 8 * HOUR_MS, 8), b: leg(0, 8 * HOUR_MS, 8),
      notionalA: 10_000, notionalB: 10_000, fees, slippageUsd: 3, otherCostsUsd: 1, horizon: "next", now: NOW,
    });
    expect(c1.grossFunding).toBeCloseTo(10);
    expect(c1.fees).toBeCloseTo(20); // 4 fills x $5
    expect(c1.netReturn).toBeCloseTo(10 - 20 - 3 - 1);
  });

  it("slippage unavailable is kept null and not counted", () => {
    const [c1] = evaluate({
      a: leg(0.001, 8 * HOUR_MS, 8), b: leg(0, 8 * HOUR_MS, 8),
      notionalA: 10_000, notionalB: 10_000, fees, horizon: "next", now: NOW,
    });
    expect(c1.slippage).toBeNull();
    expect(c1.netReturn).toBeCloseTo(-10); // 10 funding - 20 fees
  });

  it("different intervals: 1h leg accrues 8 events vs 1 on the 8h leg over 8h", () => {
    const [c1] = evaluate({
      a: leg(0.0001, 1 * HOUR_MS, 1), b: leg(0.0008, 8 * HOUR_MS, 8),
      notionalA: 10_000, notionalB: 10_000, fees: { takerA: 0, takerB: 0 }, horizon: "24h", now: NOW,
    });
    expect(c1.legA.events).toHaveLength(24);
    expect(c1.legB.events).toHaveLength(3);
    // short A: +1 × 24 ; long B: -8 × 3
    expect(c1.legA.cashFlow).toBeCloseTo(24);
    expect(c1.legB.cashFlow).toBeCloseTo(-24);
    expect(c1.grossFunding).toBeCloseTo(0);
  });

  it("legs are computed with their own notional", () => {
    const [c1] = evaluate({
      a: leg(0.001, 8 * HOUR_MS, 8), b: leg(0.001, 8 * HOUR_MS, 8),
      notionalA: 20_000, notionalB: 10_000, fees: { takerA: 0, takerB: 0 }, horizon: "next", now: NOW,
    });
    expect(c1.legA.cashFlow).toBeCloseTo(20);
    expect(c1.legB.cashFlow).toBeCloseTo(-10);
    expect(c1.grossFunding).toBeCloseTo(10);
  });

  it("bestConfig picks the higher net configuration", () => {
    const r = evaluate({
      a: leg(-0.0004, 8 * HOUR_MS, 8), b: leg(0.0001, 8 * HOUR_MS, 8),
      notionalA: 10_000, notionalB: 10_000, fees, horizon: "next", now: NOW,
    });
    expect(bestConfig(r).id).toBe("longA-shortB");
  });
});

describe("fees and spread", () => {
  it("round-trip fees cover entry and exit on both legs", () => {
    expect(tradingFees(10_000, 10_000, { takerA: 0.0005, takerB: 0.00055 })).toBeCloseTo(2 * (5 + 5.5));
  });
  it("normalizes spread to 8h basis and does not call it profit", () => {
    const s = spreadInfo(leg(0.0001, 0, 1), leg(0.0002, 0, 8));
    expect(s.perEvent).toBeCloseTo(-0.0001);
    expect(s.per8h).toBeCloseTo(0.0008 - 0.0002);
  });
});

describe("book slippage", () => {
  const asks: Array<[number, number]> = [[100.1, 5], [100.5, 10]];
  it("is zero when the order fits at mid-equal price", () => {
    expect(bookSlippageUsd([[100, 100]], 100, 1000, "buy")).toBeCloseTo(0);
  });
  it("walks the book (buy)", () => {
    // 10 base: 5@100.1 + 5@100.5 => vwap 100.3 => slip 0.3*10
    expect(bookSlippageUsd(asks, 100, 1000, "buy")).toBeCloseTo(3);
  });
  it("returns null for insufficient depth", () => {
    expect(bookSlippageUsd(asks, 100, 1_000_000, "buy")).toBeNull();
  });
});
