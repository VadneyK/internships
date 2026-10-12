// Ticket r2-accuracy-3 (file r4-accuracy-3): every "$17.40" string in the site pages and data
// sits in a block that links the DIR news release 2026-66, the source of the 2027 rate.
// Run with: node --test tests/r4-accuracy-3-ca-2027-source.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const SOURCE = "https://dir.ca.gov/DIRNews/2026/2026-66.html";
const TITLE = "DIR news release on the 2027 rate";
const DASH = new RegExp("[\\u2013\\u2014]");

// Returns the HTML block (a p, li, article or section) around one index, or null if none.
function htmlBlock(html, idx) {
  const openers = ["<p ", "<p>", "<li", "<article", "<section"];
  let start = -1;
  for (const o of openers) start = Math.max(start, html.lastIndexOf(o, idx));
  const closers = ["</p>", "</li>", "</article>", "</section>"];
  let end = -1;
  for (const c of closers) {
    const at = html.indexOf(c, idx);
    if (at !== -1 && (end === -1 || at < end)) end = at;
  }
  if (start === -1 || end === -1) return null;
  return html.slice(start, end);
}

for (const f of ["src/rules.html", "rules.html"]) {
  test(`${f}: every $17.40 sits in a block with the 2026-66 link`, () => {
    const html = read(f);
    const hits = [...html.matchAll(/\$17\.40/g)].map((m) => m.index);
    assert.ok(hits.length >= 2, f + " should state $17.40 in the pay card and the pay lede");
    for (const idx of hits) {
      const block = htmlBlock(html, idx);
      assert.ok(block, `${f}: no block around $17.40 at index ${idx}`);
      assert.ok(block.includes(`href="${SOURCE}"`), `${f}: $17.40 block has no link to ${SOURCE}: ${block.slice(0, 120)}`);
      assert.ok(block.includes(TITLE), `${f}: $17.40 block does not use the title "${TITLE}"`);
    }
  });

  test(`${f}: the Issue 7 promise is replaced`, () => {
    const html = read(f);
    assert.ok(!html.includes("issues/7"), f + " still links issue 7");
    assert.ok(!html.includes("December 2026"), f + " still promises an update in December 2026");
    assert.ok(
      html.includes("City minimum wages for 2027 were not published yet on Oct 7, 2026, so check your city's website in the fall."),
      f + " is missing the replacement sentence",
    );
  });

  test(`${f}: no em or en dash`, () => {
    assert.ok(!DASH.test(read(f)), f + " contains a dash character");
  });
}

test("data/permits.json: every string with $17.40 sits in a state that links the 2026-66 release", () => {
  const raw = read("data/permits.json");
  const data = JSON.parse(raw);
  const states = data.states || data;
  const found = [];
  // Walk the tree, remembering the nearest ancestor object that has a links array.
  const walk = (node, nearestWithLinks, path) => {
    if (typeof node === "string") {
      if (node.includes("$17.40")) found.push({ path, owner: nearestWithLinks });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, nearestWithLinks, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      const here = Array.isArray(node.links) ? node : nearestWithLinks;
      for (const [k, v] of Object.entries(node)) walk(v, here, `${path}.${k}`);
    }
  };
  walk(states, null, "states");
  assert.ok(found.length >= 1, "no $17.40 string found in permits.json");
  for (const { path, owner } of found) {
    assert.ok(owner, `${path} has no ancestor with links`);
    const ok = owner.links.some((l) => l.u === SOURCE && l.t === TITLE);
    assert.ok(ok, `${path} is not in a block that links ${SOURCE} as "${TITLE}"`);
  }
  assert.ok(!DASH.test(raw), "data/permits.json contains a dash character");
});
