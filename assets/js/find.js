/* Programs page: filters, sorting, deadline view, saved list. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var all = [];
  var state = { q: "", hubs: [], place: "", age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false, view: "cards", sort: "best", saved: false };

  var L = G.lib, PAID_GROUPS = L.PAID_GROUPS;
  function now() { return Date.now(); }
  var hubOf = L.hubsOf;
  function matches(e) { state.savedIds = G.saved.ids(); return L.matches(e, state, now()); }
  function sortList(list) { return L.sortList(list, state.sort, now()); }
  function cmp(a, b) { return L.compare(a, b, now()); }
  function futureDeadline(e) { return L.futureDeadline(e, now()); }
    function anytime(e) { return L.isAnytime(e, now()); }
  function isOpenish(e) { return L.isOpenish(e, now()); }
  function statusTag(e) {
    var st = L.effStatus(e, now());
    if (st === "open-now") return '<span class="tag good">Open now</span>';
    if (st === "opens-soon") return '<span class="tag y">Opens soon</span>';
    if (st === "rolling") return '<span class="tag good">Apply anytime</span>';
    if (st === "year-round") return '<span class="tag good">Year-round</span>';
    if (st === "event") return '<span class="tag y">Event</span>';
    if (st === "closed-expect-reopen") return '<span class="tag ghost">Closed, check back</span>';
    return '<span class="tag ghost">Dates unconfirmed</span>';
  }
  function deadlineLine(e) {
    var d = futureDeadline(e), extra = "";
    if (d) {
      var n = G.daysUntil(d);
      extra = n === 0 ? " (today)" : n <= 45 ? " (" + n + " days)" : "";
    }
    var conf = e.deadline_confidence === "last-year-pattern" ? ' <span class="tag warn">Based on last year</span>' : "";
    return '<p class="when"><b>Dates</b>' + G.esc(e.deadline_text || "Not posted") + G.esc(extra) + conf + "</p>";
  }
  function ageText(e) { return L.ageText(e); }
  function paidTag(e) {
    var t = G.PAID[e.paid_type] || "";
    var cls = e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : e.paid_type === "fee-based" ? "warn" : "ghost";
    return t ? '<span class="tag ' + cls + '">' + G.esc(t) + "</span>" : "";
  }

  function card(e) {
    var saved = G.saved.has(e.id);
    var u = G.safeUrl(e.url), a = G.safeUrl(e.apply_url);
    var vtag = e.verified === "fetched"
      ? '<span class="tag good">Read on official site</span>'
      : '<span class="tag warn">Confirm first</span>';
    var hubs = (e.regions || []).map(function (r) { var f = G.REGIONS.filter(function (x) { return x[0] === r; })[0]; return f ? f[1] : ""; }).filter(Boolean);
    var html = '<article class="card prog" id="p-' + G.esc(e.id) + '">';
    html += '<div class="row">' + statusTag(e) + paidTag(e) + '<span class="tag ghost">' + G.esc(G.TYPES[e.type] || e.type) + "</span></div>";
    html += "<h3>" + G.esc(e.name) + "</h3>";
    html += '<p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p>";
    html += '<p class="what">' + G.esc(e.what_you_do || "") + "</p>";
    html += '<div class="row"><span class="tag ghost">' + G.esc(ageText(e)) + "</span></div>";
    if (e.pay_detail) html += '<p class="pay"><b>Pay or cost:</b> ' + G.esc(e.pay_detail) + "</p>";
    html += deadlineLine(e);
    html += "<details><summary>Who can apply and how</summary><dl>";
    if (e.who_can_apply) html += "<div><dt>Who can apply</dt><dd>" + G.esc(e.who_can_apply) + "</dd></div>";
    if (e.how_to_apply) html += "<div><dt>How to apply</dt><dd>" + G.esc(e.how_to_apply) + "</dd></div>";
    if (e.duration) html += "<div><dt>How long</dt><dd>" + G.esc(e.duration) + "</dd></div>";
    if (e.needs_work_permit === true) {
      var st = L.stateOf(e);
      var permit = { ca: "Paid work under 18 needs a California work permit. See the <a href=\"rules.html\">Rules page</a>.",
        ga: "Georgia requires a work permit for paid work under 16. See <a href=\"states.html#georgia\">the Georgia rules</a>.",
        ny: "New York requires working papers for ages 14 to 17. See <a href=\"states.html#newyork\">the New York rules</a>.",
        il: "Illinois requires an employment certificate for paid work under 16. See <a href=\"states.html#illinois\">the Illinois rules</a>." }[st] ||
        "Teens often need a work permit for paid work. The rules depend on your state: see <a href=\"rules.html\">California</a> or <a href=\"states.html\">other states</a>.";
      var pk = (e.paid_type === "paid" || e.paid_type === "stipend" || e.paid_type === "mixed") && e.type === "paid-youth-program" ? "program" : "job";
      permit += st && L.PERMIT_STATES.indexOf(st) > -1 ? ' <a href="permit.html?state=' + st + "&kind=" + pk + '">Find your exact permit and steps</a>.' : ' <a href="permit.html">Find your permit</a>.';
      html += "<div><dt>Work permit</dt><dd>" + permit + "</dd></div>";
    }
    if (e.notes) html += "<div><dt>Good to know</dt><dd>" + G.esc(e.notes) + "</dd></div>";
    html += "</dl></details>";
    html += '<div class="actions">';
    if (u) html += '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener">Official page</a>';
    if (a && a !== u) html += '<a class="btn sm alt" href="' + G.esc(a) + '" target="_blank" rel="noopener">Apply</a>';
    if (futureDeadline(e)) html += '<button class="btn sm alt noprint" type="button" data-cal="' + G.esc(e.id) + '">Add deadline to calendar</button>';
    html += '<button class="star noprint" type="button" data-id="' + G.esc(e.id) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove " : "Save ") + G.esc(e.name) + ' to my list" title="Save to my list">&#9733;</button>';
    html += "</div>";
    html += '<p class="checked">' + vtag + " Checked " + G.esc(e.verified_on_label || "Oct 7, 2026") + "</p>";
    html += "</article>";
    return html;
  }

  function renderDates(list) {
    var box = $("dates");
    var withD = list.filter(futureDeadline).sort(function (a, b) { return futureDeadline(a) - futureDeadline(b) || cmp(a, b); });
    var months = {}, order = [];
    withD.forEach(function (e) {
      var d = futureDeadline(e), k = d.getFullYear() * 100 + d.getMonth();
      if (!months[k]) { months[k] = []; order.push(k); }
      months[k].push(e);
    });
    var names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var html = "";
    order.forEach(function (k) {
      var y = Math.floor(k / 100), m = k % 100;
      html += '<div class="month"><h3>' + names[m] + " " + y + "</h3><ul class=\"tl\">";
      months[k].forEach(function (e) {
        var d = futureDeadline(e);
        html += '<li><div class="d">' + names[m].slice(0, 3) + " " + d.getDate() + "<small>closes</small></div><div><b>" + G.esc(e.name) + "</b> " + paidTag(e) +
          '<br><span class="small muted">' + G.esc(e.org || "") + " &middot; " + G.esc(ageText(e)) + "</span>" +
          (e.deadline_confidence === "last-year-pattern" ? ' <span class="tag warn">Based on last year</span>' : "") +
          '<br><a href="#p-' + G.esc(e.id) + '" data-jump="' + G.esc(e.id) + '">See card</a>' +
          (G.safeUrl(e.url) ? ' &middot; <a href="' + G.esc(G.safeUrl(e.url)) + '" target="_blank" rel="noopener">Official page</a>' : "") + "</div></li>";
      });
      html += "</ul></div>";
    });
    var open = list.filter(function (e) { return !futureDeadline(e) && (anytime(e) || isOpenish(e)); });
    if (open.length) {
      html += '<div class="month"><h3>Apply anytime or no fixed date</h3><ul class="tl">';
      open.slice(0, 80).forEach(function (e) {
        html += '<li><div class="d">Open<small>anytime</small></div><div><b>' + G.esc(e.name) + "</b> " + paidTag(e) + '<br><span class="small muted">' + G.esc(e.deadline_text || "") + "</span> " +
          (G.safeUrl(e.url) ? '<a href="' + G.esc(G.safeUrl(e.url)) + '" target="_blank" rel="noopener">Official page</a>' : "") + "</div></li>";
      });
      html += "</ul></div>";
    }
    box.innerHTML = html || '<div class="card empty"><h3>No upcoming deadlines match</h3><p>Clear a filter or switch to Cards.</p></div>';
  }

  /* known gaps for the areas you are looking at, each linked to its issue */
  var gaps = [];
  function paintGaps() {
    var box = $("gaps"); if (!box) return;
    var hubsNow = state.hubs.length ? state.hubs : state.place ? L.hubsOfPlace(state.place) : [];
    var mine = hubsNow.length ? gaps.filter(function (g) { return g.hubs.some(function (h) { return hubsNow.indexOf(h) > -1; }); }) : [];
    if (!mine.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = "<h3>Known gaps in this area</h3><ul>" + mine.map(function (g) {
      return "<li><b>" + G.esc(g.title) + ".</b> " + G.esc(g.text) + ' <a href="https://github.com/VadneyK/internships/issues/' + g.issue + '">Issue ' + g.issue + "</a></li>";
    }).join("") + "</ul>";
  }
  fetch("data/gaps.json").then(function (r) { return r.json(); }).then(function (g) { gaps = g; paintGaps(); }).catch(function () {});

  function paintPlaceNote(realN) {
    var box = $("placeNote"); if (!box) return;
    if (!state.place) { box.hidden = true; box.innerHTML = ""; return; }
    var name = G.esc(L.placeLabel(state.place));
    box.hidden = false;
    box.innerHTML = realN === 0
      ? "<b>We have not found programs in " + name + " yet.</b> Showing online and national programs you can do from anywhere. <a href=\"contribute.html\">Know one? Help add it.</a>"
      : realN < 3
        ? "<b>Only " + realN + " program" + (realN === 1 ? "" : "s") + " found in " + name + " so far,</b> so online and national programs are included too. <a href=\"contribute.html\">Know another? Help add it.</a>"
        : "Showing programs in <b>" + name + "</b>.";
  }

  var PAGE = 60, shown = PAGE;
  function render(resetPage) {
    if (resetPage) shown = PAGE;
    state.placeOnline = false;
    var list = sortList(all.filter(matches));
    var realN = list.length;
    if (state.place && realN < 3) { state.placeOnline = true; list = sortList(all.filter(matches)); }
    paintPlaceNote(realN);
    $("count").textContent = list.length + " of " + all.length + " programs";
    $("savedN").textContent = G.saved.ids().length;
    var out = $("out"), dates = $("dates");
    $("listActions").hidden = !state.saved;
    paintGaps();
    if (state.view === "dates") {
      out.hidden = true; dates.hidden = false; renderDates(list); persist(); return;
    }
    out.hidden = false; dates.hidden = true;
    if (!list.length) {
      out.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Nothing matches yet</h3><p>Try a different age or area, or clear the filters. Programs near you may also appear under &ldquo;California&rdquo; or &ldquo;Online and national&rdquo;.</p><button class="btn" type="button" id="emptyReset">Clear all filters</button></div>';
      var er = $("emptyReset"); if (er) er.onclick = resetAll;
    } else {
      var slice = list.slice(0, shown);
      out.innerHTML = slice.map(card).join("") + (list.length > shown ? '<div class="pager" style="grid-column:1/-1"><button class="btn alt" type="button" id="more">Show more (' + (list.length - shown) + " left)</button></div>" : "");
      var more = $("more"); if (more) more.onclick = function () { shown += PAGE; render(false); };
    }
    persist();
  }

  /* chips */
  function chipGroup(id, items, key, multi) {
    var box = $(id);
    box.innerHTML = items.map(function (it) {
      return '<button class="chip" type="button" data-key="' + key + '" data-val="' + G.esc(it[0]) + '" aria-pressed="false">' + G.esc(it[1]) + (it[2] != null ? '<span class="n">' + it[2] + "</span>" : "") + "</button>";
    }).join("");
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip"); if (!b) return;
      var v = b.getAttribute("data-val"), arr = state[key], i = arr.indexOf(v);
      if (i > -1) arr.splice(i, 1); else arr.push(v);
      if (key === "hubs") state.place = "";
      syncChips(); render(true);
    });
  }
  function syncChips() {
    document.querySelectorAll(".chip[data-key]").forEach(function (b) {
      var arr = state[b.getAttribute("data-key")];
      b.setAttribute("aria-pressed", String(arr.indexOf(b.getAttribute("data-val")) > -1));
    });
    $("place").value = state.place || "";
    $("onlyVerified").setAttribute("aria-pressed", String(state.verified));
    $("noPermit").setAttribute("aria-pressed", String(state.noPermit));
    $("savedOnly").setAttribute("aria-pressed", String(state.saved));
    $("viewCards").setAttribute("aria-pressed", String(state.view === "cards"));
    $("viewDates").setAttribute("aria-pressed", String(state.view === "dates"));
  }
  function resetAll() {
    state = { q: "", hubs: [], place: "", age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false, view: state.view, sort: "best", saved: false };
    $("q").value = ""; $("place").value = ""; $("age").value = ""; $("when").value = ""; $("season").value = ""; $("sort").value = "best";
    syncChips(); render(true);
  }

  /* url state */
  function persist() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.hubs.length) p.set("where", state.hubs.join(","));
    if (state.place) p.set("at", state.place);
    if (state.age) p.set("age", state.age);
    if (state.when) p.set("when", state.when);
    if (state.season) p.set("season", state.season);
    if (state.paid.length) p.set("pay", state.paid.join(","));
    if (state.types.length) p.set("kind", state.types.join(","));
    if (state.fields.length) p.set("interest", state.fields.join(","));
    if (state.verified) p.set("checked", "1");
    if (state.noPermit) p.set("nopermit", "1");
    if (state.view === "dates") p.set("view", "dates");
    if (state.sort !== "best") p.set("sort", state.sort);
    var qs = p.toString();
    try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "")); } catch (e) {}
  }
  function readURL() {
    var p = new URLSearchParams(location.search);
    function list(k) { return (p.get(k) || "").split(",").filter(Boolean); }
    state.q = p.get("q") || "";
    state.hubs = list("where"); state.place = p.get("at") || ""; if (state.place && !L.placeRegions(state.place)) state.place = ""; if (state.place) state.hubs = []; state.age = p.get("age") || ""; state.when = p.get("when") || ""; state.season = p.get("season") || "";
    state.paid = list("pay"); state.types = list("kind"); state.fields = list("interest");
    state.verified = p.get("checked") === "1"; state.noPermit = p.get("nopermit") === "1";
    state.view = p.get("view") === "dates" ? "dates" : "cards"; state.sort = p.get("sort") || "best";
    $("q").value = state.q; $("age").value = state.age; $("when").value = state.when; $("season").value = state.season; $("sort").value = state.sort;
  }

  G.loadEntries().then(function (data) {
    all = data;
    var hubCounts = {}; all.forEach(function (e) { hubOf(e).forEach(function (h) { hubCounts[h] = (hubCounts[h] || 0) + 1; }); });
    var QUICK = ["davis", "sv", "oak", "sf", "state", "socal", "atl", "nyc", "chi", "online"];
    chipGroup("hubChips", G.HUBS.filter(function (h) { return hubCounts[h[0]] && QUICK.indexOf(h[0]) > -1; }).map(function (h) { return [h[0], h[1], hubCounts[h[0]]]; }), "hubs");
    G.fillPlaces($("place"), all);
    $("place").addEventListener("change", function (e) { state.place = e.target.value; if (state.place) state.hubs = []; syncChips(); render(true); });
    chipGroup("paidChips", PAID_GROUPS.map(function (g) { return [g[0], g[1]]; }), "paid");
    var tc = {}; all.forEach(function (e) { tc[e.type] = (tc[e.type] || 0) + 1; });
    chipGroup("typeChips", Object.keys(G.TYPES).filter(function (k) { return tc[k]; }).map(function (k) { return [k, G.TYPES[k], tc[k]]; }), "types");
    var fc = {}; all.forEach(function (e) { (e.fields || []).forEach(function (f) { fc[f] = (fc[f] || 0) + 1; }); });
    chipGroup("fieldChips", Object.keys(G.FIELDS).filter(function (k) { return k !== "any" && fc[k]; }).map(function (k) { return [k, G.FIELDS[k], fc[k]]; }), "fields");
    readURL(); syncChips(); render(true);
    if (location.hash.indexOf("#p-") === 0) { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }
  }).catch(function (err) {
    $("count").textContent = "Could not load the list.";
    $("out").innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Something went wrong</h3><p>' + G.esc(err.message) + ". Reload the page, or open the <a href=\"data/entries.csv\">spreadsheet version</a>.</p></div>";
  });

  var qt;
  $("q").addEventListener("input", function (e) { clearTimeout(qt); var v = e.target.value; qt = setTimeout(function () { state.q = v.trim(); render(true); }, 160); });
  ["age", "when", "season", "sort"].forEach(function (id) { $(id).addEventListener("change", function (e) { state[id] = e.target.value; render(true); }); });
  $("onlyVerified").addEventListener("click", function () { state.verified = !state.verified; syncChips(); render(true); });
  $("noPermit").addEventListener("click", function () { state.noPermit = !state.noPermit; syncChips(); render(true); });
  $("savedOnly").addEventListener("click", function () { state.saved = !state.saved; syncChips(); render(true); });
  $("viewCards").addEventListener("click", function () { state.view = "cards"; syncChips(); render(false); });
  $("viewDates").addEventListener("click", function () { state.view = "dates"; syncChips(); render(false); });
  $("reset").addEventListener("click", resetAll);
  document.addEventListener("click", function (ev) {
    var cal = ev.target.closest("[data-cal]");
    if (cal) {
      var pe = all.filter(function (x) { return x.id === cal.getAttribute("data-cal"); })[0];
      if (pe && pe.deadline_iso) {
        G.download(pe.id + "-deadline.ics", L.icsEvent({ uid: "deadline-" + pe.id, title: "Deadline: " + pe.name, desc: (pe.deadline_text || "") + " " + (G.safeUrl(pe.apply_url || pe.url) || ""), dateISO: pe.deadline_iso }), "text/calendar");
        G.toast("Calendar file saved. Open it to add the deadline.");
      }
      return;
    }
    var s = ev.target.closest(".star");
    if (s) {
      var on = G.saved.toggle(s.getAttribute("data-id"));
      s.setAttribute("aria-pressed", String(on));
      $("savedN").textContent = G.saved.ids().length;
      if (state.saved && !on) render(false);
      G.toast(on ? "Saved to your list" : "Removed from your list");
      return;
    }
    var j = ev.target.closest("[data-jump]");
    if (j) {
      ev.preventDefault();
      state.view = "cards"; syncChips();
      var id = j.getAttribute("data-jump");
      var idx = sortList(all.filter(matches)).findIndex(function (e) { return e.id === id; });
      if (idx >= shown) shown = idx + 1;
      render(false);
      var el = document.getElementById("p-" + id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.querySelector("details").open = true; }
    }
  });
  $("printList").addEventListener("click", function () {
    var ids = G.saved.ids(), keep = all.filter(function (e) { return ids.indexOf(e.id) > -1; });
    var d = document.createElement("div");
    d.innerHTML = "<h1>My internship list</h1><ol>" + keep.map(function (e) {
      return "<li><b>" + G.esc(e.name) + "</b> (" + G.esc(e.org || "") + ")<br>" + G.esc(e.deadline_text || "") + "<br>" + G.esc(e.url || "") + "</li>";
    }).join("") + "</ol><p>From vadneyk.github.io/internships. Confirm dates on each program's own site.</p>";
    G.printOnly(d, "My internship list");
  });
  $("copyList").addEventListener("click", function () {
    var ids = G.saved.ids(), txt = all.filter(function (e) { return ids.indexOf(e.id) > -1; }).map(function (e) {
      return "- " + e.name + " (" + (e.org || "") + ")\n  " + (e.deadline_text || "") + "\n  " + (e.url || "");
    }).join("\n");
    G.copy(txt || "Your list is empty.");
  });
})();
