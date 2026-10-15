/* Ages 12 to 14: what you can do, safety, and a path to a first job. Content is data/younger.json. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }
  function li(arr) { return arr.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join(""); }
  /* States with a full work permit answer in data/permits.json that are not one of the four full under-14 states, and not British Columbia (not in the picker). The names are copied from permits.json; tests/p9-younger-1.test.mjs checks them. */
  var PERMIT_NAMES = { wa: "Washington", tx: "Texas", mn: "Minnesota", wi: "Wisconsin", in: "Indiana", mi: "Michigan", nc: "North Carolina", nj: "New Jersey", pa: "Pennsylvania", ma: "Massachusetts", oh: "Ohio", md: "Maryland", va: "Virginia" };
  function isPermitOnly(v) { return !!v && Object.prototype.hasOwnProperty.call(PERMIT_NAMES, v); }
  /* Adds the permit-only states to the picker, in name order among the other states. The four full states come first and are skipped. */
  function addPermitOptions(full) {
    var ys = $("yState");
    if (!ys) return;
    var skip = full.map(function (s) { return s[0]; });
    Object.keys(PERMIT_NAMES).sort(function (a, b) { return PERMIT_NAMES[a] < PERMIT_NAMES[b] ? -1 : 1; }).forEach(function (id) {
      if (skip.indexOf(id) > -1 || ys.querySelector('option[value="' + id + '"]')) return;
      var o = document.createElement("option");
      o.value = id; o.textContent = PERMIT_NAMES[id];
      var before = null;
      for (var i = 0; i < ys.options.length; i++) {
        var x = ys.options[i];
        if (x.value && skip.indexOf(x.value) < 0 && x.textContent > o.textContent) { before = x; break; }
      }
      ys.insertBefore(o, before);
    });
  }
  /* The age for the permit link: the age from the address, then the saved Programs age (only 12, 13 or 14 count), else 14. */
  function permitAge() {
    var q = "";
    try { q = new URLSearchParams(location.search).get("age") || ""; } catch (e) { /* no address age */ }
    if (/^(12|13|14)$/.test(q)) return q;
    try {
      var pa = G.store.get("findprefs", {});
      if (pa && typeof pa.age === "string" && /^(12|13|14)$/.test(pa.age)) return pa.age;
    } catch (e) { /* no saved age */ }
    return "14";
  }
  /* permits.json is read once, after a teen picks a permit-only state, never on first load. */
  var permitP = null;
  function readPermits() {
    if (!permitP) permitP = G.fetchData("data/permits.json").then(function (r) { if (!r.ok) throw new Error("permits"); return r.json(); }).catch(function (e) { permitP = null; throw e; });
    return permitP;
  }
  /* The short answers for the other states come from G.stateShorts(), read only after a teen picks one of those states, so the page's first load does not change. */
  var shortP = null, shorts = null, shortRead = "";
  function ensureShort() {
    if (shorts) return Promise.resolve(shorts);
    if (!shortP) shortP = G.stateShorts().then(function (ld) {
      var m = {}; (ld.states || []).forEach(function (s) { m[s.id] = s; }); shorts = m; shortRead = ld.read || ""; return shorts;
    }).catch(function () { shortP = null; return null; });
    return shortP;
  }
  /* One short card: the permit line, the hours line, the phone (tap to call) and the official page. */
  function shortCard(s) {
    var NS = "Not stated on the page we read.";
    function row(k, v, tel) { var ns = !v || v === NS; return "<div><dt>" + k + "</dt><dd" + (ns ? ' class="ns"' : "") + ">" + (ns ? G.esc(NS) : tel ? L.linkContacts(v) : G.esc(v)) + "</dd></div>"; }
    return "<h3>" + G.esc(s.name) + "</h3><p>Short answer from one official page.</p>" +
      '<dl class="facts">' + row("Permit", s.permit) + row("Hours", s.hours) + row("Phone", s.phone, true) + "</dl>" +
      '<p class="small">Source: <a href="' + G.esc(s.url) + '" target="_blank" rel="noopener">Official page for ' + G.esc(s.name) + "</a>." + (shortRead ? " Last checked " + G.esc(shortRead) + "." : "") + "</p>";
  }
  /* The hubs that sit wholly inside one state (ca: the seven California hubs, ga: Atlanta), so a picked state carries into
     Programs as where= and the counts match what Programs shows. Empty when no hub belongs to that state alone. */
  function stateHubs(code) {
    if (!code) return [];
    return L.HUBS.filter(function (h) { return h[2].every(function (r) { return L.STATE_OF[r] === code; }); }).map(function (h) { return h[0]; });
  }
  function pickedState() { var ys = $("yState"); return ys ? ys.value : ""; }
  function pickedName() { var ys = $("yState"); return ys && ys.value && ys.options[ys.selectedIndex] ? ys.options[ys.selectedIndex].textContent : ""; }
  function whereParam() { var h = stateHubs(pickedState()); return h.length ? "&where=" + h.join(",") : ""; }
  /* The page draws from younger.json alone. The big core file only feeds the two program counts, so it never blocks the page. */
  var countEntries = null, l13 = null, l12 = null;
  function drawCounts() {
    if (!countEntries || !l13 || !l12) return;
    var hubs = stateHubs(pickedState()), where = hubs.length ? " in " + G.esc(pickedName()) : "";
    function n(age) {
      return countEntries.filter(function (e) { return L.matches(e, { age: age, hubs: hubs }, Date.now()) && e.min_age != null && e.min_age <= Number(age); }).length;
    }
    /* One span holds the whole label: .btn is a flex box, and loose text around the number became three columns. */
    l13.innerHTML = '<span>See <span id="n13">' + n("13") + "</span> programs that take 13 year olds" + where + "</span>";
    /* Programs also lists the cards that do not state an age, so say how many, and the two numbers add up. */
    var any13 = countEntries.filter(function (e) { return L.matches(e, { age: "13", hubs: hubs }, Date.now()) && e.min_age == null; }).length, note = $("nNote");
    if (note) { note.textContent = any13 > 0 ? "The Programs page also lists " + any13 + " more that do not say an age. Ask the program before you apply." : ""; note.hidden = !any13; }
    var n12 = n("12");
    l12.innerHTML = n12 > 0 ? '<span>See <span id="n12">' + n12 + "</span> programs that take 12 year olds" + where + "</span>" : "Browse programs for age 12" + where;
  }
  function fillCounts(all) {
    l13 = $("n13") && $("n13").closest("a"); l12 = $("age12Link");
    countEntries = all;
    drawCounts();
  }
  function plainCounts() {
    var b13 = $("n13") && $("n13").closest("a"), b12 = $("age12Link");
    /* Keep the buttons, so syncFindLinks can still point them at the picked state after the count text is gone. */
    if (b13) { l13 = b13; b13.textContent = "Browse programs for age 13"; }
    if (b12) { l12 = b12; b12.textContent = "Browse programs for age 12"; }
  }
  G.fetchData("data/younger.json").then(function (r) { return r.json(); }).then(function (d) {
    try { G.loadEntries("core").then(fillCounts).catch(plainCounts); } catch (e) { plainCounts(); }
    /* The age from the address (?age=, sent by the permit finder), then the age last saved on Programs (localStorage "findprefs"), read only. Only 12, 13 or 14 count; anything else keeps 13. */
    var nextAge = "13", qAge = "";
    try { qAge = new URLSearchParams(location.search).get("age") || ""; } catch (e) { /* no address age */ }
    if (/^(12|13|14)$/.test(qAge)) nextAge = qAge;
    else try {
      var pa = G.store.get("findprefs", {});
      if (pa && typeof pa.age === "string" && /^(12|13|14)$/.test(pa.age)) nextAge = pa.age;
    } catch (e) { /* no saved age: keep 13 */ }
    /* Every Programs link carries the age and, for a state with its own hubs, where= (see stateHubs). */
    function syncFindLinks() {
      var w = whereParam(), nextHref = "find.html?age=" + nextAge + w;
      var nsBtn = document.querySelector("#next-step a.btn");
      if (nsBtn) nsBtn.setAttribute("href", nextHref);
      var yNextA = document.querySelector("#yNext a");
      if (yNextA) yNextA.setAttribute("href", nextHref);
      var b13 = l13 || ($("n13") && $("n13").closest("a")), b12 = l12 || $("age12Link");
      if (b13) b13.setAttribute("href", "find.html?age=13" + w);
      if (b12) b12.setAttribute("href", "find.html?age=12" + w);
    }
    addPermitOptions(d.states);
    var os = d.otherState;
    $("otherStateH").textContent = os.title;
    $("otherStateRule").innerHTML = G.esc(os.rule) + " " + a(os.source.t, os.source.u) + ".";
    $("otherStateSteps").innerHTML = li(os.steps);
    $("fedNote").innerHTML = G.esc(d.federal) + " " + a(d.federalSource.t, d.federalSource.u) + ".";
    /* The four full states. A state with a short answer has no column here: the table keeps all four, and its short card sits under "Any other state". */
    function isFour(v) { return d.states.some(function (s) { return s[0] === v; }); }
    function hasOpt(v) { return !!v && !!$("yState").querySelector('option[value="' + v + '"]'); }
    /* The card for a permit-only state: name, the full answer link, hours at 14 and the state wage (both from the shared helpers the jobs page uses), and the under-14 line. */
    function showPermit(v) {
      var box = $("otherLite"), age = permitAge();
      box.innerHTML = "";
      var h = document.createElement("h3"); h.textContent = PERMIT_NAMES[v]; box.appendChild(h);
      var p1 = document.createElement("p"), lk = document.createElement("a");
      lk.setAttribute("href", "permit.html?state=" + encodeURIComponent(v) + "&age=" + age);
      lk.textContent = "Full work permit answer"; p1.appendChild(lk); box.appendChild(p1);
      var hrs = document.createElement("div"), wage = document.createElement("div");
      box.appendChild(hrs); box.appendChild(wage);
      var p2 = document.createElement("p"); p2.className = "small";
      p2.textContent = "Under 14 rules for this state are not on this page. Ask the state labor office or see the permit finder.";
      box.appendChild(p2);
      box.hidden = false;
      readPermits().then(function (pd) {
        if ($("yState").value !== v) return;
        var r = L.permitFor(pd, v, 14, "job");
        hrs.innerHTML = r && r.hours ? "<p><b>Hours in " + G.esc(PERMIT_NAMES[v]) + " at 14.</b> " + G.esc(r.hours) + "</p>" : "";
      }).catch(function () {
        if ($("yState").value === v) hrs.innerHTML = '<p class="small">The hours rule could not load. Use the work permit finder link.</p>';
      });
      G.stateWages().then(function (wd) {
        if ($("yState").value !== v) return;
        wage.innerHTML = G.wageLine(wd, v);
      }).catch(function () { /* the wage line is optional; the permit link still works */ });
    }
    function showLite(v) {
      var box = $("otherLite");
      if (!box) return;
      if (!v || isFour(v)) { box.hidden = true; box.innerHTML = ""; return; }
      if (isPermitOnly(v)) { showPermit(v); return; }
      ensureShort().then(function (m) {
        if ($("yState").value !== v) return;
        box.innerHTML = m && m[v] ? shortCard(m[v]) : "<p>The short answer could not load. Try again, or ask your state labor office.</p>";
        box.hidden = false;
      });
    }
    /* The four names for the line above the table, written from data/younger.json, e.g. "California, Georgia, New York and Illinois". */
    var fourNames = d.states.map(function (s) { return s[1]; });
    var fourText = fourNames.slice(0, -1).join(", ") + " and " + fourNames[fourNames.length - 1];
    /* For a state outside the four, one plain line sits right above the table: the table has no column for that state, and the state card is below the table. */
    function syncGridNote(v) {
      var note = $("gridNote");
      if (!note) return;
      if (!v || isFour(v)) { note.hidden = true; note.textContent = ""; return; }
      var sel = $("yState"), name = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : "";
      note.textContent = "This table covers " + fourText + " only. For " + name + ", see the short answer below and the federal rules.";
      note.hidden = false;
    }
    /* "Any other state" shows only for no pick or a state outside the four. It starts with a jump link to the picker in part 1. */
    var osBox = $("otherState");
    if (osBox && !$("otherStatePick")) {
      var pk = document.createElement("p"); pk.id = "otherStatePick";
      pk.innerHTML = '<a href="#grid">Pick your state in part 1</a>';
      osBox.insertBefore(pk, $("otherStateRule"));
    }
    function syncOther(v) { if (osBox) osBox.hidden = isFour(v); }
    function drawGrid(only) {
      var sts = d.states.filter(function (s) { return !only || !isFour(only) || s[0] === only; });
      /* On phones the grid stacks (CSS .stackt): each job is a block and every cell shows its state name first.
         The roles keep the table meaning that display:block drops; the names are aria-hidden (screen readers use the headers). */
      function k(t) { return '<span class="tk" aria-hidden="true">' + G.esc(t) + "</span>"; }
      var head = "<thead role=\"rowgroup\"><tr role=\"row\"><th scope=\"col\" role=\"columnheader\">What you want to do</th>" + sts.map(function (s) { return "<th scope=\"col\" role=\"columnheader\">" + G.esc(s[1]) + "</th>"; }).join("") + "</tr></thead>";
      var body = "<tbody role=\"rowgroup\">" + d.rows.map(function (r) {
        return "<tr role=\"row\"><th scope=\"row\" role=\"rowheader\">" + G.esc(r.job) + "</th>" + sts.map(function (s) {
          var c = r.cells[s[0]]; var NS = "Not stated on the pages we read.", unk = c.t.indexOf(NS) === 0, rest = unk ? c.t.slice(NS.length).trim() : ""; return "<td role=\"cell\">" + k(s[1]) + (unk ? '<span class="tag ghost" style="white-space:normal;line-height:1.25;">' + G.esc(d.unknownChip) + "</span>" + (rest ? " " + L.linkContacts(rest) : "") : L.linkContacts(c.t)) + (c.s ? '<br><span class="small">' + a(c.s.t, c.s.u) + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "<tr role=\"row\"><th scope=\"row\" role=\"rowheader\">Who to ask</th>" + sts.map(function (s) { return "<td role=\"cell\">" + k(s[1]) + L.linkContacts(d.calls[s[0]]) + "</td>"; }).join("") + "</tr></tbody>";
      $("gridT").innerHTML = '<caption class="sr">What a 12 or 13 year old may do, by state</caption>' + head + body;
    }
    /* The picker's options are written into the page by tools/build.py: the four full states first, then every other state with a short answer, from the data files. */
    var ys = $("yState");
    var want = ""; try { want = new URLSearchParams(location.search).get("state") || ""; } catch (e) {}
    ys.value = hasOpt(want) ? want : "";
    if (!want) {
      var pr = G.store.get("findprefs", {}), ss = pr && typeof pr.place === "string" ? L.stateFromPlace(pr.place) : "";
      if (hasOpt(ss)) ys.value = ss;
    }
    if (ys._tpSync) ys._tpSync();
    /* The shared type-to-search box (2026-10-13): the select stays the source of truth. */
    var yPlace = G.placeSearch(ys, { hide: true, chip: true, caption: "", placeholder: "Type your state" });
    if (yPlace) yPlace.sync();
    drawGrid(ys.value);
    showLite(ys.value);
    syncGridNote(ys.value);
    syncOther(ys.value);
    syncFindLinks();
    drawCounts();
    /* The Work permit finder button passes the picked state on, for every state permit.html reads (L.PERMIT_STATES). */
    function syncPermit() {
      var btn = $("permitBtn");
      if (!btn) return;
      btn.setAttribute("href", L.PERMIT_STATES.indexOf(ys.value) > -1 ? "permit.html?state=" + encodeURIComponent(ys.value) : "permit.html");
    }
    /* Keep the picked state in the address (state=ny), so a copied or texted link opens on the same state. "All four states" removes it. */
    function syncStateUrl(v) {
      try {
        var p = new URLSearchParams(location.search);
        if (v) p.set("state", v); else p.delete("state");
        var q = p.toString();
        history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
      } catch (e) { /* the address bar is optional */ }
    }
    syncPermit();
    ys.addEventListener("change", function () {
      drawGrid(ys.value);
      showLite(ys.value);
      syncGridNote(ys.value);
      syncOther(ys.value);
      syncPermit();
      syncStateUrl(ys.value);
      syncFindLinks();
      drawCounts();
      var total = d.states.length, st = $("yStatus"), msg, name = ys.options[ys.selectedIndex] ? ys.options[ys.selectedIndex].textContent : "";
      if (!ys.value) msg = "Showing all " + total + " full states.";
      else if (isFour(ys.value)) msg = "Showing " + name + ". 1 of " + total + " full states.";
      else if (isPermitOnly(ys.value)) msg = "Showing " + name + ". Its work permit answer is just below the table. The table shows all " + total + " full states.";
      else msg = "Showing " + name + ". Its short answer is just below the table. The table shows all " + total + " full states.";
      if (st && st.textContent !== msg) st.textContent = msg;
    });
    $("conflicts").innerHTML = li(d.conflicts);
    /* Near-home work: each line names a federal rule and links its source from data/younger.json. */
    $("nearH").textContent = d.near.title;
    $("nearNote").textContent = d.near.note;
    $("nearL").innerHTML = d.near.items.map(function (x) { return "<li>" + G.esc(x.t) + " Source: " + a(x.s.t, x.s.u) + ".</li>"; }).join("");
    $("sitH").textContent = d.sitting.title; $("sitLabel").textContent = d.sitting.label; $("sitL").innerHTML = li(d.sitting.tips);
    $("petH").textContent = d.petCare.title; $("petLabel").textContent = d.petCare.label; $("petNote").textContent = d.petCare.note; $("petL").innerHTML = li(d.petCare.tips);
    $("nearScript").textContent = d.near.script;
    $("train").innerHTML = d.train.map(function (t) { return "<li><b>" + G.esc(t.t) + ".</b> " + G.esc(t.d) + " " + a("Official page", t.u) + "</li>"; }).join("");
    $("before").innerHTML = li(d.before); $("beforeSrc").innerHTML = "From " + a(d.beforeSource.t, d.beforeSource.u) + ".";
    $("strangers").innerHTML = li(d.strangers); $("strangersNote").innerHTML = G.esc(d.strangersNote) + " " + a(d.strangersSource.t, d.strangersSource.u) + ".";
    /* Sites with a minimum age of 18 or more go in the closed details; the rest stay in the open table. */
    function siteTable(list, cap) { return "<caption class=\"sr\">" + cap + "</caption><thead><tr><th scope=\"col\">Site</th><th scope=\"col\">Minimum age</th></tr></thead><tbody>" + list.map(function (s) { return "<tr><th scope=\"row\">" + a(s[0], s[2]) + "</th><td>" + G.esc(s[1]) + "</td></tr>"; }).join("") + "</tbody>"; }
    var adult = d.sites.filter(function (s) { return parseInt(s[1], 10) >= 18; });
    var okSites = d.sites.filter(function (s) { return !(parseInt(s[1], 10) >= 18); });
    $("sitesT").innerHTML = siteTable(adult, "Minimum ages for job and payment sites");
    if (okSites.length) { $("sitesOkT").innerHTML = siteTable(okSites, "Apps and sites a young teen may use"); $("sitesWrap").hidden = false; } else { $("sitesNone").hidden = false; $("sitesWrap").parentNode.removeChild($("sitesWrap")); }
    if (!adult.length) $("sitesAdult").hidden = true;
    $("sitesNote").textContent = d.sitesNote;
    $("ladderL").innerHTML = d.ladder.map(function (x) { return "<li><div><b>Ages " + G.esc(x.age) + ": " + G.esc(x.t) + ".</b> " + G.esc(x.d) + "</div></li>"; }).join("");
    $("groups").innerHTML = d.groups.map(function (g) { return '<article class="card"><h3>' + G.esc(g.n) + "</h3><p>" + G.esc(g.d) + "</p><p>" + a("Official page", g.u) + "</p></article>"; }).join("");
    $("moneyL").innerHTML = li(d.money); $("moneySrc").innerHTML = "Sources: " + d.moneySources.map(function (s) { return a(s.t, s.u); }).join(" &middot; ") + ". Ask the IRS or a tax professional about your own situation.";
    $("yGaps").innerHTML = li(d.gaps);
    $("yPrint").addEventListener("click", function () {
      $("yPack").innerHTML = "<h3>Safety card for a young sitter or helper</h3><h4>Before every job</h4><ul>" + li(d.before) + "</ul><h4>With someone I do not know</h4><ul>" + li(d.strangers) + "</ul><h4>Apps with an age rule</h4><ul>" + d.sites.map(function (s) { return "<li>" + G.esc(s[0]) + ": " + G.esc(s[1]) + "</li>"; }).join("") + "</ul><p>Parent phone: ________________ Where I am working: ________________ Home by: ________</p><p class=\"small\">From vadneyk.github.io/internships/younger.html. Read " + G.esc(d.read) + ".</p>";
      $("yPack").hidden = false; G.printOnly($("yPack"), "Safety card"); $("yPack").hidden = true;
    });
  }).catch(function () { $("fedNote").textContent = "This page could not load. Try again."; $("yStatus").textContent = "This page could not load. Try again."; });
})();
