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
  /* browser bar color: both theme-color metas get the shown theme's --paper, so a forced theme wins over the system setting */
  var BAR_COLOR = { light: "#efede8", dark: "#131211" };
  function syncThemeColor() {
    var want = BAR_COLOR[currentTheme()];
    if (!want) return;
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (m) { m.setAttribute("content", want); });
  }
  /* with no forced theme the media-scoped metas already follow the system, so only a forced theme needs the sync */
  if (document.documentElement.getAttribute("data-theme")) syncThemeColor();
  if (btn) {
    showThemeState();
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      showThemeState();
      syncThemeColor();
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
    function setOpen(on) { top.classList.toggle("open", on); m.setAttribute("aria-expanded", String(on)); }
    m.addEventListener("click", function () { setOpen(!top.classList.contains("open")); });
    top.addEventListener("keydown", function (e) { if (e.key === "Escape" && top.classList.contains("open")) { setOpen(false); m.focus(); } });
    /* a chosen link (an in-page hash link or a page link) closes the menu */
    nav.addEventListener("click", function (e) { var a = e.target && e.target.closest ? e.target.closest("a") : null; if (a) setOpen(false); });
    /* focus that moves outside the header (Tab past the last link, for example) closes the menu. Focus is not moved. */
    document.addEventListener("focusin", function (e) { if (top.classList.contains("open") && !top.contains(e.target)) setOpen(false); });
  })();

  Array.prototype.forEach.call(document.forms,function(f){f.addEventListener("submit",function(e){if(!f.hasAttribute("action"))e.preventDefault()})});

  /* toast */
  var toastEl = document.getElementById("toast");
  var toastTimer, toastSet;
  G.toast = function (msg) {
    if (!toastEl) return;
    /* a repeated message goes empty first, so a screen reader announces it again */
    clearTimeout(toastTimer); clearTimeout(toastSet);
    if (toastEl.textContent === msg) {
      toastEl.textContent = "";
      toastSet = setTimeout(function () { toastEl.textContent = msg; }, 30);
    } else toastEl.textContent = msg;
    toastEl.classList.add("show");
    /* long enough to read: at least 4 s, and 60 ms per character for a long message, capped at 9 s */
    var hold = Math.min(9000, Math.max(4000, 60 * String(msg).length));
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); toastEl.textContent = ""; }, hold);
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
  /* true unless the person asked for less motion: use it to pick scroll "smooth" or "auto" */
  G.motionOK = function () {
    try { return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return true; }
  };

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

  /* data: files load by versioned URL (data/x.json?v=<build hash>), the same hash this script's own src carries, so the browser reuses its copy until the next build */
  var dataVer = "";
  try { var me = (document.currentScript && document.currentScript.src) || ""; var vm = /[?&]v=([^&#]+)/.exec(me); if (vm) dataVer = vm[1]; } catch (e) {}
  G.dataUrl = function (path) { return dataVer ? path + "?v=" + dataVer : path; };
  /* no version in this script's src (dev server, a page not built by tools/build.py): ask for revalidation so a stale copy is not reused */
  G.fetchData = function (path) { return dataVer ? fetch(G.dataUrl(path)) : fetch(path, { cache: "no-cache" }); };
  var cache, liteCache, coreCache, calCache, homeCache, statsCache, detailCache;
  /* G.loadEntries() is the full file (find.js). G.loadEntries(true) is the lite file: same ids and order, without the long text fields, for pages that only show a few fields. G.loadEntries("core") is the core file: only the keys lib.js needs to match by age, status, season and region. G.loadEntries("cal") is the calendar file: the short card keys for only the programs listed in data/calendar.json. G.loadEntries("home") is the home file: only the keys the Home picker reads. G.loadEntries("stats") is the stats file: only the keys the Numbers page counts with. G.loadEntries("detail") is the detail file: only id plus the long text (who_can_apply, how_to_apply, notes) that the Programs page fills in after it has drawn the cards from the lite file. */
  function checkJson(r) {
    if (!r.ok) throw new Error("Could not load programs (" + r.status + ")");
    return r.json();
  }
  /* The shorter state answers (a small file, read only when a page needs it). Cached. A failed read is not cached. */
  var shortsP = null;
  G.stateShorts = function () {
    return shortsP || (shortsP = G.fetchData("data/states-lite.json").then(checkJson).catch(function (e) { shortsP = null; throw e; }));
  };
  /* State minimum wages (read only once a state is picked). Cached. A failed read is not cached. */
  var wagesP = null;
  G.stateWages = function () {
    return wagesP || (wagesP = G.fetchData("data/state-wages.json").then(checkJson).catch(function (e) { wagesP = null; throw e; }));
  };
  /* The wage line for one state id, built only from the fields in data/state-wages.json. "" when the state has no row. */
  G.wageLine = function (wd, id) {
    var w = wd && wd.states ? wd.states.filter(function (x) { return x.id === id; })[0] : null;
    if (!w || !w.wage) return "";
    var u = G.safeUrl(w.url), NS = "Not stated on the page we read.";
    /* Set by hand in data/state-wages.json (below_federal: true) when the base rate is under $7.25. Not guessed from the text. */
    var low = w.below_federal === true;
    var tbl = /^Table updated\s*/.test(w.effective || "") ? " Source table dated " + G.esc(w.effective.replace(/^Table updated\s*/, "").replace(/\.$/, "")) + "." : "";
    /* A youth rate sourced from the federal fact sheet (youth_url, set by hand) is shown with that link, not the state page. */
    var fu = G.safeUrl(w.youth_url);
    var fed = fu && w.youth_quote ? ' Federal fact sheet: <a href="' + G.esc(fu) + '" target="_blank" rel="noopener">U.S. Department of Labor youth minimum wage fact sheet</a>.' : "";
    return '<p class="stateWage"><b>State minimum wage:</b> ' + G.esc(w.wage) + (w.youth && w.youth !== NS ? " " + G.esc(w.youth) : "") + fed +
      (low ? " Employers covered by federal law pay the federal rate instead." : "") +
      " Source: " + (u ? '<a href="' + G.esc(u) + '" target="_blank" rel="noopener">' + G.esc(w.page_title) + "</a>" : G.esc(w.page_title)) + "." + tbl + " Some cities may set a higher rate. Check your city.</p>";
  };
  G.loadEntries = function (lite) {
    if (lite === "core") {
      if (!coreCache) coreCache = G.fetchData("data/entries-core.json").then(checkJson);
      return coreCache;
    }
    if (lite === "stats") {
      if (!statsCache) statsCache = G.fetchData("data/entries-stats.json").then(checkJson);
      return statsCache;
    }
    if (lite === "home") {
      if (!homeCache) homeCache = G.fetchData("data/entries-home.json").then(checkJson);
      return homeCache;
    }
    if (lite === "cal") {
      if (!calCache) calCache = G.fetchData("data/entries-cal.json").then(checkJson);
      return calCache;
    }
    if (lite === "detail") {
      if (!detailCache) {
        detailCache = G.fetchData("data/entries-detail.json").then(checkJson);
        /* a failed load is not kept, so the next try starts a new request */
        detailCache.catch(function () { detailCache = null; });
      }
      return detailCache;
    }
    if (lite) {
      if (!liteCache) liteCache = G.fetchData("data/entries-lite.json").then(checkJson);
      return liteCache;
    }
    if (!cache) cache = G.fetchData("data/entries.json").then(checkJson);
    return cache;
  };

  /* G.loadProgram(id) is one program's own small file (data/programs/<id>.json, about 2 KB). The Home picker uses it for its four cards. A failed load is not kept. */
  var programCache = {};
  G.loadProgram = function (id) {
    if (!programCache[id]) {
      programCache[id] = G.fetchData("data/programs/" + encodeURIComponent(id) + ".json").then(checkJson);
      programCache[id].catch(function () { delete programCache[id]; });
    }
    return programCache[id];
  };

  /* labels and helpers come from lib.js (pure functions, unit tested) */
  var L = G.lib || null; /* pages with no script of their own do not load lib.js */
  /* Fill a select with every city and area, each with how many programs it has. A city with none says so, so nobody thinks it is broken. */
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
    group("Whole states", "state", L.STATES.map(function (x) { return [x[0], "All of " + x[1]]; }));
    if (keep) sel.value = keep;
  };
  /* Tap tiles: turn a short <select> into big buttons. The select stays in the page (hidden) and is the source of truth,
     so deep links, saved choices and tests that set its value keep working. A tile is an option, found by its position
     (several options can share a value). opts.groups = [{label, items:[optionIndex...]}] adds a first step of group tiles.
     opts.anyLabel keeps the empty option as a tile with that label. Call select._tpSync() after setting .value in code. */
  G.tilePicker = function (sel, opts) {
    opts = opts || {};
    if (!sel || sel._tp) return sel && sel._tp;
    /* data-pre: tiles shipped by tools/build.py, adopted so the picker keeps its space until its options arrive */
    var pre = sel.nextElementSibling, wrap = pre && pre.hasAttribute("data-pre") ? pre : document.createElement("div"); wrap.className = "tp";
    var lab = sel.id && document.querySelector('label[for="' + sel.id + '"]');
    if (lab) { if (!lab.id) lab.id = sel.id + "Lbl"; wrap.setAttribute("role", "group"); wrap.setAttribute("aria-labelledby", lab.id); }
    sel.classList.add("tp-hidden"); sel.setAttribute("tabindex", "-1"); sel.setAttribute("aria-hidden", "true");
    sel.parentNode.insertBefore(wrap, sel.nextSibling);
    var open = -1;
    var tpBase = "tp" + (G._tpN = (G._tpN || 0) + 1);
    function subId(k) { return (sel.id || tpBase) + "-sub" + k; }
    function mk(text, onclick, lang) {
      var b = document.createElement("button"); b.type = "button"; b.className = "tile"; b.setAttribute("aria-pressed", "false");
      /* An option with a lang keeps it: "Native (English)" puts the lang on a span around the native part only. */
      var m = lang && /^(.*?)( \([^()]*\))$/.exec(text), sp = lang && document.createElement("span");
      if (sp) { sp.setAttribute("lang", lang); sp.textContent = m ? m[1] : text; b.appendChild(sp); if (m) b.appendChild(document.createTextNode(m[2])); }
      else b.textContent = text;
      b.addEventListener("click", onclick); return b;
    }
    function groupOf(i) { var g = opts.groups || []; for (var k = 0; k < g.length; k++) if (g[k].items.indexOf(i) > -1) return k; return -1; }
    function pick(i) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    function paint(keepOpen) {
      /* remember a focused tile so focus can return to the matching new tile after the rebuild */
      var fa = document.activeElement, fText = null, fIdx = -1;
      if (fa && fa !== wrap && wrap.contains(fa) && fa.classList && fa.classList.contains("tile")) {
        fText = fa.textContent; fIdx = Array.prototype.indexOf.call(wrap.querySelectorAll(".tile"), fa);
      }
      paintTiles(keepOpen);
      if (fText !== null) {
        var nb = wrap.querySelectorAll(".tile"), hit = nb[fIdx] && nb[fIdx].textContent === fText ? nb[fIdx] : null;
        if (!hit) for (var n = 0; n < nb.length; n++) if (nb[n].textContent === fText) { hit = nb[n]; break; }
        if (hit) hit.focus();
      }
    }
    function paintTiles(keepOpen) {
      if (wrap.hasAttribute("data-pre")) { if (sel.options.length < 2) return; wrap.removeAttribute("data-pre"); wrap.removeAttribute("aria-hidden"); }
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
          b.removeAttribute("aria-pressed"); b.setAttribute("aria-expanded", open === k ? "true" : "false"); b.setAttribute("aria-controls", subId(k)); first.appendChild(b);
        });
        /* Every group has its own sub row so aria-controls always points at a real id; closed ones are hidden. */
        g.forEach(function (grp, k) {
          var sub = document.createElement("div"); sub.className = "tp-sub"; sub.id = subId(k); sub.hidden = open !== k;
          var cap = document.createElement("p"); cap.className = "tp-cap"; cap.textContent = "Now pick one in " + grp.label; sub.appendChild(cap);
          var row = document.createElement("div"); row.className = "tp-row"; sub.appendChild(row);
          grp.items.forEach(function (i) { var b = mk(opts.labelFor ? opts.labelFor(i, sel.options[i].textContent) : sel.options[i].textContent, function () { pick(i); }, sel.options[i].getAttribute("lang")); b.setAttribute("aria-pressed", cur === i ? "true" : "false"); row.appendChild(b); });
          wrap.appendChild(sub);
        });
      } else {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === "" && !(opts.anyLabel && i === 0) && (opts.skipEmpty !== false)) continue;
          if (opts.anyLabel && i === 0) continue;
          (function (i) { var b = mk(sel.options[i].textContent, function () { pick(i); }, sel.options[i].getAttribute("lang")); b.setAttribute("aria-pressed", cur === i ? "true" : "false"); first.appendChild(b); })(i);
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
  /* "Send to a parent": <p class="share-parent" data-share="short sentence"> gets a text-message link and a copy button. The link is built when it is clicked,
     from the page address as it is then (so it carries the state, age or city already picked). Nothing is sent by us; the teen's own messages app opens. */
  G.shareToParent = function () {
    Array.prototype.forEach.call(document.querySelectorAll(".share-parent[data-share]"), function (box) {
      if (box._done) return; box._done = true;
      var say = box.getAttribute("data-share");
      function body() { return say + " " + location.href; }
      /* younger.html ships both controls (tools/build.py), so the row keeps its size; they are wired here */
      var a = box.querySelector("a.btn"), c = box.querySelector("button.btn");
      if (!a) { a = document.createElement("a"); a.className = "btn sm alt"; a.textContent = "Text this to a parent"; a.href = "sms:"; box.appendChild(a); box.appendChild(document.createTextNode(" ")); }
      if (!c) { c = document.createElement("button"); c.type = "button"; c.className = "btn sm alt"; c.textContent = "Copy link"; box.appendChild(c); }
      a.addEventListener("click", function () { a.href = L && L.smsHref ? L.smsHref(body()) : "sms:"; });
      c.addEventListener("click", function () { G.copy(location.href); });
    });
  };
  setTimeout(function () { G.shareToParent(); }, 0);
  /* Place search box (2026-10-12), shared by Home and Programs: type a city or state, pick one of up to eight matches.
     A pick sets the real Where select and fires "change". Ids come from the select: <id>Q, <id>List, <id>None, <id>Opt<n>, <id>Lbl.
     opts: placeholder, caption (caption:"" writes none), chip (a removable chip for the pick), hide (hide the select now). Returns { input, sync, failed }. */
  G.placeSearch = function (sel, opts) {
    opts = opts || {};
    if (!sel || !sel.parentNode || sel._ps) return sel && sel._ps;
    var base = sel.id, f = sel.parentNode, groupOf = null, res = [], act = -1;
    var ps = { failed: false }, lab = document.querySelector('label[for="' + base + '"]');
    if (lab && !lab.id) lab.id = base + "Lbl";
    var wrap = document.createElement("div"), cap = document.createElement("p"), chip = null;
    if (opts.hide) { sel.classList.add("tp-hidden"); sel.setAttribute("tabindex", "-1"); sel.setAttribute("aria-hidden", "true"); }
    wrap.className = "combo";
    var q = ps.input = document.createElement("input"); q.type = "text"; q.id = base + "Q"; q.placeholder = opts.placeholder || "Type your city or state";
    q.setAttribute("role", "combobox"); q.setAttribute("aria-autocomplete", "list"); q.setAttribute("aria-expanded", "false"); q.setAttribute("aria-controls", base + "List"); q.setAttribute("aria-labelledby", base + "Lbl");
    q.setAttribute("autocomplete", "off"); q.setAttribute("autocapitalize", "off"); q.setAttribute("spellcheck", "false"); q.setAttribute("enterkeyhint", "search");
    var list = document.createElement("ul"); list.id = base + "List"; list.className = "combo-list"; list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Matching places"); list.hidden = true;
    var note = document.createElement("p"); note.id = base + "None"; note.className = "small muted"; note.hidden = true;
    wrap.appendChild(q); wrap.appendChild(list); wrap.appendChild(note);
    cap.className = "small muted"; cap.textContent = opts.caption == null ? "Or pick a part of the country:" : opts.caption;
    if (opts.chip) { chip = document.createElement("div"); chip.className = "chips"; chip.hidden = true; f.insertBefore(chip, sel); }
    f.insertBefore(wrap, sel); if (cap.textContent) f.insertBefore(cap, sel);
    /* A place's name as the tiles show it: no count, and an area reads "All of ..." */
    function nameOf(o) { return (o.value.indexOf("area:") === 0 ? "All of " : "") + o.textContent.replace(/\s*\((?:\d+|none yet)\)$/, ""); }
    function norm(t) { return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
    /* Which part of the country each place sits in, from the same groups the tiles use, so "midwest" finds the Midwest cities. */
    function groups() {
      if (!groupOf) {
        groupOf = {};
        ((L && L.PICK_GROUPS) || []).forEach(function (g) {
          g[1].forEach(function (a) { groupOf["area:" + a] = g[0]; }); (g[3] || []).forEach(function (a) { groupOf["state:" + a] = g[0]; }); g[2].forEach(function (c) { groupOf["city:" + c] = g[0]; });
        });
      }
      return groupOf;
    }
    /* A town inside a bigger choice ("Fremont" finds Silicon Valley and San Jose): a town name starts with what was typed. */
    function aliasHit(v, t) {
      return ((L && L.PLACE_ALIASES) || []).some(function (a) { return a[0] === v && a[1].some(function (n) { return norm(n).indexOf(t) === 0; }); });
    }
    /* Matches for what was typed: the name starts with it, a word starts with it, it is inside the name, then the country part. Best eight. */
    function findPlaces(t) {
      t = norm(t); if (!t) return [];
      var out = [], seen = {};
      for (var i = 1; i < sel.options.length; i++) {
        var o = sel.options[i], nm = norm(o.textContent.replace(/\s*\((?:\d+|none yet)\)$/, "")), s = nm.indexOf(t) === 0 ? 0 : (" " + nm).indexOf(" " + t) > -1 ? 1 : nm.indexOf(t) > -1 ? 2 : aliasHit(o.value, t) ? 1 : norm(groups()[o.value] || "").indexOf(t) > -1 ? 3 : -1;
        if (s < 0) continue;
        var k = nameOf(o); /* the area and the state "All of Texas" read the same: show the state */
        if (seen[k] != null) { if (o.value.indexOf("state:") === 0) out[seen[k]] = { i: i, s: s }; continue; }
        seen[k] = out.length; out.push({ i: i, s: s });
      }
      return out.sort(function (a, b) { return a.s - b.s || a.i - b.i; }).slice(0, 8);
    }
    function setPlace(i) { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    function openList(on) {
      list.hidden = !on; q.setAttribute("aria-expanded", on ? "true" : "false");
      if (!on || act < 0) q.removeAttribute("aria-activedescendant"); else q.setAttribute("aria-activedescendant", base + "Opt" + act);
    }
    function showAct(n) {
      act = n;
      Array.prototype.forEach.call(list.children, function (li, k) { li.setAttribute("aria-selected", k === n ? "true" : "false"); });
      openList(true);
    }
    function typed() {
      var t = q.value.trim(); res = findPlaces(t); act = res.length ? 0 : -1;
      list.textContent = "";
      res.forEach(function (r, k) {
        var o = sel.options[r.i], c = /\((\d+|none yet)\)$/.exec(o.textContent), li = document.createElement("li");
        li.id = base + "Opt" + k; li.className = "combo-opt"; li.setAttribute("role", "option");
        li.appendChild(document.createTextNode(nameOf(o)));
        var n = document.createElement("span"); n.className = "n"; n.textContent = c ? (/^\d/.test(c[1]) ? c[1] + (c[1] === "1" ? " program" : " programs") : c[1]) : ""; li.appendChild(n);
        li.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
        li.addEventListener("click", function () { setPlace(r.i); });
        list.appendChild(li);
      });
      note.textContent = !t || res.length ? "" : sel.options.length < 2 ? (ps.failed ? "The places could not load. Use the Programs page instead." : "The places are still loading. Try again in a moment.") : "No place called “" + t + "”. Try a state, or pick a part of the country below.";
      note.hidden = !note.textContent;
      if (note.hidden) q.removeAttribute("aria-describedby"); else q.setAttribute("aria-describedby", base + "None");
      if (res.length) showAct(0); else openList(false);
    }
    /* The chosen place shows as a chip (when asked for); tapping it clears the place back to Anywhere. A pick empties the box. */
    ps.sync = function () {
      var o = sel.value ? sel.options[sel.selectedIndex] : null;
      if (chip) {
        chip.hidden = !o; chip.textContent = "";
        if (o) {
          var b = document.createElement("button"), x = document.createElement("span"), sr = document.createElement("span");
          b.type = "button"; b.className = "chip clear"; b.appendChild(document.createTextNode(nameOf(o) + " "));
          x.setAttribute("aria-hidden", "true"); x.textContent = "×"; sr.className = "sr"; sr.textContent = " clear"; b.appendChild(x); b.appendChild(sr);
          b.addEventListener("click", function () { setPlace(0); q.focus(); });
          chip.appendChild(b);
        }
      }
      if (o) { q.value = ""; res = []; openList(false); }
    };
    q.addEventListener("input", typed);
    q.addEventListener("focus", function () { if (q.value.trim()) typed(); });
    q.addEventListener("blur", function () { openList(false); });
    q.addEventListener("keydown", function (ev) {
      var k = ev.key, open = !list.hidden;
      if (k === "ArrowDown" || k === "ArrowUp") {
        ev.preventDefault();
        if (!open) { typed(); return; }
        showAct((act + (k === "ArrowDown" ? 1 : res.length - 1)) % res.length);
      } else if (k === "Enter") { ev.preventDefault(); if (open && act > -1) setPlace(res[act].i); }
      else if (k === "Escape") { if (open) { ev.preventDefault(); openList(false); } else q.value = ""; }
    });
    sel.addEventListener("change", ps.sync);
    if (lab) lab.addEventListener("click", function (ev) { ev.preventDefault(); q.focus(); });
    sel._ps = ps;
    return ps;
  };
  /* The Where picker: part of the country first, then its cities (and "All of ..." areas). sel must already hold the options from fillPlaces. */
  G.placeTiles = function (sel, opts) {
    if (!L || !L.PICK_GROUPS) return;
    var at = {}; for (var i = 0; i < sel.options.length; i++) at[sel.options[i].value] = i;
    var groups = L.PICK_GROUPS.map(function (g) {
      var items = [];
      g[1].forEach(function (a) { if (at["area:" + a] != null) items.push(at["area:" + a]); });
      (g[3] || []).forEach(function (a) { if (at["state:" + a] != null) items.push(at["state:" + a]); });
      g[2].forEach(function (c) { if (at["city:" + c] != null) items.push(at["city:" + c]); });
      return { label: g[0], items: items };
    });
    G.tilePicker(sel, { anyLabel: (opts && opts.anyLabel) || "Anywhere", groups: groups, labelFor: function (i, t) { return sel.options[i].value.indexOf("area:") === 0 ? "All of " + t : t; } });
    /* code that sets the place (a saved choice, a link) repaints the search box and its chip too */
    if (sel._ps && !sel._ps.hooked) { var tps = sel._tpSync; sel._ps.hooked = true; sel._tpSync = function () { tps(); sel._ps.sync(); }; }
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
  /* Warn which links open a new tab or a PDF. Every a[target=_blank] gets "(opens in a new tab)" in its name,
     and every link whose path ends in .pdf (query and hash ignored) gets "PDF" in its name. The note is appended
     to aria-label when the link has one, otherwise added as a visually hidden .sr span. Safe to run again. */
  var NEWTAB = /opens in a new tab/i, PDFNAME = /PDF/;
  function isPdfLink(a) {
    try { return /\.pdf$/i.test(new URL(a.href).pathname); } catch (e) { return false; }
  }
  function addNote(a, text, has, attr) {
    var name = a.getAttribute("aria-label");
    if (name) {
      if (!has.test(name)) a.setAttribute("aria-label", name + ", " + text);
    } else if (!a.querySelector("span.sr[" + attr + "]") && !has.test(a.textContent)) {
      var m = document.createElement("span");
      m.className = "sr"; m.setAttribute(attr, "");
      m.textContent = " (" + text + ")";
      a.appendChild(m);
    }
  }
  function markLink(a) {
    if (isPdfLink(a)) addNote(a, "PDF", PDFNAME, "data-pdfnote");
    if (a.getAttribute("target") === "_blank") addNote(a, "opens in a new tab", NEWTAB, "data-newtab");
  }
  G.markNewTabLinks = function (root) {
    var links = (root || document).querySelectorAll('a[target="_blank"], a[href]');
    for (var i = 0; i < links.length; i++) markLink(links[i]);
  };
  /* The observer only looks at nodes that were added, never the whole page, so our own note costs nothing. */
  function markAdded(records) {
    var seen = [];
    for (var r = 0; r < records.length; r++) {
      var added = records[r].addedNodes;
      for (var n = 0; n < added.length; n++) {
        var node = added[n];
        if (node.nodeType !== 1) continue;
        if (node.tagName === "A") { if (seen.indexOf(node) < 0) seen.push(node); continue; }
        var inner = node.querySelectorAll ? node.querySelectorAll("a[href], a[target]") : [];
        for (var k = 0; k < inner.length; k++) if (seen.indexOf(inner[k]) < 0) seen.push(inner[k]);
      }
    }
    for (var i = 0; i < seen.length; i++) markLink(seen[i]);
  }
  (function () {
    var main = document.querySelector("main");
    G.markNewTabLinks(document);
    if (!main || !window.MutationObserver || G.newTabObserver) return;
    G.newTabObserver = new MutationObserver(markAdded);
    G.newTabObserver.observe(main, { childList: true, subtree: true });
  })();
})();
