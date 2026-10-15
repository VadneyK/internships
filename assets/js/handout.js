/* Handout: print just the sheet, just the table plan, or the whole page. */
(function () {
  "use strict";
  function on(id, f) { var b = document.getElementById(id); if (b) b.addEventListener("click", f); }
  function one(id, t) { return function () { window.TIG.printOnly(document.getElementById(id), t); }; }
  on("handoutPrint", one("handoutSheet", "Handout: find your first job"));
  on("handoutPrintTable", one("table", "Run it as a 30 minute table"));
  on("handoutPrintAll", function () { window.print(); });
})();
