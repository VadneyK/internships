// .well-known/security.txt (RFC 9116) exists, names a contact and a future expiry, and the dot folder is served.
// Run with: node --test tests/r3-tests-9-security-txt.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = existsSync(join(ROOT, ".well-known/security.txt")) ? readFileSync(join(ROOT, ".well-known/security.txt"), "utf8") : "";
const field = (name) => text.split(/\r?\n/).filter((l) => l.startsWith(name + ":")).map((l) => l.slice(name.length + 1).trim());

test("security.txt exists", () => {
  assert.ok(text.length > 0, ".well-known/security.txt is missing or empty");
});

test("security.txt has a Contact that is an https URL", () => {
  const c = field("Contact");
  assert.ok(c.length >= 1, "no Contact field");
  for (const v of c) assert.ok(/^(https:\/\/|mailto:)/.test(v), `Contact must be https or mailto: ${v}`);
});

test("security.txt has exactly one Expires that is ISO 8601 UTC and in the future", () => {
  const e = field("Expires");
  assert.equal(e.length, 1, "need exactly one Expires field");
  assert.match(e[0], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "Expires must be ISO 8601 UTC");
  assert.ok(Date.parse(e[0]) > Date.now(), `Expires ${e[0]} is in the past; renew security.txt`);
  assert.ok(Date.parse(e[0]) - Date.now() < 366 * 86400000, `Expires ${e[0]} is 366 or more days ahead; RFC 9116 wants under a year`);
});

test("security.txt names a language and the policy", () => {
  assert.deepEqual(field("Preferred-Languages"), ["en"]);
  const p = field("Policy");
  assert.equal(p.length, 1);
  assert.match(p[0], /^https:\/\/github\.com\/VadneyK\/internships\/blob\/main\/SECURITY\.md$/);
});

test("security.txt declares the Canonical project-site URL where it is actually served", () => {
  assert.deepEqual(field("Canonical"), ["https://vadneyk.github.io/internships/.well-known/security.txt"]);
});

test(".nojekyll exists so GitHub Pages serves the dot folder", () => {
  assert.ok(existsSync(join(ROOT, ".nojekyll")));
});
