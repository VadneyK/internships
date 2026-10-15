// Map page (map.html, 2026-10-15): loads the real page with its scripts in jsdom.
// One dot per city in data/map.json; the filters change which dots are lit; a dot opens a panel of links to the Programs page;
// the list under the map holds every program; Near me keeps the location out of the address, storage, cookies and requests;
// reduced motion turns the grow-in, the zoom tween and the pulse off.
// Run with: node --test tests/map.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data/map.json"), "utf8"));
const ENTRIES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const CITIES = MAP.points.concat(MAP.bc);
// A spot a few hundred feet from the Oakland, CA point. Its digits showing up anywhere means the location leaked.
const OAK = CITIES.find((c) => c.k === "Oakland, CA");
const LAT = OAK.lat + 0.0021, LON = OAK.lon - 0.0017;
const LEAK = new RegExp(LAT.toFixed(3).replace(".", "\\.") + "|" + LON.toFixed(3).replace(".", "\\."));

function reduced(on) {
  return (w) => {
    w.matchMedia = (q) => ({ matches: on && /prefers-reduced-motion:\s*reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  };
}
async function open(opts = {}) {
  const p = await loadPage("map.html", opts);
  const ok = await waitFor(() => p.document.querySelectorAll("#mapBox circle.dot").length > 0 && /places on the map/.test(p.document.getElementById("mCount").textContent));
  assert.ok(ok, "the map did not draw: " + p.document.getElementById("mCount").textContent + " " + p.errors.join(" | "));
  return p;
}
const lit = (d) => d.querySelectorAll("#mapBox circle.dot:not(.off)").length;

test("map.html draws one dot per city in data/map.json, under a map hidden from screen readers", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document;
  assert.equal(d.querySelectorAll("#mapBox circle.dot").length, CITIES.length);
  assert.equal(lit(d), CITIES.length, "with no filter every dot is lit");
  assert.equal(d.getElementById("mapBox").getAttribute("aria-hidden"), "true");
  assert.equal(d.querySelectorAll("#mapBox a, #mapBox button, #mapBox [tabindex]").length, 0, "nothing inside the hidden map can take focus");
  assert.equal(d.querySelectorAll("#mapBox path.st").length, 51);
  const cards = CITIES.reduce((a, c) => a + c.ids.length, 0);
  assert.match(d.getElementById("mCount").textContent, new RegExp(cards.toLocaleString("en-US") + " programs in " + CITIES.length + " places"));
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("a filter changes how many dots are lit and the count line; turning it off brings them back", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, before = lit(d), text = d.getElementById("mCount").textContent;
  d.getElementById("mOpen").click();
  await tick(30);
  assert.equal(d.getElementById("mOpen").getAttribute("aria-pressed"), "true");
  const nOpen = lit(d);
  assert.ok(nOpen > 0 && nOpen < before, "Open now or soon should light fewer dots, got " + nOpen + " of " + before);
  assert.notEqual(d.getElementById("mCount").textContent, text);
  d.getElementById("mPaid").click();
  await tick(30);
  assert.ok(lit(d) <= nOpen);
  const age = d.getElementById("mAge");
  age.value = "12"; age.dispatchEvent(new p.window.Event("change", { bubbles: true }));
  await tick(30);
  assert.ok(lit(d) < before);
  d.getElementById("mOpen").click(); d.getElementById("mPaid").click();
  age.value = ""; age.dispatchEvent(new p.window.Event("change", { bubbles: true }));
  await tick(30);
  assert.equal(lit(d), before);
  p.window.close();
});

test("a dot click opens the city panel with one link per program to find.html#p-<id>", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, city = CITIES.find((c) => c.k === "Oakland, CA");
  const dot = [...d.querySelectorAll("#mapBox circle.dot")].find((c) => +c.getAttribute("cx") === city.x && +c.getAttribute("cy") === city.y);
  assert.ok(dot, "no dot at Oakland's x and y");
  dot.dispatchEvent(new p.window.MouseEvent("click", { bubbles: true }));
  await tick(30);
  const panel = d.getElementById("mPanel");
  assert.equal(panel.hidden, false);
  assert.equal(d.getElementById("mPanelH").textContent, "Oakland, CA");
  assert.equal(d.activeElement, d.getElementById("mPanelH"), "focus moves to the panel heading");
  const hrefs = [...panel.querySelectorAll("#mPanelList a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs.slice().sort(), city.ids.map((id) => "find.html#p-" + id).sort());
  assert.equal(panel.querySelectorAll("#mPanelList .tag").length, city.ids.length, "every program has a status tag");
  assert.ok(dot.classList.contains("sel"));
  d.getElementById("mPanelX").click();
  assert.equal(panel.hidden, true);
  assert.ok(!dot.classList.contains("sel"));
  p.window.close();
});

test("the list under the map holds every program exactly once, by state, city, Anywhere in the state, online, national and several places", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document;
  const groups = [...d.querySelectorAll("#mListBox details.mstate")];
  for (const g of groups) g.open = true;
  // the list fills a state when it opens (toggle); a print fills them all, so use that path
  p.window.dispatchEvent(new p.window.Event("beforeprint"));
  await tick(30);
  const ids = [...d.querySelectorAll("#mListBox a[href^='find.html#p-']")].map((a) => a.getAttribute("href").slice("find.html#p-".length));
  assert.equal(ids.length, ENTRIES.length, "one link per program");
  assert.deepEqual(ids.slice().sort(), ENTRIES.map((e) => e.id).sort());
  const names = groups.map((g) => g.querySelector("summary b").textContent);
  assert.ok(names.includes("California") && names.includes("British Columbia") && names.includes("Online") && names.includes("Across the US") && names.includes("In more than one place"), names.join(", "));
  assert.ok([...d.querySelectorAll("#mListBox h3")].some((h) => /^Anywhere in California/.test(h.textContent)));
  p.window.close();
});

test("Near me: the location is used for the nearest list and never reaches the address, storage, cookies or a request", async () => {
  const fetchLog = [];
  const p = await open({
    fetchLog,
    setup(w) {
      reduced(true)(w);
      Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(ok) { setTimeout(() => ok({ coords: { latitude: LAT, longitude: LON, accuracy: 20 } }), 5); } } });
    },
  });
  const d = p.document, w = p.window, nFetch = fetchLog.length;
  assert.match(d.getElementById("mNearNote").textContent, /not saved or sent/);
  d.getElementById("mNear").click();
  assert.ok(await waitFor(() => !d.getElementById("mNearBox").hidden), "the nearest list did not show");
  const rows = [...d.querySelectorAll("#mNearList li")];
  assert.equal(rows.length, 10);
  assert.match(rows[0].textContent, /^Oakland, CA/);
  await tick(50);
  const leak = (s) => LEAK.test(String(s || ""));
  assert.ok(!leak(w.location.href), "location in the address");
  for (const st of [w.localStorage, w.sessionStorage]) for (let i = 0; i < st.length; i++) assert.ok(!leak(st.getItem(st.key(i))), "location in storage: " + st.key(i));
  assert.ok(!leak(d.cookie), "location in a cookie");
  assert.equal(fetchLog.length, nFetch, "Near me made a request");
  for (const r of fetchLog) assert.ok(!leak(r.url) && !leak(r.init && r.init.body), "location in a request: " + r.url);
  // picking a city from the list opens its panel
  rows[1].querySelector("button").click();
  await tick(20);
  assert.equal(d.getElementById("mPanel").hidden, false);
  p.window.close();
});

test("Near me without location access, or when it is refused, says what to do instead", async () => {
  const p = await open({ setup(w) { reduced(true)(w); Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(ok, fail) { fail({ code: 1 }); } } }); } });
  p.document.getElementById("mNear").click();
  await tick(20);
  assert.match(p.document.getElementById("mNearStatus").textContent, /Type your city/);
  p.window.close();
});

test("a typed city opens its panel and lists the closest cities; a typed state lists its biggest cities", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, w = p.window, q = d.getElementById("mCityQ");
  assert.ok(q, "the place search box is there");
  q.value = "Oakl"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.match(d.querySelector("#mCityList li").textContent, /^Oakland, CA/);
  q.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await tick(30);
  assert.equal(d.getElementById("mPanelH").textContent, "Oakland, CA");
  assert.ok(![...d.querySelectorAll("#mNearList li")].some((li) => /^Oakland, CA/.test(li.textContent)), "the city is not in its own closest list");
  assert.match(d.querySelector("#mNearList li").textContent, /, CA\d+ programs?, (less than 1 mile|about \d+ miles?)$/);
  assert.equal(d.activeElement, d.getElementById("mPanelH"), "focus goes to the city's own panel");
  assert.ok(+d.querySelector("#mapBox svg").getAttribute("viewBox").split(" ")[2] < 975, "the map zooms to the city");
  q.value = "Texas"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  q.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await tick(30);
  assert.match(d.getElementById("mNearWhy").textContent, /Texas/);
  assert.ok([...d.querySelectorAll("#mNearList li")].every((li) => /, TX\d/.test(li.textContent)));
  assert.equal(d.getElementById("mNearH").textContent, "Cities in Texas");
  assert.equal(d.activeElement, d.getElementById("mNearH"));
  assert.equal(d.getElementById("mPanel").hidden, true, "a state closes the city panel");
  assert.ok(!/[?&](lat|lon|at)=/.test(w.location.href));
  p.window.close();
});

test("zoom buttons: every region from lib.js zooms the map, and Whole map comes back", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, svg = d.querySelector("#mapBox svg");
  for (const v of ["ca", "bay", "socal", "pnw", "tx", "mw", "ne", "se"]) {
    const b = d.querySelector('#mZoom [data-v="' + v + '"]');
    assert.ok(b && !b.hidden, v);
    b.click();
    const box = svg.getAttribute("viewBox").split(" ").map(Number);
    assert.ok(box[2] < 975, v + " did not zoom: " + box.join(" "));
    assert.ok(Math.abs(box[2] / box[3] - 975 / 610) < 0.01, v + " keeps the map's shape");
    assert.equal(b.getAttribute("aria-pressed"), "true");
  }
  const bay = d.querySelector('#mZoom [data-v="bay"]'); bay.click();
  const bb = svg.getAttribute("viewBox").split(" ").map(Number), oak = CITIES.find((c) => c.k === "Oakland, CA");
  assert.ok(oak.x > bb[0] && oak.x < bb[0] + bb[2] && oak.y > bb[1] && oak.y < bb[1] + bb[3], "Oakland is in the Bay Area view");
  const pnw = d.querySelector('#mZoom [data-v="pnw"]'); pnw.click();
  const pb = svg.getAttribute("viewBox").split(" ").map(Number);
  for (const c of MAP.bc) assert.ok(c.x > pb[0] && c.y > pb[1], c.k + " is in the Pacific Northwest view");
  d.querySelector('#mZoom [data-v="all"]').click();
  assert.equal(svg.getAttribute("viewBox"), "0 0 975 610");
  p.window.close();
});

test("reduced motion: no grow-in, no zoom tween and no pulse; with motion allowed the page animates", async () => {
  const still = await open({ setup: reduced(true) });
  let d = still.document;
  assert.ok(!d.getElementById("mapBox").classList.contains("map-anim"));
  const radii = [...d.querySelectorAll("#mapBox circle.dot")].map((c) => +c.getAttribute("r"));
  assert.ok(radii.every((r) => r > 0), "every dot has its full size at once");
  d.querySelector("#mapBox circle.dot").dispatchEvent(new still.window.MouseEvent("click", { bubbles: true }));
  assert.ok(!d.querySelector("#mapBox circle.ring").classList.contains("pulse"), "no pulse under reduced motion");
  d.querySelector('#mZoom [data-v="tx"]').click();
  assert.notEqual(d.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610", "the zoom jumps at once");
  still.window.close();

  const moving = await open({ setup: reduced(false) });
  d = moving.document;
  assert.ok(d.getElementById("mapBox").classList.contains("map-anim"));
  d.querySelector("#mapBox circle.dot").dispatchEvent(new moving.window.MouseEvent("click", { bubbles: true }));
  assert.ok(d.querySelector("#mapBox circle.ring").classList.contains("pulse"));
  d.querySelector('#mZoom [data-v="tx"]').click();
  assert.equal(d.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610", "the zoom tweens instead of jumping");
  assert.ok(await waitFor(() => d.querySelector("#mapBox svg").getAttribute("viewBox") !== "0 0 975 610", { timeout: 3000 }), "the zoom tween never moved");
  moving.window.close();
});

test("map.html makes no request outside this site", async () => {
  const fetchLog = [];
  const p = await open({ fetchLog, setup: reduced(true) });
  for (const r of fetchLog) assert.equal(new URL(r.url).origin, new URL(p.window.location.href).origin, r.url);
  const html = fs.readFileSync(path.join(ROOT, "map.html"), "utf8");
  assert.doesNotMatch(html, /\ssrc="https?:/, "a script or picture from another site");
  assert.doesNotMatch(html, /<link [^>]*rel="(?:stylesheet|preload|icon)"[^>]*href="https?:/, "a style, font or icon from another site");
  p.window.close();
});

// Review fixes (2026-10-15). A tap is placed by its screen point, as in a real browser: the stub gives the map a 975 by 610 box, so a
// screen pixel is one map unit.
function boxed(w) { w.SVGElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 975, height: 610, right: 975, bottom: 610 }; }; }
const tapAt = (p, x, y) => p.document.querySelector("#mapBox svg").dispatchEvent(new p.window.MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));

test("a tap on the middle of a big city opens that city, and a tap on the middle of a small one drawn over it opens the small one", async () => {
  const p = await open({ setup(w) { reduced(true)(w); boxed(w); } });
  const d = p.document, r = (c) => +[...d.querySelectorAll("#mapBox circle.dot")].find((e) => +e.getAttribute("cx") === c.x && +e.getAttribute("cy") === c.y).getAttribute("r");
  // the middle of a big city (15 or more programs) never opens a smaller neighbor drawn over it (before the fix, Atlanta opened Decatur).
  // It opens that city, or a bigger one so close (twin cities a few pixels apart) that a finger cannot tell them apart.
  const big = CITIES.filter((c) => c.ids.length >= 15);
  let own = 0;
  for (const c of big) {
    tapAt(p, c.x, c.y);
    const got = CITIES.find((q) => q.k === d.getElementById("mPanelH").textContent);
    assert.ok(got === c || (got.ids.length >= c.ids.length && Math.hypot(got.x - c.x, got.y - c.y) < 6), c.k + " opened " + got.k);
    if (got === c) own++;
  }
  assert.ok(own >= big.length - 3, own + " of " + big.length + " big cities open themselves");
  // a small city whose middle sits inside a big dot, more than 3 pixels from the big city's middle, opens from its own middle
  const pair = CITIES.flatMap((s) => big.filter((b) => b !== s && s.ids.length < b.ids.length).map((b) => [b, s, Math.hypot(b.x - s.x, b.y - s.y)]))
    .find(([b, s, dd]) => dd > 3 && dd < r(b) - 1);
  assert.ok(pair, "a small dot drawn over a big one");
  tapAt(p, pair[1].x, pair[1].y); await tick(10);
  assert.equal(d.getElementById("mPanelH").textContent, pair[1].k);
  // a tap in the ocean, far from every dot, opens nothing new
  d.getElementById("mPanelX").click();
  tapAt(p, 960, 20); await tick(10);
  assert.equal(d.getElementById("mPanel").hidden, true);
  // lit dots are drawn over faded ones
  const age = d.getElementById("mAge");
  age.value = "12"; age.dispatchEvent(new p.window.Event("change", { bubbles: true })); await tick(20);
  const dots = [...d.querySelectorAll("#mapBox g.dots circle")], firstLit = dots.findIndex((c) => !c.classList.contains("off"));
  assert.ok(dots.slice(firstLit).every((c) => !c.classList.contains("off")), "a faded dot is drawn over a lit one");
  // the middle of a faded dot with no lit dot on it still opens that city
  const faded = dots.filter((c) => c.classList.contains("off")).map((c) => CITIES.find((q) => q.x === +c.getAttribute("cx") && q.y === +c.getAttribute("cy")));
  const alone = faded.find((f) => !CITIES.some((q) => q !== f && Math.hypot(q.x - f.x, q.y - f.y) < 30));
  assert.ok(alone, "a faded city with no neighbor");
  tapAt(p, alone.x, alone.y); await tick(10);
  assert.equal(d.getElementById("mPanelH").textContent, alone.k);
  assert.match(d.getElementById("mPanelNote").textContent, /^(The one program here does not match your choices\. Turn off a filter to see it\.|None of the \d+ programs here match your choices\. Turn off a filter to see them\.)$/);
  p.window.close();
});

test("the panel says how many programs match in plain words, and points to the programs for the whole state and online", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, w = p.window;
  const oak = [...d.querySelectorAll("#mapBox circle.dot")].find((c) => +c.getAttribute("cx") === OAK.x && +c.getAttribute("cy") === OAK.y);
  oak.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick(10);
  const more = d.getElementById("mPanelMore");
  assert.equal(more.hidden, false);
  const ca = more.querySelector('a[data-g="CA"]'), on = more.querySelector('a[data-g="online"]');
  assert.ok(ca && on, more.innerHTML);
  assert.match(ca.textContent, new RegExp("^" + MAP.statewide.CA.length + " programs for all of California$"));
  assert.match(on.textContent, new RegExp("^" + MAP.online.length + " programs online$"));
  ca.click(); await tick(10);
  const g = d.getElementById("g-CA");
  assert.equal(g.open, true);
  assert.ok(g.querySelectorAll("a[href^='find.html#p-']").length > 0, "the California group is filled");
  // every dot, under a filter: the note reads one of the plain forms
  const age = d.getElementById("mAge");
  age.value = "13"; age.dispatchEvent(new w.Event("change", { bubbles: true })); await tick(20);
  const seen = new Set();
  for (const c of d.querySelectorAll("#mapBox circle.dot")) {
    c.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    const t = d.getElementById("mPanelNote").textContent;
    if (/^\d+ programs? here\. Each one opens on the Programs page\.$/.test(t)) seen.add("all");
    else if (/^(1 program matches|\d+ programs match) your choices\. \d+ more here do(es)? not\. Each one opens on the Programs page\.$/.test(t)) seen.add("some");
    else if (/^(The one program here does not match your choices\. Turn off a filter to see it\.|None of the \d+ programs here match your choices\. Turn off a filter to see them\.)$/.test(t)) seen.add("none");
    else assert.fail("note: " + t);
  }
  assert.deepEqual([...seen].sort(), ["all", "none", "some"]);
  p.window.close();
});

test("the zoom buttons follow the map: a zoom to a city or state presses none, and Close falls back to the first button", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, w = p.window, q = d.getElementById("mCityQ");
  q.value = "Oakl"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  q.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick(20);
  assert.equal(d.querySelectorAll('#mZoom [aria-pressed="true"]').length, 0);
  d.getElementById("mPanelX").click();
  assert.equal(d.activeElement, d.querySelector('#mZoom [data-v="all"]'));
  // a city button in the closest list zooms to that city and opens it
  d.querySelector("#mNearList button").click(); await tick(10);
  assert.equal(d.getElementById("mPanel").hidden, false);
  assert.equal(d.activeElement, d.getElementById("mPanelH"));
  p.window.close();
});

test("a filter change asks the closest cities again instead of closing them", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, w = p.window, q = d.getElementById("mCityQ");
  q.value = "Texas"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  q.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick(20);
  assert.match(d.getElementById("mNearWhy").textContent, /programs? for all of Texas/);
  assert.ok(d.querySelector('#mNearWhy a[data-g="TX"]'));
  const before = d.getElementById("mNearList").textContent;
  const age = d.getElementById("mAge");
  age.value = "12"; age.dispatchEvent(new w.Event("change", { bubbles: true })); await tick(20);
  assert.equal(d.getElementById("mNearBox").hidden, false);
  assert.notEqual(d.getElementById("mNearList").textContent, before, "the counts follow the age");
  // every filter on at once can leave a state with no city
  d.getElementById("mPaid").click(); d.getElementById("mOpen").click(); await tick(20);
  assert.match(d.getElementById("mNearWhy").textContent, /Texas/);
  // the state's count in the picker includes its programs for the whole state, the same as the list
  const tx = [...d.getElementById("mCity").options].find((o) => o.value === "s:TX");
  const n = MAP.points.filter((c) => c.s === "TX").reduce((a, c) => a + c.ids.length, 0) + (MAP.statewide.TX || []).length;
  assert.equal(tx.textContent, "Texas (" + n + ")");
  assert.ok(![...d.getElementById("mCity").options].some((o) => o.value === "s:DC"), "Washington, DC is listed once, as a city");
  p.window.close();
});

test("Near me far from every city says how far the closest one is, and zooms the map to the closest cities", async () => {
  const p = await open({ setup(w) { reduced(true)(w); Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(ok) { ok({ coords: { latitude: 30, longitude: -140 } }); } } }); } });
  const d = p.document;
  d.getElementById("mNear").click(); await tick(20);
  assert.equal(d.getElementById("mNearBox").hidden, false);
  assert.match(d.getElementById("mNearWhy").textContent, /The closest one is about [\d,]+ miles away\./);
  assert.ok(d.querySelector('#mNearWhy a[href="#list"]'));
  assert.match(d.getElementById("mNearStatus").textContent, /under the map/);
  assert.notEqual(d.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610");
  assert.equal(d.activeElement, d.getElementById("mNearH"));
  p.window.close();
});

test("Near me hides old results while it asks, and says what to do in a browser that cannot share a location", async () => {
  let deny = false;
  const p = await open({ setup(w) { reduced(true)(w); Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(ok, fail) { if (deny) fail({ code: 1 }); else ok({ coords: { latitude: LAT, longitude: LON } }); } } }); } });
  const d = p.document;
  d.getElementById("mNear").click(); await tick(10);
  assert.equal(d.getElementById("mNearBox").hidden, false);
  deny = true;
  d.getElementById("mNear").click(); await tick(10);
  assert.equal(d.getElementById("mNearBox").hidden, true, "the old list is gone");
  assert.match(d.getElementById("mNearStatus").textContent, /Type your city/);
  // the status line sits under the button, not under the map
  assert.equal(d.getElementById("mNearStatus").parentElement, d.getElementById("mNear").closest(".field"));
  p.window.close();
  const q = await open({ setup(w) { reduced(true)(w); Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: undefined }); } });
  q.document.getElementById("mNear").click();
  assert.match(q.document.getElementById("mNearStatus").textContent, /cannot share a location/);
  q.window.close();
});

test("a typed place that is not on the map: a near spelling, a state named at the end, or Near me", async () => {
  const p = await open({ setup: reduced(true) });
  const d = p.document, w = p.window, q = d.getElementById("mCityQ"), note = d.getElementById("mCityNone");
  const say = (t) => { q.value = t; q.dispatchEvent(new w.Event("input", { bubbles: true })); return note.textContent; };
  assert.match(say("Fresmo"), /^No program in this guide names “Fresmo” as its city\. Did you mean Fresno, CA \(\d+\)\? Or tap Near me\.$/);
  note.querySelector("button").click(); await tick(20);
  assert.equal(d.getElementById("mPanelH").textContent, "Fresno, CA");
  assert.match(say("Houston, TX"), /Did you mean Texas \(\d+\)\?/);
  assert.match(say("Houston, Texas"), /Did you mean Texas \(\d+\)\?/);
  assert.match(say("Clovis"), /^No program in this guide names “Clovis” as its city\. Tap Near me to see the closest cities, or type your state\.$/);
  q.dispatchEvent(new w.FocusEvent("focus"));
  assert.match(note.textContent, /Tap Near me/, "coming back to the box keeps the map's own note");
  assert.match(say("Zq"), /Tap Near me/, "short text is not guessed at");
  assert.doesNotMatch(say("Zq"), /below/, "nothing on this page sits below the box to pick from");
  p.window.close();
});

test("when the map data cannot load, the page hides the empty map and says where to go", async () => {
  const p = await loadPage("map.html", { setup: reduced(true), fetchFail: /data\/map\.json/ });
  const d = p.document;
  assert.ok(await waitFor(() => /could not load/.test(d.getElementById("mCount").textContent)));
  assert.equal(d.getElementById("mapBox").hidden, true);
  assert.equal(d.getElementById("mZoom").hidden, true);
  assert.ok(d.querySelector('#mListBox a[href="find.html"]'));
  p.window.close();
});

test("a state view takes in the state's whole outline when the browser can measure it", async () => {
  const p = await open({ setup(w) {
    reduced(true)(w);
    w.SVGElement.prototype.getBBox = function () { if (this.id === "st-CA") throw new Error("not drawn"); return this.id === "st-TX" ? { x: 300, y: 380, width: 260, height: 200 } : { x: 0, y: 0, width: 0, height: 0 }; };
  } });
  const d = p.document, svg = d.querySelector("#mapBox svg");
  d.querySelector('#mZoom [data-v="tx"]').click();
  const b = svg.getAttribute("viewBox").split(" ").map(Number);
  assert.ok(b[0] <= 300 && b[0] + b[2] >= 560 && b[1] <= 380, "Texas's outline is in view: " + b.join(" "));
  d.querySelector('#mZoom [data-v="ca"]').click();
  assert.ok(+svg.getAttribute("viewBox").split(" ")[2] < 975, "a state the browser cannot measure still zooms to its dots");
  p.window.close();
});
