// Not the barrel: it would load the whole DAL, better-auth and next/headers included, for a SELECT 1.
import { pingDatabase } from "@/lib/dal/dal-health";

// Each call wakes Neon's compute for about five minutes: monitors check this one at most hourly.
export const dynamic = "force-dynamic";

export async function GET() {
  const isUp = await pingDatabase();
  return Response.json(
    { status: isUp ? "ok" : "error" },
    { headers: { "Cache-Control": "no-store" }, status: isUp ? 200 : 503 },
  );
}
