// The Ages 12 to 14 page loads a small core file instead of the lite program file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadPage, tick } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const full = JSON.parse(read("data/entries.json"));
const core = JSON.parse(read("data/entries-core.json"));
const lite = JSON.parse(read("data/entries-lite.json"));
const KEYS = ["id", "min_age", "max_age", "status", "deadline_iso", "opens_iso", "regions", "season"];

test("core file has the same ids in the same order and only the allowed keys", () => {
  assert.deepEqual(core.map((e) => e.id), full.map((e) => e.id));
  core.forEach((e, i) => {
    Object.keys(e).forEach((k) => assert.ok(KEYS.includes(k), e.id + " has extra key " + k));
    KEYS.forEach((k) => { if (k in full[i]) assert.deepEqual(e[k], full[i][k], e.id + "." + k); else assert.ok(!(k in e)); });
  });
});

test("core file is compact JSON under 20 percent of entries.json", () => {
  const raw = read("data/entries-core.json");
  assert.equal(JSON.stringify(JSON.parse(raw)), raw.trim(), "compact JSON");
  const ratio = Buffer.byteLength(raw) / Buffer.byteLength(read("data/entries.json"));
  assert.ok(ratio < 0.2, "core is " + Math.round(ratio * 100) + " percent of entries.json");
});

test("common.js loads and caches the core file; younger.js never mentions the lite file", () => {
  const common = read("assets/js/common.js");
  assert.match(common, /data\/entries-core\.json/);
  assert.match(common, /coreCache/);
  assert.match(common, /data\/entries-lite\.json/);
  assert.match(common, /data\/entries\.json/);
  const y = read("assets/js/younger.js");
  assert.match(y, /G\.loadEntries\("core"\)/);
  assert.doesNotMatch(y, /lite|entries\.json|loadEntries\(true\)/);
});

test("younger page: #n13 matches lib.js over the lite file and no big file is requested", async () => {
  const NOW = Date.UTC(2026, 9, 9, 12);
  const urls = [];
  const p = await loadPage("younger.html", {
    now: NOW,
    setup(w) { // the helper assigns w.fetch after setup, so log through a setter
      let f; Object.defineProperty(w, "fetch", { configurable: true, get: () => (u, o) => { urls.push(String(u)); return f(u, o); }, set: (v) => { f = v; } });
    },
  });
  await tick(200);
  assert.deepEqual(p.errors, []);
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("assets/js/lib.js"), ctx);
  const L = ctx.TIG ? ctx.TIG.lib : ctx.window.TIG.lib;
  const expected = lite.filter((e) => L.matches(e, { age: "13" }, NOW) && e.min_age != null && e.min_age <= 13).length;
  assert.ok(expected > 20);
  assert.equal(Number(p.document.getElementById("n13").textContent), expected);
  assert.ok(urls.some((u) => /entries-core\.json/.test(u)), "core file requested");
  assert.ok(!urls.some((u) => /entries-lite\.json|entries\.json/.test(u)), "no big file requested: " + urls.join(", "));
});
