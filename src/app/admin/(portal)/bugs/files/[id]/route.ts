import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/auth/permissions";
import { storage } from "@/lib/storage";

// Bug-report attachments are private: only admins who can see bugs may open them.
export async function GET(_req: Request, { params }: RouteContext<"/admin/bugs/files/[id]">) {
  const user = await getCurrentUser();
  if (!user || !can(user.adminRoles, "bugs")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const file = await db.bugAttachment.findUnique({ where: { id } });
  const bytes = file ? await storage.get(file.storageKey).catch(() => null) : null;
  if (!file || !bytes) return new Response("Not found", { status: 404 });
  const safeName = file.filename.replace(/[^\w.\- ]+/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.contentType,
      // Images open in the browser; PDFs are downloaded rather than rendered inline.
      "Content-Disposition": `${file.contentType.startsWith("image/") ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
