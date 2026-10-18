import { NextResponse, type NextRequest } from "next/server";
import { fail, throttle } from "@/lib/api";
import { getSnapshot } from "@/lib/scanner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = throttle(req, 120);
  if (limited) return limited;
  try {
    const snap = await getSnapshot();
    return NextResponse.json(snap, { headers: { "cache-control": "no-store" } });
  } catch {
    return fail(502, "Unable to build market snapshot");
  }
}
