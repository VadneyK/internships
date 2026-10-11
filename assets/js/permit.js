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
  function nostateCard(st) {
    var u = L.permitFor(data, st, 15, "job");
    var txt = G.esc(u.text).split(DOL).join('<a href="https://www.' + DOL + '" target="_blank" rel="noopener">' + DOL + "</a>");
    return '<article class="card verdict ask"><h2>' + G.esc(u.headline) + "</h2><p>" + txt + "</p></article>";
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
    return "Pick " + (m.length === 3 ? "your state, your age and the kind of work" : m.length === 2 ? m[0] + " and " + m[1] : m[0]) + ".";
  }
  function changed() {
    render();
    var h = $("pOut").querySelector("h2");
    say(h ? h.textContent : pickPrompt($("pState").value, $("pAge").value, $("pKind").value));
  }

  var cur = null;
  function render() {
    var st = $("pState").value, age = $("pAge").value, kind = $("pKind").value;
    var out = $("pOut"), sec = $("packetSec");
    cur = null; sec.hidden = true;
    if (st === "other" || (st && !hasState(st))) { out.innerHTML = nostateCard(st); syncUrl(); return; }
    if (!st || !age || !kind) { out.innerHTML = '<p class="muted">' + missingText(st, age, kind) + "</p>"; syncUrl(); return; }
    var r = L.permitFor(data, st, age, kind);
    syncUrl();
    if (!r) { out.innerHTML = '<p class="muted">' + missingText(st, age, kind) + "</p>"; return; }
    var s = data.states[st];
    var cls = r.verdict === "need" ? "y" : r.verdict === "none" || r.verdict === "adult" ? "g" : "";
    var h = '<article class="card verdict ' + r.verdict + '"><span class="tag ' + cls + '">' + G.esc(r.verdict === "need" ? "You need one" : r.verdict === "none" || r.verdict === "adult" ? "No permit" : r.verdict === "young" ? "Too young for this" : "Check first") + "</span>";
    /* Only when a message or checklist exists (need or ask): a short jump to the Get it done section. */
    if (r.verdict === "need" || r.verdict === "ask") h += '<p class="small"><a href="#packetSec">Jump to: send a message to your school or print your checklist</a></p>';
    h += "<h2>" + G.esc(r.headline) + "</h2><p>" + G.esc(r.text) + "</p>";
    if (r.verdict === "need") {
      h += "<h3>Who gives it to you</h3><p>" + G.esc(s.issuer) + "</p>";
      h += "<h3>What to do, in order</h3>" + list(s.steps);
      h += "<h3>What to bring</h3><ul>" + s.bring.map(function (b) { return "<li>" + G.esc(b) + "</li>"; }).join("") + "</ul>";
      h += "<p><b>How long it takes:</b> " + G.esc(s.timing) + "</p><p><b>Keep it current:</b> " + G.esc(s.renew) + "</p>";
      if (s.district) h += '<p>In California the exact steps depend on your school district. <a href="ready.html#permit">Pick your district on the Get ready page</a>.</p>';
    }
    if (r.verdict === "ask") h += "<p><b>Who to call:</b> " + G.esc(s.call) + "</p>";
    if (r.verdict === "young") h += '<p><a class="btn sm" href="younger.html' + (["ca", "ga", "ny", "il"].indexOf(st) >= 0 ? "?state=" + st : "") + '">What you can do at 12 and 13</a></p>';
    if (r.hours) h += "<h3>Hours you may work at " + G.esc(String(age)) + "</h3><p>" + G.esc(r.hours) + "</p>";
    if (r.verdict !== "young" && r.verdict !== "adult") {
      h += "<h3>Pay</h3><p>" + G.esc(r.wage) + "</p>";
      if (["ca", "ga", "ny", "il"].indexOf(st) >= 0) h += '<p><a href="paycheck.html?state=' + G.esc(st) + '">See what comes out of a first paycheck in ' + G.esc(s.name) + "</a></p>";
    }
    if ((r.verdict === "need" || r.verdict === "ask" || r.verdict === "none") && +age >= 14 && +age <= 17) h += '<p><a href="interview.html?state=' + encodeURIComponent(st) + "&amp;age=" + encodeURIComponent(age) + '#availability">Plan the hours you can offer</a></p>';
    h += '<p class="small muted">Read on ' + G.esc(s.read) + " from: " + links(s.links) + ". Questions: " + G.esc(s.call) + ".</p></article>";
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

  fetch("data/permits.json").then(function (r) { return r.json(); }).then(function (d) {
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
    /* A bad ?state= value selects nothing, so the select stays empty: show the same answer as "not listed". */
    if (asked && !$("pState").value) $("pOut").innerHTML = nostateCard(asked);
  }).catch(function () { $("pOut").innerHTML = '<p class="muted">The permit answers could not load. Try again, or see the <a href="rules.html">California rules</a> or <a href="states.html">other states</a>.</p>'; });
})();
