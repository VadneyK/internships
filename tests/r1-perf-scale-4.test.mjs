// Home page: the card file loads first; each chosen program's own small file loads only when the picker is used (r3-a11y-perf-2).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import zlib from "node:zlib";
import { loadPage, type, tick } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const lite = JSON.parse(read("data/entries-lite.json"));
const NOW = Date.UTC(2026, 9, 9, 12);

function lib() {
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("assets/js/lib.js"), ctx);
  return ctx.TIG ? ctx.TIG.lib : ctx.window.TIG.lib;
}

// Logs every fetch URL. failLite: make the four per-program files answer with an error.
function setupFetch(urls, { failLite = false } = {}) {
  return (w) => {
    let f;
    Object.defineProperty(w, "fetch", {
      configurable: true,
      get: () => (u, o) => {
        urls.push(String(u));
        if (failLite && /data\/programs\/[^/]+\.json/.test(String(u))) return Promise.resolve({ ok: false, status: 500, json: () => Promise.reject(new Error("no")) });
        return f(u, o);
      },
      set: (v) => { f = v; },
    });
  };
}

// ready.js adds a hidden "(opens in a new tab)" note and an aria-label suffix to new-tab links after the page draws; both sides are compared without it.
const plain = (h) => h.replace(/<span class="sr" data-newtab="">[^<]*<\/span>/g, "").replace(/, opens in a new tab"/g, '"');
// Expected strings are run through the same HTML parser, so entities such as &middot; serialize the same way.
const norm = (doc, h) => { const d = doc.createElement("div"); d.innerHTML = h; return d.innerHTML; };
const waitFor = async (fn, ms = 3000) => { const t = Date.now(); while (!fn() && Date.now() - t < ms) await tick(10); };
const liteUrls = (urls) => urls.filter((u) => /data\/programs\/[^/]+\.json/.test(u));

// What the old home.js drew, built from the lite file with the same lib calls.
function oldSoon(G, L) {
  const fut = (e) => L.futureDeadline(e, Date.now());
  const soon = lite.filter((e) => fut(e) && e.deadline_confidence === "confirmed-2026-27")
    .sort((a, b) => fut(a) - fut(b) || (a.priority || 3) - (b.priority || 3)).slice(0, 8);
  return soon.map((e) => {
    const d = fut(e), n = G.daysUntil(d), u = G.safeUrl(e.url);
    const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
    return '<li><div class="d">' + mon + " " + d.getDate() + "<small>" + (n <= 0 ? "today" : n + " days") + "</small></div><div><b>" + G.esc(e.name) + '</b> <span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><br><span class="small muted">' + G.esc(e.org || "") + " &middot; " + G.esc(e.city || "") + "</span>" +
      (u ? ' <br><a href="' + G.esc(u) + '" target="_blank" rel="noopener">Official page</a>' : "") + "</div></li>";
  });
}

function oldCards(G, L, { age, hub = "", field = "" }) {
  const list = L.sortList(lite.filter((e) => L.matches(e, { place: hub, age, fields: field ? [field] : [] }, Date.now())), "best", Date.now(), { age });
  const q = new URLSearchParams();
  if (age) q.set("age", age); if (hub) q.set("at", hub); if (field) q.set("interest", field);
  const top = list.slice(0, 4);
  const html = top.map((e) => {
    const u = G.safeUrl(e.url), who = e.name + (e.org ? ", " + e.org : "");
    return '<article class="card prog"><div class="row"><span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><span class="tag ghost">' + G.esc(G.TYPES[e.type] || "") + "</span></div>" +
      "<h3>" + G.esc(e.name) + '</h3><p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p><p class=\"what\">" + G.esc(e.what_you_do || "") + "</p>" +
      '<p class="when"><b>Dates</b>' + G.esc(e.deadline_text || "Not posted") + "</p>" +
      '<div class="actions">' + (u ? '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + who) + '">Official page</a>' : "") + '<a class="btn sm alt" href="find.html?' + G.esc(q.toString()) + "#p-" + G.esc(e.id) + '" aria-label="' + G.esc("Details for " + who) + '">Details</a></div></article>';
  });
  const status = list.length === 1 ? "1 program matches. Details below." :
    list.length + " programs match. " + (list.length > top.length ? "Showing the top " + top.length + " below." : "Details below.");
  return { html, status, count: list.length };
}

test("r1-perf-scale-4: on load only the card file is requested, and it is far smaller than the lite file", async () => {
  const urls = [];
  const p = await loadPage("index.html", { now: NOW, setup: setupFetch(urls) });
  await tick(100);
  assert.deepEqual(p.errors, []);
  const data = urls.filter((u) => /\/data\/entries[^/]*\.json/.test(u) || /entries/.test(u));
  assert.equal(data.length, 1, "data requests: " + data.join(", "));
  assert.match(data[0], /data\/entries-card\.json/);
  assert.equal(liteUrls(urls).length, 0);
  assert.ok(!urls.some((u) => /entries\.json/.test(u)));
  const gz = (f) => zlib.gzipSync(fs.readFileSync(new URL("../data/" + f, import.meta.url)), { level: 9 }).length;
  assert.ok(gz("entries-card.json") < gz("entries-lite.json") * 0.4, "card file is much smaller than lite");
});

test("r1-perf-scale-4: the closing-soon list is identical to the one built from the lite file", async () => {
  const p = await loadPage("index.html", { now: NOW });
  await tick(100);
  assert.deepEqual(p.errors, []);
  const expected = oldSoon(p.window.TIG, p.window.TIG.lib);
  assert.ok(expected.length > 0, "there are closing-soon rows at the fixed date");
  assert.equal(plain(p.document.getElementById("soonList").innerHTML).replace(/ data-id="[^"]*"/g, ""), norm(p.document, expected.join("")));
  // The place list is filled from the card file and has real counts.
  assert.ok(p.document.querySelectorAll("#pHub option").length > 1);
});

test("r1-perf-scale-4: the four program files load on the first picker change, and the cards match the old output", async () => {
  const urls = [];
  const p = await loadPage("index.html", { now: NOW, setup: setupFetch(urls) });
  await tick(100);
  const G = p.window.TIG, status = p.document.getElementById("matchStatus"), box = p.document.getElementById("matches");
  const seen = [];
  new p.window.MutationObserver(() => seen.push(status.textContent)).observe(status, { childList: true, characterData: true, subtree: true });
  type(p.window, p.document.getElementById("pAge"), "15");
  assert.match(status.textContent, /loading/i, "status says matches are loading");
  assert.equal(p.document.getElementById("matchMore").hidden, false, "the See all link shows at once");
  await waitFor(() => box.children.length > 0);
  assert.equal(liteUrls(urls).length, 4);
  assert.equal(urls.filter((u) => /entries-blurb\.json|entries-lite\.json|entries\.json/.test(u)).length, 0);
  const exp = oldCards(G, G.lib, { age: "15" });
  assert.ok(exp.html.length === 4, "four cards expected");
  assert.equal(status.textContent, exp.status);
  assert.ok(seen.some((t) => /loading/i.test(t)));
  assert.equal(plain(box.innerHTML), norm(p.document, exp.html.join("")));
  assert.match(p.document.getElementById("matchMore").textContent, new RegExp("See all " + exp.count + " matches"));

  // A second change asks only for program files, never a bigger list, and draws the same way.
  const n = urls.length;
  type(p.window, p.document.getElementById("pAge"), "16");
  await tick(300);
  assert.ok(urls.slice(n).every((u) => /data\/programs\/[^/]+\.json/.test(u)), "only program files: " + urls.slice(n).join(", "));
  const exp2 = oldCards(G, G.lib, { age: "16" });
  assert.equal(status.textContent, exp2.status);
  assert.equal(plain(box.innerHTML), norm(p.document, exp2.html.join("")));
  assert.deepEqual(p.errors, []);
});

test("r1-perf-scale-4: if the program files fail, each card says so and nothing throws", async () => {
  const urls = [];
  const p = await loadPage("index.html", { now: NOW, setup: setupFetch(urls, { failLite: true }) });
  await tick(100);
  type(p.window, p.document.getElementById("pAge"), "15");
  const status = p.document.getElementById("matchStatus");
  await waitFor(() => /could not load/i.test(p.document.getElementById("matches").textContent));
  assert.match(p.document.getElementById("matches").textContent, /details could not load for this one/i);
  assert.equal(p.document.getElementById("matches").children.length, 4);
  assert.equal(p.document.getElementById("matchMore").hidden, false);
  assert.deepEqual(p.errors, []);
  assert.ok(p.document.getElementById("soonList").children.length > 0, "closing-soon list is still there");
});

test("r1-perf-scale-4: an empty result never fetches the lite file", async () => {
  const urls = [];
  const p = await loadPage("index.html", { now: NOW, setup: setupFetch(urls) });
  await tick(100);
  p.window.TIG.lib.matches = () => false;
  type(p.window, p.document.getElementById("pAge"), "15");
  await tick(60);
  assert.ok(p.document.querySelector("#matches .empty"));
  assert.equal(liteUrls(urls).length, 0);
});
