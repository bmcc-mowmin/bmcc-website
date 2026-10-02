"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { cancelRsvp, saveRsvp, type RsvpError } from "@/lib/events/rsvp";
import { db } from "@/lib/db";

export type RsvpState = { status: "idle" } | { status: "saved" } | { status: "error"; error: RsvpError };

export async function rsvpAction(_prev: RsvpState, form: FormData): Promise<RsvpState> {
  const slug = String(form.get("slug") ?? "");
  const user = await requireMember(`/events/${slug}`);
  const event = await db.event.findUnique({ where: { slug }, select: { id: true } });
  if (!event) return { status: "error", error: "rsvp_closed" };
  const result = await saveRsvp(user.id, event.id, String(form.get("date") ?? ""), Number(form.get("party")));
  if (!result.ok) return { status: "error", error: result.error };
  revalidatePath(`/events/${slug}`);
  revalidatePath("/account/events");
  return { status: "saved" };
}

export async function cancelRsvpAction(form: FormData) {
  const back = String(form.get("back") ?? "/account/events");
  const user = await requireMember(back);
  await cancelRsvp(user.id, String(form.get("rsvpId") ?? ""));
  revalidatePath(back.startsWith("/") ? back : "/account/events");
  revalidatePath("/account/events");
}
