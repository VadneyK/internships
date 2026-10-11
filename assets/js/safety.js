/* Safe at work: sourced points, hotlines and gaps. Content is data/safety.json. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
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
      return '<div class="hgroup" data-group="' + G.esc(g) + '"><h3>' + G.esc(g) + '</h3><ul style="list-style:none;padding:0;display:grid;gap:.9rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));align-items:start;">' + by[g].map(hotlineItem).join("") + "</ul></div>";
    }).join("") + '<p class="callout plain small" id="sOtherNote" hidden>Your state is not one of these four. The numbers above are the national ones. For your own state\'s number to call, use <a href="permit.html">the work permit finder</a>.</p>';
  }

  var STATES = { ca: "California", ga: "Georgia", ny: "New York", il: "Illinois" };
  var sel = $("sState"), said = $("sCallStatus");
  var PD = null; /* data/permits.json, once loaded: the state cards carry an agency phone line */
  var BIG = { ca: 1, ga: 1, ny: 1, il: 1 }; /* these four have full hotline cards above, built from safety.json */
  var PHONE = /(?:1[-. ])?(?:\(\d{3}\)\s?|\d{3}[-. ])\d{3}[-. ]\d{4}/g;
  /* The agency line exactly as the permit card says it. Only a number already in that line becomes a tap-to-call link. */
  function callLine(text) {
    var out = "", last = 0, m;
    PHONE.lastIndex = 0;
    while ((m = PHONE.exec(text))) {
      var digits = m[0].replace(/\D/g, "").slice(-10);
      out += G.esc(text.slice(last, m.index)) + '<a href="tel:+1' + digits + '">' + G.esc(m[0]) + "</a>";
      last = m.index + m[0].length;
    }
    return out + G.esc(text.slice(last));
  }
  function hasNumber(text) { PHONE.lastIndex = 0; return PHONE.test(text); }
  /* Internal notes from the permit data (for example "mass.gov blocked our reader") never reach a teen. */
  function cleanCall(text) {
    return String(text || "")
      .replace(/\s*\([^)]*(?:our reader|confirm there)[^)]*\)/gi, "")
      .replace(/\s*No phone number is listed on this card\. Use the agency website\./, ". No phone number found. Use the agency website.")
      .trim();
  }
  function stateCard(id) {
    var s = PD.states[id];
    return '<div class="card" data-state="' + G.esc(id) + '"><p><b>' + G.esc(s.name) + "</b></p><p>" + callLine(cleanCall(s.call)) + '</p><p class="small muted">Read the <a href="permit.html?state=' + G.esc(id) + '">' + G.esc(s.name) + ' work permit card</a>. Read ' + G.esc(s.read || PD.read || "") + ".</p></div>";
  }
  function renderStateCalls(v) {
    var box = $("sStateCalls"), sec = $("sec-statecalls");
    if (!box || !PD) return;
    var ids = Object.keys(PD.states).filter(function (k) { return !BIG[k]; });
    if (v) ids = ids.filter(function (k) { return k === v; });
    /* States with a phone number come first, then the rest, each group in its own order. */
    ids = ids.map(function (k, i) { return { k: k, i: i, n: hasNumber(String(PD.states[k].call || "")) }; })
      .sort(function (x, y) { return (y.n - x.n) || (x.i - y.i); })
      .map(function (x) { return x.k; });
    box.innerHTML = '<div style="display:grid;gap:.9rem;grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr));align-items:start;">' + ids.map(stateCard).join("") + "</div>";
    if (sec) sec.hidden = !ids.length;
  }
  function optName(v) {
    for (var i = 0; sel && i < sel.options.length; i++) if (sel.options[i].value === v) return sel.options[i].textContent;
    return v;
  }
  /* Keep the picked state in the Next links, so the teen does not pick it again on the next page.
     Each link gets the state only when that page reads it: paycheck (ga, ny, il, ca), permit (all four), rules (ca). */
  function syncNext(v) {
    var box = $("sNext"); if (!box) return;
    var st = v && v !== "other" ? v : "";
    Array.prototype.forEach.call(box.querySelectorAll("a[href]"), function (a) {
      var base = a.getAttribute("href").split("?")[0];
      var ok = base === "paycheck.html" ? !!STATES[st]
        : base === "permit.html" ? !!st
        : base === "rules.html" ? st === "ca"
        : false;
      a.setAttribute("href", ok ? base + "?state=" + st : base);
    });
  }
  function applyState(v, announce) {
    syncNext(v);
    renderStateCalls(v);
    var groups = document.querySelectorAll("#sbody-call .hgroup"), shown = 0;
    Array.prototype.forEach.call(groups, function (g) {
      var name = g.getAttribute("data-group");
      var show = name === "National" || !v || (v !== "other" && STATES[v] === name);
      g.hidden = !show;
      if (show) shown += g.querySelectorAll("li").length;
    });
    var note = $("sOtherNote"); if (note) note.hidden = v !== "other";
    if (!announce || !said) return;
    said.textContent = !v ? "Showing all " + shown + " numbers, for every state."
      : v === "other" ? "Showing the " + shown + " national numbers. For your state's own number, use the work permit finder."
      : "Showing " + shown + " numbers: the national ones and " + optName(v) + ".";
  }
  function covered(x) { return Object.prototype.hasOwnProperty.call(STATES, x) ? x : ""; }
  /* The state to start on. A ?state= in the address wins, even when it is unknown. Otherwise the area saved on Programs
     (localStorage "findprefs", read only) counts when it sits in one of the four states here. */
  function wantState() {
    var w = ""; try { w = (new URLSearchParams(location.search).get("state") || "").toLowerCase(); } catch (e) {}
    if (w) return w !== "other" && sel && optName(w) !== w ? w : "";
    var pr = G.store.get("findprefs", {});
    return covered(pr && typeof pr.place === "string" ? L.stateFromPlace(pr.place) : "");
  }
  if (sel) sel.addEventListener("change", function () { applyState(sel.value, true); });

  G.fetchData("data/permits.json").then(function (r) { return r.json(); }).then(function (d) {
    if (!d || !d.states) throw new Error("shape");
    PD = d; renderStateCalls(sel ? sel.value : "");
  }).catch(function () {
    var b = $("sStateCalls"); if (b) b.innerHTML = '<p class="muted">The state numbers could not load. Use <a href="permit.html">the work permit finder</a>.</p>';
  });

  G.fetchData("data/safety.json").then(function (r) { return r.json(); }).then(function (d) {
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
    if (sel) { sel.value = wantState(); if (sel._tpSync) sel._tpSync(); applyState(sel.value, false); }

    $("sGaps").innerHTML = d.gaps.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
  }).catch(function () {
    $("sbody-rights").insertAdjacentHTML("beforeend", '<p class="muted">The rest of the safety facts could not load. Try again.</p>');
    $("sStatus").textContent = "The safety facts could not load. Try again.";
  });
})();
