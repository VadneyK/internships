// The map on the Programs page (2026-10-20, Kentaro's instruction to make the map prominent on Find).
// find.js loads find-map.js only once the map box comes near the screen, and find-map.js draws with the Map page's
// street map (map-gl.js), stood in for here as in tests/map-start-view.dom.test.mjs.
// With no place picked the street map shows the whole map; with a place it moves to that place's cities.
// A tap on a dot keeps only that city's cards, and Show every city brings the rest back.
// Run with: node --test tests/find-map.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data/map.json"), "utf8"));
const OAK = MAP.points.find((c) => c.k === "Oakland, CA");

function webgl(w, seen) {
  w.matchMedia = (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.WebGL2RenderingContext = function () {};
  w.HTMLCanvasElement.prototype.getContext = function (k) { return k === "webgl2" ? {} : null; };
  // every observed box is on screen at once
  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { if (seen) seen.push(el.id); setTimeout(() => this.cb([{ isIntersecting: true, target: el, boundingClientRect: { top: 0 } }]), 0); }
    disconnect() {}
  };
}
function stub(calls) {
  return { setData: (list) => calls.push(["data", list]), select: (i) => calls.push(["select", i]), fit: (list, max) => calls.push(["fit", list, max]), whole: () => calls.push(["whole"]), city: () => {}, inView: () => [], resize: () => {} };
}
async function open(search = "") {
  const seen = [], p = await loadPage("find.html", { search, setup: (w) => webgl(w, seen) }), calls = [];
  let opts = null;
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"), "find-map.js never asked for the street map: " + p.errors.join(" | "));
  assert.ok(seen.includes("fMapBox"), "find.js watches the map box");
  p.window.TIG.mapGLStart((o) => { opts = o; return Promise.resolve(stub(calls)); });
  assert.ok(await waitFor(() => p.document.getElementById("fMapBox").classList.contains("gl-on")), "the street map never showed");
  return { p, d: p.document, calls, opts: () => opts };
}

test("the Programs page does not load the map code until the map box is near the screen", async () => {
  const p = await loadPage("find.html");
  await waitFor(() => /of [\d,]+ programs/.test(p.document.getElementById("count").textContent));
  await new Promise((r) => setTimeout(r, 300));
  // 2026-10-20, Kentaro: "Why don't you show the map by default? ... Show it." The map box is always shown, sized from the start, under Your picks
  const m = p.document.getElementById("fMap");
  assert.notEqual(m.tagName, "DETAILS", "the map is not in a box that can be folded away");
  assert.ok(!m.hidden && !m.closest("details,[hidden]"), "the map is shown with no click");
  assert.ok(p.document.getElementById("fMapBox").getAttribute("style").includes("height:"), "the map box keeps its height before the map loads");
  assert.ok(m.compareDocumentPosition(p.document.getElementById("fsum")) & p.window.Node.DOCUMENT_POSITION_PRECEDING, "the map comes right after Your picks");
  assert.ok(m.compareDocumentPosition(p.document.getElementById("moreFilters")) & p.window.Node.DOCUMENT_POSITION_FOLLOWING, "the map comes before the other filters");
  assert.equal(p.document.querySelector('script[src*="find-map.js"]'), null, "find-map.js loaded with no IntersectionObserver report");
  assert.equal(p.window.TIG.findMap, undefined);
  p.window.close();
});

test("with no place picked the map shows the whole map, with a dot for each city in the list", async () => {
  const { p, d, calls } = await open();
  assert.ok(calls.some((c) => c[0] === "whole"), "the map was not sent to the whole map: " + calls.map((c) => c[0]).join(" "));
  assert.ok(!calls.some((c) => c[0] === "fit"));
  const data = calls.filter((c) => c[0] === "data").pop()[1], oak = data.find((x) => x.name === "Oakland");
  assert.equal(oak.n, OAK.ids.length, "Oakland's dot counts every Oakland card");
  assert.match(d.getElementById("fMapCount").textContent, /programs in [\d,]+ cities on the map/);
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("with a place picked the map moves to that place's cities", async () => {
  const { p, calls } = await open("?at=area:bay-area");
  const fit = calls.find((c) => c[0] === "fit");
  assert.ok(fit, "the map did not move: " + calls.map((c) => c[0]).join(" "));
  assert.ok(fit[1].some((c) => c.k === "Oakland, CA"), "Oakland is in the view");
  assert.ok(fit[1].every((c) => c.s === "CA"), "only California cities are in the view");
  assert.ok(!calls.some((c) => c[0] === "whole"));
  p.window.close();
});

test("a tap on a dot keeps only that city's cards, and Show every city brings the rest back", async () => {
  const { p, d, calls, opts } = await open();
  const before = d.getElementById("count").textContent, data = calls.filter((c) => c[0] === "data").pop()[1];
  opts().onPick(data.find((x) => x.name === "Oakland").i);
  assert.ok(await waitFor(() => d.getElementById("count").textContent.startsWith(OAK.ids.length + " of ")), "the list is not Oakland's: " + d.getElementById("count").textContent);
  assert.equal(d.getElementById("fMapCity").hidden, false);
  assert.match(d.getElementById("fMapCity").textContent, /Showing only the city you tapped: Oakland, CA/);
  const ids = [...d.querySelectorAll("#out article.prog")].map((a) => a.id.slice(2));
  assert.ok(ids.length > 0 && ids.every((id) => OAK.ids.includes(id)), "a card from another city is in the list");
  assert.ok(calls.some((c) => c[0] === "select" && c[1] === data.find((x) => x.name === "Oakland").i), "the Oakland dot is marked");
  d.getElementById("fMapAll").click();
  assert.ok(await waitFor(() => d.getElementById("count").textContent === before), "the full list did not come back");
  assert.equal(d.getElementById("fMapCity").hidden, true);
  assert.deepEqual(p.errors, []);
  p.window.close();
});

// The ways the street map can be left out: no WebGL 2, the data saver (it waits for a tap), and a street map that fails to load
async function bare(setup) {
  const p = await loadPage("find.html", { setup: (w) => { webgl(w); setup(w); } });
  assert.ok(await waitFor(() => !!p.window.TIG.findMap), "find-map.js did not load: " + p.errors.join(" | "));
  return p;
}
test("without WebGL 2 the box says so and links the full map", async () => {
  const p = await bare((w) => { delete w.WebGL2RenderingContext; });
  const wait = p.document.getElementById("fMapWait");
  assert.match(wait.textContent, /cannot draw the street map/);
  assert.equal(wait.querySelector("a").getAttribute("href"), "map.html");
  assert.equal(p.window.TIG.mapGLStart, undefined, "no street map was asked for");
  p.window.close();
});
test("with the data saver on, the street map waits for a tap", async () => {
  const p = await bare((w) => { Object.defineProperty(w.navigator, "connection", { value: { saveData: true }, configurable: true }); });
  const go = p.document.getElementById("fMapGo");
  assert.ok(go, "no Load the map button");
  assert.equal(p.window.TIG.mapGLStart, undefined);
  go.click();
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"), "the tap did not start the street map");
  p.window.close();
});
test("a street map that fails to load leaves a link to the full map", async () => {
  const p = await bare(() => {});
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"));
  p.window.TIG.mapGLStart(() => Promise.reject(new Error("no tiles")));
  assert.ok(await waitFor(() => /could not load/.test(p.document.getElementById("fMapWait").textContent)));
  assert.equal(p.document.querySelector("#fMapBox .mgl"), null);
  assert.equal(p.document.getElementById("fMapBox").classList.contains("gl-on"), false);
  p.window.close();
});
