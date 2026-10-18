import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cache } from "@/lib/cache";
import { adapters, EXCHANGE_IDS } from "@/lib/exchanges";
import { fail, throttle } from "@/lib/api";
import { DEMO } from "@/lib/config";
import { getSnapshot } from "@/lib/scanner";

export const dynamic = "force-dynamic";

const Q = z.object({
  exchange: z.enum(EXCHANGE_IDS as [string, ...string[]]),
  symbol: z.string().regex(/^[A-Za-z0-9_.-]{2,40}$/),
});

export async function GET(req: NextRequest) {
  const limited = throttle(req, 60);
  if (limited) return limited;
  const q = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return fail(400, "invalid query");
  if (DEMO) return fail(404, "Order books are not available in demo mode");
  const ex = q.data.exchange as (typeof EXCHANGE_IDS)[number];
  const snap = await getSnapshot();
  const market = snap.markets.find((m) => m.exchange === ex && m.nativeSymbol === q.data.symbol);
  if (!market) return fail(404, "unknown market");
  try {
    const r = await cache.get(`ob:${ex}:${q.data.symbol}`, 3_000, () => adapters[ex].fetchOrderBook(market, 100));
    return NextResponse.json(r.value);
  } catch {
    return fail(502, "Order book unavailable");
  }
}
