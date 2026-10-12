// A link whose visible text shows an address must go where the text says (ticket r3-tests-7).
// Many cards show a domain such as "dol.gov" or a phone number as the link text. A teen reads that text as
// "this is where I am going", so the link target must agree with it:
//   - Domain-like text (word.tld, optionally with https:// or a path): every domain in the text must be the href host,
//     or a subdomain of it, after "www." is dropped from both sides. "ftc.gov" may link to reportfraud.ftc.gov.
//     "dol.gov" may not link to dol.gov.example.com.
//   - Phone text: one phone-number-shaped run in the text (letters in capital words are read as phone keypad digits,
//     so "1-800-321-OSHA" reads as 1-800-321-6742) must equal the tel: digits, with or without the leading 1.
//     A run cut from inside a longer block of digits does not count.
//   - Email text: the mailto: address must equal the visible email, ignoring case.
// Every a[href] is checked on every root page, and on the Find (one place at a time, Show more until done), Calendar
// (every month) and Languages (every place) cards after they draw. Each check fails with the page, the text and the href.
// Known exceptions sit in ALLOW, each with a reason. An allow entry that matches nothing fails, so the list cannot go stale.
// Run with: node --test tests/r3-tests-7-link-text-matches-href.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { loadPage, type, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
// The live site address. Relative hrefs resolve against it, so they never match a domain in the text by accident.
const BASE = "https://vadneyk.github.io/internships/";

// Known exceptions: { page, text, href, reason }. Matched on all three of page, text and href. Empty today: every
// address-like link in the built pages already agrees with its text.
const ALLOW = [];

// Words after a dot that are file names, not web hosts ("rules.html" is a page, not a site).
const FILE_EXT = new Set(["html", "htm", "pdf", "json", "csv", "js", "css", "txt", "png", "jpg", "jpeg", "gif", "svg", "md", "xml", "zip", "ics"]);
// Phone keypad letters, used only for capital-letter words such as OSHA, US and WAGE.
const KEYPAD = { A: 2, B: 2, C: 2, D: 3, E: 3, F: 3, G: 4, H: 4, I: 4, J: 5, K: 5, L: 5, M: 6, N: 6, O: 6, P: 7, Q: 7, R: 7, S: 7, T: 8, U: 8, V: 8, W: 9, X: 9, Y: 9, Z: 9 };
// A domain-like token: starts the text or follows a space or "(", may start with https://, ends before a space, a closing
// bracket, punctuation or a slash. The last label must be 2 or more letters.
const DOMAIN_G = /(?:^|[\s(])((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?=[\s),.:;!?/]|$)/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const bare = (host) => host.toLowerCase().replace(/^www\./, "");
const national = (digits) => (digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits);

// Domain-like tokens in the visible text that are real hosts (not file names). Returns the host of each, lower case.
export function domainsIn(text) {
  const hosts = [];
  for (const m of clean(text).matchAll(DOMAIN_G)) {
    const host = m[1].replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    if (FILE_EXT.has(host.split(".").pop())) continue;
    hosts.push(host);
  }
  return hosts;
}

// Digits of every phone-number-shaped run in the text, with keypad letters applied to capital-letter words.
// A run starts at a digit with no digit before it and ends at a digit with no digit after it, and holds only digits,
// spaces, dots, dashes and brackets. So a run cannot be cut from inside a longer block of digits.
export function phoneRuns(text) {
  const t = clean(text).replace(/[A-Z]{2,}/g, (w) => w.replace(/[A-Z]/g, (c) => String(KEYPAD[c])));
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (!/\d/.test(t[i]) || (i > 0 && /\d/.test(t[i - 1]))) continue;
    for (let j = i; j < t.length; j++) {
      const c = t[j];
      if (/[^\d\s.()-]/.test(c)) break;
      if (!/\d/.test(c)) continue;
      if (j + 1 < t.length && /\d/.test(t[j + 1])) continue;
      out.push(t.slice(i, j + 1).replace(/\D/g, ""));
    }
  }
  return out;
}

// Returns null when the link agrees with its visible text, else a short reason. Text with no address in it passes.
export function checkLink(text, href) {
  const t = clean(text);
  const h = clean(href);
  const domains = domainsIn(t);
  if (/^mailto:/i.test(h)) {
    const em = EMAIL_RE.exec(t);
    if (em) {
      const addr = decodeURIComponent(h.replace(/^mailto:/i, "").split("?")[0]).trim();
      return addr.toLowerCase() === em[0].toLowerCase() ? null : "the mailto address " + addr + " is not the visible email " + em[0];
    }
    return domains.length ? "the text names a website but the link is an email link" : null;
  }
  if (/^tel:/i.test(h)) {
    if (domains.length) return "the text names a website but the link is a phone link";
    const want = national(h.replace(/^tel:/i, "").replace(/\D/g, ""));
    const runs = phoneRuns(t);
    if (!runs.some((r) => r.length >= 7)) return null; // no phone number is shown, so there is nothing to match
    if (want.length >= 10 && runs.some((r) => r.length >= 10 && national(r) === want)) return null;
    return "no phone number shown in the text matches the call link";
  }
  let url;
  try { url = new URL(h, BASE); } catch (e) { return "the link address cannot be read"; }
  if (!domains.length) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return "the text names a website but the link is not a web address";
  const host = bare(url.hostname);
  for (const d of domains) {
    const want = bare(d);
    if (host !== want && !host.endsWith("." + want)) return "the text says " + d + " but the link goes to " + host;
  }
  return null;
}

// Every a[href] in a document, as { text, href } (the href as written in the markup).
export function linksIn(doc) {
  return [...doc.querySelectorAll("a[href]")].map((a) => ({ text: clean(a.textContent), href: a.getAttribute("href") }));
}

// The problems in one document: { page, text, href, why }, minus the allowed ones.
export function problemsIn(page, doc, allow = ALLOW) {
  const out = [];
  for (const l of linksIn(doc)) {
    const why = checkLink(l.text, l.href);
    if (!why) continue;
    if (allow.some((a) => a.page === page && a.text === l.text && a.href === l.href)) continue;
    out.push({ page, text: l.text, href: l.href, why });
  }
  return out;
}

export function format(p) {
  return p.page + ": link text \"" + p.text + "\" goes to \"" + p.href + "\" (" + p.why + ")";
}

// Reading a page: loads it and runs the same scan on the cards each page draws after a choice.
const memo = new Map();
function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn());
  return memo.get(key);
}

// The raw problems (before ALLOW) of each root page, plus the rendered card views below.
async function rootProblems(file) {
  return once("root:" + file, async () => {
    const page = await loadPage(file);
    await tick(120);
    return problemsIn(file, page.document, []);
  });
}

async function showAllCards(document) {
  for (let i = 0; i < 40; i++) {
    const b = document.getElementById("more");
    if (!b || b.hidden || b.disabled) break;
    b.click();
    await tick(80);
  }
}

// Scans the Find cards for each place in the list (one page load, places changed in place).
async function findProblems() {
  return once("find", async () => {
    const { window, document } = await loadPage("find.html");
    await tick(120);
    const sel = document.getElementById("place");
    const places = [...sel.options].map((o) => o.value).filter(Boolean);
    const seen = [];
    const raw = [];
    let cards = 0;
    const scan = async (label) => {
      await showAllCards(document);
      cards += document.querySelectorAll("article.prog a[href]").length;
      raw.push(...problemsIn("find.html (" + label + ")", document, []));
    };
    await scan("anywhere");
    for (const p of [places[0], places[Math.floor(places.length / 2)], places[places.length - 1]]) {
      if (!p || seen.includes(p)) continue;
      seen.push(p);
      type(window, sel, p);
      await tick(150);
      await scan(p);
    }
    return { raw, cards, places: seen.length };
  });
}

// Scans the Calendar cards for each month chip (one page load).
async function calendarProblems() {
  return once("calendar", async () => {
    const { document } = await loadPage("calendar.html");
    await tick(120);
    const raw = [];
    let cards = 0;
    const chips = [...document.querySelectorAll("#months [data-m]")];
    for (const chip of chips) {
      chip.click();
      await tick(80);
      cards += document.querySelectorAll("#cClose li a[href], #cOpen li a[href]").length;
      raw.push(...problemsIn("calendar.html (" + chip.textContent.trim() + ")", document, []));
    }
    return { raw, cards, months: chips.length };
  });
}

// Scans the Languages cards for each place in the filter (one page load).
async function languagesProblems() {
  return once("languages", async () => {
    const { window, document } = await loadPage("languages.html");
    await tick(150);
    const sel = document.getElementById("lState");
    const places = sel ? [...sel.options].map((o) => o.value).filter(Boolean) : [];
    const raw = [...problemsIn("languages.html (all places)", document, [])];
    let cards = document.querySelectorAll("#lList a[href]").length;
    for (const p of places) {
      type(window, sel, p);
      await tick(40);
      cards += document.querySelectorAll("#lList a[href]").length;
      raw.push(...problemsIn("languages.html (" + p + ")", document, []));
    }
    return { raw, cards, places: places.length };
  });
}

function assertNoProblems(list, label) {
  const bad = list.filter((p) => !ALLOW.some((a) => a.page === p.page && a.text === p.text && a.href === p.href));
  assert.deepEqual(bad.map(format), [], label + " has link text that does not match its link:\n  " + bad.map(format).join("\n  "));
}

test("there are root pages to check", () => assert.ok(ROOT_PAGES.length >= 15, "found " + ROOT_PAGES.length));

for (const f of ROOT_PAGES) {
  test(f + ": every link whose text shows an address goes to that address", async () => {
    assertNoProblems(await rootProblems(f), f);
  });
}

test("Find cards: the link text matches the link after every place and Show more", async () => {
  const r = await findProblems();
  assert.ok(r.cards > 0, "no Find card links were scanned");
  assert.ok(r.places >= 2, "fewer than two places were tried");
  assertNoProblems(r.raw, "find.html cards");
});

test("Calendar cards: the link text matches the link in every month", async () => {
  const r = await calendarProblems();
  assert.equal(r.months, 12, "the Calendar has 12 month chips");
  assert.ok(r.cards > 0, "no Calendar card links were scanned");
  assertNoProblems(r.raw, "calendar.html cards");
});

test("Languages cards: the link text matches the link for all places and each place", async () => {
  const r = await languagesProblems();
  assert.ok(r.cards > 0, "no Languages card links were scanned");
  assertNoProblems(r.raw, "languages.html cards");
});

test("ALLOW entries each have a reason and still match a real problem", async () => {
  const all = [];
  for (const f of ROOT_PAGES) all.push(...(await rootProblems(f)));
  all.push(...(await findProblems()).raw, ...(await calendarProblems()).raw, ...(await languagesProblems()).raw);
  for (const a of ALLOW) {
    assert.ok(a.reason && a.reason.length > 10, "allow entry for " + a.page + " \"" + a.text + "\" needs a reason");
    const hit = all.some((p) => p.page.startsWith(a.page) && p.text === a.text && p.href === a.href);
    assert.ok(hit, "allow entry no longer matches a problem, remove it: " + a.page + " \"" + a.text + "\" " + a.href);
  }
});

// Seeded bad anchors go through the same scan a page uses, so the checker is shown to fail on each kind of mismatch.
function seed(html) {
  const dom = new JSDOM("<!doctype html><main>" + html + "</main>", { url: BASE });
  return dom.window.document;
}

const BAD = [
  ['<a href="https://dol.gov.example.com/x">dol.gov</a>', "dol.gov", "https://dol.gov.example.com/x"],
  ['<a href="https://ftc.gov/">reportfraud.ftc.gov</a>', "reportfraud.ftc.gov", "https://ftc.gov/"],
  ['<a href="states.html">dol.gov</a>', "dol.gov", "states.html"],
  ['<a href="mailto:help@dol.gov">dol.gov</a>', "dol.gov", "mailto:help@dol.gov"],
  ['<a href="mailto:help@osha.gov">Email help@dol.gov</a>', "Email help@dol.gov", "mailto:help@osha.gov"],
  ['<a href="tel:+18003216743">1-800-321-OSHA (6742)</a>', "1-800-321-OSHA (6742)", "tel:+18003216743"],
  ['<a href="tel:0032167">18003216742</a>', "18003216742", "tel:0032167"],
  ['<a href="tel:+18005550000">1-800-555-1234 or 1-800-555-9999</a>', "1-800-555-1234 or 1-800-555-9999", "tel:+18005550000"],
];
const GOOD = [
  ['<a href="https://reportfraud.ftc.gov/">ftc.gov</a>', "ftc.gov", "https://reportfraud.ftc.gov/"],
  ['<a href="https://www.dol.gov/agencies/whd">dol.gov (opens in a new tab)</a>', "dol.gov (opens in a new tab)", "https://www.dol.gov/agencies/whd"],
  ['<a href="https://dol.gov/x">https://dol.gov/x</a>', "https://dol.gov/x", "https://dol.gov/x"],
  ['<a href="mailto:Help@DOL.gov">Email help@dol.gov</a>', "Email help@dol.gov", "mailto:Help@DOL.gov"],
  ['<a href="tel:+18003216742">1-800-321-OSHA (6742)</a>', "1-800-321-OSHA (6742)", "tel:+18003216742"],
  ['<a href="tel:+18664879243">1-866-4-US-WAGE (1-866-487-9243)</a>', "1-866-4-US-WAGE (1-866-487-9243)", "tel:+18664879243"],
  ['<a href="tel:+18005551234">(800) 555-1234</a>', "(800) 555-1234", "tel:+18005551234"],
  ['<a href="tel:+18005551234">1-800-555-1234 or 1-800-555-9999</a>', "1-800-555-1234 or 1-800-555-9999", "tel:+18005551234"],
  ['<a href="tel:+18005551234">Call us</a>', "Call us", "tel:+18005551234"],
  ['<a href="find.html">Find programs</a>', "Find programs", "find.html"],
  ['<a href="rules.html">rules.html</a>', "rules.html", "rules.html"],
];

test("seeded bad anchors fail with the page, text and href", () => {
  const doc = seed(BAD.map((b) => b[0]).join("\n"));
  const got = problemsIn("seed.html", doc, []);
  assert.equal(got.length, BAD.length, "every seeded bad anchor is caught, got: " + got.map(format).join(" | "));
  for (const [, text, href] of BAD) {
    const p = got.find((x) => x.text === text && x.href === href);
    assert.ok(p, "seeded failure missing for " + text + " -> " + href);
    const line = format(p);
    assert.ok(line.includes("seed.html") && line.includes(text) && line.includes(href), "message names page, text and href: " + line);
  }
});

test("seeded good anchors pass, including subdomains, case and phone text that is not a number", () => {
  const doc = seed(GOOD.map((g) => g[0]).join("\n"));
  assert.deepEqual(problemsIn("seed.html", doc, []).map(format), []);
});

test("an allow entry hides exactly the named link and nothing else", () => {
  const doc = seed(BAD.map((b) => b[0]).join("\n"));
  const allow = [{ page: "seed.html", text: "dol.gov", href: "https://dol.gov.example.com/x", reason: "seeded test: an allow entry hides one named link" }];
  const got = problemsIn("seed.html", doc, allow);
  assert.equal(got.length, BAD.length - 1);
  assert.ok(!got.some((p) => p.href === "https://dol.gov.example.com/x"));
});
