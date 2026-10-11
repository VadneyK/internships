// Ticket r2-a11y-perf-7: every page's live regions announce after load and are not announced twice.
// Loads every built root page in jsdom with its real scripts, waits for the data, and checks:
//   - no element is both a live region and a nested child of another live region (a screen reader reads it twice);
//   - regions that start empty stay empty with no user action;
//   - on find, jobs, calendar and languages, changing one filter changes exactly one live region's text,
//     and the new text is non-empty and not the same as any other live region's text.
// Run with: node --test tests/r2-a11y-perf-7-live-region-no-double.test.mjs
import test, { before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, type } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = '[aria-live], [role="status"], [role="alert"]';
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// The one filter to change on each page (the select's id). Its first other non-empty option is picked at run time.
const FILTERS = {
  "find.html": "age",
  "jobs.html": "jAge",
  "calendar.html": "cAge",
  "languages.html": "lLang",
};

const norm = (s) => s.replace(/\s+/g, " ").trim();

function regionsOf(document) {
  return [...document.querySelectorAll(LIVE)].map((el) => ({
    el,
    label: (el.id || el.tagName.toLowerCase()),
    text: norm(el.textContent),
  }));
}

function nestedIn(el) {
  const parent = el.parentElement && el.parentElement.closest(LIVE);
  return parent || null;
}

function pickOther(select) {
  const opt = [...select.options].find((o) => o.value && o.value !== select.value);
  assert.ok(opt, `no other option to pick in #${select.id}`);
  return opt.value;
}

// Load each page once and keep the window so the tests below can read it.
const loaded = new Map();
before(async () => {
  for (const page of pages) {
    const { window, document, errors } = await loadPage(page);
    await tick(200); // let data fetches finish
    loaded.set(page, { window, document, errors });
  }
});

test("no live region is nested inside another live region (nothing is read twice)", () => {
  const bad = [];
  for (const [page, { document }] of loaded) {
    for (const r of regionsOf(document)) {
      const parent = nestedIn(r.el);
      if (parent) bad.push(`${page} #${r.label} inside ${parent.id || parent.tagName.toLowerCase()}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("regions that start empty stay empty until the first user action", async () => {
  const drift = [];
  for (const [page, { document }] of loaded) {
    const before = regionsOf(document);
    const emptyAtStart = before.filter((r) => r.text === "").map((r) => r.el);
    await tick(150);
    for (const el of emptyAtStart) {
      if (norm(el.textContent) !== "") drift.push(`${page} #${el.id || el.tagName.toLowerCase()} filled with no user action`);
    }
  }
  assert.deepEqual(drift, []);
});

for (const [page, selectId] of Object.entries(FILTERS)) {
  test(`${page}: changing ${selectId} changes exactly one live region, with new text not shared by another region`, async () => {
    const { window, document } = loaded.get(page);
    const select = document.getElementById(selectId);
    assert.ok(select, `no #${selectId} on ${page}`);

    const beforeRegions = regionsOf(document);
    const beforeText = new Map(beforeRegions.map((r) => [r.el, r.text]));

    type(window, select, pickOther(select));
    await tick(120);

    const after = regionsOf(document);
    const changed = after.filter((r) => beforeText.get(r.el) !== r.text);
    assert.equal(
      changed.length,
      1,
      `${page}: expected exactly one live region to change, got ${changed.map((r) => "#" + r.label).join(", ") || "none"}`,
    );

    const hit = changed[0];
    assert.ok(hit.text.length > 0, `${page} #${hit.label} changed to empty text`);
    const sameElsewhere = after.filter((r) => r.el !== hit.el && r.text === hit.text).map((r) => "#" + r.label);
    assert.deepEqual(sameElsewhere, [], `${page} #${hit.label} text is also in ${sameElsewhere.join(", ")}`);
  });
}
