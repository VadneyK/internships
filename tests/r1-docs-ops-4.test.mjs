// README accuracy for ticket r1-docs-ops-4: the page table, the permit count, the test commands and the dash rule.
// Run with: node --test tests/r1-docs-ops-4.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const readme = read("README.md");
const ci = read(".github/workflows/ci.yml");
const build = read("tools/build.py");
const meta = JSON.parse(read("data/meta.json"));
const permits = JSON.parse(read("data/permits.json"));

const pagesLine = build.match(/^PAGES = \[(.*)\]/m);
const PAGES = [...pagesLine[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
// build.py leaves leaders out of sitemap.xml on purpose. The README must match that.
const sitemapHidesLeaders = build.includes('if p != "leaders"');
const PUBLIC_FILES = ["index.html", ...PAGES.filter((p) => p !== "leaders").map((p) => p + ".html")];

test("the README table names every public page and the home page", () => {
  assert.ok(sitemapHidesLeaders, "build.py sitemap no longer hides leaders; update the README table to match");
  for (const file of PUBLIC_FILES) {
    assert.ok(readme.includes("`" + file + "`"), `README does not list \`${file}\``);
  }
});

test("every page file named in the README exists in the repo root", () => {
  const named = [...readme.matchAll(/`([a-z0-9-]+\.html)`/g)].map((m) => m[1]);
  assert.ok(named.length >= PUBLIC_FILES.length, "README names too few pages");
  for (const file of new Set(named)) {
    assert.ok(existsSync(join(root, file)), `README names ${file} but the file does not exist`);
  }
});

test("relative links in the README point to files that exist", () => {
  const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  assert.ok(links.length > 0, "README has no links to check");
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = link.split("#")[0];
    assert.ok(existsSync(join(root, target)), `README link ${link} does not resolve`);
  }
});

test("the run and test commands in the README are the commands CI runs", () => {
  const commands = [
    "pip install jsonschema",
    "npm ci",
    "node --test tests/*.test.mjs",
    "python3 -m unittest discover -s tests -v",
  ];
  for (const cmd of commands) {
    assert.ok(ci.includes(cmd), `ci.yml does not run "${cmd}"`);
    assert.ok(readme.includes(cmd), `README does not show "${cmd}"`);
  }
  assert.ok(!readme.includes("python3 -m unittest discover -s tests -v` and `node --test tests/`"), "old test line is back");
});

test("the permit count in the README matches data/permits.json", () => {
  const keys = Object.keys(permits.states);
  assert.equal(keys.length, 18, "permits.json should have 17 states plus bc");
  assert.ok(keys.includes("bc"), "permits.json has no bc entry");
  assert.ok(readme.includes(`${keys.length - 1} states and British Columbia`), "README permit count does not match permits.json");
});

test("the README names the Where picker, the permit finder, the share page and the languages page", () => {
  assert.ok(/Where picker/.test(readme), "README does not describe the Where picker");
  assert.ok(/QR code/.test(readme), "README does not mention QR codes");
  assert.ok(readme.includes("`share.html`"), "README does not link the share page");
  assert.ok(readme.includes("`languages.html`"), "README does not list the languages page");
});

test("the README gives no exact program count, and 'more than a thousand' is true", () => {
  assert.equal(/\b\d[\d,]*\s+programs?\b/i.test(readme), false, "README has an exact program count");
  if (/more than a thousand programs/.test(readme)) {
    assert.ok(meta.count > 1000, `meta.json count is ${meta.count}, so "more than a thousand" is wrong`);
  }
});

test("the scheduled checks in the README match the workflow files", () => {
  const links = read(".github/workflows/links.yml");
  const fresh = read(".github/workflows/freshness.yml");
  const codeql = read(".github/workflows/codeql.yml");
  assert.ok(links.includes('label link-check') && links.includes("gh issue comment"), "link check no longer opens or updates a link-check issue");
  assert.ok(fresh.includes("--label refresh"), "refresh check no longer opens a refresh issue");
  assert.ok(codeql.includes('"41 6 * * 3"'), "CodeQL is no longer weekly on Wednesday");
  assert.ok(readme.includes("labeled `link-check`") && readme.includes("labeled `refresh`"), "README does not name the issue labels");
  assert.ok(readme.includes("every Wednesday"), "README does not say CodeQL runs on Wednesday");
});

test("the README and build.py have no em dash or en dash", () => {
  const bad = new RegExp("[" + String.fromCharCode(0x2014, 0x2013) + "]");
  assert.equal(bad.test(readme), false, "README has an em dash or en dash");
  assert.equal(bad.test(build), false, "build.py has an em dash or en dash");
});

test("the build.py docstring points at a tool that exists", () => {
  const doc = build.split('"""')[1] || "";
  assert.ok(!doc.includes("tools/merge.py"), "build.py docstring still names tools/merge.py");
  assert.ok(doc.includes("tools/build_data.py"), "build.py docstring does not name tools/build_data.py");
  assert.ok(existsSync(join(root, "tools", "build_data.py")), "tools/build_data.py is missing");
});
