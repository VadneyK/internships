/* Handout: one button prints just the sheet, the other the whole page. */
(function () {
  "use strict";
  function on(id, f) { var b = document.getElementById(id); if (b) b.addEventListener("click", f); }
  on("handoutPrint", function () { TIG.printOnly(document.getElementById("handoutSheet"), "Handout: find your first job"); });
  on("handoutPrintAll", function () { window.print(); });
})();
