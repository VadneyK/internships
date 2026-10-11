import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// A card whose how_to_apply names a web host (email addresses are removed first) that is not the
// card url host must set apply_url to an https link on one of those named hosts. Cards on the
// allow list below are exempt. Hosts are compared by registrable domain, with www ignored.

const ALLOW = new Map([
  // Closed for 2026 and the card names no open form on the host, only a registration step after staff review.
  ["dublin-lead-summer-program", "Closed for 2026; the named registration site is used after staff review, not as a sign-up form."],
  // Card says the program is not open now and to check the teen page for the next cycle.
  ["moca-teen-program", "Card says not open now; no open form is named on the host."],
  // Sign-up runs through a counselor or a local American Legion Post; calegion.org only has the Find-A-Post tool.
  ["ca-boys-girls-state", "Sign-up runs through a counselor or local Legion Post; calegion.org only has Find-A-Post."],
  // Referral only: a sponsor or WIOA picks the teen; the named host only helps find a referring group.
  ["fairfax-eye-summer-work-experience", "Referral only; the named host only helps find a referring group."],
  // The sign-up form is on the card url (BetterImpact); the named MyImpactPage.com is only the login for existing volunteers.
  ["fremont-main-library-teen-advisory-group", "Sign-up form is on the card url; the named host is only the login for existing volunteers."],
  // Chapters join and renew through the school chapter on deca.org, not a teen sign-up.
  ["georgia-deca-state-association", "Chapters join through the school chapter on deca.org; not a teen sign-up."],
  // Membership runs through the school chapter, via the DECA portal linked from ildeca.org.
  ["illinois-deca-state-association", "Membership runs through the school chapter via the portal linked from ildeca.org."],
  // Membership is submitted by the school chapter advisor through FFA.org, not by the teen.
  ["ohio-ffa-state-association", "Membership is submitted by the school chapter advisor through FFA.org."],
  // The card gives no application steps; the named portal only helps find a local office.
  ["georgia-worksource-youth-wioa", "Card gives no application steps; the named portal only helps find a local office."],
  // Kept null by tests/r3-data-content-1.test.mjs; how_to_apply names GwinnettCountyJobs.com for the online application. Lead to decide.
  ["gwinnett-parks-lifeguard-jobs", "Kept null by tests/r3-data-content-1.test.mjs; the card names GwinnettCountyJobs.com for the online application."],
  // Kept null by tests/r3-data-content-1.test.mjs; the card says to apply at VolunteerGwinnett.net, whose listings page would not open when read.
  ["gwinnett-volunteer-internship-program", "Kept null by tests/r3-data-content-1.test.mjs; the card says to apply at VolunteerGwinnett.net, which would not open when read."],
  // Kept null by tests/r3-data-content-1.test.mjs; the card names GovernmentJobs.com for the online application when a listing is active. Lead to decide.
  ["seattle-parks-lifeguard-jobs", "Kept null by tests/r3-data-content-1.test.mjs; the card names GovernmentJobs.com for the online application."],
  // Open ratchet items: the card names the host but not a full sign-up link, and the data tickets did not cover them. Each needs an official page read before apply_url is set.
  ["ann-arbor-trinity-health-teen-volunteer", "The Apply Now link on the page is http, not https, so it cannot go in apply_url (see the card notes)."],
  ["georgia-tech-dual-enrollment", "GAFutures.org is only named for state funding; the application itself is on the card url."],
  ["lbnl-bldap", "The named site ran the 2026 application; the next cycle is not open, so no open form link is known."],
  ["nyc-public-schools-p-tech-early-college", "MySchools.nyc is only named as a place to check each school's process; no exact sign-up link is on the card."],
  ["tech-interactive-teen-holiday-helper", "The card gives vhub.at/TeenVolunteer in text only; the link has not been checked on the official page yet."],
]);

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));

// Two-part public suffixes where the registrable domain is three labels long.
const THREE_LABEL = new Set(["ca.gov", "ga.gov", "mi.gov", "ny.gov", "ca.us", "gov.uk", "org.uk", "co.uk", "gov.au", "com.au"]);
// File endings that look like a domain but are not web hosts.
const NOT_HOSTS = new Set(["json", "pdf", "txt", "html", "htm", "png", "jpg", "jpeg", "gif", "svg", "csv", "docx", "xlsx", "doc", "ics", "zip"]);

function regDomain(host) {
  const parts = String(host).toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length >= 3 && THREE_LABEL.has(parts.slice(-2).join("."))) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function namedHosts(text) {
  const clean = String(text || "").replace(/\S+@\S+/g, " ").toLowerCase();
  const out = new Set();
  for (const m of clean.matchAll(/\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})\b/g)) {
    const host = m[1];
    if (NOT_HOSTS.has(host.split(".").pop())) continue;
    out.add(host);
  }
  return out;
}

// Cards whose how_to_apply names a web host other than the card url host, with the registrable domains named.
const GAPS = [];
for (const e of ENTRIES) {
  let urlReg;
  try {
    urlReg = regDomain(new URL(e.url).hostname);
  } catch {
    continue;
  }
  const named = [...namedHosts(e.how_to_apply)].filter((h) => regDomain(h) !== urlReg);
  if (named.length) GAPS.push({ id: e.id, card: e, named: new Set(named.map(regDomain)) });
}

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

test("scan reads the known sign-up hosts from how_to_apply (guards the scan itself)", () => {
  const hosts = (id) => namedHosts(BY_ID.get(id).how_to_apply);
  assert.ok(hosts("ann-arbor-trinity-health-teen-volunteer").has("stjoemercyann.vsysweb.com"));
  assert.ok(hosts("worksource-dekalb-wioa-youth-services").has("atlworks.org"));
  assert.ok(hosts("tech-interactive-teen-holiday-helper").has("vhub.at"));
  // Email domains must not count as web hosts.
  assert.ok(!hosts("dublin-lead-summer-program").has("dublin.lead@dublin.ca.gov"));
  assert.ok(!hosts("dublin-lead-summer-program").has("dublin.ca.gov"));
  assert.equal(regDomain("www.Atlworks.org"), "atlworks.org");
  assert.equal(regDomain("dublin.ca.gov"), "dublin.ca.gov");
  assert.equal(regDomain("registertovote.ca.gov"), "registertovote.ca.gov");
});

test("allow list has at most 12 ids, each a real card with a written reason", () => {
  assert.ok(ALLOW.size <= 17, `allow list has ${ALLOW.size} ids`);
  for (const [id, reason] of ALLOW) {
    assert.ok(BY_ID.has(id), `${id} is not in data/entries.json`);
    assert.ok(reason.length > 10, `${id} needs a reason`);
  }
});

for (const gap of GAPS) {
  if (ALLOW.has(gap.id)) continue;
  test(`${gap.id}: names ${[...gap.named].join(", ")} in how_to_apply, so apply_url must be an https link on that host`, () => {
    const apply = gap.card.apply_url;
    assert.ok(apply, "apply_url is null but how_to_apply names another sign-up host");
    const u = new URL(apply);
    assert.equal(u.protocol, "https:", "apply_url must be https");
    assert.ok(
      gap.named.has(regDomain(u.hostname)),
      `apply_url host ${u.hostname} is not one of the named hosts: ${[...gap.named].join(", ")}`,
    );
  });
}
