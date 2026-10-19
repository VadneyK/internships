/* Map page, street map: the same city dots as map.js, on a map you can drag and zoom (MapLibre GL, BSD-3).
   map.js loads this file only when the browser can draw WebGL; otherwise the drawn US map stays.
   Everything comes from this site: the library (assets/vendor), the map tiles (assets/map/tiles, OpenStreetMap
   data through Protomaps, cut down by tools/geo/tiles) and the label letters (assets/map/fonts). The map makes no
   request to any other site. Near me never moves the map to the reader's own point, only to program cities, so
   the map pieces it loads are the same ones a tap on those cities would load. */
import * as M from "../vendor/maplibre/maplibre-gl.mjs";

var FONT = ["noto-sans-regular"], BOLD = ["noto-sans-medium"];
var NAME = ["coalesce", ["get", "name:en"], ["get", "name"]];
var US = [[-125, 24.4], [-66.9, 49.4]];

/* colors from the page's own theme (style.css), so the map follows light and dark mode. num is the count on a dot:
   white on the light orange (4.65 to 1; near black was 3.93), near black on the dark one (5.95 to 1) */
function palette() {
  var cs = getComputedStyle(document.documentElement), v = function (n) { return cs.getPropertyValue(n).trim(); };
  var dark = /dark/.test(v("color-scheme"));
  return dark ? {
    land: "#1d1c1a", water: "#16252c", park: "#1f2a20", school: "#2a2420", county: "#3a3733", state: "#7d766c", nation: "#a39a8e",
    road: "#3b3834", major: "#4a4640", highway: "#7a6436", hcase: "#1d1c1a", rail: "#4a4640",
    text: v("--ink") || "#f3f0ea", text2: v("--ink-2") || "#bdb7ae", halo: v("--paper") || "#131211",
    dot: v("--orange-display") || "#f06a3f", off: "#6d675f", edge: v("--surface") || "#211f1d", ink: v("--ink") || "#f3f0ea", num: "#151515"
  } : {
    land: "#f6f4ef", water: "#c7d7df", park: "#dce7d0", school: "#efe5d6", county: "#ddd8cf", state: "#9b958c", nation: "#6d675f",
    road: "#ffffff", major: "#ffffff", highway: "#f6d27a", hcase: "#d9c08a", rail: "#cfc9bf",
    text: v("--ink") || "#151515", text2: v("--ink-2") || "#4a4743", halo: "#f6f4ef",
    dot: v("--orange-display") || "#cf4519", off: "#8d877e", edge: v("--surface") || "#ffffff", ink: v("--ink") || "#151515", num: "#ffffff"
  };
}

/* one source's base map layers. src: "base" (every place, zooms 0 to 8, stretched past 8) or "detail" (near program
   cities, zooms 9 to 11). Base roads stop at zoom 9, where the detail roads take over, so no road is drawn twice. */
function baseLayers(src, c) {
  var d = src === "detail", id = function (x) { return src + "-" + x; }, out = [];
  var roadMax = d ? 24 : 9;
  out.push({ id: id("earth"), type: "fill", source: src, "source-layer": "earth", paint: { "fill-color": c.land } });
  out.push({ id: id("park"), type: "fill", source: src, "source-layer": "landuse", filter: ["in", ["get", "kind"], ["literal", ["park", "national_park", "nature_reserve", "zoo"]]], paint: { "fill-color": c.park } });
  out.push({ id: id("school"), type: "fill", source: src, "source-layer": "landuse", minzoom: 10, filter: ["in", ["get", "kind"], ["literal", ["school", "university", "college", "hospital"]]], paint: { "fill-color": c.school } });
  out.push({ id: id("water"), type: "fill", source: src, "source-layer": "water", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": c.water } });
  out.push({ id: id("river"), type: "line", source: src, "source-layer": "water", minzoom: 9, filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": c.water, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 14, 2.5] } });
  out.push({ id: id("county"), type: "line", source: src, "source-layer": "boundaries", minzoom: 8, filter: ["==", ["get", "kind"], "county"], paint: { "line-color": c.county, "line-width": 0.8 } });
  out.push({ id: id("state"), type: "line", source: src, "source-layer": "boundaries", filter: ["==", ["get", "kind"], "region"], paint: { "line-color": c.state, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 10, 1.6], "line-dasharray": [3, 2] } });
  out.push({ id: id("nation"), type: "line", source: src, "source-layer": "boundaries", filter: ["==", ["get", "kind"], "country"], paint: { "line-color": c.nation, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 10, 2] } });
  out.push({ id: id("rail"), type: "line", source: src, "source-layer": "roads", minzoom: 10, maxzoom: roadMax, filter: ["==", ["get", "kind"], "rail"], paint: { "line-color": c.rail, "line-width": 1, "line-dasharray": [2, 2] } });
  out.push({ id: id("minor"), type: "line", source: src, "source-layer": "roads", minzoom: 10, maxzoom: roadMax, filter: ["==", ["get", "kind_detail"], "tertiary"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.road, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 10, 0.6, 14, 5] } });
  out.push({ id: id("major"), type: "line", source: src, "source-layer": "roads", minzoom: 6, maxzoom: roadMax, filter: ["all", ["==", ["get", "kind"], "major_road"], ["!=", ["get", "kind_detail"], "tertiary"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.major, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 6, 0.4, 10, 1.4, 14, 7] } });
  out.push({ id: id("hwcase"), type: "line", source: src, "source-layer": "roads", minzoom: 7, maxzoom: roadMax, filter: ["==", ["get", "kind"], "highway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.hcase, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 7, 1.2, 10, 3, 14, 11] } });
  out.push({ id: id("highway"), type: "line", source: src, "source-layer": "roads", minzoom: 4, maxzoom: roadMax, filter: ["==", ["get", "kind"], "highway"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": c.highway, "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 4, 0.5, 10, 2, 14, 8] } });
  return out;
}

/* A town the map names itself is left out where a program city of the same name has a dot (the dot carries the name),
   so a city is not named twice a few millimeters apart */
function townFilter(src, skip) {
  var kinds = src === "base" ? ["locality"] : ["locality", "neighbourhood", "macrohood"];
  return ["all", ["in", ["get", "kind"], ["literal", kinds]], ["!", ["in", NAME, ["literal", skip]]]];
}
/* place names: states at country zooms, then towns and neighborhoods. A name that would cover another one is left out. */
function labelLayers(c) {
  var halo = { "text-color": c.text2, "text-halo-color": c.halo, "text-halo-width": 1.6 };
  return [
    { id: "lbl-state", type: "symbol", source: "base", "source-layer": "places", minzoom: 3.5, maxzoom: 8, filter: ["==", ["get", "kind"], "region"],
      layout: { "text-field": NAME, "text-font": BOLD, "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 7, 13], "text-transform": "uppercase", "text-letter-spacing": 0.08, "text-max-width": 7 },
      paint: { "text-color": c.text2, "text-halo-color": c.halo, "text-halo-width": 1.4, "text-opacity": 0.75 } },
    { id: "lbl-town-base", type: "symbol", source: "base", "source-layer": "places", minzoom: 6, filter: townFilter("base", []),
      layout: { "text-field": NAME, "text-font": FONT, "text-size": ["interpolate", ["linear"], ["zoom"], 6, 10, 12, 14], "text-max-width": 8, "symbol-sort-key": ["get", "min_zoom"] }, paint: halo },
    { id: "lbl-town", type: "symbol", source: "detail", "source-layer": "places", minzoom: 9, filter: townFilter("detail", []),
      layout: { "text-field": NAME, "text-font": FONT, "text-size": ["match", ["get", "kind"], "locality", 13, 11], "text-max-width": 8, "symbol-sort-key": ["get", "min_zoom"] }, paint: halo }
  ];
}

/* the city dots: lit cities group into one counted circle when they crowd (up to zoom 6), cities with no match stay faint */
/* MapLibre allows zoom only at the top of an expression, so the ring's larger size is its own copy (extra pixels at every stop) */
function radius(extra) {
  var r = function (base, k) { return ["+", base + extra, ["*", k, ["sqrt", ["get", "n"]]]]; };
  return ["interpolate", ["linear"], ["zoom"], 3, r(4, 1.0), 8, r(7, 1.5), 12, r(10, 1.9)];
}
var RADIUS = radius(0);
/* the picked city's name is drawn by the sel-name layer (always shown), so its ordinary name is left out */
function nameFilter(i) { return ["all", ["!", ["has", "point_count"]], ["!=", ["get", "i"], i == null ? -1 : i]]; }
function dotLayers(c) {
  return [
    { id: "off", type: "circle", source: "off", minzoom: 5, paint: { "circle-color": c.off, "circle-opacity": 0.45, "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 12, 5], "circle-stroke-color": c.edge, "circle-stroke-width": 1 } },
    { id: "clu", type: "circle", source: "cities", filter: ["has", "point_count"], paint: { "circle-color": c.dot, "circle-radius": ["+", 9, ["*", 0.85, ["sqrt", ["get", "n"]]]], "circle-stroke-color": c.edge, "circle-stroke-width": 2 } },
    { id: "clu-n", type: "symbol", source: "cities", filter: ["has", "point_count"], layout: { "text-field": ["to-string", ["get", "n"]], "text-font": BOLD, "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": c.num } },
    { id: "dot", type: "circle", source: "cities", filter: ["!", ["has", "point_count"]], paint: { "circle-color": c.dot, "circle-radius": RADIUS, "circle-stroke-color": c.edge, "circle-stroke-width": 1.5 } },
    { id: "dot-n", type: "symbol", source: "cities", minzoom: 7, filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "n"], 1]], layout: { "text-field": ["to-string", ["get", "n"]], "text-font": BOLD, "text-size": 11, "text-allow-overlap": true }, paint: { "text-color": c.num } },
    { id: "dot-name", type: "symbol", source: "cities", minzoom: 6.5, filter: nameFilter(null),
      layout: { "text-field": ["get", "name"], "text-font": BOLD, "text-size": 13, "text-anchor": "top", "text-offset": [0, 0.9], "text-max-width": 9, "symbol-sort-key": ["-", 0, ["get", "n"]] },
      paint: { "text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 2 } },
    { id: "sel", type: "circle", source: "sel", paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": radius(5), "circle-stroke-color": c.ink, "circle-stroke-width": 3 } },
    { id: "sel-name", type: "symbol", source: "sel", layout: { "text-field": ["get", "name"], "text-font": BOLD, "text-size": 15, "text-anchor": "bottom", "text-offset": [0, -1.2], "text-allow-overlap": true, "text-ignore-placement": true },
      paint: { "text-color": c.text, "text-halo-color": c.halo, "text-halo-width": 2.5 } }
  ];
}

function styleFor(c, root) {
  var tiles = function (f) { return "pmtiles://" + new URL("assets/map/tiles/" + f, root).href; };
  var empty = { type: "FeatureCollection", features: [] };
  return {
    version: 8,
    glyphs: new URL("assets/map/fonts/", root).href + "{fontstack}/{range}.pbf",
    sources: {
      base: { type: "vector", url: tiles("base.pmtiles.gz"), attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' },
      detail: { type: "vector", url: tiles("detail.pmtiles.gz") },
      cities: { type: "geojson", data: empty, cluster: true, clusterMaxZoom: 6, clusterRadius: 34, clusterProperties: { n: ["+", ["get", "n"]] } },
      off: { type: "geojson", data: empty },
      sel: { type: "geojson", data: empty }
    },
    layers: [{ id: "bg", type: "background", paint: { "background-color": c.water } }]
      .concat(baseLayers("base", c), baseLayers("detail", c), labelLayers(c), dotLayers(c))
  };
}

function feature(p) {
  return { type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { i: p.i, n: p.n, name: p.name } };
}

/* opts: { el, root, anim, onPick(i), onMove() }. Resolves with the controls map.js uses once the first view has drawn. */
export function create(opts) {
  /* two background workers are plenty for 474 dots and small tiles; each one reads the 500 KB library again */
  M.setWorkerCount(2);
  var proto = new window.pmtiles.Protocol();
  M.addProtocol("pmtiles", proto.tile);
  var c = palette(), dur = opts.anim ? 700 : 0;
  var map = new M.Map({
    container: opts.el, style: styleFor(c, opts.root), bounds: US, fitBoundsOptions: { padding: 16 },
    minZoom: 1.5, maxZoom: 14.5, maxBounds: [[-179.9, 5], [-30, 78]], renderWorldCopies: false,
    dragRotate: false, pitchWithRotate: false, touchPitch: false, keyboard: true,
    cooperativeGestures: true, attributionControl: { compact: false }, fadeDuration: opts.anim ? 300 : 0,
    locale: {
      "CooperativeGesturesHandler.WindowsHelpText": "Hold Ctrl and scroll to zoom the map",
      "CooperativeGesturesHandler.MacHelpText": "Hold ⌘ and scroll to zoom the map",
      "CooperativeGesturesHandler.MobileHelpText": "Use two fingers to move the map, or tap Full screen",
      "NavigationControl.ZoomIn": "Zoom in", "NavigationControl.ZoomOut": "Zoom out",
      "FullscreenControl.Enter": "Full screen map", "FullscreenControl.Exit": "Leave full screen"
    }
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.addControl(new M.NavigationControl({ showCompass: false }), "top-right");
  var fs = new M.FullscreenControl({ container: opts.el });
  map.addControl(fs, "top-right");
  /* full screen has no page to scroll, so one finger moves the map there */
  fs.on("fullscreenstart", function () { map.cooperativeGestures.disable(); });
  fs.on("fullscreenend", function () { map.cooperativeGestures.enable(); });
  var canvas = map.getCanvas();
  canvas.setAttribute("aria-label", "Map of the cities with programs. Arrow keys move it, plus and minus zoom. The list under the map has every program.");

  var pts = [], cur = null;
  /* a tap picks the closest dot within reach (a finger is wider than a small dot); a tap on a group zooms into it */
  map.on("click", function (ev) {
    var pad = 14, b = [[ev.point.x - pad, ev.point.y - pad], [ev.point.x + pad, ev.point.y + pad]];
    var hit = map.queryRenderedFeatures(b, { layers: ["dot", "clu"] });
    if (!hit.length) return;
    var best = null, bd = Infinity;
    hit.forEach(function (f) {
      var xy = map.project(f.geometry.coordinates), d = Math.hypot(xy.x - ev.point.x, xy.y - ev.point.y);
      if (d < bd) { bd = d; best = f; }
    });
    if (best.properties.point_count) {
      map.getSource("cities").getClusterExpansionZoom(best.properties.cluster_id).then(function (z) {
        map.easeTo({ center: best.geometry.coordinates, zoom: Math.min(z + 0.5, 12), duration: dur });
      });
    } else opts.onPick(best.properties.i);
  });
  map.on("mousemove", function (ev) {
    var hit = map.queryRenderedFeatures([[ev.point.x - 6, ev.point.y - 6], [ev.point.x + 6, ev.point.y + 6]], { layers: ["dot", "clu"] });
    canvas.style.cursor = hit.length ? "pointer" : "";
  });
  if (opts.onMove) map.on("moveend", opts.onMove);

  /* follow the page's theme switch and the system setting */
  function recolor() {
    var n = palette();
    if (n.land === c.land) return;
    c = n;
    var fresh = styleFor(c, opts.root).layers;
    fresh.forEach(function (l) { Object.keys(l.paint || {}).forEach(function (k) { if (map.getLayer(l.id)) map.setPaintProperty(l.id, k, l.paint[k]); }); });
  }
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", recolor);

  function paintSel() {
    var s = map.getSource("sel");
    if (s) s.setData({ type: "FeatureCollection", features: cur == null || !pts[cur] ? [] : [feature(pts[cur])] });
  }
  function fit(list, maxZoom) {
    if (!list.length) return;
    var w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    list.forEach(function (p) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); });
    map.fitBounds([[w, s], [e, n]], { padding: { top: 48, bottom: 48, left: 40, right: 56 }, maxZoom: maxZoom || 10, duration: dur });
  }
  var api = {
    map: map,
    /* list: [{ i, name, lat, lon, n }] for every city; n 0 draws it faint */
    setData: function (list) {
      pts = []; list.forEach(function (p) { pts[p.i] = p; });
      var names = list.filter(function (p) { return p.n > 0; }).map(function (p) { return p.name; }); /* a faint dot has no name of its own */
      map.setFilter("lbl-town-base", townFilter("base", names));
      map.setFilter("lbl-town", townFilter("detail", names));
      map.getSource("cities").setData({ type: "FeatureCollection", features: list.filter(function (p) { return p.n > 0; }).map(feature) });
      map.getSource("off").setData({ type: "FeatureCollection", features: list.filter(function (p) { return !p.n; }).map(feature) });
      paintSel();
    },
    select: function (i) { cur = i; paintSel(); map.setFilter("dot-name", nameFilter(i)); },
    fit: fit,
    whole: function () { map.fitBounds(US, { padding: 16, duration: dur }); },
    city: function (p) { map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 10), duration: dur }); },
    /* the cities a view shows, for the "N cities in view" line */
    inView: function () { var b = map.getBounds(); return pts.filter(function (p) { return p && p.n > 0 && b.contains([p.lon, p.lat]); }); },
    resize: function () { map.resize(); }
  };
  return new Promise(function (ok, fail) {
    var done = false;
    map.once("load", function () { done = true; ok(api); });
    /* a missing tile file is a failed map (map.js keeps the drawn one); a missing letter range only drops a few labels */
    map.on("error", function (e) { if (!done && e && /^(base|detail)$/.test(e.sourceId || "")) { done = true; fail(e.error); } });
    /* the drawn map works the whole time, so a slow phone can take its time; after a minute it is given up */
    setTimeout(function () { if (!done) { done = true; map.remove(); fail(new Error("the street map took too long")); } }, 60000);
  });
}

/* map.js asks for this file with a module script tag and waits for this call (a browser too old for modules never runs it) */
if (window.TIG && window.TIG.mapGLStart) window.TIG.mapGLStart(create);
