/* Ages 12 to 14: what you can do, safety, and a path to a first job. Content is data/younger.json. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }
  function li(arr) { return arr.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join(""); }
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
  /* The page draws from younger.json alone. The big core file only feeds the two program counts, so it never blocks the page. */
  function fillCounts(all) {
    var n13 = all.filter(function (e) { return L.matches(e, { age: "13" }, Date.now()) && e.min_age != null && e.min_age <= 13; }).length;
    $("n13").textContent = n13;
    var n12 = all.filter(function (e) { return L.matches(e, { age: "12" }, Date.now()) && e.min_age != null && e.min_age <= 12; }).length;
    if (n12 > 0) $("n12").textContent = n12;
    else $("age12Link").textContent = "Browse programs for age 12";
  }
  function plainCounts() {
    var l13 = $("n13") && $("n13").parentNode, l12 = $("age12Link");
    if (l13) l13.textContent = "Browse programs for age 13";
    if (l12) l12.textContent = "Browse programs for age 12";
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
    var nextHref = "find.html?age=" + nextAge;
    var nsBtn = document.querySelector("#next-step a.btn");
    if (nsBtn) nsBtn.setAttribute("href", nextHref);
    var yNextA = document.querySelector("#yNext a");
    if (yNextA) yNextA.setAttribute("href", nextHref);
    var os = d.otherState;
    $("otherStateH").textContent = os.title;
    $("otherStateRule").innerHTML = G.esc(os.rule) + " " + a(os.source.t, os.source.u) + ".";
    $("otherStateSteps").innerHTML = li(os.steps);
    $("fedNote").innerHTML = G.esc(d.federal) + " " + a(d.federalSource.t, d.federalSource.u) + ".";
    /* The four full states. A state with a short answer has no column here: the table keeps all four, and its short card sits under "Any other state". */
    function isFour(v) { return d.states.some(function (s) { return s[0] === v; }); }
    function hasOpt(v) { return !!v && !!$("yState").querySelector('option[value="' + v + '"]'); }
    function showLite(v) {
      var box = $("otherLite");
      if (!box) return;
      if (!v || isFour(v)) { box.hidden = true; box.innerHTML = ""; return; }
      ensureShort().then(function (m) {
        if ($("yState").value !== v) return;
        box.innerHTML = m && m[v] ? shortCard(m[v]) : "<p>The short answer could not load. Try again, or ask your state labor office.</p>";
        box.hidden = false;
      });
    }
    function drawGrid(only) {
      var sts = d.states.filter(function (s) { return !only || !isFour(only) || s[0] === only; });
      var head = "<thead><tr><th scope=\"col\">What you want to do</th>" + sts.map(function (s) { return "<th scope=\"col\">" + G.esc(s[1]) + "</th>"; }).join("") + "</tr></thead>";
      var body = "<tbody>" + d.rows.map(function (r) {
        return "<tr><th scope=\"row\">" + G.esc(r.job) + "</th>" + sts.map(function (s) {
          var c = r.cells[s[0]]; var NS = "Not stated on the pages we read.", unk = c.t.indexOf(NS) === 0, rest = unk ? c.t.slice(NS.length).trim() : ""; return "<td>" + (unk ? '<span class="tag ghost" style="white-space:normal;line-height:1.25;">' + G.esc(d.unknownChip) + "</span>" + (rest ? " " + G.esc(rest) : "") : G.esc(c.t)) + (c.s ? '<br><span class="small">' + a(c.s.t, c.s.u) + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "<tr><th scope=\"row\">Who to ask</th>" + sts.map(function (s) { return "<td>" + G.esc(d.calls[s[0]]) + "</td>"; }).join("") + "</tr></tbody>";
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
    drawGrid(ys.value);
    showLite(ys.value);
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
      syncPermit();
      syncStateUrl(ys.value);
      var total = d.states.length, st = $("yStatus"), msg, name = ys.options[ys.selectedIndex] ? ys.options[ys.selectedIndex].textContent : "";
      if (!ys.value) msg = "Showing all " + total + " full states.";
      else if (isFour(ys.value)) msg = "Showing " + name + ". 1 of " + total + " full states.";
      else msg = "Showing " + name + ". Its short answer is just below the picker. The table shows all " + total + " full states.";
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
