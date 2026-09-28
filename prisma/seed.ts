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

if (process.env.APP_ENV === "production") {
  console.error("Refusing to seed: APP_ENV=production.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const TZ = process.env.MASJID_TIMEZONE || "America/Los_Angeles";

// ── Translations: build { en, dari, urdu, pashto } for a message key ────────
const LANGS = ["en", "dari", "urdu", "pashto"] as const;
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
        location: messages.en[`ev${e.n}_location`],
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
      role: "ADMIN",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  const member = await db.user.create({
    data: {
      email: process.env.SEED_MEMBER_EMAIL || "member@bmcc.local",
      name: "Test Member",
      role: "MEMBER",
      passwordHash: await bcrypt.hash(memberPassword, 10),
    },
  });

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

  // ── Community Directory — FAKE sample listings (same shape as the vetted CSV) ─
  const masjidAddress = { address: "7701 Lone Tree Way", city: "Brentwood", state: "CA", zip: "94513" };
  const listings = [
    { name: "Sample Halal Grill", listingType: "BUSINESS", parentCategory: "Restaurant", category: "Halal Restaurant", tags: ["Halal", "Mediterranean"], description: "Sample listing — Mediterranean grill with falafel, skewers and fresh bread.", phone: "(925) 555-0110", website: "https://example.com/halal-grill", ...masjidAddress },
    { name: "Sample HVAC Services", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "HVACR Repair", tags: ["HVACR"], description: "Sample listing — heating, ventilation and air-conditioning repair.", phone: "(925) 555-0111" },
    { name: "Brother Sample A.", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "HVACR Repair", tags: ["HVACR"], description: "Sample listing — no additional description provided.", phone: "(925) 555-0112" },
    { name: "Sample Pest Control", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — residential pest control.", phone: "(925) 555-0113" },
    { name: "Example Pest Solutions", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — no additional description provided." },
    { name: "Test Exterminators", listingType: "BUSINESS", parentCategory: "Home Services / Repair", category: "Pest Control", tags: ["Pest Control"], description: "Sample listing — no additional description provided.", phone: "(925) 555-0114" },
    { name: "Sample Cabinet Repair", listingType: "INDIVIDUAL", parentCategory: "Home Services / Repair", category: "Kitchen Countertop/Cabinet Repair", tags: ["Countertop & Cabinet"], description: "Sample listing — kitchen countertop and cabinet repair.", phone: "(925) 555-0115" },
    { name: "Sample Computer Help", listingType: "INDIVIDUAL", parentCategory: "Computer Repair", category: "Computer Services", tags: ["Computer Services"], description: "Sample listing — computer setup and repair.", email: "computers@example.com" },
    { name: "Sample Acupuncture Clinic", listingType: "BUSINESS", parentCategory: "Alternate Medicine", category: "Acupuncture", tags: ["Acupuncture"], description: "Sample listing — acupuncture and wellness.", phone: "(925) 555-0116", website: "https://example.com/acupuncture", ...masjidAddress },
    { name: "Sample Limo Service", listingType: "BUSINESS", parentCategory: "Transportation and Warehousing", category: "Limo Service", tags: ["Limo Rental"], description: "Sample listing — limousine rental for weddings and events.", phone: "(925) 555-0117" },
  ] as const;
  for (const l of listings) {
    await db.directoryListing.create({
      data: { ...l, tags: [...l.tags], author: l.name, status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() },
    });
  }
  // Two submissions waiting in the admin approval queue (never public).
  await db.directoryListing.createMany({
    data: [
      { name: "Pending Sample Tutoring", listingType: "INDIVIDUAL", parentCategory: "Education", category: "Tutoring", tags: ["Tutoring", "Math"], description: "Sample pending submission — math tutoring.", author: "Pending Sample", phone: "(925) 555-0120", submitterEmail: "tutor@example.com", status: "PENDING" },
      { name: "Pending Sample Bakery", listingType: "BUSINESS", parentCategory: "Restaurant", category: "Bakery", tags: ["Halal", "Bakery"], description: "Sample pending submission — halal bakery.", author: "Pending Bakery", submitterEmail: "bakery@example.com", status: "PENDING" },
    ],
  });

  console.log("Seeded: prayer settings, 2 Jumu'ah services, 5 announcements (1 expired), 4 events,");
  console.log(`        ${listings.length} approved + 2 pending directory listings, admin + member test accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
