/* Home page: "what fits you" picker and the closing-soon list. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var all = [];

  var L = G.lib;
  function fut(e) { return L.futureDeadline(e, Date.now()); }

  var fields = Object.keys(G.FIELDS).filter(function (k) { return k !== "any"; });
  fields.forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = G.FIELDS[k]; $("pField").appendChild(o); });

  function pick() {
    var age = $("pAge").value, hub = $("pHub").value, field = $("pField").value;
    var box = $("matches"), more = $("matchMore");
    if (!age && !hub && !field) { box.innerHTML = ""; more.hidden = true; return; }
    var fl = field ? [field] : [];
    var list = L.sortList(all.filter(function (e) {
      return L.matches(e, { place: hub, age: age, fields: fl }, Date.now());
    }), "best", Date.now());
    var q = new URLSearchParams();
    if (age) q.set("age", age); if (hub) q.set("at", hub); if (field) q.set("interest", field);
    var top = list.slice(0, 4);
    if (!top.length) {
      box.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>No exact match yet</h3><p>Try a different area or interest, or browse everything.</p></div>';
    } else {
      box.innerHTML = top.map(function (e) {
        var u = G.safeUrl(e.url);
        return '<article class="card prog"><div class="row"><span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><span class="tag ghost">' + G.esc(G.TYPES[e.type] || "") + "</span></div>" +
          "<h3>" + G.esc(e.name) + '</h3><p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p><p class=\"what\">" + G.esc(e.what_you_do || "") + "</p>" +
          '<p class="when"><b>Dates</b>' + G.esc(e.deadline_text || "Not posted") + "</p>" +
          '<div class="actions">' + (u ? '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener">Official page</a>' : "") + '<a class="btn sm alt" href="find.html?' + G.esc(q.toString()) + "#p-" + G.esc(e.id) + '">Details</a></div></article>';
      }).join("");
    }
    more.hidden = false;
    more.innerHTML = '<a class="btn" href="find.html?' + G.esc(q.toString()) + '">See all ' + list.length + " matches</a>";
  }
  ["pAge", "pHub", "pField"].forEach(function (id) { $(id).addEventListener("change", pick); });

  G.loadEntries().then(function (data) {
    all = data;
    G.fillPlaces($("pHub"), all);
    var soon = all.filter(function (e) { return fut(e) && e.deadline_confidence === "confirmed-2026-27"; })
      .sort(function (a, b) { return fut(a) - fut(b) || (a.priority || 3) - (b.priority || 3); }).slice(0, 8);
    $("soonList").innerHTML = soon.length ? soon.map(function (e) {
      var d = fut(e), n = G.daysUntil(d), u = G.safeUrl(e.url);
      var mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      return '<li><div class="d">' + mon + " " + d.getDate() + "<small>" + (n <= 0 ? "today" : n + " days") + "</small></div><div><b>" + G.esc(e.name) + '</b> <span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><br><span class="small muted">' + G.esc(e.org || "") + " &middot; " + G.esc(e.city || "") + "</span>" +
        (u ? ' <br><a href="' + G.esc(u) + '" target="_blank" rel="noopener">Official page</a>' : "") + "</div></li>";
    }).join("") : '<li><div class="d">Soon</div><div>No confirmed deadlines in the next few weeks. Browse everything by month.</div></li>';
    pick();
  }).catch(function () {
    $("soonList").innerHTML = '<li><div class="d">!</div><div>Could not load the list. Try the <a href="find.html">Programs page</a>.</div></li>';
  });
})();
