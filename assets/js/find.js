/* Programs page: filters, sorting, deadline view, saved list.
   Cards are drawn from the lite file. The long text (who can apply, how to apply, good to know) comes from the detail file,
   which starts loading on the first of: a card opened, a search typed, a #p- link, a print, or an idle prefetch 3 seconds after the first draw.
   With a place chosen the cards and the long text come from that place's Where group files plus the shared file (see "Data"). */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var all = [], byId = {}, world = [], wid = {}, part = false, loaded = {}, gen = 0;
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
    if (st === "event-passed") return '<span class="tag ghost">Event passed</span>';
    return '<span class="tag ghost">Dates unconfirmed</span>';
  }
  /* A badge for an open program whose deadline is 0 to 14 days away. Same day counting as the dates line (daysUntil). */
  function closesSoonTag(e) {
    var d = futureDeadline(e);
    if (!d || L.effStatus(e, now()) !== "open-now") return "";
    var n = G.daysUntil(d, now());
    if (n < 0 || n > 14) return "";
    var words = n === 0 ? "Closes today" : n === 1 ? "Closes tomorrow" : "Closes in " + n + " days";
    return '<span class="tag warn">' + words + "</span>";
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
  /* With an age picked, a card whose grades likely leave that age out says so next to the grades (lib.gradeFit). Cards that state ages are left to the age filter. */
  function gradeTag(e) {
    var f = L.gradeFit(e, state.age);
    return f ? '<span class="tag warn" data-gradefit="' + f + '">' + G.esc("May be too " + f + " at " + state.age + ": check the grades") + "</span>" : "";
  }
  function paidTag(e) {
    var t = G.PAID[e.paid_type] || "";
    var cls = e.paid_type === "paid" || e.paid_type === "stipend" ? "y" : e.paid_type === "fee-based" ? "warn" : "ghost";
    return t ? '<span class="tag ' + cls + '">' + G.esc(t) + "</span>" : "";
  }

  /* The inside of a card's <dl>. Before the detail file arrives it holds a short note in place of the long text. */
  function detailMode() { return detailState === "ready" || detailState === "fail" ? detailState : "wait"; }
  /* pay_detail comes with the detail file, so the row stays out until then (no empty label) */
  function payHtml(e) { return detailState === "ready" && e.pay_detail ? '<p class="pay"><b>Pay or cost:</b> ' + G.esc(e.pay_detail) + "</p>" : ""; }
  function detailBody(e) {
    var html = "", mode = detailMode(), ready = mode === "ready";
    if (!ready) {
      html += mode === "fail"
        ? "<div><dt>Details</dt><dd>Could not load these details. Check your connection, then close and open this card to try again.</dd></div>"
        : "<div><dt>Details</dt><dd>Loading details</dd></div>";
    }
    if (ready && e.who_can_apply) html += "<div><dt>Who can apply</dt><dd>" + G.esc(e.who_can_apply) + "</dd></div>";
    if (ready && e.how_to_apply) html += "<div><dt>How to apply</dt><dd>" + G.esc(e.how_to_apply) + "</dd></div>";
    if (ready && e.duration) html += "<div><dt>How long</dt><dd>" + G.esc(e.duration) + "</dd></div>";
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
  /* The star shows saved or not saved with a shape and a word, not color alone: an outline star, or a filled star and the word Saved. The button name and aria-pressed carry the state for screen readers, so the glyph and the word are hidden from them. */
  function starInner(on) {
    return '<span class="star-ic" aria-hidden="true">' + (on ? "&#9733;" : "&#9734;") + "</span>" + (on ? '<span class="star-w" aria-hidden="true">Saved</span>' : "");
  }
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
    var html = '<article class="card prog" tabindex="-1" id="p-' + G.esc(e.id) + '" aria-labelledby="p-' + G.esc(e.id) + '-h">';
    html += '<div class="row">' + statusTag(e) + closesSoonTag(e) + paidTag(e) + '<span class="tag ghost">' + G.esc(G.TYPES[e.type] || e.type) + "</span></div>";
    html += '<h3 id="p-' + G.esc(e.id) + '-h">' + G.esc(e.name) + "</h3>";
    html += '<p class="org">' + G.esc(e.org || "") + (e.city ? " &middot; " + G.esc(e.city) : "") + "</p>";
    html += '<p class="what">' + G.esc(e.what_you_do || "") + "</p>";
    /* "limited": one place's residents, or girls or boys only (build_data.py). The rule itself is under "Who can apply and how". */
    html += '<div class="row"><span class="tag ghost">' + G.esc(ageText(e)) + "</span>" + gradeTag(e) + (e.limited ? '<span class="tag warn">Only some can apply: see who below</span>' : "") + "</div>";
    html += '<div data-pay>' + payHtml(e) + "</div>";
    html += deadlineLine(e);
    html += "<details><summary>Who can apply and how</summary><dl" + (detailMode() === "ready" ? "" : ' data-detail="' + detailMode() + '"') + ">" + detailBody(e);
    html += "</dl></details>";
    html += '<div class="actions">';
    if (u) html += '<a class="btn sm" href="' + G.esc(u) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Official page for " + e.name + (e.org ? ", " + e.org : "")) + '">Official page</a>';
    if (a && a !== u) html += '<a class="btn sm alt" href="' + G.esc(a) + '" target="_blank" rel="noopener" aria-label="' + G.esc("Apply to " + e.name + (e.org ? ", " + e.org : "")) + '">Apply</a>';
    html += L.calButtons(e, now());
    html += '<button class="star noprint" type="button" data-id="' + G.esc(e.id) + '" aria-pressed="' + saved + '" aria-label="' + G.esc("Save " + e.name + " to my list") + '" title="Save to my list">' + starInner(saved) + '</button>';
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
  var gaps = [], gapsPromise = null;
  /* the gaps file is requested only once a place or hub is chosen, and only once per page load */
  function loadGaps() {
    if (!gapsPromise) {
      gapsPromise = G.fetchData("data/gaps.json").then(function (r) { return r.json(); }).then(function (g) { gaps = g; paintGaps(); }).catch(function () {});
    }
    return gapsPromise;
  }
  function paintGaps() {
    var box = $("gaps"); if (!box) return;
    var hubsNow = state.hubs.length ? state.hubs : state.place ? L.hubsOfPlace(state.place) : [];
    if (!hubsNow.length) { box.hidden = true; box.innerHTML = ""; return; }
    loadGaps();
    var mine = gaps.filter(function (g) { return g.hubs.some(function (h) { return hubsNow.indexOf(h) > -1; }); });
    if (!mine.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = "<h2 style=\"font-size:1.1rem;\">Known gaps in this area</h2><ul>" + mine.map(function (g) {
      return "<li><b>" + G.esc(g.title) + ".</b> " + G.esc(g.text) + ' <a href="https://github.com/VadneyK/internships/issues/' + g.issue + '">Issue ' + g.issue + "</a></li>";
    }).join("") + "</ul>";
  }

  /* The state-level place for a city or area: the one place whose region the city covers. "" when there is none or the place is already a state. */
  function stateOfPlace(place) {
    if (!place || place.indexOf("state:") === 0) return "";
    var rs = L.placeRegions(place) || [], hit = L.STATES.filter(function (x) { return rs.indexOf(x[2]) > -1; });
    return hit.length === 1 ? "state:" + hit[0][0] : "";
  }
  /* Help card above the results when a Where choice finds fewer than 5 programs. The button adds the state (from a city) and online and national programs. */
  var HELP_FEW = 5;
  var COUNSELOR_ASK = "do we have a list of local jobs or job training for students? Some schools call it career tech or work-based learning.";
  function paintTownHelp(realN) {
    var box = $("townHelp"); if (!box) return;
    if (!state.place || realN >= HELP_FEW || state.saved) { box.hidden = true; box.innerHTML = ""; return; }
    var st = stateOfPlace(state.place), done = state.moreOnline && !st;
    var more =(done ? "<p>Online and national programs are included in the list below.</p>"
      : '<p><button class="btn alt sm" type="button" id="townMore">See statewide and online programs</button></p>') +
      '<p class="small muted">Know a program that should be here? <a href="contribute.html">Help add it.</a></p>';
    var ask = "Ask your school counselor: " + COUNSELOR_ASK;
    var none = !all.some(function (e) { return L.matches(e, { place: state.place }, now()); });
    box.hidden = false;
    box.innerHTML = none
      ? '<h2 style="font-size:1.1rem;">We have no listings for this place yet</h2><p>Here are three things you can do now:</p>' +
        '<ol><li>See <a href="jobs.html">jobs that hire teens</a>. Many do not need a program.</li>' +
        '<li>Use the <a href="permit.html">work permit finder</a> to see if you need a permit for paid work.</li><li>' + ask + "</li></ol>" + more
      : '<h2 style="font-size:1.1rem;">Not many programs near you?</h2><p><b>Ask your school counselor:</b> ' + COUNSELOR_ASK + "</p>" + more;
    var b = $("townMore");
    if (b) b.onclick = function () {
      var next = stateOfPlace(state.place);
      state.moreOnline = true;
      if (next) { state.place = next; state.hubs = []; }
      savePrefs(); hidePrefNote(); syncChips(); render(true);
      var r = $("count"); if (r) r.focus();
    };
  }

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
    /* The online and national choice from the help card: a removable chip, so the hidden filter can always be undone. */
    if (state.moreOnline) box.innerHTML += ' <button class="chip noprint" type="button" data-online-off="1">Online and national included (remove)</button>';
  }

  /* "Good fit for you": the best three for the chosen age, area (a picked place, or an area chip such as a QR code's where=) and pay choice.
     Other filters and the search do not change it. Cards only some teens can join (one city's residents, girls or boys only) come last. */
  var PICKS_N = 3, picksKey = null;
  function picksEntries(t) {
    var s = { age: state.age, place: state.place, hubs: state.hubs, paid: state.paid };
    var found = all.filter(function (e) { return L.matches(e, s, t); });
    if (found.length < 3) { s.placeOnline = true; found = all.filter(function (e) { return L.matches(e, s, t); }); }
    /* Cards only some can apply to, or whose grades likely leave this age out, fill the picks only after the rest. */
    var p = { age: state.age }, held = function (e) { return !!(e.limited || L.gradeFit(e, state.age)); };
    var open = L.topPicks(found.filter(function (e) { return !held(e); }), p, t, PICKS_N);
    return open.length < PICKS_N ? open.concat(L.topPicks(found.filter(held), p, t, PICKS_N - open.length)) : open;
  }
  function paintPicks() {
    var box = $("picks"), nudge = $("picksNudge"), ol = $("picksList"); if (!box || !ol) return;
    var chosen = !!(state.age || state.place || state.hubs.length), why = $("picksWhy");
    if (nudge) nudge.hidden = chosen;
    var area = state.place || state.hubs.length;
    if (why) why.textContent = (area && state.age ? "Picked from your age and area." : area ? "Picked from your area. Pick your age for a closer fit." : "Picked from your age, from anywhere. Pick an area to see programs near you.") + " Dates and rules can change, so check the official page.";
    var t = now(), key = JSON.stringify([state.age, state.place, state.hubs, state.paid, new Date(t).toDateString()]);
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
    var opts = L.relaxOptions(part ? world : all, Object.assign({}, state, { savedIds: sv }), now()), n = sv.length, lead, btns = "";
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
    else if (key === "place") { state.place = ""; state.moreOnline = false; savePrefs(); hidePrefNote(); }
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
      state.verified, state.noPermit, state.moreOnline, state.sort, state.saved, state.saved ? sv : null, new Date(t).toDateString(), state.q ? detailMode() : ""]);
  }
  /* sv is the saved ids, read once by the caller */
  function currentList(sv) {
    var t = now(), key = listCacheKey(sv, t);
    if (cache && cache.key === key) { state.savedIds = sv; state.placeOnline = cache.placeOnline; return cache; }
    state.savedIds = sv; state.placeOnline = false;
    function keep(e) { return L.matches(e, state, t); }
    var found = all.filter(keep), realN = found.length;
    if (state.place && (realN < 3 || state.moreOnline)) { state.placeOnline = true; found = all.filter(keep); }
    cache = { key: key, list: L.sortList(found, state.sort, t, { age: state.age }), realN: realN, placeOnline: state.placeOnline, idKey: null };
    return cache;
  }
  function listKey(cur) { return cur.idKey || (cur.idKey = cur.list.map(function (e) { return e.id; }).join(",")); }
  /* Show more: add the next page of cards after the ones on screen. Nothing already drawn is rebuilt, so a card the teen opened stays open. */
  function pagerHtml(list) {
    return list.length > shown ? '<div class="pager" style="grid-column:1/-1"><button class="btn alt" type="button" id="more">Show more (' + (list.length - shown) + " left)</button></div>" : "";
  }
  /* Print-only line under the cards. It says how many matches the sheet holds, so a partial print is not silent.
     Empty when the list is in dates view or fits on one page. */
  function paintPrintCut(list) {
    var box = $("printCut");
    if (!box) return;
    if (state.view !== "cards" || list.length <= PAGE) { box.textContent = ""; return; }
    box.textContent = "Showing " + Math.min(shown, list.length) + " of " + list.length + " programs." + (shown < list.length ? " Open the page and press Show more for the rest." : "");
  }
  function showMore() {
    var from = shown, out = $("out"), sv = savedIds(), cur = currentList(sv), list = cur.list;
    shown += PAGE;
    paintPrintCut(list);
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
  /* The visible count (#count) updates at once. The spoken copy (#countLive, role=status) waits until typing stops, so a screen reader does not read a changing count over the person's typing. A filter or chip change is spoken right away. The first draw is not spoken, and the text is never cleared. */
  var spoken = null, speakT, typingRender = false;
  function announceCount(text) {
    var typed = typingRender; typingRender = false;
    clearTimeout(speakT);
    var live = $("countLive");
    if (!live) return;
    if (spoken === null) { spoken = text; return; }
    if (text === spoken) return;
    if (!typed) { live.textContent = spoken = text; return; }
    speakT = setTimeout(function () { var t = $("count").textContent; if (t !== spoken) live.textContent = spoken = t; }, 700);
  }
  function render(resetPage, keep) {
    paintSummary();
    var wait = ensure();
    if (wait) { wait.then(function () { render(resetPage, keep); }, function () { G.toast("Could not load more programs. Check your connection and try again."); }); return; }
    if (resetPage) shown = PAGE;
    var sv = savedIds(), cur = currentList(sv), list = cur.list, realN = cur.realN;
    lastKey = listKey(cur);
    paintPlaceNote(realN);
    paintTownHelp(realN);
    $("count").textContent = list.length + " of " + world.length + " programs";
    announceCount($("count").textContent);
    paintShow(list.length);
    paintPrintCut(list);
    paintSortNote();
    $("savedN").textContent = sv.length;
    var out = $("out"), dates = $("dates");
    $("listActions").hidden = !state.saved;
    $("textList").hidden = $("emailList").hidden = $("downloadList").hidden = $("parentList").hidden = $("keepLink").hidden = $("exportList").hidden = !sv.length;
    $("listHow").hidden = !state.saved || !sv.length;
    $("keepCapNote").hidden = sv.length <= KEEP_MAX;
    $("listNextN").textContent = sv.length;
    $("listNext").hidden = !(state.saved && sv.length > 0);
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
      out.innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Nothing matches yet</h3>' + relaxHtml(sv) + '<p>Try a different age or area, or clear the filters. Programs near you may also appear under &ldquo;California&rdquo; or &ldquo;Online and national&rdquo;.</p>' + (state.age === "12" || state.age === "13" ? '<p>Under 14? Read the <a href="younger.html">ages 12 to 14 page</a>.</p>' : "") + '<p>Want a regular job instead? <a href="jobs.html">See jobs that hire teens</a></p>' + (state.q && detailState !== "ready" && detailState !== "fail" ? '<p class="small muted" data-detail-wait>Still loading the full text of each program, so this list may change in a moment.</p>' : "") + '<button class="btn" type="button" id="emptyReset">Clear all filters</button></div>';
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

  /* Summary bar (2026-10-12: Programs filters redesign). One chip per main pick, so a teen sees every choice in one row and taps a chip to jump to that filter.
     A pick that is not set shows as an open chip ("Any age"). Clear all shows only when something is picked. */
  var SUM_KEY = "", placeBox = null;
  function selText(id) { var s = $(id), o = s && s.options[s.selectedIndex]; return o && o.value ? o.textContent : state[id]; }
  function labelsOf(table, vals) { return vals.map(function (v) { var f = Array.isArray(table) ? table.filter(function (x) { return x[0] === v; })[0] : null; return f ? f[1] : Array.isArray(table) ? v : table[v] || v; }).join(", "); }
  function paintSummary() {
    var box = $("fsumChips"); if (!box) return;
    var goal = Object.keys(GOALS).filter(goalOn)[0], list = [];
    function add(k, text, on, noun) { list.push({ k: k, text: text, on: on, noun: noun }); }
    add("age", state.age || "Any age", !!state.age, "age");
    var where = state.place ? L.placeLabel(state.place) : labelsOf(G.HUBS, state.hubs);
    add("where", where || "Anywhere", !!where, "where");
    if (goal) add("goal", document.querySelector('[data-goal="' + goal + '"]').textContent, true, "goal");
    else if (!state.types.length && !state.paid.length) add("goal", "Any goal", false, "goal");
    else {
      if (state.types.length) add("kind", labelsOf(G.TYPES, state.types), true, "kind of program");
      if (state.paid.length) add("pay", labelsOf(PAID_GROUPS, state.paid), true, "pay");
    }
    if (state.fields.length) add("interest", labelsOf(G.FIELDS, state.fields), true, "interest");
    add("when", state.when ? selText("when") : "Any time", !!state.when, "timing");
    if (state.season) add("season", selText("season"), true, "season");
    if (state.q) add("q", "Search: " + state.q, true, "search");
    if (state.verified) add("checked", "Checked on the official site", true, "this filter");
    if (state.noPermit) add("nopermit", "No work permit needed", true, "this filter");
    var key = JSON.stringify(list);
    if (key !== SUM_KEY) {
      SUM_KEY = key;
      box.innerHTML = list.map(function (c) {
        return '<button class="fchip' + (c.on ? " on" : "") + '" type="button" data-fs="' + c.k + '" aria-label="' + G.esc(c.text + ", change " + c.noun) + '">' + G.esc(c.text) + "</button>";
      }).join("");
    }
    $("reset").hidden = !(state.q || state.age || state.when || state.season || state.paid.length || state.types.length || state.fields.length || state.verified || state.noPermit || state.hubs.length || state.place);
  }
  /* A summary chip moves focus to its filter (and opens More filters when the filter lives there). */
  function goToFilter(k) {
    var one = function (css) { return document.querySelector(css + '[aria-pressed="true"]') || document.querySelector(css); }, el = null;
    if (k === "age" || k === "when" || k === "season") el = one("#" + k + " + .tp .tile");
    else if (k === "where") el = placeBox ? placeBox.input : one("#place + .tp .tile");
    else if (k === "goal") el = one("#goalChips .chip");
    else if (k === "kind" || k === "pay" || k === "interest") { $("moreFilters").open = true; el = one({ kind: "#typeChips", pay: "#paidChips", interest: "#fieldChips" }[k] + " .chip"); }
    else if (k === "q") el = $("q");
    else if (k === "checked") el = $("onlyVerified");
    else if (k === "nopermit") el = $("noPermit");
    if (!el) return;
    try { el.scrollIntoView({ behavior: G.motionOK() ? "smooth" : "auto", block: "center" }); } catch (e) {}
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  $("fsumChips").addEventListener("click", function (ev) { var b = ev.target.closest(".fchip"); if (b) goToFilter(b.getAttribute("data-fs")); });
  /* Phone bar: "Show N programs" follows the count and scrolls to the results. It hides once the count line (where the results start) is on screen or behind. */
  function paintShow(n) {
    var bar = $("showBar"), btn = $("showBtn"); if (!bar || !btn) return;
    btn.textContent = "Show " + n + (n === 1 ? " program" : " programs");
    if (!bar.hidden) return;
    bar.hidden = false; document.body.classList.add("has-showbar");
    if (!window.IntersectionObserver) return;
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1], past = e.isIntersecting || e.boundingClientRect.top < 0;
      bar.classList.toggle("off", past); document.body.classList.toggle("has-showbar", !past);
    }).observe($("count"));
  }
  /* The bar goes to the count line that starts the results (the same spot Search Enter and Clear all use), so the count and the sort box are in view. */
  $("showBtn").addEventListener("click", function () {
    var r = $("count");
    r.scrollIntoView({ behavior: G.motionOK() ? "smooth" : "auto", block: "start" });
    try { r.focus({ preventScroll: true }); } catch (e) { r.focus(); }
  });

  /* chips */
  function chipGroup(id, items, key, multi) {
    var box = $(id);
    box.innerHTML = items.map(function (it) {
      return '<button class="chip" type="button" data-key="' + key + '" data-val="' + G.esc(it[0]) + '" data-label="' + G.esc(it[1]) + '" aria-pressed="false">' + G.esc(it[1]) + ' <span class="n">' + (it[2] != null ? it[2] : "") + "</span></button>";
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
    if (!cur.facets) {
      cur.facets = L.facetCounts(all, state, now());
      /* the area chips count every program, so they come from the stats rows */
      if (part) cur.facets.hubs = L.facetCounts(world, state, now()).hubs;
    }
    document.querySelectorAll(".chip[data-key]").forEach(function (b) {
      var group = FACET_OF[b.getAttribute("data-key")], tbl = group && cur.facets[group];
      var n = tbl ? tbl[b.getAttribute("data-val")] : null;
      if (typeof n !== "number" || isNaN(n)) return;
      var span = b.querySelector(".n"), label = b.getAttribute("data-label") || "";
      if (span) span.textContent = String(n);
      b.setAttribute("aria-label", label + " " + n + (n === 1 ? " program" : " programs"));
      b.classList.toggle("zero", n === 0);
    });
  }
  /* One-tap goals: each sets the Kind or Pay filter. A second tap turns it off. */
  var GOALS = { volunteer: { types: ["volunteer"], paid: [] }, paid: { types: [], paid: ["pay"] }, research: { types: ["research"], paid: [] }, college: { types: ["pre-college"], paid: [] } };
  function goalOn(k) { return state.types.join() === GOALS[k].types.join() && state.paid.join() === GOALS[k].paid.join(); }
  function syncGoals() {
    document.querySelectorAll("[data-goal]").forEach(function (b) { b.setAttribute("aria-pressed", String(goalOn(b.dataset.goal))); });
  }
  function syncChips() {
    syncGoals();
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
    $("hubGroup").hidden = !!state.place;
    syncMoreFilters();
  }
  /* The pay, kind and interest chips live in a closed box. Say how many are on, and open the box when one is. */
  function syncMoreFilters() {
    var box = $("moreFilters"); if (!box) return;
    var sm = box.querySelector("summary"); if (!sm) return;
    var n = state.paid.length + state.types.length + state.fields.length;
    /* The count lives in its own span, so the label text and any child elements in the summary are left alone. */
    var cnt = sm.querySelector(".mf-count");
    if (!cnt) { cnt = document.createElement("span"); cnt.className = "mf-count"; sm.appendChild(cnt); }
    cnt.textContent = n ? " (" + n + " on)" : "";
    /* Open only when the count goes from none to some (or on first load with a filter in the URL), so a teen can close the box while filters stay on. */
    if (n && !box._hadOn) box.open = true;
    box._hadOn = n > 0;
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

  /* The three related chips carry the chosen age and area (only the parts that are set). */
  /* The picked place, or for one area chip (a QR code's where=oak) the smallest city or area choice that covers it, so linked pages keep the area. */
  function placeOrHub() {
    if (state.place || state.hubs.length !== 1) return state.place;
    var h = G.HUBS.filter(function (x) { return x[0] === state.hubs[0]; })[0], best = "", size = 1e9;
    if (!h) return "";
    L.CITIES.map(function (c) { return "city:" + c[0]; }).concat(L.AREAS.map(function (a) { return "area:" + a[0]; })).forEach(function (pl) {
      var rs = L.placeRegions(pl) || [];
      if (h[2].every(function (r) { return rs.indexOf(r) > -1; }) && rs.length < size) { best = pl; size = rs.length; }
    });
    return best;
  }
  function paintRelated() {
    var box = $("relatedLinks"); if (!box) return;
    var cal = box.querySelector("a[href^='calendar.html']"), per = box.querySelector("a[href^='permit.html']"), jobs = box.querySelector("a[href^='jobs.html']"), young = box.querySelector("a[href^='younger.html']");
    var c = new URLSearchParams(), pl = placeOrHub();
    if (pl) c.set("at", pl);
    if (state.age) c.set("age", state.age);
    if (cal) cal.setAttribute("href", "calendar.html" + (c.toString() ? "?" + c.toString() : ""));
    if (per) per.setAttribute("href", "permit.html" + (state.age && state.age !== "12" && state.age !== "13" ? "?age=" + encodeURIComponent(state.age) : ""));
    if (jobs) jobs.setAttribute("href", "jobs.html" + (PREF_AGES.indexOf(state.age) > -1 ? "?age=" + encodeURIComponent(state.age) : ""));
    if (young) young.setAttribute("href", "younger.html" + (state.age === "12" || state.age === "13" ? "?age=" + state.age : ""));
  }
  /* Under the age picker: for 12 or 13 only, a note that federal law sets 14 as the minimum for most non-farm jobs, with a link to the Ages 12 to 14 page for that age. */
  function paintUnder14Note() {
    var note = $("ageUnder14Note"), link = note && note.querySelector("a");
    if (!note) return;
    var under = state.age === "12" || state.age === "13";
    note.hidden = !under;
    if (link) link.setAttribute("href", under ? "younger.html?age=" + state.age : "younger.html");
  }

  /* url state */
  function persist() {
    paintRelated();
    paintUnder14Note();
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
  /* Data. URLs are written out one by one: the Where groups in PICK_GROUPS order, then shared (online and national). A test checks them against the build.
     A place from the address or the saved choice loads its groups plus shared, and the stats file for what counts every program (chips, place counts, "of N", area chips).
     What those cannot answer (no place, an area chip, a search, a saved card outside them) or a failed load uses the whole lite file instead. */
  var LITE = ["data/lite/california.json", "data/lite/pacific-northwest.json", "data/lite/texas.json", "data/lite/midwest.json", "data/lite/northeast.json", "data/lite/south-and-dc-area.json", "data/lite/mountain-west.json", "data/lite/oregon-and-hawaii.json", "data/lite/plains-and-mountain.json", "data/lite/shared.json"];
  var DET = ["data/detail/california.json", "data/detail/pacific-northwest.json", "data/detail/texas.json", "data/detail/midwest.json", "data/detail/northeast.json", "data/detail/south-and-dc-area.json", "data/detail/mountain-west.json", "data/detail/oregon-and-hawaii.json", "data/detail/plains-and-mountain.json", "data/detail/shared.json"];
  var pulled = {}, pulledDet = {}, fullP = null;
  function pull(store, urls, i) {
    if (!store[i]) {
      var file = urls[i] || "data/entries-lite.json";
      store[i] = G.fetchData(file).then(function (r) { if (!r.ok) throw new Error("Could not load programs (" + r.status + ")"); return r.json(); });
      store[i].catch(function () { delete store[i]; });
    }
    return store[i];
  }
  /* The chunk numbers a place needs (its Where groups and shared), or null. */
  function chunksFor(place) {
    var m = /^(city|state|area):(.+)$/.exec(place || ""), PG = L.PICK_GROUPS, ids, out = [PG.length], a, g, k, i;
    if (!m) return null;
    ids = [m[2]];
    if (m[1] === "area") { a = L.AREAS.filter(function (x) { return x[0] === m[2]; })[0]; if (!a) return null; ids = a[2]; }
    for (i = 0; i < ids.length; i++) {
      for (g = 0, k = -1; g < PG.length && k < 0; g++) if (PG[g][m[1] === "state" ? 3 : 2].indexOf(ids[i]) > -1) k = g;
      if (k < 0) return null;
      if (out.indexOf(k) < 0) out.push(k);
    }
    return out.sort(function (x, y) { return x - y; });
  }
  /* The loaded chunks as one list in lite order (by id), each card once. */
  function rowsOf() {
    var seen = {}, out = [];
    Object.keys(loaded).forEach(function (i) { loaded[i].forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; out.push(e); } }); });
    return out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
  }
  function setRows(rows, whole) {
    all = rows; byId = {}; gen++; cache = null; picksKey = null;
    all.forEach(function (e) { byId[e.id] = e; });
    if (whole) { part = false; world = all; }
  }
  /* new rows: the long text has to come again */
  function redoDetail() { if (detailState === "ready" || detailState === "wait") { detailState = "idle"; wantDetail(); } }
  function wholeLite() { return G.loadEntries(true).then(function (rows) { setRows(rows, true); }); }
  function goFull() {
    if (!part) return Promise.resolve();
    return fullP || (fullP = wholeLite().then(redoDetail, function (e) { fullP = null; throw e; }));
  }
  /* The starting place, read the way readURL and applyPrefs read it. "" with a search or a card link in the address. */
  function firstPlace() {
    var p = new URLSearchParams(location.search), at = p.get("at") || "";
    if (p.get("q") || location.hash.indexOf("#p-") === 0) return "";
    if (!location.search) { var pr = G.store.get(PREF_KEY, {}); at = typeof pr.place === "string" ? pr.place : ""; }
    return at && L.placeRegions(at) ? at : "";
  }
  var dataP = (function () {
    var pl = firstPlace(), idx = pl ? chunksFor(pl) : null;
    if (!idx) return wholeLite();
    return Promise.all(idx.map(function (i) { return pull(pulled, LITE, i); }).concat(G.loadEntries("stats"))).then(function (res) {
      idx.forEach(function (i, k) { loaded[i] = res[k]; });
      world = res[idx.length]; world.forEach(function (e) { wid[e.id] = 1; });
      part = true; setRows(rowsOf(), false);
    }).catch(wholeLite);
  })();
  /* Called by render(): null when the loaded cards cover the state, else a promise for what is missing (more chunks, or the whole file). */
  function ensure() {
    if (!part) return null;
    var need = !state.place || state.q || state.hubs.length ? null : chunksFor(state.place), miss = [];
    if (need) need.forEach(function (i) { if (!loaded[i]) miss.push(i); });
    var out = G.saved.ids().some(function (id) { return !byId[id] && wid[id]; });
    if (need && !out) {
      if (!miss.length) return null;
      return Promise.all(miss.map(function (i) { return pull(pulled, LITE, i).then(function (rows) { loaded[i] = rows; }); })).then(function () { setRows(rowsOf(), false); redoDetail(); }, goFull);
    }
    return goFull();
  }
  function paintBodies() {
    var cards = $("out").querySelectorAll("article.prog"), mode = detailMode();
    for (var i = 0; i < cards.length; i++) {
      var dl = cards[i].querySelector("dl"), e = byId[cards[i].id.slice(2)];
      if (!dl || !e || (dl.getAttribute("data-detail") || "ready") === mode) continue;
      dl.innerHTML = detailBody(e);
      var slot = cards[i].querySelector("[data-pay]"); if (slot) slot.innerHTML = payHtml(e);
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
  function detailRows() {
    if (!part) return G.loadEntries("detail");
    return Promise.all(Object.keys(loaded).map(function (i) { return pull(pulledDet, DET, i); })).then(function (rs) { return [].concat.apply([], rs); });
  }
  function wantDetail() {
    if (detailState === "ready" || detailState === "wait") return;
    detailState = "wait"; paintBodies();
    var g0;
    dataP.then(function () { g0 = gen; return detailRows(); }).then(function (rows) {
      if (g0 !== gen) return;
      rows.forEach(function (row) {
        var e = byId[row.id];
        if (e) Object.keys(row).forEach(function (k) { if (k !== "id") e[k] = row[k]; });
      });
      detailState = "ready"; paintBodies(); rerunList(); reJump(); holdFor(2e3);
    }).catch(function () { if (g0 === undefined || g0 === gen) { detailState = "fail"; paintBodies(); } });
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
  G.placeChunks = chunksFor; /* test hook: the chunk numbers a place needs (tests/diet-1-region-chunks.test.mjs) */

  /* A shared #p-<id> link. If the card is hidden by the filters or by My list only, clear them and say so. If the id is not in the data, show a note. */
  function openLinked(id, first) {
    if (part && !(byId[id] && currentList(savedIds()).list.some(function (e) { return e.id === id; }))) { goFull().then(function () { openLinked(id, first); }, function () {}); return; }
    var note = $("hashNote"); if (note) note.parentNode.removeChild(note);
    var known = Object.prototype.hasOwnProperty.call(byId, id), cleared = false;
    var at = known ? currentList(savedIds()).list.findIndex(function (e) { return e.id === id; }) : -1;
    if (known && at < 0) {
      clearTimeout(qt);
      state = { q: "", hubs: [], place: "", age: "", when: "", season: "", paid: [], types: [], fields: [], verified: false, noPermit: false, view: state.view, sort: "best", saved: false };
      $("q").value = ""; $("place").value = ""; $("age").value = ""; $("when").value = ""; $("season").value = ""; $("sort").value = "best";
      hidePrefNote(); syncChips(); cleared = true;
      at = currentList(savedIds()).list.findIndex(function (e) { return e.id === id; });
    }
    if (known && at < 0) known = false;
    var visible = known && at >= 0 && !!document.getElementById("p-" + id);
    if (known && (first || cleared || !visible)) {
      shown = PAGE; if (at >= shown) shown = at + 1;
      render(false);
    } else if (!known && first) render(true);
    if (!known) {
      var n = document.createElement("p");
      n.id = "hashNote"; n.className = "small"; n.setAttribute("role", "status");
      n.innerHTML = 'That program is no longer on the list. <a href="find.html">See the full list</a>.';
      $("out").parentNode.insertBefore(n, $("out"));
      return;
    }
    var el = document.getElementById("p-" + id);
    if (el) { var det = el.querySelector("details"); if (det) det.open = true; el.scrollIntoView(); try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); } holdJump(id); }
    if (cleared) G.toast("Filters cleared to show this program");
  }
  /* Cards above can still grow after the jump (long text, fonts), which left the card far off screen: keep it in view as the list
     resizes, until the person scrolls, taps or types, or 2 s after the long text is in (15 s at most) */
  var hold = null;
  function holdJump(id) {
    if (hold) hold.stop();
    var evs = ["wheel", "touchstart", "keydown", "pointerdown"], ro = window.ResizeObserver && new ResizeObserver(reJump), h = hold = { id: id };
    h.stop = function () { evs.forEach(function (n) { removeEventListener(n, h.stop, true); }); if (ro) ro.disconnect(); clearTimeout(h.t); if (hold === h) hold = null; };
    evs.forEach(function (n) { addEventListener(n, h.stop, true); });
    if (ro) ro.observe($("out"));
    holdFor(detailState === "ready" ? 2e3 : 15e3);
  }
  function holdFor(ms) { if (hold) { clearTimeout(hold.t); hold.t = setTimeout(hold.stop, ms); } }
  function reJump() { var el = hold && document.getElementById("p-" + hold.id); if (el) el.scrollIntoView(); }

  dataP.then(function () {
    var hubCounts = {}; world.forEach(function (e) { hubOf(e).forEach(function (h) { hubCounts[h] = (hubCounts[h] || 0) + 1; }); });
    var QUICK = ["davis", "sv", "oak", "sf", "state", "socal", "atl", "nyc", "chi", "online"];
    chipGroup("hubChips", G.HUBS.filter(function (h) { return hubCounts[h[0]] && QUICK.indexOf(h[0]) > -1; }).map(function (h) { return [h[0], h[1], hubCounts[h[0]]]; }), "hubs");
    G.fillPlaces($("place"), world);
    placeBox = G.placeSearch($("place"));
    G.placeTiles($("place"));
    ["age", "when", "season"].forEach(function (id) { G.tilePicker($(id), { anyLabel: $(id).options[0].textContent }); });
    $("place").addEventListener("change", function (e) { state.place = e.target.value; state.moreOnline = false; if (state.place) state.hubs = []; savePrefs(); hidePrefNote(); syncChips(); render(true); });
    chipGroup("paidChips", PAID_GROUPS.map(function (g) { return [g[0], g[1]]; }), "paid");
    var tc = {}; world.forEach(function (e) { tc[e.type] = (tc[e.type] || 0) + 1; });
    chipGroup("typeChips", Object.keys(G.TYPES).filter(function (k) { return tc[k]; }).map(function (k) { return [k, G.TYPES[k], tc[k]]; }), "types");
    var fc = {}; world.forEach(function (e) { (e.fields || []).forEach(function (f) { fc[f] = (fc[f] || 0) + 1; }); });
    chipGroup("fieldChips", Object.keys(G.FIELDS).filter(function (k) { return k !== "any" && fc[k]; }).map(function (k) { return [k, G.FIELDS[k], fc[k]]; }), "fields");
    var wantHash = location.hash;
    readURL(); syncChips();
    var wantId = wantHash.indexOf("#p-") === 0 ? wantHash.slice(3) : "";
    if (wantId) openLinked(wantId, true);
    else render(true);
    prefetchDetail();
    if (wantId) wantDetail();
    if (location.hash.indexOf("#saved=") === 0) offerIds(keepIds(location.hash), "link");
    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#p-") === 0) { openLinked(location.hash.slice(3), false); wantDetail(); }
      else if (location.hash.indexOf("#saved=") === 0) offerIds(keepIds(location.hash), "link");
    });
  }).catch(function (err) {
    $("count").textContent = "Could not load the list.";
    if ($("countLive")) $("countLive").textContent = "Could not load the list.";
    $("out").innerHTML = '<div class="card empty" style="grid-column:1/-1"><h3>Something went wrong</h3><p>' + G.esc(err.message) + ". Reload the page, or open the <a href=\"data/entries.csv\">spreadsheet version</a>.</p></div>";
  });

  var qt;
  $("q").addEventListener("input", function (e) { clearTimeout(qt); var v = e.target.value; if (v.trim()) wantDetail(); qt = setTimeout(function () { state.q = v.trim(); typingRender = true; render(true); }, 160); });
  /* Enter (the phone Search key) runs the search now: no waiting for the typing timer, the keyboard closes, and focus moves to the count. */
  $("q").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    clearTimeout(qt);
    var v = e.target.value; if (v.trim()) wantDetail();
    state.q = v.trim(); typingRender = true; render(true);
    $("q").blur();
    var c = $("count"); if (c) c.focus();
  });
  ["age", "when", "season", "sort"].forEach(function (id) { $(id).addEventListener("change", function (e) { state[id] = e.target.value; if (id === "age") { savePrefs(); hidePrefNote(); } render(true); }); });
  $("goalChips").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-goal]"); if (!b) return;
    var k = b.dataset.goal, off = goalOn(k);
    state.types = off ? [] : GOALS[k].types.slice();
    state.paid = off ? [] : GOALS[k].paid.slice();
    syncChips(); render(true);
  });
  $("onlyVerified").addEventListener("click", function () { state.verified = !state.verified; syncChips(); render(true); });
  $("noPermit").addEventListener("click", function () { state.noPermit = !state.noPermit; syncChips(); render(true); });
  $("savedOnly").addEventListener("click", function () { state.saved = !state.saved; syncChips(); render(true); });
  $("viewCards").addEventListener("click", function () { state.view = "cards"; syncChips(); render(false); });
  $("viewDates").addEventListener("click", function () { state.view = "dates"; syncChips(); render(false); });
  /* The button hides itself once nothing is picked, so focus moves to the first summary chip instead of dropping to the page. */
  $("reset").addEventListener("click", function () { resetAll(); var c = $("fsumChips").querySelector(".fchip"); if (c) c.focus(); });
  document.addEventListener("click", function (ev) {
    var rx = ev.target.closest("[data-relax]");
    if (rx) { clearOne(rx.getAttribute("data-relax")); return; }
    if (ev.target.closest("[data-online-off]")) { state.moreOnline = false; syncChips(); render(true); var rs = $("count"); if (rs) rs.focus(); return; }
    if (ev.target.closest("[data-relax-saved]")) { resetFilters(true); focusFirst(); return; }
    var cal = ev.target.closest("[data-cal]");
    if (cal) {
      var ce = L.calEvent(byId[cal.getAttribute("data-cal")], now());
      if (ce) { G.download(ce.file, L.icsEvent(ce), "text/calendar"); G.toast("Calendar file saved. Open it to add the deadline, or use Google Calendar."); }
      return;
    }
    var s = ev.target.closest(".star");
    if (s) {
      var on = G.saved.toggle(s.getAttribute("data-id"));
      s.setAttribute("aria-pressed", String(on)); s.innerHTML = starInner(on);
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
      var el = document.getElementById("p-" + id); if (el) { el.scrollIntoView({ behavior: G.motionOK() ? "smooth" : "auto", block: "center" }); el.querySelector("details").open = true; if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); }
      wantDetail();
    }
  });
  $("printList").addEventListener("click", function () {
    var ids = savedIds(), keep = all.filter(function (e) { return ids.indexOf(e.id) > -1; });
    /* the same "Last checked" date the page footer shows, so a paper copy can be dated */
    var foot = document.querySelector(".foot b"), checked = foot ? foot.textContent.trim() : "";
    var d = document.createElement("div");
    d.innerHTML = "<h1>My internship list</h1><ol>" + keep.map(function (e) {
      /* only the parts a program has: no "()" and no empty line */
      var line = "<li><b>" + G.esc(e.name) + "</b>";
      if (e.org) line += " (" + G.esc(e.org) + ")";
      if (e.deadline_text) line += "<br>" + G.esc(e.deadline_text);
      if (e.url) line += "<br>" + G.esc(e.url);
      return line + "</li>";
    }).join("") + "</ol>" + (checked ? "<p>Last checked " + G.esc(checked) + ".</p>" : "") + "<p>From vadneyk.github.io/internships. Confirm dates on each program's own site.</p>";
    G.printOnly(d, "My internship list");
  });
  /* The text for Copy my list, Text it to myself and Email it to myself. It starts with the site address, then one block per saved program,
     in the order they were saved, with what a parent asks first: ages, pay, who can apply and the next date. */
  var SITE_URL = "https://vadneyk.github.io/internships/", MAIL_SUBJECT = "My first job list";
  function listText() {
    var items = savedIds().map(function (id) { return byId[id]; }).filter(Boolean).map(function (e) {
      return "- " + e.name + " (" + (e.org || "") + ")\n  " + L.ageText(e) + ". " + (G.PAID[e.paid_type] || "Pay not stated") + "." +
        (e.limited ? " Only some can apply: check who." : "") + "\n  Dates: " + (e.deadline_text || "No date posted yet. Ask them.") + "\n  " + (e.url || "");
    }).join("\n");
    return items ? SITE_URL + "\n\n" + items : "";
  }
  /* The two message links get their href when they are clicked, from the list as it is then. Nothing is sent by us; the teen's own messages app opens. */
  $("textList").addEventListener("click", function () {
    var txt = listText();
    this.href = txt && L.smsHref ? L.smsHref(txt) : "sms:";
  });
  $("emailList").addEventListener("click", function () {
    var txt = listText();
    this.href = txt && L.mailtoHref ? L.mailtoHref(MAIL_SUBJECT, txt) : "mailto:";
  });
  $("copyList").addEventListener("click", function () {
    G.copy(listText() || "Your list is empty.");
  });

  /* Keep my list without an account (docs/adr/0008). Everything below runs in the browser. Nothing is sent by us, and no address is stored. */
  /* keepIds reads a #saved= hash (or an array from a backup file): only slug-shaped ids, each once, in order, at most max of them
     (KEEP_MAX for a link, so it stays short enough to text). Anything else is dropped, never an error. It lives here, not in lib.js,
     because only this page uses it and lib.js loads on every page. G.keepIds is a test hook. */
  var KEEP_MAX = 40, KEEP_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
  function keepIds(src, max) {
    var raw = typeof src === "string" ? src.replace(/^#?saved=/, "").split(",") : Array.isArray(src) ? src : [], out = [], lim = max > 0 ? max : KEEP_MAX;
    raw.forEach(function (id) {
      if (typeof id !== "string") return;
      try { id = decodeURIComponent(id.trim()); } catch (e) { return; }
      if (KEEP_ID.test(id) && out.indexOf(id) < 0 && out.length < lim) out.push(id);
    });
    return out;
  }
  G.keepIds = keepIds; G.KEEP_MAX = KEEP_MAX;
  function savedItems() { return savedIds().map(function (id) { return byId[id]; }).filter(Boolean); }
  function nProg(n) { return n + (n === 1 ? " program" : " programs"); }
  /* The link that opens this list anywhere: find.html#saved=id1,id2 (the first KEEP_MAX ids). */
  function keepHref() { return SITE_URL + "find.html#saved=" + keepIds(savedIds()).join(","); }
  /* A plain text file of the list: one numbered block per program with its place, ages, pay, dates and official page. */
  function fileText() {
    var items = savedItems(), out = ["My internship list", "From the Teen Internship Guide: " + SITE_URL, "Open this list again: " + keepHref(), ""];
    items.forEach(function (e, i) {
      out.push((i + 1) + ". " + e.name + (e.org ? " (" + e.org + ")" : ""));
      out.push("   Where: " + (e.city || "Not stated"));
      out.push("   " + L.ageText(e) + ". " + (G.PAID[e.paid_type] || "Pay not stated") + "." + (e.limited ? " Only some can apply: check who." : ""));
      out.push("   Dates: " + (e.deadline_text || "No date posted yet. Ask them."));
      out.push("   Official page: " + (G.safeUrl(e.url) || "Not stated"));
      out.push("");
    });
    out.push("Confirm ages, pay and dates on each program's own page. The guide is a free student resource with no accounts and no tracking.");
    return out.join("\n");
  }
  $("downloadList").addEventListener("click", function () {
    G.download("my-internship-list.txt", fileText(), "text/plain");
    G.toast("Saved my-internship-list.txt to your device");
  });
  /* Send to a parent: a mail to nobody yet. The teen types the address in their own mail app. */
  var PARENT_SUBJECT = "My internship list: can you take a look?";
  function parentText() {
    var items = savedItems();
    return "Hi,\n\nI made a list of " + nProg(items.length) + " I want to apply to. It comes from the Teen Internship Guide (" + SITE_URL + "), a free guide that students help run. It is not an official site, and it has no accounts, no sign-up and no tracking, so nobody there sees this email or my list.\n\nEach program links to its own official page, so we can check the ages, pay and dates together:\n\n" +
      items.map(function (e) {
        return "- " + e.name + (e.org ? " (" + e.org + ")" : "") + "\n  " + L.ageText(e) + ". " + (G.PAID[e.paid_type] || "Pay not stated") + ".\n  Dates: " + (e.deadline_text || "No date posted yet.") + "\n  " + (G.safeUrl(e.url) || "");
      }).join("\n") + "\n\nOpen my list on your phone or computer: " + keepHref() + "\n\nThanks!";
  }
  $("parentList").addEventListener("click", function () {
    this.href = savedIds().length ? L.mailtoHref(PARENT_SUBJECT, parentText()) : "mailto:";
  });
  $("keepLink").addEventListener("click", function () { G.copy(keepHref()); });
  $("exportList").addEventListener("click", function () {
    G.download("my-internship-list.json", JSON.stringify({ guide: SITE_URL, saved: savedIds() }, null, 1), "application/json");
    G.toast("Saved my-internship-list.json. Load a backup file brings it back on any device.");
  });
  $("importList").addEventListener("click", function () { $("importFile").click(); });
  $("importFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = "";
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var ids = [];
      try { var j = JSON.parse(r.result); ids = keepIds(Array.isArray(j) ? j : j && j.saved, 500); } catch (e) {}
      offerIds(ids, "file");
    };
    r.onerror = function () { G.toast("Could not read that file"); };
    r.readAsText(f);
  });
  /* Ask before merging: a #saved= link or a backup file names programs. Say how many are new and add them only on a tap. The list never loses what it has. */
  var offered = [];
  function offerIds(ids, from, tried) {
    /* with only a place's part of the data loaded, an id outside it needs the whole file first (once) */
    if (part && !tried && ids.some(function (id) { return !byId[id]; })) { var again = function () { offerIds(ids, from, true); }; goFull().then(again, again); return; }
    var src = from === "file" ? "This file" : "This link", have = G.saved.ids();
    var known = ids.filter(function (id) { return Object.prototype.hasOwnProperty.call(byId, id); });
    offered = known.filter(function (id) { return have.indexOf(id) < 0; });
    if (!offered.length) {
      $("keepAsk").hidden = true; dropKeepHash();
      G.toast(known.length ? "Your list already has " + (known.length === 1 ? "this program" : "these " + known.length + " programs") : src + " has no programs that are on the list now");
      return;
    }
    var n = offered.length, old = known.length - n;
    $("keepAskH").textContent = "Add " + nProg(n) + " to your list?";
    $("keepAskP").textContent = src + " has " + nProg(n) + " that " + (n === 1 ? "is" : "are") + " not on your list yet" + (old ? ", and " + old + " you already saved" : "") + ". Your list keeps what is on it. Nothing is added until you tap Add.";
    $("keepAsk").hidden = false;
    $("keepAskH").focus();
  }
  function dropKeepHash() {
    if (location.hash.indexOf("#saved=") === 0) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }
  $("keepAdd").addEventListener("click", function () {
    var n = offered.length;
    offered.forEach(function (id) { if (!G.saved.has(id)) G.saved.toggle(id); });
    offered = []; $("keepAsk").hidden = true; dropKeepHash();
    state.saved = true; syncChips(); render(true);
    G.toast(!G.saved.kept ? "This browser will not keep your list. Use Copy my list before you leave." : "Added " + nProg(n) + " to your list");
    $("savedOnly").focus();
  });
  $("keepSkip").addEventListener("click", function () {
    offered = []; $("keepAsk").hidden = true; dropKeepHash();
    G.toast("Nothing was added");
    $("savedOnly").focus();
  });
})();
