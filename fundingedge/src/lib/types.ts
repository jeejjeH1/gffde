export type ExchangeId = "binance" | "bybit" | "okx";

export const EXCHANGE_LABEL: Record<ExchangeId, string> = {
  binance: "Binance USDⓈ-M",
  bybit: "Bybit Linear",
  okx: "OKX Swap",
};

/** A value that the exchange API did not provide is `null` — never invented. */
export type Maybe<T> = T | null;

/**
 * Normalized linear perpetual market. All exchange-specific quirks are resolved
 * by the adapters so the rest of the app only sees this shape.
 */
export interface PerpMarket {
  exchange: ExchangeId;
  /** Exchange-native symbol, e.g. BTCUSDT or BTC-USDT-SWAP. */
  nativeSymbol: string;
  /** Underlying asset after stripping numeric multiplier prefixes, e.g. "PEPE". */
  base: string;
  /** Number of underlying units priced per 1 quoted unit, e.g. 1000 for "1000PEPE". */
  priceMultiplier: number;
  quote: string;
  /** Collateral/settlement currency. */
  settle: string;
  linear: boolean;
  /** Funding rate for the next funding event (decimal, 0.0001 = 0.01%). */
  fundingRate: Maybe<number>;
  nextFundingTime: Maybe<number>;
  fundingIntervalHours: Maybe<number>;
  /** How the interval was determined. */
  intervalSource: "exchange" | "derived" | "exchange-default" | "unavailable";
  markPrice: Maybe<number>;
  indexPrice: Maybe<number>;
  /** 24h turnover in quote currency. */
  volume24hQuote: Maybe<number>;
  /** Taker-side tradable status as reported by the exchange. */
  tradable: boolean;
  /** Epoch ms of our last successful fetch that produced this record. */
  fetchedAt: number;
  /** Timestamp provided by the exchange payload, if any. */
  exchangeTs: Maybe<number>;
  /** OKX only: base units per contract; used to convert order book sizes. */
  contractValue?: Maybe<number>;
}

export interface ExchangeStatus {
  exchange: ExchangeId;
  state: "connected" | "degraded" | "down";
  lastSuccessAt: Maybe<number>;
  lastError: Maybe<string>;
  marketCount: number;
  latencyMs: Maybe<number>;
}

export interface Snapshot {
  generatedAt: number;
  mode: "live" | "demo";
  staleAfterSec: number;
  markets: PerpMarket[];
  statuses: ExchangeStatus[];
}

export interface FundingPoint {
  /** Funding event timestamp (ms). */
  ts: number;
  rate: number;
}

export interface HistorySeries {
  exchange: ExchangeId;
  nativeSymbol: string;
  source: "exchange" | "local";
  points: FundingPoint[];
}

export interface OrderBook {
  exchange: ExchangeId;
  nativeSymbol: string;
  /** [price, size in base-asset units], best first. */
  bids: Array<[number, number]>;
  asks: Array<[number, number]>;
  ts: Maybe<number>;
}
