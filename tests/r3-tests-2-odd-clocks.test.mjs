// r3-tests-2: every built root page loads clean under odd clock dates (year end, new year, leap day, mid summer, past every deadline).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, badResponses, tick } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const CLOCKS = [
  { label: "2026-12-31T23:59", at: new Date(2026, 11, 31, 23, 59), month: 12 },
  { label: "2027-01-01", at: new Date(2027, 0, 1, 0, 0), month: 1 },
  { label: "2028-02-29", at: new Date(2028, 1, 29, 12, 0), month: 2 },
  { label: "2027-08-15", at: new Date(2027, 7, 15, 12, 0), month: 8 },
  { label: "2031-06-15", at: new Date(2031, 5, 15, 12, 0), month: 6 },
];
const FAR = CLOCKS[4];
const BAD_TEXT = /NaN|undefined|Invalid Date|\[object/;
const LONE_NULL = /(^|[^A-Za-z0-9_])null([^A-Za-z0-9_]|$)/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Text a person can see: no script, style or hidden parts.
function visibleText(document) {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, template, [hidden]").forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, " ");
}

test("page list covers the built root pages", () => {
  assert.ok(PAGES.length >= 20 && PAGES.includes("calendar.html"));
  assert.ok(PAGES.includes("index.html") && PAGES.includes("insights.html"));
});

for (const clock of CLOCKS) {
  test("odd clock " + clock.label + ": every page loads clean", { timeout: 110000 }, async () => {
    const problems = [];
    for (const file of PAGES) {
      badResponses.length = 0;
      const consoleMsgs = [];
      const p = await loadPage(file, {
        now: clock.at.getTime(),
        setup(w) { for (const k of ["error", "warn"]) w.console[k] = (...a) => consoleMsgs.push(k + ": " + a.join(" ")); },
      });
      try {
        await tick(120);
        const where = clock.label + " " + file;
        for (const e of p.errors) problems.push(where + " jsdom error: " + e);
        for (const m of consoleMsgs) problems.push(where + " console " + m);
        for (const b of badResponses) problems.push(where + " bad response " + b);
        const text = visibleText(p.document);
        const m = text.match(BAD_TEXT);
        if (m) problems.push(where + " shows " + m[0] + ": ..." + text.slice(Math.max(0, m.index - 40), m.index + 40));
        if (LONE_NULL.test(text)) problems.push(where + " shows a lone null");
        if (file === "calendar.html") {
          const chips = p.document.querySelectorAll('#months .chip[aria-pressed="true"]');
          if (chips.length !== 1 || +chips[0].getAttribute("data-m") !== clock.month) problems.push(where + " selected month chip is not month " + clock.month);
        }
      } finally { p.window.close(); }
    }
    assert.deepEqual(problems, []);
  });
}

test("far future (2031-06-15): Home and Numbers show no past deadline as upcoming and a sensible empty state", async () => {
  const problems = [];
  for (const file of ["index.html", "insights.html"]) {
    const p = await loadPage(file, { now: FAR.at.getTime() });
    try {
      await tick(150);
      const text = visibleText(p.document);
      if (file === "index.html") assert.match(text, /No confirmed deadlines in the next few weeks/, "Home shows an empty state for Closing soon");
      if (/(^|[^\d])-\d+\s*(days?|d)\b/i.test(text)) problems.push(file + " shows a negative day count");
      if (/\b(in|closes in)\s+-\d+/i.test(text)) problems.push(file + " shows a negative 'in' count");
      for (const el of p.document.querySelectorAll("li, tr, .card, article")) {
        if (el.children.length > 8) continue;
        const t = el.textContent.replace(/\s+/g, " ");
        const m = t.match(/closes?\s+(?:on\s+)?(?:[A-Z][a-z]+\.?\s+\d{1,2},?\s+)?(20\d\d)/i) || t.match(/closes?\s+[A-Z][a-z]+\s+\d{1,2},\s*(20\d\d)/);
        if (m && +m[1] < 2031 && /closes (in|on)\b/i.test(t) && !/closed|passed|ended|last/i.test(t)) problems.push(file + " row says closes for a past date: " + t.slice(0, 100));
      }
    } finally { p.window.close(); }
  }
  assert.deepEqual(problems, []);
});
