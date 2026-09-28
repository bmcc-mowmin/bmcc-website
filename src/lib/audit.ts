import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Records who changed what in admin. Never throws — a failed audit write must not block the edit.
export async function audit(actorId: string, action: string, entity: string, entityId: string, diff?: Prisma.InputJsonValue) {
  try {
    await db.auditLog.create({ data: { actorId, action, entity, entityId, diff } });
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
