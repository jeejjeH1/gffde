# FundingEdge

Analytics-only scanner for cross-exchange **perpetual funding-rate differences** (Binance USDⓈ-M, Bybit linear, OKX swaps).
It never trades, never asks for API keys, and never touches funds. All profit figures are **hypothetical estimates**, never guarantees.

Stack: Next.js 15 (App Router) · TypeScript · Tailwind · Radix-based UI primitives (shadcn-style) · lightweight-charts · Vitest · optional PostgreSQL.

## Quick start
```bash
cd fundingedge
npm install
cp .env.example .env.local      # optional
npm run dev                     # http://localhost:3000
npm test                        # unit tests
npm run build && npm start      # production
```
The server needs outbound HTTPS to the three exchanges' public APIs. If they are unreachable the dashboard shows **down** statuses and an
explicit error — nothing is simulated. For UI development only, `FUNDINGEDGE_DEMO=1` serves clearly labelled synthetic data
(banner on every page; alerts and storage disabled).

> ⚠ The exchange integrations were written from documentation but **could not be verified against live APIs in the build environment**
> (egress blocked). See `docs/EXCHANGE_APIS.md`. Verify on first run.

## How it works
```
Exchange adapters (server) ─► normalize to PerpMarket ─► scanner (cache, status, stale-on-error) ─► /api/snapshot
                                                                                                         │
Browser: matching (compatible pairs) ─► calc/funding (per-leg cash flows, fees, slippage) ─► table / details
```
- `src/lib/exchanges/*` – adapters; unavailable fields are `null` and shown as `n/a`.
- `src/lib/calc/funding.ts` – the calculation module (pure, unit-tested). `matching.ts` – compatibility rules. `history.ts` – spread series.
- Estimates run in the browser from the snapshot, so notional, fees, horizon and filters update instantly.

### Calculations
Per funding event, cash flow = `−side × rate × notional` (long = +1, short = −1; positive = received). Both configurations
(**Short A/Long B**, **Long A/Short B**) are evaluated with each leg's own notional, interval and schedule: events are generated on each
exchange's real grid inside the horizon (`next` = until both legs settled once, `24h`, `7d`). The first event uses the currently indicated
rate; later events **assume it persists — explicitly not a forecast**.
`net = funding − 2×(notionalA·feeA + notionalB·feeB) − slippage − other`. Fees are user-set (defaults are assumed standard-tier taker rates).
Slippage is walked through the live order book on the details page and is `n/a` (excluded) when depth is insufficient.
Leverage is never a profit source. The "spread" column is the 8h-normalized rate difference and is labelled *not profit*.

### Filters, sorting
Exchanges, symbol, min spread, min net, max fees, min 24h volume (liquidity proxy), max data age; sort by net, spread, symbol, exchange; 25 rows/page.
Settings persist in browser localStorage only.

### Historical data
Exchange-provided history is fetched live for the chart (labelled *exchange-provided*). With `DATABASE_URL`, `POST /api/collect` stores the
indicated rate per `(exchange, symbol, event_ts)` (upsert de-dupes; the last observation before settlement wins), enforces
`HISTORY_RETENTION_DAYS`, and the chart additionally shows *locally collected* observations. Schema: `db/schema.sql` (auto-applied).
Without a DB everything else works. If history is unavailable, a message replaces the chart.

### Telegram alerts
Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET` (server-side only). Schedule `POST /api/alerts/check` with
`Authorization: Bearer $CRON_SECRET` (cron / Vercel cron / GitHub Actions); same for `/api/collect`. Alerts contain symbol, exchanges, rates,
long/short configuration, estimated funding & net, timestamps, data age and risk warnings; they skip stale data and are de-duplicated per
opportunity+configuration for `ALERT_DEDUPE_MINUTES` (memory, plus DB if configured).

## Security
Exchange calls and secrets are server-side only; inputs validated with zod; per-IP throttling on `/api/*`; secret-guarded cron endpoints
(constant-time compare, disabled if unset); errors/logs carry no tokens, URLs or bodies; no hardcoded credentials.
Throttle and cache are in-memory per instance — use a shared store if you scale horizontally.

## Deployment
Any Node 20+ host (`npm run build && npm start`) or Vercel. Serverless caches reset per instance; use a scheduled job for alerts/collection.

## Tests (`npm test`)
Funding signs and conventions, mixed intervals/horizons, notionals, fees, net return, missing/stale data, incompatible instruments,
response normalization (synthetic fixtures shaped like documented payloads — **not market data**), HTTP retry/timeout, cache, alerts & de-duplication.

## Not done / future
Live verification of adapters; WebSocket streaming (REST polling only, 15s); bulk order-book liquidity filter; UI component tests.
Funding-rate prediction is deliberately omitted.
