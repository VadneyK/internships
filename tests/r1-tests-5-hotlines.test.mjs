// Run with: node --test tests/r1-tests-5-hotlines.test.mjs
// Checks the hotline data in data/safety.json: phone format, display text,
// unique names, https links, and the checked date.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const safety = JSON.parse(readFileSync(join(root, "data", "safety.json"), "utf8"));
const meta = JSON.parse(readFileSync(join(root, "data", "meta.json"), "utf8"));
const hotlines = safety.hotlines;

// Groups the safety page shows (assets/js/safety.js groups by h.group).
const GROUPS = new Set(["National", "California", "Georgia", "New York", "Illinois"]);

// Short codes (for example 988 or 911) are not used in the data today.
// Add an entry here only with a reason and a source.
const SHORT_CODES = new Set();

// Keypad letters, as on a phone (2 = ABC ... 9 = WXYZ).
const KEYPAD = {};
[["ABC", 2], ["DEF", 3], ["GHI", 4], ["JKL", 5], ["MNO", 6], ["PQRS", 7], ["TUV", 8], ["WXYZ", 9]]
  .forEach(([letters, digit]) => { for (const ch of letters) KEYPAD[ch] = String(digit); });

function keypadDigits(text) {
  return text.toUpperCase().replace(/[A-Z]/g, (ch) => KEYPAD[ch] || "").replace(/\D/g, "");
}

// The display text can hold a vanity form, such as "1-833-LCO-INFO" or "1-800-321-OSHA".
// A number matches when either the whole display, or the display with any
// parenthesized part removed, ends in the same 10 digits as tel.
function displayMatchesTel(display, tel) {
  const want = tel.replace(/\D/g, "").slice(-10);
  const withoutParens = display.replace(/\([^)]*\)/g, " ");
  return [display, withoutParens].some((text) => {
    const digits = keypadDigits(text);
    return digits.length >= 10 && digits.slice(-10) === want;
  });
}

function isRealIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

test("every hotline has a name, group, url and covers text", () => {
  assert.ok(Array.isArray(hotlines) && hotlines.length > 0, "hotlines must be a non-empty list");
  for (const h of hotlines) {
    assert.ok(typeof h.name === "string" && h.name.trim() !== "", `name missing: ${JSON.stringify(h)}`);
    assert.ok(GROUPS.has(h.group), `${h.name}: group "${h.group}" is not one of ${[...GROUPS].join(", ")}`);
    assert.ok(typeof h.covers === "string" && h.covers.trim() !== "", `${h.name}: covers must be a non-empty string`);
    assert.ok(Array.isArray(h.numbers) && h.numbers.length > 0, `${h.name}: needs at least one number`);
  }
});

test("hotline names are unique", () => {
  const seen = new Map();
  for (const h of hotlines) {
    assert.ok(!seen.has(h.name), `duplicate hotline name: "${h.name}"`);
    seen.set(h.name, true);
  }
});

test("every hotline url is https with a real page path, not a bare home page", () => {
  for (const h of hotlines) {
    assert.ok(typeof h.url === "string" && h.url.startsWith("https://"), `${h.name}: url must start with https:// (got ${h.url})`);
    const url = new URL(h.url);
    assert.ok(url.hostname.includes("."), `${h.name}: url has no real host`);
    assert.ok(url.pathname !== "/" && url.pathname !== "", `${h.name}: url is a bare home page, use the deeper page that has the number`);
  }
});

test("every number has a valid E.164 tel (+1 and 10 digits) or an allowed short code", () => {
  for (const h of hotlines) {
    for (const n of h.numbers) {
      const ok = /^\+1\d{10}$/.test(n.tel) || SHORT_CODES.has(n.tel);
      assert.ok(ok, `${h.name}: tel "${n.tel}" for "${n.display}" is not +1 followed by 10 digits`);
    }
  }
});

test("every number's display text shows the same digits as its tel", () => {
  for (const h of hotlines) {
    for (const n of h.numbers) {
      if (SHORT_CODES.has(n.tel)) continue;
      assert.ok(
        displayMatchesTel(n.display, n.tel),
        `${h.name}: display "${n.display}" does not match tel "${n.tel}"`
      );
    }
  }
});

test("safety.json checked is a real date and not after meta.json checked", () => {
  assert.ok(isRealIsoDate(safety.checked), `safety.checked "${safety.checked}" is not a real YYYY-MM-DD date`);
  assert.ok(isRealIsoDate(meta.checked), `meta.checked "${meta.checked}" is not a real YYYY-MM-DD date`);
  assert.ok(
    safety.checked <= meta.checked,
    `safety.checked ${safety.checked} is after meta.checked ${meta.checked}`
  );
});
