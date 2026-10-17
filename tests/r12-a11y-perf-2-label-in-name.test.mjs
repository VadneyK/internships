// Quality sweep 2026-10-16 (issue #9 sweep, docs/research/quality-sweep-2026-10.md item A4). axe-core in headless Chrome flagged
// label-content-name-mismatch (WCAG 2.5.3, Label in Name) on the Programs area chips and the Calendar month chips: the visible
// words were "Silicon Valley86" and "Jan28" (no space before the count), and the month name was "January", so a voice control
// user who says "click Jan" or "click Silicon Valley 86" did not match. The chips now have a space before the count, and the month
// chip name starts with the month as shown ("Jan, 28 programs").
// The rule: the words a person sees must appear, in order and together, inside the accessible name (axe's own check).
// jsdom has no layout, so "seen" here is the text content of the element minus aria-hidden and .sr parts.
// Run with: node --test tests/r12-a11y-perf-2-label-in-name.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const ROOT = new URL("../", import.meta.url);
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);

function seenText(el) {
  let out = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.textContent;
    else if (n.nodeType === 1 && n.getAttribute("aria-hidden") !== "true" && !n.classList.contains("sr")) out += seenText(n);
  }
  return out;
}

function contained(seen, name) {
  const a = words(name), b = words(seen);
  if (!b.length) return true;
  for (let i = 0; i + b.length <= a.length; i++) if (b.every((w, j) => w === a[i + j])) return true;
  return false;
}

// Controls with an aria-label whose seen words are not inside it, as "tag.class text | name".
function mismatches(document) {
  return [...document.querySelectorAll("main a[aria-label], main button[aria-label], main [role=button][aria-label]")]
    .filter((el) => !el.closest("[hidden]") && !contained(seenText(el), el.getAttribute("aria-label")))
    .map((el) => el.tagName.toLowerCase() + "." + (el.className || "") + " " + seenText(el).trim() + " | " + el.getAttribute("aria-label"));
}

test("helper: the word check passes a name that holds the seen words in order and fails the old chips", () => {
  assert.equal(contained("Silicon Valley 86", "Silicon Valley 86 programs"), true);
  assert.equal(contained("Silicon Valley86", "Silicon Valley 86 programs"), false);
  assert.equal(contained("Jan28", "January, 28 programs"), false);
  assert.equal(contained("Jan 28", "Jan, 28 programs"), true);
  assert.equal(contained("Details", "Details for Teen Corps, City of Oakland"), true);
});

test("Programs: every area, pay, kind and goal chip name holds the words shown on the chip", async () => {
  const p = await loadPage("find.html");
  await waitFor(() => p.document.querySelector('.chip[data-key="hubs"][aria-label]'), { timeout: 30000 });
  const chips = [...p.document.querySelectorAll(".chip[data-key][aria-label]")];
  assert.ok(chips.length >= 10, "chips with counts drawn");
  for (const b of chips) {
    assert.ok(contained(seenText(b), b.getAttribute("aria-label")), seenText(b) + " | " + b.getAttribute("aria-label"));
    assert.match(b.innerHTML, / <span class="n">/, "a space before the count");
  }
});

test("Calendar: every month chip shows the short month and a count, and its name starts with the same words", async () => {
  const p = await loadPage("calendar.html");
  await waitFor(() => p.document.querySelector("#months .chip[aria-label]"), { timeout: 30000 });
  const chips = [...p.document.querySelectorAll("#months .chip")];
  assert.equal(chips.length, 12);
  chips.forEach((b, i) => {
    const name = b.getAttribute("aria-label"), seen = seenText(b);
    assert.match(seen, /^[A-Z][a-z]{2} \d+$/, "seen text is like 'Jan 28': " + seen);
    assert.ok(contained(seen, name), seen + " | " + name);
    assert.match(name, /^[A-Z][a-z]{2}, \d+ programs?$/, name);
    assert.equal(words(name)[0], words(seen)[0], "month " + (i + 1));
  });
  const built = fs.readFileSync(new URL("calendar.html", ROOT), "utf8");
  assert.match(built, /data-m="1" aria-pressed="false">Jan <span class="n">0<\/span>/, "the build-time chips have the space too, so the chip does not change width when data comes");
});

// Known mismatches, each with a reason. A row that stops firing fails, so the table stays true.
const KNOWN = {
  "insights.html": { re: /^a\.ccol /, why: "Numbers page age bars: the bar shows the count, the age and two split counts. Its name reads them as a sentence (Age 13: 1602 programs, 246 paid ...). The seen words are in another order, and the 'Age 13' part a person would say does match. Listed for a person to judge in docs/research/quality-sweep-2026-10.md item A5." },
};

const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();
for (const page of PAGES) {
  test(`${page}: no labelled link or button hides the words it shows from its name`, async () => {
    const p = await loadPage(page); await tick(400);
    const bad = mismatches(p.document);
    const k = KNOWN[page];
    const left = k ? bad.filter((x) => !k.re.test(x)) : bad;
    assert.deepEqual(left, [], page);
    if (k) assert.ok(bad.some((x) => k.re.test(x)), page + ": KNOWN row no longer fires, remove it");
  });
}
