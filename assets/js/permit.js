/* Permit finder: answers "do I need a permit, which one, and what do I do next" from data/permits.json. Nothing is sent or stored. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var data = null;

  function opt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
  function list(items) { return "<ol>" + items.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("") + "</ol>"; }
  function links(arr) { return arr.map(function (l) { var ext = /^https?:/.test(l.u); return '<a href="' + G.esc(l.u) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + G.esc(l.t) + "</a>"; }).join(" &middot; "); }

  var cur = null;
  function render() {
    var st = $("pState").value, age = $("pAge").value, kind = $("pKind").value;
    var out = $("pOut"), sec = $("packetSec");
    cur = null; sec.hidden = true;
    if (!st || !age || !kind) { out.innerHTML = '<p class="muted">Pick all three to see your answer.</p>'; syncUrl(); return; }
    var r = L.permitFor(data, st, age, kind);
    syncUrl();
    if (!r) { out.innerHTML = '<p class="muted">Pick all three to see your answer.</p>'; return; }
    var s = data.states[st];
    var cls = r.verdict === "need" ? "y" : r.verdict === "none" || r.verdict === "adult" ? "g" : "";
    var h = '<article class="card verdict ' + r.verdict + '"><span class="tag ' + cls + '">' + G.esc(r.verdict === "need" ? "You need one" : r.verdict === "none" || r.verdict === "adult" ? "No permit" : r.verdict === "young" ? "Too young for this" : "Check first") + "</span>";
    h += "<h2>" + G.esc(r.headline) + "</h2><p>" + G.esc(r.text) + "</p>";
    if (r.verdict === "need") {
      h += "<h3>Who gives it to you</h3><p>" + G.esc(s.issuer) + "</p>";
      h += "<h3>What to do, in order</h3>" + list(s.steps);
      h += "<h3>What to bring</h3><ul>" + s.bring.map(function (b) { return "<li>" + G.esc(b) + "</li>"; }).join("") + "</ul>";
      h += "<p><b>How long it takes:</b> " + G.esc(s.timing) + "</p><p><b>Keep it current:</b> " + G.esc(s.renew) + "</p>";
      if (s.district) h += '<p>In California the exact steps depend on your school district. <a href="ready.html#permit">Pick your district on the Get ready page</a>.</p>';
    }
    if (r.verdict === "ask") h += "<p><b>Who to call:</b> " + G.esc(s.call) + "</p>";
    if (r.hours) h += "<h3>Hours you may work at " + G.esc(String(age)) + "</h3><p>" + G.esc(r.hours) + "</p>";
    if (r.verdict !== "young" && r.verdict !== "adult") h += "<h3>Pay</h3><p>" + G.esc(r.wage) + "</p>";
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
    Object.keys(d.states).forEach(function (k) { opt($("pState"), k, d.states[k].name); });
    for (var a = 12; a <= 17; a++) opt($("pAge"), String(a), String(a));
    opt($("pAge"), "18", "18 or older");
    d.kinds.forEach(function (k) { opt($("pKind"), k[0], k[1]); });
    var q = new URLSearchParams(location.search);
    ["State", "Age", "Kind"].forEach(function (n) { var v = q.get(n.toLowerCase()); if (v) $("p" + n).value = v; });
    ["pState", "pAge", "pKind"].forEach(function (id) { $(id).addEventListener("change", render); });
    ["mName", "mEmp", "mTo"].forEach(function (id) { $(id).addEventListener("input", paintMsg); $(id).addEventListener("change", paintMsg); });
    $("mCopy").addEventListener("click", function () { G.copy($("mText").textContent); });
    $("pPrint").addEventListener("click", function () { G.printOnly($("pPacket"), "Work permit checklist"); });
    render();
  }).catch(function () { $("pOut").innerHTML = '<p class="muted">The permit answers could not load. Try again, or see the <a href="rules.html">California rules</a> or <a href="states.html">other states</a>.</p>'; });
})();
