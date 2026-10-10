/* Safe at work: sourced points, hotlines and gaps. Content is data/safety.json. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }
  function tel(n) { return '<a href="tel:' + G.esc(n.tel) + '">' + G.esc(n.display) + "</a>"; }
  function numberLine(n) { return (n.label ? G.esc(n.label) + ": " : "") + tel(n); }

  function pointCard(p) {
    return '<article class="card"><p>' + G.esc(p.text) + '</p><p class="small"><q>' + G.esc(p.quote) + '</q></p><p class="small muted">Source: ' + a(p.source, p.url) + "</p></article>";
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "the page we read"; } }
  function hotlineItem(h) {
    return '<li class="card"><p><b>' + G.esc(h.name) + "</b></p><p>" + h.numbers.map(numberLine).join("<br>") + "</p><p class=\"small\">" + G.esc(h.covers) + '</p><p class="small muted">Number from: ' + a(host(h.url), h.url) + "</p></li>";
  }
  function hotlines(list) {
    var groups = [], by = {};
    list.forEach(function (h) {
      if (!by[h.group]) { by[h.group] = []; groups.push(h.group); }
      by[h.group].push(h);
    });
    return groups.map(function (g) {
      return "<h3>" + G.esc(g) + '</h3><ul style="list-style:none;padding:0;display:grid;gap:.9rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));align-items:start;">' + by[g].map(hotlineItem).join("") + "</ul>";
    }).join("");
  }

  fetch("data/safety.json").then(function (r) { return r.json(); }).then(function (d) {
    $("sSteps").innerHTML = d.start.steps.map(function (s) {
      return "<li>" + G.esc(s.text) + ' <span class="small muted">(' + a(s.src.t, s.src.u) + (s.src2 ? " &middot; " + a(s.src2.t, s.src2.u) : "") + ")</span></li>";
    }).join("");
    $("sStartNote").textContent = d.start.note;
    $("sTop").innerHTML = d.hotlines.filter(function (h) { return h.top; }).map(function (h) {
      return "<li><b>" + G.esc(h.name) + ":</b> " + h.numbers.map(numberLine).join(" &middot; ") + "</li>";
    }).join("");

    d.sections.forEach(function (s) {
      var cards = '<div class="grid g2" style="align-items:start;">' + s.points.map(pointCard).join("") + "</div>";
      var body = s.id === "call" ? hotlines(d.hotlines) + "<h3>" + G.esc(d.callHeading) + "</h3>" + cards : cards;
      $("sec-" + s.id).querySelector("h2").textContent = s.title;
      $("sbody-" + s.id).innerHTML = "<p>" + G.esc(s.plain) + "</p>" + body;
    });

    $("sGaps").innerHTML = d.gaps.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
  }).catch(function () {
    $("sbody-rights").innerHTML = '<p class="muted">The safety facts could not load. Try again.</p>';
  });
})();
