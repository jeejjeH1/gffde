import { buildCandidates } from "../calc/matching";
import { bestConfig, evaluate, type Horizon } from "../calc/funding";
import { dataAgeSec } from "../calc/freshness";
import { DEFAULT_FEES } from "../defaults";
import { alertRecentlySent, markAlertSent } from "../store/db";
import { EXCHANGE_LABEL, type Snapshot } from "../types";

export interface AlertConfig {
  token: string; chatId: string;
  notionalUsd: number; horizon: Horizon; minNetUsd: number; maxAgeSec: number; dedupeMinutes: number;
}

export function alertConfigFromEnv(env = process.env): AlertConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN, chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  const horizon = (["next", "24h", "7d"].includes(env.ALERT_HORIZON ?? "") ? env.ALERT_HORIZON : "24h") as Horizon;
  return {
    token, chatId, horizon,
    notionalUsd: Number(env.ALERT_NOTIONAL_USD ?? 10000),
    minNetUsd: Number(env.ALERT_MIN_NET_USD ?? 15),
    maxAgeSec: Number(env.ALERT_MAX_DATA_AGE_SEC ?? 90),
    dedupeMinutes: Number(env.ALERT_DEDUPE_MINUTES ?? 120),
  };
}

const memorySent = new Map<string, number>();

export async function isDuplicate(key: string, minutes: number, now = Date.now()): Promise<boolean> {
  const t = memorySent.get(key);
  if (t != null && now - t < minutes * 60_000) return true;
  try {
    return (await alertRecentlySent(key, minutes)) === true;
  } catch {
    return false;
  }
}

export async function recordSent(key: string, now = Date.now()): Promise<void> {
  memorySent.set(key, now);
  try { await markAlertSent(key); } catch { /* DB optional */ }
}

export function resetAlertMemory() { memorySent.clear(); }

const pct = (x: number) => `${(x * 100).toFixed(4)}%`;
const usd = (x: number) => `${x < 0 ? "-" : ""}$${Math.abs(x).toFixed(2)}`;
const iso = (t: number | null) => (t == null ? "n/a" : new Date(t).toISOString().replace(".000Z", "Z"));

export interface Alert { key: string; text: string }

export function buildAlerts(snap: Snapshot, cfg: Omit<AlertConfig, "token" | "chatId">, now = Date.now()): Alert[] {
  const { candidates } = buildCandidates(snap.markets);
  const out: Alert[] = [];
  for (const c of candidates) {
    const { a, b } = c;
    if ([a, b].some((m) => m.fundingRate == null || m.nextFundingTime == null || m.fundingIntervalHours == null)) continue;
    const age = Math.max(dataAgeSec(a.fetchedAt, now) ?? Infinity, dataAgeSec(b.fetchedAt, now) ?? Infinity);
    if (age > cfg.maxAgeSec) continue;
    const res = evaluate({
      a: { rate: a.fundingRate!, nextFundingTime: a.nextFundingTime!, intervalHours: a.fundingIntervalHours! },
      b: { rate: b.fundingRate!, nextFundingTime: b.nextFundingTime!, intervalHours: b.fundingIntervalHours! },
      notionalA: cfg.notionalUsd, notionalB: cfg.notionalUsd,
      fees: { takerA: DEFAULT_FEES[a.exchange], takerB: DEFAULT_FEES[b.exchange] },
      horizon: cfg.horizon, now,
    });
    const best = bestConfig(res);
    if (best.netReturn < cfg.minNetUsd) continue;
    const sA = best.legA.side, sB = best.legB.side;
    const key = `${c.id}:${best.id}`;
    const text = [
      `FundingEdge — hypothetical opportunity${snap.mode === "demo" ? " (DEMO DATA)" : ""}`,
      `Symbol: ${c.base} (${a.nativeSymbol} / ${b.nativeSymbol})`,
      `Candidate: ${sA.toUpperCase()} ${EXCHANGE_LABEL[a.exchange]} · ${sB.toUpperCase()} ${EXCHANGE_LABEL[b.exchange]}`,
      `Funding rates: ${pct(a.fundingRate!)} (${a.fundingIntervalHours}h) vs ${pct(b.fundingRate!)} (${b.fundingIntervalHours}h)`,
      `Next funding: ${iso(a.nextFundingTime)} / ${iso(b.nextFundingTime)}`,
      `Horizon ${cfg.horizon}, notional ${usd(cfg.notionalUsd)}/leg`,
      `Est. gross funding: ${usd(best.grossFunding)} · fees: ${usd(best.fees)} (slippage not included)`,
      `Est. net: ${usd(best.netReturn)}`,
      `Data age: ${age.toFixed(0)}s · sent ${iso(now)}`,
      `Risk: estimate only, not guaranteed. Rates change before settlement; basis, execution, liquidation and exchange counterparty risk remain.`,
    ].join("\n");
    out.push({ key, text });
  }
  return out;
}

export async function sendTelegram(cfg: Pick<AlertConfig, "token" | "chatId">, text: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  // Never include the URL (contains the token) in errors.
  if (!res.ok) throw new Error(`telegram: HTTP ${res.status}`);
}

export async function runAlerts(snap: Snapshot, cfg: AlertConfig, send = sendTelegram, now = Date.now()) {
  const alerts = buildAlerts(snap, cfg, now);
  let sent = 0, skipped = 0;
  for (const al of alerts) {
    if (await isDuplicate(al.key, cfg.dedupeMinutes, now)) { skipped++; continue; }
    await send(cfg, al.text);
    await recordSent(al.key, now);
    sent++;
  }
  return { candidates: alerts.length, sent, skipped };
}
