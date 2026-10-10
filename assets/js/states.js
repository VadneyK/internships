/* More states: a card per state from data/permits.json. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  fetch("data/permits.json").then(function (r) { return r.json(); }).then(function (d) {
    var skip = ["ca", "ga", "ny", "il"];
    var keys = Object.keys(d.states).filter(function (k) { return skip.indexOf(k) < 0; }).sort(function (a, b) { return d.states[a].name < d.states[b].name ? -1 : 1; });
    keys.forEach(function (k) { $("moreSel").appendChild(Object.assign(document.createElement("option"), { value: k, textContent: d.states[k].name })); });
    function row(k, v) { return "<div><dt>" + k + "</dt><dd>" + G.esc(v) + "</dd></div>"; }
    var quiet = false;
    /* One short line for screen readers, never on load. */
    function say(msg) { if (!quiet && $("moreStatus").textContent !== msg) $("moreStatus").textContent = msg; }
    $("moreSel").addEventListener("change", function () {
      var k = $("moreSel").value, s = d.states[k];
      if (!s) { $("moreOut").innerHTML = '<p class="muted">Pick a state.</p>'; say("Pick a state."); return; }
      say(s.name);
      $("moreOut").innerHTML = "<h3>" + G.esc(s.name) + "</h3><dl class=\"facts\">" + row("Minimum age", s.minAge.note) + row("Permit", s.permit + ". " + s.kinds.job.text) + row("Hours at 14 and 15", s.hours["14"]) + row("Hours at 16 and 17", s.hours["16"]) + row("Minimum wage", s.wage) + row("Who to ask", s.call) + "</dl>" +
        '<p class="row"><a class="btn sm" href="permit.html?state=' + G.esc(k) + '&age=15&kind=job">Open the work permit finder</a></p><p class="small muted">Read on ' + G.esc(s.read) + " from: " + s.links.map(function (l) { return /^https?:/.test(l.u) ? '<a href="' + G.esc(l.u) + '" target="_blank" rel="noopener">' + G.esc(l.t) + "</a>" : ""; }).join(" &middot; ") + ". This is a summary, not legal advice.</p>";
    });
    var q = new URLSearchParams(location.search).get("state"); if (q && d.states[q]) { $("moreSel").value = q; quiet = true; $("moreSel").dispatchEvent(new Event("change")); quiet = false; }
  }).catch(function () { $("moreOut").innerHTML = '<p class="muted">The state rules could not load.</p>'; });
})();
