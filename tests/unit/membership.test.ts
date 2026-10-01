import { test } from "node:test";
import assert from "node:assert/strict";
import { benefitEligibleFrom, coverage, graceEndsAt } from "../../src/lib/membership/coverage";

const TZ = "America/Los_Angeles";
const local = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(d);

test("benefit starts 6 calendar months after the enrollment date at the masjid, at local midnight", () => {
  // Sep 30, 8 PM in Brentwood is already Oct 1 in UTC — the masjid's date is what counts.
  assert.equal(local(benefitEligibleFrom(new Date("2026-10-01T03:00:00Z"), TZ)), "2027-03-30, 00:00");
  assert.equal(local(benefitEligibleFrom(new Date("2026-08-31T18:00:00Z"), TZ)), "2027-02-28, 00:00"); // month-end clamp
  assert.equal(local(benefitEligibleFrom(new Date("2027-08-31T18:00:00Z"), TZ)), "2028-02-29, 00:00"); // leap year
});

test("coverage: waiting period, covered, grace, paused, resumed", () => {
  const eligible = new Date("2027-03-30T07:00:00Z");
  const active = { status: "ACTIVE" as const, benefitEligibleFrom: eligible, graceEndsAt: null };
  assert.equal(coverage({ status: "PENDING_PAYMENT", benefitEligibleFrom: null, graceEndsAt: null }), "not_enrolled");
  assert.equal(coverage(active, new Date("2027-01-01T00:00:00Z")), "waiting");
  assert.equal(coverage(active, new Date("2027-04-01T00:00:00Z")), "covered");

  const missed = { status: "PAST_DUE" as const, benefitEligibleFrom: eligible, graceEndsAt: graceEndsAt(new Date("2027-05-01T00:00:00Z")) };
  assert.equal(coverage(missed, new Date("2027-05-20T00:00:00Z")), "grace"); // within 30 days
  assert.equal(coverage(missed, new Date("2027-06-01T00:00:00Z")), "paused"); // after 30 days
  // Missing a payment during the waiting period doesn't start coverage early.
  assert.equal(coverage({ ...missed, graceEndsAt: graceEndsAt(new Date("2027-01-01T00:00:00Z")) }, new Date("2027-01-10T00:00:00Z")), "waiting");
  assert.equal(coverage({ status: "CANCELLED", benefitEligibleFrom: eligible, graceEndsAt: null }), "canceled");
});
