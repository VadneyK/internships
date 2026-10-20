/* Spanish pages (es/): Spanish words for the few labels common.js writes in English, and the Copy buttons on the message templates.
   Only pages in es/ load this file, so English pages carry none of its bytes. No lib.js (lib: none in each src/es page header). */
(function () {
  "use strict";
  var G = window.TIG;
  var WORDS = { "Copied": "Copiado", "Press Ctrl+C or Cmd+C to copy": "Presiona Ctrl+C o Cmd+C para copiar" };
  var menu = document.querySelector(".menu-btn");
  if (menu) menu.textContent = "Menú";
  var toast = G.toast;
  G.toast = function (msg) { return toast(WORDS[msg] || msg); };
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
    b.addEventListener("click", function () {
      var el = document.getElementById(b.getAttribute("data-copy"));
      if (el) G.copy(el.textContent);
    });
  });
})();
