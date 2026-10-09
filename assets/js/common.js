/* Shared helpers: theme, toast, copy, data loading, saved list. No tracking, no network calls except loading data/entries.json. */
(function () {
  "use strict";
  var G = (window.TIG = window.TIG || {});

  /* theme toggle */
  var btn = document.getElementById("themeBtn");
  if (btn) {
    btn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      if (!cur) cur = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* toast */
  var toastEl = document.getElementById("toast");
  var toastTimer;
  G.toast = function (msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  };

  /* copy text, with a fallback for browsers that refuse the clipboard API */
  G.copy = function (text) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      G.toast(ok ? "Copied" : "Press Ctrl+C or Cmd+C to copy");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { G.toast("Copied"); }, fallback);
    } else fallback();
  };

  /* save a file to the device (text or a Blob) */
  G.download = function (name, data, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || "text/plain" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  };

  /* print ONE thing, not the whole page: copy it into a print-only layer, print, remove it */
  G.printOnly = function (node, title) {
    if (document.getElementById("printRoot")) return; /* a print is already open */
    var root = document.createElement("div");
    root.id = "printRoot";
    var copy = node.cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); }); /* no duplicate ids while printing */
    root.appendChild(copy);
    document.body.appendChild(root);
    document.body.classList.add("print-one");
    var oldTitle = document.title;
    if (title) document.title = title;
    function done() {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("print-one");
      if (root.parentNode) root.parentNode.removeChild(root);
      document.title = oldTitle;
    }
    window.addEventListener("afterprint", done);
    window.print(); /* afterprint cleans up once the dialog closes */
  };

  /* safe storage */
  G.store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* data */
  var cache;
  G.loadEntries = function () {
    if (cache) return cache;
    cache = fetch("data/entries.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Could not load programs (" + r.status + ")");
      return r.json();
    });
    return cache;
  };

  /* labels and helpers come from lib.js (pure functions, unit tested) */
  var L = G.lib;
  /* Fill a select with every city and area, each with how many programs it has. A city with none says so, so nobody thinks the site is broken. */
  G.fillPlaces = function (sel, entries, keep) {
    function n(place) { var c = 0; entries.forEach(function (e) { if (L.matches(e, { place: place }, Date.now())) c++; }); return c; }
    function group(label, kind, list) {
      var g = document.createElement("optgroup"); g.label = label;
      list.forEach(function (x) {
        var c = n(kind + ":" + x[0]), o = document.createElement("option");
        o.value = kind + ":" + x[0]; o.textContent = x[1] + (c ? " (" + c + ")" : " (none yet)");
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
    group("Cities", "city", L.CITIES.slice().sort(function (a, b) { return a[1] < b[1] ? -1 : 1; }));
    group("Bigger areas", "area", L.AREAS);
    if (keep) sel.value = keep;
  };
  G.REGIONS = L.REGIONS; G.HUBS = L.HUBS; G.TYPES = L.TYPES; G.FIELDS = L.FIELDS; G.PAID = L.PAID;
  G.esc = L.esc; G.safeUrl = L.safeUrl; G.parseISO = L.parseISO; G.fmtDate = L.fmtDate; G.daysUntil = L.daysUntil;

  /* saved list shared by the Programs page and the home page */
  G.saved = {
    ids: function () { return G.store.get("saved", []); },
    has: function (id) { return G.saved.ids().indexOf(id) > -1; },
    toggle: function (id) {
      var a = G.saved.ids(), i = a.indexOf(id);
      if (i > -1) a.splice(i, 1); else a.push(id);
      G.store.set("saved", a); return i === -1;
    }
  };
})();
