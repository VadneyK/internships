/* Resume builder: builds a one-page preview in the browser. The draft is kept on this device only, and only when the person ticks "Keep my draft on this device" (never email or phone). Nothing is sent. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };

  var EXAMPLES = [
    { t: "Volunteer", o: "Oakland Public Library", d: "Summer 2026", b: "Shelved and sorted about 200 books per shift\nHelped younger kids pick books at the summer reading table" },
    { t: "Babysitter", o: "Neighborhood families", d: "2024 to present", b: "Care for two kids ages 4 and 7 every Friday evening\nPlan activities and make dinner" },
    { t: "", o: "", d: "", b: "" }
  ];
  var box = $("expBox");
  box.innerHTML = EXAMPLES.map(function (x, i) {
    return '<fieldset style="border:0;padding:0;margin:0 0 1rem;"><legend class="caps small" style="margin-bottom:.4rem;">Entry ' + (i + 1) + "</legend>" +
      '<div class="formgrid">' +
      '<div class="field"><label for="xt' + i + '">Title</label><input id="xt' + i + '" data-k="t" data-i="' + i + '" type="text" autocomplete="off" value="' + G.esc(x.t) + '"></div>' +
      '<div class="field"><label for="xo' + i + '">Place</label><input id="xo' + i + '" data-k="o" data-i="' + i + '" type="text" autocomplete="off" value="' + G.esc(x.o) + '"></div>' +
      '<div class="field"><label for="xd' + i + '">Dates</label><input id="xd' + i + '" data-k="d" data-i="' + i + '" type="text" autocomplete="off" value="' + G.esc(x.d) + '"></div></div>' +
      '<div class="field" style="margin-top:.5rem;"><label for="xb' + i + '">What you did, one line each</label><textarea id="xb' + i + '" data-k="b" data-i="' + i + '" rows="3">' + G.esc(x.b) + "</textarea></div></fieldset>";
  }).join("");

  /* Fields saved on this device, only when the "Keep my draft on this device" box is ticked (off by default). Email (rEmail) and phone (rPhone) are left out on purpose. */
  var KEEP = $("rKeep");
  var SAVE_IDS = ["rName", "rCity", "rSchool", "rGrad", "rEduNote", "rAct", "rSkills", "rAwards"];
  EXAMPLES.forEach(function (x, i) { SAVE_IDS.push("xt" + i, "xo" + i, "xd" + i, "xb" + i); });
  function saveDraft() {
    var o = {};
    SAVE_IDS.forEach(function (id) { o[id] = $(id).value; });
    G.store.set("resume", o);
  }
  function restoreDraft() {
    var saved = G.store.get("resume", null);
    if (!saved || typeof saved !== "object") return;
    /* Email and phone are never saved, so a restored draft starts with both blank instead of the example values. */
    $("rEmail").value = "";
    $("rPhone").value = "";
    SAVE_IDS.forEach(function (id) {
      if (typeof saved[id] === "string") $(id).value = saved[id];
    });
  }

  function lines(s) { return (s || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function val(id) { return $(id).value.trim(); }
  function get() {
    var exp = [];
    for (var i = 0; i < EXAMPLES.length; i++) exp.push({ t: val("xt" + i), o: val("xo" + i), d: val("xd" + i), b: lines($("xb" + i).value) });
    return {
      name: val("rName"), email: val("rEmail"), phone: val("rPhone"), city: val("rCity"),
      school: val("rSchool"), grad: val("rGrad"), note: val("rEduNote"),
      exp: exp.filter(function (x) { return x.t || x.o || x.b.length; }),
      act: lines($("rAct").value),
      skills: val("rSkills").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      awards: val("rAwards").split(",").map(function (s) { return s.trim(); }).filter(Boolean)
    };
  }
  function render() {
    var r = get(), h = "";
    var contact = [r.city, r.email, r.phone].filter(Boolean).join("  |  ");
    h += "<h2>" + G.esc(r.name || "Your name") + '</h2><p class="contact">' + G.esc(contact) + "</p>";
    if (r.school || r.grad || r.note) {
      h += "<h3>EDUCATION</h3>" + '<div class="rrow"><span>' + G.esc(r.school) + "</span><span>" + G.esc(r.grad) + "</span></div>" + (r.note ? "<div>" + G.esc(r.note) + "</div>" : "");
    }
    if (r.exp.length) {
      h += "<h3>EXPERIENCE</h3>";
      r.exp.forEach(function (x) {
        h += '<div class="rrow"><span>' + G.esc([x.t, x.o].filter(Boolean).join(", ")) + "</span><span>" + G.esc(x.d) + "</span></div>";
        if (x.b.length) h += "<ul>" + x.b.map(function (b) { return "<li>" + G.esc(b) + "</li>"; }).join("") + "</ul>";
      });
    }
    if (r.act.length) h += "<h3>ACTIVITIES</h3><ul>" + r.act.map(function (a) { return "<li>" + G.esc(a) + "</li>"; }).join("") + "</ul>";
    if (r.skills.length) h += "<h3>SKILLS</h3><div>" + G.esc(r.skills.join(", ")) + "</div>";
    if (r.awards.length) h += "<h3>AWARDS</h3><div>" + G.esc(r.awards.join(", ")) + "</div>";
    $("rv").innerHTML = h;
  }
  function asText() {
    var r = get(), t = [];
    t.push((r.name || "").toUpperCase()); t.push([r.city, r.email, r.phone].filter(Boolean).join(" | ")); t.push("");
    if (r.school || r.grad || r.note) { t.push("EDUCATION"); t.push([r.school, r.grad].filter(Boolean).join(", ")); if (r.note) t.push(r.note); t.push(""); }
    if (r.exp.length) { t.push("EXPERIENCE"); r.exp.forEach(function (x) { t.push([x.t, x.o].filter(Boolean).join(", ") + (x.d ? " (" + x.d + ")" : "")); x.b.forEach(function (b) { t.push("- " + b); }); }); t.push(""); }
    if (r.act.length) { t.push("ACTIVITIES"); r.act.forEach(function (a) { t.push("- " + a); }); t.push(""); }
    if (r.skills.length) { t.push("SKILLS"); t.push(r.skills.join(", ")); t.push(""); }
    if (r.awards.length) { t.push("AWARDS"); t.push(r.awards.join(", ")); }
    return t.join("\n");
  }
  $("rf").addEventListener("input", function () { render(); if (KEEP.checked) saveDraft(); });
  KEEP.addEventListener("change", function () {
    if (KEEP.checked) saveDraft();
    else { try { localStorage.removeItem("resume"); } catch (e) {} }
  });
  $("rClear").addEventListener("click", function () {
    $("rf").querySelectorAll("input, textarea").forEach(function (i) { i.value = ""; });
    try { localStorage.removeItem("resume"); } catch (e) {}
    render(); $("rName").focus();
  });
  $("rPrint").addEventListener("click", function () { G.printOnly($("rv"), (($("rName").value || "My").replace(/[^a-z0-9]+/gi, "") || "My") + "_Resume"); });
  $("rCopy").addEventListener("click", function () { G.copy(asText()); });
  /* A fresh visitor sees the box off. A person who kept a draft gets the box ticked and the draft back. */
  KEEP.checked = Object.keys(G.store.get("resume", {})).length > 0;
  if (KEEP.checked) restoreDraft();
  render();
})();
