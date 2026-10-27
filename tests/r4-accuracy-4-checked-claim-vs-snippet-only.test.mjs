// Run with: node --test tests/r4-accuracy-4-checked-claim-vs-snippet-only.test.mjs
// Ticket r4-accuracy-4: some cards were never read on the official site (verified "snippet-only").
// So the About heading and the handout rule must not say every program was checked, or that no card
// exists without an official page. Each snippet-only card must say "Confirm first" (or "confirm") in its
// notes or status, so a teen or parent is told which cards to check first.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const PAGES = ["src/about.html", "about.html", "src/handout.html", "handout.html"];
const BANNED = ["checked every program", "no official page, no card"];
const entries = JSON.parse(rd("data/entries.json"));
const snippetOnly = entries.filter((e) => e.verified === "snippet-only");

// 2026-10-27: Elk Grove was the last snippet-only card. The checks below re-arm when one comes back.
test("data has snippet-only cards to check the pages against", { skip: snippetOnly.length === 0 && "no snippet-only cards right now" }, () => {
  assert.ok(snippetOnly.length > 0, "no snippet-only entries; the banned-claim rule may be stale");
});

test("About and handout pages do not claim every program was checked", () => {
  if (snippetOnly.length === 0) return;
  for (const p of PAGES) {
    const text = rd(p).toLowerCase();
    for (const phrase of BANNED) {
      assert.ok(!text.includes(phrase), `${p} still says "${phrase}" but ${snippetOnly.length} cards are snippet-only`);
    }
  }
});

test("each snippet-only card says Confirm first or confirm in notes or status", () => {
  for (const e of snippetOnly) {
    const words = `${e.notes || ""} ${e.status || ""}`.toLowerCase();
    assert.ok(words.includes("confirm"), `${e.id} is snippet-only but its notes or status do not say confirm`);
  }
});

test("About heading and the Confirm first sentence are in the source and built page", () => {
  for (const p of ["src/about.html", "about.html"]) {
    const html = rd(p);
    assert.ok(html.includes("<h2>How we checked the programs</h2>"), `${p} is missing the new About heading`);
    assert.ok(
      html.includes("A few cards could not be read on the official site. They are marked Confirm first."),
      `${p} is missing the Confirm first sentence under "Mark what we could not confirm"`
    );
  }
});

test("handout rule names Confirm first for cards that could not be read", () => {
  for (const p of ["src/handout.html", "handout.html"]) {
    const html = rd(p);
    assert.ok(
      html.includes("every card links its official page, and cards we could not read there say Confirm first."),
      `${p} is missing the new handout rule`
    );
  }
});
