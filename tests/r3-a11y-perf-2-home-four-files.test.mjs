// r3-a11y-perf-2: the Home picker draws its cards from data/programs/<id>.json (about 2 KB each), not a big shared file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, type } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prog = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "programs", id + ".json"), "utf8"));

async function run(failFirst) {
  const log = [];
  let failed = null;
  const { document, window, errors } = await loadPage("index.html", {
    setup(w) {
      let inner;
      Object.defineProperty(w, "fetch", {
        configurable: true,
        get: () => inner,
        set: (f) => {
          inner = (u, o) => {
            const url = new URL(String(u), w.location.href).pathname;
            log.push(url);
            if (failFirst && /\/data\/programs\//.test(url) && !failed) {
              failed = decodeURIComponent(path.basename(url, ".json"));
              return Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("x")) });
            }
            return f(u, o);
          };
        },
      });
    },
  });
  type(window, document.getElementById("pAge"), "16");
  const cards = () => document.querySelectorAll("article.card.prog");
  for (let i = 0; i < 100 && !cards().length; i++) await tick(30);
  await tick(100);
  return { document, errors, log, failed, cards: [...cards()] };
}

test("four cards: same text as the program files, only per-program requests, under 20000 bytes", async () => {
  const { errors, log, cards } = await run(false);
  assert.ok(cards.length > 0 && cards.length <= 4, "cards: " + cards.length);
  const prog_urls = log.filter((u) => u.includes("/data/programs/"));
  assert.ok(prog_urls.length <= 4 && prog_urls.length === cards.length, "program requests: " + prog_urls.length);
  assert.ok(!log.some((u) => /entries(-blurb|-lite)?\.json/.test(u)), "no big file: " + log.join(","));
  let bytes = 0;
  prog_urls.forEach((u) => { bytes += fs.statSync(path.join(ROOT, decodeURIComponent(u).replace(/^\//, ""))).size; });
  assert.ok(bytes < 20000, "bytes " + bytes);
  cards.forEach((c, i) => {
    const id = decodeURIComponent(path.basename(prog_urls[i] || "", ".json"));
    const href = c.querySelector("a.alt").getAttribute("href");
    const pid = href.split("#p-")[1];
    const p = prog(pid);
    assert.equal(c.querySelector(".what").textContent, p.what_you_do);
    assert.equal(c.querySelector(".when").textContent, "Dates" + (p.deadline_text || "Not posted"));
    assert.ok(id);
  });
  assert.deepEqual(errors, []);
});

test("one failed program file: other cards still draw, the missing one gets a plain line", async () => {
  const { cards, failed } = await run(true);
  assert.ok(failed, "a request was failed");
  assert.ok(cards.length >= 1);
  const missing = cards.filter((c) => /could not load/.test(c.textContent));
  assert.equal(missing.length, 1);
  const ok = cards.filter((c) => c.querySelector(".when"));
  assert.equal(ok.length, cards.length - 1);
});
