/* Jobs that hire teens: employers and the age each one's own page states, from data/employers.json. Nothing is stored. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  function link(u, t) { var s = G.safeUrl(u); return s ? '<a href="' + G.esc(s) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>" : G.esc(t); }
  /* Option value for an age from the address or the saved Programs age. 12 and 13 use Under 14. Anything else gives "". */
  function ageChoice(raw) {
    var s = String(raw == null ? "" : raw);
    if (s === "12" || s === "13" || s === "u14") return "u14";
    return ["14", "15", "16", "17", "18"].indexOf(s) > -1 ? s : "";
  }
  function row(k, v) { return v ? "<div><dt>" + G.esc(k) + "</dt><dd>" + G.esc(v) + "</dd></div>" : ""; }
  function card(e) {
    return '<article class="card"><p class="small"><span class="tag y">Starts at ' + e.min_age + "</span> " + (e.caveat ? '<span class="tag caveat">' + G.esc(e.caveat) + "</span> " : "") + G.esc(e.kind) + "</p><h3>" + G.esc(e.name) + "</h3>" +
      '<dl class="facts plain">' + row("Jobs", e.roles) + row("How to apply", e.how_to_apply) + row("Good to know", e.age_note) + "</dl>" +
      '<p class="small muted">Source: ' + link(e.url, e.page_title) + "</p></article>";
  }
  G.fetchData("data/employers.json").then(function (r) { return r.json(); }).then(function (d) {
    $("jobsNote").innerHTML = "<p>" + G.esc(d.note) + " Last read " + G.esc(d.read) + ".</p>";
    $("jRulesLead").textContent = "These come from US Department of Labor and OSHA pages. A state can be stricter, and then the state rule wins.";
    $("jRules").innerHTML = d.rules.map(function (e) {
      return '<article class="card"><h3>' + G.esc(e.name) + "</h3><p>" + G.esc(e.age_note) + '</p><p class="small muted">Source: ' + link(e.url, e.page_title) + "</p></article>";
    }).join("");
    var sel = $("jAge");
    [["u14", "Under 14"], ["14", "14"], ["15", "15"], ["16", "16"], ["17", "17"], ["18", "18"]].forEach(function (a) {
      sel.appendChild(Object.assign(document.createElement("option"), { value: a[0], textContent: a[1] }));
    });
    function paint() {
      var v = sel.value, out = $("jOut");
      if (!v) { $("jStatus").textContent = ""; out.innerHTML = '<p class="muted">Tap your age to see who hires.</p>'; return; }
      if (v === "u14") {
        $("jStatus").textContent = "Jobs for under 14 are listed below.";
        out.innerHTML = '<div class="card"><h2>Under 14</h2><p>The US Department of Labor says children under 14 may not be employed in most non-farm jobs. Casual babysitting, chores at home and delivering newspapers are not covered. Rules for farm work are different, and a state can be stricter.</p><p class="row"><a class="btn" href="younger.html">Ages 12 to 14: start here</a> <a class="btn alt" href="find.html?age=13">Programs and volunteering</a></p></div>';
        return;
      }
      var age = Number(v);
      var can = d.employers.filter(function (e) { return e.min_age <= age; }), later = d.employers.filter(function (e) { return e.min_age > age; });
      $("jStatus").textContent = can.length + " employers for age " + age + " are listed below.";
      var html = "", shownGroups = 0;
      d.groups.forEach(function (g) {
        var list = can.filter(function (e) { return e.group === g[0]; });
        if (list.length) { shownGroups++; html += "<h2>" + G.esc(g[1]) + '</h2><div class="grid g2" style="align-items:start;">' + list.map(card).join("") + "</div>"; }
      });
      if (shownGroups) $("jStatus").textContent += " They are in " + shownGroups + (shownGroups === 1 ? " job group." : " job groups.");
      if (!can.length) html += '<div class="card"><p>No employer on this page starts at your age yet. Try the <a href="find.html">Programs page</a>.</p></div>';
      if (later.length) html += '<details style="margin-top:1.4rem;"><summary class="lbl" style="cursor:pointer;">' + later.length + " employers that start older than " + age + "</summary><p class=\"small muted\">These say their minimum age is higher than " + age + ". They are here so you know who to try later.</p><div class=\"grid g2\" style=\"align-items:start;\">" + later.map(card).join("") + "</div></details>";
      out.innerHTML = html;
    }
    sel.addEventListener("change", paint);
    /* Start age: the address wins (an invalid ?age= leaves the picker empty), otherwise the age saved on Programs (read only). */
    var params = new URLSearchParams(location.search), start = "";
    if (params.has("age")) start = ageChoice(params.get("age"));
    else { var pr = G.store.get("findprefs", {}); start = pr && typeof pr.age === "string" ? ageChoice(pr.age) : ""; }
    if (start) { sel.value = start; if (sel._tpSync) sel._tpSync(); paint(); }
  }).catch(function () { $("jOut").innerHTML = '<p class="muted">The list could not load. Try again later.</p>'; $("jStatus").textContent = "The list could not load. Try again later."; });
})();
