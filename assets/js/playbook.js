/* Playbook: people map (saved on this device) and the five-line message builder. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };

  var L = G.lib;
  /* es/playbook.html loads es-playbook.js (G.es, ADR 0008); in English t() returns its text */
  var X = G.es || {}, t = X.t || String, ST = X.statuses || L.STATUSES, split = X.split || L.splitMessage;
  function v(id) { return $(id).value.trim(); }
  function day(iso) { return (X.date || L.fmtDate)(L.parseISO(iso)); }

  /* your details are remembered on this device so you only type them once */
  var me = G.store.get("me", {});

  /* people map and tracker. Each person: n name, w what they do, h how I know them, s status, d date sent (YYYY-MM-DD) */
  var rows = G.store.get("people", []);
  /* a damaged save must not break the page: every row is an object, every field a string, and a date only stays if it is a real date */
  rows = rows.map(function (r) {
    r = r !== null && typeof r === "object" && !Array.isArray(r) ? r : {};
    ["n", "w", "h", "s", "d"].forEach(function (k) { r[k] = typeof r[k] === "string" ? r[k] : ""; });
    if (r.d && !L.parseISO(r.d)) r.d = "";
    return r;
  });
  while (rows.length < 5) rows.push({});
  var MAX = 8;
  var box = $("people");
  function today() { return L.toISO(new Date()); }
  function save() { G.store.set("people", rows); }

  function personHtml(r, i) {
    var opts = ST.map(function (o) { return '<option value="' + o[0] + '"' + ((r.s || "") === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("");
    return '<article class="card person" data-i="' + i + '"><div class="ph"><b>' + t("Person ") + (i + 1) + '</b>' +
      '<label class="sr" for="ps' + i + '">' + t("Status for person ") + (i + 1) + '</label><select class="pstat" id="ps' + i + '" data-i="' + i + '" data-k="s">' + opts + "</select></div>" +
      '<div class="field"><label for="pn' + i + '">' + t("Name") + '</label><input id="pn' + i + '" data-i="' + i + '" data-k="n" type="text" autocapitalize="words" autocomplete="off" placeholder="' + t("Mrs. Lee") + '" value="' + G.esc(r.n) + '"></div>' +
      '<div class="field"><label for="pw' + i + '">' + t("What they do") + '</label><input id="pw' + i + '" data-i="' + i + '" data-k="w" type="text" autocomplete="off" placeholder="' + t("dentist") + '" value="' + G.esc(r.w) + '"></div>' +
      '<div class="field"><label for="ph' + i + '">' + t("How I know them (one sentence)") + '</label><input id="ph' + i + '" data-i="' + i + '" data-k="h" type="text" autocomplete="off" placeholder="' + t("I'm in youth group with her son.") + '" value="' + G.esc(r.h) + '"></div>' +
      '<div class="pfoot" id="pf' + i + '"></div></article>';
  }
  function footHtml(r, i) {
    var name = (r.n || "").trim();
    var f = L.followUpISO(r), html = name ? '<div class="chips"><button class="btn sm" type="button" data-write="' + i + '">' + t("Write to them") + "</button></div>" :
      '<p class="small muted">' + t("Add a name to write to them.") + "</p>";
    if (f) {
      html += "<p>" + t("Sent ") + G.esc(day(r.d)) + ". " + (f <= today() ? '<span class="due">' + t("Time to follow up.") + "</span> " : t("Follow up on ") + "<b>" + G.esc(day(f)) + "</b>. ") +
        '<button class="chip" type="button" data-ics="' + i + '">' + t("Add to my calendar") + "</button></p>";
    } else if (r.s === "replied") html += "<p>" + t("Say thank you within 1 to 2 days, then ask for the 15 minutes.") + "</p>";
    else if (r.s === "meeting") html += "<p>" + t("Pick two questions to ask. See step 4 below.") + "</p>";
    else if (r.s === "thanked") html += "<p>" + t("Nice. Check in again in a few months with one line about what you did.") + "</p>";
    return html;
  }
  function paintFoot(i) {
    var f = L.followUpISO(rows[i]), el = $("pf" + i), c = box.children[i];
    if (el) el.innerHTML = footHtml(rows[i], i);
    if (c) c.classList.toggle("is-due", !!f && f <= today());
  }
  function paintSummary() {
    var sum = L.planSummary(rows, Date.now());
    $("planSummary").textContent = sum.sent + t(" of ") + Math.max(5, sum.named) + t(" sent");
    $("planNext").textContent = sum.next ? (sum.next.due ? t("Follow up with ") + sum.next.name + t(" now.") : t("Next follow-up: ") + sum.next.name + t(" on ") + day(sum.next.date) + ".") : "";
    $("planPng").disabled = sum.named === 0;
    $("planHint").hidden = sum.named > 0;
    $("addPerson").hidden = rows.length >= MAX;
  }
  function paintAll() {
    box.innerHTML = rows.map(personHtml).join("");
    rows.forEach(function (r, i) { paintFoot(i); });
    paintSummary(); syncSelect();
  }
  function syncSelect() {
    var sel = $("fToSel"), keep = sel.value;
    sel.innerHTML = '<option value="">' + t("Pick from your map, or type below") + "</option>" + rows.map(function (r, i) {
      return r.n && r.n.trim() ? '<option value="' + i + '">' + G.esc(r.n) + (r.w ? " (" + G.esc(r.w) + ")" : "") + "</option>" : "";
    }).join("");
    sel.value = keep;
    if (sel.value !== keep) sel.value = "";
  }
  function setStatus(i, s) {
    rows[i].s = s;
    if (s === "sent" && !rows[i].d) rows[i].d = today();
    if (!s) rows[i].d = "";
    save(); paintFoot(i); paintSummary(); updateSendUi();
    var sel = $("ps" + i); if (sel) sel.value = s;
  }

  box.addEventListener("input", function (e) {
    var i = e.target.getAttribute("data-i"), k = e.target.getAttribute("data-k");
    if (i == null || k === "s") return;
    rows[+i][k] = e.target.value; save();
    paintFoot(+i); paintSummary(); syncSelect();
  });
  box.addEventListener("change", function (e) {
    if (e.target.getAttribute("data-k") === "s") setStatus(+e.target.getAttribute("data-i"), e.target.value);
  });
  box.addEventListener("click", function (e) {
    var w = e.target.closest("[data-write]");
    if (w) { writeTo(+w.getAttribute("data-write")); return; }
    var c = e.target.closest("[data-ics]");
    if (c) {
      var r = rows[+c.getAttribute("data-ics")], f = L.followUpISO(r);
      if (!f) return;
      G.download(t("follow-up-") + (r.n || t("person")).replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".ics",
        L.icsEvent({ uid: "followup-" + Date.now(), title: t("Follow up with ") + r.n, desc: t("Send one short follow-up note. If there is no reply, move on to the next name on your list."), dateISO: f }), "text/calendar");
      G.toast(t("Calendar file saved. Open it to add the reminder."));
    }
  });
  $("addPerson").addEventListener("click", function () {
    if (rows.length >= MAX) return;
    rows.push({}); save(); paintAll();
    var el = $("pn" + (rows.length - 1)); if (el) el.focus();
  });
  $("clearMap").addEventListener("click", function () {
    if ((rows.some(function (r) { return r.n || r.w || r.h || r.s; }) || ["fMe", "fGrade", "fSchool"].some(v)) && !window.confirm(t("Clear all your people and your details from this device?"))) return;
    rows = [{}, {}, {}, {}, {}]; save(); G.store.set("me", {}); me = {};
    ["fMe", "fGrade", "fSchool"].forEach(function (id) { $(id).value = ""; });
    paintAll(); build(); G.toast(t("Cleared")); $("clearMap").focus();
  });

  /* fill the builder from one person and redraw the message, without moving focus */
  function fillBuilder(i) {
    var r = rows[i];
    $("fToSel").value = String(i); $("fTo").value = r.n || "";
    if (r.h) { var h = r.h.trim(); $("fHow").value = h.charAt(0).toUpperCase() + h.slice(1) + (/[.!?]$/.test(h) ? "" : "."); }
    build();
  }
  /* write a message to one person: fill the builder and jump to it */
  function writeTo(i) {
    fillBuilder(i);
    var msg = $("message");
    if (!msg.hasAttribute("tabindex")) msg.setAttribute("tabindex", "-1");
    msg.scrollIntoView({ behavior: G.motionOK() ? "smooth" : "auto", block: "start" });
    msg.focus({ preventScroll: true });
    var next = ["fMe", "fGrade", "fSchool", "fHow", "fCurious"].filter(function (id) { return !v(id); })[0] || "fCurious";
    setTimeout(function () { $(next).focus({ preventScroll: true }); }, 350);
  }
  /* a change event fires on every arrow key in the select, so picking a name only fills the fields and never moves focus (WCAG 3.2.2) */
  $("fToSel").addEventListener("change", function (e) {
    if (e.target.value !== "") fillBuilder(+e.target.value); else build();
  });

  /* a picture of your plan to keep or send to a parent */
  function planImage() {
    var named = rows.filter(function (r) { return r.n && r.n.trim(); });
    var W = 1080, rowH = 150, H = 330 + named.length * rowH + 120;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    var FONT = '"DM Sans", Arial, sans-serif', HEAD = 'Archivo, "Arial Black", Arial, sans-serif';
    x.fillStyle = "#f3f0ea"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#151515"; x.fillRect(0, 0, W, 190);
    x.fillStyle = "#f6c431"; x.font = "italic 900 34px " + HEAD; x.fillText("FIND INTERNSHIPS", 60, 78);
    x.fillStyle = "#fff"; x.font = "italic 900 72px " + HEAD; x.fillText(t("MY PEOPLE MAP"), 60, 156);
    var sum = L.planSummary(rows, Date.now());
    x.fillStyle = "#151515"; x.font = "700 36px " + FONT;
    x.fillText(sum.sent + t(" of ") + Math.max(5, sum.named) + t(" messages sent") + (sum.next ? "   |   " + t("Next follow-up: ") + sum.next.name + ", " + day(sum.next.date) : ""), 60, 262);
    named.forEach(function (r, k) {
      var y = 310 + k * rowH;
      x.fillStyle = "#fff"; x.strokeStyle = "#151515"; x.lineWidth = 5;
      x.fillRect(60, y, W - 120, rowH - 24); x.strokeRect(60, y, W - 120, rowH - 24);
      x.fillStyle = "#151515"; x.font = "800 42px " + FONT; x.fillText(r.n.trim().slice(0, 28), 90, y + 52);
      x.font = "500 30px " + FONT; x.fillStyle = "#333";
      x.fillText([(r.w || "").trim(), (r.h || "").trim()].filter(Boolean).join("  |  ").slice(0, 52), 90, y + 96);
      var st = (ST.filter(function (o) { return o[0] === (r.s || ""); })[0] || ST[0])[1];
      if (r.s === "sent" && r.d) st += t(", follow up ") + day(L.followUpISO(r));
      x.font = "800 28px " + FONT; x.fillStyle = r.s ? "#b53611" : "#555"; x.textAlign = "right"; x.fillText(st.slice(0, 40), W - 90, y + 52); x.textAlign = "left";
    });
    x.fillStyle = "#555"; x.font = "500 26px " + FONT;
    x.fillText("vadneyk.github.io/internships   |   " + t("Private to your device. Not an official Ignition publication."), 60, H - 50);
    return c;
  }
  $("planPng").addEventListener("click", function () {
    var go = function () { planImage().toBlob(function (b) { if (b) { G.download(t("my-people-map.png"), b); G.toast(t("Image saved to your device")); } }, "image/png"); };
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('900 40px Archivo'), document.fonts.load("500 30px 'DM Sans'")]).then(go, go); else go();
  });

  /* how-chips */
  var HOWS = X.hows || [
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

  var ASK = X.ask || {
    call: ["Could I ask you a few questions for 15 minutes, by phone or in person", "Could we talk for 15 minutes"],
    shadow: ["Could I shadow you for an afternoon to see what a day looks like", "Could I shadow you for an afternoon"],
    email: ["Would you be open to answering three quick questions by email", "Could I email you three quick questions"],
    help: ["Could I help out as a volunteer for a few hours", "Could I help out for a few hours"],
    advice: ["Could I get your advice on how to get started, in a 15-minute chat", "Could I get your advice for 15 minutes"]
  };
  function build() {
    var to = v("fTo") || t("[their name]");
    var meName = v("fMe") || t("[your name]");
    var phrase = (X.grade || L.gradePhrase)($("fGrade").value);
    var school = v("fSchool") || t("[school]");
    var s = v("fHow") || t("[how you know them]");
    var cur = v("fCurious") || t("[what you are curious about]");
    var when = v("fWhen"), a = ASK[$("fAsk").value], fmt = $("fFormat").value;
    if (!/[.!?]$/.test(s)) s += ".";
    when = when ? " " + when : "";
    var msg = X.msg ? X.msg(fmt, to, meName, phrase, school, s, cur, a, when) : fmt === "text" ?
      "Hi " + to + ", this is " + meName + ". I'm " + phrase + " at " + school + ". " + s + " I'm curious about " + cur + ". " + a[1] + when + "? Totally fine if you're busy. Thanks!" :
      "Subject: Quick question from a student at " + school + "\n\nHi " + to + ",\n\nMy name is " + meName + " and I'm " + phrase + " at " + school + ". " + s + "\n\nI'm curious about " + cur + ". " + a[0] + when + "?\n\nTotally fine if you're busy. Thank you for reading this!\n\n" + meName;
    $("letter").textContent = msg;
    me = { n: $("fMe").value, g: $("fGrade").value, s: $("fSchool").value }; G.store.set("me", me);
    updateSendUi();
    var blanks = L.blanksLeft(msg), note = $("blankNote");
    note.hidden = !blanks.length;
    note.textContent = blanks.length ? t("Fill in before you send: ") + blanks.join(", ") : "";
    var words = (split(msg).body.match(/\S+/g) || []).length;
    $("wc").textContent = words + t(" words");
    $("meter").classList.toggle("over", words > 90);
    $("meter").firstElementChild.style.width = Math.min(100, Math.round(words / 90 * 100)) + "%";
    var checks = [
      [words <= 90, t("Short enough to read in about 20 seconds (under 90 words)")],
      [v("fTo").length > 1 && v("fMe").length > 1 && v("fGrade") && v("fSchool"), t("Says who you are: name, grade, school")],
      [v("fHow").length > 8, t("Says how you know them")],
      [v("fCurious").length > 2, t("Says what you are curious about")],
      [true, t("One small ask with a limit (like 15 minutes or one afternoon)")],
      [true, t("Makes it easy to say no, and says thank you")]
    ];
    $("checks").innerHTML = checks.map(function (c) { return '<li class="' + (c[0] ? "ok" : "") + '"><span class="box" aria-hidden="true">' + (c[0] ? "&#10003;" : "") + "</span><span>" + c[1] + '<span class="sr">' + (c[0] ? t(" (done)") : t(" (not yet)")) + "</span></span></li>"; }).join("");
  }
  /* Screen readers hear one short, debounced note instead of the whole letter after each keystroke. */
  var statusTimer;
  function onEdit() {
    build();
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      var n = parseInt($("wc").textContent, 10) || 0;
      $("letterStatus").textContent = t("Message updated. ") + n + (n === 1 ? t(" word.") : t(" words."));
    }, 800);
  }
  ["fTo", "fMe", "fGrade", "fSchool", "fHow", "fCurious", "fWhen", "fAsk", "fFormat"].forEach(function (id) { $(id).addEventListener("input", onEdit); $(id).addEventListener("change", onEdit); });
  /* sendable: hand the message to the phone's own email or Messages app. This page never sends anything. */
  function updateSendUi() {
    var msg = $("letter").textContent, isText = $("fFormat").value === "text";
    var parts = split(msg);
    $("sendMail").hidden = isText; $("sendSms").hidden = !isText;
    $("sendMail").href = L.mailtoHref(parts.subject, parts.body);
    $("sendSms").href = L.smsHref(parts.body);
    $("shareMsg").hidden = !navigator.share;
    var idx = $("fToSel").value;
    $("markSent").hidden = idx === "" || !rows[+idx] || !!rows[+idx].s;
    $("addMark").hidden = idx !== "" || v("fTo").length < 2 || emptyRowIndex() < 0 && rows.length >= MAX;
  }
  function emptyRowIndex() {
    for (var i = 0; i < rows.length; i++) if (!(rows[i].n && rows[i].n.trim())) return i;
    return -1;
  }
  $("copyMsg").addEventListener("click", function () { G.copy($("letter").textContent); });
  $("shareMsg").addEventListener("click", function () {
    var parts = split($("letter").textContent);
    navigator.share({ title: parts.subject || t("My message"), text: parts.body }).catch(function () {});
  });
  $("markSent").addEventListener("click", function () {
    var idx = +$("fToSel").value; setStatus(idx, "sent");
    G.toast(t("Marked as sent. Follow-up reminder set for one week."));
  });
  $("addMark").addEventListener("click", function () {
    var name = v("fTo");
    if ($("fToSel").value !== "" || name.length < 2) return;
    var i = emptyRowIndex();
    if (i < 0) { if (rows.length >= MAX) return; rows.push({}); i = rows.length - 1; }
    var how = v("fHow");
    rows[i].n = name;
    if (how) rows[i].h = how;
    save(); paintAll();
    $("fToSel").value = String(i);
    setStatus(i, "sent");
    G.toast(t("Added to your map and marked as sent. Follow-up reminder set for one week."));
  });
  document.querySelectorAll("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { G.copy($(b.getAttribute("data-copy")).textContent); }); });

  $("fMe").value = me.n || ""; $("fGrade").value = me.g || ""; $("fSchool").value = me.s || "";
  paintAll(); build();
})();
