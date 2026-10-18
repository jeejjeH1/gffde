export const fmtPct = (x: number | null | undefined, digits = 4) =>
  x == null ? "n/a" : `${(x * 100).toFixed(digits)}%`;

export const fmtUsd = (x: number | null | undefined, digits = 2) =>
  x == null ? "n/a" : `${x < 0 ? "−" : ""}$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const fmtCompact = (x: number | null | undefined) =>
  x == null ? "n/a" : Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(x);

export const fmtPrice = (x: number | null | undefined) =>
  x == null ? "n/a" : x >= 100 ? x.toLocaleString("en-US", { maximumFractionDigits: 2 }) : x.toPrecision(5).replace(/\.?0+$/, "");

export function fmtCountdown(ts: number | null, now: number): string {
  if (ts == null) return "n/a";
  const s = Math.round((ts - now) / 1000);
  if (s <= 0) return "due";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export const fmtTime = (ts: number | null | undefined) =>
  ts == null ? "n/a" : new Date(ts).toISOString().slice(0, 16).replace("T", " ") + " UTC";

export const fmtInterval = (h: number | null) => (h == null ? "n/a" : `${+h.toFixed(2)}h`);

export const signClass = (x: number | null | undefined) =>
  x == null || x === 0 ? "text-muted" : x > 0 ? "text-up" : "text-down";
