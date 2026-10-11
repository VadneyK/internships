/* Permit finder: answers "do I need a permit, which one, and what do I do next" from data/permits.json. Nothing is sent or stored. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var data = null;

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
  function syncNextLinks() {
    var st = $("pState").value, links = document.querySelectorAll("main a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], base = (a.getAttribute("href") || "").split("?")[0];
      if (!Object.prototype.hasOwnProperty.call(NEXT_PAGES, base)) continue;
      var only = NEXT_PAGES[base], on = hasState(st) && (!only || only.indexOf(st) > -1);
      a.setAttribute("href", on ? base + "?state=" + encodeURIComponent(st) : base);
    }
  }

  function changed() {
    render();
    syncNextLinks();
    var h = $("pOut").querySelector("h2") || $("pAdultLine");
    say(h ? h.textContent : pickPrompt($("pState").value, $("pAge").value, $("pKind").value));
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

  var cur = null;
  function render() {
    var st = $("pState").value, age = $("pAge").value, kind = $("pKind").value;
    var out = $("pOut"), sec = $("packetSec");
    cur = null; sec.hidden = true;
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
    if (r.verdict !== "young" && r.verdict !== "adult") {
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
  function onMsgEdit() { paintMsg(); if (cur) noteUpdated("mStatus", "Message updated."); }
  function paintMsg() {
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

  function syncUrl() {
    try {
      var p = new URLSearchParams();
      if ($("pState").value) p.set("state", $("pState").value);
      if ($("pAge").value) p.set("age", $("pAge").value);
      if ($("pKind").value) p.set("kind", $("pKind").value);
      var q = p.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
    } catch (e) { /* the address bar is optional */ }
  }

  G.fetchData("data/permits.json").then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    var first = ["ca", "ga", "ny", "il"], rest = Object.keys(d.states).filter(function (k) { return first.indexOf(k) < 0; }).sort(function (a, b) { return d.states[a].name < d.states[b].name ? -1 : 1; });
    first.concat(rest).forEach(function (k) { opt($("pState"), k, d.states[k].name); });
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
    ["pState", "pAge", "pKind"].forEach(function (id) { $(id).addEventListener("change", changed); });
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
    render();
    syncNextLinks();
    /* A bad ?state= value selects nothing, so the select stays empty: show the same answer as "not listed". */
    if (asked && !$("pState").value) $("pOut").innerHTML = nostateCard(asked, $("pAge").value);
  }).catch(function () { $("pOut").innerHTML = '<p class="muted">The permit answers could not load. Try again, or see the <a href="rules.html">California rules</a> or <a href="states.html">other states</a>.</p>'; $("pStatus").textContent = "The permit answers could not load. Try again."; });
})();
