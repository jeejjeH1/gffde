import type { ExchangeId } from "./types";

/**
 * ASSUMED standard-tier taker fee rates (fractions). Actual fees depend on account
 * tier, VIP level, fee-token discounts and order type — users must override these.
 */
export const DEFAULT_FEES: Record<ExchangeId, number> = {
  binance: 0.0005,
  bybit: 0.00055,
  okx: 0.0005,
};
