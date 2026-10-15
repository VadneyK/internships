// 2026-10-15: tests that pin lib.js behavior the 2026-10-14 mutation run showed was untested (matches, facetCounts, placeCounts, search haystack, ageOk, hubs).
// Run with: node --test tests/mut-b-lib.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("../assets/js/lib.js");

const NOW = new Date(2026, 9, 10, 15, 30).getTime(); // 10 Oct 2026, mid afternoon
const E = (o) => Object.assign({ id: "x", name: "Alpha Program", regions: [], type: "internship", fields: [], paid_type: "paid", status: "rolling" }, o);
const m = (e, s) => L.matches(e, s, NOW);

// ---------- hubsOf and hubsOfPlace ----------

test("hubsOf: returns hub ids in HUBS order, once each", () => {
  assert.deepEqual(L.hubsOf(E({ regions: ["atlanta", "oakland"] })), ["oak", "atl"]);
  assert.deepEqual(L.hubsOf(E({ regions: ["georgia", "atlanta"] })), ["atl"]);
  assert.deepEqual(L.hubsOf(E({ regions: ["virtual"] })), ["online"]);
  assert.deepEqual(L.hubsOf(E({ regions: ["nowhere"] })), []);
});
test("hubsOf: an entry with no regions field has no hubs", () => {
  assert.deepEqual(L.hubsOf({}), []);
  assert.deepEqual(L.hubsOf({ regions: [] }), []);
});
test("hubsOfPlace: hubs a city, state or area touches", () => {
  assert.deepEqual(L.hubsOfPlace("city:atlanta"), ["atl"]);
  assert.deepEqual(L.hubsOfPlace("city:davis"), ["davis", "state"]);
  assert.deepEqual(L.hubsOfPlace("state:ohio"), ["midwest"]);
  assert.deepEqual(L.hubsOfPlace("area:pacific-northwest"), ["sea", "van"]);
});
test("hubsOfPlace: unknown or empty place has no hubs and does not throw", () => {
  assert.deepEqual(L.hubsOfPlace("city:nowhere"), []);
  assert.deepEqual(L.hubsOfPlace(""), []);
  assert.deepEqual(L.hubsOfPlace(undefined), []);
});

// ---------- ageOk ----------

test("ageOk: no age chosen never filters", () => {
  const e = E({ min_age: 16, max_age: 18 });
  for (const a of [undefined, null, "", 0]) assert.equal(m(e, { age: a }), true);
});
test("ageOk: min_age and max_age are inclusive bounds (through matches)", () => {
  const e = E({ min_age: 14, max_age: 17 });
  assert.equal(m(e, { age: 13 }), false);
  assert.equal(m(e, { age: 14 }), true);
  assert.equal(m(e, { age: 17 }), true);
  assert.equal(m(e, { age: 18 }), false);
});
test("ageOk: accepts the age as a string, as the age select gives it", () => {
  const e = E({ min_age: 14, max_age: 17 });
  assert.equal(m(e, { age: "15" }), true);
  assert.equal(m(e, { age: "13" }), false);
  assert.equal(m(e, { age: "18" }), false);
});
test("ageOk: a missing or null bound means no limit on that side", () => {
  assert.equal(m(E({}), { age: 15 }), true);
  assert.equal(m(E({ min_age: null, max_age: null }), { age: 15 }), true);
  assert.equal(m(E({ min_age: 16 }), { age: 15 }), false);
  assert.equal(m(E({ min_age: 16 }), { age: 40 }), true);
  assert.equal(m(E({ max_age: 17 }), { age: 5 }), true);
  assert.equal(m(E({ max_age: 17 }), { age: 18 }), false);
});

// ---------- matches: each filter on its own ----------

test("matches: an empty state matches everything", () => {
  assert.equal(m(E({}), {}), true);
  assert.equal(m(E({ regions: ["boston"], status: "closed" }), { hubs: [], paid: [], types: [], fields: [] }), true);
});
test("matches: place keeps entries in the place's regions", () => {
  const bos = E({ regions: ["boston"] });
  assert.equal(m(bos, { place: "city:boston" }), true);
  assert.equal(m(E({ regions: ["massachusetts"] }), { place: "city:boston" }), true);
  assert.equal(m(bos, { place: "city:atlanta" }), false);
  assert.equal(m(E({ regions: [] }), { place: "city:boston" }), false);
  assert.equal(m({}, { place: "city:boston" }), false);
  assert.equal(m(bos, { place: "state:ohio" }), false);
});
test("matches: an unknown place does not filter", () => {
  assert.equal(m(E({ regions: ["boston"] }), { place: "city:nowhere" }), true);
});
test("matches: placeOnline also lets online and national programs through a place", () => {
  const virt = E({ regions: ["virtual"] }), nat = E({ regions: ["national"] });
  assert.equal(m(virt, { place: "city:boston" }), false);
  assert.equal(m(virt, { place: "city:boston", placeOnline: true }), true);
  assert.equal(m(nat, { place: "city:boston", placeOnline: true }), true);
  assert.equal(m(E({ regions: ["atlanta"] }), { place: "city:boston", placeOnline: true }), false);
});
test("matches: hubs keeps entries in any chosen hub", () => {
  const atl = E({ regions: ["atlanta"] });
  assert.equal(m(atl, { hubs: ["atl"] }), true);
  assert.equal(m(atl, { hubs: ["sf"] }), false);
  assert.equal(m(atl, { hubs: ["sf", "atl"] }), true);
  assert.equal(m(atl, { hubs: ["atl", "sf"] }), true);
  assert.equal(m(atl, { hubs: [] }), true);
  assert.equal(m(E({ regions: [] }), { hubs: ["atl"] }), false);
});
test("matches: when=open keeps open-now and opens-soon, not rolling or stale", () => {
  assert.equal(m(E({ status: "open-now", deadline_iso: "2026-12-01" }), { when: "open" }), true);
  assert.equal(m(E({ status: "opens-soon", opens_iso: "2027-01-05" }), { when: "open" }), true);
  assert.equal(m(E({ status: "rolling" }), { when: "open" }), false);
  assert.equal(m(E({ status: "open-now", deadline_iso: "2026-10-01" }), { when: "open" }), false);
});
test("matches: when=60 keeps a future deadline up to 60 days away, inclusive", () => {
  const d = (iso, status) => E({ status: status || "open-now", deadline_iso: iso });
  assert.equal(m(d("2026-10-10"), { when: "60" }), true);   // today
  assert.equal(m(d("2026-12-09"), { when: "60" }), true);   // exactly 60 days
  assert.equal(m(d("2026-12-10"), { when: "60" }), false);  // 61 days
  assert.equal(m(d("2026-10-09"), { when: "60" }), false);  // yesterday
  assert.equal(m(E({ status: "open-now" }), { when: "60" }), false); // no deadline
  assert.equal(m(d("2026-11-01", "rolling"), { when: "60" }), true);
  assert.equal(m(d("2026-11-01", "unconfirmed"), { when: "60" }), false);
});
test("matches: when=anytime keeps rolling, year-round and event cards only", () => {
  for (const s of ["rolling", "year-round", "event"]) assert.equal(m(E({ status: s }), { when: "anytime" }), true, s);
  assert.equal(m(E({ status: "open-now", deadline_iso: "2026-12-01" }), { when: "anytime" }), false);
  assert.equal(m(E({ status: "unconfirmed" }), { when: "anytime" }), false);
});
test("matches: when=closed keeps only cards past their deadline", () => {
  assert.equal(m(E({ status: "open-now", deadline_iso: "2026-10-01" }), { when: "closed" }), true);
  assert.equal(m(E({ status: "opens-soon", deadline_iso: "2026-10-01" }), { when: "closed" }), true);
  assert.equal(m(E({ status: "open-now", deadline_iso: "2026-12-01" }), { when: "closed" }), false);
  assert.equal(m(E({ status: "rolling" }), { when: "closed" }), false);
  assert.equal(m(E({ status: "unconfirmed" }), { when: "closed" }), false);
});
test("matches: an empty or unknown when does not filter any status", () => {
  const all = [
    E({ status: "open-now", deadline_iso: "2026-12-01" }), E({ status: "rolling" }), E({ status: "event" }),
    E({ status: "open-now", deadline_iso: "2026-10-01" }), E({ status: "unconfirmed" })
  ];
  for (const w of ["", undefined, "someday"]) for (const e of all) assert.equal(m(e, { when: w }), true, w + " " + e.status);
});
test("matches: season keeps that season plus year-round cards", () => {
  assert.equal(m(E({ season: "summer" }), { season: "summer" }), true);
  assert.equal(m(E({ season: "fall" }), { season: "summer" }), false);
  assert.equal(m(E({ season: "year-round" }), { season: "summer" }), true);
  assert.equal(m(E({}), { season: "summer" }), false);
  assert.equal(m(E({ season: "fall" }), { season: "" }), true);
  assert.equal(m(E({ season: "fall" }), {}), true);
});
test("matches: paid groups map to paid_type values", () => {
  const p = (t) => E({ paid_type: t });
  for (const t of ["paid", "stipend", "mixed"]) { assert.equal(m(p(t), { paid: ["pay"] }), true, t); assert.equal(m(p(t), { paid: ["free"] }), false, t); }
  for (const t of ["unpaid", "unpaid-credit"]) { assert.equal(m(p(t), { paid: ["free"] }), true, t); assert.equal(m(p(t), { paid: ["pay"] }), false, t); }
  assert.equal(m(p("fee-based"), { paid: ["fee"] }), true);
  assert.equal(m(p("fee-based"), { paid: ["pay", "free", "unknown"] }), false);
  assert.equal(m(p("not-stated"), { paid: ["unknown"] }), true);
  assert.equal(m(p("unpaid"), { paid: ["pay", "free"] }), true);
  assert.equal(m(p("paid"), { paid: ["pay", "free"] }), true);
  assert.equal(m(p(undefined), { paid: ["pay"] }), false);
  assert.equal(m(p("fee-based"), { paid: [] }), true);
});
test("matches: types keeps only the chosen types, whatever their position in the list", () => {
  const t = (x) => E({ type: x });
  assert.equal(m(t("internship"), { types: ["internship"] }), true);
  assert.equal(m(t("research"), { types: ["internship"] }), false);
  assert.equal(m(t("internship"), { types: ["internship", "research"] }), true);
  assert.equal(m(t("research"), { types: ["internship", "research"] }), true);
  assert.equal(m(t("volunteer"), { types: ["internship", "research"] }), false);
  assert.equal(m(t("volunteer"), { types: [] }), true);
});
test("matches: fields keeps cards sharing any field, and cards open to any interest", () => {
  const f = (x) => E({ fields: x });
  assert.equal(m(f(["tech-cs"]), { fields: ["tech-cs"] }), true);
  assert.equal(m(f(["health"]), { fields: ["tech-cs"] }), false);
  assert.equal(m(f(["health", "tech-cs"]), { fields: ["tech-cs"] }), true);  // one shared field is enough
  assert.equal(m(f(["tech-cs", "health"]), { fields: ["tech-cs"] }), true);
  assert.equal(m(f(["any"]), { fields: ["tech-cs"] }), true);
  assert.equal(m(f(["health", "any"]), { fields: ["tech-cs"] }), true);
  assert.equal(m(f([]), { fields: ["tech-cs"] }), false);
  assert.equal(m(E({ fields: undefined }), { fields: ["tech-cs"] }), false);
  assert.equal(m(f(["health"]), { fields: [] }), true);
  assert.equal(m(f(["health"]), { fields: ["tech-cs", "health"] }), true);
});
test("matches: verified keeps only fetched cards", () => {
  assert.equal(m(E({ verified: "fetched" }), { verified: true }), true);
  assert.equal(m(E({ verified: "listing" }), { verified: true }), false);
  assert.equal(m(E({}), { verified: true }), false);
  assert.equal(m(E({ verified: "listing" }), { verified: false }), true);
});
test("matches: noPermit keeps only cards that explicitly need no work permit", () => {
  assert.equal(m(E({ needs_work_permit: false }), { noPermit: true }), true);
  assert.equal(m(E({ needs_work_permit: true }), { noPermit: true }), false);
  assert.equal(m(E({}), { noPermit: true }), false);
  assert.equal(m(E({ needs_work_permit: true }), { noPermit: false }), true);
});
test("matches: saved keeps only the saved ids", () => {
  assert.equal(m(E({ id: "a" }), { saved: true, savedIds: ["a", "b"] }), true);
  assert.equal(m(E({ id: "c" }), { saved: true, savedIds: ["a", "b"] }), false);
  assert.equal(m(E({ id: "a" }), { saved: true, savedIds: [] }), false);
  assert.equal(m(E({ id: "a" }), { saved: true }), false);
  assert.equal(m(E({ id: "c" }), { saved: false, savedIds: ["a"] }), true);
});

// ---------- matches: search text ----------

test("search: every word must start a word, so paid does not match unpaid", () => {
  const e = E({ name: "Unpaid volunteering", what_you_do: "Help at a food bank" });
  assert.equal(m(e, { q: "paid" }), false);
  assert.equal(m(e, { q: "unpaid" }), true);
  assert.equal(m(e, { q: "volun" }), true);
  assert.equal(m(e, { q: "teering" }), false);
});
test("search: all words are required, in any order, case and punctuation ignored", () => {
  const e = E({ name: "Teen Coding Camp", city: "San Jose" });
  assert.equal(m(e, { q: "coding camp" }), true);
  assert.equal(m(e, { q: "camp coding" }), true);
  assert.equal(m(e, { q: "CODING   Camp" }), true);
  assert.equal(m(e, { q: "coding robots" }), false);
  assert.equal(m(e, { q: "san-jose" }), true);
  assert.equal(m(e, { q: "  coding " }), true);
  assert.equal(m(e, { q: "coding!!!" }), true);
});
test("search: each text field is searched", () => {
  const f = { name: "zname", org: "zorg", city: "zcity", what_you_do: "zwhat", notes: "znotes", who_can_apply: "zwho" };
  for (const k of Object.keys(f)) {
    const e = E({ [k]: f[k] });
    assert.equal(m(e, { q: f[k] }), true, k);
    for (const other of Object.keys(f)) if (other !== k) assert.equal(m(e, { q: f[other] }), false, k + " vs " + other);
  }
});
test("search: region names and the type label are searched", () => {
  const e = E({ regions: ["los-angeles"], type: "apprenticeship-trades" });
  assert.equal(m(e, { q: "angeles" }), true);
  assert.equal(m(e, { q: "los angeles" }), true);
  assert.equal(m(e, { q: "trades" }), true);
  assert.equal(m(e, { q: "research" }), false);
});
test("search: several region names stay separate words", () => {
  const e = E({ regions: ["los-angeles", "san-diego"] });
  assert.equal(m(e, { q: "san diego" }), true);
  assert.equal(m(e, { q: "san" }), true);  // "San Diego" must start its own word, not run into "Angeles"
  assert.equal(m(e, { q: "angeles san" }), true);
});
test("search: missing fields never show up as the word undefined", () => {
  const e = E({ name: "Only name" });
  assert.equal(m(e, { q: "undefined" }), false);
  assert.equal(m(e, { q: "null" }), false);
  assert.equal(m({}, { q: "only" }), false);
});
test("search: a query of only punctuation matches everything", () => {
  assert.equal(m(E({}), { q: "!!!" }), true);
  assert.equal(m(E({}), { q: " " }), true);
});
test("search: switching the query string between calls uses the new words", () => {
  const a = E({ name: "Robotics lab" }), b = E({ name: "Cooking class" });
  assert.equal(m(a, { q: "robotics" }), true);
  assert.equal(m(b, { q: "robotics" }), false);
  assert.equal(m(a, { q: "cooking" }), false);
  assert.equal(m(b, { q: "cooking" }), true);
  assert.equal(m(a, { q: "robotics" }), true);
});

// ---------- haystack cache follows in-place edits ----------

test("search cache: editing any text field of the same object is seen on the next search", () => {
  for (const k of ["name", "org", "city", "what_you_do", "notes", "who_can_apply"]) {
    const e = E({ [k]: "firstword" });
    assert.equal(m(e, { q: "firstword" }), true, k);
    e[k] = "secondword";
    assert.equal(m(e, { q: "firstword" }), false, k + " old");
    assert.equal(m(e, { q: "secondword" }), true, k + " new");
  }
});
test("search cache: editing type or regions of the same object is seen", () => {
  const e = E({ type: "research", regions: ["boston"] });
  assert.equal(m(e, { q: "research" }), true);
  assert.equal(m(e, { q: "boston" }), true);
  e.type = "volunteer";
  e.regions = ["atlanta"];
  assert.equal(m(e, { q: "research" }), false);
  assert.equal(m(e, { q: "boston" }), false);
  assert.equal(m(e, { q: "volunteer" }), true);
  assert.equal(m(e, { q: "atlanta" }), true);
});
test("search cache: regions that join to the same letters are still told apart", () => {
  const e = E({ regions: ["ohio", "indiana"] });
  assert.equal(m(e, { q: "indiana" }), true);
  e.regions = ["ohioindiana"]; // not a real region, so no label
  assert.equal(m(e, { q: "indiana" }), false);
});
test("search cache: moving text from one field to the next is seen", () => {
  const e = E({ name: "ab", org: "c" });
  assert.equal(m(e, { q: "ab" }), true);
  assert.equal(m(e, { q: "bc" }), false);
  e.name = "a";
  e.org = "bc";
  assert.equal(m(e, { q: "ab" }), false);
  assert.equal(m(e, { q: "bc" }), true);
});
test("search cache: repeated searches on an unchanged entry give the same answer", () => {
  const e = E({ name: "Steady" });
  for (let i = 0; i < 3; i++) assert.equal(m(e, { q: "steady" }), true);
  for (let i = 0; i < 3; i++) assert.equal(m(e, { q: "other" }), false);
});

// ---------- matches: filters together ----------

test("matches: all filters together, and any single failure rejects", () => {
  const good = E({
    id: "g", regions: ["atlanta"], min_age: 14, max_age: 17, status: "open-now", deadline_iso: "2026-11-01",
    season: "summer", paid_type: "stipend", type: "research", fields: ["health"], verified: "fetched", needs_work_permit: false,
    name: "Hospital research"
  });
  const s = {
    place: "city:atlanta", hubs: ["atl"], age: "15", when: "60", season: "summer", paid: ["pay"], types: ["research"],
    fields: ["health"], verified: true, noPermit: true, saved: true, savedIds: ["g"], q: "hospital"
  };
  assert.equal(m(good, s), true);
  const breaks = {
    place: "city:boston", hubs: ["sf"], age: "30", when: "anytime", season: "fall", paid: ["fee"], types: ["internship"],
    fields: ["tech-cs"], savedIds: [], q: "zebra"
  };
  for (const k of Object.keys(breaks)) assert.equal(m(good, Object.assign({}, s, { [k]: breaks[k] })), false, k);
  assert.equal(m(Object.assign({}, good, { verified: "listing" }), s), false);
  assert.equal(m(Object.assign({}, good, { needs_work_permit: true }), s), false);
});

// ---------- placeCounts ----------

const placeKeys = () => [].concat(
  L.CITIES.map((c) => "city:" + c[0]), L.AREAS.map((a) => "area:" + a[0]), L.STATES.map((s) => "state:" + s[0]));

test("placeCounts: has exactly one key per city, area and state, even with no entries", () => {
  const zero = L.placeCounts([]);
  assert.deepEqual(Object.keys(zero).sort(), placeKeys().sort());
  for (const k of Object.keys(zero)) assert.equal(zero[k], 0, k);
});
test("placeCounts: counts each entry once per place it belongs to", () => {
  const c = L.placeCounts([
    E({ regions: ["boston"] }), E({ regions: ["boston", "massachusetts"] }), E({ regions: ["statewide"] }),
    E({ regions: ["virtual"] }), E({ regions: [] }), {}
  ]);
  assert.equal(c["city:boston"], 2);       // two entries, the second counted once though it has two matching regions
  assert.equal(c["state:massachusetts"], 1);
  assert.equal(c["area:northeast"], 2);
  assert.equal(c["city:davis"], 1);        // california-wide program
  assert.equal(c["state:california"], 1);
  assert.equal(c["city:atlanta"], 0);
  assert.equal(c["state:ohio"], 0);
});
test("placeCounts: matches matches(e, {place}) for every key over crafted entries", () => {
  const entries = L.REGIONS.map((r) => E({ regions: [r[0]] }))
    .concat([E({ regions: ["boston", "atlanta", "ohio"] }), E({ regions: [] }), E({ regions: ["virtual", "national"] }), {}]);
  const c = L.placeCounts(entries);
  for (const k of placeKeys()) assert.equal(c[k], entries.filter((e) => L.matches(e, { place: k }, NOW)).length, k);
});
test("placeCounts: a single entry is counted (the last entry is not skipped)", () => {
  const c = L.placeCounts([E({ regions: ["georgia"] })]);
  assert.equal(c["city:atlanta"], 1);
  assert.equal(c["state:georgia"], 1);
  assert.equal(c["area:southeast"], 1);
  assert.equal(c["city:boston"], 0);
});
test("placeCounts: with entries present the result still has only the place keys", () => {
  const c = L.placeCounts([E({ regions: ["georgia"] }), E({ regions: ["ohio"] })]);
  assert.deepEqual(Object.keys(c).sort(), placeKeys().sort());
  for (const k of Object.keys(c)) assert.ok(Number.isInteger(c[k]), k);
});

// ---------- facetCounts ----------

const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const HUB_IDS = L.HUBS.map((h) => h[0]), PAID_IDS = L.PAID_GROUPS.map((g) => g[0]);
const TYPE_IDS = Object.keys(L.TYPES), FIELD_IDS = Object.keys(L.FIELDS).filter((k) => k !== "any");
const emptyFacets = () => ({ hubs: zeros(HUB_IDS), paid: zeros(PAID_IDS), types: zeros(TYPE_IDS), fields: zeros(FIELD_IDS) });
const fc = (list, s) => L.facetCounts(list, s, NOW);

test("facetCounts: no entries gives every chip id with zero, and no extras", () => {
  assert.deepEqual(fc([], {}), emptyFacets());
  assert.deepEqual(fc([], undefined), emptyFacets());
  assert.deepEqual(fc(undefined, {}), emptyFacets());
  assert.deepEqual(fc(null, undefined), emptyFacets());
  assert.equal(Object.keys(fc([], {}).fields).includes("any"), false);
});
test("facetCounts: counts hubs, paid groups, types and fields", () => {
  const list = [
    E({ regions: ["atlanta"], paid_type: "paid", type: "internship", fields: ["health"] }),
    E({ regions: ["atlanta", "oakland"], paid_type: "stipend", type: "research", fields: ["health", "science"] }),
    E({ regions: ["virtual"], paid_type: "unpaid", type: "internship", fields: ["tech-cs"] })
  ];
  const want = emptyFacets();
  want.hubs.atl = 2; want.hubs.oak = 1; want.hubs.online = 1;
  want.paid.pay = 2; want.paid.free = 1;
  want.types.internship = 2; want.types.research = 1;
  want.fields.health = 2; want.fields.science = 1; want.fields["tech-cs"] = 1;
  assert.deepEqual(fc(list, {}), want);
});
test("facetCounts: an entry open to any interest counts under every field chip", () => {
  const want = emptyFacets();
  for (const k of FIELD_IDS) want.fields[k] = 1;
  want.types.internship = 1; want.paid.pay = 1;
  assert.deepEqual(fc([E({ fields: ["any"] })], {}), want);
});
test("facetCounts: entries with no fields count under no field chip, and do not throw", () => {
  const out = fc([E({ fields: undefined }), E({ fields: [] }), {}], {});
  assert.deepEqual(out.fields, zeros(FIELD_IDS));
});
test("facetCounts: an unknown type or hub-less entry adds no new chip", () => {
  const out = fc([E({ type: "bogus", regions: ["nowhere"], paid_type: "weird" }), E({ type: undefined, paid_type: undefined })], {});
  assert.deepEqual(out.types, zeros(TYPE_IDS));
  assert.deepEqual(out.hubs, zeros(HUB_IDS));
  assert.deepEqual(out.paid, zeros(PAID_IDS));
});
test("facetCounts: each paid_type counts in its own group only", () => {
  const out = fc([E({ paid_type: "unpaid-credit" }), E({ paid_type: "fee-based" }), E({ paid_type: "not-stated" }), E({ paid_type: "mixed" })], {});
  assert.deepEqual(out.paid, { pay: 1, free: 1, fee: 1, unknown: 1 });
});

const MIX = [
  E({ id: "1", regions: ["atlanta"], paid_type: "paid", type: "internship", fields: ["health"] }),
  E({ id: "2", regions: ["atlanta"], paid_type: "unpaid", type: "research", fields: ["health"] }),
  E({ id: "3", regions: ["oakland"], paid_type: "paid", type: "internship", fields: ["tech-cs"] }),
  E({ id: "4", regions: ["oakland"], paid_type: "fee-based", type: "research", fields: ["any"] })
];

test("facetCounts: the hubs facet ignores the chosen hubs and place, other facets obey them", () => {
  const out = fc(MIX, { hubs: ["atl"], place: "city:atlanta" });
  assert.equal(out.hubs.atl, 2);
  assert.equal(out.hubs.oak, 2);  // still counted although only atl is chosen
  assert.deepEqual(out.paid, Object.assign(zeros(PAID_IDS), { pay: 1, free: 1 }));
  assert.deepEqual(out.types, Object.assign(zeros(TYPE_IDS), { internship: 1, research: 1 }));
  assert.equal(out.fields.health, 2);
  assert.equal(out.fields["tech-cs"], 0);
});
test("facetCounts: the place filter alone is dropped for hubs but kept for the others", () => {
  const out = fc(MIX, { place: "city:atlanta" });
  assert.equal(out.hubs.atl, 2);
  assert.equal(out.hubs.oak, 2);
  assert.equal(out.types.internship, 1);
  assert.equal(out.paid.pay, 1);
});
test("facetCounts: the paid facet ignores the chosen paid groups, other facets obey them", () => {
  const out = fc(MIX, { paid: ["free"] });
  assert.deepEqual(out.paid, { pay: 2, free: 1, fee: 1, unknown: 0 });
  assert.equal(out.types.research, 1);
  assert.equal(out.types.internship, 0);
  assert.equal(out.hubs.atl, 1);
  assert.equal(out.hubs.oak, 0);
});
test("facetCounts: the types facet ignores the chosen types, other facets obey them", () => {
  const out = fc(MIX, { types: ["research"] });
  assert.equal(out.types.internship, 2);
  assert.equal(out.types.research, 2);
  assert.equal(out.hubs.atl, 1);
  assert.equal(out.hubs.oak, 1);
  assert.equal(out.paid.pay, 0);
  assert.equal(out.paid.free, 1);
  assert.equal(out.paid.fee, 1);
});
test("facetCounts: the fields facet ignores the chosen fields, other facets obey them", () => {
  const out = fc(MIX, { fields: ["tech-cs"] });
  assert.equal(out.fields.health, 3);      // entries 1, 2 and 4 (open to any interest)
  assert.equal(out.fields["tech-cs"], 2);
  assert.equal(out.hubs.atl, 0);           // only entries 3 and 4 match tech-cs
  assert.equal(out.hubs.oak, 2);
  assert.equal(out.types.internship, 1);
  assert.equal(out.types.research, 1);
});
test("facetCounts: filters outside the four facets apply to every facet", () => {
  assert.equal(fc(MIX, { q: "program" }).hubs.atl, 2);
  assert.deepEqual(fc(MIX, { q: "zebra" }), emptyFacets());
  const aged = fc([E({ min_age: 16 }), E({ min_age: 14 })], { age: 15 });
  assert.equal(aged.types.internship, 1);
});
test("facetCounts: does not change the state it is given", () => {
  const s = { hubs: ["atl"], place: "city:atlanta", paid: ["pay"], types: ["research"], fields: ["health"] };
  const copy = JSON.parse(JSON.stringify(s));
  fc(MIX, s);
  assert.deepEqual(s, copy);
});
test("facetCounts: each chip equals what matches() gives for the state with that chip chosen alone", () => {
  const base = { age: 15, paid: ["pay", "free"], types: ["internship"], fields: ["health"], hubs: ["atl"], place: "city:atlanta" };
  const out = fc(MIX, base);
  const n = (s) => MIX.filter((e) => L.matches(e, s, NOW)).length;
  for (const h of HUB_IDS) assert.equal(out.hubs[h], n(Object.assign({}, base, { hubs: [h], place: "" })), h);
  for (const g of PAID_IDS) assert.equal(out.paid[g], n(Object.assign({}, base, { paid: [g] })), g);
  for (const t of TYPE_IDS) assert.equal(out.types[t], n(Object.assign({}, base, { types: [t] })), t);
  for (const f of FIELD_IDS) assert.equal(out.fields[f], n(Object.assign({}, base, { fields: [f] })), f);
});
