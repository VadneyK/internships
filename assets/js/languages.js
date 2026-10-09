/* In your language: official translated pages, from data/languages.json. Nothing is translated or stored here. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  fetch("data/languages.json").then(function (r) { return r.json(); }).then(function (d) {
    var names = {}; d.languages.forEach(function (l) { names[l[0]] = l[1]; $("lLang").appendChild(Object.assign(document.createElement("option"), { value: l[0], textContent: l[1] })); });
    var states = []; d.rows.forEach(function (r) { if (states.indexOf(r.state) < 0) states.push(r.state); });
    states.forEach(function (s) { $("lState").appendChild(Object.assign(document.createElement("option"), { value: s, textContent: s })); });
    $("langNote").innerHTML = "<p>" + G.esc(d.note) + "</p>";
    $("lGaps").innerHTML = d.gaps.map(function (g) { return "<li>" + G.esc(g) + "</li>"; }).join("");
    function paint() {
      var lang = $("lLang").value, st = $("lState").value;
      var rows = d.rows.filter(function (r) { return (!lang || r.lang.indexOf(lang) > -1) && (!st || r.state === st || r.state === "All states"); });
      $("lCount").textContent = rows.length + " official page" + (rows.length === 1 ? "" : "s") + (lang ? " in " + names[lang] : "") + (st ? " for " + st : "");
      $("lList").innerHTML = rows.length ? rows.map(function (r) {
        return '<li class="card"><span class="tag ghost">' + G.esc(r.state) + "</span> " + r.lang.map(function (c) { return '<span class="tag y">' + G.esc(names[c] || c) + "</span>"; }).join(" ") +
          "<h3 style=\"margin-top:.6rem;\">" + G.esc(r.title) + "</h3><p>" + G.esc(r.covers) + '</p><p class="row"><a class="btn sm" href="' + G.esc(r.url) + '" target="_blank" rel="noopener">Open the official page</a> <span class="small muted">' + G.esc(r.from) + "</span></p></li>";
      }).join("") : '<li class="card"><p>Nothing in that language for that place yet. Try "All places", or see the list below of what we could not find.</p></li>';
    }
    ["lLang", "lState"].forEach(function (id) { $(id).addEventListener("change", paint); });
    var q = new URLSearchParams(location.search); if (q.get("lang")) $("lLang").value = q.get("lang"); if (q.get("state")) $("lState").value = q.get("state");
    paint();
  }).catch(function () { $("lCount").textContent = "The list could not load. Try again later."; });
})();
