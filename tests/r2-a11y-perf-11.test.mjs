// r2-a11y-perf-11: the Home picker draws its four cards from the small blurb file, never the 1.5 MB lite file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, type } from "./dom-helper.mjs";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));

test("blurb file: same ids and order as entries.json, values equal, keys limited, under 40 percent of lite", () => {
  const full = read("entries.json"), blurb = read("entries-blurb.json");
  assert.deepEqual(blurb.map((r) => r.id), full.map((r) => r.id));
  const allowed = new Set(["id", "what_you_do", "deadline_text"]);
  blurb.forEach((r, i) => {
    for (const k of Object.keys(r)) assert.ok(allowed.has(k), "unexpected key " + k);
    assert.equal(r.what_you_do, full[i].what_you_do);
    assert.equal(r.deadline_text, full[i].deadline_text);
  });
  const raw = fs.readFileSync(path.join(DATA, "entries-blurb.json"), "utf8");
  assert.ok(!raw.includes("\n ") && raw.trim().startsWith("[{"), "compact JSON");
  const ratio = fs.statSync(path.join(DATA, "entries-blurb.json")).size / fs.statSync(path.join(DATA, "entries-lite.json")).size;
  assert.ok(ratio < 0.4, "blurb is " + Math.round(ratio * 100) + " percent of lite");
});

test("home picker: four cards come from data/programs/<id>.json, the blurb and lite files are never requested", async () => {
  const log = [];
  const { document, errors } = await loadPage("index.html", {
    setup(w) {
      let inner;
      Object.defineProperty(w, "fetch", { configurable: true, get: () => inner, set: (f) => { inner = (u, o) => { log.push(String(u)); return f(u, o); }; } });
    },
  });
  type(document.defaultView, document.getElementById("pAge"), "16");
  const cards = () => document.querySelectorAll("article.card.prog");
  for (let i = 0; i < 100 && !cards().length; i++) await tick(30);
  const list = [...cards()];
  assert.ok(list.length > 0 && list.length <= 4, "cards drawn: " + list.length);
  list.forEach((c) => {
    assert.ok(c.querySelector(".what").textContent.trim().length > 0, "what_you_do shown");
    assert.match(c.querySelector(".when").textContent, /^Dates/);
  });
  assert.ok(log.some((u) => u.includes("data/programs/")), "per-program files requested");
  assert.ok(!log.some((u) => /entries-(blurb|lite)\.json/.test(u)), "no blurb or lite: " + log.join(","));
  assert.deepEqual(errors, []);
});
