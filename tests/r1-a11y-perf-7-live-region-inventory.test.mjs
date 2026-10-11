// Ticket r1-a11y-perf-7: every status and live region starts empty and has one owner.
// Loads every built root page in jsdom with its real scripts and checks each aria-live, role=status or role=alert
// element (the #toast region in the shared layout is left out). Run with:
// node --test tests/r1-a11y-perf-7-live-region-inventory.test.mjs
// Adding or removing a region means editing EXPECTED below on purpose.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = '[aria-live], [role="status"], [role="alert"]';
const CONTROL_OR_LINK = "a[href], button, input, select, textarea, [contenteditable]";

// The full inventory, page by page, in document order. Role is the role attribute, or aria-live=<value> when there is none.
// playbook.html: the plan summary region is #planLive.
const EXPECTED = {
  "calendar.html": [{ id: "cCount", role: "aria-live=polite" }],
  "find.html": [{ id: "count", role: "aria-live=polite" }, { id: "townHelp", role: "status" }],
  "index.html": [
    { id: "matchStatus", role: "status" },
    { id: "soonStatus", role: "status" },
  ],
  "interview.html": [
    { id: "aStatus", role: "status" },
    { id: "tStatus", role: "status" },
    { id: "tBlankNote", role: "status" },
  ],
  "jobs.html": [{ id: "jStatus", role: "status" }],
  "languages.html": [{ id: "lCount", role: "aria-live=polite" }],
  "leaders.html": [{ id: "refStatus", role: "status" }],
  "parents.html": [{ id: "pStatus", role: "status" }],
  "paycheck.html": [
    { id: "mStatus", role: "status" },
    { id: "mWrongStatus", role: "status" },
  ],
  "permit.html": [
    { id: "pStatus", role: "status" },
    { id: "mStatus", role: "status" },
    { id: "mBlankNote", role: "status" },
  ],
  "playbook.html": [
    { id: "planLive", role: "aria-live=polite" },
    { id: "letterStatus", role: "status" },
    { id: "blankNote", role: "status" },
  ],
  "ready.html": [
    { id: "readyStatus", role: "status" },
    { id: "distStatus", role: "status" },
    { id: "rideStatus", role: "status" },
  ],
  "resume.html": [
    { id: "rStatus", role: "status" },
    { id: "rExample", role: "status" },
  ],
  "safety.html": [
    { id: "sStatus", role: "status" },
    { id: "sCallStatus", role: "status" },
  ],
  "states.html": [{ id: "moreStatus", role: "status" }],
  "younger.html": [{ id: "yStatus", role: "status" }],
};

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
let regions = []; // { page, el, id, role, text, ancestorLive, controls }

function roleOf(el) {
  return el.getAttribute("role") || "aria-live=" + el.getAttribute("aria-live");
}

// Loads every root page once and records each live region.
before(async () => {
  for (const page of pages) {
    const { document } = await loadPage(page);
    await tick(200); // let data fetches finish
    for (const el of document.querySelectorAll(LIVE)) {
      if (el.id === "toast") continue;
      const parent = el.parentElement && el.parentElement.closest(LIVE);
      regions.push({
        page,
        el,
        id: el.id,
        role: roleOf(el),
        text: el.textContent.replace(/\s+/g, " ").trim(),
        ancestorLive: parent ? parent.id || parent.tagName.toLowerCase() : "",
        controls: [...el.querySelectorAll(CONTROL_OR_LINK)].map((k) => k.tagName.toLowerCase() + (k.id ? "#" + k.id : "")),
      });
    }
  }
});

function inventory() {
  const out = {};
  for (const r of regions) {
    (out[r.page] = out[r.page] || []).push({ id: r.id, role: r.role });
  }
  return out;
}

test("the live region inventory matches the expected list (page, id, role)", () => {
  assert.deepEqual(inventory(), EXPECTED);
});

test("every live region has an id", () => {
  const missing = regions.filter((r) => !r.id).map((r) => `${r.page} (${r.role})`);
  assert.deepEqual(missing, [], "live regions without an id");
});

test("no live region sits inside another live region", () => {
  const nested = regions.filter((r) => r.ancestorLive).map((r) => `${r.page} #${r.id} inside ${r.ancestorLive}`);
  assert.deepEqual(nested, []);
});

test("no live region contains a form control or a link", () => {
  const bad = regions.filter((r) => r.controls.length).map((r) => `${r.page} #${r.id}: ${r.controls.join(", ")}`);
  assert.deepEqual(bad, []);
});

test("every live region has under 200 characters of text after load", () => {
  const long = regions.filter((r) => r.text.length >= 200).map((r) => `${r.page} #${r.id} (${r.text.length} chars)`);
  assert.deepEqual(long, []);
});

test("find.html #count starts as the Loading line and nothing else", () => {
  // Read the built markup without running scripts, so the first text the region holds is checked.
  const html = fs.readFileSync(path.join(ROOT, "find.html"), "utf8");
  const dom = new JSDOM(html);
  const count = dom.window.document.getElementById("count");
  assert.ok(count, "no #count in find.html");
  assert.equal(count.children.length, 0, "#count has child elements");
  assert.equal(count.textContent.trim(), "Loading programs…", "#count is not only the Loading line");
  dom.window.close();
});
