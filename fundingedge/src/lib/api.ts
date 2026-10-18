import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

const buckets = new Map<string, { tokens: number; at: number }>();

/** Per-IP token bucket: `limit` requests per minute. In-memory (per instance). */
export function throttle(req: NextRequest, limit = 60): NextResponse | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: limit, at: now };
  b.tokens = Math.min(limit, b.tokens + ((now - b.at) / 60_000) * limit);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: { "retry-after": "10" } });
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.at > 120_000) buckets.delete(k);
  return null;
}

export function requireSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "endpoint disabled (CRON_SECRET not set)" }, { status: 503 });
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
