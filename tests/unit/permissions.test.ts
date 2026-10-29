import { test } from "node:test";
import assert from "node:assert/strict";
import { can, isStaff, navFor, NAV } from "../../src/lib/auth/permissions";

test("super admins can open every section", () => {
  for (const n of NAV) assert.ok(can(["SUPER_ADMIN"], n.section), n.section);
});

test("each role sees only its sections", () => {
  assert.ok(can(["CONTENT_EDITOR"], "events"));
  assert.ok(can(["CONTENT_EDITOR"], "announcements"));
  assert.ok(!can(["CONTENT_EDITOR"], "prayer"));
  assert.ok(!can(["CONTENT_EDITOR"], "users"));

  assert.ok(can(["PRAYER_MANAGER"], "prayer"));
  assert.ok(!can(["PRAYER_MANAGER"], "events"));

  assert.ok(can(["MEMBERSHIP_COORDINATOR"], "memberships"));
  assert.ok(can(["MEMBERSHIP_COORDINATOR"], "directory"));
  assert.ok(!can(["MEMBERSHIP_COORDINATOR"], "donations"));

  assert.ok(can(["TREASURER"], "donations"));
  assert.ok(!can(["TREASURER"], "memberships"));
});

test("users, settings, privacy requests and the activity log are super-admin only", () => {
  for (const role of ["CONTENT_EDITOR", "PRAYER_MANAGER", "MEMBERSHIP_COORDINATOR", "TREASURER"]) {
    for (const section of ["users", "settings", "privacy", "activity"] as const) assert.ok(!can([role], section), `${role} → ${section}`);
  }
});

test("roles combine, everyone with a role gets the dashboard, no role = no access", () => {
  const both = ["PRAYER_MANAGER", "TREASURER"];
  assert.ok(can(both, "prayer") && can(both, "donations"));
  assert.ok(can(["TREASURER"], "dashboard"));
  assert.ok(!isStaff([]) && !can([], "dashboard"));
  assert.deepEqual(navFor(["PRAYER_MANAGER"]).map((n) => n.section), ["dashboard", "prayer"]);
});
