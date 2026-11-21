// Liveness only: it must never touch the database, so an uptime monitor can call it often without waking Neon.
// Dynamic so every request runs the function instead of getting a prerendered response.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
