# Exchange API integration

All endpoints are **public, unauthenticated, read-only** market data. No API keys are requested or stored.

> **Verification status:** the build sandbox blocked outbound access to `fapi.binance.com`, `api.bybit.com`,
> `www.okx.com` and their documentation sites (HTTP 403 from the egress proxy). Endpoint paths and field names below
> are written from the official fapi / Bybit V5 / OKX v5 docs as known to the author and are **covered only by synthetic
> fixtures** (`tests/normalize.test.ts`). **They have not been checked against live responses.** On first run from a
> machine with internet access, compare `/api/snapshot` with each exchange's website.

| Exchange | Data | Endpoint | Fields used |
|---|---|---|---|
| Binance USDⓈ-M | metadata/status | `GET /fapi/v1/exchangeInfo` | `symbols[].symbol, contractType=PERPETUAL, status, baseAsset, quoteAsset, marginAsset` |
| | rate, mark, index, next time | `GET /fapi/v1/premiumIndex` | `markPrice, indexPrice, lastFundingRate, nextFundingTime, time` |
| | interval | `GET /fapi/v1/fundingInfo` | `fundingIntervalHours` (only adjusted symbols; others default to 8h, flagged `exchange-default`) |
| | volume | `GET /fapi/v1/ticker/24hr` | `quoteVolume` |
| | history | `GET /fapi/v1/fundingRate` | `fundingRate, fundingTime` |
| | book | `GET /fapi/v1/depth` | `bids, asks` |
| Bybit V5 linear | rate, mark, index, next time, volume | `GET /v5/market/tickers?category=linear` | `fundingRate, nextFundingTime, markPrice, indexPrice, turnover24h` |
| | metadata/status/interval | `GET /v5/market/instruments-info?category=linear` (paged) | `contractType=LinearPerpetual, status, baseCoin, quoteCoin, settleCoin, fundingInterval` (minutes) |
| | history | `GET /v5/market/funding/history` | `fundingRate, fundingRateTimestamp` |
| | book | `GET /v5/market/orderbook` | `b, a, ts` |
| OKX V5 swaps | metadata/status | `GET /api/v5/public/instruments?instType=SWAP` | `ctType=linear, ctVal, ctValCcy, settleCcy, state=live` |
| | rate, times | `GET /api/v5/public/funding-rate?instId=…` | `fundingRate, fundingTime, nextFundingTime` (interval = next − current) |
| | mark / index / volume | `/public/mark-price`, `/market/index-tickers`, `/market/tickers` | `markPx, idxPx, volCcy24h × last` |
| | history | `GET /api/v5/public/funding-rate-history` | `fundingRate, fundingTime` |
| | book | `GET /api/v5/market/books` | `asks, bids` (contracts × `ctVal` → base units) |

## Known limitations
- OKX's funding-rate endpoint is per instrument and rate-limited, so only the `OKX_MAX_FUNDING_INSTRUMENTS` (default 120) most liquid swaps are fetched, concurrency 4.
- Binance symbols absent from `fundingInfo` use the documented 8h default; the UI marks this with `*` and a warning.
- Missing fields are surfaced as `n/a`; pairs with missing rate/time/interval are skipped, never filled.
- Depth-based liquidity filtering is not available in bulk; 24h volume is a proxy. Order-book slippage is computed per opportunity on the details page.

## Resilience
`src/lib/http.ts`: 8s timeout, 2 retries with exponential backoff, `Retry-After` honored for 429/418, errors reduced to `host: reason` (no URLs/bodies).
`src/lib/cache.ts`: TTL cache, in-flight de-dup, stale-on-error. `src/lib/scanner.ts`: per-exchange status (`connected` / `degraded` / `down`);
on failure the previous data is kept and visibly ages into `stale`.

## Instrument compatibility (`src/lib/calc/matching.ts`)
Markets are paired only if both are linear, trading, same base (after stripping `1000`/`10000`… multipliers), same quote and settlement currency,
and their multiplier-normalized mark prices are within 5%. Mismatches are excluded and counted on the dashboard.
