/* Get ready page: a saved checklist and a school-district picker. Everything stays on this device. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };

  var ITEMS = [
    ["job", "I have a job offer. In most places the permit comes after the offer.", "#permit"],
    ["form", "I started the permit or papers my state asks for, and my parent and employer signed what they need to.", "#permit"],
    ["permit", "I know whether I need a permit, and if I do I have it before my first shift.", "#permit"],
    ["docs", "I know which two documents I will bring on day one.", "#papers"],
    ["ssn", "I have a Social Security card or a birth certificate with a seal, or I ordered one.", "#papers"],
    ["bank", "I know how I will be paid, and where the money goes.", "#money"],
    ["tax", "I filled out the W-4 and my state's form with a parent.", "#money"],
    ["ride", "I know how I will get to work.", "#ride"]
  ];

  var DISTRICTS = {
    davis: {
      name: "Davis Joint Unified",
      steps: ["During the school year, your school issues the permit. Pick up the application at your school office.", "Fill it out with your employer and a parent, then drop it off at the school office.", "Allow about three days. The permit is given directly to you.", "In summer, permits are processed electronically through Davis Senior High. Contact Fabiola Gutierrez at fgutierrez@djusd.net."],
      url: "https://www.djusd.net/departments/student_support_services/work_permit", read: "DJUSD work permit page"
    },
    oakland: {
      name: "Oakland Unified",
      steps: ["You must start the application yourself. A parent or employer cannot fill it out for you, or it will be denied.", "You need your parent's email and your employer's email. You fill in your part, route it to your parent, and it then goes to your employer.", "Each school has a work permit point person. The district office is (510) 879-3085, or email workpermits@ousd.org.", "The page said 2025-26 permits expired August 9, 2026, and schools began 2026-27 applications on August 3, 2026. Ask whether you need a new one."],
      url: "https://www.ousd.org/high-school-linked-learning-office/for-students-families/work-permits", read: "OUSD work permits page"
    },
    sf: {
      name: "San Francisco Unified",
      steps: ["High school students apply at their school site. In summer, on school breaks, and for middle school students, the Transcripts, Records and Work Permits Office at 20 Cook St. handles it.", "You must be a current SFUSD student age 13 or older and have satisfactory attendance.", "During the school year you need a 2.0 GPA. You do not need the GPA for a summer permit. A counselor can look at an exemption.", "Bring the state application form (CDE Form B1-1) signed by you, a parent, and your employer, plus proof of age."],
      url: "https://www.sfusd.edu/services/student-services/transcripts-work-permits-student-records/1-work-permits", read: "SFUSD work permits page"
    },
    sj: {
      name: "San Jose Unified",
      steps: ["Work permits are available for students ages 14 to 18. Get hired first, then fill out the request form.", "Get signatures from your employer and a parent or guardian, and sign it yourself.", "Submit the scanned form digitally. Processing can take up to three business days.", "You need regular attendance and a 2.0 GPA. This is from San Jose High's page. Other San Jose Unified schools may differ, so ask your school's office."],
      url: "https://sjhs.sjusd.org/student-resources/work-permits", read: "San Jose High work permit page"
    }
  };

  var done = G.store.get("ready", {});
  var list = $("readyList");
  /* Build the list once so focus stays on the box you toggled; later changes only update checked states and the count. */
  function build() {
    list.innerHTML = ITEMS.map(function (it) {
      return '<li><div><label style="display:flex;gap:.6rem;align-items:flex-start;font-weight:700;cursor:pointer;"><input type="checkbox" data-k="' + it[0] + '" style="margin-top:.3rem;width:1.2rem;height:1.2rem;"><span>' + G.esc(it[1]) + '</span></label> <a class="small" href="' + it[2] + '" aria-label="' + G.esc("See how: " + it[1]) + '">See how</a></div></li>';
    }).join("");
  }
  function sumText() {
    return ITEMS.filter(function (it) { return done[it[0]]; }).length + " of " + ITEMS.length + " done";
  }
  function paint(announce) {
    Array.prototype.forEach.call(list.querySelectorAll("input[data-k]"), function (b) { b.checked = !!done[b.getAttribute("data-k")]; });
    var t = sumText();
    $("readySum").textContent = t;
    var allDone = ITEMS.every(function (it) { return !!done[it[0]]; });
    $("readyDone").hidden = !allDone;
    if (announce) $("readyStatus").textContent = t;
  }
  list.addEventListener("change", function (e) {
    var k = e.target.getAttribute("data-k"); if (!k) return;
    done[k] = e.target.checked; G.store.set("ready", done); paint(true);
  });
  $("readyReset").addEventListener("click", function () { done = {}; G.store.set("ready", done); paint(true); $("readyReset").focus(); });
  build();
  paint(false);

  var sel = $("dist");
  Object.keys(DISTRICTS).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = DISTRICTS[k].name; sel.appendChild(o); });
  ["Fremont Unified", "Sacramento City Unified", "Another district or a charter or private school"].forEach(function (n) { var o = document.createElement("option"); o.value = "other"; o.textContent = n; sel.appendChild(o); });
  G.tilePicker(sel);
  sel.addEventListener("change", function () {
    var out = $("distOut"), d = DISTRICTS[sel.value];
    if (!sel.value) { $("distStatus").textContent = ""; return; }
    $("distStatus").textContent = "Steps for " + sel.options[sel.selectedIndex].textContent + " are listed below.";
    if (!d) {
      out.innerHTML = "<p>We did not find a district-wide page for this one. Ask your school's main office or attendance office. During the school year the school you attend issues the permit. The common steps are: get hired, fill out the form with your employer and a parent, hand it in, and wait a few days. Charter and private schools often use their own office, and some districts do not issue permits for them.</p>";
      return;
    }
    out.innerHTML = "<h3>" + G.esc(d.name) + "</h3><ol>" + d.steps.map(function (s) { return "<li>" + G.esc(s) + "</li>"; }).join("") + '</ol><p class="small muted">Read on Oct 9, 2026: <a href="' + G.esc(d.url) + '" target="_blank" rel="noopener">' + G.esc(d.read) + "</a>. Always confirm with your school before you go.</p>";
  });

  /* rides: every city comes from data/transit.json, each with the pages we read */
  fetch("data/transit.json").then(function (r) { return r.json(); }).then(function (d) {
    var sel = $("rideSel"), out = $("rideOut");
    d.places.forEach(function (p) { var o = document.createElement("option"); o.value = p.id; o.textContent = p.name + " (" + p.state + ")"; sel.appendChild(o); });
    sel.appendChild(Object.assign(document.createElement("option"), { value: "bay", textContent: "Bay Area and Sacramento (California)" }));
    sel.appendChild(Object.assign(document.createElement("option"), { value: "other", textContent: "Somewhere else" }));
    G.tilePicker(sel);
    $("rideDrive").innerHTML = "<p><b>" + G.esc(d.driving.headline) + ".</b> " + G.esc(d.driving.text) + ' <a href="' + G.esc(d.driving.source.u) + '" target="_blank" rel="noopener">' + G.esc(d.driving.source.t) + "</a>. Not covered here: " + d.gaps.map(G.esc).join(" ") + "</p>";
    function row(k, v, key) { var ns = /^(not stated|the pages? (do|does) not)/i.test(v); return "<div" + (key ? ' class="key"' : "") + "><dt>" + k + "</dt><dd" + (ns ? ' class="ns"' : "") + ">" + G.esc(v) + "</dd></div>"; }
    sel.addEventListener("change", function () {
      $("rideStatus").textContent = sel.value ? "Transit answer for " + sel.options[sel.selectedIndex].textContent + " is listed below." : "";
      $("bayRide").hidden = sel.value !== "bay";
      if (sel.value === "bay") { out.innerHTML = "<h3>Bay Area and Sacramento</h3><p>Pick your area in the table below. Most Bay Area youth discounts use one shared Clipper card.</p>"; return; }
      if (sel.value === "other") { out.innerHTML = "<p>We have not read your transit agency yet. Ask your school office, or look for a youth pass on the agency's own website.</p>"; return; }
      var p = d.places.filter(function (x) { return x.id === sel.value; })[0];
      if (!p) { out.innerHTML = '<p class="muted">Tap a place to see the card to get, what it costs, what to bring and whether it works for a job.</p>'; return; }
      out.innerHTML = "<h3>" + G.esc(p.name) + "</h3><dl class=\"facts\">" + row("Where to get it", p.get, 1) + row("What it costs", p.cost, 1) + row("Who qualifies", p.who) + row("What to bring", p.bring) + row("Does it work for a job?", p.work) + row("How long it lasts", p.ends) + "</dl>" +
        '<p class="row"><a class="btn sm" href="' + G.esc(p.plan.u) + '" target="_blank" rel="noopener">Plan your trip: ' + G.esc(p.plan.t) + "</a></p>" +
        '<p class="small muted">Read on ' + G.esc(d.read) + " from: " + p.sources.map(function (s) { return '<a href="' + G.esc(s.u) + '" target="_blank" rel="noopener">' + G.esc(s.t) + "</a>"; }).join(" &middot; ") + ". Programs and prices change, so confirm on the agency page.</p>";
    });
    var want = new URLSearchParams(location.search).get("ride");
    if (want) { sel.value = want; sel.dispatchEvent(new Event("change")); }
  }).catch(function () { $("rideOut").innerHTML = '<p class="muted">The ride answers could not load. Use the table below or ask your school office.</p>'; });
})();
