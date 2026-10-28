import { test } from "node:test";
import assert from "node:assert/strict";
import { bugRef, detectAttachment, dueDate, guessArea, isOverdue, parseBugRef, suggestPriority } from "../../src/lib/bugs/rules";

test("bug references", () => {
  assert.equal(bugRef(7), "BUG-0007");
  assert.equal(bugRef(12345), "BUG-12345");
  for (const v of ["BUG-0012", "bug12", "#12", "12", " Bug-012 "]) assert.equal(parseBugRef(v), 12, v);
  assert.equal(parseBugRef("hello"), null);
});

test("the area is guessed from the page and the type of problem", () => {
  assert.equal(guessArea("/prayer-times", "broken"), "prayer");
  assert.equal(guessArea("https://brmcc.org/events/community-dinner", "display"), "events");
  assert.equal(guessArea("/donate?fund=new-bmcc", "broken"), "giving");
  assert.equal(guessArea("/about", "payment"), "giving");
  assert.equal(guessArea("/", "translation"), "content");
  assert.equal(guessArea("/admin/media", "broken"), "admin");
  assert.equal(guessArea("/about", "wrong_info"), "content");
  assert.equal(guessArea(null, "broken"), null);
  assert.equal(guessArea("not a url %%%", "other"), null);
});

test("suggested priority and due dates", () => {
  assert.equal(suggestPriority("blocked", "payment"), "P1");
  assert.equal(suggestPriority("blocked", "broken"), "P2");
  assert.equal(suggestPriority("annoying", "broken"), "P3");
  assert.equal(suggestPriority("minor", "display"), "P4");
  const from = new Date("2026-10-01T12:00:00Z");
  assert.equal(dueDate("P1", from)?.toISOString(), "2026-10-02T12:00:00.000Z");
  assert.equal(dueDate("P3", from)?.toISOString(), "2026-10-15T12:00:00.000Z");
  assert.equal(dueDate("P4", from), null);
});

test("overdue only while still waiting for a fix", () => {
  const past = new Date(Date.now() - 1000);
  assert.ok(isOverdue({ dueAt: past, status: "IN_PROGRESS" }));
  assert.ok(!isOverdue({ dueAt: past, status: "FIXED" }));
  assert.ok(!isOverdue({ dueAt: past, status: "CLOSED" }));
  assert.ok(!isOverdue({ dueAt: null, status: "TRIAGED" }));
});

test("attachments are recognised by their bytes, not their names", () => {
  assert.equal(detectAttachment(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))?.type, "image/jpeg");
  assert.equal(detectAttachment(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.type, "image/png");
  assert.equal(detectAttachment(new TextEncoder().encode("%PDF-1.7 ..."))?.type, "application/pdf");
  assert.equal(detectAttachment(new TextEncoder().encode("<html><script>")), null);
});
