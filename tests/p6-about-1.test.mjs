// About page: "Accessibility" section (ticket p6-about-1).
// Every claim in the section is checked against the repo: no media elements on the site,
// the data-loading pages exist and load JavaScript data, and the contribute link points at a real page.
// Run with: node --test tests/p6-about-1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const sectionOf = (html) => {
  const m = html.match(/<section id="accessibility"[\s\S]*?<\/section>/);
  return m ? m[0] : "";
};

const src = read("src/about.html");
const built = read("about.html");
const section = sectionOf(src);
const text = section.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("src/about.html has an Accessibility section with the heading", () => {
  assert.ok(section, "section id=accessibility is missing");
  assert.match(section, /<h2>Accessibility<\/h2>/);
});

test("built about.html contains the same Accessibility section", () => {
  assert.equal(sectionOf(built), section, "run python3 tools/build.py after editing src/about.html");
});

test("section says there are no videos or sound, so nothing needs captions", () => {
  assert.match(text, /The guide has no videos or sound clips, so nothing needs captions\./);
});

test("section says pages are plain text, headings and links", () => {
  assert.match(text, /Pages are mostly plain text, headings and links\./);
});

test("section names the pages that load data through JavaScript, and each page exists", () => {
  const pages = ["find.html", "jobs.html", "permit.html", "ready.html", "younger.html", "safety.html"];
  for (const p of pages) {
    assert.ok(section.includes(`href="${p}"`), `section does not link ${p}`);
    assert.ok(fs.existsSync(path.join(ROOT, "src", p)), `src/${p} is missing`);
  }
  assert.match(text, /load with JavaScript from data files/);
});

test("the data-loading claim matches real fetches in the page scripts", () => {
  const scripts = {
    "find.html": "find.js",
    "jobs.html": "jobs.js",
    "permit.html": "permit.js",
    "ready.html": "ready.js",
    "younger.html": "younger.js",
    "safety.html": "safety.js",
  };
  for (const [page, js] of Object.entries(scripts)) {
    const code = read(`assets/js/${js}`) + read("assets/js/common.js");
    assert.ok(/fetchData\(|loadEntries\(/.test(code), `${js} does not load data`);
    assert.ok(read(page).includes(`assets/js/${js}?v=`), `built ${page} does not load assets/js/${js}`);
  }
});

test("section says every page works with a keyboard", () => {
  assert.match(text, /Every page works with a keyboard\./);
});

test("section names the light and dark mode button and the phone Menu button", () => {
  assert.match(text, /The light and dark mode button is in the top bar of every page\./);
  assert.match(text, /On a small screen, a Menu button opens the page links\./);
  assert.ok(read("src/_layout.html").includes('id="themeBtn"'), "theme button is missing from the layout");
  assert.ok(read("assets/js/common.js").includes('"menu-btn"'), "menu button is not created in common.js");
});

test("section tells people how to report a barrier through the contribute page link", () => {
  assert.match(text, /If something on this site blocks you, tell us on the Help build this page\./);
  assert.ok(section.includes('href="contribute.html"'), "section does not link contribute.html");
  assert.ok(fs.existsSync(path.join(ROOT, "src", "contribute.html")), "src/contribute.html is missing");
});

test("section makes no standard or score claim", () => {
  assert.doesNotMatch(text, /WCAG|Section 508|AA\b|AAA\b|score|certified|compliant|conform/i);
});

test("section does not claim data files are small", () => {
  assert.doesNotMatch(text, /small data files/i);
});

test("the site has no video, audio or embedded media in the source", () => {
  const files = ["src", "assets/js"].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).map((f) => path.join(d, f)));
  for (const rel of files) {
    if (!/\.(html|js)$/.test(rel)) continue;
    assert.doesNotMatch(read(rel), /<(video|audio|iframe|embed|object)\b/i, `${rel} has embedded media`);
  }
});

test("about.html has no em dash or en dash in the new section", () => {
  assert.ok(!/[\u2013\u2014]/.test(section), "section has a dash character");
  assert.ok(!/&(ndash|mdash|#8211|#8212|#x2013|#x2014);/i.test(section), "section has a dash entity");
});
