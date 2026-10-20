// Map start view (2026-10-20, Kentaro's instruction to put the live map on the Ignition page, preset to the Bay Area).
// map.js opens on one zoom view when the address has ?view=<id> or the map box has data-view="<id>". With neither, or an id that
// is not a view, the map opens on the whole map as it always has. ignition.html (unlisted, noindex) uses data-view="bay".
// The street map (map-gl.js) is stood in for, as in tests/map-gl.dom.test.mjs, to check it is sent to the same view.
// Run with: node --test tests/map-start-view.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data/map.json"), "utf8"));
const CITIES = MAP.points.concat(MAP.bc);
const OAK = CITIES.find((c) => c.k === "Oakland, CA");
const NYC = CITIES.find((c) => c.s === "NY");

function reduced(w) {
  w.matchMedia = (q) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
function webgl(w) {
  reduced(w);
  w.WebGL2RenderingContext = function () {};
  w.HTMLCanvasElement.prototype.getContext = function (k) { return k === "webgl2" ? {} : null; };
}
async function open(file, opts = {}) {
  const p = await loadPage(file, { setup: reduced, ...opts });
  const ok = await waitFor(() => p.document.querySelectorAll("#mapBox circle.dot").length > 0 && /places on the map/.test(p.document.getElementById("mCount").textContent));
  assert.ok(ok, file + ": the map did not draw: " + p.errors.join(" | "));
  return p;
}
const box = (d) => d.querySelector("#mapBox svg").getAttribute("viewBox").split(" ").map(Number);
const inBox = (b, c) => c.x > b[0] && c.x < b[0] + b[2] && c.y > b[1] && c.y < b[1] + b[3];
const pressed = (d) => [...d.querySelectorAll('#mZoom [aria-pressed="true"]')].map((b) => b.getAttribute("data-v"));

test("map.html with no view in the address still opens on the whole map", async () => {
  const p = await open("map.html"), d = p.document;
  assert.equal(d.getElementById("mapBox").getAttribute("data-view"), null, "the Map page itself has no start view");
  assert.equal(d.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610");
  assert.deepEqual(pressed(d), ["all"]);
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("map.html?view=bay opens on the Bay Area, with the Bay Area button pressed", async () => {
  const p = await open("map.html", { search: "?view=bay" }), d = p.document, b = box(d);
  assert.ok(b[2] < 975, "the map zoomed in: " + b.join(" "));
  assert.ok(inBox(b, OAK), "Oakland is in view");
  assert.ok(!inBox(b, NYC), "New York is not in view");
  assert.deepEqual(pressed(d), ["bay"]);
  assert.deepEqual(p.errors, []);
  p.window.close();
});

test("a view id that is not a zoom button is ignored, and the whole map shows", async () => {
  for (const search of ["?view=atlantis", "?view=", "?view=<b>x</b>"]) {
    const p = await open("map.html", { search }), d = p.document;
    assert.equal(d.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610", search);
    assert.deepEqual(pressed(d), ["all"], search);
    assert.deepEqual(p.errors, [], search);
    p.window.close();
  }
});

test("ignition.html opens the same map on the Bay Area, and ?view=all in the address wins over the page's start view", async () => {
  const p = await open("ignition.html"), d = p.document, b = box(d);
  assert.equal(d.getElementById("mapBox").getAttribute("data-view"), "bay");
  assert.ok(inBox(b, OAK) && !inBox(b, NYC), "Bay Area view: " + b.join(" "));
  assert.deepEqual(pressed(d), ["bay"]);
  assert.equal(d.querySelectorAll("#mapBox circle.dot").length, CITIES.length, "every city has a dot, as on the Map page");
  assert.deepEqual(p.errors, []);
  p.window.close();

  const q = await open("ignition.html", { search: "?view=all" });
  assert.equal(q.document.querySelector("#mapBox svg").getAttribute("viewBox"), "0 0 975 610");
  assert.deepEqual(pressed(q.document), ["all"]);
  q.window.close();
});

test("ignition.html is unlisted: noindex, not in the sitemap, the nav or any other page, and keeps the volunteer footer", () => {
  const html = fs.readFileSync(path.join(ROOT, "ignition.html"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8"), /ignition\.html/);
  for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "ignition.html")) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), "utf8"), /href="[^"]*ignition\.html/, f + " links to the unlisted Ignition page");
  }
  assert.match(html, /not an official publication of Ignition, Acts 2 Network or AYM/);
  assert.doesNotMatch(html, /<img[^>]*ignition/i, "no Ignition logo or image");
});

test("the street map is sent to the start view once it is ready", async () => {
  const p = await loadPage("ignition.html", { setup: webgl }), d = p.document, calls = [];
  assert.ok(await waitFor(() => typeof p.window.TIG.mapGLStart === "function"), "map.js never asked for the street map");
  const api = { setData: () => {}, select: (i) => calls.push(["select", i]), fit: (list, max) => calls.push(["fit", list, max]), whole: () => calls.push(["whole"]), city: () => {}, inView: () => [], resize: () => {} };
  p.window.TIG.mapGLStart(() => Promise.resolve(api));
  assert.ok(await waitFor(() => d.getElementById("mapBox").classList.contains("gl-on")));
  const fit = calls.find((c) => c[0] === "fit");
  assert.ok(fit, "the street map was not moved: " + calls.map((c) => c[0]).join(" "));
  assert.ok(fit[1].some((c) => c.k === "Oakland, CA") && fit[1].every((c) => c.s === "CA"), "the street map fits Bay Area cities");
  assert.ok(!calls.some((c) => c[0] === "whole"));
  p.window.close();

  const m = await loadPage("map.html", { setup: webgl }), calls2 = [];
  assert.ok(await waitFor(() => typeof m.window.TIG.mapGLStart === "function"));
  m.window.TIG.mapGLStart(() => Promise.resolve({ ...api, fit: () => calls2.push("fit"), whole: () => calls2.push("whole") }));
  assert.ok(await waitFor(() => m.document.getElementById("mapBox").classList.contains("gl-on")));
  assert.deepEqual(calls2, [], "with no start view the Map page's street map is left where it opens");
  m.window.close();
});
