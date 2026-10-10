/* Ages 12 to 14: what you can do, safety, and a path to a first job. Content is data/younger.json. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }
  function li(arr) { return arr.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join(""); }
  Promise.all([fetch("data/younger.json").then(function (r) { return r.json(); }), G.loadEntries("core")]).then(function (res) {
    var d = res[0], all = res[1];
    var n13 = all.filter(function (e) { return L.matches(e, { age: "13" }, Date.now()) && e.min_age != null && e.min_age <= 13; }).length;
    $("n13").textContent = n13;
    $("fedNote").innerHTML = G.esc(d.federal) + " " + a(d.federalSource.t, d.federalSource.u) + ".";
    function drawGrid(only) {
      var sts = d.states.filter(function (s) { return !only || s[0] === only; });
      var head = "<thead><tr><th scope=\"col\">What you want to do</th>" + sts.map(function (s) { return "<th scope=\"col\">" + G.esc(s[1]) + "</th>"; }).join("") + "</tr></thead>";
      var body = "<tbody>" + d.rows.map(function (r) {
        return "<tr><th scope=\"row\">" + G.esc(r.job) + "</th>" + sts.map(function (s) {
          var c = r.cells[s[0]]; return "<td>" + G.esc(c.t) + (c.s ? '<br><span class="small">' + a(c.s.t, c.s.u) + "</span>" : "") + "</td>";
        }).join("") + "</tr>";
      }).join("") + "<tr><th scope=\"row\">Who to ask</th>" + sts.map(function (s) { return "<td>" + G.esc(d.calls[s[0]]) + "</td>"; }).join("") + "</tr></tbody>";
      $("gridT").innerHTML = head + body;
    }
    var ys = $("yState");
    d.states.forEach(function (s) { var o = document.createElement("option"); o.value = s[0]; o.textContent = s[1]; ys.appendChild(o); });
    var want = ""; try { want = new URLSearchParams(location.search).get("state") || ""; } catch (e) {}
    ys.value = d.states.some(function (s) { return s[0] === want; }) ? want : "";
    drawGrid(ys.value);
    ys.addEventListener("change", function () { drawGrid(ys.value); });
    $("conflicts").innerHTML = li(d.conflicts);
    $("train").innerHTML = d.train.map(function (t) { return "<li><b>" + G.esc(t.t) + ".</b> " + G.esc(t.d) + " " + a("Official page", t.u) + "</li>"; }).join("");
    $("before").innerHTML = li(d.before); $("beforeSrc").innerHTML = "From " + a(d.beforeSource.t, d.beforeSource.u) + ".";
    $("strangers").innerHTML = li(d.strangers); $("strangersNote").innerHTML = G.esc(d.strangersNote) + " " + a(d.strangersSource.t, d.strangersSource.u) + ".";
    $("sitesT").innerHTML = "<thead><tr><th scope=\"col\">Site</th><th scope=\"col\">Minimum age</th></tr></thead><tbody>" + d.sites.map(function (s) { return "<tr><th scope=\"row\">" + a(s[0], s[2]) + "</th><td>" + G.esc(s[1]) + "</td></tr>"; }).join("") + "</tbody>";
    $("sitesNote").textContent = d.sitesNote;
    $("ladderL").innerHTML = d.ladder.map(function (x) { return "<li><div><b>Ages " + G.esc(x.age) + ": " + G.esc(x.t) + ".</b> " + G.esc(x.d) + "</div></li>"; }).join("");
    $("groups").innerHTML = d.groups.map(function (g) { return '<article class="card"><h3>' + G.esc(g.n) + "</h3><p>" + G.esc(g.d) + "</p><p>" + a("Official page", g.u) + "</p></article>"; }).join("");
    $("moneyL").innerHTML = li(d.money); $("moneySrc").innerHTML = "Sources: " + d.moneySources.map(function (s) { return a(s.t, s.u); }).join(" &middot; ") + ". Ask the IRS or a tax professional about your own situation.";
    $("yGaps").innerHTML = li(d.gaps);
    $("yPrint").addEventListener("click", function () {
      $("yPack").innerHTML = "<h3>Safety card for a young sitter or helper</h3><h4>Before every job</h4><ul>" + li(d.before) + "</ul><h4>With someone I do not know</h4><ul>" + li(d.strangers) + "</ul><h4>Apps with an age rule</h4><ul>" + d.sites.map(function (s) { return "<li>" + G.esc(s[0]) + ": " + G.esc(s[1]) + "</li>"; }).join("") + "</ul><p>Parent phone: ________________ Where I am working: ________________ Home by: ________</p><p class=\"small\">From vadneyk.github.io/internships/younger.html. Read " + G.esc(d.read) + ".</p>";
      $("yPack").hidden = false; G.printOnly($("yPack"), "Safety card"); $("yPack").hidden = true;
    });
  }).catch(function () { $("fedNote").textContent = "This page could not load. Try again."; });
})();
