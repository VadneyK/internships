// Ticket r1-tests-1: URL hygiene. Program and employer links must not carry tokens,
// tracking parameters or link shorteners, because those rot or hide the destination.
// Known offenders sit in ALLOW with a reason. The test also fails when an ALLOW entry
// no longer offends, so the list cannot go stale.
// Run with: node --test tests/r1-tests-1-url-hygiene.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => JSON.parse(fs.readFileSync(new URL("../" + p, import.meta.url)));
const entries = read("data/entries.json");
const employers = read("data/employers.json").employers;

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly"];
const BAD_KEY = /^(utm_.*|fbclid|gclid|token|sessionid)$/i;

// Key is "<card id>:<field>". Value is the reason the link stays for now.
const ALLOW = {
  "nyc-cooper-hewitt-design-hive:apply_url":
    "The SOLAA application link carries a token= session string in its fragment. Remove it once the plain SOLAA program page is confirmed.",
  "richmond-youthworks-work-experience:apply_url":
    "The link uses tinyurl.com, which hides the destination. Replace it with the full City of Richmond page once that page is confirmed.",
};

// Returns a list of problems for one URL. Empty means the URL is clean.
function urlProblems(u) {
  let url;
  try {
    url = new URL(u);
  } catch {
    return ["not a parseable URL"];
  }
  const problems = [];
  const keys = [...url.searchParams.keys()];
  // Single-page apps put their query after the # (for example #/page?token=...).
  const hashAt = url.hash.indexOf("?");
  if (hashAt >= 0) keys.push(...new URLSearchParams(url.hash.slice(hashAt + 1)).keys());
  for (const k of keys) if (BAD_KEY.test(k)) problems.push("query key " + k);
  const host = url.hostname.toLowerCase();
  if (SHORTENERS.some((s) => host === s || host.endsWith("." + s))) problems.push("shortener host " + host);
  return problems;
}

// Walks any value and reports every http(s) string with its dotted path.
function walk(value, path, visit) {
  if (typeof value === "string") {
    if (value.startsWith("http")) visit(path, value);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, path + "." + i, visit));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) walk(v, path + "." + k, visit);
  }
}

// Scans every card url and apply_url, plus every link inside employers.json.
function scan() {
  const found = new Map();
  const note = (key, u) => {
    const problems = urlProblems(u);
    if (problems.length) found.set(key, { url: u, problems });
  };
  for (const c of entries) {
    for (const f of ["url", "apply_url"]) {
      if (typeof c[f] === "string") note(c.id + ":" + f, c[f]);
    }
  }
  for (const e of employers) {
    walk(e, e.id, (path, u) => note(path, u));
  }
  return found;
}

test("scanner flags each bad pattern and passes clean links", () => {
  assert.ok(urlProblems("https://x.org/a?utm_source=mail").length > 0, "utm_ query");
  assert.ok(urlProblems("https://x.org/a?fbclid=abc").length > 0, "fbclid query");
  assert.ok(urlProblems("https://x.org/a?gclid=abc").length > 0, "gclid query");
  assert.ok(urlProblems("https://x.org/a?sessionid=abc").length > 0, "sessionid query");
  assert.ok(urlProblems("https://x.org/a#/p?token=abc").length > 0, "token in hash query");
  assert.ok(urlProblems("https://bit.ly/abc").length > 0, "bit.ly");
  assert.ok(urlProblems("https://www.tinyurl.com/abc").length > 0, "tinyurl subdomain");
  assert.equal(urlProblems("https://x.org/a?id=3&page=2").length, 0, "plain query is fine");
  assert.equal(urlProblems("https://example.org/gclid-info").length, 0, "word in path is fine");
  assert.equal(urlProblems("https://notbit.ly.example.org/").length, 0, "lookalike host is fine");
});

test("every card url and apply_url and every employers.json link avoids tokens, tracking params and shorteners, except the named allow-list", () => {
  assert.ok(entries.length > 1000, "entries.json should be scanned in full");
  assert.ok(employers.length >= 40, "employers.json should be scanned in full");
  const found = scan();
  const unexpected = [...found].filter(([key]) => !(key in ALLOW));
  assert.deepEqual(
    unexpected.map(([key, v]) => `${key} -> ${v.url} (${v.problems.join(", ")})`),
    [],
    "new URL offenders found. Fix the link or add a reason to ALLOW."
  );
});

test("allow-list entries each have a reason and still offend, so the list cannot go stale", () => {
  const found = scan();
  for (const [key, reason] of Object.entries(ALLOW)) {
    assert.ok(typeof reason === "string" && reason.trim().length > 20, key + " needs a reason");
    assert.ok(found.has(key), key + " no longer offends. Remove it from ALLOW.");
  }
});
