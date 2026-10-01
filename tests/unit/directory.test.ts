import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldErrors, listingSchema, mapLinks } from "../../src/lib/directory/listing";
import { csvToObjects, parseCsv, toCsv } from "../../src/lib/directory/csv";

const valid = {
  listingType: "BUSINESS",
  name: "Sample Grill",
  parentCategory: "Restaurant",
  category: "Halal Restaurant",
  description: "Fresh halal food every day.",
  author: "Owner",
};

test("listing input is normalized: phone formatted, website given https, tags split and de-duplicated", () => {
  const r = listingSchema.parse({ ...valid, phone: "925.555.0110", website: "example.com/menu", tags: "Halal, BBQ; halal ,BBQ", email: "" });
  assert.equal(r.phone, "(925) 555-0110");
  assert.equal(r.website, "https://example.com/menu");
  assert.deepEqual(r.tags, ["Halal", "BBQ", "halal"]);
  assert.equal(r.email, null);
  assert.equal(r.address, null);
});

test("bad phone, website, email and missing fields are reported per field", () => {
  const r = listingSchema.safeParse({ ...valid, name: "", phone: "12", website: "javascript:alert(1)", email: "nope" });
  assert.ok(!r.success);
  const errs = fieldErrors(r.error);
  assert.equal(errs.name, "form_error_required");
  assert.equal(errs.phone, "form_error_phone");
  assert.equal(errs.website, "form_error_url");
  assert.equal(errs.email, "form_error_email");
});

test("map links only when there is an address or city", () => {
  assert.equal(mapLinks({ name: "X", address: null, city: null, state: null, zip: null }), null);
  const m = mapLinks({ name: "Grill", address: "7701 Lone Tree Way", city: "Brentwood", state: "CA", zip: "94513" })!;
  assert.match(m.embed, /^https:\/\/maps\.google\.com\/maps\?q=Grill%2C%207701%20Lone%20Tree%20Way%2C%20Brentwood%2C%20CA%2094513&z=15&output=embed$/);
  assert.match(m.directions, /maps\/dir\/\?api=1&destination=/);
  assert.match(mapLinks({ name: "G", address: "1 St", city: null, state: null, zip: null }, "KEY")!.embed, /maps\/embed\/v1\/place\?key=KEY&q=/);
});

test("CSV: quotes, commas, newlines, BOM and header matching", () => {
  const text = '﻿Name,Main Category,Phone\r\n"Grill, The","Restaurant","(925) 555-0110"\n"Multi\nline ""quoted""",Other,\n\n';
  assert.deepEqual(parseCsv(text)[2], ['Multi\nline "quoted"', "Other", ""]);
  const rows = csvToObjects(text);
  assert.deepEqual(rows[0], { name: "Grill, The", maincategory: "Restaurant", phone: "(925) 555-0110" });
  assert.equal(rows.length, 2);
});

test("CSV export quotes fields and neutralizes spreadsheet formulas", () => {
  const csv = toCsv(["name", "note"], [["A, B", '=HYPERLINK("x")']]);
  assert.equal(csv, 'name,note\r\n"A, B","\'=HYPERLINK(""x"")"\r\n');
});
