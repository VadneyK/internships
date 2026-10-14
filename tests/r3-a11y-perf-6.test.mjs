// r3-a11y-perf-6: find.html reads every key in data/entries-lite.json, and duration, pay_detail and verified_on stay out of it.
// The long text rows (duration, pay_detail) come with the detail file, and the card shows no empty label before that.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, type, tick } from "./dom-helper.mjs";

const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url), "utf8"));
const full = read("data/entries.json");
const lite = read("data/entries-lite.json");
const detail = read("data/entries-detail.json");
const byFull = new Map(full.map((e) => [e.id, e]));

test("duration, pay_detail and verified_on are absent from lite; duration and pay_detail are in detail for every id", () => {
  lite.forEach((e) => ["duration", "pay_detail", "verified_on"].forEach((k) => assert.ok(!(k in e), e.id + " still has " + k)));
  assert.equal(detail.length, full.length);
  detail.forEach((d) => {
    const f = byFull.get(d.id);
    ["duration", "pay_detail"].forEach((k) => {
      assert.equal(k in d, k in f, d.id + " presence of " + k);
      if (k in f) assert.equal(d[k], f[k], d.id + "." + k);
    });
  });
});

test("every key present in the lite file is read by find.js or lib.js during load, render and a search", async () => {
  const read = new Set();
  const liteKeys = new Set();
  lite.forEach((e) => Object.keys(e).forEach((k) => liteKeys.add(k)));
  const setup = (w) => {
    let real;
    Object.defineProperty(w, "fetch", {
      configurable: true,
      get() {
        return (u, o) => {
          if (!/data\/entries-lite\.json/.test(String(u))) return real(u, o);
          return real(u, o).then((r) => ({
            ok: r.ok, status: r.status,
            json: () => r.json().then((rows) => rows.map((row) => new Proxy(row, {
              get(t, k) { if (typeof k === "string") read.add(k); return t[k]; },
              has(t, k) { if (typeof k === "string") read.add(k); return k in t; },
            }))),
          }));
        };
      },
      set(f) { real = f; },
    });
  };
  const { window, document, errors } = await loadPage("find.html", { setup });
  await tick(150);
  type(window, document.getElementById("age"), "16"); // an age turns on "Good fit for you", which reads "limited"
  await tick(150);
  type(window, document.getElementById("q"), "summer");
  await tick(400);
  type(window, document.getElementById("q"), "");
  const season = document.getElementById("season");
  if (season && season.options.length > 1) type(window, season, season.options[1].value);
  await tick(200);
  assert.deepEqual(errors, []);
  const unread = [...liteKeys].filter((k) => !read.has(k)).sort();
  assert.deepEqual(unread, [], "keys in lite that no script read: " + unread.join(", "));
  window.close();
});

test("before the detail file loads a card has no How long or Pay or cost label; after it loads both show with the same text as before", async () => {
  const slow = [];
  const setup = (w) => {
    let real;
    Object.defineProperty(w, "fetch", {
      configurable: true,
      get() {
        return (u, o) => {
          if (!/data\/entries-detail\.json/.test(String(u))) return real(u, o);
          return new Promise((res, rej) => slow.push(() => real(u, o).then(res, rej)));
        };
      },
      set(f) { real = f; },
    });
  };
  const { window, document, errors } = await loadPage("find.html", { setup });
  await tick(150);
  const card = document.querySelector("article.prog");
  assert.ok(card);
  const id = card.id.slice(2);
  const f = byFull.get(id);
  card.querySelector("details").open = true;
  card.querySelector("details").dispatchEvent(new window.Event("toggle", { bubbles: true }));
  await tick(100);
  assert.ok(!/How long|Pay or cost/.test(card.textContent), "no empty labels before the detail file");
  assert.equal(card.querySelector(".pay"), null);
  const paidTag = (document.querySelector("article.prog .tag") || {}).textContent;
  assert.ok(paidTag !== undefined);
  slow.splice(0).forEach((go) => go());
  await tick(500);
  const after = document.getElementById("p-" + id);
  if (f.duration) assert.ok(after.textContent.includes("How long") && after.textContent.includes(f.duration), "How long row");
  if (f.pay_detail) {
    const pay = after.querySelector(".pay");
    assert.ok(pay && pay.textContent.includes("Pay or cost") && pay.textContent.includes(f.pay_detail), "Pay or cost row");
  }
  assert.deepEqual(errors, []);
  window.close();
});

test("paid and unpaid tags come from paid_type in lite, before and after the detail file", async () => {
  const { window, document } = await loadPage("find.html");
  await tick(100);
  const check = () => {
    const cards = [...document.querySelectorAll("article.prog")].slice(0, 30);
    assert.ok(cards.length);
    cards.forEach((c) => {
      const f = byFull.get(c.id.slice(2));
      const tags = [...c.querySelectorAll(".row .tag")].map((t) => t.textContent);
      const want = {
        paid: "Paid", unpaid: "Unpaid",
      }[f.paid_type];
      if (want) assert.ok(tags.some((t) => t.toLowerCase().includes(want.toLowerCase())), f.id + " tags " + tags.join("|") + " for " + f.paid_type);
    });
  };
  check();
  document.querySelector("article.prog details").open = true;
  await tick(1200);
  check();
  window.close();
});
