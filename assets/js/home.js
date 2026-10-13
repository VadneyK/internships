/* Home page: "what fits you" picker and the closing-soon list. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var nameRank = {}; /* id to position in the home file, which is in name order */
  var all = []; /* the home file: enough to match, sort and draw the closing-soon list */
  var pickRun = 0; /* counts picker changes so a slow download never draws over a newer pick */

  var L = G.lib;
  function fut(e) { return L.futureDeadline(e, Date.now()); }

  var fields = Object.keys(G.FIELDS).filter(function (k) { return k !== "any"; });
  fields.forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = G.FIELDS[k]; $("pField").appendChild(o); });

  // Carry the picked age into the permit and deadline links. No age: the plain links.
  function linkAge() {
    var age = $("pAge") ? $("pAge").value : "";
    var offer = document.querySelector("#offer a.btn"), soon = document.querySelector("#soon a.btn");
    var ageQ = age ? "?age=" + encodeURIComponent(age) : "";
    if (offer) offer.setAttribute("href", "permit.html" + ageQ);
    var goals = document.querySelectorAll("#goalChips a");
    for (var gi = 0; gi < goals.length; gi++) {
      var gh = goals[gi].getAttribute("href").split("?")[0], gk = (goals[gi].getAttribute("href").split("?")[1] || "").replace(/&?age=\d+/, "");
      goals[gi].setAttribute("href", gh + (gk || age ? "?" : "") + gk + (age ? (gk ? "&" : "") + "age=" + encodeURIComponent(age) : ""));
    }
    if (soon) soon.setAttribute("href", "calendar.html" + ageQ);
  }

  /* The paying-job card follows the picked age. 12 and 13 get an Under 14 start; 18 has no minor permit step. */
  var step1 = $("jobStep1"), young = $("jobYoung");
  var step1Plain = step1 ? step1.innerHTML : "";
  function drawJobNow() {
    var age = $("pAge") ? $("pAge").value : "";
    if (young) young.hidden = !(age === "12" || age === "13");
    if (step1) step1.innerHTML = age === "18" ?
      '<b>Step 1.</b> You are 18: no minor work permit.<br><a class="btn" href="jobs.html?age=18">See employers that hire at 18</a>' : step1Plain;
  }

  /* The closing-soon list follows the picked age and area (the field pick does not apply to it). announce is true only after a change. */
  function drawSoon(announce) {
    var age = $("pAge").value, hub = $("pHub").value;
    var st = { age: age, place: hub };
    var soon = all.filter(function (e) { return fut(e) && e.deadline_confidence === "confirmed-2026-27" && L.matches(e, st, Date.now()); })
      .sort(function (a, b) { return fut(a) - fut(b) || (a.priority || 3) - (b.priority || 3) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }).slice(0, 8);
    var note = $("soonNote"), stat = $("soonStatus");
    if (note) {
      if (age || hub) {
        var opt = $("pHub").options[$("pHub").selectedIndex];
        note.textContent = "Showing deadlines for" + (age ? " age " + age : "") + (hub ? (age ? " in " : " in ") + (opt ? opt.textContent.replace(/\s*\(\d+\)\s*$/, "") : hub) : "") + ". Clear the picker to see all.";
        note.hidden = false;
      } else { note.textContent = ""; note.hidden = true; }
    }
    if (stat && announce) stat.textContent = soon.length === 1 ? "1 closing soon deadline shown." : soon.length + " closing soon deadlines shown.";
    $("soonList").innerHTML = soon.length ? soon.map(function (e) {
      var d = fut(e), n = G.daysUntil(d), u = G.safeUrl(e.url);
      var mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
      return '<li data-id="' + G.esc(e.id) + '"><div class="d">' + mon + " " + d.getDate() + "<small>" + (n <= 0 ? "today" : n === 1 ? "1 day" : n + " days") + "</small></div><div><b>" + G.esc(e.name) + '</b> <span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><br><span class="small muted">' + G.esc(e.org || "") + " &middot; " + G.esc(e.city || "") + "</span>" +
        (u ? ' <br><a href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name + (e.org ? ", " + e.org : "")) + '">Official page</a>' : "") + "</div></li>";
    }).join("") : '<li><div class="d">Soon</div><div>No confirmed deadlines in the next few weeks. Browse everything by month on the <a href="find.html?view=dates">Programs page</a>.</div></li>';
  }

  var announceNext = false; /* true only while a picker change is being handled, never on load */
  function pick() {
    var run = ++pickRun; /* a newer pick, even a cleared one, makes any slower card load stale */
    markSteps();
    syncChip();
    linkAge();
    drawJobNow();
    drawSoon(announceNext);
    var age = $("pAge").value, hub = $("pHub").value, field = $("pField").value;
    var box = $("matches"), more = $("matchMore"), status = $("matchStatus");
    if (!age && !hub && !field) { box.innerHTML = ""; more.hidden = true; status.textContent = ""; return; }
    var fl = field ? [field] : [];
    /* lib.rank breaks ties by name. The copy drops name instead of replacing it, so the name key is empty and ties keep the home file order (name order, and sortList is stable). The shown name is never changed. */
    var list = L.sortList(all.filter(function (e) {
      return L.matches(e, { place: hub, age: age, fields: fl }, Date.now());
    }).map(function (e) { var c = Object.assign({}, e); delete c.name; return c; }), "best", Date.now(), { age: age });
    var q = new URLSearchParams();
    if (age) q.set("age", age); if (hub) q.set("at", hub); if (field) q.set("interest", field);
    var top = list.slice(0, 4);
    function showMore() {
      more.hidden = false;
      var younger = (age === "12" || age === "13" ? ' <a class="btn sm alt" href="younger.html">Under 14? Read the ages 12 to 14 page</a>' : "");
      /* No matches: a plain link to the whole Programs page, never a "See all 0" button that opens an empty list */
      if (!list.length) { more.innerHTML = '<a class="btn" href="find.html">Browse all programs</a>' + younger; return; }
      more.innerHTML = '<a class="btn" href="find.html?' + G.esc(q.toString()) + '">See all ' + list.length + " matches</a>" + younger;
    }
    function draw(byId) {
      status.textContent = list.length === 1 ? "1 program matches. Details below." :
        list.length + " programs match. " + (list.length > top.length ? "Showing the top " + top.length + " below." : "Details below.");
      box.innerHTML = top.map(function (c) {
        var e = byId[c.id];
        if (!e) {
          c = all[nameRank[c.id]] || c; /* the sorted copy carries a rank, not a name */
          return '<article class="card prog"><h3>' + G.esc(c.name || "Program details") + '</h3><p class="org">' + G.esc(c.org || "") + '</p><p class="what">The details could not load for this one.</p><div class="actions"><a class="btn sm alt" href="find.html?' + G.esc(q.toString()) + "#p-" + G.esc(c.id) + '">Details</a></div></article>';
        }
        var u = G.safeUrl(e.url);
        var who = e.name + (e.org ? ", " + e.org : "");
        return '<article class="card prog"><div class="row"><span class="tag ' + (e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : "ghost") + '">' + G.esc(G.PAID[e.paid_type] || "") + '</span><span class="tag ghost">' + G.esc(G.TYPES[e.type] || "") + "</span></div>" +
          "<h3>" + G.esc(e.name) + '</h3><p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p><p class=\"what\">" + G.esc(e.what_you_do || "") + "</p>" +
          '<p class="when"><b>Dates</b>' + G.esc(e.deadline_text || "Not posted") + "</p>" +
          '<div class="actions">' + (u ? '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + who) + '">Official page</a>' : "") + '<a class="btn sm alt" href="find.html?' + G.esc(q.toString()) + "#p-" + G.esc(e.id) + '" aria-label="' + G.esc("Details for " + who) + '">Details</a></div></article>';
      }).join("");
    }
    if (!top.length) {
      box.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>No exact match yet</h3><p>Try a different area or interest, or browse everything.</p></div>';
      status.textContent = "No programs match yet. Try a different area or interest.";
    } else {
      /* The result cards need the long text, so each of the four programs loads its own small file. The count and link are known already. */
      box.innerHTML = "";
      status.textContent = "Your matches are loading.";
      Promise.all(top.map(function (c) {
        return G.loadProgram(c.id).then(function (full) { return full; }, function () { return null; });
      })).then(function (rows) {
        if (run !== pickRun) return;
        var byId = {};
        rows.forEach(function (r, i) { if (r) byId[top[i].id] = r; });
        draw(byId);
      });
    }
    showMore();
  }
  /* Start from the age and area last chosen on Programs (localStorage "findprefs"). Read only, never written here. Skipped when the address has parameters. */
  var PREF_KEY = "findprefs";
  function savedPrefs() {
    if (location.search) return;
    var pr = G.store.get(PREF_KEY, {});
    if (typeof pr.age === "string" && pr.age) {
      var ok = Array.prototype.some.call($("pAge").options, function (o) { return o.value === pr.age; });
      if (ok) $("pAge").value = pr.age;
    }
    if (typeof pr.place === "string" && pr.place && L.placeRegions(pr.place)) {
      var okp = Array.prototype.some.call($("pHub").options, function (o) { return o.value === pr.place; });
      if (okp) $("pHub").value = pr.place;
    }
    ["pAge", "pHub"].forEach(function (id) { if ($(id)._tpSync) $(id)._tpSync(); });
  }
  /* The three steps (2026-10-12: home picker flow). The real selects stay the source of truth; the search box, the chip and the tiles only set them and fire "change". */
  var hub = $("pHub"), touchedHub = false, tapAge = false, ageTp = $("pAge").nextSibling;
  var q = null, list = null, note = null, chip = null, res = [], act = -1, groupOf = {}, placesFailed = false;
  function fieldOf(id) { return $(id).parentNode; }
  /* The step to do next is raised. Finished steps get the yellow badge. Step 1 stays open: a teen can change it any time. */
  function markSteps() {
    var d = [$("pAge").value !== "", hub.value !== "" || touchedHub, $("pField").value !== ""], now = d.indexOf(false);
    ["pAge", "pHub", "pField"].forEach(function (id, i) { var f = fieldOf(id); f.classList.toggle("now", i === (now < 0 ? 2 : now)); f.classList.toggle("done", d[i]); });
  }
  /* A place's name as the tiles show it: no count, and an area reads "All of ..." */
  function nameOf(o) { return (o.value.indexOf("area:") === 0 ? "All of " : "") + o.textContent.replace(/\s*\((?:\d+|none yet)\)$/, ""); }
  function norm(t) { return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  /* Matches for what was typed: the name starts with it, a word starts with it, it is inside the name, then the part of the country. Best eight. */
  function findPlaces(t) {
    t = norm(t); if (!t) return [];
    var out = [], seen = {};
    for (var i = 1; i < hub.options.length; i++) {
      var o = hub.options[i], nm = norm(o.textContent.replace(/\s*\((?:\d+|none yet)\)$/, "")), s = nm.indexOf(t) === 0 ? 0 : (" " + nm).indexOf(" " + t) > -1 ? 1 : nm.indexOf(t) > -1 ? 2 : norm(groupOf[o.value] || "").indexOf(t) > -1 ? 3 : -1;
      if (s < 0) continue;
      var k = nameOf(o); /* the area and the state "All of Texas" read the same: show the state */
      if (seen[k] != null) { if (o.value.indexOf("state:") === 0) out[seen[k]] = { i: i, s: s }; continue; }
      seen[k] = out.length; out.push({ i: i, s: s });
    }
    return out.sort(function (a, b) { return a.s - b.s || a.i - b.i; }).slice(0, 8);
  }
  function setPlace(i) { hub.selectedIndex = i; hub.dispatchEvent(new Event("change", { bubbles: true })); }
  function openList(on) {
    list.hidden = !on; q.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on || act < 0) q.removeAttribute("aria-activedescendant"); else q.setAttribute("aria-activedescendant", "pHubOpt" + act);
  }
  function showAct(n) {
    act = n;
    Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === n ? "true" : "false"); });
    openList(true);
  }
  function typed() {
    var t = q.value.trim(); res = findPlaces(t); act = res.length ? 0 : -1;
    list.textContent = "";
    res.forEach(function (r, k) {
      var o = hub.options[r.i], c = /\((\d+|none yet)\)$/.exec(o.textContent), li = document.createElement("li");
      li.id = "pHubOpt" + k; li.className = "combo-opt"; li.setAttribute("role", "option");
      li.appendChild(document.createTextNode(nameOf(o)));
      var n = document.createElement("span"); n.className = "n"; n.textContent = c ? (/^\d/.test(c[1]) ? c[1] + (c[1] === "1" ? " program" : " programs") : c[1]) : ""; li.appendChild(n);
      li.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
      li.addEventListener("click", function () { setPlace(r.i); });
      list.appendChild(li);
    });
    note.textContent = !t || res.length ? "" : hub.options.length < 2 ? (placesFailed ? "The places could not load. Use the Programs page instead." : "The places are still loading. Try again in a moment.") : "No place called \u201c" + t + "\u201d. Try a state, or pick a part of the country below.";
    note.hidden = !note.textContent;
    if (note.hidden) q.removeAttribute("aria-describedby"); else q.setAttribute("aria-describedby", "pHubNone");
    if (res.length) showAct(0); else openList(false);
  }
  /* The chosen place shows as a chip; tapping it clears the place back to Anywhere. */
  function syncChip() {
    if (!chip) return;
    var o = hub.value ? hub.options[hub.selectedIndex] : null;
    chip.hidden = !o; chip.textContent = "";
    if (!o) return;
    var b = document.createElement("button"), x = document.createElement("span"), sr = document.createElement("span");
    b.type = "button"; b.className = "chip clear"; b.appendChild(document.createTextNode(nameOf(o) + " "));
    x.setAttribute("aria-hidden", "true"); x.textContent = "\u00d7"; sr.className = "sr"; sr.textContent = " clear"; b.appendChild(x); b.appendChild(sr);
    b.addEventListener("click", function () { setPlace(0); q.focus(); });
    chip.appendChild(b); q.value = ""; res = []; openList(false);
  }
  function setupWhere() {
    var f = fieldOf("pHub"), wrap = document.createElement("div"), box = document.createElement("div"), cap = document.createElement("p");
    hub.classList.add("tp-hidden"); hub.setAttribute("tabindex", "-1"); hub.setAttribute("aria-hidden", "true");
    box.className = "chips"; box.hidden = true; chip = box;
    wrap.className = "combo";
    q = document.createElement("input"); q.type = "text"; q.id = "pHubQ"; q.placeholder = "Type your city or state";
    q.setAttribute("role", "combobox"); q.setAttribute("aria-autocomplete", "list"); q.setAttribute("aria-expanded", "false"); q.setAttribute("aria-controls", "pHubList"); q.setAttribute("aria-labelledby", "pHubLbl");
    q.setAttribute("autocomplete", "off"); q.setAttribute("autocapitalize", "off"); q.setAttribute("spellcheck", "false"); q.setAttribute("enterkeyhint", "search");
    list = document.createElement("ul"); list.id = "pHubList"; list.className = "combo-list"; list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Matching places"); list.hidden = true;
    note = document.createElement("p"); note.id = "pHubNone"; note.className = "small muted"; note.hidden = true;
    wrap.appendChild(q); wrap.appendChild(list); wrap.appendChild(note);
    cap.className = "small muted"; cap.textContent = "Or pick a part of the country:";
    f.insertBefore(chip, hub); f.insertBefore(wrap, hub); f.insertBefore(cap, hub);
    q.addEventListener("input", typed);
    q.addEventListener("focus", function () { if (q.value.trim()) typed(); });
    q.addEventListener("blur", function () { openList(false); });
    q.addEventListener("keydown", function (ev) {
      var k = ev.key, open = !list.hidden;
      if (k === "ArrowDown" || k === "ArrowUp") {
        ev.preventDefault();
        if (!open) { typed(); return; }
        showAct((act + (k === "ArrowDown" ? 1 : res.length - 1)) % res.length);
      } else if (k === "Enter") { ev.preventDefault(); if (open && act > -1) setPlace(res[act].i); }
      else if (k === "Escape") { if (open) { ev.preventDefault(); openList(false); } else q.value = ""; }
    });
    $("pHubLbl").addEventListener("click", function (ev) { ev.preventDefault(); q.focus(); });
  }
  /* Which part of the country each place sits in, from the same groups the tiles use, so "midwest" finds the Midwest cities. */
  function nameGroups() {
    L.PICK_GROUPS.forEach(function (g) {
      g[1].forEach(function (a) { groupOf["area:" + a] = g[0]; }); (g[3] || []).forEach(function (a) { groupOf["state:" + a] = g[0]; }); g[2].forEach(function (c) { groupOf["city:" + c] = g[0]; });
    });
  }
  setupWhere();
  /* Picking an age raises step 2 and, a moment later, moves the cursor to the search box if the teen has not moved on. */
  if (ageTp) ageTp.addEventListener("click", function () { tapAge = true; setTimeout(function () { tapAge = false; }, 0); }, true);
  function afterAge() {
    if (!tapAge || hub.value) return;
    setTimeout(function () { var a = document.activeElement; if (!hub.value && (a === document.body || (ageTp && ageTp.contains(a)))) q.focus(); }, 250);
  }
  ["pAge", "pHub", "pField"].forEach(function (id) { $(id).addEventListener("change", function () { if (id === "pHub") touchedHub = true; if (id === "pAge") afterAge(); announceNext = true; try { pick(); } finally { announceNext = false; } }); });
  linkAge();

  G.loadEntries("home").then(function (data) {
    all = data;
    all.forEach(function (e, i) { nameRank[e.id] = i; });
    G.fillPlaces(hub, all);
    nameGroups();
    G.placeTiles(hub);
    var tpSync = hub._tpSync; hub._tpSync = function () { tpSync(); syncChip(); }; /* code that sets the place also repaints the chip */
    savedPrefs();
    pick();
  }).catch(function () {
    placesFailed = true; q.placeholder = "The places could not load";
    $("soonList").innerHTML = '<li><div class="d">!</div><div>Could not load the list. See the closing dates on the <a href="find.html?view=dates">Programs page</a>.</div></li>';
  });
})();
