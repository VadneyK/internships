/* Map page: one dot per city named on a program card (data/map.json), on a US map drawn by this site (assets/img/us-states.svg).
   The age, pay and open filters run L.matches on data/entries-map.json, the lite rows with only the keys this page reads.
   The map is hidden from screen readers: the list under it holds every program, by state and city.
   "Near me" asks for the location only after a tap. The distance math runs here, in the browser. The location is never
   put in the address, in storage, in a cookie or in any request. */
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
  var data, byId = {}, pts = [], svg = null, dotsG, ring, label, vb = [0, 0, W, H], cur = null, views = [];
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
    if (bcl) bcl.setAttribute("font-size", Math.min(6, 9 * vb[2] / (svg.clientWidth || W)).toFixed(2));
    if (cur) {
      var r = Math.max(0, cur.sz) * u;
      ring.setAttribute("cx", cur.x); ring.setAttribute("cy", cur.y); ring.setAttribute("r", (r + 2 * u).toFixed(2));
      var fs = 13 * u, ly = cur.y - r - 4 * u;
      if (ly - fs < vb[1]) ly = cur.y + r + fs + 2 * u;
      label.setAttribute("x", Math.min(Math.max(cur.x, vb[0] + 40 * u), vb[0] + vb[2] - 40 * u).toFixed(1)); label.setAttribute("y", ly.toFixed(1));
      label.setAttribute("font-size", fs.toFixed(2)); label.setAttribute("stroke-width", (3 * u).toFixed(2));
    }
  }
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
    /* bigger dots first, so a small city on top of a big one can still be tapped */
    pts.slice().sort(function (a, b) { return b.n - a.n || b.ids.length - a.ids.length; }).forEach(function (p) { dotsG.appendChild(p.el); });
    if (anim && svg) kick(); else draw();
  }

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
      if (!d[2]) return { id: d[0], label: d[1], box: [0, 0, W, H] };
      var members = Array.isArray(d[2]) ? pts.filter(function (p) { return d[2].indexOf(p.s) > -1; }) : pts.filter(function (p) { return p.s === "CA" && inRegions(p, d[2]); });
      if (!Array.isArray(d[2])) members = trim(members);
      if (!members.length) return null;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      members.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
      if (d[0] === "pnw") { x0 = Math.min(x0, BC_BOX[0]); y0 = Math.min(y0, BC_BOX[1]); x1 = Math.max(x1, BC_BOX[0] + BC_BOX[2]); y1 = Math.max(y1, BC_BOX[1] + BC_BOX[3]); }
      return { id: d[0], label: d[1], box: fit(x0, y0, x1, y1, 0.12, 70) };
    }).filter(Boolean);
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
  function zoomTo(box) {
    if (anim && svg) { if (labelsG) labelsG.textContent = ""; tw.zoom = { from: vb.slice(), to: box.slice(), t0: performance.now() }; kick(); }
    else { vb = box.slice(); draw(); placeLabels(); }
  }
  /* When zoomed in, name the biggest cities in view, skipping a name that would overlap one already placed */
  var labelsG = null, bcl = null;
  function placeLabels() {
    if (!svg || !labelsG) return;
    labelsG.textContent = "";
    if (vb[2] > 500) return;
    var cw = svg.clientWidth || W, px = vb[2] / cw, fs = 12 * px, u = unit(), boxes = [], placed = 0;
    pts.filter(function (p) { return p.n > 0 && p !== cur && p.x > vb[0] && p.x < vb[0] + vb[2] && p.y > vb[1] && p.y < vb[1] + vb[3]; })
      .sort(function (a, b) { return b.n - a.n; }).forEach(function (p) {
        if (placed >= 12) return;
        var t = cityName(p), w = t.length * fs * 0.56, r = p.sz * u, b = [p.x - w / 2, p.y + r + 1 * px, w, fs * 1.1];
        if (b[0] < vb[0] || b[0] + b[2] > vb[0] + vb[2] || b[1] + b[3] > vb[1] + vb[3]) return;
        if (boxes.some(function (o) { return b[0] < o[0] + o[2] && o[0] < b[0] + b[2] && b[1] < o[1] + o[3] && o[1] < b[1] + b[3]; })) return;
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
    Array.prototype.forEach.call($("mZoom").children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === id)); });
    zoomTo(v.box);
  }

  /* ---- the city panel ---- */
  function openCity(p, focus) {
    if (cur && cur !== p) cur.el.setAttribute("class", "dot" + (cur.n ? "" : " off"));
    cur = p;
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
    $("mPanelNote").textContent = plural(match.length, "program", "programs") + (rest ? " match your choices. " + plural(rest, "more does", "more do") + " not." : " here.") + " Each one opens on the Programs page.";
    $("mPanelList").innerHTML = sorted(match).map(progLi).join("");
    var near = pts.filter(function (q) { return q !== p && q.n > 0; }).map(function (q) { return { q: q, d: miles(p.lat, p.lon, q.lat, q.lon) }; })
      .filter(function (r) { return r.d <= 30; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 6);
    $("mPanelNearList").innerHTML = near.map(function (r) { return '<button class="chip" type="button" data-i="' + pts.indexOf(r.q) + '">' + G.esc(r.q.k) + '<span class="n">' + r.q.n + "</span></button>"; }).join("");
    wire($("mPanelNearList"), false);
    $("mPanelNear").hidden = !near.length;
    $("mPanel").hidden = false;
    if (focus) show($("mPanel"), $("mPanelH"));
  }
  /* Moves focus to a heading without jumping the page: the box scrolls only as far as it needs to come into view */
  function show(box, h) {
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
    if (box.scrollIntoView) box.scrollIntoView({ block: "nearest", behavior: anim ? "smooth" : "auto" });
  }
  function closeCity() {
    if (cur && svg) { cur.el.setAttribute("class", "dot" + (cur.n ? "" : " off")); ring.setAttribute("hidden", ""); label.setAttribute("hidden", ""); }
    cur = null; $("mPanel").hidden = true;
  }
  /* A tap anywhere picks the closest dot within reach, so a small dot is easy to hit with a finger */
  function nearestDot(sx, sy) {
    var u = unit(), best = null, bd = Infinity, reach = 16 * u;
    pts.forEach(function (p) {
      var d = Math.hypot(p.x - sx, p.y - sy) - p.sz * u;
      if (!p.n) d += 6 * u; /* a faded dot loses to a lit one nearby */
      if (d < bd) { bd = d; best = p; }
    });
    return bd <= reach ? best : null;
  }
  function onTap(ev) {
    var p = ev.target && ev.target.__pt;
    if (!p) {
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      p = nearestDot(vb[0] + (ev.clientX - r.left) * vb[2] / r.width, vb[1] + (ev.clientY - r.top) * vb[3] / r.height);
    }
    if (p) openCity(p, true);
  }

  /* ---- near me, or near a typed city ---- */
  function miles(a, b, c, d) {
    var R = 3958.8, rad = Math.PI / 180, dl = (c - a) * rad, dn = (d - b) * rad;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function showNearest(lat, lon, why) {
    var list = pts.filter(function (p) { return p.n > 0; }).map(function (p) { return { p: p, d: miles(lat, lon, p.lat, p.lon) }; })
      .sort(function (a, b) { return a.d - b.d; }).slice(0, 10);
    $("mNearWhy").textContent = why;
    $("mNearList").innerHTML = list.map(function (r, i) {
      var d = r.d < 1 ? "less than 1 mile" : "about " + plural(Math.round(r.d), "mile", "miles");
      return '<li><button class="btn sm alt" type="button" data-i="' + pts.indexOf(r.p) + '">' + G.esc(r.p.k) + '</button> <span class="small">' + G.esc(plural(r.p.n, "program", "programs") + ", " + d) + "</span></li>";
    }).join("");
    wire($("mNearList"), true);
    $("mNearBox").hidden = false;
    $("mNearStatus").textContent = list.length ? "" : "No city has a program that matches your choices.";
    show($("mNearBox"), $("mNearH"));
  }
  /* each city button in a list opens that city (zooming to it when zoom is true) */
  function wire(box, zoom) {
    Array.prototype.forEach.call(box.querySelectorAll("button[data-i]"), function (b) {
      b.addEventListener("click", function () {
        var p = pts[+b.getAttribute("data-i")]; if (!p) return;
        if (zoom) zoomTo(fit(p.x, p.y, p.x, p.y, 0.1, 150));
        openCity(p, true);
      });
    });
  }
  function nearMe() {
    var st = $("mNearStatus");
    var geo = navigator.geolocation;
    if (!geo) { st.textContent = "This browser cannot share a location. Type your city instead."; return; }
    st.textContent = "Asking your browser where you are.";
    geo.getCurrentPosition(function (pos) {
      st.textContent = "";
      showNearest(pos.coords.latitude, pos.coords.longitude, "The 10 closest cities to you with programs that match your choices. Your location was not saved or sent.");
    }, function () {
      st.textContent = "We could not get your location. Type your city instead.";
    }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }
  function pickPlace() {
    var v = $("mCity").value, m = /^(p|s):(.+)$/.exec(v);
    if (!m) return;
    if (m[1] === "p") {
      var p = pts[+m[2]]; if (!p) return;
      zoomTo(fit(p.x, p.y, p.x, p.y, 0.1, 150));
      openCity(p, false);
      showNearest(p.lat, p.lon, "The 10 closest cities to " + p.k + " with programs that match your choices.");
    } else {
      var inS = pts.filter(function (q) { return q.s === m[2]; });
      if (!inS.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      inS.forEach(function (q) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
      if (m[2] === "BC") { x0 = BC_BOX[0]; y0 = BC_BOX[1]; x1 = BC_BOX[0] + BC_BOX[2]; y1 = BC_BOX[1] + BC_BOX[3]; }
      zoomTo(fit(x0, y0, x1, y1, 0.12, 90));
      var top = inS.filter(function (q) { return q.n > 0; }).sort(function (a, b) { return b.n - a.n; });
      $("mNearWhy").textContent = "Cities in " + NAMES[m[2]] + " with the most programs that match your choices.";
      $("mNearList").innerHTML = top.slice(0, 10).map(function (q) {
        return '<li><button class="btn sm alt" type="button" data-i="' + pts.indexOf(q) + '">' + G.esc(q.k) + '</button> <span class="small">' + G.esc(plural(q.n, "program", "programs")) + "</span></li>";
      }).join("");
      wire($("mNearList"), true);
      $("mNearBox").hidden = false;
      $("mNearStatus").textContent = top.length ? "" : "No city in " + NAMES[m[2]] + " has a program that matches your choices.";
      show($("mNearBox"), $("mNearH"));
    }
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
        d = x.el = document.createElement("details"); d.className = "card mstate"; d.setAttribute("data-g", x.code);
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
    $("mCount").textContent = plural(onMap, "program", "programs") + " in " + plural(cities, "place", "places") + " on the map. " + plural(other, "more program is", "more programs are") + " statewide, online or in several places. They are in the list below.";
  }
  function refresh() {
    okCache = null;
    resize(false);
    placeLabels();
    paintList(false);
    count();
    if (cur && !$("mPanel").hidden) openCity(cur, false);
    var box = $("mNearBox");
    if (!box.hidden) box.hidden = true;
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
        t.setAttribute("class", "bcl"); t.setAttribute("x", BC_BOX[0] + 4); t.setAttribute("y", BC_BOX[1] + 9); t.textContent = "Vancouver, BC";
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
    $("mPanelX").addEventListener("click", function () { closeCity(); var b = $("mZoom").querySelector('[aria-pressed="true"]'); if (b) b.focus(); });

    $("mNear").addEventListener("click", nearMe);
    /* The typed place box: every map city and state, with its program count, through the same search the Programs page uses */
    var sel = $("mCity"), totals = {};
    pts.forEach(function (p) { totals[p.s] = (totals[p.s] || 0) + p.ids.length; });
    pts.map(function (p, i) { return [p.k, "p:" + i, p.ids.length]; }).concat(Object.keys(totals).map(function (s) { return [NAMES[s] || s, "s:" + s, totals[s]]; }))
      .sort(function (a, b) { return b[2] - a[2] || (a[0] < b[0] ? -1 : 1); }) /* the search keeps this order among equal matches: bigger places first */
      .forEach(function (o) { sel.appendChild(Object.assign(document.createElement("option"), { value: o[1], textContent: o[0] + " (" + o[2] + ")" })); });
    G.placeSearch(sel, { hide: true, caption: "", placeholder: "Type a city, like Oakland" });
    sel.addEventListener("change", pickPlace);
    buildGroups();
    resize(true);
    paintList(false);
    count();
    $("mRead").textContent = "City points read " + data.read + ".";
    window.addEventListener("beforeprint", function () { groups.forEach(function (x) { if (x.dirty && x.el) fill(x); }); });
    window.addEventListener("resize", function () { if (svg) { pts.forEach(function (p) { if (p.t0 == null) p.sz = pxSize(p.n); }); draw(); } });
  }).catch(function () {
    $("mCount").textContent = "The map could not load. Try again, or use the Programs page.";
  });
})();
