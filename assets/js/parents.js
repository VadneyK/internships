/* For parents: what a parent signs, how to help, money, ages 12 to 14, safe contact. Content is data/parents.json.
   Every statement carries "p", the page of this guide it comes from, and shows it as a link. Nothing is stored or sent. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var pages = {};

  /* a source like page.html#id is shown by its page file, page.html */
  function file(p) { return String(p).split("#")[0].split("?")[0]; }
  function from(p) {
    var name = pages[file(p)] || file(p);
    return '<span class="src small muted" style="display:block;">From <a href="' + G.esc(p) + '">' + G.esc(name) + "</a></span>";
  }
  function li(s) { return "<li>" + G.esc(s.t) + from(s.p) + "</li>"; }
  function list(id, arr) { $(id).innerHTML = arr.map(li).join(""); }
  function para(id, s) { $(id).innerHTML = G.esc(s.t) + from(s.p); }

  G.fetchData("data/parents.json").then(function (r) { return r.json(); }).then(function (d) {
    pages = d.pages;

    para("signLead", d.sign.lead);
    function drawStates(only) {
      var rows = d.sign.states.filter(function (s) { return !only || s.id === only; });
      // On phones the rows stack (CSS .stackt), which drops table meaning in some browsers, so the roles are set here.
      // Each cell also carries its column name for the stacked view; screen readers get the real headers instead.
      function k(t) { return "<span class=\"tk\" aria-hidden=\"true\">" + t + "</span>"; }
      $("signT").innerHTML = "<caption class=\"sr\">Work permit by state: what a parent does</caption><thead role=\"rowgroup\"><tr role=\"row\"><th scope=\"col\" role=\"columnheader\">Place</th><th scope=\"col\" role=\"columnheader\">Permit</th><th scope=\"col\" role=\"columnheader\">What a parent does</th><th scope=\"col\" role=\"columnheader\">Who to call</th></tr></thead><tbody role=\"rowgroup\">" +
        rows.map(function (s) {
          return "<tr role=\"row\"><th scope=\"row\" role=\"rowheader\">" + G.esc(s.name) + "</th>" +
            "<td role=\"cell\">" + k("Permit") + "<b>" + G.esc(s.need) + ".</b> " + G.esc(s.permit) + "</td>" +
            "<td role=\"cell\">" + k("What a parent does") + G.esc(s.parent) + from(s.p) + "</td>" +
            "<td role=\"cell\">" + k("Who to call") + G.lib.linkContacts(s.call) + "</td></tr>";
        }).join("") + "</tbody>";
    }
    var sel = $("pState");
    d.sign.states.forEach(function (s) { var o = document.createElement("option"); o.value = s.id; o.textContent = s.name; sel.appendChild(o); });
    drawStates("");
    sel.addEventListener("change", function () {
      drawStates(sel.value);
      var total = d.sign.states.length, st = $("pStatus"), msg;
      if (!sel.value) msg = "Showing all " + total + " places.";
      else msg = "Showing " + sel.options[sel.selectedIndex].textContent + ". 1 of " + total + " places.";
      if (st && st.textContent !== msg) st.textContent = msg;
    });
    para("signNote", d.sign.note);
    list("signOthers", d.sign.others);
    para("langLead", d.languages.lead);
    $("langChips").innerHTML = d.languages.list.map(function (l) {
      return '<a class="chip" style="text-decoration:none" href="languages.html?lang=' + G.esc(l.code) + '">' + G.esc(l.name) + "</a>";
    }).join("");

    para("helpLead", d.help.lead);
    list("helpPlaybook", d.help.playbook);
    list("helpInterview", d.help.interview);

    para("moneyLead", d.money.lead);
    list("moneyPay", d.money.pay);
    list("moneyTaxes", d.money.taxes);
    list("moneyWrong", d.money.wrong);
    list("moneyBank", d.money.bank);

    para("youngLead", d.young.lead);
    list("youngItems", d.young.items);

    para("safeLead", d.safe.lead);
    list("safeContact", d.safe.contact);
    list("safeFlags", d.safe.flags);
    list("safeOnline", d.safe.online);
    list("safeScams", d.safe.scams);
    list("safeWork", d.safe.work);

    list("gapsL", d.gaps.items);
  }).catch(function () { $("signLead").textContent = "This page could not load. Try again."; $("pStatus").textContent = "This page could not load. Try again."; });
})();
