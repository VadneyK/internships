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
    if (saved.av.age) $("aAge").value = saved.av.age; if (saved.av.state) $("aState").value = saved.av.state;
    function days() { return DAYS.map(function (n, i) { var f = document.querySelector('[data-d="' + i + '"][data-k="from"]').value, t = document.querySelector('[data-d="' + i + '"][data-k="to"]').value; return f !== "" && t !== "" ? { from: +f, to: +t } : null; }); }
    function clock(h) { return h === 12 ? "noon" : h < 12 ? h + " a.m." : h - 12 + " p.m."; }
    var lastText = "";
    function paintAv() {
      var ds = days(), age = $("aAge").value, st = $("aState").value;
      DAYS.forEach(function (n, i) { saved.av[i + "from"] = document.querySelector('[data-d="' + i + '"][data-k="from"]').value; saved.av[i + "to"] = document.querySelector('[data-d="' + i + '"][data-k="to"]').value; });
      saved.av.age = age; saved.av.state = st; save();
      var lines = ds.map(function (x, i) { return x ? DAYS[i] + ": " + clock(x.from) + " to " + clock(x.to) : null; }).filter(Boolean);
      var no = ds.map(function (x, i) { return x ? null : DAYS[i]; }).filter(Boolean);
      var r = L.hoursCheck(st && pm.states[st] ? pm.states[st].limits : null, age, $("aSchool").value === "1", ds);
      lastText = "My availability\n" + (lines.length ? lines.join("\n") : "(none yet)") + "\nAbout " + r.total + " hours a week. I cannot work: " + (no.length ? no.join(", ") : "none") + ".";
      var h = "<h3>" + r.total + " hours a week offered</h3><p>" + (lines.length ? G.esc(lines.join(". ")) + "." : "No days chosen yet.") + "</p>";
      if (!age || !st) h += '<p class="muted">Pick your age and state to check the hour limits.</p>';
      else if (!r.limited) h += "<p><b>This tool cannot check a plan against a number for age " + G.esc(age) + " in " + G.esc(pm.states[st].name) + ".</b> Here is what the state's pages say: " + G.esc(pm.states[st].hours[+age >= 16 ? "16" : "14"] || "Not stated.") + "</p>";
      else if (r.problems.length) h += '<p><b>Heads up:</b></p><ul>' + r.problems.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("") + "</ul><p class=\"small muted\">Your plan is what you offer. Ask to be scheduled for less. Limits from the " + G.esc(pm.states[st].name) + " pages on the <a href=\"permit.html?state=" + G.esc(st) + "\">permit finder</a>.</p>";
      else h += "<p><b>Within the limits we found</b> for age " + G.esc(age) + " in " + G.esc(pm.states[st].name) + ". " + G.esc(pm.states[st].hours[+age >= 16 ? "16" : "14"] || "") + "</p>";
      $("aOut").innerHTML = h;
    }
    ["aAge", "aState", "aSchool"].forEach(function (id) { $(id).addEventListener("change", paintAv); });
    $("aRows").addEventListener("change", paintAv);
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
    function paintT() {
      var to = $("tTo").value.trim() || "[name]", job = $("tJob").value.trim() || "[the job]", help = $("tHelp").value.trim() || "[one way I can help]", me = $("tName").value.trim() || "[your first name]";
      var subject = "Thank you for talking with me";
      var body = "Hello " + to + ",\n\nThank you for your time and for talking with me about the " + job + ". I am still very interested. " + help.charAt(0).toUpperCase() + help.slice(1) + (/[.!?]$/.test(help) ? "" : ".") + "\n\nThank you again,\n" + me;
      $("tText").textContent = "Subject: " + subject + "\n\n" + body; $("tMail").href = L.mailtoHref(subject, body);
    }
    tf.forEach(function (id) { $(id).addEventListener("input", paintT); }); paintT();
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
