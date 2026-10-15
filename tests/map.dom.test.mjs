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
  assert.match(d.querySelector("#mNearList li").textContent, /^Oakland, CA/);
  assert.ok(+d.querySelector("#mapBox svg").getAttribute("viewBox").split(" ")[2] < 975, "the map zooms to the city");
  q.value = "Texas"; q.dispatchEvent(new w.Event("input", { bubbles: true }));
  q.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await tick(30);
  assert.match(d.getElementById("mNearWhy").textContent, /Texas/);
  assert.ok([...d.querySelectorAll("#mNearList li")].every((li) => /, TX /.test(li.textContent)));
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
