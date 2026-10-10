/* Shared helpers: theme, toast, copy, data loading, saved list. No tracking, no network calls except loading data/entries.json. */
(function () {
  "use strict";
  var G = (window.TIG = window.TIG || {});

  /* theme toggle: the label never changes; aria-pressed says whether dark mode is on */
  var btn = document.getElementById("themeBtn");
  function currentTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) cur = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    return cur;
  }
  function showThemeState() {
    btn.setAttribute("aria-pressed", currentTheme() === "dark" ? "true" : "false");
  }
  if (btn) {
    showThemeState();
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      showThemeState();
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

  /* Browsers print a closed <details> as just its summary, so open every one in main for the print,
     then put each back the way it was. Screen view does not change. */
  var detailsForPrint = null;
  window.addEventListener("beforeprint", function () {
    if (detailsForPrint) return; /* already opened for this print */
    var all = document.querySelectorAll("main details");
    detailsForPrint = [];
    for (var i = 0; i < all.length; i++) {
      detailsForPrint.push([all[i], all[i].open]);
      all[i].open = true;
    }
  });
  window.addEventListener("afterprint", function () {
    if (!detailsForPrint) return;
    for (var i = 0; i < detailsForPrint.length; i++) detailsForPrint[i][0].open = detailsForPrint[i][1];
    detailsForPrint = null;
  });

  /* safe storage */
  G.store = {
    get: function (k, d) {
      try {
        var raw = localStorage.getItem(k); if (raw === null) return d;
        var v = JSON.parse(raw);
        /* damaged or edited saves: keep the value only when it has the same kind as the default */
        if (Array.isArray(d)) return Array.isArray(v) ? v : d;
        if (d !== null && typeof d === "object") return v !== null && typeof v === "object" && !Array.isArray(v) ? v : d;
        return v === undefined ? d : v;
      } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* data */
  var cache, liteCache, coreCache, cardCache;
  /* G.loadEntries() is the full file (find.js). G.loadEntries(true) is the lite file: same ids and order, without the long text fields, for pages that only show a few fields. G.loadEntries("core") is the core file: same ids and order, only the keys lib.js needs to match by age, status, season and region. G.loadEntries("card") is the card file: same ids and order, only the short fields the Calendar and Numbers pages read. */
  function checkJson(r) {
    if (!r.ok) throw new Error("Could not load programs (" + r.status + ")");
    return r.json();
  }
  G.loadEntries = function (lite) {
    if (lite === "core") {
      if (!coreCache) coreCache = fetch("data/entries-core.json", { cache: "no-cache" }).then(checkJson);
      return coreCache;
    }
    if (lite === "card") {
      if (!cardCache) cardCache = fetch("data/entries-card.json", { cache: "no-cache" }).then(checkJson);
      return cardCache;
    }
    if (lite) {
      if (!liteCache) liteCache = fetch("data/entries-lite.json", { cache: "no-cache" }).then(checkJson);
      return liteCache;
    }
    if (!cache) cache = fetch("data/entries.json", { cache: "no-cache" }).then(checkJson);
    return cache;
  };

  /* labels and helpers come from lib.js (pure functions, unit tested) */
  var L = G.lib || null; /* pages with no script of their own do not load lib.js */
  /* Fill a select with every city and area, each with how many programs it has. A city with none says so, so nobody thinks the site is broken. */
  G.fillPlaces = function (sel, entries, keep) {
    if (!L) return;
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
  if (L) {
    G.REGIONS = L.REGIONS; G.HUBS = L.HUBS; G.TYPES = L.TYPES; G.FIELDS = L.FIELDS; G.PAID = L.PAID;
    G.esc = L.esc; G.safeUrl = L.safeUrl; G.parseISO = L.parseISO; G.fmtDate = L.fmtDate; G.daysUntil = L.daysUntil;
  }

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
  /* Warn which links open a new tab. Every a[target=_blank] gets "(opens in a new tab)" in its name:
     appended to aria-label when it has one, otherwise as a visually hidden .sr span. Safe to run again. */
  var NEWTAB = /opens in a new tab/i;
  G.markNewTabLinks = function (root) {
    var links = (root || document).querySelectorAll('a[target="_blank"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], label = a.getAttribute("aria-label");
      if (label) {
        if (!NEWTAB.test(label)) a.setAttribute("aria-label", label + ", opens in a new tab");
      } else if (!a.querySelector("span.sr[data-newtab]") && !NEWTAB.test(a.textContent)) {
        var m = document.createElement("span");
        m.className = "sr"; m.setAttribute("data-newtab", "");
        m.textContent = " (opens in a new tab)";
        a.appendChild(m);
      }
    }
  };
  (function () {
    var main = document.querySelector("main");
    G.markNewTabLinks(document);
    if (!main || !window.MutationObserver || G.newTabObserver) return;
    G.newTabObserver = new MutationObserver(function () { G.markNewTabLinks(main); });
    G.newTabObserver.observe(main, { childList: true, subtree: true });
  })();
})();
