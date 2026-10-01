// Local sample data. Run with `npm run db:seed` (or automatically after `prisma migrate reset`).
// It REFUSES to run when APP_ENV=production, and it wipes the tables it seeds.
//
// Directory listings are FAKE (invented names, 555-01xx phone numbers). The real vetted
// listings are restored from BMCC's spreadsheet at go-live — see GO_LIVE.md.
import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { addDays, weekdayOf, zonedDate, zonedToUtc } from "../src/lib/time";
import { seedDirectory } from "./directory-seed";

if (process.env.APP_ENV === "production") {
  console.error("Refusing to seed: APP_ENV=production.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const TZ = process.env.MASJID_TIMEZONE || "America/Los_Angeles";

// ── Translations: build { en, dari, urdu, pashto } for a message key ────────
const LANGS = ["en", "dari", "urdu", "pashto", "spanish"] as const;
const messages = Object.fromEntries(
  LANGS.map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Record<string, string>]),
);
function l10n(key: string, transform: (s: string) => string = (s) => s) {
  const out: Record<string, string> = {};
  for (const l of LANGS) if (messages[l][key]) out[l] = transform(messages[l][key]);
  if (!out.en) throw new Error(`Missing English message: ${key}`);
  return out;
}

// ── Dates relative to today at the masjid, so sample events are always upcoming ──
const today = zonedDate(new Date(), TZ);
const nextWeekday = (weekday: number, from = today) => addDays(from, (weekday - weekdayOf(from) + 7) % 7 || 7);
const at = (date: string, time: string) => zonedToUtc(date, time, TZ);

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const memberPassword = process.env.SEED_MEMBER_PASSWORD;
  if (!adminPassword || !memberPassword) {
    throw new Error("Set SEED_ADMIN_PASSWORD and SEED_MEMBER_PASSWORD in .env (run `npm run setup`).");
  }

  // Wipe in dependency order.
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.eventRsvp.deleteMany(),
    db.payment.deleteMany(),
    db.membership.deleteMany(),
    db.householdMember.deleteMany(),
    db.household.deleteMany(),
    db.directoryListing.deleteMany(),
    db.authToken.deleteMany(),
    db.user.deleteMany(),
    db.event.deleteMany(),
    db.announcement.deleteMany(),
    db.jumuahService.deleteMany(),
    db.prayerDayOverride.deleteMany(),
    db.iqamahRule.deleteMany(),
    db.prayerSettings.deleteMany(),
  ]);

  // ── Prayer times ──────────────────────────────────────────────────────────
  await db.prayerSettings.create({
    data: {
      id: 1,
      latitude: Number(process.env.MASJID_LAT ?? 37.93),
      longitude: Number(process.env.MASJID_LNG ?? -121.7),
      timezone: TZ,
      calcMethod: "NorthAmerica",
      madhab: "Hanafi",
    },
  });
  // Offsets taken from the prototype's example table (content blocker: BMCC to confirm).
  const effectiveFrom = new Date(`${today.slice(0, 4)}-01-01`);
  await db.iqamahRule.createMany({
    data: [
      { prayer: "FAJR", mode: "OFFSET", offsetMinutes: 18, effectiveFrom },
      { prayer: "DHUHR", mode: "OFFSET", offsetMinutes: 30, effectiveFrom },
      { prayer: "ASR", mode: "OFFSET", offsetMinutes: 15, effectiveFrom },
      { prayer: "MAGHRIB", mode: "OFFSET", offsetMinutes: 5, effectiveFrom },
      { prayer: "ISHA", mode: "OFFSET", offsetMinutes: 15, effectiveFrom },
    ],
  });
  await db.jumuahService.createMany({
    data: [
      { label: l10n("jumuah_first"), khutbahTime: "13:00", iqamahTime: "13:20", location: l10n("jumuah_hall"), sortOrder: 1 },
      {
        label: l10n("jumuah_second"),
        khutbahTime: "14:00",
        iqamahTime: "14:20",
        location: l10n("jumuah_hall"),
        note: l10n("jumuah_note"),
        sortOrder: 2,
      },
    ],
  });

  // ── Announcements (the 4 ticker items from the header prototype) ─────────
  const startAt = at(addDays(today, -1), "00:00");
  const stripPrefix = (s: string) => s.replace(/^[^:：]{1,20}[:：]\s*/, ""); // "Announcement: …" → "…"
  await db.announcement.createMany({
    data: [
      { text: l10n("announcement", stripPrefix), link: "/events", startAt, sortOrder: 1 },
      { text: l10n("ann_2"), link: "/prayer-times", startAt, sortOrder: 2 },
      { text: l10n("ann_3"), link: "/assistance", startAt, sortOrder: 3 },
      { text: l10n("ann_4"), link: "/membership", startAt, sortOrder: 4 },
      // Expired example — must NOT appear anywhere (tests the date window).
      { text: { en: "Expired sample announcement" }, link: null, startAt: at(addDays(today, -30), "00:00"), endAt: at(addDays(today, -2), "00:00"), sortOrder: 5 },
    ],
  });

  // ── Events (the prototype's 4, with dates moved into the future) ─────────
  const friday = nextWeekday(5);
  const saturday = nextWeekday(6);
  const dinnerDay = nextWeekday(6, addDays(today, 12));
  const meetingDay = nextWeekday(0, addDays(today, 26));
  const events = [
    { slug: "friday-jumuah", n: 1, start: at(friday, "13:00"), end: at(friday, "14:00"), rrule: "FREQ=WEEKLY;BYDAY=FR" },
    { slug: "weekend-islamic-studies", n: 2, start: at(saturday, "10:00"), end: at(saturday, "12:30"), rrule: "FREQ=WEEKLY;BYDAY=SA" },
    { slug: "community-dinner", n: 3, start: at(dinnerDay, "18:30"), end: at(dinnerDay, "21:00"), rrule: null },
    { slug: "general-body-meeting", n: 4, start: at(meetingDay, "11:00"), end: at(meetingDay, "13:00"), rrule: null },
  ];
  for (const e of events) {
    await db.event.create({
      data: {
        slug: e.slug,
        title: l10n(`ev${e.n}_title`),
        description: l10n(`ev${e.n}_desc`),
        tag: l10n(`ev${e.n}_tag`),
        location: l10n(`ev${e.n}_location`),
        startAt: e.start,
        endAt: e.end,
        rrule: e.rrule,
      },
    });
  }

  // ── Users (local test accounts) ───────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      email: process.env.SEED_ADMIN_EMAIL || "admin@bmcc.local",
      name: "BMCC Admin (test)",
      adminRoles: ["SUPER_ADMIN"],
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  const member = await db.user.create({
    data: {
      email: process.env.SEED_MEMBER_EMAIL || "member@bmcc.local",
      name: "Test Member",
      passwordHash: await bcrypt.hash(memberPassword, 10),
    },
  });

  // One local test account per admin role (shared password SEED_STAFF_PASSWORD), to try permissions.
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  if (staffPassword) {
    const hash = await bcrypt.hash(staffPassword, 10);
    const staff = [
      ["editor@bmcc.local", "Content Editor (test)", "CONTENT_EDITOR"],
      ["prayer@bmcc.local", "Prayer Manager (test)", "PRAYER_MANAGER"],
      ["membership@bmcc.local", "Membership Coordinator (test)", "MEMBERSHIP_COORDINATOR"],
      ["treasurer@bmcc.local", "Treasurer (test)", "TREASURER"],
    ] as const;
    for (const [email, name, role] of staff) {
      await db.user.create({ data: { email, name, adminRoles: [role], passwordHash: hash } });
    }
  }

  // Existing member with an active membership, for testing the portal (phase 7).
  const enrolledAt = at(addDays(today, -60), "10:00");
  const eligible = new Date(enrolledAt);
  eligible.setMonth(eligible.getMonth() + 6);
  const household = await db.household.create({
    data: {
      primaryUserId: member.id,
      addressLine1: "100 Sample Street",
      city: "Brentwood",
      state: "CA",
      zip: "94513",
      phone: "(925) 555-0100",
      email: member.email,
      emergencyName: "Sample Contact",
      emergencyPhone: "(925) 555-0101",
      members: {
        create: [
          { fullName: "Test Member", relationship: "SELF", dateOfBirth: new Date("1985-04-12") },
          { fullName: "Sample Spouse", relationship: "SPOUSE", dateOfBirth: new Date("1987-09-03") },
          { fullName: "Sample Child", relationship: "CHILD", dateOfBirth: new Date("2014-01-20") },
        ],
      },
    },
  });
  await db.membership.create({
    data: {
      referenceId: "BMCC-TEST01",
      membershipNumber: "M-0001",
      householdId: household.id,
      plan: "MONTHLY",
      status: "ACTIVE",
      appliedAt: enrolledAt,
      declarationAcceptedAt: enrolledAt,
      enrolledAt,
      benefitEligibleFrom: eligible,
      paymentProvider: "mock",
    },
  });

  // ── Community Directory (real listings from the git-ignored CSV if present, else fake samples) ─
  const directory = await seedDirectory(db, admin.id);

  console.log("Seeded: prayer settings, 2 Jumu'ah services, 5 announcements (1 expired), 4 events,");
  console.log(`        ${directory}, admin + member test accounts${staffPassword ? ", 4 role test accounts" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
