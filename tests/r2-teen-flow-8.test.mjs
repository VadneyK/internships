// Ticket r2-teen-flow-8: repeated links on Find cards, the Calendar and Get ready say what they open.
// Each link's accessible name (aria-label) starts with its visible text and names its program, so a
// screen reader or voice-control user can tell "Apply" or "See how" links apart.
// Run with: node --test tests/r2-teen-flow-8.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAL = JSON.parse(fs.readFileSync(path.join(ROOT, "data/calendar.json"), "utf8"));
const LITE = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries-lite.json"), "utf8")).map((e) => [e.id, e]));
const LITE_IDS = new Set(LITE.keys());

// Accessible name for a link or button, as a screen reader would read it (aria-label first, then text).
function nameOf(el) {
  return (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
}

function visibleOf(el) {
  return (el.textContent || "").replace(/\s+/g, " ").trim();
}

function assertUnique(names, where) {
  const seen = new Map();
  for (const n of names) seen.set(n, (seen.get(n) || 0) + 1);
  const dups = [...seen].filter(([, c]) => c > 1).map(([n]) => n);
  assert.deepEqual(dups, [], `${where}: duplicate accessible names`);
}

// Apply links and Add deadline buttons inside one Find card.
function controlsOf(card) {
  return [...card.querySelectorAll("a, button")].filter((el) => visibleOf(el) === "Apply" || el.hasAttribute("data-cal"));
}

test("find.html: the first 10 cards with an Apply or Add deadline control have unique names that include the program", async () => {
  const { document } = await loadPage("find.html");
  await tick(200);
  const withControls = [...document.querySelectorAll("article.prog")]
    .map((card) => ({ card, controls: controlsOf(card) }))
    .filter((x) => x.controls.length > 0)
    .slice(0, 10);
  assert.equal(withControls.length, 10, `expected 10 cards with an Apply or Add deadline control, got ${withControls.length}`);

  const names = [];
  for (const { card, controls } of withControls) {
    const program = card.querySelector("h3").textContent.trim();
    for (const c of controls) {
      const name = nameOf(c);
      names.push(name);
      assert.ok(name.startsWith(visibleOf(c)), `"${name}" does not start with the visible text "${visibleOf(c)}"`);
      assert.ok(name.includes(program), `"${name}" does not name "${program}"`);
    }
  }
  assertUnique(names, "find.html first 10 Apply and Add deadline controls");
});

test("find.html: Apply and Add deadline names use the 'Apply to <name>, <org>' and 'Add deadline to calendar for <name>' pattern", async () => {
  const { document } = await loadPage("find.html");
  await tick(200);
  const applyLinks = [...document.querySelectorAll("article.prog a.btn")].filter((a) => visibleOf(a) === "Apply");
  assert.ok(applyLinks.length > 0, "expected at least one Apply link");
  for (const a of applyLinks) {
    const e = LITE.get(a.closest("article.prog").id.replace(/^p-/, ""));
    assert.ok(e, "Apply link card should map to an entry");
    assert.equal(nameOf(a).replace(/, opens in a new tab$/i, ""), "Apply to " + e.name + (e.org ? ", " + e.org : ""));
    assert.equal(visibleOf(a), "Apply", "visible text should not change");
  }
  const addButtons = [...document.querySelectorAll("article.prog button[data-cal]")];
  assert.ok(addButtons.length > 0, "expected at least one Add deadline button");
  for (const b of addButtons) {
    const e = LITE.get(b.getAttribute("data-cal"));
    assert.ok(e, "Add deadline button should map to an entry");
    assert.equal(nameOf(b), "Add deadline to calendar for " + e.name);
    assert.equal(visibleOf(b), "Add deadline to calendar", "visible text should not change");
  }
});

test("find.html?view=dates: the first 10 See card names are unique and name their program", async () => {
  const { document } = await loadPage("find.html", { search: "?view=dates" });
  await tick(200);
  const links = [...document.querySelectorAll("#dates [data-jump]")].slice(0, 10);
  assert.equal(links.length, 10, `expected 10 See card links, got ${links.length}`);
  const names = links.map(nameOf);
  for (const a of links) {
    const program = a.closest("li").querySelector("b").textContent.trim();
    assert.equal(visibleOf(a), "See card", "visible text should not change");
    assert.ok(nameOf(a).startsWith("See card for "), `"${nameOf(a)}" should start with "See card for "`);
    assert.ok(nameOf(a).includes(program), `"${nameOf(a)}" does not name "${program}"`);
  }
  assertUnique(names, "find.html?view=dates first 10 See card links");
});

test("calendar.html: the month with the most items has no duplicate link names", async () => {
  // Count each month's items from data/calendar.json, the same way the page decides which months a card sits in.
  const inWindow = (it, m) => {
    if (it.opens && it.closes) return it.opens <= it.closes ? m >= it.opens && m <= it.closes : m >= it.opens || m <= it.closes;
    return m === (it.opens || it.closes);
  };
  const itemsIn = (m) => CAL.items.filter((it) => LITE_IDS.has(it.id) && inWindow(it, m));
  let best = 1;
  for (let m = 2; m <= 12; m++) if (itemsIn(m).length > itemsIn(best).length) best = m;
  const expected = itemsIn(best).length;
  assert.ok(expected > 1, `the busiest month (${best}) should have more than one item for this check`);

  const { document, errors } = await loadPage("calendar.html", { search: "?m=" + best });
  await tick(200);
  assert.deepEqual(errors, []);
  const cards = [...document.querySelectorAll("#cClose li.card, #cOpen li.card")];
  assert.equal(cards.length, expected, `month ${best}: page shows ${cards.length} cards, calendar.json says ${expected}`);

  const links = [...document.querySelectorAll("#cClose li.card a, #cOpen li.card a")];
  const names = links.map(nameOf);
  assert.ok(names.length >= expected, "expected at least one link per card");
  for (const a of links) {
    const program = a.closest("li.card").querySelector("h3").textContent.trim();
    assert.ok(nameOf(a).includes(program), `"${nameOf(a)}" does not name "${program}"`);
  }
  assertUnique(names, `calendar.html?m=${best} links`);
});

test("ready.html: the 8 See how links have 8 unique names that include their checklist item", async () => {
  const { document } = await loadPage("ready.html");
  const links = [...document.querySelectorAll("#readyList a")];
  assert.equal(links.length, 8, `expected 8 See how links, got ${links.length}`);
  const names = links.map(nameOf);
  for (const a of links) {
    assert.equal(visibleOf(a), "See how", "visible text should not change");
    const item = a.closest("li").querySelector("label span").textContent.replace(/\s+/g, " ").trim();
    assert.equal(nameOf(a), "See how: " + item);
  }
  assertUnique(names, "ready.html See how links");
});
