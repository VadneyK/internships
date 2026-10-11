/* Apply and interview prep. Everything typed is saved in this browser only. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  var saved = G.store.get("interview", { q: {}, refs: [], av: {} });
  function save() { G.store.set("interview", saved); }
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }

  Promise.all([fetch("data/interview.json").then(function (r) { return r.json(); }), fetch("data/permits.json").then(function (r) { return r.json(); })]).then(function (res) {
    var d = res[0], pm = res[1];
    $("evidence").textContent = d.evidence + " ";
    $("evidence").insertAdjacentHTML("beforeend", a(d.evidenceSource.t, d.evidenceSource.u));
    $("appTips").innerHTML = d.app.map(function (t) { return "<li><div>" + G.esc(t) + "</div></li>"; }).join("");
    $("appSrc").innerHTML = "From " + a("Illinois workNet", "https://apps.illinoisworknet.com/ArticleViewer/Article/Index/183/AppCall=1") + " and a public library teen guide.";

    /* availability */
    for (var age = 14; age <= 17; age++) $("aAge").appendChild(Object.assign(document.createElement("option"), { value: String(age), textContent: String(age) }));
    Object.keys(pm.states).forEach(function (k) { $("aState").appendChild(Object.assign(document.createElement("option"), { value: k, textContent: pm.states[k].name })); });
    var DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    function hourOpts(first) { var h = '<option value="">' + first + "</option>"; for (var i = 6; i <= 23; i++) h += '<option value="' + i + '">' + (i === 12 ? "12 noon" : i < 12 ? i + " a.m." : i - 12 + " p.m.") + "</option>"; return h; }
    $("aRows").innerHTML = DAYS.map(function (n, i) { return "<tr><th scope=\"row\">" + n + '</th><td><select data-d="' + i + '" data-k="from" aria-label="' + n + ' from">' + hourOpts("Not available") + '</select></td><td><select data-d="' + i + '" data-k="to" aria-label="' + n + ' to">' + hourOpts("") + "</select></td></tr>"; }).join("");
    saved.av = saved.av || {};
    document.querySelectorAll("#aRows select").forEach(function (s) { var v = saved.av[s.getAttribute("data-d") + s.getAttribute("data-k")]; if (v) s.value = v; });
    /* Saved age from Programs (localStorage "findprefs"), read only. The saved plan and the address below win over it. */
    var pr = G.store.get("findprefs", {});
    if (pr && typeof pr.age === "string" && /^1[4-7]$/.test(pr.age)) $("aAge").value = pr.age;
    if (saved.av.age) $("aAge").value = saved.av.age; if (saved.av.state) $("aState").value = saved.av.state;
    var pend = "";
    try {
      var qs = new URLSearchParams(location.search), qSt = qs.get("state"), qAge = qs.get("age");
      if (qSt && Object.prototype.hasOwnProperty.call(pm.states, qSt) && /^1[4-7]$/.test(qAge || "")) { $("aState").value = qSt; $("aAge").value = qAge; }
      else if (qSt && Object.prototype.hasOwnProperty.call(pm.states, qSt) && /^(12|13|18)$/.test(qAge || "")) { $("aState").value = qSt; }
      /* An age the list does not have (12, 13, 18): the address bar first, then the age saved on Programs. */
      var pAge = /^(12|13|18)$/.test(qAge || "") ? qAge : "";
      if (!qAge) { var pr0 = G.store.get("findprefs", {}); pAge = pr0 && /^(12|13|18)$/.test(pr0.age || "") ? pr0.age : ""; }
      pend = pAge;
      /* Address bar first, then the saved plan, then the area saved on Programs. */
      if (!qs.get("state") && !saved.av.state) {
        var pr = G.store.get("findprefs", {}), ss = pr && typeof pr.place === "string" ? L.stateFromPlace(pr.place) : "";
        if (ss && Object.prototype.hasOwnProperty.call(pm.states, ss)) { $("aState").value = ss; if ($("aState")._tpSync) $("aState")._tpSync(); }
      }
    } catch (e) { /* the address bar is optional */ }
    function days() { return DAYS.map(function (n, i) { var f = document.querySelector('[data-d="' + i + '"][data-k="from"]').value, t = document.querySelector('[data-d="' + i + '"][data-k="to"]').value; return f !== "" && t !== "" ? { from: +f, to: +t } : null; }); }
    function clock(h) { return h === 12 ? "noon" : h < 12 ? h + " a.m." : h - 12 + " p.m."; }
    var lastText = "", msg = "", YOUNG_ST = ["ca", "ga", "ny", "il"];
    /* Ages 12, 13 and 18 are not in the age list. A card says why the hour check is empty. */
    function pendCard(st) {
      var hour = "The hour check covers ages 14 to 17.";
      if (pend === "18") {
        var adultHours = Object.keys(pm.states).some(function (k) { var t = pm.states[k].adult || ""; return /hour/i.test(t) && /\b18\b/.test(t); });
        return "<h3>Pick your age</h3><p>" + (adultHours ? "At 18 youth hour limits stop. Employers set your hours." : G.esc(hour)) + '</p><p><a href="permit.html">Check your permit</a>.</p>';
      }
      var link = "younger.html" + (YOUNG_ST.indexOf(st) > -1 ? "?state=" + encodeURIComponent(st) : "");
      return "<h3>Pick your age</h3><p>" + G.esc(hour) + " At 12 and 13 the rules differ.</p><p><a href=\"" + G.esc(link) + "\">See the rules for ages 12 to 14</a>.</p>";
    }
    /* One short line for screen readers, set only after a change (never on load). */
    function say() { if (msg && $("aStatus").textContent !== msg) $("aStatus").textContent = msg; }
    function changed() { paintAv(); say(); }
    function paintAv() {
      var ds = days(), age = $("aAge").value, st = $("aState").value;
      DAYS.forEach(function (n, i) { saved.av[i + "from"] = document.querySelector('[data-d="' + i + '"][data-k="from"]').value; saved.av[i + "to"] = document.querySelector('[data-d="' + i + '"][data-k="to"]').value; });
      saved.av.age = age; saved.av.state = st; save();
      var lines = ds.map(function (x, i) { return x ? DAYS[i] + ": " + clock(x.from) + " to " + clock(x.to) : null; }).filter(Boolean);
      var no = ds.map(function (x, i) { return x ? null : DAYS[i]; }).filter(Boolean);
      var r = L.hoursCheck(st && pm.states[st] ? pm.states[st].limits : null, age, $("aSchool").value === "1", ds);
      lastText = "My availability\n" + (lines.length ? lines.join("\n") : "(none yet)") + "\nAbout " + r.total + " hours a week. I cannot work: " + (no.length ? no.join(", ") : "none") + ".";
      if (!age && pend) { $("aOut").innerHTML = pendCard(st); msg = "The hour check covers ages 14 to 17."; return; }
      var h = "<h3>" + r.total + " hours a week offered</h3><p>" + (lines.length ? G.esc(lines.join(". ")) + "." : "No days chosen yet.") + "</p>";
      if (!age || !st) h += '<p class="muted">Pick your age and state to check the hour limits.</p>';
      else if (!r.limited) h += "<p><b>This tool cannot check a plan against a number for age " + G.esc(age) + " in " + G.esc(pm.states[st].name) + ".</b> Here is what the state's pages say: " + G.esc(pm.states[st].hours[+age >= 16 ? "16" : "14"] || "Not stated.") + "</p>";
      else if (r.problems.length) h += '<p><b>Heads up:</b></p><ul>' + r.problems.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("") + "</ul><p class=\"small muted\">Your plan is what you offer. Ask to be scheduled for less. Limits from the " + G.esc(pm.states[st].name) + " pages on the <a href=\"permit.html?state=" + G.esc(st) + "\">permit finder</a>.</p>";
      else h += "<p><b>Within the limits we found</b> for age " + G.esc(age) + " in " + G.esc(pm.states[st].name) + ". " + G.esc(pm.states[st].hours[+age >= 16 ? "16" : "14"] || "") + "</p>";
      $("aOut").innerHTML = h;
      msg = !age || !st ? "Pick your age and state to check the hour limits." : $("aOut").querySelector("h3").textContent + (!r.limited ? "." : r.problems.length ? ". Over a limit, see the details." : ". Within the limits we found.");
    }
    ["aAge", "aState", "aSchool"].forEach(function (id) { $(id).addEventListener("change", changed); });
    $("aRows").addEventListener("change", changed);
    function sel(d, k) { return document.querySelector('[data-d="' + d + '"][data-k="' + k + '"]'); }
    $("aMon").addEventListener("click", function () {
      var f = sel(0, "from").value, t = sel(0, "to").value;
      if (f === "" || t === "") { G.toast("Set Monday first"); return; }
      for (var i = 1; i <= 4; i++) { sel(i, "from").value = f; sel(i, "to").value = t; }
      changed();
    });
    $("aClear").addEventListener("click", function () {
      document.querySelectorAll("#aRows select").forEach(function (s) { s.value = ""; });
      changed();
    });
    $("aCopy").addEventListener("click", function () { G.copy(lastText); });
    paintAv();

    /* practice cards */
    $("qList").innerHTML = d.questions.map(function (q, i) {
      return '<article class="card"><span class="tag ghost">Question ' + (i + 1) + (q.story ? " &middot; use STAR" : "") + "</span><h3 style=\"margin-top:.5rem;\">" + G.esc(q.q) + "</h3><p>" + G.esc(q.tip) + '</p><label class="small" for="q' + i + '">Your notes</label><textarea id="q' + i + '" rows="3" data-i="' + i + '" placeholder="' + (q.story ? "Situation, Task, Action, Result" : "A few words") + '"></textarea><p class="small muted">' + a(q.from, q.url) + "</p></article>";
    }).join("");
    document.querySelectorAll("#qList textarea").forEach(function (t) { t.value = saved.q[t.getAttribute("data-i")] || ""; t.addEventListener("input", function () { saved.q[t.getAttribute("data-i")] = t.value; save(); }); });
    $("payNote").textContent = d.pay;

    $("askList").innerHTML = d.ask.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
    $("askSrc").innerHTML = "From " + a(d.askSource.t, d.askSource.u) + ".";
    $("dayList").innerHTML = d.day.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
    $("daySrc").innerHTML = "Tips from " + d.daySource.map(function (s) { return a(s.title, s.url); }).join(", ") + ".";

    /* references */
    $("refRules").innerHTML = d.refs.rules.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
    $("refGap").innerHTML = G.esc(d.refs.gap) + " " + a(d.refs.source.t, d.refs.source.u) + ".";
    saved.refs = saved.refs && saved.refs.length ? saved.refs : [{}, {}, {}, {}];
    $("refRows").innerHTML = saved.refs.map(function (r, i) {
      return '<article class="card"><h3>Reference ' + (i + 1) + '</h3><div class="field"><label for="rn' + i + '">Name</label><input id="rn' + i + '" data-i="' + i + '" data-k="n" type="text" autocomplete="off"></div>' +
        '<div class="field"><label for="rw' + i + '">Who they are to you</label><input id="rw' + i + '" data-i="' + i + '" data-k="w" type="text" autocomplete="off" placeholder="teacher, coach, babysitting family"></div>' +
        '<div class="field"><label for="rc' + i + '">Phone or email</label><input id="rc' + i + '" data-i="' + i + '" data-k="c" type="text" autocomplete="off"></div>' +
        '<label style="display:flex;gap:.5rem;align-items:center;"><input type="checkbox" data-i="' + i + '" data-k="asked"> I asked them and they said yes</label>' +
        '<p class="row"><button class="btn sm alt" type="button" data-ask="' + i + '">Copy a message asking them</button></p></article>';
    }).join("");
    document.querySelectorAll("#refRows [data-k]").forEach(function (el) {
      var r = saved.refs[+el.getAttribute("data-i")], k = el.getAttribute("data-k");
      if (el.type === "checkbox") el.checked = !!r.asked; else el.value = r[k] || "";
      el.addEventListener("input", function () { r[k] = el.type === "checkbox" ? el.checked : el.value; save(); });
      el.addEventListener("change", function () { r[k] = el.type === "checkbox" ? el.checked : el.value; save(); });
    });
    $("refRows").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ask]"); if (!b) return;
      var r = saved.refs[+b.getAttribute("data-ask")];
      G.copy("Hi " + (r.n || "[name]") + ", I'm applying for a job and I'm putting together a few references. Would you be willing to be one? I would give your name and " + (r.c ? "your contact (" + r.c + ")" : "a phone number or email") + ". Thank you for considering it.");
    });

    /* thank-you */
    $("thanksTiming").innerHTML = G.esc(d.thanks.timing) + " " + a(d.thanks.source.t, d.thanks.source.u) + ".";
    var tf = ["tTo", "tJob", "tHelp", "tName"];
    /* Screen readers hear one short, debounced note instead of the whole preview after each keystroke. */
    var statusTimer;
    function noteUpdated(id, text) {
      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        var el = $(id); el.textContent = "";
        statusTimer = setTimeout(function () { el.textContent = text; }, 30);
      }, 800);
    }
    function paintT() {
      var to = $("tTo").value.trim() || "[name]", job = $("tJob").value.trim() || "[the job]", help = $("tHelp").value.trim() || "[one way I can help]", me = $("tName").value.trim() || "[your first name]";
      var subject = "Thank you for talking with me";
      var body = "Hello " + to + ",\n\nThank you for your time and for talking with me about the " + job + ". I am still very interested. " + help.charAt(0).toUpperCase() + help.slice(1) + (/[.!?]$/.test(help) ? "" : ".") + "\n\nThank you again,\n" + me;
      $("tText").textContent = "Subject: " + subject + "\n\n" + body; $("tMail").href = L.mailtoHref(subject, body);
    }
    tf.forEach(function (id) { $(id).addEventListener("input", function () { paintT(); noteUpdated("tStatus", "Note updated."); }); }); paintT();
    $("tCopy").addEventListener("click", function () { G.copy($("tText").textContent); });

    $("iGaps").innerHTML = d.gaps.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");

    /* print one prep sheet: availability, intro notes, references */
    $("aPrint").addEventListener("click", function () {
      var refs = saved.refs.filter(function (r) { return r.n; });
      $("iPrint").innerHTML = "<h3>My prep sheet</h3><pre style=\"white-space:pre-wrap;font:inherit;\">" + G.esc(lastText) + "</pre><h3>Tell me about yourself (my notes)</h3><p>" + G.esc(saved.q["0"] || "______________________________") + "</p><h3>References</h3>" +
        (refs.length ? "<ol>" + refs.map(function (r) { return "<li>" + G.esc(r.n) + (r.w ? ", " + G.esc(r.w) : "") + (r.c ? ", " + G.esc(r.c) : "") + (r.asked ? " (said yes)" : "") + "</li>"; }).join("") + "</ol>" : "<p>1. ______________ 2. ______________ 3. ______________ 4. ______________</p>") +
        "<h3>Two questions I will ask</h3><p>1. ______________________ 2. ______________________</p><p class=\"small\">From vadneyk.github.io/internships/interview.html</p>";
      $("iPrint").hidden = false; G.printOnly($("iPrint"), "My prep sheet"); $("iPrint").hidden = true;
    });
  }).catch(function () { $("aOut").innerHTML = '<p class="muted">The prep tools could not load. Try again.</p>'; });
})();
