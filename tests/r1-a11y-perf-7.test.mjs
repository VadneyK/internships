// Ticket r1-a11y-perf-7: the home picker announces a short summary in its own live region,
// and the repeated card links ("Official page", "Details") get names that say which program they open.
// Run with: node --test tests/r1-a11y-perf-7.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

// Accessible name for a link or button, as a screen reader would read it (aria-label first, then text).
function nameOf(el) {
  return (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
}

function assertUnique(names, where) {
  const seen = new Map();
  for (const n of names) seen.set(n, (seen.get(n) || 0) + 1);
  const dups = [...seen].filter(([, c]) => c > 1).map(([n]) => n);
  assert.deepEqual(dups, [], `${where}: duplicate accessible names`);
}

test("index.html: #matches is not a live region, and a separate role=status region exists", async () => {
  const { document } = await loadPage("index.html");
  const box = document.getElementById("matches");
  assert.equal(box.hasAttribute("aria-live"), false, "#matches still has aria-live");
  const status = document.getElementById("matchStatus");
  assert.ok(status, "no #matchStatus element");
  assert.equal(status.getAttribute("role"), "status");
  assert.ok(status.classList.contains("sr"), "status should be visually hidden with class sr");
});

test("index.html: the summary is empty when nothing is picked, and updates on each change", async () => {
  const { window, document } = await loadPage("index.html");
  await tick();
  const status = document.getElementById("matchStatus");
  assert.equal(status.textContent.trim(), "", "summary should be empty before any choice");

  type(window, document.getElementById("pAge"), "16");
  await tick();
  const more = document.getElementById("matchMore").textContent.match(/See all (\d+) matches/);
  assert.ok(more, "expected the See all count");
  const total = Number(more[1]);
  const first = status.textContent.trim();
  assert.ok(total > 1, "age 16 should have more than one match for this check");
  assert.ok(first.startsWith(total + " programs match."), `summary was "${first}", expected it to start with "${total} programs match."`);
  if (total > 4) assert.ok(first.endsWith("Showing the top 4 below."), `summary was "${first}"`);
  else assert.ok(first.endsWith("Details below."), `summary was "${first}"`);

  const hubOption = [...document.querySelectorAll("#pHub option")].find((o) => o.value);
  assert.ok(hubOption, "no place option to pick");
  type(window, document.getElementById("pHub"), hubOption.value);
  await tick();
  const afterPlace = status.textContent.trim();
  const morePlace = document.getElementById("matchMore").textContent.match(/See all (\d+) matches/);
  assert.ok(morePlace, "expected the See all count after choosing a place");
  assert.ok(afterPlace.startsWith(Number(morePlace[1]) + " program") || afterPlace.startsWith("No programs match yet."), `summary was "${afterPlace}"`);

  type(window, document.getElementById("pField"), "health");
  await tick();
  const second = status.textContent.trim();
  const more2 = document.getElementById("matchMore").textContent.match(/See all (\d+) matches/);
  assert.ok(more2, "expected the See all count after a second choice");
  if (Number(more2[1]) === 0) {
    assert.equal(second, "No programs match yet. Try a different area or interest.");
  } else {
    assert.ok(second.startsWith(Number(more2[1]) + " programs match.") || second.startsWith("1 program matches."), `summary was "${second}"`);
  }

  for (const id of ["pAge", "pHub", "pField"]) type(window, document.getElementById(id), "");
  await tick();
  assert.equal(status.textContent.trim(), "", "summary should clear when nothing is picked");
});

test("index.html: every link in the picker has a name with its program, and no two names match", async () => {
  const { window, document } = await loadPage("index.html");
  type(window, document.getElementById("pAge"), "16");
  for (let i = 0; i < 100 && document.querySelectorAll("#matches article.prog").length < 2; i++) await tick(50); // the data may still be loading on a slow machine
  const cards = [...document.querySelectorAll("#matches article.prog")];
  assert.ok(cards.length >= 2, `expected at least 2 picker cards, got ${cards.length}`);
  const buttons = [...document.querySelectorAll("#matches a.btn")];
  assert.ok(buttons.length >= cards.length, "expected at least one link per card");
  const names = buttons.map(nameOf);
  assertUnique(names, "index.html picker");
  for (const card of cards) {
    const program = card.querySelector("h3").textContent.trim();
    const links = [...card.querySelectorAll("a.btn")];
    for (const a of links) {
      assert.ok(nameOf(a).includes(program), `link "${nameOf(a)}" does not name "${program}"`);
    }
  }
});

test("find.html: the first 10 cards have unique Official page and Details link names that name their program", async () => {
  const { document } = await loadPage("find.html");
  await tick(200);
  const cards = [...document.querySelectorAll("article.prog")].slice(0, 10);
  assert.ok(cards.length === 10, `expected 10 cards, got ${cards.length}`);
  const links = [];
  for (const card of cards) {
    const program = card.querySelector("h3").textContent.trim();
    for (const a of card.querySelectorAll("a.btn")) {
      const label = a.textContent.trim();
      if (label !== "Official page" && label !== "Details") continue;
      links.push(nameOf(a));
      assert.ok(nameOf(a).includes(program), `"${nameOf(a)}" does not name "${program}"`);
    }
  }
  assert.ok(links.filter((n) => n.startsWith("Official page")).length >= 2, "expected at least 2 Official page links to check");
  assertUnique(links, "find.html first 10 cards");
});
