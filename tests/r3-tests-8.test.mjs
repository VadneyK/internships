// Source provenance and host hygiene for every program card (data/programs/*.json).
// Hard rule: every fact comes from a page that was read. So for each card:
//   - a card marked "fetched" has its own url (after trimming www, trailing slash and fragment) in sources_fetched;
//   - sources_fetched has no duplicates and every entry is https;
//   - verified_on is a real date, not after data/meta.json "checked", and "checked" is not before the newest verified_on;
//   - a "snippet-only" card has no deadline_iso (a snippet is not enough to state a deadline).
// Host rules: url, apply_url and sources_fetched may not point at link shorteners, social networks, job boards,
// news sites, Wikipedia or search pages. The known hits are listed in the allowlists below, each with a reason.
// An allowlist entry that no longer matches a real hit fails, so it gets removed.
// The seeded-bad fixtures at the bottom prove that each rule really fires.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROGRAMS_DIR = path.join(ROOT, "data", "programs");
const META = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "meta.json"), "utf8"));

// Denied hosts, grouped by reason. A listed host matches itself and any subdomain of it.
const DENY = {
  "url shortener": ["tinyurl.com", "bit.ly", "t.co", "goo.gl", "ow.ly", "linktr.ee"],
  "social network": ["facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "linkedin.com"],
  "job board": ["indeed.com", "glassdoor.com", "ziprecruiter.com"],
  "news or encyclopedia": ["deseret.com", "wikipedia.org"],
};
// Search engines match on the exact host only (so docs.google.com is fine). Any path starting with /search is a search page.
const SEARCH_HOSTS = ["google.com", "bing.com", "duckduckgo.com", "search.yahoo.com", "search.brave.com"];

// Known hits, per card id, by exact host (www. removed). Each entry needs a reason.
const HOST_ALLOW = {
  // apply_url is a link shortener. Replace it with the official form link once that page is read.
  "richmond-youthworks-work-experience": ["tinyurl.com"],
  // sources_fetched has a news article about the federal Job Corps settlement.
  "job-corps-sacramento": ["deseret.com"],
  // The program is the Wikipedia contribution guide, so its own page is on Wikipedia.
  "wikipedia-editing": ["en.wikipedia.org"],
};

// Sources that are not https, per card id, by exact URL. Remove the entry once the source is switched to https and read there.
const HTTP_ALLOW = {
  // This WorkOne page is linked over http only.
  "indiana-dwd-workone-young-adult-services": ["http://www.workonewestcentral.org/60.html"],
};

// ---------- pure helpers (exported to the fixture checks below) ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// True only for a real calendar date written as YYYY-MM-DD (rejects 2026-02-30).
function isRealDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Lowercase host without www.
function hostOf(u) {
  return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
}

// Normalized url: https (or the scheme as written), host without www, no trailing slash, no fragment. Query is kept.
function normUrl(u) {
  const x = new URL(u);
  const host = x.hostname.toLowerCase().replace(/^www\./, "");
  const pathPart = x.pathname.replace(/\/+$/, "");
  return `${x.protocol.toLowerCase()}//${host}${pathPart}${x.search}`;
}

// Returns the reason a url is denied, or null.
function denyLabel(u) {
  const host = hostOf(u);
  const { pathname } = new URL(u);
  for (const [label, hosts] of Object.entries(DENY)) {
    if (hosts.some((d) => host === d || host.endsWith("." + d))) return label;
  }
  if (SEARCH_HOSTS.includes(host) || /^\/search(\/|$)/.test(pathname)) return "search page";
  return null;
}

// Every denied hit in one card's url, apply_url and sources_fetched.
function hostHits(card) {
  const hits = [];
  const sources = Array.isArray(card.sources_fetched) ? card.sources_fetched : [];
  const fields = [["url", card.url], ["apply_url", card.apply_url], ...sources.map((s) => ["sources_fetched", s])];
  for (const [field, u] of fields) {
    if (typeof u !== "string" || u === "") continue;
    const label = denyLabel(u);
    if (label) hits.push({ field, url: u, host: hostOf(u), label });
  }
  return hits;
}

// Runs every provenance and host rule. Returns a list of problems (empty when all rules pass).
function checkCards(cards, meta, { hostAllow = HOST_ALLOW, httpAllow = HTTP_ALLOW } = {}) {
  const problems = [];
  const add = (code, id, detail) => problems.push({ code, id, detail });

  let newest = "";
  for (const c of cards) if (isRealDate(c.verified_on) && c.verified_on > newest) newest = c.verified_on;
  if (!isRealDate(meta.checked)) add("bad-date", "meta", `checked is ${meta.checked}`);
  else if (newest && meta.checked < newest) add("meta-before-newest", "meta", `checked ${meta.checked} is before ${newest}`);

  const usedHostAllow = new Set();
  const usedHttpAllow = new Set();

  for (const c of cards) {
    const id = c.id;
    if (!Array.isArray(c.sources_fetched)) {
      add("no-sources", id, "sources_fetched is not a list");
      continue;
    }

    const seen = new Set();
    for (const s of c.sources_fetched) {
      if (seen.has(s)) add("duplicate-source", id, s);
      seen.add(s);
      let proto = null;
      try {
        proto = new URL(s).protocol;
      } catch {
        add("bad-url", id, String(s));
        continue;
      }
      if (proto !== "https:") {
        if ((httpAllow[id] || []).includes(s)) usedHttpAllow.add(`${id} ${s}`);
        else add("not-https", id, s);
      }
    }

    if (c.verified === "fetched") {
      try {
        const normSources = new Set(c.sources_fetched.map(normUrl));
        if (!normSources.has(normUrl(c.url))) add("url-not-in-sources", id, String(c.url));
      } catch {
        add("bad-url", id, String(c.url));
      }
    }

    if (!isRealDate(c.verified_on)) add("bad-date", id, `verified_on is ${c.verified_on}`);
    else if (isRealDate(meta.checked) && c.verified_on > meta.checked) add("after-checked", id, `${c.verified_on} is after ${meta.checked}`);

    if (c.verified === "snippet-only" && c.deadline_iso != null) add("snippet-deadline", id, `deadline_iso ${c.deadline_iso}`);

    for (const hit of hostHits(c)) {
      if ((hostAllow[id] || []).includes(hit.host)) usedHostAllow.add(`${id} ${hit.host}`);
      else add("denied-host", id, `${hit.label}: ${hit.host} in ${hit.field}`);
    }
  }

  for (const [id, hosts] of Object.entries(hostAllow)) {
    for (const h of hosts) {
      if (!usedHostAllow.has(`${id} ${h}`)) add("stale-allow", id, `host ${h} no longer hits`);
    }
  }
  for (const [id, urls] of Object.entries(httpAllow)) {
    for (const u of urls) {
      if (!usedHttpAllow.has(`${id} ${u}`)) add("stale-allow", id, `http source ${u} no longer hits`);
    }
  }
  return problems;
}

function loadCards() {
  return fs
    .readdirSync(PROGRAMS_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(PROGRAMS_DIR, f), "utf8")));
}

const CARDS = loadCards();
const fmt = (p) => `${p.code} ${p.id}: ${p.detail}`;

// ---------- tests on the real data ----------

test("the program folder has cards to check", () => {
  assert.ok(CARDS.length > 0, "no program files found");
  for (const c of CARDS) assert.ok(typeof c.id === "string" && c.id !== "", "every card has an id");
});

test("every fetched card has its own url in sources_fetched (normalized)", () => {
  const bad = CARDS.filter((c) => c.verified === "fetched").filter((c) => {
    const norm = new Set(c.sources_fetched.map(normUrl));
    return !norm.has(normUrl(c.url));
  });
  assert.deepEqual(bad.map((c) => c.id), []);
});

test("real data: provenance, dates and host rules all pass", () => {
  const problems = checkCards(CARDS, META);
  assert.deepEqual(problems.map(fmt), []);
});

test("real data: every allowlisted host and http source is still a real hit", () => {
  const problems = checkCards(CARDS, META).filter((p) => p.code === "stale-allow");
  assert.deepEqual(problems.map(fmt), []);
});

// ---------- seeded-bad fixtures: each rule must fire, and clean cards must pass ----------

const BASE = (over = {}) => ({
  id: "fixture-card",
  url: "https://example.gov/teen-jobs",
  apply_url: null,
  sources_fetched: ["https://example.gov/teen-jobs"],
  verified: "fetched",
  verified_on: "2026-10-01",
  deadline_iso: null,
  ...over,
});
const META_OK = { checked: "2026-10-09" };
const NONE = { hostAllow: {}, httpAllow: {} };

test("fixture: clean cards pass (url normalization, Google Docs and Sites are not search pages)", () => {
  const cards = [
    BASE({ id: "fx-clean" }),
    BASE({ id: "fx-normalize", url: "https://WWW.Example.gov/teen-jobs/#apply", sources_fetched: ["https://example.gov/teen-jobs"] }),
    BASE({ id: "fx-docs", url: "https://docs.google.com/forms/d/x", sources_fetched: ["https://docs.google.com/forms/d/x"] }),
    BASE({ id: "fx-sites", url: "https://sites.google.com/view/teen", sources_fetched: ["https://sites.google.com/view/teen"] }),
  ];
  assert.deepEqual(checkCards(cards, META_OK, NONE).map(fmt), []);
});

test("fixture: each seeded bad card trips its rule", () => {
  const cases = [
    { code: "denied-host", id: "fx-shortener", cards: [BASE({ id: "fx-shortener", apply_url: "https://tinyurl.com/abc" })] },
    {
      code: "denied-host", id: "fx-social",
      cards: [BASE({ id: "fx-social", sources_fetched: ["https://example.gov/teen-jobs", "https://www.facebook.com/teenjobs"] })],
    },
    {
      code: "denied-host", id: "fx-board",
      cards: [BASE({ id: "fx-board", url: "https://www.indeed.com/q-teen-jobs.html", sources_fetched: ["https://www.indeed.com/q-teen-jobs.html"] })],
    },
    {
      code: "denied-host", id: "fx-search",
      cards: [BASE({ id: "fx-search", url: "https://www.google.com/search?q=teen+jobs", sources_fetched: ["https://www.google.com/search?q=teen+jobs"] })],
    },
    {
      code: "denied-host", id: "fx-news",
      cards: [BASE({ id: "fx-news", sources_fetched: ["https://example.gov/teen-jobs", "https://www.deseret.com/x"] })],
    },
    {
      code: "duplicate-source", id: "fx-dup",
      cards: [BASE({ id: "fx-dup", sources_fetched: ["https://example.gov/teen-jobs", "https://example.gov/teen-jobs"] })],
    },
    {
      code: "not-https", id: "fx-http",
      cards: [BASE({ id: "fx-http", url: "http://example.gov/teen-jobs", sources_fetched: ["http://example.gov/teen-jobs"] })],
    },
    { code: "url-not-in-sources", id: "fx-missing", cards: [BASE({ id: "fx-missing", url: "https://example.gov/other" })] },
    {
      code: "snippet-deadline", id: "fx-snippet",
      cards: [BASE({ id: "fx-snippet", verified: "snippet-only", deadline_iso: "2026-11-01", sources_fetched: [] })],
    },
    { code: "bad-date", id: "fx-date", cards: [BASE({ id: "fx-date", verified_on: "2026-02-30" })] },
    { code: "after-checked", id: "fx-future", cards: [BASE({ id: "fx-future", verified_on: "2026-10-20" })] },
    { code: "meta-before-newest", id: "meta", cards: [BASE({ id: "fx-newest", verified_on: "2026-10-01" })], meta: { checked: "2026-09-30" } },
    { code: "stale-allow", id: "fixture-card", cards: [BASE({})], opts: { hostAllow: { "fixture-card": ["tinyurl.com"] } } },
    {
      code: "stale-allow", id: "fixture-card", cards: [BASE({})],
      opts: { httpAllow: { "fixture-card": ["http://example.gov/teen-jobs"] } },
    },
  ];
  for (const k of cases) {
    const problems = checkCards(k.cards, k.meta || META_OK, { ...NONE, ...(k.opts || {}) });
    const hit = problems.some((p) => p.code === k.code && p.id === k.id);
    assert.ok(hit, `expected ${k.code} on ${k.id}, got: ${problems.map(fmt).join(" | ") || "nothing"}`);
  }
});

test("fixture: an allowlisted host passes, and the same host without the allowlist fails", () => {
  const cards = [BASE({ id: "fx-allowed", apply_url: "https://tinyurl.com/abc" })];
  assert.deepEqual(checkCards(cards, META_OK, { hostAllow: { "fx-allowed": ["tinyurl.com"] }, httpAllow: {} }).map(fmt), []);
  const unlisted = checkCards(cards, META_OK, NONE);
  assert.ok(unlisted.some((p) => p.code === "denied-host" && p.id === "fx-allowed"));
});
