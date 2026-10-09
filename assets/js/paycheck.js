/* First paycheck: sourced estimate, withholding form facts, and wage help. Content is data/money.json. */
(function () {
  "use strict";
  var G = window.TIG, L = G.lib;
  var $ = function (id) { return document.getElementById(id); };
  function a(t, u) { return '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(t) + "</a>"; }
  function usd(n) { return "$" + n.toFixed(2); }
  fetch("data/money.json").then(function (r) { return r.json(); }).then(function (d) {
    d.presets.forEach(function (p) { $("mPreset").appendChild(Object.assign(document.createElement("option"), { value: p.id, textContent: p.label })); });
    function setWage() { var p = d.presets.filter(function (x) { return x.id === $("mPreset").value; })[0]; $("mWage").value = p.wage.toFixed(2); }
    function paint() {
      var r = L.paycheck(d, $("mPreset").value, $("mWage").value, $("mHours").value, $("mParent").checked);
      if (!r) { $("mOut").innerHTML = '<p class="muted">Enter a rate and the hours.</p>'; return; }
      var h = '<div class="tablewrap" tabindex="0" role="region" aria-label="Your paycheck estimate"><table><tbody><tr><th scope="row">Pay before anything comes out</th><td>' + usd(r.gross) + "</td></tr>" +
        r.lines.map(function (l) { return '<tr><th scope="row">&minus; ' + G.esc(l.label) + "</th><td>" + usd(l.amount) + "</td></tr>"; }).join("") +
        '<tr><th scope="row"><b>Left before income tax</b></th><td><b>' + usd(r.left) + "</b></td></tr></tbody></table></div>";
      var notes = r.lines.map(function (l) { return "<li>" + G.esc(d.lineNotes[l.key]) + "</li>"; });
      if (r.possibleDisability != null) notes.push("<li>" + G.esc(d.lineNotes.dis) + " That would be up to " + usd(r.possibleDisability) + ".</li>");
      if (r.parentBiz) notes.push("<li>" + G.esc(d.parentNote) + " " + a(d.parentSource.t, d.parentSource.u) + ".</li>");
      $("mOut").innerHTML = h + '<ul class="small">' + notes.join("") + "</ul><p>" + G.esc(d.left) + "</p>";
    }
    $("mPreset").addEventListener("change", function () { setWage(); paint(); });
    ["mWage", "mHours"].forEach(function (id) { $(id).addEventListener("input", paint); });
    $("mParent").addEventListener("change", paint);
    setWage(); paint();
    $("mSrc").innerHTML = "Rates from: " + d.rateSources.map(function (s) { return a(s.t, s.u); }).join(" &middot; ") + ". Minimum wages are the 2026 state rates, and some cities pay more. Each tax is rounded to the cent on its own line, like a pay stub.";
    $("mLeft").textContent = d.left;
    $("mForms").innerHTML = d.forms.map(function (f) { return '<article class="card"><h3>' + G.esc(f.n) + "</h3><p>" + G.esc(f.d) + "</p><p class=\"small\">" + a(f.src.t, f.src.u) + (f.src2 ? " &middot; " + a(f.src2.t, f.src2.u) : "") + "</p></article>"; }).join("");
    $("mFile").textContent = d.fileNote;
    d.states.forEach(function (s) { $("mState").appendChild(Object.assign(document.createElement("option"), { value: s.id, textContent: s.name })); });
    function row(k, v) { return "<div><dt>" + k + "</dt><dd>" + G.esc(v) + "</dd></div>"; }
    function wrong() {
      var s = d.states.filter(function (x) { return x.id === $("mState").value; })[0];
      $("mWrong").innerHTML = "<h3>" + G.esc(s.name) + '</h3><dl class="facts">' + row("When you must be paid", s.freq) + row("Your pay stub", s.stub) + row("Your last paycheck", s.last) + row("Direct deposit and cards", s.dd) + row("How to get unpaid wages", s.claim) + row("Phone", s.call) + "</dl><p class=\"small\">" + s.links.map(function (l) { return a(l.t, l.u); }).join(" &middot; ") + "</p>";
    }
    $("mState").addEventListener("change", wrong); wrong();
    $("mWrongNote").textContent = d.wrongNote;
    $("mBank").innerHTML = d.bank.items.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
    $("mBankSrc").innerHTML = "Sources: " + d.bank.src.map(function (s) { return a(s.t, s.u); }).join(" &middot; ") + ".";
    $("mGaps").innerHTML = d.gaps.map(function (x) { return "<li>" + G.esc(x) + "</li>"; }).join("");
  }).catch(function () { $("mOut").innerHTML = '<p class="muted">The paycheck tools could not load. Try again.</p>'; });
})();
