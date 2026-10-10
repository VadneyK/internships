/* What opens when: months come from data/calendar.json (extracted from each card's own deadline wording). */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var MN = L.MONTH_NAMES, SH = L.MONTHS;
  Promise.all([fetch("data/calendar.json").then(function (r) { return r.json(); }), G.loadEntries("card")]).then(function (res) {
    var cal = res[0], all = res[1], by = {};
    all.forEach(function (e) { by[e.id] = e; });
    $("calNote").textContent = cal.note;
    G.fillPlaces($("cPlace"), all);
    for (var a = 12; a <= 18; a++) $("cAge").appendChild(Object.assign(document.createElement("option"), { value: String(a), textContent: String(a) }));
    var cur = new Date().getMonth() + 1, q = new URLSearchParams(location.search);
    if (+q.get("m") >= 1 && +q.get("m") <= 12) cur = +q.get("m");
    if (q.get("at") && L.placeRegions(q.get("at"))) $("cPlace").value = q.get("at");
    if (q.get("age")) {
      var ageOpt = Array.prototype.some.call($("cAge").options, function (o) { return o.value === q.get("age"); });
      if (ageOpt) $("cAge").value = q.get("age");
    }
    $("months").innerHTML = SH.map(function (m, i) { return '<button class="chip" type="button" data-m="' + (i + 1) + '" aria-pressed="false">' + m + "</button>"; }).join("");
    function inWindow(it, m) {
      if (it.opens && it.closes) return it.opens <= it.closes ? m >= it.opens && m <= it.closes : m >= it.opens || m <= it.closes;
      return m === (it.opens || it.closes);
    }
    function card(it, e) {
      var u = G.safeUrl(e.url);
      return '<li class="card"><span class="tag ghost">' + G.esc(G.PAID[e.paid_type] || "") + "</span> <span class=\"tag ghost\">" + G.esc(G.TYPES[e.type] || "") + "</span><h3 style=\"margin-top:.5rem;\">" + G.esc(e.name) + '</h3><p class="small muted">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p>" +
        (it.quote ? "<p><b>What the program says:</b> " + G.esc(it.quote) + ".</p>" : "") +
        '<p class="row"><a class="btn sm alt" href="find.html#p-' + G.esc(e.id) + '" aria-label="' + G.esc("Details for " + e.name + (e.org ? ", " + e.org : "")) + '">Details</a>' + (u ? ' <a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name + (e.org ? ", " + e.org : "")) + '">Official page</a>' : "") + "</p></li>";
    }
    function rowsFor(m, place, age) {
      return cal.items.map(function (it) { return [it, by[it.id]]; }).filter(function (p) {
        var e = p[1]; if (!e) return false;
        return L.matches(e, { place: place, age: age }, Date.now()) && inWindow(p[0], m);
      });
    }
    function nextBusy(place, age) {
      for (var i = 1; i < 12; i++) {
        var m = ((cur - 1 + i) % 12) + 1, n = rowsFor(m, place, age).length;
        if (n) return { m: m, n: n };
      }
      return null;
    }
    function paint() {
      var place = $("cPlace").value, age = $("cAge").value;
      document.querySelectorAll("#months .chip").forEach(function (b) {
        var m = +b.getAttribute("data-m"), n = rowsFor(m, place, age).length;
        b.setAttribute("aria-pressed", String(m === cur));
        b.setAttribute("aria-label", MN[m - 1] + ", " + n + " program" + (n === 1 ? "" : "s"));
        b.innerHTML = SH[m - 1] + '<span class="n">' + n + "</span>";
      });
      var rows = rowsFor(cur, place, age);
      var closing = rows.filter(function (p) { return p[0].closes === cur; }), opening = rows.filter(function (p) { return p[0].closes !== cur; });
      $("hClose").hidden = !closing.length; $("hOpen").hidden = !opening.length; $("cNone").hidden = rows.length > 0;
      var old = $("cNoneNext"); if (old) old.remove();
      if (!rows.length) {
        var nb = nextBusy(place, age);
        if (nb) {
          var btn = document.createElement("button");
          btn.type = "button"; btn.id = "cNoneNext"; btn.className = "btn sm";
          btn.textContent = "Next month with programs: " + MN[nb.m - 1] + " (" + nb.n + ")";
          btn.addEventListener("click", function () { cur = nb.m; paint(); document.querySelector('#months .chip[aria-pressed="true"]').focus(); });
          $("cNone").appendChild(btn);
        }
      }
      $("cClose").innerHTML = closing.map(function (p) { return card(p[0], p[1]); }).join("");
      $("cOpen").innerHTML = opening.map(function (p) { return card(p[0], p[1]); }).join("");
      $("cCount").textContent = rows.length + " program" + (rows.length === 1 ? "" : "s") + " in " + MN[cur - 1] + (place ? " for " + L.placeLabel(place) : "");
      try { var p = new URLSearchParams(); p.set("m", cur); if (place) p.set("at", place); if (age) p.set("age", age); history.replaceState(null, "", location.pathname + "?" + p.toString()); } catch (e) {}
    }
    $("months").addEventListener("click", function (ev) { var b = ev.target.closest(".chip"); if (!b) return; cur = +b.getAttribute("data-m"); paint(); });
    ["cPlace", "cAge"].forEach(function (id) { $(id).addEventListener("change", paint); });
    paint();
  }).catch(function () { $("cCount").textContent = "The calendar could not load. Try again."; });
})();
