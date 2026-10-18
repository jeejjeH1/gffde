/**
 * Funding arbitrage calculation module.
 *
 * Conventions (perpetual swaps, all three supported exchanges):
 *   - funding rate > 0: longs pay shorts; funding rate < 0: shorts pay longs.
 *   - cash flow of a position for one event = -sign(side) * rate * notional,
 *     where sign(long) = +1 and sign(short) = -1. Positive = received.
 *
 * Everything here is a HYPOTHETICAL estimate. Future rates are unknown; the
 * only "known" input is the currently indicated rate, which itself changes
 * until the funding timestamp.
 */
import type { Maybe } from "../types";

export type Side = "long" | "short";
export type Horizon = "next" | "24h" | "7d";

export const HOUR_MS = 3_600_000;

export interface FundingLeg {
  rate: number;
  nextFundingTime: number;
  intervalHours: number;
}

export interface FundingEvent {
  ts: number;
  /** index 0 is the currently indicated rate; later events assume it persists. */
  kind: "indicated" | "assumed";
}

/** Signed cash flow of one funding event. Positive = received by the trader. */
export function fundingCashFlow(side: Side, rate: number, notional: number): number {
  const direction = side === "long" ? 1 : -1;
  // Long pays positive funding (cash out) => negative cash flow.
  return -direction * rate * notional;
}

export function horizonEnd(
  horizon: Horizon,
  now: number,
  legs: [Pick<FundingLeg, "nextFundingTime">, Pick<FundingLeg, "nextFundingTime">],
): number {
  if (horizon === "24h") return now + 24 * HOUR_MS;
  if (horizon === "7d") return now + 7 * 24 * HOUR_MS;
  // "next": until both legs have settled once.
  return Math.max(legs[0].nextFundingTime, legs[1].nextFundingTime);
}

/** Funding timestamps in (now, end], respecting the exchange's own interval. */
export function fundingEvents(leg: FundingLeg, now: number, end: number): FundingEvent[] {
  if (!(leg.intervalHours > 0) || !Number.isFinite(leg.nextFundingTime)) return [];
  const step = leg.intervalHours * HOUR_MS;
  let t = leg.nextFundingTime;
  // If the stored next-funding time is already past, roll forward on the grid.
  if (t <= now) t += Math.ceil((now - t + 1) / step) * step;
  const out: FundingEvent[] = [];
  for (let i = 0; t <= end && i < 10_000; i++, t += step) {
    out.push({ ts: t, kind: out.length === 0 ? "indicated" : "assumed" });
  }
  return out;
}

export interface FeeSchedule {
  /** Fraction, e.g. 0.0005 = 0.05%. Applied per fill (entry and exit separately). */
  takerA: number;
  takerB: number;
}

export interface Costs {
  entryExitFeesUsd: number;
  slippageUsd: Maybe<number>;
  otherUsd: number;
}

export function tradingFees(notionalA: number, notionalB: number, fees: FeeSchedule): number {
  // entry + exit on both legs
  return 2 * (notionalA * fees.takerA + notionalB * fees.takerB);
}

export interface LegResult {
  exchangeLabel: "A" | "B";
  side: Side;
  rate: number;
  notional: number;
  events: FundingEvent[];
  cashFlow: number;
}

export interface ConfigResult {
  id: "shortA-longB" | "longA-shortB";
  legA: LegResult;
  legB: LegResult;
  grossFunding: number;
  fees: number;
  slippage: Maybe<number>;
  other: number;
  netReturn: number;
  /** net as fraction of the larger notional */
  netReturnPct: number;
}

export interface EvaluateInput {
  a: FundingLeg;
  b: FundingLeg;
  notionalA: number;
  notionalB: number;
  fees: FeeSchedule;
  otherCostsUsd?: number;
  /** Total round-trip slippage estimate in USD, when order-book data allowed one. */
  slippageUsd?: Maybe<number>;
  horizon: Horizon;
  now: number;
}

function leg(
  label: "A" | "B",
  side: Side,
  l: FundingLeg,
  notional: number,
  now: number,
  end: number,
): LegResult {
  const events = fundingEvents(l, now, end);
  const per = fundingCashFlow(side, l.rate, notional);
  return { exchangeLabel: label, side, rate: l.rate, notional, events, cashFlow: per * events.length };
}

/** Evaluate both hedge configurations. Does not pick a winner. */
export function evaluate(input: EvaluateInput): [ConfigResult, ConfigResult] {
  const { a, b, notionalA, notionalB, fees, horizon, now } = input;
  const end = horizonEnd(horizon, now, [a, b]);
  const feeTotal = tradingFees(notionalA, notionalB, fees);
  const other = input.otherCostsUsd ?? 0;
  const slip = input.slippageUsd ?? null;
  const denom = Math.max(notionalA, notionalB) || 1;

  const build = (id: ConfigResult["id"], sa: Side, sb: Side): ConfigResult => {
    const legA = leg("A", sa, a, notionalA, now, end);
    const legB = leg("B", sb, b, notionalB, now, end);
    const gross = legA.cashFlow + legB.cashFlow;
    const net = gross - feeTotal - (slip ?? 0) - other;
    return {
      id, legA, legB, grossFunding: gross, fees: feeTotal, slippage: slip, other, netReturn: net,
      netReturnPct: net / denom,
    };
  };
  return [build("shortA-longB", "short", "long"), build("longA-shortB", "long", "short")];
}

export function bestConfig(results: [ConfigResult, ConfigResult]): ConfigResult {
  return results[0].netReturn >= results[1].netReturn ? results[0] : results[1];
}

/**
 * Raw per-event rate difference. NOT a profit figure: legs settle at different
 * times and intervals. Also provided normalized to an 8h basis for comparison.
 */
export function spreadInfo(a: FundingLeg, b: FundingLeg) {
  const perEvent = a.rate - b.rate;
  const per8h = a.rate * (8 / a.intervalHours) - b.rate * (8 / b.intervalHours);
  return { perEvent, per8h, annualizedPct: per8h * 3 * 365 };
}

/**
 * Volume-weighted slippage for a market order of `notionalUsd` against one side
 * of a book (levels sorted best-first, sizes in base units).
 * Returns slippage in USD vs. mid price, or null if the book can't fill the size.
 */
export function bookSlippageUsd(
  levels: Array<[number, number]>,
  mid: number,
  notionalUsd: number,
  side: "buy" | "sell",
): Maybe<number> {
  if (!(mid > 0) || !(notionalUsd > 0)) return null;
  let remainingBase = notionalUsd / mid;
  const targetBase = remainingBase;
  let cost = 0;
  for (const [price, size] of levels) {
    const take = Math.min(size, remainingBase);
    cost += take * price;
    remainingBase -= take;
    if (remainingBase <= 1e-12) break;
  }
  if (remainingBase > 1e-9) return null; // insufficient depth
  const vwap = cost / targetBase;
  const diff = side === "buy" ? vwap - mid : mid - vwap;
  return Math.max(0, diff * targetBase);
}
