import { readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import type { FundingPoint, PerpMarket } from "../types";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export const dbConfigured = () => !!process.env.DATABASE_URL;

async function getPool(): Promise<Pool> {
  if (!pool) {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
    pool.on("error", (e) => console.error("[db] pool error:", e.message));
  }
  if (!ready) {
    const sql = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
    ready = pool.query(sql).then(() => undefined);
    ready.catch(() => { ready = null; });
  }
  await ready;
  return pool;
}

/** Store the currently indicated rate for each upcoming funding event (upsert). */
export async function recordObservations(markets: PerpMarket[], observedAt: number): Promise<number> {
  const rows = markets.filter((m) => m.fundingRate != null && m.nextFundingTime != null);
  if (!dbConfigured() || rows.length === 0) return 0;
  const p = await getPool();
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const tuples = part.map((m, k) => {
      values.push(m.exchange, m.nativeSymbol, m.fundingRate, new Date(m.nextFundingTime!), new Date(observedAt));
      const o = k * 5;
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5})`;
    });
    await p.query(
      `INSERT INTO funding_observations (exchange,symbol,funding_rate,event_ts,observed_at) VALUES ${tuples.join(",")}
       ON CONFLICT (exchange,symbol,event_ts) DO UPDATE SET funding_rate = EXCLUDED.funding_rate, observed_at = EXCLUDED.observed_at`,
      values,
    );
  }
  return rows.length;
}

export async function localHistory(exchange: string, symbol: string, limit: number): Promise<FundingPoint[]> {
  if (!dbConfigured()) return [];
  const p = await getPool();
  const r = await p.query(
    `SELECT event_ts, funding_rate FROM funding_observations WHERE exchange=$1 AND symbol=$2
     AND event_ts <= now() ORDER BY event_ts DESC LIMIT $3`,
    [exchange, symbol, limit],
  );
  return r.rows.map((x) => ({ ts: new Date(x.event_ts).getTime(), rate: x.funding_rate as number })).reverse();
}

export async function applyRetention(days: number): Promise<void> {
  if (!dbConfigured()) return;
  const p = await getPool();
  await p.query(`DELETE FROM funding_observations WHERE event_ts < now() - ($1 || ' days')::interval`, [String(days)]);
  await p.query(`DELETE FROM alert_log WHERE sent_at < now() - interval '7 days'`);
}

export async function alertRecentlySent(key: string, minutes: number): Promise<boolean | null> {
  if (!dbConfigured()) return null;
  const p = await getPool();
  const r = await p.query(`SELECT 1 FROM alert_log WHERE dedupe_key=$1 AND sent_at > now() - ($2 || ' minutes')::interval`, [key, String(minutes)]);
  return (r.rowCount ?? 0) > 0;
}

export async function markAlertSent(key: string): Promise<void> {
  if (!dbConfigured()) return;
  const p = await getPool();
  await p.query(`INSERT INTO alert_log (dedupe_key, sent_at) VALUES ($1, now()) ON CONFLICT (dedupe_key) DO UPDATE SET sent_at = now()`, [key]);
}
