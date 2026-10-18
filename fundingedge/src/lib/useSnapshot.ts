"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot } from "./types";

export function useSnapshot(intervalMs = 15_000) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 429 ? "Rate limited — slowing down" : `Server error (${r.status})`);
      setSnap(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, intervalMs);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer.current); clearInterval(tick); };
  }, [load, intervalMs]);

  return { snap, error, now, reload: load };
}
