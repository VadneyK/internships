/* In your language: official translated pages, from data/languages.json. Nothing is translated or stored here. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  // Splits "Native (English)" into the native part and the bracketed English part, so only the native part gets a lang span.
  var splitName = function (name) { var m = /^(.*?) \(([^()]*)\)$/.exec(name); return m ? [m[1], " (" + m[2] + ")"] : [name, ""]; };
  fetch("data/languages.json").then(function (r) { return r.json(); }).then(function (d) {
    var names = Object.create(null); // no prototype, so a code like "__proto__" is never a real entry
    var known = function (c) { return Object.prototype.hasOwnProperty.call(names, c); };
    d.languages.forEach(function (l) {
      names[l[0]] = l[1];
      var o = Object.assign(document.createElement("option"), { value: l[0], textContent: l[1] });
      o.setAttribute("lang", l[0]);
      $("lLang").appendChild(o);
    });
    var chip = function (c) {
      if (!known(c)) return '<span class="tag y">' + G.esc(c) + "</span>";
      var parts = splitName(names[c]);
      return '<span class="tag y"><span lang="' + G.esc(c) + '">' + G.esc(parts[0]) + "</span>" + G.esc(parts[1]) + "</span>";
    };
    var states = []; d.rows.forEach(function (r) { if (states.indexOf(r.state) < 0) states.push(r.state); });
    states.forEach(function (s) { $("lState").appendChild(Object.assign(document.createElement("option"), { value: s, textContent: s })); });
    $("langNote").innerHTML = "<p>" + G.esc(d.note) + "</p>";
    $("lGaps").innerHTML = d.gaps.map(function (g) { return "<li>" + G.esc(g) + "</li>"; }).join("");
    function paint() {
      var lang = $("lLang").value, st = $("lState").value;
      var rows = d.rows.filter(function (r) { return (!lang || r.lang.indexOf(lang) > -1) && (!st || r.state === st || r.state === "All states"); });
      $("lCount").textContent = rows.length + " official page" + (rows.length === 1 ? "" : "s") + (lang && known(lang) ? " in " + names[lang] : "") + (st ? " for " + st : "");
      $("lList").innerHTML = rows.length ? rows.map(function (r) {
        var hl = r.lang.length ? ' hreflang="' + G.esc(r.lang[0]) + '"' : "";
        return '<li class="card"><span class="tag ghost">' + G.esc(r.state) + "</span> " + r.lang.map(chip).join(" ") +
          "<h3 style=\"margin-top:.6rem;\">" + G.esc(r.title) + "</h3><p>" + G.esc(r.covers) + '</p><p class="row"><a class="btn sm" href="' + G.esc(r.url) + '" target="_blank" rel="noopener"' + hl + '>Open the official page</a> <span class="small muted">' + G.esc(r.from) + "</span></p></li>";
      }).join("") : '<li class="card"><p>Nothing in that language for that place yet. Try "All places", or see the list below of what we could not find.</p></li>';
    }
    ["lLang", "lState"].forEach(function (id) { $(id).addEventListener("change", paint); });
    var q = new URLSearchParams(location.search); if (q.get("lang")) $("lLang").value = q.get("lang"); if (q.get("state")) $("lState").value = q.get("state");
    paint();
  }).catch(function () { $("lCount").textContent = "The list could not load. Try again later."; });
})();
