/* Permit finder: answers "do I need a permit, which one, and what do I do next" from data/permits.json. Nothing is sent or stored. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var data = null, lite = null;

  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
  function list(items) { return "<ol>" + items.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("") + "</ol>"; }
  function links(arr) { return arr.map(function (l) { var ext = /^https?:/.test(l.u); return '<a href="' + G.esc(l.u) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + G.esc(l.t) + "</a>"; }).join(" &middot; "); }

  var DOL = "dol.gov/agencies/whd/contact/state-labor-offices";
  function hasState(st) { return !!st && Object.prototype.hasOwnProperty.call(data.states, st); }
  /* The answer for a state we have not read. The labor offices address becomes a real link. */
  function nostateCard(st, age) {
    var a = +age, link = function (t) { return t.split(DOL).join('<a href="https://www.' + DOL + '" target="_blank" rel="noopener">' + DOL + "</a>"); };
    if (a >= 18) return '<article class="card verdict none" id="pAdultLine"><p><b>You are 18. You do not need a minor work permit. Go to <a href="jobs.html?age=18">Jobs that hire teens</a>.</b></p><p>Questions? The US Department of Labor lists state labor offices at ' + link(DOL) + ".</p></article>";
    if (a >= 12 && a < 14) return '<article class="card verdict ask"><h2>We have not read your state yet</h2><p>Federal law says under 14 may not be employed in most non-farm jobs. A state can be stricter, and then the stricter rule applies. Ask your state labor office. The US Department of Labor lists them at ' + link(DOL) + '.</p><p><a class="btn sm" href="younger.html">What you can do at 12 and 13</a></p></article>';
    var u = L.permitFor(data, st, 15, "job");
    return '<article class="card verdict ask"><h2>' + G.esc(u.headline) + "</h2><p>" + link(G.esc(u.text)) + "</p></article>";
  }
  function hasLite(id) { return !!lite && !!id && Object.prototype.hasOwnProperty.call(lite, id); }
  var NS = "Not stated on the page we read.";
  var NOHOURS = "We did not find hour limits on the state page we read. Your state may set some. Ask the state labor office.";
  var NOPERMIT = "We did not find a work permit answer on the state page we read. Ask the state labor office before the first shift.";
  var NOWHO = "Not listed on the page we read. Call the state labor department.";
  var ASKSTEP = "Ask your school office or the state labor office. Their page is linked here.";
  function noAge() { return '<span>We did not find a minimum age on the state page we read. ' + (fed && fed.min ? '<a href="' + G.esc(fed.min.url) + '" target="_blank" rel="noopener">Federal law</a>' : "Federal law") + " sets 14 for most non-farm jobs. Your state may set a higher age.</span>"; }
  /* The hours row counts only if one sentence names both 16 and 17. "Age 16 or older" alone does not. */
  function has1617(s) { var hrs = s.hours; return !!hrs && hrs !== NS && hrs.split(/[.;:!?]/).some(function (p) { return /\b16\b/.test(p) && /\b17\b/.test(p); }); }
  /* A field the page did not state ends with a plain next step and the state page link from the same row. */
  function askStepHtml(s) { return ' <span data-liteask>' + ASKSTEP + ' <a href="' + G.esc(s.url) + '" target="_blank" rel="noopener">Open the state page</a></span>'; }
  function liteValue(s, v, nsHtml) {
    var ns = !v || v === NS;
    if (ns) return nsHtml + askStepHtml(s);
    return G.esc(v) + (/^Not stated on the page we read\./.test(v) ? askStepHtml(s) : "");
  }
  /* The line for the teen's age: the state hours text, or the federal floor the page already shows. ids is false in the printed sheet so no id repeats; skipHours there because the Hours row follows. */
  function liteAge(s, age, ids, skipHours) {
    var a = +age, hrs = s.hours, hoursNS = !hrs || hrs === NS, h = "", idf = function (n) { return ids ? ' id="' + n + '"' : ""; };
    if (a >= 18) h = "<p" + idf("pAdultLine") + '><b>At your age (' + a + '): You are 18. You do not need a minor work permit. Go to <a href="jobs.html?age=18">Jobs that hire teens</a>.</b></p>';
    else if (a >= 16) h = "<p" + idf("pAgeLine") + "><b>At your age (" + a + "):</b> " + (has1617(s) ? "The hours row below states limits for 16 and 17. Read it for your age." : 'Federal law sets no hour limits for 16 and 17 (source: the US Department of Labor page linked on the <a href="jobs.html#rules">Jobs page rules</a>). Your state may. This short answer does not say; confirm with the office.') + "</p>";
    else if (a >= 14) {
      if (!skipHours) h = "<p" + idf("pAgeLine") + "><b>At your age (" + a + "):</b> " + (hoursNS ? '<span class="ns">' + G.esc(NOHOURS) + "</span>" : G.esc(hrs)) + "</p>";
      /* The federal school day limit, only when the state hours text does not name it. Text comes from data/employers.json. */
      var hasSchool = !hoursNS && /(\b3|three) hours[^.]*school day|school day[^.]*(\b3|three) hours/i.test(hrs);
      if (!hasSchool && fed && fed.hours) h += "<p" + idf("pFedLine") + ' class="small">Federal rules also apply: ' + G.esc(fed.hours.roles) + " Where your state is stricter, the state rule wins. Source: " + links([{ u: fed.hours.url, t: fed.hours.page_title }]) + ".</p>";
    }
    else if (a >= 12) h = "<p" + idf("pAgeLine") + "><b>At your age (" + a + "):</b> Under 14 is covered on the <a href=\"younger.html?age=" + encodeURIComponent(String(age)) + '">Ages 12 to 14 page</a>.</p>';
    return h;
  }
  function hasLite(id) { return !!lite && !!id && Object.prototype.hasOwnProperty.call(lite, id); }
  /* The checklist and message section is offered for 14 to 17, as for the full states. */
  function liteHasPacket(age) { var a = +age; return a >= 14 && a <= 17; }
  /* The shorter answer for one of the states in data/states-lite.json: mostly one official page, four facts, the page and a quote. */
  function liteCard(id, age, kind) {
    var s = lite[id], a = +age;
    function row(k, v, nsHtml) { var ns = !v || v === NS; return "<div><dt>" + k + "</dt><dd" + (ns ? ' class="ns"' : "") + ">" + liteValue(s, v, nsHtml) + "</dd></div>"; }
    var h = '<article class="card verdict ask" id="pLiteCard">';
    h += liteAge(s, age, true);
    if (liteHasPacket(age)) h += '<p class="small"><a href="#packetSec">Jump to: send a message to your school or print your checklist</a></p>';
    h += "<h2>" + G.esc(s.name) + "</h2>";
    h += '<dl class="facts">' + row("Youngest age", s.min_age, noAge()) + row("Permit", s.permit, G.esc(NOPERMIT)) + row("Hours", s.hours, G.esc(NOHOURS));
    var hasPhone = s.phone && s.phone !== NS;
    h += "<div><dt>Who to ask</dt>";
    var who = s.who_to_ask && s.who_to_ask !== NS ? s.who_to_ask : "", phone = hasPhone ? s.phone : "";
    h += "<dd" + (who || phone ? "" : ' class="ns"') + ">" + L.whoToAskHtml(who, phone, NOWHO) + "</dd>";
    h += "</div></dl>";
    if (wages) h += G.wageLine(wages, id);
    h += "<p>We mostly read one official page for this state, so this answer is shorter than our full state answers. Confirm on the page.</p>";
    /* Say what the short answer leaves out: the hours row may not cover 16 and 17, and it does not sort kinds of work. */
    var gaps = [];
    if ((a === 16 || a === 17) && !has1617(s)) gaps.push("The hours row may not cover 16 and 17 year olds. For 16 and 17, confirm the hour limits on the page above or with the office.");
    if (kind && kind !== "job") gaps.push("This short answer does not cover the kind of work you picked. Confirm with the office or on the page above before you start.");
    if (gaps.length) h += '<p id="pLiteNote"><b>Not covered here:</b> ' + gaps.join(" ") + "</p>";
    h += '<p class="small">Source: <a href="' + G.esc(s.url) + '" target="_blank" rel="noopener">' + G.esc(s.page_title) + "</a>." + (liteRead ? " The short answers were last checked " + G.esc(liteRead) + "." : "") + "</p>";
    h += '<p class="small muted">The page says: &ldquo;' + G.esc(s.quote) + "&rdquo;</p>";
    if (a >= 12 && a < 14) h += '<p>Federal law says under 14 may not be employed in most non-farm jobs. A state can be stricter, and then the stricter rule applies.</p><p><a class="btn sm" href="younger.html?age=' + encodeURIComponent(String(age)) + '">What you can do at 12 and 13</a></p>';
    return h + "</article>";
  }
  /* The printable sheet for a shorter-answer state. Only the row in data/states-lite.json and the federal lines the card already shows. */
  function paintLitePacket(c) {
    var s = lite[c.id], h = "<h3>Work permit checklist (" + G.esc(s.name) + ")</h3>";
    h += "<p>Name: ______________________ Employer: ______________________ First day: ____________</p>";
    h += liteAge(s, c.age, false, true);
    h += "<p><b>Youngest age:</b> " + liteValue(s, s.min_age, noAge()) + "</p>";
    h += "<p><b>Permit:</b> " + liteValue(s, s.permit, G.esc(NOPERMIT)) + "</p>";
    h += "<p><b>Hours:</b> " + liteValue(s, s.hours, G.esc(NOHOURS)) + "</p>";
    var who = s.who_to_ask && s.who_to_ask !== NS ? s.who_to_ask : "", phone = s.phone && s.phone !== NS ? s.phone : "";
    h += "<p><b>Who to call:</b> " + L.whoToAskHtml(who, phone, NOWHO) + "</p>";
    h += '<ul><li>&#9744; Read the state page: <a href="' + G.esc(s.url) + '" target="_blank" rel="noopener">' + G.esc(s.page_title) + "</a> (" + G.esc(s.url) + ")</li><li>&#9744; Ask your school office or the state labor office what you need before your first shift</li></ul>";
    h += '<p class="small">The page says: &ldquo;' + G.esc(s.quote) + "&rdquo;</p>";
    h += '<p class="small">From vadneyk.github.io/internships/permit.html. This is a shorter answer from one official page' + (liteRead ? ", last checked " + G.esc(liteRead) : "") + ". Confirm with your school.</p>";
    $("pPacket").innerHTML = h;
  }
  var liteRead = "", wages = null, fed = null;
  function missingText(st, age, kind) {
    var m = [];
    if (!st) m.push("your state");
    if (!age) m.push("your age");
    if (!kind) m.push("the kind of work");
    if (m.length === 3) return "Pick all three to see your answer.";
    return "Now pick " + (m.length === 2 ? m[0] + " and " + m[1] : m[0]) + ".";
  }

  /* One short line for screen readers, set only after the teen changes a select (never on load). */
  function say(msg) { var st = $("pStatus"); if (msg && st.textContent !== msg) st.textContent = msg; }
  function pickPrompt(st, age, kind) {
    var m = [];
    if (!st) m.push("your state");
    if (!age) m.push("your age");
    if (!kind) m.push("the kind of work");
    if (!m.length) return "";
    return "Pick " + (m.length === 3 ? "your state, your age and the kind of work" : m.length === 2 ? m[0] + " and " + m[1] : m[0]) + ".";
  }
  /* Get ready, paycheck and safety links in the page carry the picked state, so the teen does not pick it again. Paycheck only for the four states that page covers. Plain links when no state is picked or it is "other". */
  var NEXT_PAGES = { "ready.html": null, "safety.html": null, "paycheck.html": ["ca", "ga", "ny", "il"] };
  /* Interview and Jobs links carry the picked state and age together (age 14 to 17 only), as the Jobs page does. Otherwise they stay plain. Links in the #pOut result card are left alone. */
  var CARRY_PAGES = { "interview.html": true, "jobs.html": true }, CARRY_AGE = /^1[4-7]$/;
  function carryHref(base, st, age) {
    var on = L.PERMIT_STATES.indexOf(st) > -1 && CARRY_AGE.test(String(age));
    return on ? base + "?state=" + encodeURIComponent(st) + "&age=" + encodeURIComponent(String(age)) : base;
  }
  function syncNextLinks() {
    var st = $("pState").value, age = $("pAge").value, links = document.querySelectorAll("main a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], base = (a.getAttribute("href") || "").split("?")[0];
      if (Object.prototype.hasOwnProperty.call(CARRY_PAGES, base)) {
        if (!$("pOut").contains(a)) a.setAttribute("href", carryHref(base, st, age));
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(NEXT_PAGES, base)) continue;
      var only = NEXT_PAGES[base], on = hasState(st) && (!only || only.indexOf(st) > -1);
      a.setAttribute("href", on ? base + "?state=" + encodeURIComponent(st) : base);
    }
  }

  function changed() {
    render();
    syncNextLinks();
    var h = $("pOut").querySelector("h2") || $("pAdultLine"), st = $("pState").value;
    /* Another state shows the second list; say so, since that step is new and the answer is not there yet. */
    say(h ? h.textContent : (st === "lite" && !$("pLite").value) ? "Now pick your state." : pickPrompt(st, $("pAge").value, $("pKind").value));
  }

  /* Programs go to Find with the age (only for 12 to 18). */
  function programHref(age) {
    var a = +age;
    return a >= 12 && a <= 18 ? "find.html?age=" + encodeURIComponent(String(age)) : "find.html";
  }
  function jobsHref(age) { return +age <= 13 ? "jobs.html" : "jobs.html?age=" + encodeURIComponent(String(age)); }

  /* "No permit" answers end with one next step. Volunteer and internship go to their own lists; programs go to Find; other kinds go to Jobs for this age, with the resume page. */
  function nextStep(kind, age) {
    if (kind === "volunteer") return '<p><b>What to do next:</b> <a href="find.html?kind=volunteer">Find volunteer roles</a>.</p>';
    if (kind === "intern") return '<p><b>What to do next:</b> <a href="find.html?kind=internship">Find internships</a>.</p>';
    if (kind === "program") return '<p><b>What to do next:</b> <a href="' + programHref(age) + '">Find programs you can apply to</a>.</p>';
    return '<p><b>What to do next:</b> <a href="' + jobsHref(age) + '">Find jobs that hire at your age</a>, or <a href="resume.html">build your first resume</a>.</p>';
  }

  /* "Check first" answers end with one next step, after the Who to call line. The office shown comes first. */
  function askStep(kind, age) {
    var to = kind === "program" ? { h: programHref(age), t: "Find programs you can apply to" }
      : kind === "volunteer" ? { h: "find.html?kind=volunteer", t: "Find volunteer roles" }
      : kind === "intern" ? { h: "find.html?kind=internship", t: "Find internships" }
      : { h: jobsHref(age), t: "Find jobs that hire at your age" };
    return '<p><b>What to do next:</b> Contact the office shown above first. Then <a href="' + to.h + '">' + to.t + "</a>.</p>";
  }

  var cur = null, curLite = null, litePlace = null;
  function syncLite() { if ($("pLite")._tpSync) $("pLite")._tpSync(); if (litePlace) litePlace.sync(); }
  function render() {
    var st = $("pState").value, age = $("pAge").value, kind = $("pKind").value;
    var out = $("pOut"), sec = $("packetSec");
    cur = null; curLite = null; sec.hidden = true;
    var f = $("pLiteField");
    if (f) f.hidden = st !== "lite";
    if (st === "lite") {
      var lid = $("pLite").value;
      out.innerHTML = hasLite(lid) ? liteCard(lid, age, kind) : '<p class="muted">Now pick your state.</p>';
      /* Same Get it done section as the full states, filled only from this state's row. */
      if (hasLite(lid) && liteHasPacket(age)) { curLite = { id: lid, age: age }; sec.hidden = false; paintLitePacket(curLite); paintMsg(); }
      syncUrl(); return;
    }
    if (st === "other" || (st && !hasState(st))) { out.innerHTML = nostateCard(st, age); syncUrl(); return; }
    if (!st || !age || !kind) { out.innerHTML = '<p class="muted">' + missingText(st, age, kind) + "</p>"; syncUrl(); return; }
    var r = L.permitFor(data, st, age, kind);
    syncUrl();
    if (!r) { out.innerHTML = '<p class="muted">' + missingText(st, age, kind) + "</p>"; return; }
    var s = data.states[st];
    var cls = r.verdict === "need" ? "y" : r.verdict === "none" || r.verdict === "adult" ? "g" : "";
    var h = '<article class="card verdict ' + r.verdict + '"><span class="tag ' + cls + '">' + G.esc(r.verdict === "need" ? "You need one" : r.verdict === "none" || r.verdict === "adult" ? "No permit" : r.verdict === "young" ? "Too young for this" : "Check first") + "</span>";
    if (r.verdict === "adult") h = h.replace("<span", '<p id="pAdultLine"><b>You are 18. You do not need a minor work permit. Go to <a href="jobs.html?age=18">Jobs that hire teens</a>.</b></p><span');
    /* Only when a message or checklist exists (need or ask): a short jump to the Get it done section. */
    if (r.verdict === "need" || r.verdict === "ask") h += '<p class="small"><a href="#packetSec">Jump to: send a message to your school or print your checklist</a></p>';
    var ny = st === "ny", wp = "working papers (permit)";
    var headline = r.headline;
    if (ny && r.verdict === "need") headline = "You need " + wp;
    if (ny && r.verdict === "young") headline = "Working papers (permit) start at 14";
    /* Plain top line when no permit is needed at this age because the age cut-off has passed (for example Illinois at 16 or 17). */
    var pastCutoff = r.verdict === "none" && s.kinds[r.kind] && s.kinds[r.kind].permit === true && r.age >= s.needBelow;
    if (pastCutoff) h += '<p id="pNoPermitLine"><b>You do not need a work permit here at this age. Your employer may still ask for proof of age.</b></p>';
    h += "<h2>" + G.esc(headline) + "</h2><p>" + G.esc(r.text) + "</p>";
    /* British Columbia at 14 and 15: the plain answer is the three steps already read on the BC card. */
    if (st === "bc" && r.verdict === "ask" && (r.age === 14 || r.age === 15) && (r.kind === "job" || r.kind === "program" || r.kind === "family")) h += '<div id="pBcPlain"><h3>Your answer in British Columbia at ' + r.age + "</h3>" + list(s.steps) + "</div>";
    if (pastCutoff) {
      h += '<details id="pUnder"><summary>If you were under ' + G.esc(String(s.needBelow)) + "</summary><h3>Who gives it to you</h3><p>" + G.esc(s.issuer) + "</p><h3>What to do, in order</h3>" + list(s.steps) + "<h3>What to bring</h3><ul>" + s.bring.map(function (b) { return "<li>" + G.esc(b) + "</li>"; }).join("") + "</ul></details>";
    }
    if (ny && r.verdict === "young") {
      h += '<p><b>Working papers (permit) start at 14 for almost any job in New York.</b> At 12 and 13, see what you can do instead with the button below.</p>';
      h += "<p><b>Who to call:</b> " + L.linkContacts(s.call) + "</p>";
    }
    if (r.verdict === "need") {
      h += "<h3>" + (ny ? "Who gives you working papers (permit)" : "Who gives it to you") + "</h3><p>" + G.esc(s.issuer) + "</p>";
      h += "<h3>What to do, in order</h3>" + list(s.steps);
      h += "<h3>What to bring</h3><ul>" + s.bring.map(function (b) { return "<li>" + G.esc(b) + "</li>"; }).join("") + "</ul>";
      h += "<p><b>How long it takes:</b> " + G.esc(s.timing) + "</p><p><b>Keep it current:</b> " + G.esc(s.renew) + "</p>";
      if (s.district) h += '<p>In California the exact steps depend on your school district. <a href="ready.html#permit">Pick your district on the Get ready page</a>.</p>';
    }
    if (r.verdict === "ask") h += "<p><b>Who to call:</b> " + L.linkContacts(s.call) + "</p>" + askStep(r.kind, r.age);
    /* The young link keeps the picked state (ca, ga, ny, il only) and the picked age when it is 12 or 13, so Ages 12 to 14 can send the next step to the same age. */
    if (r.verdict === "young") {
      var yq = [];
      if (["ca", "ga", "ny", "il"].indexOf(st) >= 0) yq.push("state=" + st);
      if (String(age) === "12" || String(age) === "13") yq.push("age=" + String(age));
      h += '<p><a class="btn sm" href="younger.html' + (yq.length ? "?" + yq.join("&amp;") : "") + '">What you can do at 12 and 13</a></p>';
    }
    if (r.hours) h += "<h3>Hours you may work at " + G.esc(String(age)) + "</h3><p>" + G.esc(r.hours) + "</p>";
    /* Volunteering is unpaid, so the wage block would only confuse (persona round 9). */
    if (r.verdict !== "young" && r.verdict !== "adult" && r.kind !== "volunteer") {
      h += "<h3>Pay</h3><p>" + G.esc(r.wage) + "</p>";
      if (["ca", "ga", "ny", "il"].indexOf(st) >= 0) h += '<p><a href="paycheck.html?state=' + G.esc(st) + '">See what comes out of a first paycheck in ' + G.esc(s.name) + "</a></p>";
    }
    if ((r.verdict === "need" || r.verdict === "ask" || r.verdict === "none") && +age >= 14 && +age <= 17) h += '<p><a href="interview.html?state=' + encodeURIComponent(st) + "&amp;age=" + encodeURIComponent(age) + '#availability">Plan the hours you can offer</a></p>';
    if (r.verdict === "none" || r.verdict === "adult") h += nextStep(r.kind, r.age);
    h += '<p class="small muted">Read on ' + G.esc(s.read) + " from: " + links(s.links) + ". Questions: " + L.linkContacts(s.call) + ".</p></article>";
    out.innerHTML = h;
    cur = r;
    if (r.verdict === "need" || r.verdict === "ask") { sec.hidden = false; paintPacket(r, s); paintMsg(); }
  }

  function paintPacket(r, s) {
    var emp = $("mEmp").value.trim();
    var h = "<h3>" + G.esc(s.permit) + " checklist (" + G.esc(s.name) + ")</h3>";
    h += "<p>Name: ______________________ Employer: ______________________ First day: ____________</p>";
    if (r.verdict === "need") {
      h += "<p><b>Who gives it:</b> " + G.esc(s.issuer) + "</p><ol>" + s.steps.map(function (x) { return "<li>&#9744; " + G.esc(x) + "</li>"; }).join("") + "</ol>";
      h += "<p><b>Bring:</b></p><ul>" + s.bring.map(function (x) { return "<li>&#9744; " + G.esc(x) + "</li>"; }).join("") + "</ul>";
      h += "<p><b>Timing:</b> " + G.esc(s.timing) + " " + G.esc(s.renew) + "</p>";
    } else h += "<p>" + G.esc(r.text) + "</p>";
    h += "<p><b>Who to call:</b> " + G.esc(s.call) + "</p><p class=\"small\">From vadneyk.github.io/internships/permit.html. Read " + G.esc(s.read) + ". Confirm with your school.</p>";
    $("pPacket").innerHTML = h;
  }

  /* Screen readers hear one short, debounced note instead of the whole preview after each keystroke. */
  var statusTimer;
  function noteUpdated(id, text) {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      var el = $(id); el.textContent = "";
      statusTimer = setTimeout(function () { el.textContent = text; }, 30);
    }, 800);
  }
  function onMsgEdit() { paintMsg(); if (cur || curLite) noteUpdated("mStatus", "Message updated."); }
  function paintMsg() {
    if (curLite) return paintLiteMsg();
    if (!cur) return;
    var s = data.states[cur.state], name = $("mName").value.trim() || "[your first name]", emp = $("mEmp").value.trim() || "[the employer]";
    var school = $("mTo").value === "school", need = cur.verdict === "need";
    var subject = school ? "Question about getting a work permit" : "My work permit and my first day";
    var body = school
      ? "Hello,\n\nMy name is " + name + ". I have a job offer from " + emp + " and I think I need a " + s.permit + ". Could you tell me what forms to bring, who has to sign them, and how long it usually takes?\n\nThank you,\n" + name
      : "Hello,\n\nThank you again for the offer. " + (need ? "Because of my age I need a " + s.permit + " from my school before my first shift, and it needs a part from you about the job and my hours." : "I want to check what papers you need from me before my first day.") + " Who should I send the form to, and what days and hours do you expect me to work?\n\nThank you,\n" + name;
    $("mText").textContent = "Subject: " + subject + "\n\n" + body;
    $("mMail").href = L.mailtoHref(subject, body);
    var blanks = L.blanksLeft(body), bn = $("mBlankNote");
    bn.hidden = !blanks.length;
    bn.textContent = blanks.length ? "Fill in before you send: " + blanks.join(", ") : "";
    $("pPacket").innerHTML && cur && paintPacket(cur, s);
  }

  /* The message for a shorter-answer state asks the question instead of naming a permit, since the page we read may not name one. */
  function paintLiteMsg() {
    var s = lite[curLite.id], name = $("mName").value.trim() || "[your first name]", emp = $("mEmp").value.trim() || "[the employer]";
    var school = $("mTo").value === "school";
    var subject = school ? "Question about getting a work permit" : "My work permit and my first day";
    var body = school
      ? "Hello,\n\nMy name is " + name + ". I have a job offer from " + emp + " and I want to know if I need a work permit in " + s.name + ". Could you tell me what forms to bring, who has to sign them, and how long it usually takes?\n\nThank you,\n" + name
      : "Hello,\n\nThank you again for the offer. I want to check what papers you need from me before my first day. Who should I send the form to, and what days and hours do you expect me to work?\n\nThank you,\n" + name;
    $("mText").textContent = "Subject: " + subject + "\n\n" + body;
    $("mMail").href = L.mailtoHref(subject, body);
    var blanks = L.blanksLeft(body), bn = $("mBlankNote");
    bn.hidden = !blanks.length;
    bn.textContent = blanks.length ? "Fill in before you send: " + blanks.join(", ") : "";
  }

  function syncUrl() {
    try {
      var p = new URLSearchParams();
      var sv = $("pState").value;
      if (sv === "lite" && hasLite($("pLite").value)) sv = $("pLite").value;
      if (sv) p.set("state", sv);
      if ($("pAge").value) p.set("age", $("pAge").value);
      if ($("pKind").value) p.set("kind", $("pKind").value);
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
    } catch (e) { /* the address bar is optional */ }
  }

  /* The shorter answers load only when a teen picks Another state, or opens a ?state= link that is not one of the full states. */
  var liteP = null;
  var liteErrHTML = '<p class="muted">The shorter answers could not load. Try again, or pick &ldquo;My state is not listed&rdquo;.</p>';
  function ensureLite() {
    if (lite) return Promise.resolve(true);
    if (!liteP) liteP = G.stateShorts().then(function (ld) {
      /* The federal rules the short card quotes, from data/employers.json. Optional: the card still works without them. */
      var fp = G.fetchData("data/employers.json").then(function (r) { return r.json(); }).then(function (e) {
        var by = function (id) { return (e.rules || []).filter(function (x) { return x.id === id; })[0] || null; };
        fed = { min: by("dol-fact-sheet-43-min-age"), hours: by("dol-14-15-hours") };
      }).catch(function () { fed = null; });
      return fp.then(function () { return ld; });
    }).then(function (ld) {
      lite = {}; liteRead = ld.read || "";
      ld.states.slice().sort(function (x, y) { return x.name < y.name ? -1 : 1; }).forEach(function (x) { lite[x.id] = x; opt($("pLite"), x.id, x.name); });
      opt($("pLite"), "other", "My state is not listed");
      /* The 35 option list is the type-to-search state box, like Home and Jobs. The select stays the source of truth. */
      if (!litePlace) litePlace = G.placeSearch($("pLite"), { hide: true, chip: true, caption: "", placeholder: "Type your state" });
      return true;
    }).catch(function () { liteP = null; return false; });
    return liteP;
  }
  /* The state minimum wage file is read only once a short-answer state is chosen. It is optional: the card shows without the wage line if it does not load. */
  var wagesP = null;
  function ensureWages() {
    if (wages) return Promise.resolve(true);
    if (!wagesP) wagesP = G.stateWages().then(function (w) { wages = w; return true; }, function () { wagesP = null; return true; });
    return wagesP;
  }
  G.fetchData("data/permits.json").then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    var first = ["ca", "ga", "ny", "il"], rest = Object.keys(d.states).filter(function (k) { return first.indexOf(k) < 0; }).sort(function (a, b) { return d.states[a].name < d.states[b].name ? -1 : 1; });
    first.concat(rest).forEach(function (k) { opt($("pState"), k, d.states[k].name); });
    opt($("pState"), "lite", "Another state");
    opt($("pState"), "other", "My state is not listed");
    for (var a = 12; a <= 17; a++) opt($("pAge"), String(a), String(a));
    opt($("pAge"), "18", "18 or older");
    d.kinds.forEach(function (k) { opt($("pKind"), k[0], k[1]); });
    var q = new URLSearchParams(location.search);
    /* Saved age from Programs (localStorage "findprefs"), read only. The address below wins over it. */
    var pr = G.store.get("findprefs", {});
    if (pr && typeof pr.age === "string" && /^(1[2-8])$/.test(pr.age)) $("pAge").value = pr.age;
    ["State", "Age", "Kind"].forEach(function (n) { var v = q.get(n.toLowerCase()); if (v) $("p" + n).value = v; });
    /* No ?state= in the address: start from the area saved on Programs, when it sits in one state we have read. */
    if (!q.get("state")) {
      var pr = G.store.get("findprefs", {}), ss = pr && typeof pr.place === "string" ? L.stateFromPlace(pr.place) : "";
      if (ss && hasState(ss)) { $("pState").value = ss; if ($("pState")._tpSync) $("pState")._tpSync(); }
    }
    $("pState").addEventListener("change", function () {
      if ($("pState").value !== "lite") return changed();
      /* render the prompt now, then fill the second list once the file is in */
      changed();
      ensureLite().then(function (ok) { if (!ok) { $("pLiteField").hidden = true; $("pOut").innerHTML = liteErrHTML; } else changed(); });
    });
    ["pAge", "pKind"].forEach(function (id) { $(id).addEventListener("change", changed); });
    $("pLite").addEventListener("change", function () {
      /* "My state is not listed" in the second step is the same answer as in the first. */
      if ($("pLite").value === "other") { $("pState").value = "other"; $("pLite").value = ""; if ($("pState")._tpSync) $("pState")._tpSync(); syncLite(); }
      changed();
      if ($("pLite").value) ensureWages().then(function () { changed(); });
    });
    ["mName", "mEmp", "mTo"].forEach(function (id) { $(id).addEventListener("input", onMsgEdit); $(id).addEventListener("change", onMsgEdit); });
    /* The jump link sits in the answer card, which is re-rendered; the listener stays on the card container. */
    var packetHead = $("packetSec").querySelector("h2");
    if (packetHead) packetHead.setAttribute("tabindex", "-1");
    $("pOut").addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href="#packetSec"]') : null;
      if (!a || !packetHead) return;
      e.preventDefault();
      packetHead.focus();
    });
    $("mCopy").addEventListener("click", function () { G.copy($("mText").textContent); });
    $("pPrint").addEventListener("click", function () { G.printOnly($("pPacket"), "Work permit checklist"); });
    var asked = q.get("state");
    /* A ?state= value that is not a full state waits for the shorter list, so no earlier "pick your state" or "not read" card shows first. */
    var deep = !!asked && !$("pState").value;
    if (!deep) render();
    syncNextLinks();
    if ($("pState").value === "lite") ensureLite().then(function (ok) { if (ok) render(); else $("pOut").innerHTML = liteErrHTML; });
    /* Try the shorter list, else show the same answer as "not listed". A failed load shows the same error as the picker. */
    if (deep) {
      var low = asked.toLowerCase();
      ensureLite().then(function (ok) {
        if (!ok) { $("pOut").innerHTML = liteErrHTML; return; }
        if (hasLite(low)) { $("pState").value = "lite"; $("pLite").value = low; if ($("pState")._tpSync) $("pState")._tpSync(); syncLite(); ensureWages().then(function () { render(); }); }
        else $("pOut").innerHTML = nostateCard(asked, $("pAge").value);
      });
    }
  }).catch(function () { G.dropPreTiles(); $("pOut").innerHTML = '<p class="muted">The permit answers could not load. Try again, or see the <a href="rules.html">California rules</a> or <a href="states.html">other states</a>.</p>'; $("pStatus").textContent = "The permit answers could not load. Try again."; });
})();
