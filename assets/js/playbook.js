/* Playbook: people map (saved on this device) and the five-line message builder. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };

  /* people map */
  var rows = G.store.get("people", [{}, {}, {}, {}, {}]);
  while (rows.length < 5) rows.push({});
  var box = $("peopleRows");
  box.innerHTML = rows.map(function (r, i) {
    return '<fieldset style="border:0;padding:0;margin:0;display:grid;gap:.4rem;"><legend class="sr">Person ' + (i + 1) + '</legend>' +
      '<div class="formgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr));gap:.5rem;">' +
      '<div class="field"><label for="pn' + i + '">Name ' + (i + 1) + '</label><input id="pn' + i + '" data-i="' + i + '" data-k="n" type="text" autocomplete="off" value="' + G.esc(r.n || "") + '"></div>' +
      '<div class="field"><label for="pw' + i + '">What they do</label><input id="pw' + i + '" data-i="' + i + '" data-k="w" type="text" autocomplete="off" value="' + G.esc(r.w || "") + '"></div>' +
      '<div class="field"><label for="ph' + i + '">How I know them</label><input id="ph' + i + '" data-i="' + i + '" data-k="h" type="text" autocomplete="off" value="' + G.esc(r.h || "") + '"></div>' +
      "</div></fieldset>";
  }).join("");
  function syncSelect() {
    var sel = $("fToSel"), keep = sel.value;
    sel.innerHTML = '<option value="">Pick from your map, or type</option>' + rows.filter(function (r) { return r.n; }).map(function (r, i) {
      return '<option value="' + G.esc(r.n) + '" data-h="' + G.esc(r.h || "") + '">' + G.esc(r.n) + (r.w ? " (" + G.esc(r.w) + ")" : "") + "</option>";
    }).join("");
    sel.value = keep;
  }
  box.addEventListener("input", function (e) {
    var i = e.target.getAttribute("data-i"), k = e.target.getAttribute("data-k");
    if (i == null) return;
    rows[+i][k] = e.target.value;
    G.store.set("people", rows); syncSelect();
  });
  $("clearMap").addEventListener("click", function () {
    rows = [{}, {}, {}, {}, {}]; G.store.set("people", rows);
    box.querySelectorAll("input").forEach(function (i) { i.value = ""; }); syncSelect(); G.toast("Cleared");
  });
  syncSelect();
  $("fToSel").addEventListener("change", function (e) {
    if (e.target.value) { $("fTo").value = e.target.value; var h = e.target.selectedOptions[0].getAttribute("data-h"); if (h && !$("fHow").value) $("fHow").value = h.charAt(0).toUpperCase() + h.slice(1) + (/[.!?]$/.test(h) ? "" : "."); }
    build();
  });

  /* how-chips */
  var HOWS = [
    ["My parent works with you", "My mom/dad, ____, works with you."],
    ["Same church", "We go to the same church."],
    ["Family friend", "You are a friend of my family."],
    ["You are my teacher or coach", "I am in your class."],
    ["I shop at your place", "I come to your shop with my family."]
  ];
  $("howChips").innerHTML = HOWS.map(function (h, i) { return '<button class="chip" type="button" data-how="' + i + '">' + G.esc(h[0]) + "</button>"; }).join("");
  $("howChips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-how]"); if (!b) return;
    $("fHow").value = HOWS[+b.getAttribute("data-how")][1]; build(); $("fHow").focus();
  });

  var ASK = {
    call: ["Could I ask you a few questions for 15 minutes, by phone or in person", "Could we talk for 15 minutes"],
    shadow: ["Could I shadow you for an afternoon to see what a day looks like", "Could I shadow you for an afternoon"],
    email: ["Would you be open to answering three quick questions by email", "Could I email you three quick questions"],
    help: ["Could I help out as a volunteer for a few hours", "Could I help out for a few hours"],
    advice: ["Could I get your advice on how to get started, in a 15-minute chat", "Could I get your advice for 15 minutes"]
  };
  function build() {
    var to = $("fTo").value.trim() || "[their name]";
    var me = $("fMe").value.trim() || "[your name]";
    var grade = $("fGrade").value.trim() || "[grade]";
    var school = $("fSchool").value.trim() || "[school]";
    var how = $("fHow").value.trim() || "[how you know them]";
    var cur = $("fCurious").value.trim() || "[what you are curious about]";
    var when = $("fWhen").value.trim();
    var ask = $("fAsk").value, fmt = $("fFormat").value;
    var s = how; if (!/[.!?]$/.test(s)) s += ".";
    var msg;
    if (fmt === "text") {
      msg = "Hi " + to + ", this is " + me + ". I'm in " + grade + " grade at " + school + ". " + s + " I'm curious about " + cur + ". " + ASK[ask][1] + (when ? " " + when : "") + "? Totally fine if you're busy. Thanks!";
    } else {
      msg = "Subject: Quick question from a student at " + school + "\n\nHi " + to + ",\n\nMy name is " + me + " and I'm in " + grade + " grade at " + school + ". " + s + "\n\nI'm curious about " + cur + ". " + ASK[ask][0] + (when ? " " + when : "") + "?\n\nTotally fine if you're busy. Thank you for reading this!\n\n" + me;
    }
    $("letter").textContent = msg;
    var body = msg.replace(/^Subject:.*\n\n/, "");
    var words = (body.match(/\S+/g) || []).length;
    $("wc").textContent = words + " words";
    $("meter").classList.toggle("over", words > 90);
    $("meter").firstElementChild.style.width = Math.min(100, Math.round(words / 90 * 100)) + "%";
    var hasHow = $("fHow").value.trim().length > 8;
    var hasCur = $("fCurious").value.trim().length > 2;
    var hasName = $("fTo").value.trim().length > 1 && $("fMe").value.trim().length > 1;
    var checks = [
      [words <= 90, "Short enough to read in about 20 seconds (under 90 words)"],
      [hasName && $("fGrade").value.trim() && $("fSchool").value.trim(), "Says who you are: name, grade, school"],
      [hasHow, "Says how you know them"],
      [hasCur, "Says what you are curious about"],
      [true, "One small ask with a limit (like 15 minutes or one afternoon)"],
      [true, "Makes it easy to say no, and says thank you"]
    ];
    $("checks").innerHTML = checks.map(function (c) { return '<li class="' + (c[0] ? "ok" : "") + '"><span class="box" aria-hidden="true">' + (c[0] ? "&#10003;" : "") + "</span><span>" + c[1] + (c[0] ? '<span class="sr"> (done)</span>' : '<span class="sr"> (not yet)</span>') + "</span></li>"; }).join("");
  }
  ["fTo", "fMe", "fGrade", "fSchool", "fHow", "fCurious", "fWhen", "fAsk", "fFormat"].forEach(function (id) { $(id).addEventListener("input", build); $(id).addEventListener("change", build); });
  $("copyMsg").addEventListener("click", function () { G.copy($("letter").textContent); });
  $("printMsg").addEventListener("click", function () { window.print(); });
  $("printTracker").addEventListener("click", function () { window.print(); });
  document.querySelectorAll("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { G.copy($(b.getAttribute("data-copy")).textContent); }); });

  // sensible starting example, clearly editable
  $("fTo").placeholder = "Mrs. Lee"; $("fCurious").value = ""; build();
})();
