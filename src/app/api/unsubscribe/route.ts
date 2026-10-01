import { unsubscribe } from "@/lib/mailing-list";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const row = await unsubscribe(token);
  return new Response(row ? "Unsubscribed" : "Not found", { status: row ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}

// Someone opening the header link in a browser gets the normal page with its button.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return new Response(null, { status: 303, headers: { Location: `/unsubscribe?token=${encodeURIComponent(token)}` } });
}
