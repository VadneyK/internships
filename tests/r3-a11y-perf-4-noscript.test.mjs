import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// Ticket r3-a11y-perf-4. Script-built pages say so when JavaScript is off, with a plain link to a static page.
// Parses each built root page without running scripts, so the noscript body is what a script-blocked teen sees.

const PAGES = ["safety", "parents", "younger", "languages", "permit", "calendar", "insights", "paycheck"];
const ROOT = new URL("../", import.meta.url);
const DASHES = /[\u2013\u2014]/;

for (const name of PAGES) {
  test(`noscript callout in ${name}.html: inside main, plain words, short, static links`, () => {
    const html = fs.readFileSync(new URL(`${name}.html`, ROOT), "utf8");
    const dom = new JSDOM(html); // scripts are not run, so noscript children stay parsed as elements
    const doc = dom.window.document;
    const main = doc.querySelector("main");
    assert.ok(main, "page has a main element");

    const notes = [...main.querySelectorAll("noscript")];
    assert.equal(notes.length, 1, "exactly one noscript inside main");
    const note = notes[0];
    assert.ok(main.contains(note), "noscript sits inside main");
    assert.ok(note.querySelector(".callout"), "noscript holds a callout");

    const text = note.textContent.replace(/\s+/g, " ").trim();
    assert.match(text, /needs JavaScript/i, "says the page needs JavaScript");
    assert.ok(!DASHES.test(text), "no en or em dash");
    const words = text.split(" ").filter(Boolean).length;
    assert.ok(words < 40, `under 40 words (got ${words})`);

    const links = [...note.querySelectorAll("a[href]")];
    const hrefs = links.map((a) => a.getAttribute("href"));
    assert.ok(hrefs.includes("rules.html"), "links to the static rules page");
    for (const href of hrefs) {
      assert.match(href, /^[a-z0-9-]+\.html$/, `link ${href} is a plain local page`);
      assert.ok(fs.existsSync(new URL(href, ROOT)), `link target ${href} exists`);
    }
  });
}
