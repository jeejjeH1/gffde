import type { ExchangeId } from "../types";
import type { ExchangeAdapter } from "./adapter";
import { binance } from "./binance";
import { bybit } from "./bybit";
import { okx } from "./okx";

export const adapters: Record<ExchangeId, ExchangeAdapter> = { binance, bybit, okx };
export const EXCHANGE_IDS = Object.keys(adapters) as ExchangeId[];
