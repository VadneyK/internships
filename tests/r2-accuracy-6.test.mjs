// Privacy copy lists everything saved on the device (ticket r2-accuracy-6).
// Run with: node --test tests/r2-accuracy-6.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// Every G.store key in assets/js/*.js, mapped to the plain words the privacy copy uses for it.
const WORDS = {
  saved: "saved list",
  people: "people map",
  me: "message details",
  ready: "first-job checklist",
  interview: "interview notes",
  resume: "resume draft",
  leader: "youth leader group details",
  findprefs: "age and area you last picked",
};
// The light/dark choice is not a G.store key (common.js writes localStorage "theme" directly).
const THEME_WORDS = "light/dark choice";

const jsFiles = fs.readdirSync(new URL("../assets/js/", import.meta.url)).filter((f) => f.endsWith(".js"));
const storeKeys = new Set();
for (const f of jsFiles) {
  const src = read(`assets/js/${f}`);
  for (const m of src.matchAll(/G\.store\.(?:get|set)\(\s*"([^"]+)"/g)) storeKeys.add(m[1]);
}

test("every G.store key in assets/js has a plain-word mapping in this test", () => {
  assert.ok(storeKeys.size > 0, "no G.store keys found");
  const unmapped = [...storeKeys].filter((k) => !(k in WORDS));
  assert.deepEqual(unmapped, [], "add a plain-word mapping to WORDS for each new key");
  const stale = Object.keys(WORDS).filter((k) => !storeKeys.has(k));
  assert.deepEqual(stale, [], "remove mappings for keys no longer used");
});

test("about.html names every saved key in plain words", () => {
  const about = read("about.html");
  const missing = [...storeKeys].filter((k) => !about.includes(WORDS[k]));
  assert.deepEqual(missing, [], "about.html is missing these saved items");
});

test("about.html names the light/dark choice", () => {
  assert.ok(read("assets/js/common.js").includes('localStorage.setItem("theme"'));
  assert.ok(read("about.html").includes(THEME_WORDS));
});

test("about.html says the interview Clear all hours button clears only the hours", () => {
  const about = read("about.html");
  assert.ok(about.includes("The interview page&rsquo;s &ldquo;Clear all hours&rdquo; button clears only the hours"));
  assert.ok(!about.includes("The interview page has no Clear button"));
});

test("interview.html says reference names and contacts are saved on this device", () => {
  const html = read("interview.html");
  assert.match(html, /Your notes are saved on this device only\. Reference names and their phone or email contacts are saved on this device too\./);
});
