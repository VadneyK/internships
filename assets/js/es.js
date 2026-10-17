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
