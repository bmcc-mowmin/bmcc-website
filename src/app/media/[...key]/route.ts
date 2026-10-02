import { storage } from "@/lib/storage";

// Serves uploaded images (event photos, media library) from the storage driver (local folder or S3).
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_req: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key } = await params;
  const path = key.join("/");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (!/^(events|library)\//.test(path) || !TYPES[ext]) return new Response("Not found", { status: 404 });
  let file: Buffer | null = null;
  try {
    file = await storage.get(path);
  } catch {
    file = null;
  }
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": TYPES[ext],
      // Keys are unique per upload, so the file at a URL never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
