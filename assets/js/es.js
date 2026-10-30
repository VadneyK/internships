/* Spanish pages (es/): Spanish words for the few labels common.js writes in English.
   Only pages in es/ load this file, so English pages carry none of its bytes. The Playbook tools take their Spanish from es-playbook.js. */
(function () {
  "use strict";
  var G = window.TIG;
  var WORDS = { "Copied": "Copiado", "Press Ctrl+C or Cmd+C to copy": "Presiona Ctrl+C o Cmd+C para copiar" };
  var menu = document.querySelector(".menu-btn");
  if (menu) menu.textContent = "Menú";
  var toast = G.toast;
  G.toast = function (msg) { return toast(WORDS[msg] || msg); };
})();

/* Home "At Ignition ...? Start here" line follows the Ignition season (ignitionstudents.org, read 2026-10-30).
   Each event shows from the day after the previous one ends through its own last day.
   After the last event of the season the line hides; add next season's dates here. */
(function () {
  "use strict";
  var line = document.querySelector("[data-event-line]");
  if (!line) return;
  var EVENTS = [
    { name: "NorCal", end: "2026-10-24", href: "ignition.html" },
    { name: "SoCal", end: "2026-11-07", href: "find.html?where=socal" },
    { name: "Atlanta", end: "2027-02-13", href: "find.html?where=atl" },
    { name: "New York", end: "2027-02-20", href: "find.html?where=nyc" },
    { name: "Chicago", end: "2027-03-20", href: "find.html?where=chi" }
  ];
  var GRACE = 0;
  var now = Date.now(), ev = null;
  for (var i = 0; i < EVENTS.length; i++) {
    if (now <= Date.parse(EVENTS[i].end + "T23:59:59-08:00") + GRACE) { ev = EVENTS[i]; break; }
  }
  if (!ev) { line.hidden = true; return; }
  var es = line.getAttribute("data-lang") === "es";
  var prefix = es ? "../" : "";
  line.textContent = "";
  line.appendChild(document.createTextNode((es ? "\u00bfEst\u00e1s en Ignition " : "At Ignition ") + ev.name + "? "));
  var a = document.createElement("a");
  a.href = prefix + ev.href;
  a.textContent = es ? "Empieza aqu\u00ed" : "Start here";
  if (es) a.setAttribute("hreflang", "en");
  line.appendChild(a);
  if (es) line.appendChild(document.createTextNode(" (en ingl\u00e9s)"));
})();
