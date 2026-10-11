/* Handout for teachers and counselors: the Print this page button. Nothing is stored or sent. */
(function () {
  "use strict";
  var btn = document.getElementById("handoutPrint");
  if (!btn) return;
  btn.addEventListener("click", function () { window.print(); });
})();
