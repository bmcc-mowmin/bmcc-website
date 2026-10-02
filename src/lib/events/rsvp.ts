import "server-only";
import { db } from "@/lib/db";
import { getCalcSettings } from "@/lib/prayer/schedule";
import { upcomingOccurrences } from "./recurrence";

// RSVPs: signed-in members say they're coming to one date of an event (with how many people).
// Only for events with RSVP switched on in admin, only for upcoming dates, and never past the
// event's capacity (counted in people, per date).

export const MAX_PARTY = 10;
export const RSVP_DATES = 6; // how many upcoming dates of a weekly event can be chosen

export type RsvpError = "rsvp_closed" | "rsvp_full" | "rsvp_bad_date" | "rsvp_bad_party";

export async function rsvpDates(eventId: string, now = new Date()) {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.published || !event.rsvpEnabled) return null;
  const { timezone } = await getCalcSettings();
  // Only dates that haven't started yet can be chosen.
  const dates = upcomingOccurrences(event, timezone, now, RSVP_DATES).filter((o) => o.start > now);
  const counts = await db.eventRsvp.groupBy({ by: ["occurrenceStart"], where: { eventId, occurrenceStart: { in: dates.map((d) => d.start) } }, _sum: { partySize: true } });
  return {
    event,
    dates: dates.map((d) => {
      const taken = counts.find((c) => c.occurrenceStart.getTime() === d.start.getTime())?._sum.partySize ?? 0;
      return { ...d, taken, left: event.rsvpCapacity === null ? null : Math.max(0, event.rsvpCapacity - taken) };
    }),
  };
}

export async function saveRsvp(userId: string, eventId: string, occurrenceIso: string, partySize: number): Promise<{ ok: true } | { ok: false; error: RsvpError }> {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY) return { ok: false, error: "rsvp_bad_party" };
  const info = await rsvpDates(eventId);
  if (!info) return { ok: false, error: "rsvp_closed" };
  const date = info.dates.find((d) => d.start.toISOString() === occurrenceIso);
  if (!date) return { ok: false, error: "rsvp_bad_date" };
  const occurrenceStart = date.start;
  const capacity = info.event.rsvpCapacity;

  return db.$transaction(async (tx) => {
    // One RSVP change per event date at a time, so two people can't both take the last place.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rsvp:${eventId}:${occurrenceStart.toISOString()}`}))`;
    if (capacity !== null) {
      const others = await tx.eventRsvp.aggregate({ where: { eventId, occurrenceStart, NOT: { userId } }, _sum: { partySize: true } });
      if ((others._sum.partySize ?? 0) + partySize > capacity) return { ok: false as const, error: "rsvp_full" as const };
    }
    await tx.eventRsvp.upsert({
      where: { eventId_occurrenceStart_userId: { eventId, occurrenceStart, userId } },
      create: { eventId, occurrenceStart, userId, partySize },
      update: { partySize },
    });
    return { ok: true as const };
  });
}

export async function cancelRsvp(userId: string, rsvpId: string) {
  const { count } = await db.eventRsvp.deleteMany({ where: { id: rsvpId, userId } });
  return count === 1;
}

// For admin: everyone coming, per upcoming date.
export async function rsvpsForEvent(eventId: string, now = new Date()) {
  return db.eventRsvp.findMany({
    where: { eventId, occurrenceStart: { gte: new Date(now.getTime() - 24 * 3600_000) } },
    orderBy: [{ occurrenceStart: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { name: true, email: true } } },
  });
}
