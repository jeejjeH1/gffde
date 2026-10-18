"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ServerCrash } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoBanner, ExchangeStatuses, RefreshButton, Stat } from "@/components/StatusBar";
import { Badge, Button, Card, Input, Skeleton, Term, Tip, TooltipProvider } from "@/components/ui/primitives";
import { fmtCountdown, fmtInterval, fmtPct, fmtUsd, signClass } from "@/lib/format";
import { computeRows, filterRows, type Row } from "@/lib/opportunities";
import { useSettings } from "@/lib/settings";
import { useSnapshot } from "@/lib/useSnapshot";
import { EXCHANGE_LABEL, type ExchangeId } from "@/lib/types";
import { FiltersPanel } from "./FiltersPanel";

type SortKey = "net" | "spread" | "symbol" | "exchange";
const PAGE = 25;

export function Dashboard() {
  const { snap, error, now, reload } = useSnapshot();
  const [s, update] = useSettings();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "net", dir: -1 });
  const [page, setPage] = useState(0);

  const computed = useMemo(() => (snap ? computeRows(snap, s, now) : null), [snap, s, now]);
  const filtered = useMemo(() => (computed ? filterRows(computed.rows, s) : []), [computed, s]);
  const sorted = useMemo(() => {
    const val = (r: Row) => sort.key === "net" ? r.best.netReturn : sort.key === "spread" ? r.spreadPer8h : sort.key === "symbol" ? r.cand.base : `${r.cand.a.exchange}-${r.cand.b.exchange}`;
    return [...filtered].sort((x, y) => { const a = val(x), b = val(y); return (a < b ? -1 : a > b ? 1 : 0) * sort.dir; });
  }, [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * PAGE, cur * PAGE + PAGE);
  const connected = snap?.statuses.filter((x) => x.state !== "down").length ?? 0;
  const allDown = snap && snap.statuses.every((x) => x.state === "down");
  const bestSpread = computed?.rows.reduce((m, r) => Math.max(m, r.spreadPer8h), 0) ?? 0;
  const lastOk = snap ? Math.max(0, ...snap.statuses.map((x) => x.lastSuccessAt ?? 0)) || null : null;
  const totalPairs = snap ? new Set(snap.markets.map((m) => `${m.base}/${m.quote}`)).size : 0;

  const head = (label: React.ReactNode, key?: SortKey, className = "") => (
    <th className={`whitespace-nowrap px-2 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted ${className}`}>
      {key ? (
        <button className="inline-flex items-center gap-1 hover:text-text" onClick={() => { setPage(0); setSort((p) => ({ key, dir: p.key === key ? (-p.dir as 1 | -1) : -1 })); }}>
          {label}{sort.key === key && (sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
        </button>
      ) : label}
    </th>
  );

  return (
    <TooltipProvider>
      {snap?.mode === "demo" && <DemoBanner />}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Funding rate opportunities <Badge tone="accent" className="ml-2">hypothetical estimates</Badge></h1>
        <RefreshButton onClick={reload} at={lastOk} />
      </div>

      {error && !snap && (
        <Card className="mb-3 flex items-center gap-3 border-down/40 p-4 text-down"><ServerCrash className="h-5 w-5" />
          <div><div className="font-medium">Cannot reach the FundingEdge server</div><div className="text-xs">{error}</div></div>
          <Button className="ml-auto" onClick={reload}>Retry</Button></Card>
      )}
      {error && snap && <div className="mb-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Refresh failed ({error}); showing the last data received.</div>}

      {!snap ? (
        <div className="space-y-3"><div className="flex gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] flex-1" />)}</div><Skeleton className="h-64" /></div>
      ) : (
        <div className="fade space-y-3">
          <div className="flex flex-wrap gap-2">
            <Stat label="Supported pairs" value={totalPairs.toLocaleString()} sub={`${snap.markets.length.toLocaleString()} perpetual contracts`} />
            <Stat label="Exchanges connected" value={`${connected}/${snap.statuses.length}`} />
            <Stat label={<Term k="spread">Best spread /8h</Term>} value={<span className="text-up">{fmtPct(bestSpread)}</span>} sub="normalized, not profit" />
            <Stat label="Matching filters" value={`${filtered.length}`} sub={`of ${computed?.total ?? 0} comparable pairs`} />
          </div>
          <ExchangeStatuses snap={snap} now={now} />

          {allDown && (
            <Card className="border-down/40 p-4 text-down">
              <div className="font-medium">All exchange connections are failing.</div>
              <div className="text-xs text-muted">No live data is available. Check network egress to the exchange public APIs; nothing is being simulated.</div>
            </Card>
          )}

          <FiltersPanel s={s} update={(p) => { setPage(0); update(p); }} />

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] border-collapse">
                <thead className="border-b border-line bg-panel2/60">
                  <tr>
                    {head("Symbol", "symbol")}
                    {head("Exchange A", "exchange")}
                    {head("Exchange B")}
                    {head("Rate A")}
                    {head("Rate B")}
                    {head("Next funding A / B")}
                    {head(<Term k="interval">Interval A / B</Term>)}
                    {head(<Term k="spread">Spread /8h</Term>, "spread")}
                    {head(<Term k="gross">Est. funding</Term>)}
                    {head(<Term k="fees">Est. fees</Term>)}
                    {head(<Term k="net">Est. net</Term>, "net")}
                    {head(<Term k="freshness">Data</Term>)}
                    {head("")}
                  </tr>
                </thead>
                <tbody>
                  {view.map((r) => <OppRow key={r.cand.id} r={r} now={now} horizonLabel={s.horizon} />)}
                </tbody>
              </table>
            </div>
            {view.length === 0 && (
              <div className="p-8 text-center text-muted">
                {computed?.total ? "No opportunities match the current filters." : "No comparable contracts available yet."}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-muted">
              <span>
                {computed ? `${computed.incomplete} pairs skipped (missing funding data) · ${computed.exclusions.length} incompatible instrument pairs excluded` : ""}
              </span>
              <span className="flex items-center gap-2">
                {sorted.length ? `${cur * PAGE + 1}–${Math.min(sorted.length, cur * PAGE + PAGE)} of ${sorted.length}` : "0"}
                <Button variant="ghost" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="ghost" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </span>
            </div>
          </Card>
          <p className="text-[11px] text-muted">
            Estimates cover the <b>{s.horizon === "next" ? "next funding event" : s.horizon}</b> horizon at {fmtUsd(s.notionalUsd, 0)} per leg using your fee assumptions.
            Slippage is not included in this table — open Details for order-book-based estimates. Rates are indicated values that change until settlement.
          </p>
        </div>
      )}
    </TooltipProvider>
  );
}

function OppRow({ r, now, horizonLabel }: { r: Row; now: number; horizonLabel: string }) {
  const { a, b } = r.cand;
  const side = (x: "long" | "short") => <span className={`ml-1 text-[10px] uppercase ${x === "long" ? "text-up" : "text-down"}`}>{x}</span>;
  return (
    <tr className="border-b border-line/60 hover:bg-panel2/50">
      <td className="px-2 py-1.5 font-medium">{r.cand.base}<span className="text-muted">/{a.quote}</span></td>
      <td className="px-2 py-1.5">{EXCHANGE_LABEL[a.exchange]}{side(r.best.legA.side)}</td>
      <td className="px-2 py-1.5">{EXCHANGE_LABEL[b.exchange]}{side(r.best.legB.side)}</td>
      <td className={`num px-2 py-1.5 ${signClass(a.fundingRate)}`}>{fmtPct(a.fundingRate)}</td>
      <td className={`num px-2 py-1.5 ${signClass(b.fundingRate)}`}>{fmtPct(b.fundingRate)}</td>
      <td className="num px-2 py-1.5 text-muted">{fmtCountdown(a.nextFundingTime, now)} / {fmtCountdown(b.nextFundingTime, now)}</td>
      <td className="num px-2 py-1.5 text-muted">
        {fmtInterval(a.fundingIntervalHours)}{a.intervalSource === "exchange-default" ? "*" : ""} / {fmtInterval(b.fundingIntervalHours)}{b.intervalSource === "exchange-default" ? "*" : ""}
      </td>
      <td className="num px-2 py-1.5">{fmtPct(r.spreadPer8h)}</td>
      <td className={`num px-2 py-1.5 ${signClass(r.best.grossFunding)}`}>{fmtUsd(r.best.grossFunding)}</td>
      <td className="num px-2 py-1.5 text-muted">{fmtUsd(r.best.fees)}</td>
      <td className={`num px-2 py-1.5 font-semibold ${signClass(r.best.netReturn)}`}>
        <Tip text={`Hypothetical estimate over ${horizonLabel}; not guaranteed.`}><span>{fmtUsd(r.best.netReturn)}</span></Tip>
      </td>
      <td className="px-2 py-1.5">
        <Badge tone={r.fresh === "fresh" ? "up" : r.fresh === "stale" ? "down" : "muted"}>
          {r.ageSec == null ? "unknown" : `${r.fresh} ${Math.round(r.ageSec)}s`}
        </Badge>
      </td>
      <td className="px-2 py-1.5 text-right">
        <Link href={`/opportunity?base=${encodeURIComponent(r.cand.base)}&quote=${a.quote}&a=${a.exchange}&b=${b.exchange}`}>
          <Button variant="primary">Details</Button>
        </Link>
      </td>
    </tr>
  );
}
