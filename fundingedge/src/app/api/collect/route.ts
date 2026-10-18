import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSecret } from "@/lib/api";
import { getSnapshot } from "@/lib/scanner";
import { applyRetention, dbConfigured, recordObservations } from "@/lib/store/db";

export const dynamic = "force-dynamic";

/** Cron endpoint: persist currently indicated funding rates and enforce retention. */
export async function POST(req: NextRequest) {
  const denied = requireSecret(req);
  if (denied) return denied;
  if (!dbConfigured()) return fail(409, "DATABASE_URL not configured");
  const snap = await getSnapshot();
  if (snap.mode === "demo") return fail(409, "refusing to store demo data");
  try {
    const stored = await recordObservations(snap.markets, snap.generatedAt);
    await applyRetention(Number(process.env.HISTORY_RETENTION_DAYS ?? 90));
    return NextResponse.json({ stored });
  } catch {
    return fail(500, "storage error");
  }
}
export const GET = POST;
