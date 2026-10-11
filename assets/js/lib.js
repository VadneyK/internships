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
  /* How the Where picker groups cities for a teen: a part of the country first, then the cities in it. Every city is in exactly one group.
     [label, area ids shown first as "All of ...", city ids]. This is how the picker is laid out, not a claim about how any network groups its cities. */
  var PICK_GROUPS = [
    ["California", ["bay-area"], ["davis", "berkeley", "san-francisco", "silicon-valley", "merced", "los-angeles", "irvine", "pomona", "riverside", "san-diego", "santa-barbara"]],
    ["Pacific Northwest", ["pacific-northwest"], ["seattle", "vancouver"]],
    ["Texas", ["texas"], ["austin"]],
    ["Midwest", ["midwest"], ["minneapolis", "chicago", "elgin", "urbana-champaign", "madison", "west-lafayette", "bloomington", "columbus", "cincinnati", "ann-arbor", "east-lansing"]],
    ["Northeast", ["northeast"], ["new-york-city", "new-brunswick", "philadelphia", "pittsburgh", "boston"]],
    ["South and DC area", ["southeast", "dc-area"], ["atlanta", "raleigh-chapel-hill", "charlottesville", "blacksburg", "college-park", "fairfax"]]
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
        out = []; AREAS[a][2].forEach(function (cid) { var c = city(cid); if (c) c[2].forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); }); });
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
    "fee-based": "Costs money", "mixed": "Mixed", "not-stated": "Pay not stated"
  };
  var PAID_GROUPS = [
    ["pay", "Paid or stipend", ["paid", "stipend", "mixed"]],
    ["free", "Free or volunteer", ["unpaid", "unpaid-credit"]],
    ["fee", "Costs money", ["fee-based"]],
    ["unknown", "Pay not stated", ["not-stated"]]
  ];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function regionLabel(id) { for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i][0] === id) return REGIONS[i][1]; return ""; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(u) { return typeof u === "string" && /^https?:\/\/[^\s\x00-\x1f\x7f]+$/i.test(u) ? u : ""; }
  function parseISO(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    var p = s.split("-"), y = +p[0], m = +p[1], day = +p[2];
    var d = new Date(y, m - 1, day);
    // Reject days that do not exist (for example 2027-02-30), because Date would roll them over to the next month.
    if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
    return d;
  }
  function fmtDate(d) { if (!(d instanceof Date) || isNaN(d.getTime())) return ""; return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
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

  /* The one state a saved area sits in (ca, ga, ...), or "" when it is unknown or spans states. */
  function stateFromPlace(place) {
    var rs = placeRegions(typeof place === "string" ? place : ""), st = "";
    if (!rs || !rs.length) return "";
    for (var i = 0; i < rs.length; i++) {
      var s = Object.prototype.hasOwnProperty.call(STATE_OF, rs[i]) ? STATE_OF[rs[i]] : "";
      if (!s || (st && s !== st)) return "";
      st = s;
    }
    return st;
  }

  /*
    Which permit a teen needs: data is data/permits.json, st a state id (ca, ga, ny, il), age 12 to 18, kind one of data.kinds.
    verdict: need, none, ask (the pages we read do not say), young, adult, or nostate.
  */
  /* States whose rules are in data/permits.json. Add a state here in the same change that adds it there (a test checks they match). */
  var PERMIT_STATES = ["ca", "ga", "ny", "il", "wa", "tx", "mn", "wi", "in", "oh", "mi", "nc", "md", "va", "nj", "pa", "ma", "bc"];
  function permitFor(data, st, age, kind) {
    var has = Object.prototype.hasOwnProperty, s = data && data.states && has.call(data.states, st) ? data.states[st] : null;
    if (!s) return { verdict: "nostate", headline: "We have not read your state yet", text: "We have read 17 states and British Columbia. Ask your school office or your state labor department. The US Department of Labor lists them at dol.gov/agencies/whd/contact/state-labor-offices." };
    var a = +age, k = s.kinds && has.call(s.kinds, kind) ? s.kinds[kind] : null;
    if (!k || !(a >= 0)) return null;
    /* An optional per-age override: kinds.x.under = {below, permit, text} replaces the answer for ages under "below". */
    var un = k.under;
    if (un && a < un.below) k = un;
    var jobLikeEarly = kind === "job" || kind === "program" || kind === "family";
    var base = { state: st, stateName: s.name, permit: s.permit, kind: kind, age: a };
    var band = a >= 18 ? "" : a >= 16 ? "16" : a >= 14 ? "14" : a >= 12 ? "12" : "";
    base.hours = band && !(jobLikeEarly && a < s.minAge.job) ? (s.hours[band] || "") : "";
    base.wage = s.wage;
    var jobLike = kind === "job" || kind === "program" || kind === "family";
    if (a >= 18) return Object.assign(base, { verdict: "adult", headline: "You do not need a youth work permit", text: s.adult });
    if (jobLike && a < s.minAge.job) return Object.assign(base, { verdict: "young", headline: "Most paid jobs start at 14", text: s.minAge.note + " See what you can do before 14." });
    if (k.permit === true) {
      if (a >= s.needBelow) return Object.assign(base, { verdict: "none", headline: "You do not need a permit at " + a, text: s.adult });
      return Object.assign(base, { verdict: "need", headline: "You need " + (/^[aeiou]/i.test(s.permit) ? "an " : "a ") + s.permit, text: k.text });
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
    var a = +age, band = a >= 18 ? "" : a >= 16 ? "16" : a >= 14 ? "14" : "";
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
      if (max != null && per[i] > max) out.problems.push(DAY_NAMES[i] + ": " + per[i] + " hours is more than the " + max + " hour limit on " + (schoolDay ? "a school day" : "a day off from school") + " at " + a + ".");
      var latest = !inSchool && lim.latestSummer != null ? lim.latestSummer : lim.latest;
      if (lim.earliest != null && d.from < lim.earliest) out.problems.push(DAY_NAMES[i] + ": starting before " + lim.earliest + " a.m. is not allowed at " + a + ".");
      if (latest != null && d.to > latest) out.problems.push(DAY_NAMES[i] + ": working past " + (latest > 12 ? latest - 12 + " p.m." : latest + " a.m.") + " is not allowed at " + a + ".");
    });
    var cap = inSchool ? lim.schoolWeek : lim.offWeek;
    if (cap != null && total > cap) out.problems.push("The week adds up to " + total + " hours, more than the " + cap + " hour limit " + (inSchool ? "while school is in session" : "when school is out") + " at " + a + ".");
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
  /*
    For the Find dates view and the calendar button only. Same as futureDeadline, plus a confirmed
    2026-27 date on a closed or unconfirmed card. It never feeds rank(), the 60 day filter or the status tags.
  */
  function knownDeadline(e, now) {
    var d = futureDeadline(e, now);
    if (d) return d;
    var st = effStatus(e, now);
    if (st !== "closed-expect-reopen" && st !== "unconfirmed") return null;
    if (e.deadline_confidence !== "confirmed-2026-27") return null;
    var k = parseISO(e.deadline_iso);
    return k && k >= startOfDay(now) ? k : null;
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

  /*
    Search text. Each entry's padded lowercase text is built once and kept in a WeakMap. The signature
    (lengths of notes and who_can_apply) makes it rebuild when the detail text is merged in later.
    The parsed words of the last query string are kept too, so one keystroke parses once, not once per program.
  */
  var _hay = typeof WeakMap === "function" ? new WeakMap() : null, _qStr = null, _qNeedles = [];
  function buildHaystack(e) {
    var hay = [e.name, e.org, e.city, e.what_you_do, e.notes, e.who_can_apply, (e.regions || []).map(regionLabel).join(" "), TYPES[e.type]].join(" ").toLowerCase();
    return " " + hay.replace(/[^a-z0-9]+/g, " ");
  }
  function haystack(e) {
    if (!_hay) return buildHaystack(e);
    var sig = (e.notes ? String(e.notes).length : -1) + ":" + (e.who_can_apply ? String(e.who_can_apply).length : -1);
    var c = _hay.get(e);
    if (!c || c.sig !== sig) { c = { sig: sig, text: buildHaystack(e) }; _hay.set(e, c); }
    return c.text;
  }
  function queryNeedles(q) {
    if (q !== _qStr) {
      _qNeedles = q.toLowerCase().split(/\s+/).filter(Boolean).map(function (w) { return " " + w.replace(/[^a-z0-9]+/g, " "); });
      _qStr = q;
    }
    return _qNeedles;
  }

  /* How many entries are in each city and area, in one pass. Same counts as matches(e, {place: key}) for every key. */
  function placeCounts(entries) {
    var keys = [], regs = [], counts = {}, i, j, k;
    CITIES.forEach(function (c) { keys.push("city:" + c[0]); });
    AREAS.forEach(function (a) { keys.push("area:" + a[0]); });
    for (i = 0; i < keys.length; i++) { regs.push(placeRegions(keys[i]) || null); counts[keys[i]] = 0; }
    for (j = 0; j < entries.length; j++) {
      var rs = entries[j].regions || [];
      for (i = 0; i < keys.length; i++) {
        var pr = regs[i];
        if (!pr) { counts[keys[i]]++; continue; }
        for (k = 0; k < pr.length; k++) if (rs.indexOf(pr[k]) > -1) { counts[keys[i]]++; break; }
      }
    }
    return counts;
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
    if (s.noPermit && e.needs_work_permit !== false) return false;
    if (s.saved && (s.savedIds || []).indexOf(e.id) === -1) return false;
    if (s.q) {
      var needles = queryNeedles(s.q), padded = haystack(e);
      /* each search word must start a word in the text, so "paid" does not match "unpaid" */
      for (var i = 0; i < needles.length; i++) if (padded.indexOf(needles[i]) === -1) return false;
    }
    return true;
  }

  /*
    Live chip counts. For each chip, how many entries match when the current state is kept but that one facet
    (hubs, paid, types or fields) is replaced by just that chip. For hubs the place is cleared too, because
    choosing a hub chip clears the place. The filters are independent, so each entry is tested once per facet
    with that facet left out, then counted under the chips it belongs to. Nothing is stored between calls.
    Returns {hubs:{id:n}, paid:{id:n}, types:{id:n}, fields:{id:n}} with every chip id present, zeros included.
  */
  function facetCounts(list, state, now) {
    var st = state || {}, out = { hubs: {}, paid: {}, types: {}, fields: {} };
    HUBS.forEach(function (h) { out.hubs[h[0]] = 0; });
    PAID_GROUPS.forEach(function (g) { out.paid[g[0]] = 0; });
    Object.keys(TYPES).forEach(function (k) { out.types[k] = 0; });
    Object.keys(FIELDS).forEach(function (k) { if (k !== "any") out.fields[k] = 0; });
    var noHubs = Object.assign({}, st, { hubs: [], place: "" }),
        noPaid = Object.assign({}, st, { paid: [] }),
        noTypes = Object.assign({}, st, { types: [] }),
        noFields = Object.assign({}, st, { fields: [] });
    (list || []).forEach(function (e) {
      if (matches(e, noHubs, now)) hubsOf(e).forEach(function (h) { if (h in out.hubs) out.hubs[h]++; });
      if (matches(e, noPaid, now)) PAID_GROUPS.forEach(function (g) { if (g[2].indexOf(e.paid_type) > -1) out.paid[g[0]]++; });
      if (matches(e, noTypes, now) && e.type in out.types) out.types[e.type]++;
      if (matches(e, noFields, now)) {
        var fl = e.fields || [], any = fl.indexOf("any") > -1;
        Object.keys(out.fields).forEach(function (k) { if (any || fl.indexOf(k) > -1) out.fields[k]++; });
      }
    });
    return out;
  }

  /*
    Empty-state help. For each filter that is on, turn off just that one, count the matches and keep it if the count is above 0.
    Returns [{key, label, count}], highest count first, at most 3. My list stays as it is. Does not change the state.
    A place with fewer than 3 matches is widened to online programs, as the Programs page does.
  */
  var RELAX = [["q"], ["age"], ["when"], ["season"], ["paid", "pay", PAID_GROUPS], ["types", "type", TYPES], ["fields", "interest", FIELDS], ["verified"], ["noPermit"], ["hubs", "area", HUBS], ["place"]];
  var WHEN_NAMES = { "open": "Open or opening soon", "60": "Deadline in the next 60 days", "anytime": "Apply anytime", "closed": "Closed now, check back" };
  function relaxLabel(r, st) {
    var k = r[0], v = st[k];
    if (k === "q") return "Remove the search word";
    if (k === "age") return "Remove age " + v;
    if (k === "when") return "Remove " + (WHEN_NAMES[v] || "the timing filter");
    if (k === "season") return "Remove the season filter";
    if (k === "verified") return "Remove Only checked on the official site";
    if (k === "noPermit") return "Remove No work permit needed";
    if (k === "place") return "Remove place: " + placeLabel(v);
    if (v.length > 1) return "Remove the " + v.length + " " + r[1] + " filters";
    var t = r[2], n = Array.isArray(t) ? (t.filter(function (x) { return x[0] === v[0]; })[0] || [])[1] : t[v[0]];
    return "Remove " + r[1] + ": " + (n || v[0]);
  }
  function relaxOptions(list, state, now) {
    var st = state || {}, found = [], entries = list || [];
    function count(s) { return entries.filter(function (e) { return matches(e, s, now); }).length; }
    RELAX.forEach(function (r, order) {
      var k = r[0], v = st[k];
      if (Array.isArray(v) ? !v.length : !v) return;
      var s = Object.assign({}, st, { placeOnline: false }), n;
      s[k] = Array.isArray(v) ? [] : typeof v === "boolean" ? false : "";
      n = count(s);
      if (s.place && n < 3) { s.placeOnline = true; n = count(s); }
      if (n > 0) found.push({ key: k, label: relaxLabel(r, st), count: n, order: order });
    });
    found.sort(function (a, b) { return b.count - a.count || a.order - b.order; });
    return found.slice(0, 3).map(function (o) { return { key: o.key, label: o.label, count: o.count }; });
  }

  /*
    Lower rank sorts first. Keys in order:
    1. group: open with a deadline, open, anytime, closed, unknown.
    2. deadline bucket (group 0 only): 0 if the deadline is 21 days away or less, else 1.
    3. cost tier: 0 paid, stipend or mixed; 1 unpaid, unpaid-credit or pay not stated; 2 fee-based.
    4. age fit, only when profile.age is set: 0 if a min or max age is stated and fits, 1 if no age is stated, 2 if it does not fit.
    5. days to the deadline (group 0), then priority, verified, name.
    With no profile the age key is left out, so the order does not depend on age.
  */
  var SOON_DAYS = 21;
  function costTier(e) {
    var t = e.paid_type;
    if (t === "paid" || t === "stipend" || t === "mixed") return 0;
    if (t === "fee-based") return 2;
    return 1;
  }
  function rank(e, now, profile) {
    var d = futureDeadline(e, now), st = effStatus(e, now), group;
    if (isOpenish(e, now) && d) group = 0;
    else if (isOpenish(e, now)) group = 1;
    else if (isAnytime(e, now)) group = 2;
    else if (st === "closed-expect-reopen") group = 3;
    else group = 4;
    var days = group === 0 ? daysUntil(d, now) : 0;
    var r = [group, group === 0 && days > SOON_DAYS ? 1 : 0, costTier(e)];
    if (profile && profile.age) {
      var stated = e.min_age != null || e.max_age != null;
      r.push(stated ? (ageOk(e, profile.age) ? 0 : 2) : 1);
    }
    r.push(days, e.priority || 3, e.verified === "fetched" ? 0 : 1, e.name);
    return r;
  }
  function compareRanks(x, y) {
    for (var i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; }
    return 0;
  }
  function compare(a, b, now, profile) { return compareRanks(rank(a, now, profile), rank(b, now, profile)); }
  /*
    Sorting calls the comparator about n log n times and rank() parses dates, so 'best' and 'deadline'
    compute rank() (and futureDeadline for 'deadline') once per entry, sort those pairs, then unwrap.
    The tie-break order is the same as compare(), and Array.sort is stable.
    profile is optional: {age: 15} turns on the age fit key.
  */
  function sortList(list, mode, now, profile) {
    var l = list.slice();
    if (mode === "name") { l.sort(function (a, b) { return a.name.localeCompare(b.name); }); return l; }
    var byDeadline = mode === "deadline", n = l.length, pairs = new Array(n), i;
    for (i = 0; i < n; i++) pairs[i] = { e: l[i], r: api.rank(l[i], now, profile), d: byDeadline ? futureDeadline(l[i], now) : null };
    if (byDeadline) pairs.sort(function (a, b) {
      if (a.d && b.d) return a.d - b.d || compareRanks(a.r, b.r);
      if (a.d) return -1; if (b.d) return 1; return compareRanks(a.r, b.r);
    });
    else pairs.sort(function (a, b) { return compareRanks(a.r, b.r); });
    for (i = 0; i < n; i++) l[i] = pairs[i].e;
    return l;
  }
  /*
    The "Good fit for you" strip. list is already filtered by the chosen age and place.
    Keeps programs that are open now, opening soon, apply anytime or year-round, drops fee-based ones,
    and with an age chosen keeps only a stated age range that fits. Then the first n by the "best" order.
  */
  var PICK_STATUS = ["open-now", "opens-soon", "rolling", "year-round"];
  function topPicks(list, profile, now, n) {
    var p = profile || {}, keep = (list || []).filter(function (e) {
      if (PICK_STATUS.indexOf(effStatus(e, now)) === -1) return false;
      if (e.paid_type === "fee-based") return false;
      if (p.age && (e.min_age == null && e.max_age == null || !ageOk(e, p.age))) return false;
      return true;
    });
    return sortList(keep, "best", now, p).slice(0, n == null ? 3 : Math.max(0, n));
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
  /* RFC 5545 line folding: at most 75 octets a line, continuation starts with one space, never inside a UTF-8 character or an escape pair. */
  function icsFold(line) {
    var out = [], cur = "", n = 0, chars = Array.from(line), i, ch, w;
    for (i = 0; i < chars.length; i++) {
      ch = chars[i];
      if (ch === "\\" && i + 1 < chars.length) { ch += chars[i + 1]; i++; }
      w = unescape(encodeURIComponent(ch)).length;
      if (n + w > 75) { out.push(cur); cur = " "; n = 1; }
      cur += ch; n += w;
    }
    out.push(cur);
    return out.join("\r\n");
  }
  /* One all-day calendar event as .ics text. dateISO is YYYY-MM-DD. */
  function icsEvent(o) {
    if (!o || !parseISO(o.dateISO)) return "";
    var day = o.dateISO.replace(/-/g, ""), end = addDays(o.dateISO, 1).replace(/-/g, "");
    var stamp = (o.stamp || new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Teen Internship Guide//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:" + o.uid + "@vadneyk.github.io", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + day, "DTEND;VALUE=DATE:" + end,
      "SUMMARY:" + icsEscape(o.title), "DESCRIPTION:" + icsEscape(o.desc), "END:VEVENT", "END:VCALENDAR"].map(icsFold).concat([""]).join("\r\n");
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
    f.noPermit = list.filter(function (e) { return e.needs_work_permit === false; }).length;
    f.paid14 = list.filter(function (e) { return ageOk(e, 14) && (e.paid_type === "paid" || e.paid_type === "stipend"); }).length;
    f.free = list.filter(function (e) { return e.paid_type === "unpaid" || e.paid_type === "unpaid-credit"; }).length;
    f.cost = list.filter(function (e) { return e.paid_type === "fee-based"; }).length;
    var a15 = out.ages[2].n, a16 = out.ages[3].n;
    f.jump16 = a15 ? Math.round((a16 / a15 - 1) * 100) : 0;
    f.paidJump = out.ages[1].paid ? Math.round((out.ages[3].paid / out.ages[1].paid - 1) * 100) : 0;
    return out;
  }

  /* The words that follow "I'm" in a message to an adult, from the grade a teen typed.
     "10th", "10th grade", "10" and "10 grade" give "in 10th grade"; "sophomore" gives "a sophomore".
     "Grade 6" and "6" give "in 6th grade". Anything else is kept as typed, with " grade" added unless it already contains the word grade. */
  function gradePhrase(raw) {
    var t = String(raw == null ? "" : raw).trim();
    if (!t) return "in [grade]";
    var cls = /^(freshman|sophomore|junior|senior)(\s+grade)?$/i.exec(t);
    if (cls) return "a " + cls[1].toLowerCase();
    var num = /^(\d{1,2})(?:st|nd|rd|th)?(?:\s+grade)?$/i.exec(t.replace(/^grade\s+/i, ""));
    var n = num ? +num[1] : 0;
    if (n >= 1 && n <= 12) return "in " + n + (["th", "st", "nd", "rd"][n] || "th") + " grade";
    if (/\bgrade\b/i.test(t)) return "in " + t;
    return "in " + t + " grade";
  }

  var api = {
    REGIONS: REGIONS, HUBS: HUBS, TYPES: TYPES, FIELDS: FIELDS, PAID: PAID, PAID_GROUPS: PAID_GROUPS, MONTHS: MONTHS, MONTH_NAMES: MONTH_NAMES,
    esc: esc, regionLabel: regionLabel, safeUrl: safeUrl, parseISO: parseISO, fmtDate: fmtDate, daysUntil: daysUntil, hubsOf: hubsOf,
    effStatus: effStatus, futureDeadline: futureDeadline, knownDeadline: knownDeadline, isOpenish: isOpenish, isAnytime: isAnytime, ageOk: ageOk,
    matches: matches, facetCounts: facetCounts, relaxOptions: relaxOptions, placeCounts: placeCounts, rank: rank, compare: compare, sortList: sortList, topPicks: topPicks, ageText: ageText,
    STATUSES: STATUSES, toISO: toISO, addDays: addDays, followUpISO: followUpISO, planSummary: planSummary,
    icsEvent: icsEvent, mailtoHref: mailtoHref, smsHref: smsHref, splitMessage: splitMessage, insights: insights, stateOf: stateOf, stateFromPlace: stateFromPlace, STATE_OF: STATE_OF, permitFor: permitFor, hoursCheck: hoursCheck, paycheck: paycheck, PERMIT_STATES: PERMIT_STATES, CITIES: CITIES, AREAS: AREAS, PICK_GROUPS: PICK_GROUPS, placeRegions: placeRegions, placeLabel: placeLabel, hubsOfPlace: hubsOfPlace,
    gradePhrase: gradePhrase
  };
  return api;
});
