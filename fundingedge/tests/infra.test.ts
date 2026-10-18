import { describe, expect, it, vi } from "vitest";
import { fetchJson, HttpError } from "@/lib/http";
import { TtlCache } from "@/lib/cache";
import { dataAgeSec, freshness } from "@/lib/calc/freshness";
import { buildAlerts, isDuplicate, recordSent, resetAlertMemory, runAlerts, sendTelegram } from "@/lib/alerts/telegram";
import { demoMarkets } from "@/fixtures/demo";
import type { Snapshot } from "@/lib/types";

const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const noSleep = async () => {};

describe("fetchJson", () => {
  it("retries 5xx then succeeds", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200, { ok: 1 }));
    expect(await fetchJson("https://x.test/a", { fetchImpl: f, sleep: noSleep })).toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("does not retry 4xx and hides URL path in error", async () => {
    const f = vi.fn().mockResolvedValue(res(400));
    await expect(fetchJson("https://x.test/secret?k=1", { fetchImpl: f, sleep: noSleep })).rejects.toThrow("x.test: HTTP 400");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("honors Retry-After on 429 and gives up after retries", async () => {
    const sleeps: number[] = [];
    const f = vi.fn().mockResolvedValue(res(429, {}, { "retry-after": "2" }));
    await expect(fetchJson("https://x.test/a", { fetchImpl: f, retries: 2, sleep: async (ms) => void sleeps.push(ms) })).rejects.toBeInstanceOf(HttpError);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([2000, 2000]);
  });
  it("times out", async () => {
    const f = vi.fn((_u: unknown, init?: RequestInit) => new Promise<Response>((_, rej) => init!.signal!.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))));
    await expect(fetchJson("https://x.test/a", { fetchImpl: f as unknown as typeof fetch, timeoutMs: 10, retries: 0 })).rejects.toThrow("timeout");
  });
});

describe("TtlCache", () => {
  it("serves cache, dedupes in-flight, falls back to stale on error", async () => {
    const c = new TtlCache();
    let t = 0;
    const load = vi.fn().mockResolvedValue(1);
    const [a, b] = await Promise.all([c.get("k", 100, load, () => t), c.get("k", 100, load, () => t)]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(a.value).toBe(1); expect(b.value).toBe(1);
    t = 500;
    const r = await c.get("k", 100, () => Promise.reject(new Error("down")), () => t);
    expect(r).toMatchObject({ value: 1, stale: true });
    await expect(new TtlCache().get("x", 1, () => Promise.reject(new Error("down")))).rejects.toThrow("down");
  });
});

describe("freshness", () => {
  it("classifies age", () => {
    expect(freshness(dataAgeSec(0, 30_000), 60)).toBe("fresh");
    expect(freshness(dataAgeSec(0, 120_000), 60)).toBe("stale");
    expect(freshness(dataAgeSec(null, 1), 60)).toBe("unknown");
  });
});

describe("alerts", () => {
  const now = 1_700_000_000_000;
  const snap = (): Snapshot => ({ generatedAt: now, mode: "demo", staleAfterSec: 90, markets: demoMarkets(now), statuses: [] });
  const cfg = { notionalUsd: 10_000, horizon: "24h" as const, minNetUsd: 5, maxAgeSec: 90, dedupeMinutes: 60 };

  it("includes required fields and risk warning; no token in text", () => {
    const [al] = buildAlerts(snap(), cfg, now);
    expect(al.text).toMatch(/Funding rates/);
    expect(al.text).toMatch(/Est\. net/);
    expect(al.text).toMatch(/not guaranteed/);
    expect(al.text).toMatch(/DEMO/);
  });
  it("skips stale data", () => {
    const s = snap();
    s.markets.forEach((m) => (m.fetchedAt = now - 1_000_000));
    expect(buildAlerts(s, cfg, now)).toHaveLength(0);
  });
  it("sends once, then de-duplicates", async () => {
    resetAlertMemory();
    const send = vi.fn().mockResolvedValue(undefined);
    const full = { ...cfg, token: "T", chatId: "C" };
    const first = await runAlerts(snap(), full, send, now);
    const second = await runAlerts(snap(), full, send, now + 1000);
    expect(first.sent).toBeGreaterThan(0);
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(first.sent);
    expect(await isDuplicate("nope", 60, now)).toBe(false);
    await recordSent("k", now);
    expect(await isDuplicate("k", 60, now + 1)).toBe(true);
    expect(await isDuplicate("k", 60, now + 61 * 60_000)).toBe(false);
  });
  it("telegram errors never leak the token", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
    await expect(sendTelegram({ token: "SECRET", chatId: "1" }, "x", f as unknown as typeof fetch)).rejects.toThrow(/^telegram: HTTP 401$/);
  });
});
