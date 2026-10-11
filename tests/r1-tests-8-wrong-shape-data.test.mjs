// Wrong-shape data sweep: every page that fetches data/*.json survives valid JSON of the wrong shape.
// Run with: node --test tests/r1-tests-8-wrong-shape-data.test.mjs
// This is what a half-deployed or cached data file looks like. r2-tests-2 covers fetch failures; r3-tests-1 covers hostile strings.
// Each data file is answered with [], {}, null, 0, "x", and the real file with its main array emptied. One page load each.
// A page must not log a script error or leak an unhandled rejection, must keep its h1, and must leave its results area
// with plain words (a message or an empty state), never blank and never "undefined", "NaN" or "[object".
// KNOWN_GAPS lists cases that fail today with a reason. A listed case that starts passing fails the test, so remove it then.
// NOTHING_TABLE lists pages that legitimately show no text in the area for a mutation, with a reason.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SETTLE_MS = 250;
const BAD_TEXT = /undefined|NaN|\[object|null\b/;

// Cases that fail today. Key: "page file mode". Value: why. Follow-up tickets come from this list.
const KNOWN_GAPS = {};

// Pages that legitimately show nothing in the area for a given file. Key: "page file". Value: why.
const NOTHING_TABLE = {};

// page, the area where results or a message go, and the data files the page requests.
const PAGES = [
  { page: "find.html", area: "count", files: ["entries-lite.json"] },
  { page: "calendar.html", area: "cCount", files: ["calendar.json", "entries-card.json"] },
  { page: "languages.html", area: "lCount", files: ["languages.json"] },
  { page: "interview.html", area: "aOut", files: ["interview.json", "permits.json"] },
  { page: "paycheck.html", area: "mOut", files: ["money.json"] },
  { page: "permit.html", area: "pOut", files: ["permits.json"] },
  { page: "parents.html", area: "signLead", files: ["parents.json"] },
  { page: "ready.html", area: "rideOut", files: ["transit.json"] },
  { page: "safety.html", area: "sbody-rights", files: ["safety.json"] },
  { page: "younger.html", area: "fedNote", files: ["younger.json", "entries-core.json"] },
  { page: "states.html", area: "moreOut", files: ["permits.json"] },
  { page: "insights.html", area: "todayLead", files: ["entries-stats.json"] },
  { page: "index.html", area: "soonList", files: ["entries-home.json"] },
];

// The real object with its main array emptied: the top-level array, or the longest array property.
function emptied(fileName) {
  const real = JSON.parse(readFileSync(join(ROOT, "data", fileName), "utf8"));
  if (Array.isArray(real)) return [];
  let best = null;
  for (const k of Object.keys(real)) if (Array.isArray(real[k]) && (best === null || real[k].length > real[best].length)) best = k;
  if (best !== null) real[best] = [];
  return real;
}

const MODES = {
  "empty-array": () => "[]",
  "empty-object": () => "{}",
  "null": () => "null",
  "zero": () => "0",
  "string": () => '"x"',
  "main-array-emptied": (f) => JSON.stringify(emptied(f)),
};

// dom-helper assigns window.fetch after setup runs; a setter here catches that and wraps it.
function breakFetch(fileName, body, hits) {
  return (w) => {
    let wrapped;
    Object.defineProperty(w, "fetch", {
      configurable: true, enumerable: true,
      get: () => wrapped,
      set: (real) => {
        wrapped = (u, o) => {
          const path = new URL(String(u), w.location.href).pathname;
          if (path === "/data/" + fileName) { hits.push(path); return Promise.resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } })); }
          return real(u, o);
        };
      },
    });
  };
}

const rejections = [];
const onRej = (r) => rejections.push(String((r && r.stack) || r));
process.on("unhandledRejection", onRej);
test.after(() => process.off("unhandledRejection", onRej));

async function runCase(spec, fileName, mode) {
  const hits = [];
  const before = rejections.length;
  const p = await loadPage(spec.page, { setup: breakFetch(fileName, MODES[mode](fileName), hits) });
  await tick(SETTLE_MS);
  const d = p.document;
  const problems = [];
  if (!hits.length) problems.push("the page never requested " + fileName);
  if (p.errors.length) problems.push("script errors: " + p.errors.join(" | ").slice(0, 300));
  if (rejections.length > before) problems.push("unhandled rejection: " + rejections.slice(before).join(" | ").slice(0, 300));
  if (!d.querySelector("h1")) problems.push("no h1");
  const area = d.getElementById(spec.area);
  const text = area ? area.textContent.trim() : "";
  if (!area) problems.push("no #" + spec.area);
  else if (!NOTHING_TABLE[`${spec.page} ${fileName}`]) {
    if (!text) problems.push(`#${spec.area} is blank`);
    else if (BAD_TEXT.test(text)) problems.push(`#${spec.area} shows ${JSON.stringify(text.slice(0, 80))}`);
  }
  p.window.close();
  return problems;
}

// dom-helper waits up to 2 to 5 seconds on pages whose lists stay empty, so cases run 8 at a time to keep the file under 3 minutes.
test("wrong-shape data, every page, every file, every mutation", { concurrency: 8, timeout: 170000 }, async (t) => {
  const runs = [];
  for (const spec of PAGES) {
    for (const fileName of spec.files) {
      for (const mode of Object.keys(MODES)) {
        const key = `${spec.page} ${fileName} ${mode}`;
        runs.push(t.test(`${key}: loads without errors and says something plain`, { timeout: 60000 }, async () => {
          const problems = await runCase(spec, fileName, mode);
          if (KNOWN_GAPS[key]) assert.ok(problems.length > 0, `KNOWN_GAPS entry now passes, remove it: ${key}`);
          else assert.deepEqual(problems, [], key);
        }));
      }
    }
  }
  await Promise.all(runs);
});

test("every NOTHING_TABLE and KNOWN_GAPS entry names a real case", () => {
  const pages = new Set(PAGES.flatMap((s) => s.files.map((f) => `${s.page} ${f}`)));
  for (const [k, why] of Object.entries(NOTHING_TABLE)) { assert.ok(pages.has(k), k); assert.ok(why.length > 10, k); }
  for (const k of Object.keys(KNOWN_GAPS)) assert.ok(pages.has(k.split(" ").slice(0, 2).join(" ")), k);
});

test("no unhandled rejection leaked from any wrong-shape case", () => {
  assert.deepEqual(rejections, []);
});
