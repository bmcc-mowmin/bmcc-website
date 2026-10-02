import { test, expect } from "@playwright/test";
import { masjidDate, roleState } from "./helpers";
import { sql } from "./db";

// Prayer times: one source of truth (calculated Hanafi times + Iqamah rules + day overrides) for
// the API, the PDF and the pages; Jumu'ah on Fridays; a prayer manager overrides a single day.

type Day = { date: string; prayers: { key: string; adhan: string; iqamah: string }[]; jumuah: { label: string }[] };
const dayOf = async (request: import("@playwright/test").APIRequestContext, date: string) => (await (await request.get(`/api/prayer-times?date=${date}`)).json()) as Day;

test("the times API gives five prayers in order, and Jumu'ah only on Fridays", async ({ request }) => {
  for (let i = 0; i < 7; i++) {
    const date = masjidDate(i);
    const day = await dayOf(request, date);
    expect(day.prayers.map((p) => p.key)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
    for (const p of day.prayers) {
      expect(p.adhan).toMatch(/^\d{2}:\d{2}$/);
      expect(p.iqamah >= p.adhan).toBe(true); // Iqamah never before Adhan
    }
    const friday = new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
    expect(day.jumuah.length > 0).toBe(friday);
  }
  expect((await request.get("/api/prayer-times?date=not-a-date")).status()).toBe(400);
});

test("the monthly timetable PDF downloads", async ({ request }) => {
  const res = await request.get(`/api/prayer-times/pdf?month=${masjidDate(0).slice(0, 7)}`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("a prayer manager overrides one day's Isha; the site uses it; clearing restores the calculated time", async ({ browser, request }) => {
  const date = masjidDate(300); // far ahead, so real overrides are never touched
  await sql(`DELETE FROM "PrayerDayOverride" WHERE date = $1::date AND note = 'E2E override'`, [date]);
  const before = await dayOf(request, date);
  const isha = before.prayers.find((p) => p.key === "isha")!;

  const context = await browser.newContext({ storageState: roleState("prayer") });
  const page = await context.newPage();
  await page.goto(`/admin/prayer-times?month=${date.slice(0, 7)}&date=${date}#editor`);
  const editor = page.getByRole("region", { name: /^Override / });
  await editor.getByLabel("Isha Iqamah").fill("21:45");
  await editor.getByLabel(/note/i).fill("E2E override");
  await editor.getByRole("button", { name: "Save override" }).click();
  await expect(page.getByText("Saved. The site now uses these times for this day.")).toBeVisible();

  const after = await dayOf(request, date);
  expect(after.prayers.find((p) => p.key === "isha")!.iqamah).toBe("21:45");
  expect(after.prayers.find((p) => p.key === "isha")!.adhan).toBe(isha.adhan); // only what was changed

  page.once("dialog", (d) => d.accept());
  await editor.getByRole("button", { name: "Clear override (use calculated times)" }).click();
  await expect(page.getByText("Cleared. This day uses the calculated times again.")).toBeVisible();
  expect((await dayOf(request, date)).prayers.find((p) => p.key === "isha")!.iqamah).toBe(isha.iqamah);
  await context.close();
});

test("the Prayer Times page shows the same times as the API (Hanafi Asr)", async ({ page, request }) => {
  const today = await dayOf(request, masjidDate(0));
  await page.goto("/prayer-times");
  const fajr = today.prayers[0].adhan;
  const [h, m] = fajr.split(":").map(Number);
  await expect(page.locator("main")).toContainText(`${h % 12 || 12}:${String(m).padStart(2, "0")}`);
  await expect(page.getByText(/Asr: Hanafi method/).first()).toBeVisible();
});
