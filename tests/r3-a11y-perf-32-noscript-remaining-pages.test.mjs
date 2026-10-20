import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// Ticket r3-a11y-perf-3. The eight script-built pages left over from r3-a11y-perf-4 also say so when JavaScript is off.
// Pages are parsed without running scripts, so the noscript body is what a script-blocked teen sees.

const PAGES = ["index", "jobs", "ready", "interview", "states", "resume", "playbook", "leaders", "map", "ignition"];
const EARLIER = ["safety", "parents", "younger", "languages", "permit", "calendar", "insights", "paycheck"];
const OTHER_NOTE = ["find"]; // find.html already has its own noscript with a link to the spreadsheet file
const ROOT = new URL("../", import.meta.url);
const DASHES = /[\u2013\u2014]/;

for (const name of PAGES) {
  test(`noscript callout in ${name}.html: inside main, plain words, short, static links`, () => {
    const doc = new JSDOM(fs.readFileSync(new URL(`${name}.html`, ROOT), "utf8")).window.document;
    const main = doc.querySelector("main");
    assert.ok(main, "page has a main element");
    const notes = [...main.querySelectorAll("noscript")];
    assert.equal(notes.length, 1, "exactly one noscript inside main");
    const note = notes[0];
    assert.ok(note.querySelector(".callout"), "noscript holds a callout");
    const text = note.textContent.replace(/\s+/g, " ").trim();
    assert.match(text, /needs JavaScript/i);
    assert.ok(!DASHES.test(text), "no en or em dash");
    const words = text.split(" ").filter(Boolean).length;
    assert.ok(words < 60, `under 60 words (got ${words})`);
    const hrefs = [...note.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    assert.ok(hrefs.length >= 1, "at least one link");
    for (const href of hrefs) {
      assert.match(href, /^[a-z0-9-]+\.html$/, `link ${href} is a plain local page`);
      assert.ok(fs.existsSync(new URL(href, ROOT)), `link target ${href} exists`);
    }
  });
}

test("every built root page whose script builds content has a noscript note", () => {
  const known = new Set([...PAGES, ...EARLIER, ...OTHER_NOTE]);
  const missing = [];
  for (const src of fs.readdirSync(new URL("src/", ROOT)).filter((f) => f.endsWith(".html") && !f.startsWith("_"))) {
    const name = src.replace(/\.html$/, "");
    const head = fs.readFileSync(new URL(`src/${src}`, ROOT), "utf8").split(/\n---\n/)[0];
    const m = head.match(/^scripts:\s*(.+)$/m);
    if (!m) continue;
    const builds = m[1].split(",").map((s) => s.trim()).filter(Boolean).some((s) => {
      const p = new URL(`assets/js/${s}.js`, ROOT);
      return fs.existsSync(p) && /G\.fetchData|loadEntries|innerHTML\s*\+?=(?!\s*(?:""|''))/.test(fs.readFileSync(p, "utf8"));
    });
    if (builds && !known.has(name)) missing.push(name);
  }
  assert.deepEqual(missing, [], "script-built pages need a noscript note and a place in this test's lists");
});
