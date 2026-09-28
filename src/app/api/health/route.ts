import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Health check for the load balancer / uptime monitor: 200 when the app and database are up.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
