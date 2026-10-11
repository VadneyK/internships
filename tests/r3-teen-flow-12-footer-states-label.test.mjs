// The site footer link to states.html must not name a short list of states.
// The page covers 13 more states and British Columbia, so a teen in Texas or Ohio
// should not read the label as "this page is not for me".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD_LABEL = "Rules in Georgia, New York, Illinois";
const NEW_LABEL = "Rules in other states";
const PAGES = ["index.html", "find.html"];

function load(file) {
  return new JSDOM(fs.readFileSync(path.join(ROOT, file), "utf8")).window.document;
}

for (const file of PAGES) {
  test(`${file}: footer link to states.html uses the new label and no short list`, () => {
    const doc = load(file);
    const footer = doc.querySelector("footer");
    assert.ok(footer, "page has a footer");
    const links = [...footer.querySelectorAll('a[href="states.html"]')];
    assert.equal(links.length, 1, "exactly one footer link to states.html");
    assert.equal(links[0].textContent.trim(), NEW_LABEL);
    assert.ok(!doc.body.textContent.includes(OLD_LABEL), "old footer label is gone");
  });
}

test("the footer link still goes to states.html", () => {
  for (const file of PAGES) {
    const link = [...load(file).querySelectorAll("footer a")].find((a) => a.textContent.trim() === NEW_LABEL);
    assert.ok(link, `${file} has the footer link`);
    assert.equal(new URL(link.getAttribute("href"), "https://example.invalid/site/").pathname, "/site/states.html");
  }
});
