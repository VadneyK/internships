// Numbers page: loads the trimmed stats file, never the card file, and shows the same numbers as L.insights on the full data.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));
const full = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));

test("insights.html requests entries-stats.json and not entries-card.json", async () => {
  const seen = [];
  const { window } = await loadPage("insights.html", {
    setup(w) {
      let real;
      Object.defineProperty(w, "fetch", { configurable: true, get() { return real && ((u, o) => { seen.push(String(u)); return real(u, o); }); }, set(v) { real = v; } });
    },
  });
  await new Promise((r) => setTimeout(r, 600));
  const doc = window.document;
  assert.ok(seen.some((u) => /entries-stats\.json/.test(u)));
  assert.ok(!seen.some((u) => /entries-card\.json/.test(u)));

  const d = L.insights(full, Date.now());
  const stats = [...doc.querySelectorAll("#topStats .stat b")].map((b) => b.textContent);
  assert.deepEqual(stats, [String(d.total), String(d.facts.free), String(d.facts.noPermit)]);

  const rowsOf = (id) => [...doc.querySelectorAll("#" + id + " .crow")].map((r) => [r.querySelector(".cl").textContent, r.querySelector(".cn").textContent]);
  const want = (items) => items.map((i) => [i.label, String(i.n)]);
  assert.deepEqual(rowsOf("chartStatus"), want(d.status));
  assert.deepEqual(rowsOf("chartTypes"), want(d.types));
  assert.deepEqual(rowsOf("chartFields"), want(d.fields));
  assert.deepEqual(rowsOf("chartSeason"), want(d.seasons.filter((s) => s.n)));
  assert.deepEqual(rowsOf("chartHubs"), want(d.hubs));
  assert.deepEqual([...doc.querySelectorAll("#chartAge .ccol")].map((a) => a.getAttribute("aria-label")), d.ages.map((a) => "Age " + a.age + ": " + a.n + " programs, " + a.paid + " paid"));
  window.close();
});
