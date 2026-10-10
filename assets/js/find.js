/* Programs page: filters, sorting, deadline view, saved list.
   Cards are drawn from the lite file. The long text (who can apply, how to apply, good to know) comes from the detail file,
   which starts loading on the first of: a card opened, a search typed, a #p- link, a print, or an idle prefetch 3 seconds after the first draw. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var all = [], byId = {};
  /* detail file state: idle, wait (loading), ready (merged into the entries) or fail */
  var detailState = "idle", lastKey = "";
  var state = { q: "", hubs: [], place: "", age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false, view: "cards", sort: "best", saved: false };

  var L = G.lib, PAID_GROUPS = L.PAID_GROUPS;
  function now() { return Date.now(); }
  var hubOf = L.hubsOf;
  function cmp(a, b) { return L.compare(a, b, now()); }
  function futureDeadline(e) { return L.futureDeadline(e, now()); }
  function knownDeadline(e) { return L.knownDeadline(e, now()); }
    function anytime(e) { return L.isAnytime(e, now()); }
  function isOpenish(e) { return L.isOpenish(e, now()); }
  function statusTag(e) {
    var st = L.effStatus(e, now());
    if (st === "open-now") return '<span class="tag good">Open now</span>';
    if (st === "opens-soon") return '<span class="tag y">Opens soon</span>';
    if (st === "rolling") return '<span class="tag good">Apply anytime</span>';
    if (st === "year-round") return '<span class="tag good">Year-round</span>';
    if (st === "event") return '<span class="tag y">Event</span>';
    if (st === "closed-expect-reopen") return '<span class="tag ghost">Closed, check back</span>';
    return '<span class="tag ghost">Dates unconfirmed</span>';
  }
  function deadlineLine(e) {
    var d = futureDeadline(e), extra = "";
    if (d) {
      var n = G.daysUntil(d);
      extra = n === 0 ? " (today)" : n <= 45 ? " (" + n + " days)" : "";
    }
    var conf = e.deadline_confidence === "last-year-pattern" ? ' <span class="tag warn">Based on last year</span>' : "";
    return '<p class="when"><b>Dates</b>' + G.esc(e.deadline_text || "Not posted") + G.esc(extra) + conf + "</p>";
  }
  function ageText(e) { return L.ageText(e); }
  function paidTag(e) {
    var t = G.PAID[e.paid_type] || "";
    var cls = e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : e.paid_type === "fee-based" ? "warn" : "ghost";
    return t ? '<span class="tag ' + cls + '">' + G.esc(t) + "</span>" : "";
  }

  /* The inside of a card's <dl>. Before the detail file arrives it holds a short note in place of the long text. */
  function detailMode() { return detailState === "ready" || detailState === "fail" ? detailState : "wait"; }
  function detailBody(e) {
    var html = "", mode = detailMode(), ready = mode === "ready";
    if (!ready) {
      html += mode === "fail"
        ? "<div><dt>Details</dt><dd>Could not load these details. Check your connection, then close and open this card to try again.</dd></div>"
        : "<div><dt>Details</dt><dd>Loading details</dd></div>";
    }
    if (ready && e.who_can_apply) html += "<div><dt>Who can apply</dt><dd>" + G.esc(e.who_can_apply) + "</dd></div>";
    if (ready && e.how_to_apply) html += "<div><dt>How to apply</dt><dd>" + G.esc(e.how_to_apply) + "</dd></div>";
    if (e.duration) html += "<div><dt>How long</dt><dd>" + G.esc(e.duration) + "</dd></div>";
    if (e.needs_work_permit === true) {
      var st = L.stateOf(e);
      var permit = { ca: "Paid work under 18 needs a California work permit. See the <a href=\"rules.html\">Rules page</a>.",
        ga: "Georgia requires a work permit for paid work under 16. See <a href=\"states.html#georgia\">the Georgia rules</a>.",
        ny: "New York requires working papers for ages 14 to 17. See <a href=\"states.html#newyork\">the New York rules</a>.",
        il: "Illinois requires an employment certificate for paid work under 16. See <a href=\"states.html#illinois\">the Illinois rules</a>." }[st] ||
        "Teens often need a work permit for paid work. The rules depend on your state: see <a href=\"rules.html\">California</a> or <a href=\"states.html\">other states</a>.";
      var pk = (e.paid_type === "paid" || e.paid_type === "stipend" || e.paid_type === "mixed") && e.type === "paid-youth-program" ? "program" : "job";
      permit += st && L.PERMIT_STATES.indexOf(st) > -1 ? ' <a href="permit.html?state=' + st + "&kind=" + pk + '">Find your exact permit and steps</a>.' : ' <a href="permit.html">Find your permit</a>.';
      html += "<div><dt>Work permit</dt><dd>" + permit + "</dd></div>";
    }
    if (ready && e.notes) html += "<div><dt>Good to know</dt><dd>" + G.esc(e.notes) + "</dd></div>";
    return html;
  }

  /* While render() builds cards it sets savedNow to a lookup of the saved ids it already read once, so each card does not read localStorage again. */
  var savedNow = null;
  /* Saved ids that match a program in the loaded data. The count and the My list view use only these. An id the data no longer has (a renamed program) stays in storage untouched, so it comes back if the program returns. */
  function savedIds() {
    return G.saved.ids().filter(function (id) { return typeof id === "string" && Object.prototype.hasOwnProperty.call(byId, id); });
  }
  function cardsHtml(items, sv) {
    savedNow = {};
    sv.forEach(function (id) { savedNow[id] = true; });
    try { return items.map(card).join(""); } finally { savedNow = null; }
  }
  function card(e) {
    var saved = savedNow ? savedNow[e.id] === true : G.saved.has(e.id);
    var u = G.safeUrl(e.url), a = G.safeUrl(e.apply_url);
    var vtag = e.verified === "fetched"
      ? '<span class="tag good">Read on official site</span>'
      : '<span class="tag warn">Confirm first</span>';
    var hubs = (e.regions || []).map(function (r) { var f = G.REGIONS.filter(function (x) { return x[0] === r; })[0]; return f ? f[1] : ""; }).filter(Boolean);
    var html = '<article class="card prog" tabindex="-1" id="p-' + G.esc(e.id) + '">';
    html += '<div class="row">' + statusTag(e) + paidTag(e) + '<span class="tag ghost">' + G.esc(G.TYPES[e.type] || e.type) + "</span></div>";
    html += "<h3>" + G.esc(e.name) + "</h3>";
    html += '<p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p>";
    html += '<p class="what">' + G.esc(e.what_you_do || "") + "</p>";
    html += '<div class="row"><span class="tag ghost">' + G.esc(ageText(e)) + "</span></div>";
    if (e.pay_detail) html += '<p class="pay"><b>Pay or cost:</b> ' + G.esc(e.pay_detail) + "</p>";
    html += deadlineLine(e);
    html += "<details><summary>Who can apply and how</summary><dl" + (detailMode() === "ready" ? "" : ' data-detail="' + detailMode() + '"') + ">" + detailBody(e);
    html += "</dl></details>";
    html += '<div class="actions">';
    if (u) html += '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name + (e.org ? ", " + e.org : "")) + '">Official page</a>';
    if (a && a !== u) html += '<a class="btn sm alt" href="' + G.esc(a) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Apply to " + e.name + (e.org ? ", " + e.org : "")) + '">Apply</a>';
    if (knownDeadline(e)) html += '<button class="btn sm alt noprint" type="button" data-cal="' + G.esc(e.id) + '" aria-label="' + G.esc("Add deadline to calendar for " + e.name) + '">Add deadline to calendar</button>';
    html += '<button class="star noprint" type="button" data-id="' + G.esc(e.id) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? "Remove " + G.esc(e.name) + " from my list" : "Save " + G.esc(e.name) + " to my list") + '" title="Save to my list">&#9733;</button>';
    html += "</div>";
    html += '<p class="checked">' + vtag + " Checked " + G.esc(e.verified_on_label || "Oct 7, 2026") + "</p>";
    html += "</article>";
    return html;
  }

  function renderDates(list, sv) {
    var box = $("dates");
    var withD = list.filter(knownDeadline).sort(function (a, b) { return knownDeadline(a) - knownDeadline(b) || cmp(a, b); });
    var months = {}, order = [];
    withD.forEach(function (e) {
      var d = knownDeadline(e), k = d.getFullYear() * 100 + d.getMonth();
      if (!months[k]) { months[k] = []; order.push(k); }
      months[k].push(e);
    });
    var names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var html = "";
    order.forEach(function (k) {
      var y = Math.floor(k / 100), m = k % 100;
      html += '<div class="month"><h3>' + names[m] + " " + y + "</h3><ul class=\"tl\">";
      months[k].forEach(function (e) {
        var d = knownDeadline(e), own = futureDeadline(e) ? "" : " " + statusTag(e);
        html += '<li><div class="d">' + names[m].slice(0, 3) + " " + d.getDate() + "<small>closes</small></div><div><b>" + G.esc(e.name) + "</b> " + paidTag(e) + own +
          '<br><span class="small muted">' + G.esc(e.org || "") + " &middot; " + G.esc(ageText(e)) + "</span>" +
          (e.deadline_confidence === "last-year-pattern" ? ' <span class="tag warn">Based on last year</span>' : "") +
          '<br><a href="#p-' + G.esc(e.id) + '" data-jump="' + G.esc(e.id) + '" aria-label="' + G.esc("See card for " + e.name) + '">See card</a>' +
          (G.safeUrl(e.url) ? ' &middot; <a href="' + G.esc(G.safeUrl(e.url)) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name) + '">Official page</a>' : "") + "</div></li>";
      });
      html += "</ul></div>";
    });
    var open = list.filter(function (e) { return !knownDeadline(e) && (anytime(e) || isOpenish(e)); });
    if (open.length) {
      html += '<div class="month"><h3>Apply anytime or no fixed date</h3><ul class="tl">';
      open.slice(0, 80).forEach(function (e) {
        html += '<li><div class="d">Open<small>anytime</small></div><div><b>' + G.esc(e.name) + "</b> " + paidTag(e) + '<br><span class="small muted">' + G.esc(e.deadline_text || "") + "</span> " +
          (G.safeUrl(e.url) ? '<a href="' + G.esc(G.safeUrl(e.url)) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name) + '">Official page</a>' : "") + "</div></li>";
      });
      html += "</ul></div>";
    }
    box.innerHTML = html || '<div class="card empty"><h3>No upcoming deadlines match</h3>' + (list.length ? "" : relaxHtml(sv)) + "<p>Clear a filter or switch to Cards.</p></div>";
  }

  /* known gaps for the areas you are looking at, each linked to its issue */
  var gaps = [];
  function paintGaps() {
    var box = $("gaps"); if (!box) return;
    var hubsNow = state.hubs.length ? state.hubs : state.place ? L.hubsOfPlace(state.place) : [];
    var mine = hubsNow.length ? gaps.filter(function (g) { return g.hubs.some(function (h) { return hubsNow.indexOf(h) > -1; }); }) : [];
    if (!mine.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = "<h2 style=\"font-size:1.1rem;\">Known gaps in this area</h2><ul>" + mine.map(function (g) {
      return "<li><b>" + G.esc(g.title) + ".</b> " + G.esc(g.text) + ' <a href="https://github.com/VadneyK/internships/issues/' + g.issue + '">Issue ' + g.issue + "</a></li>";
    }).join("") + "</ul>";
  }
  fetch("data/gaps.json").then(function (r) { return r.json(); }).then(function (g) { gaps = g; paintGaps(); }).catch(function () {});

  function paintPlaceNote(realN) {
    var box = $("placeNote"); if (!box) return;
    if (!state.place) { box.hidden = true; box.innerHTML = ""; return; }
    var name = G.esc(L.placeLabel(state.place));
    box.hidden = false;
    var caNote = (L.placeRegions(state.place) || []).indexOf("statewide") > -1 ? " Counts include California-wide programs." : "";
    box.innerHTML = realN === 0
      ? "<b>We have not found programs in " + name + " yet.</b> Showing online and national programs you can do from anywhere. <a href=\"contribute.html\">Know one? Help add it.</a>"
      : realN < 3
        ? "<b>Only " + realN + " program" + (realN === 1 ? "" : "s") + " found in " + name + " so far,</b> so online and national programs are included too. <a href=\"contribute.html\">Know another? Help add it.</a>"
        : "Showing programs in <b>" + name + "</b>." + caNote;
  }

  /* "Good fit for you": the best three for the chosen age and area only. Other filters and the search do not change it. */
  var PICKS_N = 3, picksKey = null;
  function picksEntries(t) {
    var s = { age: state.age, place: state.place };
    var found = all.filter(function (e) { return L.matches(e, s, t); });
    if (state.place && found.length < 3) { s.placeOnline = true; found = all.filter(function (e) { return L.matches(e, s, t); }); }
    return L.topPicks(found, { age: state.age }, t, PICKS_N);
  }
  function paintPicks() {
    var box = $("picks"), nudge = $("picksNudge"), ol = $("picksList"); if (!box || !ol) return;
    var chosen = !!(state.age || state.place);
    if (nudge) nudge.hidden = chosen;
    var t = now(), key = JSON.stringify([state.age, state.place, new Date(t).toDateString()]);
    var picks = chosen ? picksEntries(t) : [];
    box.hidden = !picks.length;
    if (!picks.length) { picksKey = null; ol.innerHTML = ""; return; }
    if (key === picksKey) return;
    picksKey = key;
    ol.innerHTML = picks.map(function (e) {
      return '<li><b>' + G.esc(e.name) + '</b> ' + statusTag(e) + paidTag(e) +
        '<br><span class="small muted">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</span>" +
        '<br><span class="small">' + "Dates: " + G.esc(e.deadline_text || "Not posted") + "</span>" +
        ' &middot; <a href="#p-' + G.esc(e.id) + '" data-jump="' + G.esc(e.id) + '" aria-label="' + G.esc("See card for " + e.name) + '">See card</a></li>';
    }).join("");
  }

  /* Empty-state help: name the filters that cause the dead end and offer to turn off one of them.
     relaxHtml gives the lead line and the buttons (empty text when there is nothing to say). Clicks are handled in the document click listener. */
  function btnRow(inner) { return '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem;margin:.75rem 0">' + inner + "</div>"; }
  function relaxHtml(sv) {
    var active = state.q || state.age || state.when || state.season || state.paid.length || state.types.length || state.fields.length ||
      state.verified || state.noPermit || state.hubs.length || state.place;
    if (!active || (state.saved && !sv.length)) return "";
    var opts = L.relaxOptions(all, Object.assign({}, state, { savedIds: sv }), now()), n = sv.length, lead, btns = "";
    if (state.saved) {
      lead = n === 1 ? "Your saved program does not match these filters." : "None of your " + n + " saved programs match these filters.";
      btns += '<button class="btn alt sm" type="button" data-relax-saved="1">Turn the other filters off</button>';
    } else lead = "Nothing matches all of these.";
    opts.forEach(function (o) {
      btns += '<button class="btn alt sm" type="button" data-relax="' + G.esc(o.key) + '">' + G.esc(o.label) + " (" + o.count + (o.count === 1 ? " program)" : " programs)") + "</button>";
    });
    return "<p>" + lead + "</p>" + btnRow(btns);
  }
  /* Turn off one filter: the state, the control's value and the chips. */
  function clearOne(key) {
    clearTimeout(qt);
    if (key === "q") { state.q = ""; $("q").value = ""; }
    else if (key === "age" || key === "when" || key === "season") { state[key] = ""; $(key).value = ""; if (key === "age") { savePrefs(); hidePrefNote(); } }
    else if (key === "paid" || key === "types" || key === "fields" || key === "hubs") state[key] = [];
    else if (key === "verified" || key === "noPermit") state[key] = false;
    else if (key === "place") { state.place = ""; savePrefs(); hidePrefNote(); }
    syncChips(); render(true); focusFirst();
  }
  function focusFirst() {
    var first = state.view === "dates" ? $("dates").querySelector("a, button") : $("out").querySelector("article.prog");
    (first || $("q")).focus();
  }

  /* One plain line under the count that says how the list is ordered. The wording follows sortList and rank in lib.js.
     "best" is the default, and any sort value that is not "deadline" or "name" sorts as best. The age sentence shows only for a real age
     from the age list, and only for "best", because age fit is a tie-break inside that order. */
  var SORT_NOTE_HEAD = "Ordered by: open programs due within 3 weeks first, then other open programs with a deadline, then open programs with no deadline, then the rest. Inside each group, paid, stipend or mixed comes first, then unpaid or pay not stated, then programs that cost money.";
  function sortNoteText() {
    if (state.sort === "name") return "Ordered by: A to Z.";
    if (state.sort === "deadline") return "Ordered by: soonest deadline first, then everything else.";
    if (state.age && PREF_AGES.indexOf(state.age) > -1) {
      return SORT_NOTE_HEAD + " Then programs that state an age range that fits age " + state.age + ", then the nearest deadline.";
    }
    return SORT_NOTE_HEAD + " Then the nearest deadline.";
  }
  /* Creates p#sortNote once, right after the toolbar that holds #count, then sets its text. */
  function paintSortNote() {
    var note = $("sortNote");
    if (!note) {
      var count = $("count"), bar = count && count.parentNode;
      if (!bar || !bar.parentNode) return;
      note = document.createElement("p");
      note.id = "sortNote";
      note.className = "small muted";
      bar.parentNode.insertBefore(note, bar.nextSibling);
    }
    note.textContent = sortNoteText();
  }

  var PAGE = 60, shown = PAGE;
  /* render() rebuilds #out, which deletes the focused control. "keep" says where focus goes next:
     { cardIndex: n } focuses the card at list position n, { starId: id } focuses that card's star,
     { el: element } focuses that element. */
  /* The last filtered and sorted list. The key is the filter state, today's date and, when only the saved list is shown, the saved ids (they change what matches only then) (plus the detail-file state while a search
     is typed, because the long text is part of what a search reads). The view and the page size are not in it, so Show more, a "See card" jump
     and the Cards/Dates switch reuse the list instead of filtering and sorting again. */
  var cache = null;
  function listCacheKey(sv, t) {
    return JSON.stringify([state.q, state.hubs, state.place, state.age, state.when, state.season, state.paid, state.types, state.fields,
      state.verified, state.noPermit, state.sort, state.saved, state.saved ? sv : null, new Date(t).toDateString(), state.q ? detailMode() : ""]);
  }
  /* sv is the saved ids, read once by the caller */
  function currentList(sv) {
    var t = now(), key = listCacheKey(sv, t);
    if (cache && cache.key === key) { state.savedIds = sv; state.placeOnline = cache.placeOnline; return cache; }
    state.savedIds = sv; state.placeOnline = false;
    function keep(e) { return L.matches(e, state, t); }
    var found = all.filter(keep), realN = found.length;
    if (state.place && realN < 3) { state.placeOnline = true; found = all.filter(keep); }
    cache = { key: key, list: L.sortList(found, state.sort, t, { age: state.age }), realN: realN, placeOnline: state.placeOnline, idKey: null };
    return cache;
  }
  function listKey(cur) { return cur.idKey || (cur.idKey = cur.list.map(function (e) { return e.id; }).join(",")); }
  /* Show more: add the next page of cards after the ones on screen. Nothing already drawn is rebuilt, so a card the teen opened stays open. */
  function pagerHtml(list) {
    return list.length > shown ? '<div class="pager" style="grid-column:1/-1"><button class="btn alt" type="button" id="more">Show more (' + (list.length - shown) + " left)</button></div>" : "";
  }
  function showMore() {
    var from = shown, out = $("out"), sv = savedIds(), cur = currentList(sv), list = cur.list;
    shown += PAGE;
    if (state.view !== "cards" || out.querySelectorAll("article.prog").length !== from || list.length <= from) {
      render(false, { cardIndex: from });
    } else {
      var old = out.querySelector(".pager"); if (old) old.parentNode.removeChild(old);
      var slice = list.slice(from, shown);
      out.insertAdjacentHTML("beforeend", cardsHtml(slice, sv) + pagerHtml(list));
      var more = $("more"); if (more) more.onclick = showMore;
      var nc = $("p-" + slice[0].id); if (nc) nc.focus();
    }
    G.toast("Showing " + (Math.min(shown, list.length) - from) + " more programs");
  }
  function render(resetPage, keep) {
    if (resetPage) shown = PAGE;
    var sv = savedIds(), cur = currentList(sv), list = cur.list, realN = cur.realN;
    lastKey = listKey(cur);
    paintPlaceNote(realN);
    $("count").textContent = list.length + " of " + all.length + " programs";
    paintSortNote();
    $("savedN").textContent = sv.length;
    var out = $("out"), dates = $("dates");
    $("listActions").hidden = !state.saved;
    paintGaps();
    paintPicks();
    paintChipCounts(cur);
    if (state.view === "dates") {
      out.hidden = true; dates.hidden = false; renderDates(list, sv); persist(); return;
    }
    out.hidden = false; dates.hidden = true;
    if (!list.length && state.saved && !sv.length) {
      out.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Your list is empty</h3><p>Tap the star on a program card to save it here. Your list stays on this device.</p><button class="btn" type="button" id="showAll">Show all programs</button></div>';
      var sa = $("showAll");
      if (sa) sa.onclick = function () {
        state.saved = false; syncChips(); render(true);
        var first = $("out").querySelector("article.prog");
        (first || $("savedOnly")).focus();
      };
    } else if (!list.length) {
      out.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Nothing matches yet</h3>' + relaxHtml(sv) + '<p>Try a different age or area, or clear the filters. Programs near you may also appear under &ldquo;California&rdquo; or &ldquo;Online and national&rdquo;.</p>' + (state.age === "12" || state.age === "13" ? '<p>Under 14? Read the <a href="younger.html">ages 12 to 14 page</a>.</p>' : "") + (state.q && detailState !== "ready" && detailState !== "fail" ? '<p class="small muted" data-detail-wait>Still loading the full text of each program, so this list may change in a moment.</p>' : "") + '<button class="btn" type="button" id="emptyReset">Clear all filters</button></div>';
      var er = $("emptyReset"); if (er) er.onclick = function () { resetAll(); $("q").focus(); G.toast("Filters cleared"); };
    } else {
      var slice = list.slice(0, shown);
      out.innerHTML = cardsHtml(slice, sv) + pagerHtml(list);
      var more = $("more");
      if (more) more.onclick = showMore;
      if (keep && keep.cardId) {
        var kc = $("p-" + keep.cardId); if (kc) kc.focus();
      }
      if (keep && keep.cardIndex != null && slice[keep.cardIndex]) {
        var nc = $("p-" + slice[keep.cardIndex].id); if (nc) nc.focus();
      }
    }
    if (keep && keep.starId) {
      var ns = out.querySelector('.star[data-id="' + keep.starId + '"]');
      (ns || keep.el || $("savedOnly")).focus();
    } else if (keep && keep.el) keep.el.focus();
    persist();
  }

  /* chips */
  function chipGroup(id, items, key, multi) {
    var box = $(id);
    box.innerHTML = items.map(function (it) {
      return '<button class="chip" type="button" data-key="' + key + '" data-val="' + G.esc(it[0]) + '" data-label="' + G.esc(it[1]) + '" aria-pressed="false">' + G.esc(it[1]) + '<span class="n">' + (it[2] != null ? it[2] : "") + "</span></button>";
    }).join("");
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest(".chip"); if (!b) return;
      var v = b.getAttribute("data-val"), arr = state[key], i = arr.indexOf(v);
      if (i > -1) arr.splice(i, 1); else arr.push(v);
      if (key === "hubs") { state.place = ""; savePrefs(); hidePrefNote(); }
      syncChips(); render(true);
    });
  }
  /* Live counts: each chip shows how many programs match with the other filters kept and this chip chosen alone in its group.
     Computed once per filter state (it rides on the cached list). Zero-count chips get "zero" (muted, still pressable). */
  var FACET_OF = { hubs: "hubs", paid: "paid", types: "types", fields: "fields" };
  function paintChipCounts(cur) {
    if (!cur.facets) cur.facets = L.facetCounts(all, state, now());
    document.querySelectorAll(".chip[data-key]").forEach(function (b) {
      var group = FACET_OF[b.getAttribute("data-key")], tbl = group && cur.facets[group];
      var n = tbl ? tbl[b.getAttribute("data-val")] : null;
      if (typeof n !== "number" || isNaN(n)) return;
      var span = b.querySelector(".n"), label = b.getAttribute("data-label") || "";
      if (span) span.textContent = String(n);
      b.setAttribute("aria-label", label + ", " + n + (n === 1 ? " program" : " programs"));
      b.classList.toggle("zero", n === 0);
    });
  }
  function syncChips() {
    document.querySelectorAll(".chip[data-key]").forEach(function (b) {
      var arr = state[b.getAttribute("data-key")];
      b.setAttribute("aria-pressed", String(arr.indexOf(b.getAttribute("data-val")) > -1));
    });
    $("place").value = state.place || ""; ["place", "age", "when", "season"].forEach(function (id) { if ($(id)._tpSync) $(id)._tpSync(); });
    $("onlyVerified").setAttribute("aria-pressed", String(state.verified));
    $("noPermit").setAttribute("aria-pressed", String(state.noPermit));
    $("savedOnly").setAttribute("aria-pressed", String(state.saved));
    $("viewCards").setAttribute("aria-pressed", String(state.view === "cards"));
    $("viewDates").setAttribute("aria-pressed", String(state.view === "dates"));
  }
  function resetAll() { resetFilters(false); }
  /* keepSaved: turn every filter off but leave My list on */
  function resetFilters(keepSaved) {
    clearTimeout(qt);
    state = { q: "", hubs: [], place: "", age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false, view: state.view, sort: "best", saved: keepSaved === true && state.saved };
    $("q").value = ""; $("place").value = ""; $("age").value = ""; $("when").value = ""; $("season").value = ""; $("sort").value = "best";
    clearPrefs(); hidePrefNote();
    syncChips(); render(true);
  }

  /* Remember the last age and area on this device only (localStorage key "findprefs"). Applied on load only when the address has no parameters. */
  var PREF_KEY = "findprefs", PREF_AGES = ["12", "13", "14", "15", "16", "17", "18"];
  function savePrefs() {
    if (!state.age && !state.place) { clearPrefs(); return; }
    G.store.set(PREF_KEY, { age: state.age || "", place: state.place || "" });
  }
  function clearPrefs() { try { localStorage.removeItem(PREF_KEY); } catch (e) {} }
  function hidePrefNote() { var n = $("prefNote"); if (n) n.hidden = true; }
  function applyPrefs() {
    if (location.search || location.hash.indexOf("#p-") === 0) return;
    var pr = G.store.get(PREF_KEY, {}), used = false;
    if (typeof pr.age === "string" && PREF_AGES.indexOf(pr.age) > -1) { state.age = pr.age; used = true; }
    if (typeof pr.place === "string" && pr.place && L.placeRegions(pr.place)) { state.place = pr.place; state.hubs = []; used = true; }
    if (used) { var n = $("prefNote"); if (n) n.hidden = false; }
  }

  /* url state */
  function persist() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.hubs.length) p.set("where", state.hubs.join(","));
    if (state.place) p.set("at", state.place);
    if (state.age) p.set("age", state.age);
    if (state.when) p.set("when", state.when);
    if (state.season) p.set("season", state.season);
    if (state.paid.length) p.set("pay", state.paid.join(","));
    if (state.types.length) p.set("kind", state.types.join(","));
    if (state.fields.length) p.set("interest", state.fields.join(","));
    if (state.verified) p.set("checked", "1");
    if (state.noPermit) p.set("nopermit", "1");
    if (state.view === "dates") p.set("view", "dates");
    if (state.sort !== "best") p.set("sort", state.sort);
    var qs = p.toString();
    try { history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) {}
  }
  function readURL() {
    var p = new URLSearchParams(location.search);
    function list(k) { return (p.get(k) || "").split(",").filter(Boolean); }
    state.q = p.get("q") || "";
    state.hubs = list("where"); state.place = p.get("at") || ""; if (state.place && !L.placeRegions(state.place)) state.place = ""; if (state.place) state.hubs = []; state.age = p.get("age") || ""; state.when = p.get("when") || ""; state.season = p.get("season") || "";
    state.paid = list("pay"); state.types = list("kind"); state.fields = list("interest");
    state.verified = p.get("checked") === "1"; state.noPermit = p.get("nopermit") === "1";
    state.view = p.get("view") === "dates" ? "dates" : "cards"; state.sort = p.get("sort") || "best";
    applyPrefs();
    $("q").value = state.q; $("age").value = state.age; $("when").value = state.when; $("season").value = state.season; $("sort").value = state.sort;
  }

  /* Detail file: the long text. Starts on the first trigger and only once. When it arrives the rows are merged into the entries by id,
     the open cards are filled in place (no re-render, so focus and open cards stay), and the list is re-run so a search over the notes works. */
  var litePromise = G.loadEntries(true);
  function paintBodies() {
    var cards = $("out").querySelectorAll("article.prog"), mode = detailMode();
    for (var i = 0; i < cards.length; i++) {
      var dl = cards[i].querySelector("dl"), e = byId[cards[i].id.slice(2)];
      if (!dl || !e || (dl.getAttribute("data-detail") || "ready") === mode) continue;
      dl.innerHTML = detailBody(e);
      if (mode === "ready") dl.removeAttribute("data-detail"); else dl.setAttribute("data-detail", mode);
    }
    var waits = $("out").querySelectorAll("[data-detail-wait]");
    for (var j = 0; j < waits.length; j++) waits[j].parentNode.removeChild(waits[j]);
  }
  function rerunList() {
    if (!all.length) return;
    var cur = currentList(savedIds());
    /* an empty list stays empty by id, but the full text can change which filter to offer to remove, so draw the empty card again */
    var emptyAgain = !cur.list.length && !!state.q;
    if (listKey(cur) === lastKey && !emptyAgain) return;
    var a = document.activeElement, c = a && a.closest ? a.closest("article.prog") : null;
    var rk = emptyAgain && a && a.getAttribute && $("out").contains(a) ? a.getAttribute("data-relax") || a.id : "";
    render(false, c ? { cardId: c.id.slice(2) } : null);
    if (rk) {
      var again = $("out").querySelector('[data-relax="' + rk + '"]') || $(rk) || $("emptyReset");
      if (again) again.focus();
    }
  }
  function wantDetail() {
    if (detailState === "ready" || detailState === "wait") return;
    detailState = "wait"; paintBodies();
    Promise.all([litePromise, G.loadEntries("detail")]).then(function (res) {
      res[1].forEach(function (row) {
        var e = byId[row.id];
        if (e) Object.keys(row).forEach(function (k) { if (k !== "id") e[k] = row[k]; });
      });
      detailState = "ready"; paintBodies(); rerunList();
    }, function () { detailState = "fail"; paintBodies(); });
  }
  /* an idle prefetch 3 seconds after the first draw, unless the person asked to save data or the connection is slow */
  function prefetchDetail() {
    var c = navigator.connection;
    if (c && (c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || ""))) return;
    setTimeout(function () {
      if (window.requestIdleCallback) window.requestIdleCallback(wantDetail, { timeout: 2000 }); else wantDetail();
    }, 3000);
  }
  /* triggers known before the list arrives: a card link in the address, or a search in the address */
  if (location.hash.indexOf("#p-") === 0 || new URLSearchParams(location.search).get("q")) wantDetail();
  $("out").addEventListener("toggle", function (ev) { if (ev.target.open) wantDetail(); }, true);
  window.addEventListener("beforeprint", wantDetail);

  /* Test hook: the HTML of one card, so a test can compare it with a card built from the full file. */
  G.cardHtml = function (e) { return card(e); };

  litePromise.then(function (data) {
    all = data;
    all.forEach(function (e) { byId[e.id] = e; });
    var hubCounts = {}; all.forEach(function (e) { hubOf(e).forEach(function (h) { hubCounts[h] = (hubCounts[h] || 0) + 1; }); });
    var QUICK = ["davis", "sv", "oak", "sf", "state", "socal", "atl", "nyc", "chi", "online"];
    chipGroup("hubChips", G.HUBS.filter(function (h) { return hubCounts[h[0]] && QUICK.indexOf(h[0]) > -1; }).map(function (h) { return [h[0], h[1], hubCounts[h[0]]]; }), "hubs");
    G.fillPlaces($("place"), all);
    G.placeTiles($("place"));
    ["age", "when", "season"].forEach(function (id) { G.tilePicker($(id), { anyLabel: $(id).options[0].textContent }); });
    $("place").addEventListener("change", function (e) { state.place = e.target.value; if (state.place) state.hubs = []; savePrefs(); hidePrefNote(); syncChips(); render(true); });
    chipGroup("paidChips", PAID_GROUPS.map(function (g) { return [g[0], g[1]]; }), "paid");
    var tc = {}; all.forEach(function (e) { tc[e.type] = (tc[e.type] || 0) + 1; });
    chipGroup("typeChips", Object.keys(G.TYPES).filter(function (k) { return tc[k]; }).map(function (k) { return [k, G.TYPES[k], tc[k]]; }), "types");
    var fc = {}; all.forEach(function (e) { (e.fields || []).forEach(function (f) { fc[f] = (fc[f] || 0) + 1; }); });
    chipGroup("fieldChips", Object.keys(G.FIELDS).filter(function (k) { return k !== "any" && fc[k]; }).map(function (k) { return [k, G.FIELDS[k], fc[k]]; }), "fields");
    var wantHash = location.hash;
    readURL(); syncChips();
    var wantId = wantHash.indexOf("#p-") === 0 ? wantHash.slice(3) : "";
    if (wantId) {
      /* find the linked card in the list first, so the first draw already holds it (one filter and sort, no second draw) */
      var at = currentList(savedIds()).list.findIndex(function (e) { return e.id === wantId; });
      shown = PAGE; if (at >= shown) shown = at + 1;
      render(false);
    } else render(true);
    prefetchDetail();
    if (wantId) {
      var el = document.getElementById("p-" + wantId);
      if (el) { var det = el.querySelector("details"); if (det) det.open = true; el.scrollIntoView(); }
      wantDetail();
    }
  }).catch(function (err) {
    $("count").textContent = "Could not load the list.";
    $("out").innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Something went wrong</h3><p>' + G.esc(err.message) + ". Reload the page, or open the <a href=\"data/entries.csv\">spreadsheet version</a>.</p></div>";
  });

  var qt;
  $("q").addEventListener("input", function (e) { clearTimeout(qt); var v = e.target.value; if (v.trim()) wantDetail(); qt = setTimeout(function () { state.q = v.trim(); render(true); }, 160); });
  ["age", "when", "season", "sort"].forEach(function (id) { $(id).addEventListener("change", function (e) { state[id] = e.target.value; if (id === "age") { savePrefs(); hidePrefNote(); } render(true); }); });
  $("onlyVerified").addEventListener("click", function () { state.verified = !state.verified; syncChips(); render(true); });
  $("noPermit").addEventListener("click", function () { state.noPermit = !state.noPermit; syncChips(); render(true); });
  $("savedOnly").addEventListener("click", function () { state.saved = !state.saved; syncChips(); render(true); });
  $("viewCards").addEventListener("click", function () { state.view = "cards"; syncChips(); render(false); });
  $("viewDates").addEventListener("click", function () { state.view = "dates"; syncChips(); render(false); });
  $("reset").addEventListener("click", resetAll);
  document.addEventListener("click", function (ev) {
    var rx = ev.target.closest("[data-relax]");
    if (rx) { clearOne(rx.getAttribute("data-relax")); return; }
    if (ev.target.closest("[data-relax-saved]")) { resetFilters(true); focusFirst(); return; }
    var cal = ev.target.closest("[data-cal]");
    if (cal) {
      var pe = all.filter(function (x) { return x.id === cal.getAttribute("data-cal"); })[0];
      if (pe && pe.deadline_iso && knownDeadline(pe)) {
        G.download(pe.id + "-deadline.ics", L.icsEvent({ uid: "deadline-" + pe.id, title: "Deadline: " + pe.name, desc: (pe.deadline_text || "") + " " + (G.safeUrl(pe.apply_url || pe.url) || ""), dateISO: pe.deadline_iso }), "text/calendar");
        G.toast("Calendar file saved. Open it to add the deadline.");
      }
      return;
    }
    var s = ev.target.closest(".star");
    if (s) {
      var on = G.saved.toggle(s.getAttribute("data-id"));
      s.setAttribute("aria-pressed", String(on));
      $("savedN").textContent = savedIds().length;
      if (state.saved && !on) {
        var cardEl = s.closest("article.prog"), nb = cardEl && (cardEl.nextElementSibling && cardEl.nextElementSibling.matches("article.prog") ? cardEl.nextElementSibling : cardEl.previousElementSibling && cardEl.previousElementSibling.matches("article.prog") ? cardEl.previousElementSibling : null);
        var nextStar = nb && nb.querySelector(".star");
        var lost = document.activeElement === document.body || $("out").contains(document.activeElement);
        render(false, lost ? { starId: nextStar ? nextStar.getAttribute("data-id") : "", el: $("savedOnly") } : null);
      }
      G.toast(!G.saved.kept ? "This browser will not keep your list. Use Copy my list before you leave." : on ? "Saved to your list" : "Removed from your list");
      return;
    }
    var j = ev.target.closest("[data-jump]");
    if (j) {
      ev.preventDefault();
      state.view = "cards"; syncChips();
      var id = j.getAttribute("data-jump");
      var idx = currentList(savedIds()).list.findIndex(function (e) { return e.id === id; });
      if (idx < 0 && j.closest("#picks")) {
        /* the strip ignores the other filters, so clear them (keep age and area) to bring the card back */
        state.q = ""; state.hubs = []; state.when = ""; state.season = ""; state.paid = []; state.types = []; state.fields = [];
        state.verified = false; state.noPermit = false; state.saved = false;
        $("q").value = ""; $("when").value = ""; $("season").value = ""; syncChips();
        idx = currentList(savedIds()).list.findIndex(function (e) { return e.id === id; });
      }
      if (idx >= shown) shown = idx + 1;
      render(false);
      var el = document.getElementById("p-" + id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.querySelector("details").open = true; }
      wantDetail();
    }
  });
  $("printList").addEventListener("click", function () {
    var ids = savedIds(), keep = all.filter(function (e) { return ids.indexOf(e.id) > -1; });
    var d = document.createElement("div");
    d.innerHTML = "<h1>My internship list</h1><ol>" + keep.map(function (e) {
      return "<li><b>" + G.esc(e.name) + "</b> (" + G.esc(e.org || "") + ")<br>" + G.esc(e.deadline_text || "") + "<br>" + G.esc(e.url || "") + "</li>";
    }).join("") + "</ol><p>From vadneyk.github.io/internships. Confirm dates on each program's own site.</p>";
    G.printOnly(d, "My internship list");
  });
  $("copyList").addEventListener("click", function () {
    var ids = savedIds(), txt = all.filter(function (e) { return ids.indexOf(e.id) > -1; }).map(function (e) {
      return "- " + e.name + " (" + (e.org || "") + ")\n  " + (e.deadline_text || "") + "\n  " + (e.url || "");
    }).join("\n");
    G.copy(txt || "Your list is empty.");
  });
})();
