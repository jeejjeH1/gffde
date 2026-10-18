import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cache } from "@/lib/cache";
import { adapters, EXCHANGE_IDS } from "@/lib/exchanges";
import { fail, throttle } from "@/lib/api";
import { DEMO } from "@/lib/config";
import { localHistory, dbConfigured } from "@/lib/store/db";
import type { HistorySeries } from "@/lib/types";

export const dynamic = "force-dynamic";

const Q = z.object({
  exchange: z.enum(EXCHANGE_IDS as [string, ...string[]]),
  symbol: z.string().regex(/^[A-Za-z0-9_.-]{2,40}$/),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export async function GET(req: NextRequest) {
  const limited = throttle(req, 60);
  if (limited) return limited;
  const q = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return fail(400, "invalid query");
  const { exchange, symbol, limit } = q.data;
  const ex = exchange as (typeof EXCHANGE_IDS)[number];
  if (DEMO) return NextResponse.json({ series: [], note: "History is not generated in demo mode." });

  const series: HistorySeries[] = [];
  const errors: string[] = [];
  try {
    const r = await cache.get(`hist:${ex}:${symbol}:${limit}`, 60_000, () => adapters[ex].fetchFundingHistory(symbol, limit));
    series.push({ exchange: ex, nativeSymbol: symbol, source: "exchange", points: r.value });
  } catch {
    errors.push("Exchange history unavailable");
  }
  if (dbConfigured()) {
    try {
      series.push({ exchange: ex, nativeSymbol: symbol, source: "local", points: await localHistory(ex, symbol, limit) });
    } catch {
      errors.push("Local history unavailable");
    }
  }
  return NextResponse.json({ series, errors });
}
