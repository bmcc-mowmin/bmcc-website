import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../../src/lib/security/safe-path";
import { pickClientIp } from "../../src/lib/security/client-ip";

test("safeNext keeps same-site paths, with their query and hash", () => {
  assert.equal(safeNext("/account", "/x"), "/account");
  assert.equal(safeNext("/admin/events?tab=past#top", "/x"), "/admin/events?tab=past#top");
  assert.equal(safeNext("/donate/thank-you?checkout=abc123", "/x"), "/donate/thank-you?checkout=abc123");
});

test("safeNext refuses anything that leaves the site", () => {
  for (const bad of [
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example/",
    "evil.example",
    "javascript:alert(1)",
    "",
    undefined,
    null,
    42,
  ]) {
    assert.equal(safeNext(bad, "/fallback"), "/fallback", `should refuse ${JSON.stringify(bad)}`);
  }
});

const h = (map: Record<string, string>) => ({ get: (name: string) => map[name.toLowerCase()] ?? null });

test("client IP: a trusted single-address header wins over X-Forwarded-For", () => {
  const headers = h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 203.0.113.7, 104.22.17.40" });
  assert.equal(pickClientIp(headers, { header: "cf-connecting-ip", hops: 1 }), "203.0.113.7");
});

test("client IP: a spoofed first X-Forwarded-For entry is ignored", () => {
  // The visitor sent "X-Forwarded-For: 1.1.1.1"; our one proxy appended their real address.
  const headers = h({ "x-forwarded-for": "1.1.1.1, 198.51.100.9" });
  assert.equal(pickClientIp(headers, { hops: 1 }), "198.51.100.9");
  // Two trusted proxies (e.g. a CDN, then the host's load balancer).
  const two = h({ "x-forwarded-for": "1.1.1.1, 198.51.100.9, 104.22.17.40" });
  assert.equal(pickClientIp(two, { hops: 2 }), "198.51.100.9");
});

test("client IP: falls back when headers are missing", () => {
  assert.equal(pickClientIp(h({ "x-real-ip": "192.0.2.1" }), { hops: 1 }), "192.0.2.1");
  assert.equal(pickClientIp(h({}), { header: "cf-connecting-ip", hops: 1 }), "unknown");
  assert.equal(pickClientIp(h({ "x-forwarded-for": "192.0.2.5" }), { hops: 3 }), "192.0.2.5");
});
