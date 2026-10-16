/* Map page: one dot per city named on a program card (data/map.json), on a US map drawn by this site (assets/img/us-states.svg).
   The age, pay and open filters run L.matches on data/entries-map.json, the lite rows with only the keys this page reads.
   The map is hidden from screen readers: the list under it holds every program, by state and city.
   "Near me" asks for the location only after a tap. The distance math runs here, in the browser. The location is never
   put in the address, in storage, in a cookie or in any request.
   Where the browser can draw WebGL, map-gl.js swaps the drawn map for a street map you can drag and zoom, with the same dots;
   gl is then its controls, and every zoom below goes to it as well. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var NS = null, W = 975, H = 610; /* NS: the SVG namespace, read from the map file once it loads */
  var NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "Washington, DC", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", BC: "British Columbia" };
  /* The SVG draws each state as a path with class st, the country outline as nation and the British Columbia box as bc
     (style.css colors them). The box is tools/geo/project.mjs BC_BOX. */
  var BC_BOX = [2, 2, 56, 76];
  var anim = G.motionOK();
  var f = { age: "", paid: false, open: false };
  var data, byId = {}, pts = [], svg = null, dotsG, ring, label, vb = [0, 0, W, H], cur = null, views = [], gl = null;
  function now() { return Date.now(); }
  function filt() { return { age: f.age, paid: f.paid ? ["pay"] : [], when: f.open ? "open" : "" }; }
  var okCache = null;
  function ok(id) {
    if (!okCache) okCache = {};
    if (!(id in okCache)) { var e = byId[id], s = filt(); okCache[id] = !!e && L.matches(e, s, now()); }
    return okCache[id];
  }
  function plural(n, one, many) { return n.toLocaleString("en-US") + " " + (n === 1 ? one : many); }
  /* Same words and colors as the Programs page cards (find.js statusTag) */
  function statusTag(e) {
    var st = L.effStatus(e, now());
    if (st === "open-now") return '<span class="tag good">Open now</span>';
    if (st === "opens-soon") return '<span class="tag y">Opens soon</span>';
    if (st === "rolling") return '<span class="tag good">Apply anytime</span>';
    if (st === "year-round") return '<span class="tag good">Year-round</span>';
    if (st === "event") return '<span class="tag y">Event</span>';
    if (st === "closed-expect-reopen") return '<span class="tag ghost">Closed, check back</span>';
    if (st === "event-passed") return '<span class="tag ghost">Event passed</span>';
    return '<span class="tag ghost">Dates unconfirmed</span>';
  }
  function progLi(id) {
    var e = byId[id]; if (!e) return "";
    return '<li><a href="find.html#p-' + G.esc(id) + '">' + G.esc(e.name) + "</a>" + (e.org ? ' <span class="small muted">' + G.esc(e.org) + "</span>" : "") + " " + statusTag(e) + "</li>";
  }
  function sorted(ids) {
    return L.sortList(ids.map(function (id) { return byId[id]; }).filter(Boolean), "best", now()).map(function (e) { return e.id; });
  }
  function cityName(p) { return p.s === "DC" ? p.k : p.k.replace(/, [A-Z]{2}$/, ""); }

  /* ---- dots ---- */
  /* dot radius in screen pixels: by the square root of the count, so a dot's area grows with its programs. Smaller on a phone-width map. */
  function pxSize(n) { return (n ? 2.6 + 1.15 * Math.sqrt(n) : 2.2) * Math.max(0.55, Math.min(1, Math.sqrt(((svg && svg.clientWidth) || W) / W))); }
  /* SVG units per screen pixel, with dots growing a little as the map zooms in */
  function unit() {
    var cw = (svg && svg.clientWidth) || W;
    return (vb[2] / cw) * Math.pow(W / vb[2], 0.2);
  }
  var tw = { on: false, zoom: null };
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function draw() {
    if (!svg) return;
    var u = unit();
    svg.setAttribute("viewBox", vb.map(function (v) { return Math.round(v * 10) / 10; }).join(" "));
    pts.forEach(function (p) { p.el.setAttribute("r", (Math.max(0, p.sz) * u).toFixed(2)); });
    if (bcl) {
      /* 10 screen pixels, drawn only when the name fits inside the box (zoomed in); the note under the map names the box too */
      var px = vb[2] / (svg.clientWidth || W);
      bcl.setAttribute("font-size", (10 * px).toFixed(2)); bcl.setAttribute("y", (BC_BOX[1] + 13 * px).toFixed(1));
      if (BC_BOX[2] / px >= 84) bcl.removeAttribute("hidden"); else bcl.setAttribute("hidden", "");
    }
    selBox = null;
    if (cur) {
      var r = Math.max(0, cur.sz) * u;
      ring.setAttribute("cx", cur.x); ring.setAttribute("cy", cur.y); ring.setAttribute("r", (r + 2 * u).toFixed(2));
      var fs = 13 * u, ly = cur.y - r - 4 * u, lw = cityName(cur).length * fs * 0.6;
      if (ly - fs < vb[1]) ly = cur.y + r + fs + 2 * u;
      var lx = Math.min(Math.max(cur.x, vb[0] + lw / 2 + 2 * u), vb[0] + vb[2] - lw / 2 - 2 * u);
      label.setAttribute("x", lx.toFixed(1)); label.setAttribute("y", ly.toFixed(1));
      label.setAttribute("font-size", fs.toFixed(2)); label.setAttribute("stroke-width", (3 * u).toFixed(2));
      /* a picked city outside the view (after a zoom elsewhere) keeps its ring but not a name pinned to the edge */
      if (inView(cur)) { label.removeAttribute("hidden"); selBox = [lx - lw / 2, ly - fs, lw, fs * 1.2]; } else label.setAttribute("hidden", "");
    }
  }
  var selBox = null;
  function inView(p) { return p.x > vb[0] && p.x < vb[0] + vb[2] && p.y > vb[1] && p.y < vb[1] + vb[3]; }
  function step(t) {
    var busy = false;
    pts.forEach(function (p) {
      if (p.t0 == null) return;
      var k = (t - p.t0 - p.delay) / 320;
      if (k <= 0) { p.sz = p.from; busy = true; } else if (k >= 1) { p.sz = p.to; p.t0 = null; } else { p.sz = p.from + (p.to - p.from) * ease(k); busy = true; }
    });
    var z = tw.zoom;
    if (z) {
      var k = Math.min(1, (t - z.t0) / 520), e = ease(k);
      vb = z.from.map(function (v, i) { return v + (z.to[i] - v) * e; });
      if (k >= 1) { tw.zoom = null; draw(); placeLabels(); } else busy = true;
    }
    draw();
    if (busy) requestAnimationFrame(step); else tw.on = false;
  }
  function kick() { if (!tw.on) { tw.on = true; requestAnimationFrame(step); } }
  /* Sizes every dot for the current filters. first: the dots grow in from west to east. */
  function resize(first) {
    var t0 = typeof performance !== "undefined" ? performance.now() : 0;
    pts.forEach(function (p) {
      p.n = p.ids.filter(ok).length;
      p.el.setAttribute("class", "dot" + (p.n ? "" : " off") + (p === cur ? " sel" : ""));
      var to = pxSize(p.n);
      if (anim && svg) { p.from = first ? 0 : p.sz; p.to = to; p.t0 = t0; p.delay = first ? Math.round((p.x / W) * 700) : 0; }
      else { p.sz = to; p.t0 = null; }
    });
    /* faded dots at the bottom, then lit ones from big to small, so a small city stays visible on top of a big one */
    pts.slice().sort(function (a, b) { return (a.n ? 1 : 0) - (b.n ? 1 : 0) || b.n - a.n || b.ids.length - a.ids.length; }).forEach(function (p) { dotsG.appendChild(p.el); });
    if (anim && svg) kick(); else draw();
    if (gl) gl.setData(glList());
  }
  function glList() { return pts.map(function (p, i) { return { i: i, name: cityName(p), lat: p.lat, lon: p.lon, n: p.n }; }); }

  /* ---- zoom views, from the groups lib.js already defines ---- */
  function stateCodes(labelText) {
    var g = L.PICK_GROUPS.filter(function (x) { return x[0] === labelText; })[0] || [], out = [];
    (g[3] || []).forEach(function (sid) {
      L.STATES.forEach(function (s) { if (s[0] === sid && L.STATE_OF[s[2]]) out.push(L.STATE_OF[s[2]].toUpperCase()); });
    });
    return out;
  }
  function regionSet(ids) { var out = {}; ids.forEach(function (r) { if (r !== "statewide") out[r] = 1; }); return out; }
  function areaRegions(areaId) {
    var a = L.AREAS.filter(function (x) { return x[0] === areaId; })[0], out = [];
    (a ? a[2] : []).forEach(function (cid) { L.CITIES.forEach(function (c) { if (c[0] === cid) out = out.concat(c[2]); }); });
    return regionSet(out);
  }
  /* a city belongs to a sub-state view when at least half of its cards carry one of the view's regions */
  function inRegions(p, rs) {
    var hit = p.ids.filter(function (id) { var e = byId[id]; return e && (e.regions || []).some(function (r) { return rs[r]; }); }).length;
    return hit * 2 >= p.ids.length;
  }
  function makeViews() {
    var hubSocal = (L.HUBS.filter(function (h) { return h[0] === "socal"; })[0] || [0, 0, []])[2];
    var south = stateCodes("South and DC area").concat(["DC"]);
    var defs = [
      ["all", "Whole map", null],
      ["ca", "California", stateCodes("California")],
      ["bay", "Bay Area", areaRegions("bay-area")],
      ["socal", "Southern California", regionSet(hubSocal)],
      ["pnw", "Pacific Northwest", stateCodes("Pacific Northwest")],
      ["tx", "Texas", stateCodes("Texas")],
      ["mw", "Midwest", stateCodes("Midwest")],
      ["ne", "Northeast", stateCodes("Northeast")],
      ["se", "Southeast", south]
    ];
    views = defs.map(function (d) {
      if (!d[2]) return { id: d[0], label: d[1], box: [0, 0, W, H], list: null };
      var members = Array.isArray(d[2]) ? pts.filter(function (p) { return d[2].indexOf(p.s) > -1; }) : pts.filter(function (p) { return p.s === "CA" && inRegions(p, d[2]); });
      if (!Array.isArray(d[2])) members = trim(members);
      if (!members.length) return null;
      var b = boxOf(members, Array.isArray(d[2]));
      if (d[0] === "pnw") b = [Math.min(b[0], BC_BOX[0]), Math.min(b[1], BC_BOX[1]), Math.max(b[2], BC_BOX[0] + BC_BOX[2]), Math.max(b[3], BC_BOX[1] + BC_BOX[3])];
      if (d[0] === "pnw") members = members.concat(pts.filter(function (p) { return p.s === "BC"; }));
      return { id: d[0], label: d[1], box: fit(b[0], b[1], b[2], b[3], 0.1, 70), list: members };
    }).filter(Boolean);
  }
  /* [x0, y0, x1, y1] around the dots, and around the outline of each of their states when whole is true (so a state's edges stay in view).
     The outline comes from the browser's own measure of the drawn state; without one (a test page) the dots alone set the box. */
  function boxOf(list, whole) {
    var b = [Infinity, Infinity, -Infinity, -Infinity], seen = {};
    function add(x0, y0, x1, y1) { b = [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)]; }
    list.forEach(function (p) {
      add(p.x, p.y, p.x, p.y);
      if (!whole || seen[p.s]) return;
      seen[p.s] = 1;
      var el = svg && svg.querySelector("#st-" + p.s) /* a state outline in us-states.svg */, r = null;
      try { r = el && el.getBBox ? el.getBBox() : null; } catch (e) { r = null; }
      if (r && r.width) add(r.x, r.y, r.x + r.width, r.y + r.height);
    });
    return b;
  }
  /* Leaves out a far-off city (a card tagged for the area but named somewhere else), so the view stays on the area itself */
  function trim(list) {
    if (list.length < 4) return list;
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[a.length >> 1]; }
    var mx = med(list.map(function (p) { return p.x; })), my = med(list.map(function (p) { return p.y; }));
    var d = list.map(function (p) { return Math.hypot(p.x - mx, p.y - my); }), md = med(d);
    return list.filter(function (p, i) { return d[i] <= Math.max(25, 3 * md); });
  }
  /* a box around x0..x1, y0..y1 with padding, at least minW wide, with the map's own shape (975 by 610) */
  function fit(x0, y0, x1, y1, pad, minW) {
    var w = Math.max(x1 - x0, minW), h = Math.max(y1 - y0, minW * H / W);
    w *= 1 + 2 * pad; h *= 1 + 2 * pad;
    if (w / h < W / H) w = h * W / H; else h = w * H / W;
    if (w > W) { w = W; h = H; }
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, x = cx - w / 2, y = cy - h / 2;
    x = Math.min(Math.max(x, 0), W - w); y = Math.min(Math.max(y, 0), H - h);
    return [x, y, w, h];
  }
  /* the zoom button for view id shows pressed; any other zoom (to a city, a state or the closest cities) presses none.
     geo is the same place for the street map: { city: p }, or { list: [cities], max: zoom }, or null for the whole map. */
  function zoomTo(box, id, geo) {
    Array.prototype.forEach.call($("mZoom").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === id)); });
    if (gl) {
      if (!geo || !geo.list && !geo.city) gl.whole(); else if (geo.city) gl.city(geo.city); else gl.fit(geo.list, geo.max);
      return;
    }
    if (anim && svg) { if (labelsG) labelsG.textContent = ""; tw.zoom = { from: vb.slice(), to: box.slice(), t0: performance.now() }; kick(); }
    else { vb = box.slice(); draw(); placeLabels(); }
  }
  /* When zoomed in, name the biggest cities in view, skipping a name that would overlap one already placed */
  var labelsG = null, bcl = null;
  function placeLabels() {
    if (!svg || !labelsG) return;
    labelsG.textContent = "";
    if (vb[2] > 700) return;
    var cw = svg.clientWidth || W, px = vb[2] / cw, fs = 12 * px, u = unit(), boxes = selBox ? [selBox] : [], placed = 0;
    var lit = pts.filter(function (p) { return p.n > 0 && inView(p); });
    /* a name may not cover another lit dot, or the picked city's own name */
    function hitsDot(b, own) {
      return lit.some(function (q) {
        if (q === own) return false;
        var r = Math.max(0, q.sz) * u, cx = Math.min(Math.max(q.x, b[0]), b[0] + b[2]), cy = Math.min(Math.max(q.y, b[1]), b[1] + b[3]);
        return Math.hypot(q.x - cx, q.y - cy) < r;
      });
    }
    lit.filter(function (p) { return p !== cur; })
      .sort(function (a, b) { return b.n - a.n; }).forEach(function (p) {
        if (placed >= 12) return;
        var t = cityName(p), w = t.length * fs * 0.6, r = p.sz * u, b = [p.x - w / 2, p.y + r + 1 * px, w, fs * 1.1];
        if (b[0] < vb[0] || b[0] + b[2] > vb[0] + vb[2] || b[1] + b[3] > vb[1] + vb[3]) return;
        if (boxes.some(function (o) { return b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3]; }) || hitsDot(b, p)) return;
        boxes.push(b); placed++;
        var el = document.createElementNS(NS, "text");
        el.setAttribute("x", p.x.toFixed(1)); el.setAttribute("y", (b[1] + fs * 0.85).toFixed(1)); el.setAttribute("text-anchor", "middle");
        el.setAttribute("font-size", fs.toFixed(2)); el.setAttribute("stroke-width", (3 * px).toFixed(2));
        el.textContent = t; labelsG.appendChild(el);
      });
  }
  function setView(id) {
    if (!svg) return;
    var v = views.filter(function (x) { return x.id === id; })[0]; if (!v) return;
    zoomTo(v.box, id, v.list && { list: v.list, max: 9 });
  }

  /* ---- the city panel ---- */
  /* how: "tap" (a dot or a Close by button) brings the panel heading into view; "pick" (a city from the box or a list) brings the map
     to the top of the screen so the zoom is seen; nothing leaves focus where it is */
  function openCity(p, how) {
    if (cur && cur !== p) cur.el.setAttribute("class", "dot" + (cur.n ? "" : " off"));
    cur = p;
    if (gl) gl.select(pts.indexOf(p));
    if (svg) {
      p.el.setAttribute("class", "dot sel" + (p.n ? "" : " off"));
      ring.removeAttribute("hidden"); label.removeAttribute("hidden");
      ring.setAttribute("class", "ring" + (anim ? " pulse" : ""));
      label.textContent = cityName(p);
      draw();
      placeLabels();
    }
    var match = p.ids.filter(ok), rest = p.ids.length - match.length;
    $("mPanelH").textContent = p.k;
    $("mPanelNote").textContent = !match.length
      ? (rest === 1 ? "The one program here does not match your choices. Turn off a filter to see it." : "None of the " + plural(rest, "program", "programs") + " here match your choices. Turn off a filter to see them.")
      : (rest ? plural(match.length, "program matches", "programs match") + " your choices. " + plural(rest, "more here does", "more here do") + " not." : plural(match.length, "program", "programs") + " here.") + " Each one opens on the Programs page.";
    $("mPanelList").innerHTML = sorted(match).map(progLi).join("");
    /* the programs for the whole state and the online ones are not dots, so the panel points to them in the list */
    var sw = (data.statewide[p.s] || []).filter(ok).length, on = data.online.filter(ok).length, more = [];
    if (sw) more.push(groupLink(p.s, plural(sw, "program", "programs") + " for all of " + NAMES[p.s]));
    if (on) more.push(groupLink("online", plural(on, "program", "programs") + " online"));
    $("mPanelMore").innerHTML = more.length ? "Plus " + more.join(" and ") + ", in the list below." : "";
    $("mPanelMore").hidden = !more.length;
    $("mPanelGo").innerHTML = goLinks(p);
    $("mPanelGo").hidden = false;
    var near = pts.filter(function (q) { return q !== p && q.n > 0; }).map(function (q) { return { q: q, d: miles(p.lat, p.lon, q.lat, q.lon) }; })
      .filter(function (r) { return r.d <= 30; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 6);
    $("mPanelNearList").innerHTML = near.map(function (r) { return '<button class="chip" type="button" data-i="' + pts.indexOf(r.q) + '">' + G.esc(r.q.k) + '<span class="n">' + r.q.n + "</span></button>"; }).join("");
    wire($("mPanelNearList"), false);
    $("mPanelNear").hidden = !near.length;
    $("mPanel").hidden = false;
    if (how) show($("mPanelH"), how === "pick");
  }
  /* Bus or train directions to the city, in the reader's own maps app. Only the city name goes in the link, and nothing is
     sent until the link is tapped; the other site then knows the city, as with any program link. */
  function goLinks(p) {
    var to = encodeURIComponent(p.k + (p.s === "BC" ? ", Canada" : ""));
    return "<b>Get there by bus or train:</b> " +
      '<a href="https://www.google.com/maps/dir/?api=1&amp;travelmode=transit&amp;destination=' + to + '" target="_blank" rel="noopener">Google Maps</a> or ' +
      '<a href="https://maps.apple.com/?dirflg=r&amp;daddr=' + to + '" target="_blank" rel="noopener">Apple Maps</a>. They open the other app at the city, not a program&rsquo;s address.';
  }
  function groupLink(code, text) { return '<a href="#g-' + G.esc(code) + '" data-g="' + G.esc(code) + '">' + G.esc(text) + "</a>"; }
  /* Moves focus to heading h without a jump. map: the map comes to the top of the screen (under the sticky header), so a zoom is seen.
     Else the heading scrolls only as far as it needs to, so a long panel does not push the map away. */
  function show(h, map) {
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    var t = map && svg ? $("mapBox") : h;
    if (t.scrollIntoView) t.scrollIntoView({ block: t === h ? "nearest" : "start", behavior: anim ? "smooth" : "auto" });
  }
  function closeCity() {
    if (cur && svg) { cur.el.setAttribute("class", "dot" + (cur.n ? "" : " off")); ring.setAttribute("hidden", ""); label.setAttribute("hidden", ""); }
    cur = null; $("mPanel").hidden = true;
    if (gl) gl.select(null);
  }
  /* A tap picks the dot it lands on, or the closest one within reach, so a small dot is easy to hit with a finger.
     The score is the distance over the dot's size: the middle of a small dot drawn over a big one picks the small city, and the rest
     of the big dot picks the big city. A tap within a pixel of two middles goes to the bigger dot, so a big city
     never loses to a neighbor drawn a pixel away (zoom in, or use Close by, for the other). A faded dot loses to a lit one nearby. */
  function nearestDot(sx, sy) {
    var u = unit(), best = null, bs = Infinity;
    pts.forEach(function (p) {
      var r = Math.max(p.t0 == null ? p.sz : p.to, 2) * u, d = Math.hypot(p.x - sx, p.y - sy), s = Math.max(d, u) / r; /* the size a growing dot is heading to */
      if (d - r > 16 * u) return;
      if (!p.n) s = 2 * s + 0.5;
      if (s < bs) { bs = s; best = p; }
    });
    return best;
  }
  function onTap(ev) {
    var r = svg.getBoundingClientRect();
    /* with no layout (a test page) the clicked dot itself */
    var p = r.width ? nearestDot(vb[0] + (ev.clientX - r.left) * vb[2] / r.width, vb[1] + (ev.clientY - r.top) * vb[3] / r.height) : ev.target && ev.target.__pt;
    if (p) openCity(p, "tap");
  }

  /* ---- near me, near a typed city, or the cities of a state ---- */
  function miles(a, b, c, d) {
    var R = 3958.8, rad = Math.PI / 180, dl = (c - a) * rad, dn = (d - b) * rad;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  /* the lit cities closest to lat, lon, leaving out skip (the city the list is for) */
  function closest(lat, lon, skip) {
    return pts.filter(function (p) { return p.n > 0 && p !== skip; }).map(function (p) { return { p: p, d: miles(lat, lon, p.lat, p.lon) }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
  }
  function cityLi(p, text) {
    return '<li><button class="chip" type="button" data-i="' + pts.indexOf(p) + '">' + G.esc(p.k) + '</button><br><span class="small">' + G.esc(text) + "</span></li>";
  }
  /* The box under the map for q: { lat, lon, why, skip } (closest cities) or { state } (that state's biggest cities).
     It is asked again when a filter changes (quiet: no focus move). */
  var nearQ = null;
  function showNear(q, quiet) {
    nearQ = q;
    var why, items;
    if (q.state) {
      var nm = NAMES[q.state] || q.state, top = pts.filter(function (p) { return p.s === q.state && p.n > 0; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
      var sw = (data.statewide[q.state] || []).filter(ok).length;
      $("mNearH").textContent = "Cities in " + nm;
      why = G.esc(top.length ? "The cities in " + nm + " with the most programs that match your choices." : "No city in " + nm + " has a program that matches your choices.") +
        (sw ? " Also " + groupLink(q.state, plural(sw, "program", "programs") + " for all of " + nm) + "." : "");
      items = top.map(function (p) { return cityLi(p, plural(p.n, "program", "programs")); });
    } else {
      var list = closest(q.lat, q.lon, q.skip), far = list.length && list[0].d > 40;
      $("mNearH").textContent = "Closest cities";
      why = G.esc(list.length ? q.why : "No city has a program that matches your choices. Turn off a filter to see more.") +
        (far ? " " + G.esc("The closest one is about " + plural(Math.round(list[0].d), "mile", "miles") + " away.") + ' <a href="#list">See programs for a whole state, or online</a>.' : "");
      items = list.map(function (r) { return cityLi(r.p, plural(r.p.n, "program", "programs") + ", " + (r.d < 1 ? "less than 1 mile" : "about " + plural(Math.round(r.d), "mile", "miles"))); });
    }
    $("mNearWhy").innerHTML = why;
    $("mNearList").innerHTML = items.join("");
    wire($("mNearList"), true);
    $("mNearBox").hidden = false;
    if (!quiet) show($("mNearH"), true);
  }
  /* each city button in a list opens that city (zooming to it when zoom is true) */
  function wire(box, zoom) {
    Array.prototype.forEach.call(box.querySelectorAll("button[data-i]"), function (b) {
      b.addEventListener("click", function () {
        var p = pts[+b.getAttribute("data-i")]; if (!p) return;
        if (zoom) zoomTo(fit(p.x, p.y, p.x, p.y, 0.1, 150), null, { city: p });
        openCity(p, zoom ? "pick" : "tap");
      });
    });
  }
  function nearMe() {
    var st = $("mNearStatus"), geo = navigator.geolocation;
    $("mNearBox").hidden = true; nearQ = null;
    if (!geo) { st.textContent = "This browser cannot share a location. Type your city instead."; return; }
    st.textContent = "Asking your browser where you are.";
    geo.getCurrentPosition(function (pos) {
      var lat = pos.coords.latitude, lon = pos.coords.longitude, five = closest(lat, lon, null).slice(0, 5).map(function (r) { return r.p; });
      st.textContent = five.length ? "Done. The closest cities are under the map." : "";
      closeCity();
      /* the street map moves to these program cities, never to the reader's own point (see map-gl.js) */
      if (five.length) { var b = boxOf(five, false); zoomTo(fit(b[0], b[1], b[2], b[3], 0.15, 150), null, { list: five, max: 10 }); }
      showNear({ lat: lat, lon: lon, why: "The 10 closest cities to you with programs that match your choices. Your location was not saved or sent." }, false);
    }, function () {
      st.textContent = "We could not get your location. Type your city instead.";
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }
  function pickPlace() {
    var v = $("mCity").value, m = /^(p|s):(.+)$/.exec(v);
    if (!m) return;
    if (m[1] === "p") {
      var p = pts[+m[2]]; if (!p) return;
      zoomTo(fit(p.x, p.y, p.x, p.y, 0.1, 150), null, { city: p });
      showNear({ lat: p.lat, lon: p.lon, skip: p, why: "The 10 closest cities to " + p.k + " with programs that match your choices." }, true);
      openCity(p, "pick");
    } else {
      var inS = pts.filter(function (q) { return q.s === m[2]; });
      if (!inS.length) return;
      var b = m[2] === "BC" ? [BC_BOX[0], BC_BOX[1], BC_BOX[0] + BC_BOX[2], BC_BOX[1] + BC_BOX[3]] : boxOf(inS, true);
      zoomTo(fit(b[0], b[1], b[2], b[3], 0.1, 90), null, { list: inS, max: 8 });
      closeCity();
      showNear({ state: m[2] }, false);
    }
  }
  /* A link to a group of the list (data-g) opens that group before the page moves to it */
  function openGroup(code) {
    var x = groups.filter(function (g) { return g.code === code; })[0];
    if (!x || !x.el) return;
    if (x.dirty) fill(x);
    x.el.open = true;
  }
  /* What to say when the typed place is not on the map: a near spelling, a state named at the end ("Houston, TX"), and Near me. */
  function noPlace(t) {
    function nrm(v) { return v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    function one(a, b) { /* a and b differ by at most one letter added, dropped or changed */
      if (Math.abs(a.length - b.length) > 1) return false;
      var i = 0, j = 0, e = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++e > 1) return false;
        if (a.length >= b.length) i++;
        if (b.length >= a.length) j++;
      }
      return e + (a.length - i) + (b.length - j) <= 1;
    }
    var n = nrm(t), sel = $("mCity"), hits = [];
    if (n.length < 4) return [];
    var words = n.split(" "), last = words[words.length - 1], two = words.slice(-2).join(" ");
    for (var i = 1; i < sel.options.length && hits.length < 3; i++) {
      var o = sel.options[i], v = o.value, nm = nrm(o.textContent.replace(/\s*\(\d+\)$/, "")), city = nm.replace(/ [a-z]{2}$/, "");
      var st = v.indexOf("s:") === 0 ? v.slice(2).toLowerCase() : "";
      if (st ? (last === st || n.slice(-nm.length - 1) === " " + nm || two === nm) && words.length > 1 : one(n, city) || one(n, city.slice(0, n.length))) hits.push(o);
    }
    return hits;
  }
  var placeBox = null;
  function placeHelp() {
    var q = placeBox.input, note = q.parentNode.lastElementChild; /* common.js placeSearch: the box, its list, then its note */
    if (note.hidden || !/^No place called/.test(note.textContent)) return;
    var t = q.value.trim(), hits = noPlace(t);
    note.textContent = "No program in this guide names “" + t + "” as its city. " + (hits.length ? "Did you mean " : "Tap Near me to see the closest cities, or type your state.");
    hits.forEach(function (o, k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = o.textContent;
      b.addEventListener("click", function () { $("mCity").value = o.value; $("mCity").dispatchEvent(new Event("change", { bubbles: true })); q.value = ""; note.hidden = true; });
      note.appendChild(b);
      note.appendChild(document.createTextNode(k < hits.length - 1 ? " or " : "? Or tap Near me."));
    });
  }

  /* ---- the list under the map ---- */
  var groups = [];
  function buildGroups() {
    var by = {};
    function g(code) { return by[code] || (by[code] = { code: code, name: NAMES[code] || code, cities: [], any: [] }); }
    pts.forEach(function (p) { g(p.s).cities.push(p); });
    Object.keys(data.statewide).forEach(function (s) { g(s).any = data.statewide[s]; });
    groups = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    groups.forEach(function (x) { x.cities.sort(function (a, b) { return a.k < b.k ? -1 : 1; }); });
    groups.push({ code: "online", name: "Online", flat: data.online }, { code: "national", name: "Across the US", flat: data.national }, { code: "multi", name: "In more than one place", flat: data.multi });
  }
  function groupCount(x) {
    if (x.flat) return x.flat.filter(ok).length;
    return x.cities.reduce(function (a, p) { return a + p.n; }, 0) + x.any.filter(ok).length;
  }
  function groupBody(x) {
    var h = "";
    function block(title, ids) {
      var m = ids.filter(ok);
      if (!m.length) return "";
      return "<h3>" + G.esc(title) + ' <span class="small muted">' + G.esc(plural(m.length, "program", "programs")) + '</span></h3><ul class="mlist">' + sorted(m).map(progLi).join("") + "</ul>";
    }
    if (x.flat) return block(x.name, x.flat);
    x.cities.forEach(function (p) { h += block(p.k, p.ids); });
    h += block("Anywhere in " + x.name, x.any);
    return h;
  }
  function paintList(all) {
    var box = $("mListBox"), shown = 0;
    groups.forEach(function (x) {
      var n = groupCount(x), d = x.el;
      if (!d) {
        d = x.el = document.createElement("details"); d.className = "card mstate"; d.id = "g-" + x.code; d.setAttribute("data-g", x.code);
        d.innerHTML = '<summary><b></b> <span class="n"></span></summary><div></div>';
        d.addEventListener("toggle", function () { if (d.open && x.dirty) fill(x); });
        box.appendChild(d);
      }
      d.hidden = !n; shown += n ? 1 : 0;
      d.querySelector("summary b").textContent = x.name;
      d.querySelector(".n").textContent = plural(n, "program", "programs");
      x.dirty = true;
      if (d.open || all) fill(x);
    });
    var none = $("mListNone");
    if (!none) { none = document.createElement("p"); none.id = "mListNone"; none.className = "card"; none.textContent = "No program matches your choices. Try another age, or turn off a filter."; box.appendChild(none); }
    none.hidden = shown > 0;
  }
  function fill(x) { x.el.lastElementChild.innerHTML = groupBody(x); x.dirty = false; }

  /* ---- filters ---- */
  function count() {
    var onMap = pts.reduce(function (a, p) { return a + p.n; }, 0), cities = pts.filter(function (p) { return p.n; }).length;
    var other = groups.reduce(function (a, x) { return a + (x.flat ? x.flat.filter(ok).length : x.any.filter(ok).length); }, 0);
    $("mCount").textContent = plural(onMap, "program", "programs") + " in " + plural(cities, "place", "places") + " on the map. " + plural(other, "more program covers", "more programs cover") + " a whole state, are online or run in several places. They are in the list below.";
  }
  function refresh() {
    okCache = null;
    resize(false);
    placeLabels();
    paintList(false);
    count();
    if (cur && !$("mPanel").hidden) openCity(cur);
    if (nearQ && !$("mNearBox").hidden) showNear(nearQ, true);
    if (gl) viewSoon();
  }

  function setup(svgText) {
    var box = $("mapBox");
    if (svgText) {
      var doc = new DOMParser().parseFromString(svgText, "image/svg+xml"), root = doc.documentElement;
      if (root && root.nodeName.toLowerCase() === "svg") {
        svg = document.importNode(root, true); NS = svg.namespaceURI;
        svg.removeAttribute("role"); svg.removeAttribute("aria-label");
        svg.setAttribute("focusable", "false"); svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        var t = bcl = document.createElementNS(NS, "text");
        t.setAttribute("class", "bcl"); t.setAttribute("x", BC_BOX[0] + 4); t.setAttribute("y", BC_BOX[1] + 9); t.setAttribute("hidden", ""); t.textContent = "Vancouver, BC";
        svg.appendChild(t);
        dotsG = document.createElementNS(NS, "g"); dotsG.setAttribute("class", "dots"); svg.appendChild(dotsG);
        labelsG = document.createElementNS(NS, "g"); labelsG.setAttribute("class", "labels"); svg.appendChild(labelsG);
        ring = document.createElementNS(NS, "circle"); ring.setAttribute("class", "ring"); ring.setAttribute("hidden", ""); svg.appendChild(ring);
        label = document.createElementNS(NS, "text"); label.setAttribute("class", "mlabel"); label.setAttribute("text-anchor", "middle"); label.setAttribute("hidden", ""); svg.appendChild(label);
        box.appendChild(svg);
        if (anim) box.classList.add("map-anim");
      }
    }
    if (!svg) { box.hidden = true; dotsG = document.createElement("div"); }
    pts.forEach(function (p) {
      p.el = document.createElementNS(NS, "circle"); p.el.setAttribute("cx", p.x); p.el.setAttribute("cy", p.y); p.el.setAttribute("class", "dot");
      p.el.__pt = p; p.sz = 0; dotsG.appendChild(p.el);
    });
    if (svg) svg.addEventListener("click", onTap);
  }

  /* ---- the street map ---- */
  /* MapLibre 6 needs WebGL 2 */
  function glOK() {
    if (!window.WebGL2RenderingContext) return false;
    try { return !!document.createElement("canvas").getContext("webgl2"); } catch (e) { return false; }
  }
  var glWanted = glOK();
  /* the box takes the street map's height before anything draws, so the page does not jump when the street map arrives */
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  if (glWanted && !saveData) $("mapBox").classList.add("gl");
  /* "In this view": what the street map shows now, said once the map stops moving */
  var viewT = null;
  function viewSoon() { clearTimeout(viewT); viewT = setTimeout(viewLine, 800); }
  function viewLine() {
    if (!gl) return;
    var inV = gl.inView(), n = inV.reduce(function (a, q) { return a + q.n; }, 0), el = $("mView");
    el.textContent = inV.length ? "In this view: " + plural(n, "program", "programs") + " in " + plural(inV.length, "place", "places") + "." : "No city with a matching program is in this view. Zoom out, or pick a place above.";
    el.hidden = false;
  }
  function glFail() { glWanted = false; var box = $("mapBox"); box.classList.remove("gl", "gl-on"); var el = box.querySelector(".mgl"); if (el) el.remove(); }
  /* With the browser's data saver on, the street map (about 1 MB the first time) waits for a tap */
  function startGL() {
    if (!glWanted || !svg) { glFail(); return; }
    if (saveData) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn sm alt"; b.id = "mGLGo"; b.textContent = "Load the street map (about 1 MB)";
      b.addEventListener("click", function () { b.remove(); $("mapBox").classList.add("gl"); loadGL(); });
      $("mZoom").parentNode.insertBefore(b, $("mZoom"));
      return;
    }
    loadGL();
  }
  function loadGL() {
    var box = $("mapBox"), el = document.createElement("div"), root = new URL(".", document.baseURI);
    el.className = "mgl"; box.appendChild(el);
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "assets/vendor/maplibre/maplibre-gl.css"; document.head.appendChild(css);
    G.mapGLStart = function (create) {
      create({ el: el, root: root, anim: anim, onPick: function (i) { var p = pts[i]; if (p) openCity(p, "tap"); }, onMove: viewSoon }).then(function (api) {
        gl = api;
        box.classList.add("gl-on");
        $("mNote").textContent = "Drag the map to move it and use + and \u2212 to zoom. On a phone, move it with two fingers, or tap the full screen button. A number in a circle is how many programs are in the cities there; tap it to zoom in. A dot shows the city named on the program\u2019s card, not the exact address. Some programs cover a whole state, are online, or run in several places. They are in the list below the map, which also works with a keyboard or screen reader.";
        $("mStreet").hidden = false;
        /* the street map can be used by keyboard (arrows and plus or minus), so it is no longer hidden from screen readers */
        box.removeAttribute("aria-hidden"); box.setAttribute("role", "region"); box.setAttribute("aria-label", "Street map");
        gl.resize();
        gl.setData(glList());
        if (cur) gl.select(pts.indexOf(cur));
        viewSoon();
      }, glFail);
    };
    var pm = document.createElement("script"); pm.src = "assets/vendor/pmtiles.js";
    pm.onload = function () { var s = document.createElement("script"); s.type = "module"; s.src = "assets/js/map-gl.js"; s.onerror = glFail; document.head.appendChild(s); };
    pm.onerror = glFail;
    document.head.appendChild(pm);
  }

  Promise.all([
    G.fetchData("data/map.json").then(function (r) { if (!r.ok) throw new Error("map " + r.status); return r.json(); }),
    G.loadEntries("map"),
    G.fetchData("assets/img/us-states.svg").then(function (r) { return r.ok ? r.text() : ""; }, function () { return ""; })
  ]).then(function (res) {
    data = res[0];
    res[1].forEach(function (e) { byId[e.id] = e; });
    pts = data.points.concat(data.bc).map(function (p) { return { k: p.k, s: p.s, x: p.x, y: p.y, lat: p.lat, lon: p.lon, ids: p.ids, n: 0 }; });
    setup(res[2]);
    makeViews();
    /* tools/build.py ships the zoom buttons; one with no city on the map is hidden */
    Array.prototype.forEach.call($("mZoom").querySelectorAll("[data-v]"), function (b) { b.hidden = !views.some(function (v) { return v.id === b.getAttribute("data-v"); }); });
    $("mZoom").addEventListener("click", function (ev) { var b = ev.target.closest("[data-v]"); if (b) setView(b.getAttribute("data-v")); });
    for (var a = 12; a <= 18; a++) $("mAge").appendChild(Object.assign(document.createElement("option"), { value: String(a), textContent: String(a) }));
    if ($("mAge")._tpSync) $("mAge")._tpSync();
    $("mAge").addEventListener("change", function () { f.age = $("mAge").value; refresh(); });
    [["mPaid", "paid"], ["mOpen", "open"]].forEach(function (x) {
      $(x[0]).addEventListener("click", function () { f[x[1]] = !f[x[1]]; $(x[0]).setAttribute("aria-pressed", String(f[x[1]])); refresh(); });
    });
    $("mPanelX").addEventListener("click", function () { closeCity(); ($("mZoom").querySelector('[aria-pressed="true"]') || $("mZoom").querySelector("[data-v]")).focus(); });
    document.addEventListener("click", function (ev) { var a = ev.target.closest && ev.target.closest("a[data-g]"); if (a) openGroup(a.getAttribute("data-g")); });

    $("mNear").addEventListener("click", nearMe);
    /* The typed place box: every map city and state, with its program count, through the same search the Programs page uses */
    var sel = $("mCity"), totals = {};
    /* a state's count includes its programs for the whole state, the same number as its group in the list. DC is a city already. */
    pts.forEach(function (p) { totals[p.s] = (totals[p.s] || (data.statewide[p.s] || []).length) + p.ids.length; });
    delete totals.DC;
    pts.map(function (p, i) { return [p.k, "p:" + i, p.ids.length]; }).concat(Object.keys(totals).map(function (s) { return [NAMES[s] || s, "s:" + s, totals[s]]; }))
      .sort(function (a, b) { return b[2] - a[2] || (a[0] < b[0] ? -1 : 1); }) /* the search keeps this order among equal matches: bigger places first */
      .forEach(function (o) { sel.appendChild(Object.assign(document.createElement("option"), { value: o[1], textContent: o[0] + " (" + o[2] + ")" })); });
    placeBox = G.placeSearch(sel, { hide: true, caption: "", placeholder: "Type a city, like Oakland" });
    sel.addEventListener("change", pickPlace);
    placeBox.input.addEventListener("input", placeHelp);
    placeBox.input.addEventListener("focus", placeHelp); /* placeSearch writes its note again on focus */
    buildGroups();
    resize(true);
    paintList(false);
    count();
    $("mRead").textContent = "City points read " + data.read + ".";
    startGL();
    window.addEventListener("beforeprint", function () { groups.forEach(function (x) { if (x.dirty && x.el) fill(x); }); });
    window.addEventListener("resize", function () { if (svg) { pts.forEach(function (p) { if (p.t0 == null) p.sz = pxSize(p.n); }); draw(); } });
  }).catch(function () {
    $("mCount").textContent = "The map could not load. Try again, or use the Programs page.";
    $("mapBox").hidden = $("mZoom").hidden = true;
    $("mListBox").innerHTML = '<p class="card">The list could not load either. Reload the page, or use the <a href="find.html">Programs page</a>.</p>';
  });
})();
