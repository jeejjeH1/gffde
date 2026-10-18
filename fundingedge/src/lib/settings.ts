"use client";
import { useCallback, useEffect, useState } from "react";
import type { Horizon } from "./calc/funding";
import { DEFAULT_FEES } from "./defaults";
import type { ExchangeId } from "./types";

export interface Settings {
  notionalUsd: number;
  horizon: Horizon;
  fees: Record<ExchangeId, number>;
  otherCostsUsd: number;
  exchanges: ExchangeId[];
  search: string;
  minSpreadPct: number;
  minNetUsd: number;
  maxFeesUsd: number;
  minVolumeUsd: number;
  maxAgeSec: number;
}

export const DEFAULT_SETTINGS: Settings = {
  notionalUsd: 10_000, horizon: "24h", fees: { ...DEFAULT_FEES }, otherCostsUsd: 0,
  exchanges: ["binance", "bybit", "okx"], search: "", minSpreadPct: 0, minNetUsd: -1e9, maxFeesUsd: 1e9, minVolumeUsd: 0, maxAgeSec: 3600,
};

const KEY = "fundingedge.settings.v1";

/** Persisted in the browser only as a per-viewer convenience; render works without it. */
export function useSettings() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...DEFAULT_SETTINGS, ...JSON.parse(raw), fees: { ...DEFAULT_FEES, ...JSON.parse(raw).fees } });
    } catch { /* ignore */ }
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [s, update] as const;
}
