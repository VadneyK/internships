// Run with: node --test tests/r3-teen-flow-5.test.mjs
// The Rules Pay section and the Georgia, New York and Illinois sections on States link to Your first paycheck.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const doc = (rel) => new JSDOM(read(rel)).window.document;

const LINKS = [
  { page: "rules.html", section: "pay", name: "California", href: "paycheck.html?state=ca", text: "See what comes out of a first paycheck in California." },
  { page: "states.html", section: "georgia", name: "Georgia", href: "paycheck.html?state=ga", text: "See what comes out of a first paycheck in Georgia." },
  { page: "states.html", section: "newyork", name: "New York", href: "paycheck.html?state=ny", text: "See what comes out of a first paycheck in New York." },
  { page: "states.html", section: "illinois", name: "Illinois", href: "paycheck.html?state=il", text: "See what comes out of a first paycheck in Illinois." },
];

test("each Pay section has its paycheck link inside that section", () => {
  for (const { page, section, href, text } of LINKS) {
    const sec = doc(page).getElementById(section);
    assert.ok(sec, `${page} has #${section}`);
    const a = [...sec.querySelectorAll("a")].find((x) => x.getAttribute("href") === href);
    assert.ok(a, `${page} #${section} links to ${href}`);
    assert.equal(a.textContent.trim(), text);
  }
});

test("each link text names its state, so the links have different names", () => {
  for (const { page, section, name, href } of LINKS) {
    const sec = doc(page).getElementById(section);
    const a = [...sec.querySelectorAll("a")].find((x) => x.getAttribute("href") === href);
    assert.ok(a.textContent.includes(name), `${href} names ${name}`);
  }
  const texts = LINKS.map((l) => l.text);
  assert.equal(new Set(texts).size, texts.length);
});

test("the state links sit at the end of their state section", () => {
  for (const { page, section, href } of LINKS.filter((l) => l.page === "states.html")) {
    const wrap = doc(page).getElementById(section).querySelector(".wrap");
    const last = wrap.lastElementChild;
    assert.equal(last.tagName, "P", `${section} ends with a paragraph`);
    assert.equal(last.querySelector("a").getAttribute("href"), href, `${section} ends with ${href}`);
  }
});

test("the new sentences use no em dash or en dash", () => {
  for (const { text } of LINKS) assert.doesNotMatch(text, /[\u2013\u2014]/);
});

test("each paycheck state code is one that paycheck.html reads", () => {
  const ids = JSON.parse(read("data/money.json")).states.map((s) => s.id);
  for (const { href } of LINKS) {
    const code = new URL(href, "http://localhost/").searchParams.get("state");
    assert.ok(ids.includes(code), `${href} uses a known state`);
  }
});

test("the repo's rules.html and states.html match a fresh build, and a second build changes nothing", () => {
  // Build a copy in a temp folder so the repo's pages are never rewritten while other test files read them.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "r3-teen-flow-5-"));
  try {
    for (const dir of ["src", "tools", "data", "assets"]) fs.cpSync(path.join(ROOT, dir), path.join(tmp, dir), { recursive: true });
    const build = () => execFileSync("python3", [path.join(tmp, "tools", "build.py")], { cwd: tmp, encoding: "utf8", stdio: "pipe" });
    const outputs = ["rules.html", "states.html"];
    build();
    const first = Object.fromEntries(outputs.map((f) => [f, fs.readFileSync(path.join(tmp, f), "utf8")]));
    for (const f of outputs) assert.equal(first[f], read(f), `${f} in the repo is up to date with src/`);
    build();
    for (const f of outputs) assert.equal(fs.readFileSync(path.join(tmp, f), "utf8"), first[f], `${f} unchanged on a second build`);
    assert.ok(first["rules.html"].includes('href="paycheck.html?state=ca"'));
    assert.ok(first["states.html"].includes('href="paycheck.html?state=il"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
