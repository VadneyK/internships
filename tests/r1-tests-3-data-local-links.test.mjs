// r1-tests-3: every site-local page reference inside a data/*.json string resolves.
// Finds href="x.html", bare x.html paths with ?query and #fragment, and markdown links, in every string of every data file.
// Each target page must exist at the repo root, each #fragment must be a static id in that built page (or p-<program id>
// that exists in entries.json), and each state= or place= value must be a known state code, region or hub.
// A failure names the file, the JSON path and the bad target. Real misses may be listed in ALLOW with a reason (empty now).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const DATA = Object.fromEntries(readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => [f, JSON.parse(readFileSync(join(dataDir, f), "utf8"))]));

const PROGRAM_IDS = new Set(DATA["entries.json"].map((e) => e.id));
const STATE_CODES = new Set(Object.keys(DATA["permits.json"].states).map((s) => s.toLowerCase()));
const PLACE_IDS = new Set([...L.REGIONS.map((r) => r[0]), ...L.HUBS.map((h) => h[0])].map((s) => String(s).toLowerCase()));

// "file | json path | target" -> reason. Keep empty unless a real miss cannot be fixed in this change.
const ALLOW = {};

// Drop external addresses first so a program's own site (for example example.edu/jobs.html) is not read as a local page.
const EXTERNAL = [
  /(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s"'<>)\]]*/gi,
  /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|edu|gov|net|ca|io|us|info|co)\/[^\s"'<>)\]]*/gi,
];
const LOCAL = /(?<![\w./@-])((?:\.\/)?[a-z0-9_-]+\.html)(\?[^\s"'<>)\]#]*)?(#[^\s"'<>)\]]*)?/gi;

export function extractLocalRefs(str) {
  let s = str;
  for (const re of EXTERNAL) s = s.replace(re, " ");
  return [...s.matchAll(LOCAL)].map((m) => ({ page: m[1].replace(/^\.\//, ""), query: m[2] || "", hash: m[3] || "", raw: m[0] }));
}

const idCache = new Map();
function pageIds(page) {
  if (!idCache.has(page)) {
    const html = readFileSync(join(root, page), "utf8");
    idCache.set(page, new Set([...html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])));
  }
  return idCache.get(page);
}

function problems(ref) {
  const out = [];
  if (!existsSync(join(root, ref.page))) { out.push("page " + ref.page + " does not exist at the repo root"); return out; }
  if (ref.hash.length > 1) {
    const id = decodeURIComponent(ref.hash.slice(1));
    if (id.startsWith("p-")) { if (!PROGRAM_IDS.has(id.slice(2))) out.push("program id " + id.slice(2) + " is not in entries.json"); }
    else if (!pageIds(ref.page).has(id)) out.push("no static id " + id + " in " + ref.page);
  }
  if (ref.query) {
    for (const [k, v] of new URLSearchParams(ref.query.slice(1))) {
      const val = v.toLowerCase();
      if (k === "state" && !STATE_CODES.has(val)) out.push("unknown state code " + v);
      if (k === "place" && !STATE_CODES.has(val) && !PLACE_IDS.has(val)) out.push("unknown place " + v);
    }
  }
  return out;
}

function walk(v, path, file, visit) {
  if (typeof v === "string") visit(v, path, file);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + "[" + i + "]", file, visit));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], path + "." + k, file, visit);
}

test("extractor reads local links and skips external addresses", () => {
  assert.deepEqual(extractLocalRefs('see <a href="permit.html?state=ca#x">p</a>').map((r) => r.raw), ["permit.html?state=ca#x"]);
  assert.deepEqual(extractLocalRefs("[Jobs](jobs.html) and find.html#p-abc").map((r) => r.raw), ["jobs.html", "find.html#p-abc"]);
  assert.equal(extractLocalRefs("https://example.edu/a/jobs.html and //x.org/y.html and www.a.com/b.html").length, 0);
});

test("checker flags a missing page, a missing anchor, a dead program id and a bad state", () => {
  const bad = (s) => problems(extractLocalRefs(s)[0]);
  assert.ok(bad("gone.html").length);
  assert.ok(bad("permit.html#no-such-anchor-xyz").length);
  assert.ok(bad("find.html#p-no-such-program-xyz").length);
  assert.ok(bad("permit.html?state=zz").length);
  assert.deepEqual(bad("jobs.html"), []);
});

test("every site-local path in data/*.json resolves to a built page, id and known state or place", () => {
  const misses = [];
  let seen = 0;
  for (const [file, json] of Object.entries(DATA)) {
    walk(json, "", file, (str, path) => {
      for (const ref of extractLocalRefs(str)) {
        seen++;
        for (const p of problems(ref)) {
          const key = file + " | " + path + " | " + ref.raw;
          if (!(key in ALLOW)) misses.push(key + " : " + p);
        }
      }
    });
  }
  assert.ok(seen > 0, "found no local references at all, the extractor is broken");
  assert.deepEqual(misses, [], "bad local references in data:\n" + misses.join("\n"));
});
