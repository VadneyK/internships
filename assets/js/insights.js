/* Insights page: charts built from data/entries-stats.json. Counting logic lives in lib.js (insights) and is tested. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var WHEN = { open: "open", soon: "open", anytime: "anytime", closed: "closed" };

  function link(params) { var q = new URLSearchParams(params).toString(); return "find.html" + (q ? "?" + q : ""); }
  function rows(el, items, max, hrefOf, cls) {
    el.innerHTML = items.map(function (it) {
      var href = hrefOf(it), tag = href ? "a" : "div";
      return "<" + tag + ' class="crow"' + (href ? ' href="' + G.esc(href) + '"' : "") + '><span class="cl">' + G.esc(it.label) + '</span>' +
        '<span class="ctrack"><i class="' + (cls || "k1") + '" style="width:' + (max ? Math.max(it.n ? 2 : 0, Math.round(it.n / max * 100)) : 0) + '%"></i></span>' +
        '<span class="cn">' + it.n + "</span></" + tag + ">";
    }).join("");
  }

  G.loadEntries("stats").then(function (list) {
    var d = L.insights(list, Date.now()), f = d.facts;

    $("topStats").innerHTML =
      '<div class="stat"><b>' + d.total + "</b><span>programs listed</span></div>" +
      '<div class="stat"><b>' + f.free + "</b><span>free or volunteer</span></div>" +
      '<div class="stat"><b>' + f.noPermit + "</b><span>need no work permit</span></div>";

    /* status */
    var open = d.status[0].n + d.status[1].n, any = d.status[2].n;
    $("todayLead").textContent = open + " programs are open or opening soon, and " + any + " more take applications any time (like library volunteering). Start with the any-time ones if nothing is open yet.";
    var smax = Math.max.apply(null, d.status.map(function (s) { return s.n; }));
    rows($("chartStatus"), d.status, smax, function (it) { return it.id === "unknown" ? null : link({ when: WHEN[it.id] }); }, "k2");

    /* age */
    var amax = Math.max.apply(null, d.ages.map(function (a) { return a.n; }));
    $("ageLead").textContent = "At 13, " + d.ages[0].n + " programs are open to you. At 16, it is " + d.ages[3].n + ". Paid options grow " + f.paidJump + " percent between 14 and 16 (" + d.ages[1].paid + " to " + d.ages[3].paid + "). Under 16, look hard at volunteering, school programs and the people you know.";
    $("chartAge").innerHTML = d.ages.map(function (a) {
      var h = Math.round(a.n / amax * 100), hp = a.n ? Math.round(a.paid / a.n * 100) : 0;
      return '<a class="ccol" href="' + G.esc(link({ age: a.age })) + '" aria-label="Age ' + a.age + ": " + a.n + " programs, " + a.paid + ' paid"><span class="cn">' + a.n + '</span><span class="cbar"><i class="k3" style="height:' + h + '%"><b class="k1" style="height:' + hp + '%"></b></i></span><span class="cl">Age ' + a.age + "</span></a>";
    }).join("");

    /* hubs, stacked. The counts are written out as text under each bar, so screen readers and
       keyboard users get them without color or hover. The bar segments are decoration only. */
    var hmax = Math.max.apply(null, d.hubs.map(function (h) { return h.n; }));
    $("chartHubs").innerHTML = d.hubs.map(function (h) {
      var seg = function (n, cls) { return n ? '<i class="' + cls + '" aria-hidden="true" style="width:' + (n / hmax * 100) + '%"></i>' : ""; };
      var parts = [h.pay + " paid", h.free + " free", h.fee + " costs money"];
      if (h.unknown) parts.push(h.unknown + " pay not stated");
      return '<a class="crow" href="' + G.esc(link({ where: h.id })) + '"><span class="cl">' + G.esc(h.label) + '</span><span class="ctrack multi" aria-hidden="true">' +
        seg(h.pay, "k1") + seg(h.free, "k2") + seg(h.fee, "k3") + '</span><span class="cn">' + h.n + '</span>' +
        '<span class="cbreak small muted" style="grid-column:1 / -1">' + parts.join(", ") + "</span></a>";
    }).join("");

    /* kinds and interests */
    var tmax = d.types[0].n, fmax = d.fields[0].n;
    rows($("chartTypes"), d.types, tmax, function (it) { return link({ kind: it.id }); }, "k1");
    rows($("chartFields"), d.fields, fmax, function (it) { return link({ interest: it.id }); }, "k2");

    /* seasons */
    var seasons = d.seasons.filter(function (s) { return s.n; }), semax = Math.max.apply(null, seasons.map(function (s) { return s.n; }));
    rows($("chartSeason"), seasons, semax, function (it) { return link({ season: it.id }); }, "k3");

    /* confirmed dates */
    var items = [];
    d.months.forEach(function (m) { m.items.forEach(function (it) { items.push(it); }); });
    $("soonDates").innerHTML = items.slice(0, 8).map(function (it) {
      var dt = G.parseISO(it.date);
      return '<li><div class="d">' + L.MONTHS[dt.getMonth()] + " " + dt.getDate() + "<small>closes</small></div><div><b>" + G.esc(it.name) + '</b><br><a href="find.html#p-' + G.esc(it.id) + '">See card</a></div></li>';
    }).join("") || "<li><div>No confirmed deadlines right now.</div></li>";

    /* trust */
    $("trustText").textContent = f.fetched + " of " + d.total + " programs were read on the program's own official page (the rest show a \"Confirm first\" tag). The list was last checked " + (document.querySelector(".foot b") ? document.querySelector(".foot b").textContent : "recently") + ". Pay and cost are as the program states them; " + f.cost + " programs charge you, and we label those.";
  }).catch(function () {
    $("todayLead").textContent = "Could not load the list. Try the Programs page.";
  });
})();
