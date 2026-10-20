/* Programs page map: the street map of the Map page (map-gl.js, MapLibre) under Your picks, always shown, with one dot per city in the list.
   Its box keeps its size from the start. find.js adds this file as the page starts, so the map draws while the list loads.
   find.js calls G.findMap.paint(list, state, pick) after each draw: list is every matching program (before a city is picked),
   pick is the city a dot tap chose ({ k, ids }) or null. A tap on a dot calls G.findCity, which keeps only that city's cards.
   With a place picked the map moves to the cities of that place, and with none it shows the whole map. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var box = $("fMapBox"), pts = [], at = {}, gl = null, last = null, placeKey = null, saveData = !!(navigator.connection && navigator.connection.saveData);
  function plural(n, one, many) { return n.toLocaleString("en-US") + " " + (n === 1 ? one : many); }
  function cityName(p) { return p.s === "DC" ? p.k : p.k.replace(/, [A-Z]{2}$/, ""); }
  function miles(a, b, c, d) {
    var R = 3958.8, rad = Math.PI / 180, dl = (c - a) * rad, dn = (d - b) * rad;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* Leaves out a far-off city (a card tagged for the area but named somewhere else), so the map stays on the place itself */
  function trim(list) {
    if (list.length < 4) return list;
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
    var la = med(list.map(function (p) { return p.lat; })), lo = med(list.map(function (p) { return p.lon; }));
    var d = list.map(function (p) { return miles(la, lo, p.lat, p.lon); }), md = med(d);
    return list.filter(function (p, i) { return d[i] <= Math.max(30, 3 * md); });
  }
  function say(html) { var w = $("fMapWait"); if (w) w.innerHTML = html; }
  function fail() {
    box.classList.remove("gl-on");
    var el = box.querySelector(".mgl"); if (el) el.remove();
    gl = null;
    say('The street map could not load here. <a href="map.html">Open the full map</a> instead.');
  }

  function paint(list, state, pick) {
    last = { list: list, state: state, pick: pick };
    if (!gl) return;
    pts.forEach(function (p) { p.n = 0; });
    list.forEach(function (e) { var p = at[e.id]; if (p) p.n++; });
    var lit = pts.filter(function (p) { return p.n > 0; }), n = lit.reduce(function (a, p) { return a + p.n; }, 0);
    gl.setData(pts.map(function (p, i) { return { i: i, name: cityName(p), lat: p.lat, lon: p.lon, n: p.n }; }));
    var pi = pick ? pts.findIndex(function (p) { return p.k === pick.k; }) : -1;
    gl.select(pi > -1 ? pi : null);
    $("fMapCount").textContent = lit.length
      ? plural(n, "program", "programs") + " in " + plural(lit.length, "city", "cities") + " on the map. Tap a dot to see only that city."
      : "No program in the list names a city on the map. Some cover a whole state or are online.";
    var c = $("fMapCity");
    if (pick) { c.firstElementChild.textContent = pick.k; c.hidden = false; } else c.hidden = true;
    /* the map moves only when the place changes, so a filter change does not undo the reader's own zoom */
    var key = (state.place || "") + "|" + (state.hubs || []).join(",");
    if (key === placeKey) return;
    placeKey = key;
    var some = trim(lit);
    if (key !== "|" && some.length) gl.fit(some, /^state:/.test(state.place || "") ? 7 : 10); else gl.whole();
  }
  G.findMap = { paint: function (list, state, pick) { paint(list, state, pick); } };

  function pickCity(i) {
    var p = pts[i]; if (!p) return;
    var ids = {}; p.ids.forEach(function (id) { ids[id] = 1; });
    if (G.findCity) G.findCity({ k: p.k, ids: ids });
  }
  $("fMapAll").addEventListener("click", function () { if (G.findCity) G.findCity(null); });

  function glOK() {
    if (!window.WebGL2RenderingContext) return false;
    try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
  }
  function start() {
    var el = document.createElement("div"), root = new URL(".", document.baseURI);
    el.className = "mgl"; box.appendChild(el);
    /* the street map shows as it draws (land, then roads and dots), not only once every first tile is in */
    box.classList.add("gl-on");
    if (window.ResizeObserver) new ResizeObserver(function () { if (gl) gl.resize(); }).observe(box);
    say("Loading the map.");
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "assets/vendor/maplibre/maplibre-gl.css"; document.head.appendChild(css);
    var dataP = G.fetchData("data/map.json").then(function (r) { if (!r.ok) throw new Error("map " + r.status); return r.json(); });
    G.mapGLStart = function (create) {
      Promise.all([dataP, create({ el: el, root: root, anim: G.motionOK(), onPick: pickCity })]).then(function (res) {
        pts = res[0].points.concat(res[0].bc).map(function (p) { return { k: p.k, s: p.s, lat: p.lat, lon: p.lon, ids: p.ids, n: 0 }; });
        pts.forEach(function (p) { p.ids.forEach(function (id) { at[id] = p; }); });
        gl = res[1];
        box.setAttribute("role", "region"); box.setAttribute("aria-label", "Street map of the programs");
        gl.resize();
        if (last) paint(last.list, last.state, last.pick);
      }, fail);
    };
    var pm = document.createElement("script"); pm.src = "assets/vendor/pmtiles.js";
    pm.onload = function () { var s = document.createElement("script"); s.type = "module"; s.src = "assets/js/map-gl.js"; s.onerror = fail; document.head.appendChild(s); };
    pm.onerror = fail;
    document.head.appendChild(pm);
  }
  if (!glOK()) { say('This browser cannot draw the street map. <a href="map.html">Open the full map</a> instead.'); return; }
  /* With the browser's data saver on, the street map (about 1 MB the first time) waits for a tap, as on the Map page */
  if (saveData) {
    say('<button class="btn sm alt" type="button" id="fMapGo">Load the map (about 1 MB)</button>');
    $("fMapGo").addEventListener("click", start);
    return;
  }
  start();
})();
