/* Shared helpers: theme, toast, copy, data loading, saved list. No tracking, no network calls except loading the data files under data/. */
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

  /* phone menu: one button opens the eight links. The links stay in the page for everyone else. */
  (function () {
    var top = document.querySelector("header.top"), nav = top && top.querySelector(".nav");
    if (!nav || !btn) return;
    if (!nav.id) nav.id = "mainNav";
    var m = document.createElement("button"); m.type = "button"; m.className = "menu-btn"; m.textContent = "Menu";
    m.setAttribute("aria-expanded", "false"); m.setAttribute("aria-controls", nav.id);
    btn.parentNode.insertBefore(m, btn);
    top.classList.add("menu-js");
    m.addEventListener("click", function () {
      var on = !top.classList.contains("open"); top.classList.toggle("open", on); m.setAttribute("aria-expanded", String(on));
    });
    top.addEventListener("keydown", function (e) { if (e.key === "Escape" && top.classList.contains("open")) { top.classList.remove("open"); m.setAttribute("aria-expanded", "false"); m.focus(); } });
  })();

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
    /* true when the browser kept the value, false when it refused (private mode, full, blocked) */
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };

  /* data */
  var cache, liteCache, coreCache, cardCache, detailCache;
  /* G.loadEntries() is the full file (find.js). G.loadEntries(true) is the lite file: same ids and order, without the long text fields, for pages that only show a few fields. G.loadEntries("core") is the core file: same ids and order, only the keys lib.js needs to match by age, status, season and region. G.loadEntries("card") is the card file: same ids and order, only the short fields the Calendar and Numbers pages read. G.loadEntries("detail") is the detail file: same ids and order, only id plus the long text (who_can_apply, how_to_apply, notes) that the Programs page fills in after it has drawn the cards from the lite file. */
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
    if (lite === "detail") {
      if (!detailCache) {
        detailCache = fetch("data/entries-detail.json", { cache: "no-cache" }).then(checkJson);
        /* a failed load is not kept, so the next try starts a new request */
        detailCache.catch(function () { detailCache = null; });
      }
      return detailCache;
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
    var counts = L.placeCounts(entries);
    function group(label, kind, list) {
      var g = document.createElement("optgroup"); g.label = label;
      list.forEach(function (x) {
        var c = counts[kind + ":" + x[0]], o = document.createElement("option");
        o.value = kind + ":" + x[0]; o.textContent = x[1] + (c ? " (" + c + ")" : " (none yet)");
        g.appendChild(o);
      });
      sel.appendChild(g);
    }
    group("Cities", "city", L.CITIES.slice().sort(function (a, b) { return a[1] < b[1] ? -1 : 1; }));
    group("Bigger areas", "area", L.AREAS);
    if (keep) sel.value = keep;
  };
  /* Tap tiles: turn a short <select> into big buttons. The select stays in the page (hidden) and is the source of truth,
     so deep links, saved choices and tests that set its value keep working. A tile is an option, found by its position
     (several options can share a value). opts.groups = [{label, items:[optionIndex...]}] adds a first step of group tiles.
     opts.anyLabel keeps the empty option as a tile with that label. Call select._tpSync() after setting .value in code. */
  G.tilePicker = function (sel, opts) {
    opts = opts || {};
    if (!sel || sel._tp) return sel && sel._tp;
    var wrap = document.createElement("div"); wrap.className = "tp";
    var lab = sel.id && document.querySelector('label[for="' + sel.id + '"]');
    if (lab) { if (!lab.id) lab.id = sel.id + "Lbl"; wrap.setAttribute("role", "group"); wrap.setAttribute("aria-labelledby", lab.id); }
    sel.classList.add("tp-hidden"); sel.setAttribute("tabindex", "-1"); sel.setAttribute("aria-hidden", "true");
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    var open = -1;
    function mk(text, onclick) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tile"; b.textContent = text; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", onclick); return b;
    }
    function groupOf(i) { var g = opts.groups || []; for (var k = 0; k < g.length; k++) if (g[k].items.indexOf(i) > -1) return k; return -1; }
    function pick(i) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    function paint(keepOpen) {
      wrap.textContent = "";
      var tooLong = !opts.groups && sel.options.length > (opts.max || 30);
      sel.classList.toggle("tp-hidden", !tooLong); wrap.hidden = tooLong;
      if (tooLong) { sel.removeAttribute("tabindex"); sel.removeAttribute("aria-hidden"); return; }
      sel.setAttribute("tabindex", "-1"); sel.setAttribute("aria-hidden", "true");
      var cur = sel.selectedIndex, g = opts.groups || [];
      var first = document.createElement("div"); first.className = "tp-row"; wrap.appendChild(first);
      if (opts.anyLabel && sel.options.length && sel.options[0].value === "") {
        var any = mk(opts.anyLabel, function () { open = -1; pick(0); }); any.setAttribute("aria-pressed", cur === 0 ? "true" : "false"); first.appendChild(any);
      }
      if (g.length) {
        var vis = groupOf(cur); if (vis > -1 && keepOpen !== true) open = vis;
        g.forEach(function (grp, k) {
          var b = mk(grp.label, function () { open = open === k ? -1 : k; paint(true); });
          b.setAttribute("aria-pressed", open === k ? "true" : "false"); b.setAttribute("aria-expanded", open === k ? "true" : "false"); first.appendChild(b);
        });
        if (open > -1) {
          var sub = document.createElement("div"); sub.className = "tp-sub";
          var cap = document.createElement("p"); cap.className = "tp-cap"; cap.textContent = "Now pick one in " + g[open].label; sub.appendChild(cap);
          var row = document.createElement("div"); row.className = "tp-row"; sub.appendChild(row);
          g[open].items.forEach(function (i) { var b = mk(opts.labelFor ? opts.labelFor(i, sel.options[i].textContent) : sel.options[i].textContent, function () { pick(i); }); b.setAttribute("aria-pressed", cur === i ? "true" : "false"); row.appendChild(b); });
          wrap.appendChild(sub);
        }
      } else {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === "" && !(opts.anyLabel && i === 0) && (opts.skipEmpty !== false)) continue;
          if (opts.anyLabel && i === 0) continue;
          (function (i) { var b = mk(sel.options[i].textContent, function () { pick(i); }); b.setAttribute("aria-pressed", cur === i ? "true" : "false"); first.appendChild(b); })(i);
        }
      }
    }
    sel.addEventListener("change", function () { paint(); });
    sel._tpSync = function () { paint(); }; sel._tp = { paint: paint };
    /* options added later (data loaded after the page) repaint too */
    if (window.MutationObserver) new MutationObserver(function () { paint(); }).observe(sel, { childList: true });
    paint();
    return sel._tp;
  };
  /* Any <select data-tiles> becomes tap tiles. data-tiles-any="Any age" keeps the empty first option as a tile with that label. Lists longer than 30 stay a normal dropdown. */
  G.autoTiles = function () {
    Array.prototype.forEach.call(document.querySelectorAll("select[data-tiles]"), function (sel) {
      G.tilePicker(sel, sel.hasAttribute("data-tiles-any") ? { anyLabel: sel.getAttribute("data-tiles-any") } : {});
    });
  };
  G.autoTiles();
  /* code that sets a select's .value does not fire an event, so repaint every picker once the page scripts have run, and on load */
  G.syncTiles = function () { Array.prototype.forEach.call(document.querySelectorAll("select"), function (s) { if (s._tpSync) s._tpSync(); }); };
  setTimeout(G.syncTiles, 0);
  window.addEventListener("load", G.syncTiles);
  /* The Where picker: part of the country first, then its cities (and "All of ..." areas). sel must already hold the options from fillPlaces. */
  G.placeTiles = function (sel) {
    if (!L || !L.PICK_GROUPS) return;
    var at = {}; for (var i = 0; i < sel.options.length; i++) at[sel.options[i].value] = i;
    var groups = L.PICK_GROUPS.map(function (g) {
      var items = [];
      g[1].forEach(function (a) { if (at["area:" + a] != null) items.push(at["area:" + a]); });
      g[2].forEach(function (c) { if (at["city:" + c] != null) items.push(at["city:" + c]); });
      return { label: g[0], items: items };
    });
    G.tilePicker(sel, { anyLabel: "Anywhere", groups: groups, labelFor: function (i, t) { return sel.options[i].value.indexOf("area:") === 0 ? "All of " + t : t; } });
  };
  if (L) {
    G.REGIONS = L.REGIONS; G.HUBS = L.HUBS; G.TYPES = L.TYPES; G.FIELDS = L.FIELDS; G.PAID = L.PAID;
    G.esc = L.esc; G.safeUrl = L.safeUrl; G.parseISO = L.parseISO; G.fmtDate = L.fmtDate; G.daysUntil = L.daysUntil;
  }

  /* saved list shared by the Programs page and the home page */
  /* mem is the in-memory copy used only while the browser refuses to keep the list, so a star stays on until the page closes.
     G.saved.kept is false after a write the browser refused. */
  var savedMem = null;
  G.saved = {
    kept: true,
    ids: function () { return savedMem ? savedMem.slice() : G.store.get("saved", []); },
    has: function (id) { return G.saved.ids().indexOf(id) > -1; },
    toggle: function (id) {
      var a = G.saved.ids(), i = a.indexOf(id);
      if (i > -1) a.splice(i, 1); else a.push(id);
      G.saved.kept = G.store.set("saved", a);
      savedMem = G.saved.kept ? null : a.slice();
      return i === -1;
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
