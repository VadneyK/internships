/* Jobs that hire teens: employers and the age each one's own page states, from data/employers.json. Nothing is stored. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  function link(u, t) { var s = G.safeUrl(u); return s ? '<a href="' + G.esc(s) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>" : G.esc(t); }
  /* Option value for an age from the address or the saved Programs age. 12 and 13 use Under 14. Anything else gives "". */
  function ageChoice(raw) {
    var s = String(raw == null ? "" : raw);
    if (s === "12" || s === "13" || s === "u14") return "u14";
    return ["14", "15", "16", "17", "18"].indexOf(s) > -1 ? s : "";
  }
  /* Permit buttons carry the picked age (14 to 18 only). Under 14, no age, or anything else gives the plain permit page. */
  function permitHref(v) { return ["14", "15", "16", "17", "18"].indexOf(String(v)) > -1 ? "permit.html?age=" + v : "permit.html"; }
  function setPermitLinks(v) {
    var h = permitHref(v);
    ["jPermitRules", "jPermitNext"].forEach(function (id) { var a = $(id); if (a) a.setAttribute("href", h); });
  }
  /* The interview link carries age 14 to 17 and a state the interview page has, only when both are picked. Otherwise it is plain. */
  function interviewHref(v, st) {
    var k = String(st || "").toLowerCase();
    return /^1[4-7]$/.test(String(v)) && L.PERMIT_STATES.indexOf(k) > -1 ? "interview.html?state=" + encodeURIComponent(k) + "&age=" + v + "#availability" : "interview.html";
  }
  /* Keeps the picked age in the address bar, so a reload or a copied link keeps it. Clearing removes it. */
  function syncAddress(v, st) {
    try {
      var u = new URL(location.href);
      if (v) u.searchParams.set("age", v); else u.searchParams.delete("age");
      if (st) u.searchParams.set("state", st); else u.searchParams.delete("state");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }
  /* State names for the picker. The ride cities are the six in data/transit.json plus the Bay Area and Sacramento table on ready.html (ride=bay); a test checks they match. */
  var NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", BC: "British Columbia" };
  var RIDES = { NY: [["nyc", "New York City"]], IL: [["chicago", "Chicago"]], GA: [["atlanta", "Atlanta"]], CA: [["bay", "Bay Area and Sacramento"], ["la", "Los Angeles"], ["orange", "Orange County"], ["sandiego", "San Diego"]] };
  /* A two-letter state code from the address or saved place, or "" when it is not one the picker has. */
  function stateChoice(raw, sel) {
    var c = String(raw == null ? "" : raw).toUpperCase();
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === c && c) return c;
    return "";
  }
  /* A US-wide entry (where "US") never matches British Columbia. */
  function inState(e, st) { return !st || (e.where && e.where.length ? e.where : ["US"]).some(function (w) { return st === "BC" ? w === "BC" : (w === "US" || w === st); }); }
  /* Rules have no where field: the BC ones start with the id prefix bc-. */
  function isBcRule(e) { return String(e.id || "").indexOf("bc-") === 0; }
  var BC_LINE = "British Columbia has its own rules. See the BC cards below.";
  var USRULES_LEAD = "These come from US Department of Labor and OSHA pages. A state can be stricter, and then the state rule wins.";
  var BCRULES_LEAD = "These are US rules. In British Columbia the rules come from the Employment Standards Branch.";
  var AGE18_LINE = "The federal limits on dangerous jobs for workers under 18 do not apply at 18.";
  var AGE18_URL = "https://www.dol.gov/agencies/whd/fact-sheets/43-child-labor-non-agriculture";
  function row(k, v) { return v ? "<div><dt>" + G.esc(k) + "</dt><dd>" + G.esc(v) + "</dd></div>" : ""; }
  function card(e) {
    return '<article class="card"><p class="small"><span class="tag y">Starts at ' + e.min_age + "</span> " + (e.caveat ? '<span class="tag caveat">' + G.esc(e.caveat) + "</span> " : "") + G.esc(e.kind) + "</p><h3>" + G.esc(e.name) + "</h3>" +
      '<dl class="facts plain">' + row("Jobs", e.roles) + row("How to apply", e.how_to_apply) + row("Good to know", e.age_note) + "</dl>" +
      '<p class="small muted">Source: ' + link(e.url, e.page_title) + "</p></article>";
  }
  /* The hours rules are optional: if the file does not load, the strip points to the work permit finder. */
  /* permits.json is read only once an age of 14 to 17 and a state are picked, so most visits never download it. */
  var pd = null, pdState = 0, pdFailed = false;
  var U14_HOURS = ["ca"];
  function loadPermits(done) {
    if (pdState) return;
    pdState = 1;
    G.fetchData("data/permits.json").then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (j) { pd = j; pdFailed = !j; pdState = 2; done(); });
  }
  /* states-lite.json (the shorter answers) is read only when the state is not in permits.json. */
  var ld = null, ldState = 0, ldFailed = false;
  function loadLite(done) {
    if (ldState) return;
    ldState = 1;
    G.stateShorts().catch(function () { return null; }).then(function (j) { ld = j; ldFailed = !j; ldState = 2; done(); });
  }
  /* state-wages.json is read only once a state in the US is picked. A failed read sets wdFailed (the fallback line shows), and the next state pick tries again. */
  var wd = null, wdState = 0, wdFailed = false;
  function loadWages(done) {
    if (wdState) return;
    wdState = 1;
    G.stateWages().catch(function () { return null; }).then(function (j) { wd = j; wdFailed = !j; wdState = 2; done(); });
  }
  function telLink(ph) {
    var digits = String(ph || "").replace(/\D/g, "");
    return digits.length === 10 ? '<a href="tel:' + digits + '">' + G.esc(ph) + "</a>" : "";
  }
  /* younger.json is read only when Under 14 is picked, so other ages never download it. */
  var yd, ydPending = false;
  function loadYounger(done) {
    if (yd !== undefined) return;
    yd = null; ydPending = true;
    G.fetchData("data/younger.json").then(function (r) { return r.json(); }).then(function (j) { yd = j; }).catch(function () { yd = null; }).then(function () { ydPending = false; done(); });
  }
  G.fetchData("data/employers.json").then(function (r) { return r.json(); }).then(function (d) {
    $("jobsNote").innerHTML = "<p>" + G.esc(d.note) + " Last read " + G.esc(d.read) + ".</p>";
    function paintRules(st) {
      var list = d.rules.filter(function (e) { return st === "BC" ? isBcRule(e) : !(st && isBcRule(e)); });
      $("jRulesLead").textContent = st === "BC" ? BCRULES_LEAD : USRULES_LEAD;
      $("jRules").innerHTML = list.map(function (e) {
        return '<article class="card"><h3>' + G.esc(e.name) + "</h3><p>" + G.esc(e.age_note) + '</p><p class="small muted">Source: ' + link(e.url, e.page_title) + "</p></article>";
      }).join("");
    }
    paintRules("");
    var stLabel = document.querySelector('label[for="jState"]');
    if (stLabel) stLabel.textContent = "Where do you live? (state or province)";
    var sel = $("jAge");
    [["u14", "Under 14"], ["14", "14"], ["15", "15"], ["16", "16"], ["17", "17"], ["18", "18"]].forEach(function (a) {
      sel.appendChild(Object.assign(document.createElement("option"), { value: a[0], textContent: a[1] }));
    });
    /* All 50 states, DC and British Columbia, alphabetical by name, so a teen in any state can pick theirs. */
    var stSel = $("jState");
    Object.keys(NAMES).sort(function (a, b) { return NAMES[a] < NAMES[b] ? -1 : 1; }).forEach(function (k) {
      stSel.appendChild(Object.assign(document.createElement("option"), { value: k, textContent: NAMES[k] }));
    });
    /* The shared type-to-search box (2026-10-13): the select stays the source of truth. */
    var stPlace = G.placeSearch(stSel, { hide: true, chip: true, caption: "", placeholder: "Type a state or province" });
    /* Puts the hours strip in #jHours. For a picked US state (not Under 14, not BC) the state wage line, or a short fallback if the wage file failed, is added to the end of the hours box with DOM methods. noFetch stops a repaint from starting another load. */
    var WAGE_FAIL = "We could not load the state wage. Check your state labor office.";
    function paintHours(v, st, noFetch) {
      var out = $("jHours");
      out.innerHTML = hoursCore(v, st);
      if (!v || !st || st === "BC" || v === "u14") return;
      var box = out.querySelector("#jHoursBox");
      if (!box) return;
      if (!wdState && !noFetch) loadWages(function () { if (sel.value && sel.value !== "u14") paintHours(sel.value, stSel.value, true); });
      var tmp = document.createElement("div");
      if (wd) tmp.innerHTML = G.wageLine(wd, st.toLowerCase());
      else if (wdFailed) tmp.appendChild(Object.assign(document.createElement("p"), { className: "small muted", textContent: WAGE_FAIL }));
      while (tmp.firstChild) box.appendChild(tmp.firstChild);
    }
    function hoursCore(v, st) {
      if (st === "BC") return '<div class="callout plain small" id="jHoursBox"><p>' + G.esc(BC_LINE) + "</p></div>";
      if (!st) return '<p class="small muted">Pick your state to see its hours rule for your age.</p>';
      if (v === "u14") {
        /* A state's own rule for 12 and 13 (permits.json hours["12"], read from its labor office), so a California teen sees California's limits here too. */
        var k12 = st.toLowerCase(), h12 = pd && pd.states && pd.states[k12] && pd.states[k12].hours && pd.states[k12].hours["12"];
        /* Only California has an under-14 row in permits.json today (a test pins this list), so other states do not fetch it. */
        if (U14_HOURS.indexOf(k12) > -1 && !pdState) loadPermits(function () { if (sel.value === "u14" && stSel.value === st) paintHours("u14", st); });
        return '<div class="callout plain small" id="jHoursBox"><p>Ages 12 and 13: see the <a href="younger.html">Ages 12 to 14 page</a> for what is allowed at your age.</p>' +
          (h12 ? '<p id="jHours12"><b>Hours at 12 and 13 in ' + G.esc(NAMES[st]) + ':</b> ' + L.linkContacts(h12) + ' <a href="permit.html?state=' + encodeURIComponent(k12) + '&amp;age=13">Work permit finder</a></p>' : "") + "</div>";
      }
      var age = Number(v), key = st.toLowerCase(), name = NAMES[st];
      var href = "permit.html?state=" + encodeURIComponent(key) + (age >= 14 && age <= 18 ? "&amp;age=" + age : "");
      function again() {
        var sv = sel.value, ss = stSel.value;
        if (!sv || sv === "u14" || !ss || ss === "BC") return;
        paintHours(sv, ss);
        if (pdFailed || ldFailed) $("jStatus").textContent = "The hours rules could not load. Use the work permit finder link for your state.";
      }
      if (age >= 14 && age < 18 && !pdState) loadPermits(again);
      var r = pd && age >= 14 && age < 18 ? L.permitFor(pd, key, age, "job") : null;
      if (!r || r.verdict === "nostate") {
        /* Not in permits.json: use the shorter state answer from states-lite.json. */
        if (pd && age >= 14 && age < 18 && r && r.verdict === "nostate") {
          if (!ldState) loadLite(again);
          var lt = ld && ld.states ? ld.states.filter(function (x) { return x.id === key; })[0] : null;
          if (lt) {
            var phone = telLink(lt.phone), src = G.safeUrl(lt.url), NS = "Not stated on the page we read.";
            /* Same 16 and 17 check as permit.js: the lite hours row may not say anything about them. */
            var hrsNS = !lt.hours || lt.hours === NS, has1617 = !hrsNS && /16 (and|or|to) 17|ages? 16|16-17/i.test(lt.hours);
            var hrsHtml = hrsNS ? '<span class="muted">' + G.esc(NS) + "</span>" : G.esc(lt.hours);
            var note = (age === 16 || age === 17) && !has1617 ? "<p><b>Not covered here:</b> The hours row may not cover 16 and 17 year olds. For 16 and 17, confirm the hour limits on the state page or with the office.</p>" : "";
            return '<div class="callout plain small" id="jHoursBox"><p><b>Hours in ' + G.esc(name) + ".</b> " + hrsHtml + "</p>" + note + (lt.permit === NS ? '<p class="ns muted"><b>Work permit.</b> We did not find a work permit answer on the state page we read. Ask the state labor office before the first shift.</p>' : "<p><b>Work permit.</b> " + G.esc(lt.permit) + "</p>") +
              (lt.phone === NS ? '<p class="ns muted"><b>Phone.</b> Not listed on the page we read. Call the state labor department.</p>' : lt.phone ? "<p><b>Phone.</b> " + (phone || G.esc(lt.phone)) + "</p>" : "") +
              (src ? '<p class="small muted">Source: ' + link(lt.url, "state labor department page") + "</p>" : "") +
              '<p class="small muted">We mostly read one official page for this state, so this answer is shorter than our full state answers. Confirm on the page.</p>' +
              '<p><a href="' + href + '">See the work permit finder</a></p></div>';
          }
        }
        r = null;
      }
      if (r && r.hours) return '<div class="callout plain small" id="jHoursBox"><p><b>Hours in ' + G.esc(name) + " at " + age + ".</b> " + G.esc(r.hours) + '</p><p><a href="' + href + '">See the full ' + G.esc(name) + " rules in the work permit finder</a></p></div>";
      return '<div class="callout plain small" id="jHoursBox"><p>Hours rules for your state: see the <a href="' + href + '">work permit finder</a>.</p></div>';
    }
    function helpLines(st) {
      var h = '<p><b>Getting there without a car:</b> put the employer address into your city transit agency trip planner, check the last bus time against your shift end, and ask your school office about a youth pass.' + (st && RIDES[st] ? " See the youth ride answers for " + RIDES[st].map(function (c) { return '<a href="ready.html?ride=' + G.esc(c[0]) + '">' + G.esc(c[1]) + "</a>"; }).join(", ") + "." : "") + "</p>";
      return h + '<p><b>Stay safe.</b> Never pay to get a job. Never send your ID to a stranger. Tell an adult before an interview. More on the <a href="safety.html">safety page</a>.</p>';
    }
    /* A posting marked posting_status "old" in data/employers.json goes in the fold. The mark is set by hand after reading each page, so no year or word in the text decides it. */
    function isOld(e) {
      return e.posting_status === "old";
    }
    function groupsHtml(list, idp, hl, chipsOut) {
      var out = "", n = 0;
      d.groups.forEach(function (g) {
        var items = list.filter(function (e) { return e.group === g[0]; });
        if (!items.length) return;
        n++;
        var cur = items.filter(function (e) { return !isOld(e); }), old = items.filter(isOld), id = idp + G.esc(g[0]);
        chipsOut.push('<a class="chip" style="text-decoration:none" href="#' + id + '">' + G.esc(g[1]) + '<span class="n">' + items.length + "</span></a>");
        out += "<" + hl + ' id="' + id + '" tabindex="-1">' + G.esc(g[1]) + "</" + hl + ">" + (g[0] === "grocery" ? '<p class="small muted">Many small town stores are locally owned and not listed. Ask the manager in person.</p>' : "") +
          '<div class="grid g2" style="align-items:start;">' + cur.map(card).join("") +
          (old.length ? '<details class="jOld"><summary class="lbl" style="cursor:pointer;">Older postings (check first)</summary><div class="grid g2" style="align-items:start;">' + old.map(card).join("") + "</div></details>" : "") + "</div>";
      });
      return { body: out, groups: n };
    }
    function paint() {
      var v = sel.value, out = $("jOut"), st = stSel.value;
      setPermitLinks(v);
      var ia = $("jInterviewNext"); if (ia) ia.setAttribute("href", interviewHref(v, st));
      $("jChips").innerHTML = "";
      $("jHelp").innerHTML = helpLines(st);
      paintRules(st);
      if (v) paintHours(v, st); else $("jHours").innerHTML = "";
      if (!v) { $("jStatus").textContent = ""; out.innerHTML = '<p class="muted">Tap your age to see who hires.</p>'; return; }
      if (v === "u14") {
        if (yd === undefined && st !== "BC") loadYounger(function () { if (sel.value === "u14") paint(); });
        var ways = st === "BC" ? [] : ((yd && yd.near && yd.near.items) || []).slice(0, 6);
        /* While younger.json loads, show a neutral status. The final status is set only after the load callback runs and paint repeats. */
        var loadingYd = ydPending && st !== "BC";
        $("jStatus").textContent = loadingYd ? "Loading ways to earn under 14." : ways.length ? "Ways to earn under 14 (ages 12 and 13) are listed below." : "No employer list for under 14. Read the notes on this page.";
        var waysHtml = ways.length ? '<h2>Ways to earn at 12 and 13</h2><div class="grid g2" style="align-items:start;" id="jWays">' + ways.map(function (w) {
          return '<article class="card"><p>' + G.esc(w.t) + '</p><p class="small muted">Source: ' + link(w.s && w.s.u, w.s && w.s.t) + "</p></article>";
        }).join("") + "</div>" : "";
        if (st === "BC") { out.innerHTML = '<div class="card" id="jBcYoung"><h2>Under 14</h2><p>For 12 and 13 in British Columbia, read the BC rules lower on this page. The US federal under 14 rules do not apply in Canada.</p></div>'; return; }
        out.innerHTML = waysHtml + '<div class="card" style="margin-top:1rem;"><h2>Under 14</h2><p>The US Department of Labor says children under 14 may not be employed in most non-farm jobs. Casual babysitting, chores at home and delivering newspapers are not covered. Rules for farm work are different, and a state can be stricter.</p><p class="row"><a class="btn" href="younger.html">Ages 12 to 14: start here</a> <a class="btn alt" href="find.html?age=13">Programs and volunteering</a></p></div>';
        return;
      }
      var age = Number(v);
      var here = d.employers.filter(function (e) { return inState(e, st); });
      var can = here.filter(function (e) { return e.min_age <= age; }), later = here.filter(function (e) { return e.min_age > age; });
      $("jStatus").textContent = can.length + " employers for age " + age + (st ? " in " + NAMES[st] : "") + (can.length ? " are listed below." : ".");
      var html = age === 18 ? '<p id="jAge18">' + G.esc(AGE18_LINE) + " Source: " + link(AGE18_URL, "US Department of Labor, Fact Sheet #43") + "</p>" : "", shownGroups = 0, chipList = [];
      if (st && st !== "BC") {
        var nat = can.filter(function (e) { return !e.where || !e.where.length || e.where.indexOf("US") > -1; }), loc = can.filter(function (e) { return nat.indexOf(e) < 0; });
        var sname = NAMES[st];
        if (loc.length < 3 && nat.length) html += '<div class="card" id="jFewLocal"><p>We list only ' + loc.length + " local " + (loc.length === 1 ? "job" : "jobs") + " for " + G.esc(sname) + " so far. The nationwide chains below hire by store: call or walk in.</p></div>";
        var scopes = [["jl", "In " + sname + " (" + loc.length + ")", loc, "jg-"], ["jn", "Nationwide, check your own store (" + nat.length + ")", nat, "jgn-"]];
        scopes.forEach(function (sc) {
          if (!sc[2].length) return;
          var gc = [], r = groupsHtml(sc[2], sc[3], "h3", gc);
          shownGroups += r.groups;
          html += '<h2 id="jscope-' + sc[0] + '" tabindex="-1">' + G.esc(sc[1]) + "</h2>" + (gc.length > 1 ? '<nav class="chips" aria-label="' + G.esc(sc[1]) + '" style="margin-bottom:1rem;">' + gc.join("") + "</nav>" : "") + r.body;
        });
        $("jChips").innerHTML = "";
      } else {
        var r1 = groupsHtml(can, "jg-", "h2", chipList);
        shownGroups = r1.groups; html += r1.body;
        $("jChips").innerHTML = shownGroups > 1 ? '<nav class="chips" aria-label="Job groups" style="margin-bottom:1rem;">' + chipList.join("") + "</nav>" : "";
      }
      if (shownGroups) $("jStatus").textContent += " They are in " + shownGroups + (shownGroups === 1 ? " job group." : " job groups.");
      if (!can.length && st) html += '<div class="card" id="jNone"><h2>No verified places yet</h2><p>We have no verified places for age ' + age + " in " + G.esc(NAMES[st]) + ' yet. Here are three safe ideas:</p><ul><li>Ask a family friend if they have work you could do.</li><li>Volunteer with a parent.</li><li>See <a href="younger.html">Ages 12 to 14: start here</a> for ways to start before a first job.</li></ul><p class="row"><a class="btn" href="find.html?age=' + age + '">Programs and volunteering</a> <a class="btn alt" href="' + permitHref(v) + '">Work permit finder</a></p></div>';
      else if (!can.length) html += '<div class="card"><p>No employer on this page starts at your age yet. Try the <a href="find.html">Programs page</a>.</p></div>';
      if (later.length) html += '<details style="margin-top:1.4rem;"><summary class="lbl" style="cursor:pointer;">' + later.length + " employers that start older than " + age + "</summary><p class=\"small muted\">These say their minimum age is higher than " + age + ". They are here so you know who to try later.</p><div class=\"grid g2\" style=\"align-items:start;\">" + later.map(card).join("") + "</div></details>";
      out.innerHTML = html;
    }
    sel.addEventListener("change", function () { syncAddress(sel.value, stSel.value); paint(); });
    stSel.addEventListener("change", function () {
      /* A state pick after a failed wage read starts one new try. */
      if (wdFailed) { wdFailed = false; wdState = 0; }
      syncAddress(sel.value, stSel.value); paint();
    });
    /* Start age: the address wins (an invalid ?age= leaves the picker empty), otherwise the age saved on Programs (read only). */
    var params = new URLSearchParams(location.search), start = "";
    if (params.has("age")) start = ageChoice(params.get("age"));
    else { var pr = G.store.get("findprefs", {}); start = pr && typeof pr.age === "string" ? ageChoice(pr.age) : ""; }
    /* Start state: the address wins, otherwise the place saved on Programs (read only). */
    var stStart = "";
    if (params.has("state")) stStart = stateChoice(params.get("state"), stSel);
    else { var pp = G.store.get("findprefs", {}); stStart = pp && typeof pp.place === "string" ? stateChoice(L.stateFromPlace(pp.place), stSel) : ""; }
    if (stStart) { stSel.value = stStart; if (stSel._tpSync) stSel._tpSync(); if (stPlace) stPlace.sync(); }
    paint();
    if (start) { sel.value = start; if (sel._tpSync) sel._tpSync(); paint(); }
  }).catch(function () { G.dropPreTiles(); $("jOut").innerHTML = '<p class="muted">The list could not load. Try again later.</p>'; $("jStatus").textContent = "The list could not load. Try again later."; });
})();
