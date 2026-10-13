// Programs filter panel as a short flow (2026-10-12: Programs filters redesign).
// A summary bar of the current picks (each chip jumps to its filter), the shared place search box above the region tiles,
// popular areas folded into Where, compact pill rows for age, timing and season, and a phone bar "Show N programs".
// The real selects and chips stay the source of truth. Every wait polls for a condition instead of sleeping a fixed time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage } from "./dom-helper.mjs";

const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

async function until(fn, what, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    let v;
    try { v = fn(); } catch (e) { v = false; }
    if (v) return v;
    if (Date.now() > end) assert.fail("timed out waiting for " + what);
    await new Promise((r) => setTimeout(r, 25));
  }
}
async function findPage(opts) {
  const page = await loadPage("find.html", opts);
  const d = page.document;
  await until(() => /of \d+ programs/.test(d.getElementById("count").textContent) && d.querySelector("#place + .tp .tile") && d.getElementById("placeQ"), "the list, the place tiles and the place search");
  return page;
}
const count = (d) => +/^(\d+) of (\d+)/.exec(d.getElementById("count").textContent)[1];
const total = (d) => +/^(\d+) of (\d+)/.exec(d.getElementById("count").textContent)[2];
const chips = (d) => [...d.querySelectorAll("#fsum .fchip")];
const chipTexts = (d) => chips(d).map((b) => b.textContent);
const chipOf = (d, k) => chips(d).find((b) => b.getAttribute("data-fs") === k);
const q = (d) => d.getElementById("placeQ");
const typeIn = (w, d, text) => { const i = q(d); i.focus(); i.value = text; i.dispatchEvent(new w.Event("input", { bubbles: true })); };
const key = (w, d, k) => { const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); q(d).dispatchEvent(e); return e; };
const groupTiles = (d) => [...d.querySelectorAll("#place + .tp .tp-row > .tile[aria-expanded]")];
const subTiles = (d) => [...d.querySelectorAll("#place + .tp .tp-sub:not([hidden]) .tile")];

test("find flow: the summary bar shows the picks from the address, as chips", async () => {
  const { window, document, errors } = await findPage({ search: "?age=15&kind=pre-college&at=city:boston" });
  assert.deepEqual(chipTexts(document), ["15", "Boston", "College classes", "Any time"]);
  assert.deepEqual(chips(document).map((b) => b.getAttribute("data-fs")), ["age", "where", "goal", "when"]);
  assert.deepEqual(chips(document).map((b) => b.classList.contains("on")), [true, true, true, false], "a chosen pick is filled, an open one is not");
  // every chip is a real button whose name starts with what it shows
  for (const b of chips(document)) {
    assert.equal(b.tagName, "BUTTON"); assert.equal(b.type, "button");
    assert.ok(b.getAttribute("aria-label").toLowerCase().startsWith(b.textContent.toLowerCase()), b.getAttribute("aria-label"));
  }
  const filtered = count(document);
  assert.ok(filtered > 0 && filtered < total(document), "the picks narrow the list: " + filtered + " of " + total(document));
  assert.equal(document.getElementById("reset").hidden, false, "Clear all shows when something is picked");
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: the summary follows every change, and Clear all puts the count back up", async () => {
  const { window, document, errors } = await findPage();
  assert.deepEqual(chipTexts(document), ["Any age", "Anywhere", "Any goal", "Any time"]);
  assert.equal(document.getElementById("reset").hidden, true, "nothing picked, nothing to clear");
  const all = count(document);
  [...document.querySelectorAll("#age + .tp .tile")].find((b) => b.textContent === "16").click();
  [...document.querySelectorAll("#when + .tp .tile")].find((b) => /Open or opening soon/.test(b.textContent)).click();
  [...document.querySelectorAll("#season + .tp .tile")].find((b) => b.textContent === "Summer").click();
  document.querySelector('#goalChips [data-goal="research"]').click();
  document.getElementById("onlyVerified").click();
  await until(() => chipTexts(document).includes("Research"), "the goal chip");
  assert.deepEqual(chipTexts(document), ["16", "Anywhere", "Research", "Open or opening soon", "Summer", "Checked on the official site"]);
  assert.ok(count(document) < all);
  assert.match(window.location.search, /age=16/);
  document.getElementById("reset").focus();
  document.getElementById("reset").click();
  await until(() => count(document) === all, "the count to go back up");
  assert.ok(document.activeElement.classList.contains("fchip"), "focus moves to the first summary chip, not to the page, when Clear all hides itself");
  assert.deepEqual(chipTexts(document), ["Any age", "Anywhere", "Any goal", "Any time"]);
  assert.equal(document.getElementById("reset").hidden, true);
  assert.equal(window.location.search, "");
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: the shared place search picks Boston and sets what the region tiles set", async () => {
  const a = await findPage();
  const { window, document, errors } = a;
  assert.equal(q(document).getAttribute("role"), "combobox");
  assert.equal(q(document).getAttribute("placeholder"), "Type your city or state");
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  assert.equal(q(document).getAttribute("aria-controls"), "placeList");
  assert.ok(q(document).compareDocumentPosition(document.querySelector("#place + .tp")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "the search box sits above the region tiles");
  typeIn(window, document, "bos");
  assert.ok([...document.querySelectorAll("#placeList [role=option]")].some((o) => o.textContent.startsWith("Boston")), "Boston is an option");
  assert.equal(q(document).getAttribute("aria-expanded"), "true");
  const e = key(window, document, "Enter");
  assert.equal(e.defaultPrevented, true, "Enter never submits the form");
  assert.equal(document.getElementById("place").value, "city:boston");
  assert.equal(q(document).value, "", "the box is cleared after a pick");
  await until(() => /Boston/.test(document.getElementById("placeNote").textContent), "the place note");
  const bySearch = { n: count(document), url: window.location.search, chips: chipTexts(document), note: document.getElementById("placeNote").textContent, prefs: window.localStorage.getItem("findprefs") };
  assert.match(bySearch.url, /at=city%3Aboston/);
  assert.equal(bySearch.chips[1], "Boston");
  assert.deepEqual(errors, []);
  window.close();
  // the old way: the part of the country tile, then the city tile
  const b = await findPage();
  groupTiles(b.document).find((t) => t.textContent === "Northeast").click();
  const bos = await until(() => subTiles(b.document).find((t) => /^Boston\b/.test(t.textContent)), "the Boston tile");
  bos.click();
  await until(() => /Boston/.test(b.document.getElementById("placeNote").textContent), "the place note");
  assert.equal(b.document.getElementById("place").value, "city:boston");
  assert.equal(count(b.document), bySearch.n);
  assert.equal(b.window.location.search, bySearch.url);
  assert.deepEqual(chipTexts(b.document), bySearch.chips);
  assert.equal(b.document.getElementById("placeNote").textContent, bySearch.note);
  assert.equal(b.window.localStorage.getItem("findprefs"), bySearch.prefs);
  assert.deepEqual(b.errors, []);
  b.window.close();
});

test("find flow: the search box keys work, and a place that is not there says so", async () => {
  const { window, document, errors } = await findPage();
  typeIn(window, document, "ca");
  const n = document.querySelectorAll("#placeList [role=option]").length;
  assert.ok(n >= 3 && n <= 8, "a short list, got " + n);
  key(window, document, "ArrowUp");
  assert.equal(q(document).getAttribute("aria-activedescendant"), "placeOpt" + (n - 1), "ArrowUp wraps to the last match");
  key(window, document, "Escape");
  assert.equal(q(document).getAttribute("aria-expanded"), "false");
  assert.equal(q(document).value, "ca");
  key(window, document, "Escape");
  assert.equal(q(document).value, "");
  typeIn(window, document, "seattle");
  document.querySelector("#placeList [role=option]").click();
  assert.equal(document.getElementById("place").value, "city:seattle");
  typeIn(window, document, "zzzzqq");
  assert.match(document.getElementById("placeNone").textContent, /No place called/);
  assert.equal(q(document).getAttribute("aria-describedby"), "placeNone");
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: popular areas sit inside Where, show with Anywhere, and every area is still reachable", async () => {
  const { window, document, errors } = await findPage();
  const where = document.getElementById("hubChips").closest(".fgroup");
  assert.ok(where.contains(document.getElementById("place")), "the popular areas are inside the Where group");
  assert.ok(document.getElementById("place").compareDocumentPosition(document.getElementById("hubChips")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "they come after the region tiles");
  assert.equal(document.getElementById("l-hub").textContent, "Or tap a popular area");
  const hubs = [...document.querySelectorAll("#hubChips .chip")];
  assert.ok(hubs.length >= 8, "area chips: " + hubs.length);
  assert.equal(document.getElementById("hubGroup").hidden, false, "shown with Anywhere");
  const oak = hubs.find((b) => b.getAttribute("data-val") === "oak");
  oak.click();
  await until(() => chipOf(document, "where").textContent !== "Anywhere", "the Where chip");
  assert.match(window.location.search, /where=oak/);
  assert.equal(chipOf(document, "where").classList.contains("on"), true);
  assert.equal(oak.getAttribute("aria-pressed"), "true");
  // a city hides the area chips and clears them; Anywhere brings them back
  typeIn(window, document, "davis"); key(window, document, "Enter");
  await until(() => document.getElementById("place").value === "city:davis", "the city");
  assert.equal(document.getElementById("hubGroup").hidden, true);
  assert.equal(document.querySelectorAll("#hubChips .chip[aria-pressed=true]").length, 0);
  [...document.querySelectorAll("#place + .tp .tp-row > .tile")].find((b) => b.textContent.trim() === "Anywhere").click();
  assert.equal(document.getElementById("hubGroup").hidden, false);
  assert.deepEqual(errors, []);
  window.close();
  // a link with ?where= still lands on the area
  const b = await findPage({ search: "?where=oak,sf" });
  assert.deepEqual([...b.document.querySelectorAll("#hubChips .chip[aria-pressed=true]")].map((x) => x.getAttribute("data-val")), ["oak", "sf"]);
  assert.match(chipOf(b.document, "where").textContent, /\S/);
  assert.notEqual(chipOf(b.document, "where").textContent, "Anywhere");
  b.window.close();
});

test("find flow: tapping a summary chip moves focus to that filter and opens More filters when it lives there", async () => {
  const { window, document, errors } = await findPage({ search: "?age=15&when=open&interest=health" });
  const box = document.getElementById("moreFilters");
  assert.equal(box.open, true, "More filters opens for a filter in the address");
  assert.match(box.querySelector("summary").textContent, /\(1 on\)/);
  box.open = false;
  const field = chipOf(document, "interest");
  assert.ok(field, "an interest chip: " + chipTexts(document));
  field.click();
  assert.equal(box.open, true, "a chip for a hidden filter opens More filters");
  assert.equal(document.activeElement.closest("#fieldChips") && document.activeElement.getAttribute("aria-pressed"), "true", "focus lands on the chosen interest");
  chipOf(document, "age").click();
  assert.ok(document.activeElement.closest("#age + .tp"), "age chip focuses the age tiles");
  assert.equal(document.activeElement.textContent, "15");
  chipOf(document, "where").click();
  assert.equal(document.activeElement, q(document), "the Where chip focuses the place search");
  chipOf(document, "when").click();
  assert.ok(document.activeElement.closest("#when + .tp"));
  chipOf(document, "goal").click();
  assert.ok(document.activeElement.closest("#goalChips"));
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: the phone bar says Show N programs for the same N as the count, and scrolls to the results area", async () => {
  const { window, document, errors } = await findPage();
  const bar = document.getElementById("showBar"), btn = document.getElementById("showBtn");
  assert.ok(bar && btn && btn.tagName === "BUTTON" && btn.type === "button");
  assert.equal(bar.hidden, false);
  assert.equal(btn.textContent, "Show " + count(document) + " programs");
  assert.ok(!bar.querySelector("[aria-live], [role=status]"), "no extra live region");
  [...document.querySelectorAll("#age + .tp .tile")].find((b) => b.textContent === "14").click();
  await until(() => btn.textContent === "Show " + count(document) + " programs" && count(document) < total(document), "the bar to follow the count");
  document.getElementById("q").value = "zzzzqqxx"; document.getElementById("q").dispatchEvent(new window.Event("input", { bubbles: true }));
  await until(() => count(document) === 0, "an empty list");
  assert.equal(btn.textContent, "Show 0 programs");
  document.getElementById("reset").click();
  await until(() => count(document) === total(document), "everything back");
  let hit = null;
  window.HTMLElement.prototype.scrollIntoView = function () { hit = this.id; };
  btn.click();
  assert.equal(hit, "count", "the bar scrolls to the count line that starts the results");
  assert.equal(document.activeElement.id, "count", "and focus goes there, as it does for Search Enter");
  assert.ok(bar.closest("main") || bar.closest("body"));
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: one place search in common.js, used by Home and Programs", async () => {
  const common = read("assets/js/common.js"), home = read("assets/js/home.js"), find = read("assets/js/find.js");
  assert.equal(common.match(/G\.placeSearch = function/g).length, 1, "one definition");
  assert.equal(common.match(/"combobox"/g).length, 1, "the combobox role is set in one place");
  for (const [name, js] of [["home.js", home], ["find.js", find]]) {
    assert.match(js, /G\.placeSearch\(/, name + " uses the shared component");
    assert.doesNotMatch(js, /"combobox"|aria-autocomplete|combo-opt|function findPlaces/, name + " has its own combobox code");
  }
  const h = await loadPage("index.html");
  await until(() => h.document.getElementById("pHubQ") && h.document.getElementById("pHub").options.length > 2, "the home search box");
  const f = await findPage();
  for (const [d, id] of [[h.document, "pHubQ"], [f.document, "placeQ"]]) {
    const i = d.getElementById(id);
    assert.equal(i.getAttribute("role"), "combobox");
    assert.equal(i.parentNode.className, "combo");
    assert.equal(i.getAttribute("autocomplete"), "off");
    assert.equal(i.getAttribute("enterkeyhint"), "search");
  }
  assert.deepEqual(h.errors, []); assert.deepEqual(f.errors, []);
  h.window.close(); f.window.close();
});

test("find flow: age, timing and season are compact pill rows, grouped under When, and nothing stretches", async () => {
  const html = read("src/find.html"), css = read("assets/css/style.css");
  assert.match(html, /<span class="lbl" id="l-when">When<\/span>/);
  for (const t of ["My age", "Timing", "Season"]) assert.match(html, new RegExp(">" + t + "</label>"), t + " label text kept");
  assert.match(css, /\.frow \{[^}]*grid-template-columns/);
  // 2026-10-13 ux9-pills: the three selectors became the shared .fpill class (find.html's groups carry it).
  assert.match(css, /\.fpill \.tp \.tile \{[^}]*border-radius: 999px/);
  assert.match(css, /\.fpill \.tp \.tile \{[^}]*min-height: 2\.75rem/);
  const { window, document, errors } = await findPage();
  assert.equal(document.querySelectorAll("#age + .tp .tile").length, 8);
  assert.equal(document.querySelectorAll("#when + .tp .tile").length, 5);
  assert.equal(document.querySelectorAll("#season + .tp .tile").length, 7);
  assert.equal(document.getElementById("moreFilters").open, false, "More filters stays closed");
  assert.equal(document.querySelector("#moreFilters summary").textContent, "More filters: pay, kind, interest");
  assert.deepEqual(errors, []);
  window.close();
});

test("find flow: the phone bar CSS respects the safe area, adds room at the end of the page, and keeps the look rules", () => {
  const css = read("assets/css/style.css");
  const at = css.indexOf("/* 2026-10-12: Programs filters redesign");
  assert.ok(at > -1, "the new block is marked");
  const mine = css.slice(at);
  const phone = /@media \(max-width: 47\.99rem\) \{([\s\S]*?)\n\}/.exec(mine);
  assert.ok(phone, "a rule block for widths under 48rem");
  assert.match(phone[1], /\.showbar \{[^}]*position: fixed/);
  assert.match(phone[1], /\.showbar \{[^}]*env\(safe-area-inset-bottom/);
  assert.match(phone[1], /\.showbar \{[^}]*env\(safe-area-inset-left/);
  assert.match(phone[1], /body\.has-showbar \{[^}]*padding-bottom: calc\([^)]*env\(safe-area-inset-bottom/);
  assert.match(phone[1], /body\.has-showbar \.toast \{[^}]*bottom: calc\(/, "the toast stays above the bar");
  assert.match(mine, /\.showbar \{ display: none; \}/, "not shown on wide screens");
  assert.match(mine, /\.fchip \{[^}]*min-height: 2\.75rem/);
  assert.match(css, /@media \(forced-colors: active\) \{[^@]*\.fchip\.on \{ forced-color-adjust: none; background: Highlight; color: HighlightText; \}/, "the summary chip keeps its fill when colors are forced");
  assert.match(css, /:focus-visible/, "the page keeps its focus ring");
  assert.doesNotMatch(mine, /outline:\s*(none|0)\b/, "the new rules never remove the focus ring");
  assert.doesNotMatch(mine, /#[0-9a-fA-F]{3,6}\b/, "tokens only, no hard colors");
  assert.doesNotMatch(mine, /rgba?\(/);
});

test("find flow: the new code sends nothing out and avoids long dashes", () => {
  for (const f of ["assets/js/common.js", "assets/js/find.js", "assets/js/home.js", "assets/css/style.css", "src/find.html", "tests/find-flow-1.test.mjs"]) {
    const t = read(f);
    assert.equal(new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]").test(t), false, f + " has a long dash");
  }
  const js = read("assets/js/common.js") + read("assets/js/find.js");
  assert.doesNotMatch(js, /XMLHttpRequest|sendBeacon|WebSocket|importScripts/);
});
