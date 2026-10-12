// Ratchet for duplicate program cards (ticket r2-tests-5).
// A duplicate is two cards with the same normalized name and a shared region, or the same url and the same name.
// Cards that share only a url are allowed only when listed in SHARED_URL_ALLOW, with the exact ids that share it.
// NAME_REGION_ALLOW does the same for cards with the same name in the same region.
// The lists only shrink: a new shared url, a new card on a listed url, or a listed url that no longer shares fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PROGRAMS = new URL("../data/programs/", import.meta.url);

const files = fs.readdirSync(PROGRAMS).filter((f) => f.endsWith(".json")).sort();
const cards = files.map((file) => ({
  file,
  card: JSON.parse(fs.readFileSync(new URL(file, PROGRAMS), "utf8")),
}));

// Same name after lower case and removing punctuation, so "Teen  Volunteer, Program" matches.
function normName(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function urlsOf(card) {
  return [...new Set([card.url, card.apply_url].filter(Boolean))];
}

// Keys are "normalized name|region". Each value lists the exact ids that share that key today.
const NAME_REGION_ALLOW = new Map([
  ["summer youth employment program|arizona", {
    ids: ["phoenix-gphxul-summer-youth-employment", "tucson-pima-county-summer-youth-employment"],
    reason: "Different organizations use the same generic program name. Added 2026-10-11 for ticket p7-regions-1.",
  }],
  ["teen volunteer program|arizona", {
    ids: ["phoenix-desert-botanical-garden-teen-volunteer", "tucson-pima-county-library-teen-volunteer"],
    reason: "Different organizations use the same generic program name. Added 2026-10-11 for ticket p7-regions-1.",
  }],
  ["summer volunteen program|tennessee", {
    ids: ["memphis-le-bonheur-summer-volunteen", "memphis-methodist-summer-volunteen"],
    reason: "Two different Memphis hospital systems (Le Bonheur, Methodist) use the same generic program name. Added 2026-10-11 for ticket p7-regions-1.",
  }],
  ["summer teen volunteer program|kentucky", {
    ids: ["lexington-uk-healthcare-summer-teen-volunteer", "louisville-norton-healthcare-summer-teen-volunteer", "louisville-uofl-health-summer-teen-volunteer"],
    reason: "Three different health systems (UK HealthCare, Norton Healthcare, UofL Health) use the same generic program name. Added 2026-10-11 for ticket p7-regions-1.",
  }],
  ["teen volunteer program|nevada", {
    ids: ["henderson-libraries-teen-volunteer", "las-vegas-discovery-childrens-museum-teen-volunteers"],
    reason: "Two different organizations (Henderson Libraries, Discovery Children's Museum) use the same generic program name. Added 2026-10-11 for ticket p7-regions-1.",
  }],
  ["high school volunteer program|inland-empire", {
    ids: ["pomona-valley-hospital-high-school-volunteer", "san-antonio-regional-hospital-high-school-volunteer"],
    reason: "Two different hospitals (Pomona Valley Hospital, San Antonio Regional Hospital) use the same generic program name.",
  }],
]);

// Shared url -> the exact ids that share it today. Starts from the 23 urls used by more than one card
// (url or apply_url), as found in data/programs on 2026-10-10.
const SHARED_URL_ALLOW = new Map([
  // Added 2026-10-12 for the 77 Plains state cards.
  ["https://apply2.ksu.edu/register/summerprogramshhs2027", {
    ids: ["manhattan-ks-k-state-health-professions-exploration-program", "manhattan-ks-k-state-summer-fashion-institute"],
    reason: "Shared hub: one official K-State 2027 interest list is where both College of Health and Human Sciences camps send you.",
  }],
  // Added 2026-10-11 for ticket p7-regions-1.
  ["https://nwyouthcorps.workbrightats.com/pages/opportunitiesbycategory/", {
    ids: ["eugene-nyc-youth-camping-conservation-crews", "eugene-nyc-youth-urban-community-forestry-crews", "portland-nyc-youth-community-crews"],
    reason: "Shared hub: one Northwest Youth Corps job board lists the crews for several cities.",
  }],
  ["https://www.governmentjobs.com/careers/portlandor", {
    ids: ["portland-parks-lifeguard-swim-instructor-training", "portland-parks-recreation-youth-summer-jobs", "portland-youth-conservation-crew"],
    reason: "Shared hub: the City of Portland job board on GovernmentJobs.com, where each city program posts its openings.",
  }],
  ["https://genesysworks.org/for-students-and-families/application-process/", {
    ids: ["chicago-genesys-works-internship", "florida-genesys-works-jacksonville-internship"],
    reason: "Shared hub: one national Genesys Works application page covers several cities.",
  }],
  ["https://app.campdoc.com/register/pointpark", {
    ids: ["pittsburgh-point-park-entrepreneurship-camp", "pittsburgh-point-park-sports-business-camp"],
    reason: "Same link on 2 cards (Point Park University (Rowland School of Business)). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://application.nycsyep.com/", {
    ids: ["nyc-dycd-ladders-for-leaders", "nyc-dycd-summer-youth-employment-program"],
    reason: "Same link on 2 cards (NYC Department of Youth and Community Development (DYCD)). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://apply-precollege.studentaffairs.cmu.edu/apply/", {
    ids: ["pittsburgh-cmu-cs-scholars", "pittsburgh-cmu-pre-college-programs", "pittsburgh-cmu-summer-academy-math-science"],
    reason: "Same link on 3 cards (Carnegie Mellon University Pre-College Programs). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://apply.spelman.edu/register/summerprograms", {
    ids: ["spelman-college-prep-institute", "spelman-early-college-program"],
    reason: "Same link on 2 cards (Spelman College). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://ascensionil.vsyslive.com/", {
    ids: ["ascension-alexian-brothers-teen-volunteer", "ascension-saint-alexius-teen-volunteer"],
    reason: "Same link on 2 cards (Ascension Alexian Brothers Medical Center; Ascension Saint Alexius Medical Center). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://berkeleyca.gov/youthworks", {
    ids: ["berkeley-youthworks", "ecology-center-youth-environmental-academy"],
    reason: "Same link on 2 cards (City of Berkeley; Ecology Center). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://bttr.im/wlw2b", {
    ids: ["fresno-chaffee-zoo-volunteens", "fresno-chaffee-zoo-zoo-camp-junior-counselor"],
    reason: "Same link on 2 cards (Fresno Chaffee Zoo). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://sadienashleadershipproject.my.salesforce-sites.com/application", {
    ids: ["nyc-sadie-nash-leadership-scholars", "nyc-sadie-nash-nash-u-leadership-internship", "nyc-sadie-nash-siblinghood-academy"],
    reason: "Shared hub: one Sadie Nash application form covers several programs.",
  }],
  ["https://app.getacceptd.com/ccmsummer", {
    ids: ["cincinnati-ccm-prep-musical-theatre-intensive", "cincinnati-ccm-prep-strings-intensive"],
    reason: "Shared hub: one CCM Prep application portal covers both summer intensives (ticket r2-data-content-4).",
  }],
  ["https://cosmos-ucop.ucdavis.edu/", {
    ids: ["cosmos-uc-davis", "uci-cosmos"],
    reason: "Same link on 2 cards (University of California (UC Davis campus); University of California, Irvine (COSMOS)). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://enroll.jobcorps.gov", {
    ids: ["job-corps-georgia-brunswick-turner", "job-corps-minnesota-hubert-h-humphrey", "job-corps-sacramento", "job-corps-texas-gary-san-marcos", "job-corps-washington-centers", "national-job-corps-free-training-ages-16-24"],
    reason: "Shared hub: one federal Job Corps enrollment page that many centers link to.",
  }],
  ["https://4h.zsuite.org", {
    ids: ["new-mexico-4h-nmsu", "utah-4h-mock-legislature"],
    reason: "Shared hub: the 4-H registration site (Zsuite) that several state 4-H programs use.",
  }],
  ["https://fermilab.wd5.myworkdayjobs.com/en-US/FermilabCareers", {
    ids: ["fermilab-prism", "fermilab-valor-jrotc"],
    reason: "Same link on 2 cards (Fermilab). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://forms.office.com/Pages/ResponsePage.aspx?id=EVMR5cP2G0K8A6XYx5v1Rn7l2V-nZmJIpeHd5rBoiuhURUgyUk8zU1dGOFI1SVUyS0pXS1NPTllNRC4u", {
    ids: ["glendale-youth-alliance-step", "glendale-youth-alliance-summer-youth-employment", "glendale-youth-alliance-team-program"],
    reason: "Same link on 3 cards (Glendale Youth Alliance). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://forms.office.com/r/8Nkty1Xy0p", {
    ids: ["twin-cities-juxtaposition-arts-jxtalabs-apprenticeships", "twin-cities-juxtaposition-arts-valt-drawing"],
    reason: "Same link on 2 cards (Juxtaposition Arts). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://lpzoo.slideroom.com/", {
    ids: ["chicago-lincoln-park-zoo-research-apprenticeship", "chicago-lincoln-park-zoo-zoo-intern-program"],
    reason: "Same link on 2 cards (Lincoln Park Zoo). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://mikvachallenge.org/general-program-application/", {
    ids: ["chicago-mikva-cps-student-advisory-council", "chicago-mikva-safety-and-justice-council", "chicago-mikva-summer-fellows", "chicago-mikva-teen-health-council"],
    reason: "Same link on 4 cards (Mikva Challenge Illinois; Mikva Challenge Illinois with the Illinois Department of Human Services Youth Investment Program). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://mites.mit.edu/discover-mites/apply-to-mites/", {
    ids: ["boston-mit-mites-saturdays", "boston-mit-mites-summer"],
    reason: "Same link on 2 cards (MIT (MITES, Introduction to Technology, Engineering and Science)). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://nhsi.northwestern.edu/apply-now/", {
    ids: ["northwestern-nhsi-debate-institute", "northwestern-nhsi-film-video", "northwestern-nhsi-theatre-arts"],
    reason: "Same link on 3 cards (Northwestern University School of Communication). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://oaklandlibrary.org/teenvolunteers", {
    ids: ["oakland-public-library-teen-advisory-board", "oakland-public-library-teen-volunteer"],
    reason: "Same link on 2 cards (Oakland Public Library). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://redcap.link/2027UCCCCPathwayPrograms", {
    ids: ["chicago-uchicago-eyes-on-cancer", "chicago-uchicago-hero-oncology", "chicago-uchicago-researchstart"],
    reason: "Same link on 3 cards (University of Chicago Medicine Comprehensive Cancer Center; University of Chicago Medicine Comprehensive Cancer Center with UIC, UIUC, Northwestern and Rush). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://www.chicagoyouthworks.org/", {
    ids: ["chicago-youth-works-summer-jobs", "chicagobility-ages-14-15", "cpl-summer-teen-internships"],
    reason: "Same link on 3 cards (City of Chicago Dept. of Family and Support Services; Chicago Public Library with After School Matters). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://www.jobcorps.gov/", {
    ids: ["cassadaga-job-corps-center", "delawarevalley-job-corps-center", "edison-job-corps-center", "glenmont-job-corps-center", "grafton-job-corps-center", "iroquois-job-corps-center", "keystone-job-corps-center", "oneonta-job-corps-center", "philadelphia-job-corps-center", "pittsburgh-job-corps-center", "redrock-job-corps-center"],
    reason: "Shared hub: one federal Job Corps page that many centers link to.",
  }],
  ["https://www.partner4work.org/learn-earn", {
    ids: ["pittsburgh-grow-pittsburgh-urban-farmers-in-training", "pittsburgh-learn-and-earn-summer"],
    reason: "Same link on 2 cards (Grow Pittsburgh; Partner4Work, Allegheny County and City of Pittsburgh). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://www.summer.ucsb.edu/apply", {
    ids: ["santa-barbara-ucsb-research-mentorship-program", "santa-barbara-ucsb-summer-research-academies"],
    reason: "Same link on 2 cards (UC Santa Barbara Summer Sessions). Not yet reviewed as a shared hub or a duplicate.",
  }],
  ["https://www.volgistics.com/ex/portal.dll/ap?AP=268451798", {
    ids: ["bloomington-wonderlab-teen-volunteer", "bloomington-wonderlab-wondercamp-high-school-intern"],
    reason: "Same link on 2 cards (WonderLab Museum of Science, Health, and Technology). Not yet reviewed as a shared hub or a duplicate.",
  }],

]);

// Build the lookups once.
const byName = new Map();
for (const { card } of cards) {
  for (const region of card.regions ?? []) {
    const key = `${normName(card.name)}|${region}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(card.id);
  }
}
const byUrl = new Map();
for (const { card } of cards) {
  for (const url of urlsOf(card)) {
    if (!byUrl.has(url)) byUrl.set(url, []);
    byUrl.get(url).push(card);
  }
}
const sharedUrls = new Map([...byUrl].filter(([, list]) => list.length > 1));

test("every program file is named after its id", () => {
  const bad = cards
    .filter(({ file, card }) => file !== `${card.id}.json`)
    .map(({ file, card }) => `${file} has id ${card.id}`);
  assert.deepEqual(bad, [], "file name must equal id plus .json");
});

test("no two cards share a normalized name and a region without an allow entry", () => {
  const dupes = [...byName].filter(([, ids]) => ids.length > 1);
  for (const [key, ids] of dupes) {
    const allowed = NAME_REGION_ALLOW.get(key);
    assert.ok(allowed, `${key} is shared by ${ids.join(", ")}. Make them different programs or add the key to NAME_REGION_ALLOW with a reason.`);
    assert.deepEqual([...ids].sort(), [...allowed.ids].sort(), `${key} now shares a different set of cards`);
  }
  for (const key of NAME_REGION_ALLOW.keys()) {
    assert.ok(byName.has(key) && byName.get(key).length > 1, `${key} no longer shares a name and region. Remove it from NAME_REGION_ALLOW.`);
  }
});

test("no two cards share the same url and the same name", () => {
  for (const [url, list] of sharedUrls) {
    const seen = new Map();
    for (const card of list) {
      const key = normName(card.name);
      if (seen.has(key)) {
        assert.fail(`${seen.get(key)} and ${card.id} share ${url} and the name "${card.name}". One is a duplicate.`);
      }
      seen.set(key, card.id);
    }
  }
});

test("every shared url is on the allow list with exactly the cards that share it", () => {
  for (const [url, list] of sharedUrls) {
    const allowed = SHARED_URL_ALLOW.get(url);
    const ids = list.map(({ id }) => id);
    assert.ok(allowed, `${url} is shared by ${ids.join(", ")}. Add it to SHARED_URL_ALLOW with a reason, or fix the duplicate.`);
    assert.deepEqual([...ids].sort(), [...allowed.ids].sort(), `${url} now shares a different set of cards. Update SHARED_URL_ALLOW.`);
  }
});

test("every SHARED_URL_ALLOW entry still shares its url", () => {
  for (const url of SHARED_URL_ALLOW.keys()) {
    assert.ok(sharedUrls.has(url), `${url} no longer shared by more than one card. Remove it from SHARED_URL_ALLOW.`);
  }
});

test("every allow entry has a one line reason", () => {
  for (const [key, entry] of [...SHARED_URL_ALLOW, ...NAME_REGION_ALLOW]) {
    assert.ok(typeof entry.reason === "string" && entry.reason.trim().length > 0, `${key} needs a reason`);
    assert.ok(!entry.reason.includes("\n"), `${key} reason must be one line`);
  }
});
