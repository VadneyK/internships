// Data failure sweep: every page that fetches data/*.json says so when the fetch fails.
// Run with: node --test tests/r2-tests-2-data-failure.test.mjs
// Each required data file is made to answer 404, 500, invalid JSON, and an empty {} or [] while the page loads.
// A page must not throw, must keep its h1 and nav, and must write a short message in the area it uses for results.
// Optional files (gaps.json, entries-detail.json) must not blank the main list.
// KNOWN_GAPS lists cases that fail today with a reason. A listed case that starts passing fails the test, so remove it then.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const MESSAGE = /could not|try again|unavailable|not load/i;

// Cases that fail today. Key: "page file mode". Value: why. Follow-up tickets come from this list.
const KNOWN_GAPS = {
  "find.html entries-lite.json empty-array": "An empty program list is drawn as '0 of 0 programs', not a load failure. Fix in common.js checkJson or find.js: treat an empty entries file as a failed load.",
  "calendar.html entries-card.json empty-array": "An empty program list is drawn as '0 programs in October'. Same root cause: no check that the entries file has rows.",
  "younger.html entries-core.json empty-array": "An empty program list shows the normal federal note with no failure message; the program count is silently zero.",
  "index.html entries-card.json empty-array": "An empty program list shows 'No confirmed deadlines in the next few weeks' instead of a load failure.",
};

// page, the area where results or the failure message go, and the required data files the page requests.
const PAGES = [
  { page: "find.html", area: "count", also: "out", files: ["entries-lite.json"], optional: ["gaps.json", "entries-detail.json"] },
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
  { page: "index.html", area: "soonList", files: ["entries-card.json"] },
];

const MODES = {
  "404": () => new Response("not found", { status: 404 }),
  "500": () => new Response("server error", { status: 500 }),
  "bad-json": () => new Response("<html>{ not json", { status: 200, headers: { "Content-Type": "application/json" } }),
  "empty-object": () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
  "empty-array": () => new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
};

// dom-helper assigns window.fetch after setup runs; a setter here catches that and wraps it.
function breakFetch(fileName, mode, hits) {
  return (w) => {
    let wrapped;
    Object.defineProperty(w, "fetch", {
      configurable: true, enumerable: true,
      get: () => wrapped,
      set: (real) => {
        wrapped = (u, o) => {
          const path = new URL(String(u), w.location.href).pathname;
          if (path === "/data/" + fileName) { hits.push(path); return Promise.resolve(MODES[mode]()); }
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

const seenGaps = new Set();

async function runCase(spec, fileName, mode, optional) {
  const file = spec.file || spec.page;
  const hits = [];
  const before = rejections.length;
  const p = await loadPage(file, { setup: breakFetch(fileName, mode, hits) });
  const { document: d, window: w } = p;
  if (optional) {
    // the long-text file loads on the first search; the lite list must stay on screen either way
    const q = d.getElementById("q");
    if (q && fileName === "entries-detail.json") type(w, q, "a");
  }
  await tick(400);
  const label = `${file} ${fileName} ${mode}`;
  const problems = [];
  if (!hits.length) problems.push("the page never requested " + fileName);
  if (p.errors.length) problems.push("script errors: " + p.errors.join(" | "));
  if (rejections.length > before) problems.push("unhandled rejection: " + rejections.slice(before).join(" | ").slice(0, 300));
  if (!d.querySelector("h1")) problems.push("no h1");
  if (!d.querySelector("nav")) problems.push("no nav");
  const area = d.getElementById(spec.area);
  const text = area ? area.textContent.trim() : "";
  if (optional) {
    const cards = d.querySelectorAll("#out article.prog").length;
    if (!cards) problems.push("the main list is blank");
  } else {
    if (!area) problems.push("no #" + spec.area);
    else if (!MESSAGE.test(text)) problems.push(`#${spec.area} says ${JSON.stringify(text.slice(0, 80))}, not a failure message`);
  }
  return { label, problems };
}

for (const spec of PAGES) {
  const file = spec.file || spec.page;
  const targets = [...spec.files.map((f) => [f, false]), ...(spec.optional || []).map((f) => [f, true])];
  for (const [fileName, optional] of targets) {
    for (const mode of Object.keys(MODES)) {
      const key = `${file} ${fileName} ${mode}`;
      test(`${key}: says so, keeps h1 and nav${optional ? ", keeps the list" : ""}`, { timeout: 60000 }, async () => {
        const { problems } = await runCase(spec, fileName, mode, optional);
        if (KNOWN_GAPS[key]) {
          seenGaps.add(key);
          assert.ok(problems.length > 0, `KNOWN_GAPS entry now passes, remove it: ${key}`);
        } else {
          assert.deepEqual(problems, [], key);
        }
      });
    }
  }
}

test("every table entry matches a real fetch call in the page scripts", () => {
  const js = ["common.js", "find.js", "calendar.js", "languages.js", "interview.js", "paycheck.js", "permit.js", "parents.js", "ready.js", "safety.js", "younger.js", "states.js", "insights.js", "home.js"].map((f) => read("assets/js/" + f)).join("\n");
  for (const spec of PAGES) for (const f of [...spec.files, ...(spec.optional || [])]) assert.ok(js.includes("data/" + f), `${spec.page}: no fetch of data/${f} in the scripts`);
});

test("no unhandled rejection leaked from any failure case", () => {
  assert.deepEqual(rejections, []);
});
