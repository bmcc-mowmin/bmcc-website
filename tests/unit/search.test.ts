import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, normalize, queryTerms } from "../../src/lib/search/normalize";

test("case and accents don't matter", () => {
  assert.ok(matches("Consejería de salud mental", queryTerms("CONSEJERIA")));
  assert.ok(matches("Café Halal", queryTerms("cafe")));
});

test("Arabic-keyboard letters match Persian/Urdu letters, and digits match", () => {
  assert.equal(normalize("برنامه‌های پیش رو"), normalize("برنامه‌هاي پيش رو"));
  assert.ok(matches("کمک‌های ماهانه", queryTerms("كمك")));
  assert.ok(matches("سال ۲۰۲۶", queryTerms("2026")));
  assert.ok(matches("مُسْلِم", queryTerms("مسلم"))); // short vowels ignored
});

test("words match from their start; every word must be found", () => {
  assert.ok(matches("Prayer Times", queryTerms("pray")));
  assert.ok(!matches("Prayer Times", queryTerms("ray")));
  assert.ok(matches("Weekend Islamic Studies", queryTerms("islamic weekend")));
  assert.ok(!matches("Weekend Islamic Studies", queryTerms("islamic dinner")));
  assert.ok(!matches("anything", queryTerms("   ")));
});
