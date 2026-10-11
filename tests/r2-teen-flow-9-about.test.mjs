// About page: "For schools and counselors" section (ticket r2-about-1).
// Every claim in the section must already be stated elsewhere on the site.
// Run with: node --test tests/r2-teen-flow-9-about.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const schoolsSection = (html) => {
  const m = html.match(/<section id="schools"[\s\S]*?<\/section>/);
  return m ? m[0] : "";
};

const src = read("src/about.html");
const built = read("about.html");
const section = schoolsSection(src);
const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("src/about.html has a schools section with the heading", () => {
  assert.ok(section, "section id=schools is missing");
  assert.match(section, /<h2>For schools and counselors<\/h2>/);
});

test("built about.html contains the same schools section", () => {
  assert.equal(schoolsSection(built), section, "run python3 tools/build.py after editing src/about.html");
});

test("schools section says what the site collects (nothing: no accounts, cookies or analytics)", () => {
  assert.match(text, /No accounts, no sign-up, no cookies, no analytics, no tracking, and no ads\./);
  assert.match(text, /Saved lists and choices stay in the browser on that device\./);
  assert.match(text, /not sent to us or anyone else/);
});

test("schools section says links to official pages leave this site", () => {
  assert.match(text, /Links to official pages leave this site\. They open in a new tab\./);
});

test("schools section says GitHub issues are public", () => {
  assert.match(text, /GitHub issues are public\./);
  assert.match(text, /13 and older, with a parent&rsquo;s okay/);
});

test("schools section reuses the existing license wording exactly", () => {
  const licence = "Code: MIT License. Program data and written guides: Creative Commons Attribution 4.0 (CC BY 4.0). Please link back to this guide.";
  const dataSection = src.match(/<section id="data">[\s\S]*?<\/section>/)[0];
  assert.ok(dataSection.includes(licence), "the open data section no longer has the license sentence");
  assert.ok(section.includes(licence), "schools section must reuse the license sentence");
});

test("schools section links resolve to real targets", () => {
  for (const id of ["privacy", "data"]) {
    assert.ok(src.includes(`id="${id}"`), `no element with id ${id}`);
  }
  assert.ok(fs.existsSync(new URL("../parents.html", import.meta.url)), "parents.html is missing");
});

test("about.html has no em dash or en dash, as characters or entities", () => {
  for (const [name, html] of [["src/about.html", src], ["about.html", built]]) {
    assert.ok(!/[\u2013\u2014]/.test(html), `${name} has a dash character`);
    assert.ok(!/&(ndash|mdash|#8211|#8212|#x2013|#x2014);/i.test(html), `${name} has a dash entity`);
  }
});
