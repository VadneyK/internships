// Request sweep: no 404 or failed data load on any page, and every referenced file exists.
// Run with: node --test tests/r3-tests-5.test.mjs
// Why: dom-helper only reports script errors. A fetch() of a missing or renamed data file comes back as a
// 404 response and the page quietly shows nothing, so jsdomError never fires. Images and fonts are never
// requested in jsdom. The static half below checks those files by reading the pages, scripts and CSS.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();

// ---------- request logging ----------

// dom-helper assigns window.fetch after the setup hook runs. A setter defined here catches that assignment
// and stores a wrapped copy that records the url and the response status of every request.
function logFetch(log) {
  return (w) => {
    let wrapped;
    Object.defineProperty(w, "fetch", {
      configurable: true,
      enumerable: true,
      get: () => wrapped,
      set: (real) => {
        wrapped = (u, o) => {
          const url = new URL(String(u), w.location.href).href;
          return real(u, o).then(
            (r) => { log.push({ url, status: r.status }); return r; },
            (e) => { log.push({ url, status: 0, error: String(e) }); throw e; },
          );
        };
      },
    });
  };
}

async function load(file, opts = {}) {
  const log = [];
  const p = await loadPage(file, { ...opts, setup: logFetch(log) });
  return { ...p, log };
}

function checkLog(label, p) {
  const origin = new URL(p.window.location.href).origin;
  for (const r of p.log) {
    assert.ok(r.url.startsWith(origin + "/"), `${label}: request leaves the site: ${r.url}`);
    assert.equal(r.status, 200, `${label}: ${r.url} answered ${r.status} ${r.error || ""}`);
    const path = new URL(r.url).pathname.replace(/^\//, "");
    assert.match(path, /^data\/[^/]+\.(json|csv)$/, `${label}: unexpected request ${r.url}`);
    assert.ok(existsSync(join(ROOT, path)), `${label}: ${path} is not on disk`);
  }
}

test("the logging hook sees the page's own data request", async () => {
  const p = await load("calendar.html");
  await tick(200);
  const paths = p.log.map((r) => new URL(r.url).pathname);
  assert.ok(paths.includes("/data/calendar.json"), `calendar.html requests: ${paths.join(", ")}`);
});

// ---------- every built page ----------

const totalRequests = [];
for (const page of pages) {
  test(`${page}: loads with no failed request and only existing same-origin data files`, async () => {
    const p = await load(page);
    await tick(150);
    assert.deepEqual(p.errors, [], `${page}: script errors`);
    checkLog(page, p);
    totalRequests.push(...p.log.map((r) => r.url));
  });
}

test("the sweep saw real data requests across the pages", () => {
  assert.ok(totalRequests.length >= 8, `only ${totalRequests.length} requests logged, check the hook`);
  /* find.html draws its cards from the lite file; the full text file loads only when a card is opened (tests/r1-perf-scale-3.test.mjs) */
  assert.ok(totalRequests.some((u) => u.endsWith("/data/entries-lite.json")), "no page loaded data/entries-lite.json");
});

// ---------- interactive states ----------

test("find.html: Show more loads nothing broken", async () => {
  const p = await load("find.html");
  await tick(200);
  const more = p.document.getElementById("more");
  assert.ok(more, "find.html should have a Show more button");
  more.click();
  await tick(100);
  assert.deepEqual(p.errors, []);
  assert.ok(p.log.length > 0, "find.html logged no requests");
  checkLog("find.html after Show more", p);
});

test("calendar.html: clicking a month chip loads nothing broken", async () => {
  const p = await load("calendar.html", { search: "?m=2" });
  await tick(200);
  const chip = p.document.querySelector('#months .chip[data-m="8"]');
  assert.ok(chip, "month chip missing");
  chip.click();
  await tick(100);
  assert.deepEqual(p.errors, []);
  assert.ok(p.log.length > 0, "calendar.html logged no requests");
  checkLog("calendar.html after month click", p);
});

test("permit.html: a permit result loads nothing broken", async () => {
  const p = await load("permit.html");
  await tick(200);
  type(p.window, p.document.getElementById("pState"), "ca");
  type(p.window, p.document.getElementById("pAge"), "15");
  type(p.window, p.document.getElementById("pKind"), "job");
  await tick(100);
  assert.match(p.document.getElementById("pOut").textContent, /Permit to Employ and Work/);
  assert.deepEqual(p.errors, []);
  assert.ok(p.log.length > 0, "permit.html logged no requests");
  checkLog("permit.html after a result", p);
});

test("younger.html: picking a state loads nothing broken", async () => {
  const p = await load("younger.html");
  await tick(200);
  type(p.window, p.document.getElementById("yState"), "ga");
  await tick(100);
  assert.equal(p.document.getElementById("yState").value, "ga");
  assert.deepEqual(p.errors, []);
  assert.ok(p.log.length > 0, "younger.html logged no requests");
  checkLog("younger.html after a state pick", p);
});

// ---------- static: paths named in scripts ----------

const jsFiles = readdirSync(join(ROOT, "assets/js")).filter((f) => f.endsWith(".js")).sort();
const cleanPath = (s) => s.split(/[?#]/)[0].replace(/^\.\//, "");

test("every quoted data/*.json, assets/... or *.csv path in assets/js exists on disk", () => {
  const found = [];
  for (const f of jsFiles) {
    const text = read(`assets/js/${f}`);
    for (const m of text.matchAll(/["'`]((?:\.\/)?(?:data|assets)\/[^"'`\s\\]+)/g)) found.push([f, cleanPath(m[1])]);
    for (const m of text.matchAll(/["'`]([^"'`\s\\:]*\.csv)(?:[?#][^"'`\s\\]*)?["'`\\]/g)) found.push([f, cleanPath(m[1])]);
  }
  assert.ok(found.length >= 10, `only ${found.length} path literals found, check the pattern`);
  // A path that ends in a slash is a folder a script adds an id to, for example "data/programs/" + id + ".json"; the folder must exist.
  const missing = found.filter(([, p]) => p.endsWith("/")
    ? !existsSync(join(ROOT, p)) || !statSync(join(ROOT, p)).isDirectory()
    : !existsSync(join(ROOT, p)) || !statSync(join(ROOT, p)).isFile());
  assert.deepEqual(missing.map(([f, p]) => `${f} -> ${p}`), [], "paths in scripts that are not files");
});

// ---------- static: files named in built pages ----------

function startTags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => {
    const out = {};
    for (const a of m[1].matchAll(/([a-zA-Z_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[a[1].toLowerCase()] = a[2] ?? a[3];
    return out;
  });
}
const isLocal = (u) => u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);

test("every <img src>, srcset, <link href>, <source src> and <script src> in built pages is a non-empty file", () => {
  const refs = [];
  for (const page of pages) {
    const html = read(page);
    for (const t of startTags(html, "img")) {
      if (isLocal(t.src)) refs.push([page, t.src]);
      for (const part of (t.srcset || "").split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (isLocal(u)) refs.push([page, u]);
      }
    }
    for (const t of startTags(html, "source")) {
      if (isLocal(t.src)) refs.push([page, t.src]);
      for (const part of (t.srcset || "").split(",")) {
        const u = part.trim().split(/\s+/)[0];
        if (isLocal(u)) refs.push([page, u]);
      }
    }
    for (const t of startTags(html, "link")) if (isLocal(t.href)) refs.push([page, t.href]);
    for (const t of startTags(html, "script")) if (isLocal(t.src)) refs.push([page, t.src]);
  }
  assert.ok(refs.length >= pages.length * 3, `only ${refs.length} references found, check the parser`);
  const bad = refs.filter(([, u]) => {
    const p = join(ROOT, cleanPath(u));
    return !existsSync(p) || !statSync(p).isFile() || statSync(p).size === 0;
  });
  assert.deepEqual(bad.map(([page, u]) => `${page} -> ${u}`), [], "page references to missing or empty files");
});

test("every CSS url() resolves to a non-empty file", () => {
  const cssDir = "assets/css";
  const refs = [];
  for (const css of readdirSync(join(ROOT, cssDir)).filter((f) => f.endsWith(".css"))) {
    const text = read(`${cssDir}/${css}`);
    for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]*))\s*\)/g)) {
      const u = m[1] ?? m[2] ?? m[3];
      if (isLocal(u)) refs.push([css, u]);
    }
  }
  assert.ok(refs.length > 0, "no CSS url() references found, check the pattern");
  const bad = refs.filter(([, u]) => {
    const p = join(ROOT, posix.normalize(posix.join(cssDir, cleanPath(u))));
    return !existsSync(p) || !statSync(p).isFile() || statSync(p).size === 0;
  });
  assert.deepEqual(bad.map(([css, u]) => `${css} -> ${u}`), [], "CSS url() targets that are missing or empty");
});

// ---------- static: no orphan data file ----------

// Data files that are allowed to have no reference. Empty on purpose: entries-lite.json and
// entries-core.json are both requested by assets/js/common.js, so they need no exception.
const UNREFERENCED_OK = new Set([
  // Read only by tests/r3-accuracy-7-expiring-dates.test.mjs: the reviewed list of future dates allowed in teen text.
  "expiring-dates.json",
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) {
      if (rel !== "data/programs") out.push(...walk(rel)); // programs/*.json are read by glob in tools/
    } else out.push(rel);
  }
  return out;
}

test("every data file is referenced by a script, a page or a tool", () => {
  const sources = [
    ...jsFiles.map((f) => `assets/js/${f}`),
    ...pages,
    ...readdirSync(join(ROOT, "src")).filter((f) => f.endsWith(".html")).map((f) => `src/${f}`),
    ...readdirSync(join(ROOT, "tools")).filter((f) => f.endsWith(".py")).map((f) => `tools/${f}`),
  ];
  const corpus = sources.map(read).join("\n");
  const files = walk("data");
  assert.ok(files.length >= 10, "too few data files found, check the walk");
  const orphans = files.filter((rel) => {
    const base = rel.split("/").pop();
    return !UNREFERENCED_OK.has(base) && !corpus.includes(base);
  });
  assert.deepEqual(orphans, [], "data files nothing refers to");
});
