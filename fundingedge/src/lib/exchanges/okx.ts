/**
 * OKX V5 — public market-data endpoints (base https://www.okx.com), instType=SWAP:
 *   GET /api/v5/public/instruments?instType=SWAP   data[].{instId,instFamily,ctType,ctVal,ctValCcy,settleCcy,state}
 *   GET /api/v5/public/funding-rate?instId=...     data[].{instId,fundingRate,fundingTime,nextFundingTime}
 *   GET /api/v5/public/mark-price?instType=SWAP    data[].{instId,markPx,ts}
 *   GET /api/v5/market/index-tickers?quoteCcy=USDT data[].{instId,idxPx}
 *   GET /api/v5/market/tickers?instType=SWAP       data[].{instId,last,volCcy24h}
 *   GET /api/v5/public/funding-rate-history        data[].{fundingRate,fundingTime}
 *   GET /api/v5/market/books                       data[].{asks,bids,ts}  (sizes in contracts)
 * The funding-rate endpoint is per instrument (rate-limited), so funding is fetched
 * only for the most liquid swaps (OKX_MAX_FUNDING_INSTRUMENTS, default 120) with bounded
 * concurrency. The interval is derived as nextFundingTime - fundingTime.
 * NOTE: not verified against live responses in the build sandbox.
 */
import { cache } from "../cache";
import { fetchJson, HttpError, mapLimit } from "../http";
import { splitMultiplier } from "../calc/matching";
import type { FundingPoint, OrderBook, PerpMarket } from "../types";
import { num, type ExchangeAdapter } from "./adapter";

const BASE = "https://www.okx.com";
const MAX_FUNDING_INSTRUMENTS = Number(process.env.OKX_MAX_FUNDING_INSTRUMENTS ?? 120);

interface Wrapped<T> { code: string; msg: string; data: T[] }
interface Inst { instId: string; instFamily?: string; ctType: string; ctVal: string; ctValCcy: string; settleCcy: string; state: string }
interface Fund { instId: string; fundingRate: string; fundingTime: string; nextFundingTime: string }
interface Mark { instId: string; markPx: string; ts: string }
interface Idx { instId: string; idxPx: string }
interface Tick { instId: string; last: string; volCcy24h: string }

async function call<T>(path: string): Promise<T[]> {
  const r = await fetchJson<Wrapped<T>>(`${BASE}${path}`);
  if (r.code !== "0") throw new HttpError(`okx.com: code ${r.code}`);
  return r.data;
}

export const okx: ExchangeAdapter = {
  id: "okx",

  async fetchMarkets(now) {
    const [inst, marks, idx, ticks] = await Promise.all([
      cache.get("okx:inst", 10 * 60_000, () => call<Inst>("/api/v5/public/instruments?instType=SWAP")),
      call<Mark>("/api/v5/public/mark-price?instType=SWAP"),
      call<Idx>("/api/v5/market/index-tickers?quoteCcy=USDT").catch(() => [] as Idx[]),
      call<Tick>("/api/v5/market/tickers?instType=SWAP").catch(() => [] as Tick[]),
    ]);
    const linearLive = inst.value.filter((i) => i.ctType === "linear" && i.state === "live" && /-(USDT|USDC)-SWAP$/.test(i.instId));
    const volQuote = new Map(ticks.map((t) => [t.instId, (num(t.volCcy24h) ?? 0) * (num(t.last) ?? 0)]));
    const top = [...linearLive].sort((a, b) => (volQuote.get(b.instId) ?? 0) - (volQuote.get(a.instId) ?? 0)).slice(0, MAX_FUNDING_INSTRUMENTS);
    const funding = (
      await mapLimit(top, 4, (i) =>
        cache.get(`okx:fr:${i.instId}`, 30_000, () => call<Fund>(`/api/v5/public/funding-rate?instId=${i.instId}`)).then((r) => r.value[0]).catch(() => undefined),
      )
    ).filter((f): f is Fund => !!f);
    return normalizeOkx(inst.value, funding, marks, idx, ticks, now);
  },

  async fetchFundingHistory(instId, limit) {
    const rows = await call<{ fundingRate: string; fundingTime: string }>(
      `/api/v5/public/funding-rate-history?instId=${encodeURIComponent(instId)}&limit=${Math.min(limit, 100)}`,
    );
    return rows.flatMap((x): FundingPoint[] => {
      const rate = num(x.fundingRate), ts = num(x.fundingTime);
      return rate == null || ts == null ? [] : [{ ts, rate }];
    }).sort((a, b) => a.ts - b.ts);
  },

  async fetchOrderBook(m, depth): Promise<OrderBook> {
    const rows = await call<{ asks: string[][]; bids: string[][]; ts: string }>(
      `/api/v5/market/books?instId=${encodeURIComponent(m.nativeSymbol)}&sz=${Math.min(depth, 400)}`,
    );
    const ct = m.contractValue ?? null;
    if (!rows[0] || ct == null) throw new HttpError("okx.com: order book unavailable");
    // OKX sizes are in contracts; convert to base units with ctVal.
    const conv = (l: string[][]) => l.map(([p, sz]) => [Number(p), Number(sz) * ct] as [number, number]);
    return { exchange: "okx", nativeSymbol: m.nativeSymbol, bids: conv(rows[0].bids), asks: conv(rows[0].asks), ts: num(rows[0].ts) };
  },
};

export function normalizeOkx(instruments: Inst[], funding: Fund[], marks: Mark[], idx: Idx[], ticks: Tick[], now: number): PerpMarket[] {
  const meta = new Map(instruments.map((i) => [i.instId, i]));
  const markMap = new Map(marks.map((m) => [m.instId, m]));
  const idxMap = new Map(idx.map((i) => [i.instId.replace(/-SWAP$/, ""), num(i.idxPx)]));
  const tickMap = new Map(ticks.map((t) => [t.instId, t]));
  const out: PerpMarket[] = [];
  for (const f of funding) {
    const i = meta.get(f.instId);
    if (!i || i.ctType !== "linear") continue;
    const [rawBase, quote] = f.instId.split("-");
    const { base, multiplier } = splitMultiplier(rawBase);
    const ft = num(f.fundingTime), nft = num(f.nextFundingTime);
    const intervalMs = ft != null && nft != null && nft > ft ? nft - ft : null;
    const t = tickMap.get(f.instId);
    const ctVal = num(i.ctVal);
    out.push({
      exchange: "okx",
      nativeSymbol: f.instId,
      base, priceMultiplier: multiplier,
      quote, settle: i.settleCcy,
      linear: true,
      fundingRate: num(f.fundingRate),
      // fundingTime is the upcoming settlement; nextFundingTime the one after.
      nextFundingTime: ft,
      fundingIntervalHours: intervalMs != null ? intervalMs / 3_600_000 : null,
      intervalSource: intervalMs != null ? "derived" : "unavailable",
      markPrice: num(markMap.get(f.instId)?.markPx),
      indexPrice: idxMap.get(`${rawBase}-${quote}`) ?? null,
      volume24hQuote: t ? (num(t.volCcy24h) ?? 0) * (num(t.last) ?? 0) || null : null,
      tradable: i.state === "live",
      fetchedAt: now,
      exchangeTs: num(markMap.get(f.instId)?.ts),
      contractValue: i.ctValCcy === rawBase ? ctVal : null,
    });
  }
  return out;
}
