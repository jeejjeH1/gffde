import { NextResponse, type NextRequest } from "next/server";
import { fail, requireSecret } from "@/lib/api";
import { alertConfigFromEnv, runAlerts } from "@/lib/alerts/telegram";
import { getSnapshot } from "@/lib/scanner";

export const dynamic = "force-dynamic";

/** Cron endpoint: evaluate opportunities against env thresholds and send Telegram alerts. */
export async function POST(req: NextRequest) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const cfg = alertConfigFromEnv();
  if (!cfg) return fail(409, "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)");
  const snap = await getSnapshot();
  if (snap.mode === "demo") return fail(409, "alerts disabled in demo mode");
  try {
    return NextResponse.json(await runAlerts(snap, cfg));
  } catch (e) {
    console.error("[alerts] failed:", e instanceof Error ? e.message : "unknown");
    return fail(502, "alert delivery failed");
  }
}
export const GET = POST;
