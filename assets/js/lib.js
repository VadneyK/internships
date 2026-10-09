/*
  Pure logic for the program list: labels, dates, "effective status", filtering and ranking.
  No DOM access, so it can be tested in Node (tests/lib.test.mjs) and reused by any page.
  Works in the browser as window.TIG.lib and in Node as module.exports.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else { root.TIG = root.TIG || {}; root.TIG.lib = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var REGIONS = [
    ["davis", "Davis"], ["sacramento", "Sacramento"], ["yolo", "Yolo County"],
    ["silicon-valley", "Silicon Valley"], ["san-jose", "San Jose"], ["peninsula", "Peninsula"], ["fremont", "Fremont"],
    ["oakland", "Oakland"], ["berkeley", "Berkeley"], ["alameda", "Alameda"], ["east-bay", "East Bay"],
    ["san-francisco", "San Francisco"], ["statewide", "California"],
    ["orange-county", "Orange County"], ["los-angeles", "Los Angeles"], ["inland-empire", "Inland Empire"], ["san-diego", "San Diego"],
    ["atlanta", "Atlanta"], ["georgia", "Georgia"], ["new-york-city", "New York City"], ["new-york-state", "New York State"],
    ["chicago", "Chicago area"], ["illinois", "Illinois"],
    ["seattle", "Seattle area"],
    ["washington", "Washington State"],
    ["vancouver", "Vancouver, BC"],
    ["british-columbia", "British Columbia"],
    ["austin", "Austin"],
    ["texas", "Texas"],
    ["twin-cities", "Minneapolis and St. Paul"],
    ["minnesota", "Minnesota"],
    ["champaign", "Champaign-Urbana"],
    ["madison", "Madison"],
    ["wisconsin", "Wisconsin"],
    ["lafayette", "West Lafayette"],
    ["bloomington", "Bloomington, Indiana"],
    ["indiana", "Indiana"],
    ["columbus", "Columbus"],
    ["cincinnati", "Cincinnati"],
    ["ohio", "Ohio"],
    ["ann-arbor", "Ann Arbor"],
    ["lansing", "Lansing and East Lansing"],
    ["michigan", "Michigan"],
    ["triangle", "Raleigh and Chapel Hill"],
    ["north-carolina", "North Carolina"],
    ["college-park", "College Park, Maryland"],
    ["maryland", "Maryland"],
    ["fairfax", "Fairfax, Virginia"],
    ["charlottesville", "Charlottesville"],
    ["blacksburg", "Blacksburg"],
    ["virginia", "Virginia"],
    ["new-brunswick", "Central New Jersey"],
    ["new-jersey", "New Jersey"],
    ["pittsburgh", "Pittsburgh"],
    ["philadelphia", "Philadelphia"],
    ["pennsylvania", "Pennsylvania"],
    ["boston", "Boston"],
    ["massachusetts", "Massachusetts"],
    ["santa-barbara", "Santa Barbara"],
    ["merced", "Merced"],
    ["virtual", "Online"], ["national", "National"]
  ];
  /* Hubs group the regions into the areas teens recognize. [id, label, region ids] */
  var HUBS = [
    ["davis", "Davis and Sacramento", ["davis", "sacramento", "yolo"]],
    ["sv", "Silicon Valley", ["silicon-valley", "san-jose", "peninsula", "fremont"]],
    ["oak", "Oakland and East Bay", ["oakland", "berkeley", "alameda", "east-bay"]],
    ["sf", "San Francisco", ["san-francisco"]],
    ["state", "California-wide", ["statewide"]],
    ["socal", "Southern California", ["orange-county", "los-angeles", "inland-empire", "san-diego", "santa-barbara"]],
    ["atl", "Atlanta and Georgia", ["atlanta", "georgia"]],
    ["nyc", "New York", ["new-york-city", "new-york-state"]],
    ["chi", "Chicago and Illinois", ["chicago", "illinois"]],
    ["cv", "Merced and Central Valley", ["merced"]],
    ["sea", "Seattle and Washington", ["seattle", "washington"]],
    ["van", "Vancouver, BC", ["vancouver", "british-columbia"]],
    ["aus", "Austin and Texas", ["austin", "texas"]],
    ["midwest", "Midwest campuses", ["twin-cities", "champaign", "madison", "lafayette", "bloomington", "columbus", "cincinnati", "ann-arbor", "lansing", "minnesota", "wisconsin", "indiana", "ohio", "michigan"]],
    ["east", "East Coast", ["triangle", "college-park", "fairfax", "charlottesville", "blacksburg", "new-brunswick", "pittsburgh", "philadelphia", "boston", "north-carolina", "maryland", "virginia", "new-jersey", "pennsylvania", "massachusetts"]],
    ["online", "Online and national", ["virtual", "national"]]
  ];
  /* Cities and areas for the "Where" picker. [id, label, region ids]. A teen picks a city; a city covers its metro region plus its state-wide programs. */
  var CITIES = [
    ["davis", "Davis and Sacramento", ["davis", "yolo", "sacramento", "statewide"]],
    ["berkeley", "Berkeley and the East Bay", ["berkeley", "oakland", "alameda", "east-bay", "statewide"]],
    ["san-francisco", "San Francisco", ["san-francisco", "statewide"]],
    ["silicon-valley", "Silicon Valley and San Jose", ["silicon-valley", "san-jose", "peninsula", "fremont", "statewide"]],
    ["merced", "Merced", ["merced", "statewide"]],
    ["los-angeles", "Los Angeles", ["los-angeles", "statewide"]],
    ["irvine", "Irvine and Orange County", ["orange-county", "statewide"]],
    ["pomona", "Pomona", ["los-angeles", "inland-empire", "statewide"]],
    ["riverside", "Riverside", ["inland-empire", "statewide"]],
    ["san-diego", "San Diego", ["san-diego", "statewide"]],
    ["santa-barbara", "Santa Barbara", ["santa-barbara", "statewide"]],
    ["seattle", "Seattle", ["seattle", "washington"]],
    ["vancouver", "Vancouver, BC", ["vancouver", "british-columbia"]],
    ["austin", "Austin", ["austin", "texas"]],
    ["minneapolis", "Minneapolis and St. Paul", ["twin-cities", "minnesota"]],
    ["chicago", "Chicago", ["chicago", "illinois"]],
    ["elgin", "Elgin", ["chicago", "illinois"]],
    ["urbana-champaign", "Urbana-Champaign", ["champaign", "illinois"]],
    ["madison", "Madison", ["madison", "wisconsin"]],
    ["west-lafayette", "West Lafayette", ["lafayette", "indiana"]],
    ["bloomington", "Bloomington, Indiana", ["bloomington", "indiana"]],
    ["columbus", "Columbus", ["columbus", "ohio"]],
    ["cincinnati", "Cincinnati", ["cincinnati", "ohio"]],
    ["ann-arbor", "Ann Arbor", ["ann-arbor", "michigan"]],
    ["east-lansing", "East Lansing", ["lansing", "michigan"]],
    ["raleigh-chapel-hill", "Raleigh and Chapel Hill", ["triangle", "north-carolina"]],
    ["college-park", "College Park, Maryland", ["college-park", "maryland"]],
    ["fairfax", "Fairfax, Virginia", ["fairfax", "virginia"]],
    ["charlottesville", "Charlottesville", ["charlottesville", "virginia"]],
    ["blacksburg", "Blacksburg", ["blacksburg", "virginia"]],
    ["new-brunswick", "New Brunswick, New Jersey", ["new-brunswick", "new-jersey"]],
    ["new-york-city", "New York City", ["new-york-city", "new-york-state"]],
    ["philadelphia", "Philadelphia", ["philadelphia", "pennsylvania"]],
    ["pittsburgh", "Pittsburgh", ["pittsburgh", "pennsylvania"]],
    ["boston", "Boston", ["boston", "massachusetts"]],
    ["atlanta", "Atlanta", ["atlanta", "georgia"]]
  ];
  /* Areas are groups of cities, in the words teens and leaders use. [id, label, city ids] */
  var AREAS = [
    ["bay-area", "Bay Area", ["berkeley", "san-francisco", "silicon-valley"]],
    ["inland-socal", "Inland Southern California", ["pomona", "riverside"]],
    ["west-coast", "West Coast", ["davis", "berkeley", "san-francisco", "silicon-valley", "merced", "los-angeles", "irvine", "pomona", "riverside", "san-diego", "santa-barbara", "seattle", "vancouver"]],
    ["pacific-northwest", "Pacific Northwest", ["seattle", "vancouver"]],
    ["texas", "Texas", ["austin"]],
    ["midwest", "Midwest", ["minneapolis", "chicago", "elgin", "urbana-champaign", "madison", "west-lafayette", "bloomington", "columbus", "cincinnati", "ann-arbor", "east-lansing"]],
    ["northeast", "Northeast", ["new-york-city", "new-brunswick", "philadelphia", "pittsburgh", "boston"]],
    ["dc-area", "DC area", ["college-park", "fairfax"]],
    ["east-coast", "East Coast", ["new-york-city", "new-brunswick", "philadelphia", "pittsburgh", "boston", "college-park", "fairfax", "charlottesville", "blacksburg", "raleigh-chapel-hill"]],
    ["southeast", "Southeast", ["atlanta", "raleigh-chapel-hill", "charlottesville", "blacksburg"]]
  ];
  var _placeCache = {};
  /* "city:boston" or "area:midwest" to the region ids it covers, or null if unknown */
  function placeRegions(place) {
    if (_placeCache[place]) return _placeCache[place];
    var m = /^(city|area):(.+)$/.exec(place || ""), out = null;
    function city(id) { for (var i = 0; i < CITIES.length; i++) if (CITIES[i][0] === id) return CITIES[i]; return null; }
    if (m && m[1] === "city" && city(m[2])) out = CITIES[CITIES.indexOf(city(m[2]))][2].slice();
    if (m && m[1] === "area") {
      for (var a = 0; a < AREAS.length; a++) if (AREAS[a][0] === m[2]) {
        out = []; AREAS[a][2].forEach(function (cid) { var c = city(cid); if (c) c[2].forEach(function (r) { if (r !== "statewide" && out.indexOf(r) < 0) out.push(r); }); });
      }
    }
    if (out) _placeCache[place] = out;
    return out;
  }
  function placeLabel(place) {
    var m = /^(city|area):(.+)$/.exec(place || ""); if (!m) return "";
    var list = m[1] === "city" ? CITIES : AREAS;
    for (var i = 0; i < list.length; i++) if (list[i][0] === m[2]) return list[i][1];
    return "";
  }
  /* the hubs a place touches, used to show known gaps */
  function hubsOfPlace(place) {
    var rs = placeRegions(place) || [], out = [];
    HUBS.forEach(function (h) { if (h[2].some(function (r) { return rs.indexOf(r) > -1; })) out.push(h[0]); });
    return out;
  }
  var TYPES = {
    "paid-youth-program": "Paid youth program", "internship": "Internship", "research": "Research",
    "volunteer": "Volunteer", "shadowing": "Job shadowing", "pre-college": "Pre-college",
    "apprenticeship-trades": "Trades", "civic-government": "Government and civic", "virtual": "Online",
    "entrepreneurship": "Start something", "school-pathway": "School pathway", "leadership": "Leadership"
  };
  var FIELDS = {
    "health": "Health", "tech-cs": "Tech and coding", "engineering": "Engineering", "science": "Science",
    "environment": "Environment", "arts-media": "Arts and media", "business-finance": "Business and money",
    "law-government": "Law and government", "education": "Teaching and kids", "trades": "Trades",
    "social-impact": "Community", "food-hospitality": "Food and hospitality", "sports": "Sports", "any": "Any interest"
  };
  var PAID = {
    "paid": "Paid", "stipend": "Stipend", "unpaid": "Unpaid", "unpaid-credit": "Unpaid, school credit",
    "fee-based": "Costs money", "mixed": "Mixed"
  };
  var PAID_GROUPS = [
    ["pay", "Paid or stipend", ["paid", "stipend", "mixed"]],
    ["free", "Free or volunteer", ["unpaid", "unpaid-credit"]],
    ["fee", "Costs money", ["fee-based"]]
  ];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function regionLabel(id) { for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i][0] === id) return REGIONS[i][1]; return ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function parseISO(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function fmtDate(d) { return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  function startOfDay(now) { var d = new Date(now || Date.now()); d.setHours(0, 0, 0, 0); return d; }
  function daysUntil(d, now) { return Math.round((d - startOfDay(now)) / 86400000); }

  /* Which state's rules apply to a program: ca, ga, ny, il, or "" (federal basics only). Every region is listed on purpose: an unlisted region falls back to "" so it never shows another state's permit text. */
  var STATE_OF = {
    davis: "ca", sacramento: "ca", yolo: "ca", "silicon-valley": "ca", "san-jose": "ca", peninsula: "ca", fremont: "ca",
    oakland: "ca", berkeley: "ca", alameda: "ca", "east-bay": "ca", "san-francisco": "ca", statewide: "ca",
    "orange-county": "ca", "los-angeles": "ca", "inland-empire": "ca", "san-diego": "ca",
    atlanta: "ga", georgia: "ga", "new-york-city": "ny", "new-york-state": "ny", chicago: "il", illinois: "il",
    seattle: "wa", washington: "wa", vancouver: "bc", "british-columbia": "bc", austin: "tx", texas: "tx", "twin-cities": "mn", minnesota: "mn", champaign: "il", madison: "wi", wisconsin: "wi", lafayette: "in", bloomington: "in", indiana: "in", columbus: "oh", cincinnati: "oh", ohio: "oh", "ann-arbor": "mi", lansing: "mi", michigan: "mi", triangle: "nc", "north-carolina": "nc", "college-park": "md", maryland: "md", fairfax: "va", charlottesville: "va", blacksburg: "va", virginia: "va", "new-brunswick": "nj", "new-jersey": "nj", pittsburgh: "pa", philadelphia: "pa", pennsylvania: "pa", boston: "ma", massachusetts: "ma", "santa-barbara": "ca", merced: "ca",
    virtual: "", national: ""
  };
  function stateOf(e) {
    var rs = e.regions || [];
    for (var i = 0; i < rs.length; i++) {
      if (Object.prototype.hasOwnProperty.call(STATE_OF, rs[i]) && STATE_OF[rs[i]]) return STATE_OF[rs[i]];
    }
    return "";
  }

  /*
    Which permit a teen needs: data is data/permits.json, st a state id (ca, ga, ny, il), age 12 to 18, kind one of data.kinds.
    verdict: need, none, ask (the pages we read do not say), young, adult, or nostate.
  */
  /* States whose rules are in data/permits.json. Add a state here in the same change that adds it there (a test checks they match). */
  var PERMIT_STATES = ["ca", "ga", "ny", "il", "wa", "tx", "mn", "wi", "in", "oh", "mi", "nc", "md", "va", "nj", "pa", "ma", "bc"];
  function permitFor(data, st, age, kind) {
    var s = data && data.states && data.states[st];
    if (!s) return { verdict: "nostate", headline: "We have not read your state yet", text: "We have read California, Georgia, New York and Illinois. Ask your school office or your state labor department. The US Department of Labor lists them at dol.gov/agencies/whd/contact/state-labor-offices." };
    var a = +age, k = s.kinds[kind];
    if (!k || !(a >= 0)) return null;
    var base = { state: st, stateName: s.name, permit: s.permit, kind: kind, age: a };
    var band = a >= 16 ? "16" : a >= 14 ? "14" : a >= 12 ? "12" : "";
    base.hours = band ? (s.hours[band] || "") : "";
    base.wage = s.wage;
    var jobLike = kind === "job" || kind === "program" || kind === "family";
    if (a >= 18) return Object.assign(base, { verdict: "adult", headline: "You do not need a youth work permit", text: s.adult });
    if (jobLike && a < s.minAge.job) return Object.assign(base, { verdict: "young", headline: "Most paid jobs start at 14", text: s.minAge.note + " Odd jobs for neighbors and volunteering are the usual first steps." });
    if (k.permit === true) {
      if (a >= s.needBelow) return Object.assign(base, { verdict: "none", headline: "You do not need a permit at " + a, text: s.adult });
      return Object.assign(base, { verdict: "need", headline: "You need a " + s.permit, text: k.text });
    }
    if (k.permit === false) return Object.assign(base, { verdict: "none", headline: "You do not need a permit for this", text: k.text });
    return Object.assign(base, { verdict: "ask", headline: "Check before you start", text: k.text });
  }

  /*
    Check a weekly availability plan against the hour limits we read for an age and state.
    limits is permits.json states[st].limits; days is 7 items (Monday first) of {from, to} in 24 hour numbers or null.
    This checks the hours a teen offers, which is more than they would be scheduled, so it is a heads-up, not a ruling.
  */
  var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function hoursCheck(limits, age, inSchool, days) {
    var a = +age, band = a >= 16 ? "16" : a >= 14 ? "14" : "";
    var total = 0, per = days.map(function (d) { return d && d.from != null && d.to != null && d.to > d.from ? d.to - d.from : 0; });
    per.forEach(function (h) { total += h; });
    var out = { total: total, perDay: per, problems: [], limited: false };
    var lim = band && limits ? limits[band] : null;
    if (!lim) return out;
    out.limited = true;
    days.forEach(function (d, i) {
      if (!per[i]) return;
      var schoolDay = inSchool && (lim.weekdayOnly ? i <= 3 : i <= 4);
      var max = schoolDay ? lim.schoolDay : lim.nonSchoolDay;
      if (per[i] > max) out.problems.push(DAY_NAMES[i] + ": " + per[i] + " hours is more than the " + max + " hour limit on " + (schoolDay ? "a school day" : "a day off from school") + " at " + a + ".");
      var latest = !inSchool && lim.latestSummer ? lim.latestSummer : lim.latest;
      if (d.from < lim.earliest) out.problems.push(DAY_NAMES[i] + ": starting before " + lim.earliest + " a.m. is not allowed at " + a + ".");
      if (d.to > latest) out.problems.push(DAY_NAMES[i] + ": working past " + (latest > 12 ? latest - 12 + " p.m." : latest + " a.m.") + " is not allowed at " + a + ".");
    });
    var cap = inSchool ? lim.schoolWeek : lim.offWeek;
    if (total > cap) out.problems.push("The week adds up to " + total + " hours, more than the " + cap + " hour limit " + (inSchool ? "while school is in session" : "when school is out") + " at " + a + ".");
    return out;
  }

  /*
    A first paycheck estimate from sourced items only. data is data/money.json. Each tax is rounded to the cent on its own line, the way a pay stub does.
    Income tax is not estimated: it depends on the W-4 and the state form.
  */
  function cents(x) { return Math.round((x + 1e-9) * 100) / 100; }
  function paycheck(data, presetId, wage, hours, parentBiz) {
    var p = null; data.presets.forEach(function (x) { if (x.id === presetId) p = x; });
    if (!p || wage === "" || hours === "" || wage == null || hours == null) return null;
    var w = +wage, h = +hours;
    if (!(w >= 0) || !(h >= 0)) return null;
    var r = data.rates, gross = cents(w * h), lines = [], left = gross;
    function add(key, label, amt) { lines.push({ key: key, label: label, amount: amt }); left = cents(left - amt); }
    if (!parentBiz) { add("ss", "Social Security", cents(gross * r.ss)); add("medicare", "Medicare", cents(gross * r.medicare)); }
    if (p.extra.indexOf("sdi") > -1) add("sdi", "California SDI", cents(gross * r.sdi));
    if (p.extra.indexOf("pfl") > -1) add("pfl", "NY Paid Family Leave", cents(gross * r.pfl));
    var out = { gross: gross, lines: lines, left: left, state: p.state, parentBiz: !!parentBiz };
    if (p.extra.indexOf("pfl") > -1) out.possibleDisability = Math.min(cents(gross * r.nyDisabilityRate), r.nyDisabilityWeekCap);
    return out;
  }

  function hubsOf(e) {
    var out = [];
    HUBS.forEach(function (h) {
      if ((e.regions || []).some(function (r) { return h[2].indexOf(r) > -1; })) out.push(h[0]);
    });
    return out;
  }

  /*
    The status stored in the data can go stale (a deadline passes, an opening date arrives).
    effStatus fixes that in the browser so a card never says "Open now" after its deadline.
  */
  function effStatus(e, now) {
    var today = startOfDay(now), s = e.status;
    var close = parseISO(e.deadline_iso), opens = parseISO(e.opens_iso);
    if ((s === "open-now" || s === "opens-soon") && close && close < today) return "closed-expect-reopen";
    if (s === "opens-soon" && opens && opens <= today) return "open-now";
    return s;
  }
  function futureDeadline(e, now) {
    var d = parseISO(e.deadline_iso);
    if (!d || d < startOfDay(now)) return null;
    var st = effStatus(e, now);
    return st === "open-now" || st === "opens-soon" || st === "rolling" || st === "event" ? d : null;
  }
  function isOpenish(e, now) { var s = effStatus(e, now); return s === "open-now" || s === "opens-soon"; }
  function isAnytime(e, now) { var s = effStatus(e, now); return s === "rolling" || s === "year-round" || s === "event"; }

  function ageOk(e, age) {
    if (!age) return true;
    var a = +age;
    if (e.min_age != null && e.min_age > a) return false;
    if (e.max_age != null && e.max_age < a) return false;
    return true;
  }

  /* state: {q, hubs[], age, when, season, paid[], types[], fields[], verified, noPermit, saved, savedIds[]} */
  function matches(e, s, now) {
    if (s.place) {
      var pr = placeRegions(s.place), rs = e.regions || [];
      if (pr && !pr.some(function (r) { return rs.indexOf(r) > -1; }) && !(s.placeOnline && (rs.indexOf("virtual") > -1 || rs.indexOf("national") > -1))) return false;
    }
    if (s.hubs && s.hubs.length && !hubsOf(e).some(function (h) { return s.hubs.indexOf(h) > -1; })) return false;
    if (!ageOk(e, s.age)) return false;
    if (s.when === "open" && !isOpenish(e, now)) return false;
    if (s.when === "60") { var d = futureDeadline(e, now); if (!d || daysUntil(d, now) > 60) return false; }
    if (s.when === "anytime" && !isAnytime(e, now)) return false;
    if (s.when === "closed" && effStatus(e, now) !== "closed-expect-reopen") return false;
    if (s.season && e.season !== s.season && e.season !== "year-round") return false;
    if (s.paid && s.paid.length) {
      var ok = PAID_GROUPS.some(function (g) { return s.paid.indexOf(g[0]) > -1 && g[2].indexOf(e.paid_type) > -1; });
      if (!ok) return false;
    }
    if (s.types && s.types.length && s.types.indexOf(e.type) === -1) return false;
    if (s.fields && s.fields.length && !(e.fields || []).some(function (f) { return f === "any" || s.fields.indexOf(f) > -1; })) return false;
    if (s.verified && e.verified !== "fetched") return false;
    if (s.noPermit && e.needs_work_permit === true) return false;
    if (s.saved && (s.savedIds || []).indexOf(e.id) === -1) return false;
    if (s.q) {
      var hay = [e.name, e.org, e.city, e.what_you_do, e.notes, e.who_can_apply, (e.regions || []).map(regionLabel).join(" "), TYPES[e.type]].join(" ").toLowerCase();
      var words = s.q.toLowerCase().split(/\s+/).filter(Boolean);
      var padded = " " + hay.replace(/[^a-z0-9]+/g, " ");
      /* each search word must start a word in the text, so "paid" does not match "unpaid" */
      if (!words.every(function (w) { return padded.indexOf(" " + w.replace(/[^a-z0-9]+/g, " ")) > -1; })) return false;
    }
    return true;
  }

  /* Lower rank sorts first: open with a deadline (soonest), open, anytime, closed, unknown; then priority, verified, name. */
  function rank(e, now) {
    var d = futureDeadline(e, now), st = effStatus(e, now), group;
    if (isOpenish(e, now) && d) group = 0;
    else if (isOpenish(e, now)) group = 1;
    else if (isAnytime(e, now)) group = 2;
    else if (st === "closed-expect-reopen") group = 3;
    else group = 4;
    return [group, group === 0 ? daysUntil(d, now) : 0, e.priority || 3, e.verified === "fetched" ? 0 : 1, e.name];
  }
  function compare(a, b, now) {
    var x = rank(a, now), y = rank(b, now);
    for (var i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
    return 0;
  }
  function sortList(list, mode, now) {
    var l = list.slice();
    if (mode === "name") l.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (mode === "deadline") l.sort(function (a, b) {
      var da = futureDeadline(a, now), db = futureDeadline(b, now);
      if (da && db) return da - db || compare(a, b, now);
      if (da) return -1; if (db) return 1; return compare(a, b, now);
    });
    else l.sort(function (a, b) { return compare(a, b, now); });
    return l;
  }
  function ageText(e) {
    var bits = [];
    if (e.min_age != null && e.max_age != null) bits.push("Ages " + e.min_age + " to " + e.max_age);
    else if (e.min_age != null) bits.push("Ages " + e.min_age + "+");
    else if (e.max_age != null) bits.push("Up to age " + e.max_age);
    if (e.grades) bits.push("Grades " + e.grades);
    return bits.join(" · ") || "All high school ages";
  }

  /* ---- Outreach plan helpers (playbook page) ---- */
  var STATUSES = [
    ["", "Not sent yet"], ["sent", "Sent"], ["replied", "They replied"], ["meeting", "Meeting set"], ["thanked", "Thanked them"]
  ];
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function toISO(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function addDays(iso, n) {
    var d = parseISO(iso); if (!d) return "";
    d.setDate(d.getDate() + n); return toISO(d);
  }
  /* The one-week follow-up date. Only people with status "sent" and a send date have one. */
  function followUpISO(p) { return p && p.s === "sent" && p.d ? addDays(p.d, 7) : ""; }
  function planSummary(people, now) {
    var named = people.filter(function (p) { return p && p.n && p.n.trim(); });
    var sent = named.filter(function (p) { return p.s; }).length;
    var today = toISO(startOfDay(now)), next = null;
    named.forEach(function (p) {
      var f = followUpISO(p);
      if (f && (!next || f < next.date)) next = { name: p.n.trim(), date: f, due: f <= today };
    });
    return { named: named.length, sent: sent, next: next };
  }
  function icsEscape(t) { return String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  /* One all-day calendar event as .ics text. dateISO is YYYY-MM-DD. */
  function icsEvent(o) {
    var day = o.dateISO.replace(/-/g, ""), end = addDays(o.dateISO, 1).replace(/-/g, "");
    var stamp = (o.stamp || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Teen Internship Guide//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:" + o.uid + "@vadneyk.github.io", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + icsEscape(o.title), "DESCRIPTION:" + icsEscape(o.desc), "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
  }
  function mailtoHref(subject, body) { return "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body); }
  function smsHref(body) { return "sms:?&body=" + encodeURIComponent(body); }
  /* Split "Subject: ...\n\nbody" into parts. */
  function splitMessage(msg) {
    var m = /^Subject:\s*(.*)\n\n([\s\S]*)$/.exec(msg);
    return m ? { subject: m[1], body: m[2] } : { subject: "", body: msg };
  }

  /* ---- Insights: counts for the charts. Pure, so it is tested. ---- */
  var STATUS_GROUPS = [
    ["open", "Open now", "open-now"], ["soon", "Opens soon", "opens-soon"], ["anytime", "Apply any time", "rolling,year-round,event"],
    ["closed", "Closed, back next cycle", "closed-expect-reopen"], ["unknown", "Dates not posted", "unconfirmed"]
  ];
  function insights(list, now) {
    var out = { total: list.length, status: [], ages: [], hubs: [], months: [], types: [], fields: [], facts: {} };
    STATUS_GROUPS.forEach(function (g) {
      out.status.push({ id: g[0], label: g[1], n: list.filter(function (e) { return g[2].split(",").indexOf(effStatus(e, now)) > -1; }).length });
    });
    for (var a = 13; a <= 18; a++) {
      var ok = list.filter(function (e) { return ageOk(e, a); });
      out.ages.push({ age: a, n: ok.length, paid: ok.filter(function (e) { return e.paid_type === "paid" || e.paid_type === "stipend" || e.paid_type === "mixed"; }).length });
    }
    HUBS.forEach(function (h) {
      var l = list.filter(function (e) { return hubsOf(e).indexOf(h[0]) > -1; });
      var row = { id: h[0], label: h[1], n: l.length };
      PAID_GROUPS.forEach(function (g) { row[g[0]] = l.filter(function (e) { return g[2].indexOf(e.paid_type) > -1; }).length; });
      if (row.n) out.hubs.push(row);
    });
    var byMonth = {};
    list.forEach(function (e) {
      var d = futureDeadline(e, now); if (!d) return;
      var k = d.getFullYear() * 100 + d.getMonth();
      (byMonth[k] = byMonth[k] || []).push({ name: e.name, id: e.id, date: toISO(d) });
    });
    Object.keys(byMonth).sort().forEach(function (k) {
      var y = Math.floor(k / 100), m = k % 100;
      out.months.push({ key: +k, label: MONTHS[m] + " " + y, n: byMonth[k].length, items: byMonth[k].sort(function (x, y2) { return x.date < y2.date ? -1 : 1; }) });
    });
    var sc = {};
    list.forEach(function (e) { var k = e.season || "year-round"; sc[k] = (sc[k] || 0) + 1; });
    out.seasons = [["summer", "Summer"], ["school-year", "School year"], ["fall", "Fall"], ["winter", "Winter"], ["spring", "Spring"], ["year-round", "Year-round"]].map(function (x) { return { id: x[0], label: x[1], n: sc[x[0]] || 0 }; });
    var tc = {}, fc = {};
    list.forEach(function (e) { tc[e.type] = (tc[e.type] || 0) + 1; (e.fields || []).forEach(function (f) { if (f !== "any") fc[f] = (fc[f] || 0) + 1; }); });
    out.types = Object.keys(tc).map(function (k) { return { id: k, label: TYPES[k] || k, n: tc[k] }; }).sort(function (a2, b) { return b.n - a2.n; });
    out.fields = Object.keys(fc).map(function (k) { return { id: k, label: FIELDS[k] || k, n: fc[k] }; }).sort(function (a2, b) { return b.n - a2.n; });
    var f = out.facts;
    f.fetched = list.filter(function (e) { return e.verified === "fetched"; }).length;
    f.noPermit = list.filter(function (e) { return e.needs_work_permit !== true; }).length;
    f.paid14 = list.filter(function (e) { return ageOk(e, 14) && (e.paid_type === "paid" || e.paid_type === "stipend"); }).length;
    f.free = list.filter(function (e) { return e.paid_type === "unpaid" || e.paid_type === "unpaid-credit"; }).length;
    f.cost = list.filter(function (e) { return e.paid_type === "fee-based"; }).length;
    var a15 = out.ages[2].n, a16 = out.ages[3].n;
    f.jump16 = a15 ? Math.round((a16 / a15 - 1) * 100) : 0;
    f.paidJump = out.ages[1].paid ? Math.round((out.ages[3].paid / out.ages[1].paid - 1) * 100) : 0;
    return out;
  }

  return {
    REGIONS: REGIONS, HUBS: HUBS, TYPES: TYPES, FIELDS: FIELDS, PAID: PAID, PAID_GROUPS: PAID_GROUPS, MONTHS: MONTHS, MONTH_NAMES: MONTH_NAMES,
    esc: esc, safeUrl: safeUrl, parseISO: parseISO, fmtDate: fmtDate, daysUntil: daysUntil, hubsOf: hubsOf,
    effStatus: effStatus, futureDeadline: futureDeadline, isOpenish: isOpenish, isAnytime: isAnytime, ageOk: ageOk,
    matches: matches, rank: rank, compare: compare, sortList: sortList, ageText: ageText,
    STATUSES: STATUSES, toISO: toISO, addDays: addDays, followUpISO: followUpISO, planSummary: planSummary,
    icsEvent: icsEvent, mailtoHref: mailtoHref, smsHref: smsHref, splitMessage: splitMessage, insights: insights, stateOf: stateOf, STATE_OF: STATE_OF, permitFor: permitFor, hoursCheck: hoursCheck, paycheck: paycheck, PERMIT_STATES: PERMIT_STATES, CITIES: CITIES, AREAS: AREAS, placeRegions: placeRegions, placeLabel: placeLabel, hubsOfPlace: hubsOfPlace
  };
});
