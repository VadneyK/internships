/* Share page: copy a link or print one QR code. Nothing is sent anywhere. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  $("copyShareMsg").addEventListener("click", function () { G.copy($("shareMsg").textContent); });
  document.querySelectorAll("[data-copy-link]").forEach(function (b) {
    b.addEventListener("click", function () { G.copy(b.getAttribute("data-copy-link")); });
  });
  document.querySelectorAll("[data-print-qr]").forEach(function (b) {
    b.addEventListener("click", function () {
      var card = b.closest(".qrcard");
      var img = card.querySelector("img"), title = card.querySelector("h2").textContent, link = card.querySelector("code").textContent;
      var area = $("qrPrint"); area.innerHTML = "";
      var h = document.createElement("h2"); h.textContent = title; area.appendChild(h);
      var pic = document.createElement("p"), big = img.cloneNode(true); big.setAttribute("width", "320"); big.setAttribute("height", "320"); pic.appendChild(big); area.appendChild(pic);
      var how = document.createElement("p"); how.style.fontSize = "1.1rem"; how.appendChild(document.createTextNode("Scan with your phone camera, or type: "));
      var bold = document.createElement("b"); bold.textContent = link; how.appendChild(bold); area.appendChild(how);
      var note = document.createElement("p"); note.className = "small"; note.textContent = "A free guide to teen jobs and internships. Not an official Ignition or church resource."; area.appendChild(note);
      $("qrPrint").hidden = false; G.printOnly($("qrPrint"), title); $("qrPrint").hidden = true;
    });
  });
})();
