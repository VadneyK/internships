// Map page street map (2026-10-16): map.js hands the dots to map-gl.js when the browser has WebGL 2.
// jsdom has no WebGL, so these tests give the page a pretend WebGL 2 and stand in for map-gl.js's create(): they check what
// map.js asks the street map to do. Above all, Near me moves the street map only to program cities, never to the reader's
// own point, so the map pieces it loads say no more than a tap on those cities would.
// The drawing itself (MapLibre, the tiles, the letters) is checked in a real browser; see tools/geo/README.md.
// Run with: node --test tests/map-gl.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data/map.json"), "utf8"));
const CITIES = MAP.points.concat(MAP.bc);
const OAK = CITIES.find((c) => c.k === "Oakland, CA");
// A spot a few hundred feet from the Oakland, CA point. Its digits showing up in any call means the location leaked.
const LAT = OAK.lat + 0.0021, LON = OAK.lon - 0.0017;
const LEAK = new RegExp(LAT.toFixed(3).replace(".", "\\.") + "|" + LON.toFixed(3).replace(".", "\\."));
const ALL = new Set(CITIES.map((c) => c.lat + "," + c.lon));

/* pretend WebGL 2, reduced motion, and (optionally) the browser's data saver */
function webgl({ saveData = false } = {}) {
  return (w) => {
    w.WebGL2RenderingContext = function () {};
    w.HTMLCanvasElement.prototype.getContext = function (k) { return k === "webgl2" ? {} : null; };
    w.matchMedia = (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    if (saveData) Object.defineProperty(w.navigator, "connection", { value: { saveData: true }, configurable: true });
  };
}
/* a stand-in for map-gl.js create(): records every call map.js makes */
function fakeGL(inView = () => []) {
  const calls = [];
  let opts = null;
  const api = {
    setData: (list) => calls.push(["setData", list]),
    select: (i) => calls.push(["select", i]),
    fit: (list, max) => calls.push(["fit", list, max]),
    whole: () => calls.push(["whole"]),
    city: (p) => calls.push(["city", p]),
    inView: () => inView(),
    resize: () => {},
  };
  const create = (o) => { opts = o; calls.push(["create"]); return Promise.resolve(api); };
  return { calls, create, get opts() { return opts; } };
}
async function open(setupOpts) {
  const p = await loadPage("map.html", { setup: webgl(setupOpts) });
  const ok = await waitFor(() => /places on the map/.test(p.document.getElementById("mCount").textContent));
  assert.ok(ok, "the map did not load: " + p.errors.join(" | "));
  return p;
}
async function start(p, gl) {
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"), "map.js never asked for the street map");
  p.window.TIG.mapGLStart(gl.create);
  assert.ok(await waitFor(() => p.document.getElementById("mapBox").classList.contains("gl-on")));
}

test("with WebGL 2 the map box keeps the street map's height from the start, then loads pmtiles.js and map-gl.js as a module", async () => {
  const p = await open();
  const d = p.document, box = d.getElementById("mapBox");
  assert.ok(box.classList.contains("gl"), "the height is held before the street map arrives, so the page does not jump");
  assert.ok(d.querySelector('script[src="assets/vendor/pmtiles.js"]'));
  assert.ok(await waitFor(() => d.querySelector('script[type="module"][src="assets/js/map-gl.js"]')), "the module script is added once pmtiles.js has loaded");
  assert.ok(d.querySelector('link[rel="stylesheet"][href="assets/vendor/maplibre/maplibre-gl.css"]'));
  assert.equal(box.getAttribute("aria-hidden"), "true", "until the street map is ready the drawn map stays hidden from screen readers");
  assert.ok(box.querySelector("svg circle.dot"), "the drawn map is there while the street map loads");
  // the street map's note and its status line hold their space from the start, so nothing moves when it arrives (CLS)
  assert.match(d.getElementById("mNote").textContent, /^Drag the map to move it/);
  assert.ok(d.querySelector('#mNote a[href="#list"]'), "the note keeps its link to the list");
  assert.equal(d.getElementById("mView").hidden, false);
  assert.equal(d.getElementById("mView").style.visibility, "hidden");
  p.window.close();
});

test("once ready the street map gets every city, a region label, the street map words and the OpenStreetMap credit", async () => {
  const p = await open(), d = p.document, gl = fakeGL();
  await start(p, gl);
  const box = d.getElementById("mapBox");
  assert.equal(box.getAttribute("aria-hidden"), null, "the street map works with a keyboard, so it is not hidden");
  assert.equal(box.getAttribute("role"), "region");
  assert.equal(box.getAttribute("aria-label"), "Street map");
  const data = gl.calls.filter((c) => c[0] === "setData").pop()[1];
  assert.equal(data.length, CITIES.length);
  assert.ok(data.every((c) => ALL.has(c.lat + "," + c.lon) && c.n > 0), "every city, lit, at its own point");
  assert.match(d.getElementById("mNote").textContent, /^Drag the map to move it/);
  assert.doesNotMatch(d.getElementById("mNote").textContent, /dashed box/, "the Vancouver box is only on the drawn map");
  assert.equal(d.getElementById("mStreet").hidden, false);
  assert.match(d.getElementById("mStreet").innerHTML, /openstreetmap\.org\/copyright/);
  p.window.close();
});

test("a filter sends the street map fewer lit cities; a zoom button fits the street map to that area's cities", async () => {
  const p = await open(), d = p.document, gl = fakeGL();
  await start(p, gl);
  d.getElementById("mOpen").click();
  await tick(30);
  const data = gl.calls.filter((c) => c[0] === "setData").pop()[1];
  const litN = data.filter((c) => c.n > 0).length;
  assert.ok(litN > 0 && litN < CITIES.length, "open or opening soon lights fewer cities, got " + litN);
  d.getElementById("mOpen").click();
  await tick(30);
  d.querySelector('#mZoom [data-v="tx"]').click();
  const fit = gl.calls.filter((c) => c[0] === "fit").pop();
  assert.ok(fit, "Texas fits the street map");
  assert.ok(fit[1].length > 3 && fit[1].every((c) => c.s === "TX"), "only Texas cities");
  d.querySelector('#mZoom [data-v="pnw"]').click();
  assert.ok(gl.calls.filter((c) => c[0] === "fit").pop()[1].some((c) => c.s === "BC"), "the Pacific Northwest view takes in Vancouver, BC");
  d.querySelector('#mZoom [data-v="all"]').click();
  assert.equal(gl.calls[gl.calls.length - 1][0], "whole");
  p.window.close();
});

test("Near me moves the street map to the closest program cities, never to the reader's own point", async () => {
  const p = await open(), d = p.document, gl = fakeGL();
  await start(p, gl);
  p.window.navigator.geolocation = { getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: LAT, longitude: LON, accuracy: 30 } }), 5) };
  const before = gl.calls.length;
  d.getElementById("mNear").click();
  assert.ok(await waitFor(() => !d.getElementById("mNearBox").hidden));
  const after = gl.calls.slice(before);
  const fit = after.find((c) => c[0] === "fit");
  assert.ok(fit, "the street map moved");
  assert.equal(fit[1].length, 5);
  assert.ok(fit[1].every((c) => ALL.has(c.lat + "," + c.lon)), "every point it moved to is a program city from data/map.json");
  assert.ok(fit[1].some((c) => c.k === "Oakland, CA"));
  assert.ok(fit[2] <= 10, "no closer than zoom 10 (about a town)");
  assert.doesNotMatch(JSON.stringify(after, (k, v) => (k === "el" ? undefined : v)), LEAK, "the reader's own coordinates never reach the street map");
  assert.doesNotMatch(p.window.location.href, LEAK);
  p.window.close();
});

test("a tap on a street map dot opens that city and rings it; Close clears the ring", async () => {
  const p = await open(), d = p.document, gl = fakeGL();
  await start(p, gl);
  const i = CITIES.findIndex((c) => c.k === "Oakland, CA");
  gl.opts.onPick(i);
  assert.equal(d.getElementById("mPanel").hidden, false);
  assert.equal(d.getElementById("mPanelH").textContent, "Oakland, CA");
  assert.deepEqual(gl.calls.filter((c) => c[0] === "select").pop(), ["select", i]);
  d.getElementById("mPanelX").click();
  assert.deepEqual(gl.calls[gl.calls.length - 1], ["select", null]);
  p.window.close();
});

test("after the street map stops moving, a status line says how many programs and places are in view", async () => {
  const two = CITIES.slice(0, 2).map((c, i) => ({ i, n: c.ids.length }));
  const p = await open(), d = p.document, gl = fakeGL(() => two);
  await start(p, gl);
  gl.opts.onMove();
  assert.ok(await waitFor(() => /^In this view/.test(d.getElementById("mView").textContent), { timeout: 3000 }));
  assert.equal(d.getElementById("mView").style.visibility, "", "shown once there is something to say");
  const n = two.reduce((a, c) => a + c.n, 0);
  assert.equal(d.getElementById("mView").textContent, "In this view: " + n + " programs in 2 places.");
  assert.equal(d.getElementById("mView").getAttribute("role"), "status");
  p.window.close();
});

test("if the street map cannot start, the drawn map stays and the box drops the street map's height", async () => {
  const p = await open(), d = p.document;
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"));
  p.window.TIG.mapGLStart(() => Promise.reject(new Error("no tiles")));
  assert.ok(await waitFor(() => !d.getElementById("mapBox").classList.contains("gl")));
  assert.equal(d.querySelector("#mapBox .mgl"), null);
  assert.ok(d.querySelector("#mapBox svg circle.dot"));
  assert.equal(d.getElementById("mapBox").getAttribute("aria-hidden"), "true");
  assert.match(d.getElementById("mNote").textContent, /dashed box at the top left is Vancouver/, "the drawn map's words come back");
  assert.ok(d.querySelector('#mNote a[href="#list"]'));
  assert.equal(d.getElementById("mView").hidden, true);
  p.window.close();
});

test("with the browser's data saver on, the street map waits for a tap on a button that says how big it is", async () => {
  const p = await open({ saveData: true }), d = p.document;
  const box = d.getElementById("mapBox");
  assert.ok(!box.classList.contains("gl"));
  const b = d.getElementById("mGLGo");
  assert.ok(b, "the button is there");
  assert.match(b.textContent, /about 1 MB/);
  assert.equal(d.querySelector('script[src="assets/vendor/pmtiles.js"]'), null, "nothing loads before the tap");
  assert.match(d.getElementById("mNote").textContent, /dashed box/, "until the tap the note is the drawn map's");
  b.click();
  assert.ok(box.classList.contains("gl"));
  assert.match(d.getElementById("mNote").textContent, /^Drag the map/);
  assert.ok(d.querySelector('script[src="assets/vendor/pmtiles.js"]'));
  assert.equal(d.getElementById("mGLGo"), null);
  p.window.close();
});

test("without WebGL 2 nothing of the street map loads", async () => {
  const p = await loadPage("map.html");
  assert.ok(await waitFor(() => /places on the map/.test(p.document.getElementById("mCount").textContent)));
  assert.ok(!p.document.getElementById("mapBox").classList.contains("gl"));
  assert.equal(p.document.querySelector('script[src="assets/vendor/pmtiles.js"]'), null);
  assert.equal(p.document.getElementById("mGLGo"), null);
  p.window.close();
});
