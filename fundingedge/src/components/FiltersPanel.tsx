"use client";
import { Card, Input, Term } from "@/components/ui/primitives";
import { EXCHANGE_IDS } from "@/lib/exchanges/ids";
import type { Settings } from "@/lib/settings";
import { EXCHANGE_LABEL } from "@/lib/types";

const HORIZONS = [["next", "Next event"], ["24h", "24 hours"], ["7d", "7 days"]] as const;

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <label className="flex min-w-[120px] flex-col gap-1 text-[11px] text-muted">{label}{children}</label>;
}

const numVal = (v: string, fallback: number) => (v.trim() === "" || !Number.isFinite(Number(v)) ? fallback : Number(v));

export function FiltersPanel({ s, update }: { s: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <Card className="space-y-3 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Symbol search"><Input placeholder="BTC, ETH…" value={s.search} onChange={(e) => update({ search: e.target.value })} /></Field>
        <div className="flex flex-col gap-1 text-[11px] text-muted">Exchanges
          <div className="flex gap-1">
            {EXCHANGE_IDS.map((id) => {
              const on = s.exchanges.includes(id);
              return <button key={id} onClick={() => update({ exchanges: on ? s.exchanges.filter((x) => x !== id) : [...s.exchanges, id] })}
                className={`h-8 rounded-md border px-2 text-xs ${on ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted"}`}>{EXCHANGE_LABEL[id]}</button>;
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11px] text-muted">Horizon
          <div className="flex gap-1">
            {HORIZONS.map(([v, l]) => <button key={v} onClick={() => update({ horizon: v })}
              className={`h-8 rounded-md border px-2 text-xs ${s.horizon === v ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted"}`}>{l}</button>)}
          </div>
        </div>
        <Field label="Notional per leg (USD)"><Input inputMode="decimal" value={s.notionalUsd} onChange={(e) => update({ notionalUsd: Math.max(1, numVal(e.target.value, s.notionalUsd)) })} /></Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={<Term k="spread">Min spread /8h (%)</Term>}><Input inputMode="decimal" value={s.minSpreadPct} onChange={(e) => update({ minSpreadPct: numVal(e.target.value, 0) })} /></Field>
        <Field label={<Term k="net">Min est. net (USD)</Term>}><Input inputMode="decimal" value={s.minNetUsd <= -1e8 ? "" : s.minNetUsd} placeholder="any" onChange={(e) => update({ minNetUsd: numVal(e.target.value, -1e9) })} /></Field>
        <Field label={<Term k="fees">Max est. fees (USD)</Term>}><Input inputMode="decimal" value={s.maxFeesUsd >= 1e8 ? "" : s.maxFeesUsd} placeholder="any" onChange={(e) => update({ maxFeesUsd: numVal(e.target.value, 1e9) })} /></Field>
        <Field label={<Term k="volume">Min 24h volume (USD)</Term>}><Input inputMode="decimal" value={s.minVolumeUsd} onChange={(e) => update({ minVolumeUsd: numVal(e.target.value, 0) })} /></Field>
        <Field label={<Term k="freshness">Max data age (s)</Term>}><Input inputMode="decimal" value={s.maxAgeSec >= 3600 ? "" : s.maxAgeSec} placeholder="any" onChange={(e) => update({ maxAgeSec: numVal(e.target.value, 3600) })} /></Field>
        <Field label="Other costs (USD)"><Input inputMode="decimal" value={s.otherCostsUsd} onChange={(e) => update({ otherCostsUsd: Math.max(0, numVal(e.target.value, 0)) })} /></Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <span className="pb-2 text-[11px] text-muted">Taker fee assumptions (%) — set to your account tier:</span>
        {EXCHANGE_IDS.map((id) => (
          <Field key={id} label={EXCHANGE_LABEL[id]}>
            <Input inputMode="decimal" value={+(s.fees[id] * 100).toFixed(4)} onChange={(e) => update({ fees: { ...s.fees, [id]: Math.max(0, numVal(e.target.value, s.fees[id] * 100) / 100) } })} />
          </Field>
        ))}
        <span className="pb-2 text-[11px] text-muted">Liquidity filter by order-book depth is not offered in bulk; volume is a proxy only.</span>
      </div>
    </Card>
  );
}
