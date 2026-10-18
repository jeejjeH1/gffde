"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LineChart } from "@/components/LineChart";
import { DemoBanner } from "@/components/StatusBar";
import { Badge, Card, Input, Skeleton, Term, TooltipProvider } from "@/components/ui/primitives";
import { bestConfig, bookSlippageUsd, evaluate, spreadInfo, type ConfigResult, type Horizon } from "@/lib/calc/funding";
import { dataAgeSec, freshness } from "@/lib/calc/freshness";
import { spreadSeries } from "@/lib/calc/history";
import { fmtCountdown, fmtInterval, fmtPct, fmtPrice, fmtTime, fmtUsd, signClass } from "@/lib/format";
import { normalizedPrice } from "@/lib/calc/matching";
import { useSettings } from "@/lib/settings";
import { useSnapshot } from "@/lib/useSnapshot";
import { EXCHANGE_LABEL, type ExchangeId, type HistorySeries, type OrderBook, type PerpMarket } from "@/lib/types";

const HZ: Array<[Horizon, string]> = [["next", "Next funding event"], ["24h", "24 hours"], ["7d", "7 days"]];
const EXCHANGES = new Set<string>(["binance", "bybit", "okx"]);

async function getJson<T>(url: string): Promise<T | null> {
  try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
}

export function OpportunityDetail() {
  const q = useSearchParams();
  const base = q.get("base") ?? "", quote = q.get("quote") ?? "USDT", ea = q.get("a") ?? "", eb = q.get("b") ?? "";
  const { snap, error, now } = useSnapshot(15_000);
  const [s, update] = useSettings();

  const [a, b] = useMemo<[PerpMarket | undefined, PerpMarket | undefined]>(() => {
    if (!snap || !EXCHANGES.has(ea) || !EXCHANGES.has(eb)) return [undefined, undefined];
    const f = (ex: string) => snap.markets.find((m) => m.exchange === ex && m.base === base && m.quote === quote);
    return [f(ea), f(eb)];
  }, [snap, base, quote, ea, eb]);

  const aSym = a?.nativeSymbol, bSym = b?.nativeSymbol;
  const [hist, setHist] = useState<{ a: HistorySeries[]; b: HistorySeries[] } | null>(null);
  const [books, setBooks] = useState<{ a: OrderBook | null; b: OrderBook | null } | null>(null);

  useEffect(() => {
    if (!aSym || !bSym) return;
    let alive = true;
    (async () => {
      const [ha, hb, oa, ob] = await Promise.all([
        getJson<{ series: HistorySeries[] }>(`/api/history?exchange=${ea}&symbol=${encodeURIComponent(aSym)}&limit=100`),
        getJson<{ series: HistorySeries[] }>(`/api/history?exchange=${eb}&symbol=${encodeURIComponent(bSym)}&limit=100`),
        getJson<OrderBook>(`/api/orderbook?exchange=${ea}&symbol=${encodeURIComponent(aSym)}`),
        getJson<OrderBook>(`/api/orderbook?exchange=${eb}&symbol=${encodeURIComponent(bSym)}`),
      ]);
      if (alive) { setHist({ a: ha?.series ?? [], b: hb?.series ?? [] }); setBooks({ a: oa, b: ob }); }
    })();
    return () => { alive = false; };
  }, [aSym, bSym, ea, eb]);

  if (!snap) return error ? <Card className="p-4 text-down">Cannot load data: {error}</Card> : <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!a || !b) {
    return <Card className="p-6"><div className="font-medium">Opportunity not found</div>
      <p className="mt-1 text-muted">This pair is not currently available on both exchanges.</p>
      <Link href="/" className="mt-3 inline-flex items-center gap-1 text-accent"><ArrowLeft className="h-4 w-4" /> Back to scanner</Link></Card>;
  }

  const complete = [a, b].every((m) => m.fundingRate != null && m.nextFundingTime != null && m.fundingIntervalHours != null);
  const la = complete ? { rate: a.fundingRate!, nextFundingTime: a.nextFundingTime!, intervalHours: a.fundingIntervalHours! } : null;
  const lb = complete ? { rate: b.fundingRate!, nextFundingTime: b.nextFundingTime!, intervalHours: b.fundingIntervalHours! } : null;

  // Slippage per configuration: entry and exit on each leg against the live book.
  const slip = (cfg: ConfigResult["id"]): number | null => {
    if (!books?.a || !books.b || a.markPrice == null || b.markPrice == null) return null;
    const sideA = cfg === "shortA-longB" ? "short" : "long";
    const leg = (book: OrderBook, mid: number, side: "long" | "short") => {
      const open = side === "long" ? book.asks : book.bids, close = side === "long" ? book.bids : book.asks;
      const o = bookSlippageUsd(open, mid, s.notionalUsd, side === "long" ? "buy" : "sell");
      const c = bookSlippageUsd(close, mid, s.notionalUsd, side === "long" ? "sell" : "buy");
      return o == null || c == null ? null : o + c;
    };
    const x = leg(books.a, a.markPrice, sideA), y = leg(books.b, b.markPrice, sideA === "long" ? "short" : "long");
    return x == null || y == null ? null : x + y;
  };

  const evalFor = (h: Horizon): [ConfigResult, ConfigResult] | null => {
    if (!la || !lb) return null;
    const common = { a: la, b: lb, notionalA: s.notionalUsd, notionalB: s.notionalUsd, fees: { takerA: s.fees[a.exchange], takerB: s.fees[b.exchange] }, otherCostsUsd: s.otherCostsUsd, horizon: h, now };
    const r = evaluate(common);
    return [evaluate({ ...common, slippageUsd: slip(r[0].id) })[0], evaluate({ ...common, slippageUsd: slip(r[1].id) })[1]];
  };

  const cur = evalFor(s.horizon);
  const best = cur ? bestConfig(cur) : null;
  const sp = la && lb ? spreadInfo(la, lb) : null;
  const age = Math.max(dataAgeSec(a.fetchedAt, now) ?? 0, dataAgeSec(b.fetchedAt, now) ?? 0);
  const fresh = freshness(age, snap.staleAfterSec);
  const pa = normalizedPrice(a), pb = normalizedPrice(b);
  const basis = pa != null && pb != null ? (pa - pb) / pb : null;
  const warnings = warningsFor(a, b, fresh, books);

  const histA = hist?.a.find((x) => x.source === "exchange"), histB = hist?.b.find((x) => x.source === "exchange");
  const localA = hist?.a.find((x) => x.source === "local"), localB = hist?.b.find((x) => x.source === "local");
  const haveExchangeHist = !!histA?.points.length && !!histB?.points.length;
  const spreadLine = haveExchangeHist && la && lb ? spreadSeries(histA!.points, histB!.points, la.intervalHours, lb.intervalHours) : [];

  return (
    <TooltipProvider>
      {snap.mode === "demo" && <DemoBanner />}
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-text"><ArrowLeft className="h-3.5 w-3.5" /> Scanner</Link>
      <div className="fade space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{base}/{quote}</h1>
          <Badge tone="accent">{EXCHANGE_LABEL[a.exchange]} ↔ {EXCHANGE_LABEL[b.exchange]}</Badge>
          <Badge tone={fresh === "fresh" ? "up" : "down"}>{fresh} · {Math.round(age)}s</Badge>
          <Badge tone="warn">hypothetical estimates</Badge>
        </div>

        {warnings.length > 0 && (
          <Card className="border-warn/40 bg-warn/5 p-3">
            {warnings.map((w) => <div key={w} className="flex items-start gap-2 text-xs text-warn"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</div>)}
          </Card>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {[a, b].map((m, i) => (
            <Card key={m.exchange} className="p-3">
              <div className="mb-2 flex items-center justify-between"><span className="font-medium">{EXCHANGE_LABEL[m.exchange]} <span className="text-muted">({i === 0 ? "A" : "B"} · {m.nativeSymbol})</span></span></div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted">Funding rate (indicated)</dt><dd className={`num text-right ${signClass(m.fundingRate)}`}>{fmtPct(m.fundingRate)}</dd>
                <dt className="text-muted">Next funding</dt><dd className="num text-right">{fmtTime(m.nextFundingTime)} ({fmtCountdown(m.nextFundingTime, now)})</dd>
                <dt className="text-muted"><Term k="interval">Interval</Term></dt>
                <dd className="num text-right">{fmtInterval(m.fundingIntervalHours)} <span className="text-muted">({m.intervalSource})</span></dd>
                <dt className="text-muted">Mark / index</dt><dd className="num text-right">{fmtPrice(m.markPrice)} / {fmtPrice(m.indexPrice)}</dd>
                <dt className="text-muted">24h volume</dt><dd className="num text-right">{fmtUsd(m.volume24hQuote, 0)}</dd>
                <dt className="text-muted">Last fetched</dt><dd className="num text-right">{fmtTime(m.fetchedAt)}</dd>
              </dl>
            </Card>
          ))}
        </div>

        <Card className="p-3">
          <div className="mb-2 text-xs font-medium"><Term k="basis">Mark price comparison</Term></div>
          <div className="num text-xs">
            A {fmtPrice(a.markPrice)} · B {fmtPrice(b.markPrice)}
            {a.priceMultiplier !== b.priceMultiplier && <span className="text-muted"> (contract multipliers differ: {a.priceMultiplier} vs {b.priceMultiplier}; compared after normalization)</span>}
            {" · "}Basis A−B: <span className={signClass(basis)}>{basis == null ? "n/a" : fmtPct(basis, 3)}</span>
          </div>
        </Card>

        <Card className="space-y-3 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="text-xs font-medium">Estimator</div>
            <label className="flex flex-col gap-1 text-[11px] text-muted">Notional per leg (USD)
              <Input className="w-36" inputMode="decimal" value={s.notionalUsd} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) update({ notionalUsd: n }); }} /></label>
            {[a, b].map((m) => (
              <label key={m.exchange} className="flex flex-col gap-1 text-[11px] text-muted">{EXCHANGE_LABEL[m.exchange]} taker fee (%)
                <Input className="w-28" inputMode="decimal" value={+(s.fees[m.exchange] * 100).toFixed(4)} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) update({ fees: { ...s.fees, [m.exchange]: n / 100 } }); }} /></label>
            ))}
            <label className="flex flex-col gap-1 text-[11px] text-muted">Other costs (USD)
              <Input className="w-28" inputMode="decimal" value={s.otherCostsUsd} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) update({ otherCostsUsd: n }); }} /></label>
          </div>
          {!complete ? <div className="text-xs text-warn">Funding rate, next funding time or interval is unavailable for one leg — no estimate is produced.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead><tr className="border-b border-line text-left text-[11px] uppercase text-muted">
                  <th className="py-1.5">Configuration</th>
                  {HZ.map(([h, l]) => <th key={h} className="py-1.5 text-right">{l}</th>)}
                </tr></thead>
                <tbody>
                  {([0, 1] as const).map((i) => {
                    const r = cur![i];
                    return (
                      <tr key={r.id} className="border-b border-line/60 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{i === 0 ? "1. Short A · Long B" : "2. Long A · Short B"}</div>
                          <div className="text-muted">{r.legA.side.toUpperCase()} {EXCHANGE_LABEL[a.exchange]} / {r.legB.side.toUpperCase()} {EXCHANGE_LABEL[b.exchange]}</div>
                        </td>
                        {HZ.map(([h]) => {
                          const x = evalFor(h)![i];
                          return (
                            <td key={h} className="num py-2 text-right">
                              <div className={`font-semibold ${signClass(x.netReturn)}`}>{fmtUsd(x.netReturn)} <span className="text-[10px] font-normal text-muted">net</span></div>
                              <div className="text-muted">funding {fmtUsd(x.grossFunding)}</div>
                              <div className="text-muted">fees −{fmtUsd(x.fees).replace("$", "$")}</div>
                              <div className="text-muted">slip {x.slippage == null ? "n/a" : `−${fmtUsd(x.slippage)}`}</div>
                              <div className="text-[10px] text-muted">{x.legA.events.length}+{x.legB.events.length} events</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted">
            Only the <b>first</b> event on each leg uses the currently indicated rate; later events in 24h/7d assume that rate persists, which is
            <b> not</b> a forecast and will almost certainly differ. Slippage uses the live order book where depth allowed it (otherwise &quot;n/a&quot; and excluded).
            {sp && <> Normalized spread: <span className="num text-text">{fmtPct(Math.abs(sp.per8h))}</span> per 8h.</>}
            {best && <> Currently higher-net configuration: <b>{best.id === "shortA-longB" ? "Short A / Long B" : "Long A / Short B"}</b> (estimate, not a recommendation).</>}
          </p>
        </Card>

        {la && lb && best && (
          <Card className="p-3">
            <div className="mb-2 text-xs font-medium">Funding event schedule ({s.horizon === "next" ? "next event" : s.horizon})</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[best.legA, best.legB].map((l, i) => (
                <div key={i} className="text-xs">
                  <div className="mb-1 text-muted">{EXCHANGE_LABEL[i === 0 ? a.exchange : b.exchange]} · {l.side.toUpperCase()} · {l.events.length} events</div>
                  <div className="max-h-40 space-y-0.5 overflow-auto pr-2">
                    {l.events.slice(0, 60).map((e) => (
                      <div key={e.ts} className="flex justify-between num"><span>{fmtTime(e.ts)}</span>
                        <span className={e.kind === "indicated" ? "text-accent" : "text-muted"}>{e.kind === "indicated" ? "indicated rate" : "assumed rate"}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium">Historical funding rates
            <Badge tone="muted">exchange-provided</Badge>{(localA?.points.length || localB?.points.length) ? <Badge tone="accent">+ locally collected</Badge> : null}</div>
          {!hist ? <Skeleton className="h-52" /> : !haveExchangeHist ? (
            <div className="rounded border border-dashed border-line p-6 text-center text-xs text-muted">
              {snap.mode === "demo" ? "Historical data is not generated in demonstration mode." : "Historical funding data is unavailable for one or both exchanges right now. No chart is shown rather than inventing data."}
            </div>
          ) : (
            <div className="space-y-3">
              <LineChart lines={[
                { label: `A ${a.exchange}`, color: "#38bdf8", step: true, data: histA!.points.map((p) => ({ ts: p.ts, value: p.rate })) },
                { label: `B ${b.exchange}`, color: "#f5a524", step: true, data: histB!.points.map((p) => ({ ts: p.ts, value: p.rate })) },
              ]} />
              <div className="text-xs font-medium"><Term k="spread">Historical spread A−B (8h-normalized, step-held)</Term></div>
              <LineChart height={180} lines={[{ label: "A−B /8h", color: "#22c55e", step: true, data: spreadLine.map((p) => ({ ts: p.ts, value: p.value })) }]} />
              <p className="text-[11px] text-muted">Rates are per funding event on each exchange&apos;s own schedule. The spread series holds each leg&apos;s latest rate between its events and uses today&apos;s intervals for normalization.</p>
            </div>
          )}
        </Card>

        <Card className="p-3 text-xs leading-relaxed text-muted">
          <div className="mb-1 font-medium text-text">How the configurations work</div>
          <p>Funding is exchanged between longs and shorts of each perpetual. When a rate is positive, longs pay shorts; when negative, shorts pay longs.
            <b className="text-text"> Short A / Long B</b> receives A&apos;s funding if A is positive and pays B&apos;s funding if B is positive (and the reverse for negative rates);
            <b className="text-text"> Long A / Short B</b> is the mirror image. Equal notional on both legs reduces directional price exposure, but does <b>not</b> remove basis risk,
            execution risk, liquidation risk, funding-rate uncertainty or exchange counterparty risk. Leverage is not a source of return here.</p>
        </Card>
      </div>
    </TooltipProvider>
  );
}

function warningsFor(a: PerpMarket, b: PerpMarket, fresh: string, books: { a: OrderBook | null; b: OrderBook | null } | null): string[] {
  const w: string[] = [];
  if (fresh === "stale") w.push("Data is stale — rates may have changed. Do not rely on these figures.");
  if (a.fundingIntervalHours !== b.fundingIntervalHours) w.push(`Funding intervals differ (${fmtInterval(a.fundingIntervalHours)} vs ${fmtInterval(b.fundingIntervalHours)}); payments are not synchronized, so intermediate PnL and the spread can diverge.`);
  for (const m of [a, b]) {
    if (m.intervalSource === "exchange-default") w.push(`${EXCHANGE_LABEL[m.exchange]}: interval assumed from the documented 8h default (not listed in the exchange's adjusted-interval endpoint).`);
    if (m.intervalSource === "unavailable") w.push(`${EXCHANGE_LABEL[m.exchange]}: funding interval unavailable.`);
    if (m.exchange === "okx") w.push("OKX: funding rate shown is the exchange's current published rate; OKX may adjust it before settlement.");
  }
  if (a.priceMultiplier !== b.priceMultiplier) w.push("Contract price multipliers differ between venues (e.g. 1000x contracts). Prices were normalized; verify contract sizes before sizing.");
  if (books && (!books.a || !books.b)) w.push("Order-book data unavailable for at least one leg — slippage is not estimated.");
  return w;
}
