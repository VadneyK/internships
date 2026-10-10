// Duplicate guard for data/entries.json. The exact-URL check in tools/validate.py misses cards that point
// at the same page with a different query, fragment, trailing slash or www. These tests group cards by
// normalized name and city, by org plus name, and by page (host plus path). A new group fails unless the
// author merges the cards or adds the group to an allow list below with a reason. An allow list entry that
// no longer matches a real group also fails, so it gets removed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "entries.json"), "utf8"));

// Same name and same city, different organizations. Each card is its own program with its own org page.
const NAME_CITY_ALLOW = [
  // pittsburgh, pa: three teen volunteer programs at three different organizations
  ["pittsburgh-kamin-science-center-teen-volunteers", "pittsburgh-national-aviary-teen-volunteers", "pittsburgh-upmc-childrens-teen-volunteer"],
];

// Pages are compared by host (without www.) plus path (without trailing slash). Query and fragment are ignored.
const PAGE_ALLOW = [
  ["berkeley-youthworks", "ecology-center-youth-environmental-academy"], // berkeleyca.gov/youthworks: one page lists several programs
  ["bloomington-wonderlab-teen-volunteer", "bloomington-wonderlab-wondercamp-high-school-intern"], // volgistics.com/ex/portal.dll/ap: one page lists several programs
  ["boston-mit-mites-saturdays", "boston-mit-mites-summer"], // mites.mit.edu/discover-mites/apply-to-mites: one page lists several programs
  ["champaign-urbana-park-district-cit", "champaign-urbana-park-district-fresh-crew"], // urbanaparks.org/teen-programs: one page lists several programs
  ["chicago-youth-works-summer-jobs", "chicagobility-ages-14-15", "cpl-summer-teen-internships"], // chicagoyouthworks.org: one page lists several programs
  ["bloomington-iu-luddy-cybersecurity-immersion-camp", "bloomington-iu-luddy-precollege-stem-camp"], // luddy.iu.edu/academics/highschool.html: one page lists several programs
  ["cosmos-uc-davis", "uci-cosmos"], // cosmos-ucop.ucdavis.edu: one page lists several programs
  ["college-park-pg-parks-shakespeare-in-the-parks-apprenticeship", "college-park-pg-parks-teen-performance-ensemble", "pg-parks-youth-advisory-council"], // pgparks.com/things-to-do/teen_preteen_programs: one page lists several programs
  ["cassadaga-job-corps-center", "delawarevalley-job-corps-center", "edison-job-corps-center", "glenmont-job-corps-center", "grafton-job-corps-center", "iroquois-job-corps-center", "keystone-job-corps-center", "oneonta-job-corps-center", "philadelphia-job-corps-center", "pittsburgh-job-corps-center", "redrock-job-corps-center"], // jobcorps.gov: separate centers with their own pages share the national enrollment page as apply_url
  ["job-corps-georgia-brunswick-turner", "job-corps-minnesota-hubert-h-humphrey", "job-corps-sacramento", "job-corps-texas-gary-san-marcos", "job-corps-washington-centers"], // enroll.jobcorps.gov: separate centers with their own pages share the national enrollment page as apply_url
  ["fermilab-prism", "fermilab-valor-jrotc"], // fermilab.wd5.myworkdayjobs.com/en-US/FermilabCareers: one page lists several programs
  ["lansing-msu-high-school-engineering-institute", "lansing-msu-making-a-game-of-it-ai"], // engineering.msu.edu/academics/k-12/summer-programs: one page lists several programs
  ["nyc-dycd-ladders-for-leaders", "nyc-dycd-summer-youth-employment-program"], // application.nycsyep.com: one page lists several programs
  ["oakland-public-library-teen-advisory-board", "oakland-public-library-teen-volunteer"], // oaklandlibrary.org/teenvolunteers: one page lists several programs
  ["pittsburgh-cmu-cs-scholars", "pittsburgh-cmu-pre-college-programs", "pittsburgh-cmu-summer-academy-math-science"], // apply-precollege.studentaffairs.cmu.edu/apply: one page lists several programs
  ["santa-barbara-parks-rec-junior-counselor", "santa-barbara-parks-rec-seasonal-jobs"], // sbparksandrec.santabarbaraca.gov/activities/teen-and-early-adult-recreation: one page lists several programs
  ["santa-barbara-ucsb-research-mentorship-program", "santa-barbara-ucsb-summer-research-academies"], // summer.ucsb.edu/apply: one page lists several programs
  ["chicago-adler-planetarium-astro-ambassadors", "chicago-adler-planetarium-far-horizons-teens"], // adlerplanetarium.org/youth-teen-programs: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["cincinnati-zoo-zooteen-volunteer", "endeavor-health-edward-hospital-student-volunteer", "endeavor-health-elmhurst-hospital-teen-volunteer", "endeavor-health-evanston-hospital-teen-volunteer", "endeavor-health-glenbrook-hospital-teen-volunteer", "endeavor-health-highland-park-hospital-teen-volunteer", "endeavor-health-northwest-community-hospital-teen-volunteer", "endeavor-health-skokie-hospital-teen-volunteer", "naperville-library-teen-volunteers-and-tag", "san-diego-parks-and-recreation-volunteer", "san-diego-police-cadet-program"], // app.betterimpact.com/Application: app.betterimpact.com is an application platform; each link names its own organization in the query, which this test ignores
  ["spelman-college-prep-institute", "spelman-early-college-program"], // apply.spelman.edu/register/summerprograms: one application page covers several programs
  ["chicago-art-institute-teen-council", "chicago-art-institute-teen-summer-internship"], // artic.edu/visit/whos-visiting/teens-2/opportunities-for-teens: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["ascension-alexian-brothers-teen-volunteer", "ascension-saint-alexius-teen-volunteer"], // ascensionil.vsyslive.com: one volunteer portal covers several hospitals
  ["chicago-botanic-garden-college-first-grades-11-12", "chicago-botanic-garden-science-first-grades-9-10"], // chicagobotanic.org/learning/continuum: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["endeavor-health-edward-hospital-student-volunteer", "endeavor-health-elmhurst-hospital-teen-volunteer", "endeavor-health-evanston-hospital-teen-volunteer", "endeavor-health-glenbrook-hospital-teen-volunteer", "endeavor-health-highland-park-hospital-teen-volunteer", "endeavor-health-northwest-community-hospital-teen-volunteer", "endeavor-health-skokie-hospital-teen-volunteer"], // endeavorhealth.org/give/volunteer: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["glendale-youth-alliance-step", "glendale-youth-alliance-summer-youth-employment", "glendale-youth-alliance-team-program", "piedmont-atlanta-teen-volunteers"], // forms.office.com/Pages/ResponsePage.aspx: forms.office.com is a form host; each link has its own form id in the query, which this test ignores
  ["glendale-youth-alliance-step", "glendale-youth-alliance-summer-youth-employment", "glendale-youth-alliance-team-program"], // glendaleyouthalliance.com/programs-1: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["imsa-ai-credential-online", "imsa-research-fundamentals-online", "imsa-rise-online-research-program"], // imsa.edu/youth-outreach/high-school-online-programs: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["chicago-lincoln-park-zoo-research-apprenticeship", "chicago-lincoln-park-zoo-zoo-intern-program"], // lpzoo.slideroom.com: one application portal covers several programs
  ["nyc-brooklyn-maimonides-health-scholars-ed-internship", "nyc-brooklyn-maimonides-high-school-volunteer", "nyc-brooklyn-maimonides-science-scholars"], // maimo.org/careers-and-volunteers/volunteer/volunteer-programs: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["nyc-manhattan-university-chemical-engineering-summer-program", "nyc-manhattan-university-electrical-computer-engineering-summer-program", "nyc-manhattan-university-mechanical-engineering-summer-institute", "nyc-manhattan-university-residential-summer-engineering", "nyc-manhattan-university-summer-engineering-awareness-program"], // manhattan.edu/academics/engineering/high-school-programs: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["chicago-mikva-cps-student-advisory-council", "chicago-mikva-safety-and-justice-council", "chicago-mikva-summer-fellows", "chicago-mikva-teen-health-council"], // mikvachallenge.org/general-program-application: one application form covers several programs
  ["northwestern-nhsi-debate-institute", "northwestern-nhsi-film-video", "northwestern-nhsi-theatre-arts"], // nhsi.northwestern.edu/apply-now: one application page covers several programs
  ["nyc-northwell-lenox-hill-health-care-immersion", "nyc-northwell-manhattan-campus-junior-volunteer"], // northwell.vsyslive.com/pages/LENOX: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["oak-park-park-district-acorns-to-oaks-volunteers", "pleasant-home-oak-park-student-docents"], // pdop.org/volunteer: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["chicago-uchicago-eyes-on-cancer", "chicago-uchicago-hero-oncology", "chicago-uchicago-researchstart"], // redcap.link/2027UCCCCPathwayPrograms: one application form covers several programs
  ["rfu-campmed", "rfu-inspire-summer-research", "rfu-science-saturdays", "rfu-virtual-mentor-program"], // rosalindfranklin.edu/about/community-and-campus-outreach/pathway-programs: one page lists several programs; each card links to its own section with an anchor or a text fragment
  ["nyc-staten-island-zoo-junior-docent", "nyc-staten-island-zoo-teen-volunteer"], // statenislandzoo.org/volunteer-job-opportunities: one page lists several programs; each card links to its own section with an anchor or a text fragment
];

// ---------- helpers (pure, so the self-check can exercise them on seeded fixtures) ----------

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function pageKey(u) {
  if (typeof u !== "string" || u === "") return null;
  try {
    const url = new URL(u);
    return url.hostname.toLowerCase().replace(/^www\./, "") + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

const nameCityKeys = (c) => (norm(c.name) === "" ? [] : [`${norm(c.name)} | ${norm(c.city)}`]);
const orgNameKeys = (c) => (norm(c.name) === "" ? [] : [`${norm(c.org)} | ${norm(c.name)}`]);
const pageKeys = (c) => [pageKey(c.url), pageKey(c.apply_url)].filter(Boolean);

// Groups of card ids that share a key. Only groups with two or more distinct cards are returned, sorted by key.
function groupBy(cards, keysOf) {
  const map = new Map();
  for (const c of cards) {
    for (const k of keysOf(c)) {
      if (!map.has(k)) map.set(k, []);
      const ids = map.get(k);
      if (!ids.includes(c.id)) ids.push(c.id);
    }
  }
  return [...map.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids: [...ids].sort() }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const idKey = (ids) => [...ids].sort().join(" ");

// Compares found groups with an allow list (both as sets of id groups). Returns what is new and what is stale.
function compareWithAllow(groups, allow) {
  const found = new Set(groups.map((g) => idKey(g.ids)));
  const listed = new Set(allow.map(idKey));
  return {
    fresh: groups.filter((g) => !listed.has(idKey(g.ids))).map((g) => `${g.key} -> ${g.ids.join(", ")}`),
    stale: allow.filter((ids) => !found.has(idKey(ids))).map((ids) => ids.join(", ")),
  };
}

// ---------- tests ----------

test("self-check: the grouping reports seeded duplicates and nothing for a clean fixture", () => {
  const dupes = [
    { id: "a", name: "Teen Crew", org: "Org One", city: "Austin, TX", url: "https://www.example.org/teens/", apply_url: null },
    { id: "b", name: "Teen Crew!", org: "Org One", city: "austin tx", url: "http://example.org/teens?x=1#top", apply_url: null },
  ];
  assert.deepEqual(groupBy(dupes, nameCityKeys).map((g) => g.ids), [["a", "b"]]);
  assert.deepEqual(groupBy(dupes, orgNameKeys).map((g) => g.ids), [["a", "b"]]);
  assert.deepEqual(groupBy(dupes, pageKeys).map((g) => g.ids), [["a", "b"]]);

  const clean = [
    { id: "c", name: "Garden Helpers", org: "Garden Club", city: "Reno, NV", url: "https://garden.example.org/help", apply_url: "https://garden.example.org/apply" },
    { id: "d", name: "Library Aides", org: "City Library", city: "Reno, NV", url: "https://library.example.org/aides", apply_url: null },
  ];
  assert.deepEqual(groupBy(clean, nameCityKeys), []);
  assert.deepEqual(groupBy(clean, orgNameKeys), []);
  assert.deepEqual(groupBy(clean, pageKeys), []);
  assert.equal(pageKey("https://www.Example.org/a/b/?q=1#x"), "example.org/a/b");
  assert.equal(pageKey(null), null);
});

test("no two cards share a normalized name and city, except the NAME_CITY_ALLOW groups", () => {
  const { fresh, stale } = compareWithAllow(groupBy(CARDS, nameCityKeys), NAME_CITY_ALLOW);
  assert.deepEqual(
    fresh,
    [],
    "Cards share a name and city. Check that they are separate programs, then either merge the cards or add the group of ids to NAME_CITY_ALLOW in tests/r2-tests-8.test.mjs with a reason.",
  );
  assert.deepEqual(stale, [], "NAME_CITY_ALLOW has entries that no longer match a real group. Remove them.");
});

test("no two cards share a normalized org plus name", () => {
  const groups = groupBy(CARDS, orgNameKeys);
  assert.deepEqual(
    groups.map((g) => `${g.key} -> ${g.ids.join(", ")}`),
    [],
    "Two cards have the same organization and program name. Merge them or fix the name.",
  );
});

test("ratchet: cards that share a page (host plus path, ignoring query, fragment and trailing slash) match PAGE_ALLOW exactly", () => {
  const { fresh } = compareWithAllow(groupBy(CARDS, pageKeys), PAGE_ALLOW);
  assert.deepEqual(
    fresh,
    [],
    "Cards share one page. Either merge the duplicate cards, or add this group of ids to PAGE_ALLOW in tests/r2-tests-8.test.mjs with a reason (one page lists several programs).",
  );
});

test("every PAGE_ALLOW entry still matches a real shared-page group (remove stale entries)", () => {
  const { stale } = compareWithAllow(groupBy(CARDS, pageKeys), PAGE_ALLOW);
  assert.deepEqual(stale, [], "PAGE_ALLOW has entries that no longer match a real group. Remove them.");
});
