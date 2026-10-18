"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge, Button, Card, Term } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/format";
import { EXCHANGE_LABEL, type Snapshot } from "@/lib/types";

export function DemoBanner() {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      DEMONSTRATION MODE — all values below are synthetic and are NOT live market data.
    </div>
  );
}

export function ExchangeStatuses({ snap, now }: { snap: Snapshot; now: number }) {
  const tone = { connected: "up", degraded: "warn", down: "down" } as const;
  return (
    <div className="flex flex-wrap gap-2">
      {snap.statuses.map((s) => (
        <Card key={s.exchange} className="flex min-w-[210px] flex-1 items-center justify-between gap-3 px-3 py-2">
          <div>
            <div className="text-xs font-medium">{EXCHANGE_LABEL[s.exchange]}</div>
            <div className="text-[11px] text-muted">
              {s.lastSuccessAt ? `updated ${Math.max(0, Math.round((now - s.lastSuccessAt) / 1000))}s ago · ${s.marketCount} mkts` : "no successful update yet"}
            </div>
            {s.lastError && <div className="text-[11px] text-down">{s.lastError}</div>}
          </div>
          <Badge tone={tone[s.state]}>{s.state}</Badge>
        </Card>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tip }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; tip?: boolean }) {
  void tip;
  return (
    <Card className="flex-1 min-w-[150px] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="num mt-1 text-lg font-semibold leading-none">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </Card>
  );
}

export function RefreshButton({ onClick, at }: { onClick: () => void; at: number | null }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span>Last successful update: <span className="num text-text">{fmtTime(at)}</span></span>
      <Button variant="ghost" onClick={onClick} aria-label="Refresh"><RefreshCw className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
export { Term };
