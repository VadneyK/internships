// Source provenance for every card in data/programs/*.json.
// A card should show what was read, so:
//   1. verified is "fetched" or "snippet-only";
//   2. a card with sources (every fetched card has some) must link a host that is among its sources_fetched hosts,
//      either its url host or its apply_url host. A reviewed ALLOW entry with a reason may cover a card that cannot
//      meet this rule. A stale ALLOW entry (unknown id, empty reason, or a card that no longer mismatches) fails;
//   3. a snippet-only card may not claim a confirmed deadline (confirmed-2026-27) or an open status (open-now, opens-soon);
//   4. every sources_fetched entry is a string https URL, and no entry repeats.
// Failures name the card id. No network and no data edits. Fixtures check each rule on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PROGRAMS_DIR = new URL("../data/programs/", import.meta.url);
const VERIFIED_VALUES = ["fetched", "snippet-only"];
const NO_CONFIRMED_STATUS = ["open-now", "opens-soon"];

// Reviewed exceptions to rule 2: card id -> reason. Keep this list short and review it when a card changes.
const ALLOW = {};

function hostOf(value) {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sourcesOf(card) {
  return Array.isArray(card.sources_fetched) ? card.sources_fetched : [];
}

// Rule 2 applies to fetched cards and to any card that lists sources.
function mustMatchHost(card) {
  return card.verified === "fetched" || sourcesOf(card).length > 0;
}

function hostMismatch(card) {
  const sourceHosts = new Set(sourcesOf(card).map(hostOf).filter(Boolean));
  const cardHosts = [card.url, card.apply_url].map(hostOf).filter(Boolean);
  return cardHosts.length > 0 && !cardHosts.some((h) => sourceHosts.has(h));
}

// Returns problem strings. Each one starts with the card id.
function checkCards(cards, allow = ALLOW) {
  const problems = [];
  const byId = new Map();

  for (const card of cards) {
    const id = card.id ?? "(no id)";
    byId.set(id, card);

    // Rule 1
    if (!VERIFIED_VALUES.includes(card.verified)) {
      problems.push(`${id}: verified must be "fetched" or "snippet-only", got ${JSON.stringify(card.verified)}`);
    }

    // Rule 4
    const sources = sourcesOf(card);
    const seen = new Set();
    for (const entry of sources) {
      let isHttps = false;
      try {
        isHttps = typeof entry === "string" && new URL(entry).protocol === "https:";
      } catch {
        isHttps = false;
      }
      if (!isHttps) problems.push(`${id}: sources_fetched entry is not an https URL: ${JSON.stringify(entry)}`);
      if (seen.has(entry)) problems.push(`${id}: sources_fetched repeats ${JSON.stringify(entry)}`);
      seen.add(entry);
    }

    // Rule 2
    if (mustMatchHost(card) && hostMismatch(card)) {
      const reason = allow[id];
      if (typeof reason !== "string" || reason.trim() === "") {
        problems.push(`${id}: url or apply_url host is not among the sources_fetched hosts (add a reviewed ALLOW reason or fix the sources)`);
      }
    }

    // Rule 3
    if (card.verified === "snippet-only") {
      if (card.deadline_confidence === "confirmed-2026-27") {
        problems.push(`${id}: snippet-only card claims a confirmed deadline (deadline_confidence confirmed-2026-27)`);
      }
      if (NO_CONFIRMED_STATUS.includes(card.status)) {
        problems.push(`${id}: snippet-only card claims status ${card.status}`);
      }
    }
  }

  // Rule 5: every ALLOW entry must name a card that exists, has a reason, and still mismatches.
  for (const [id, reason] of Object.entries(allow)) {
    const card = byId.get(id);
    if (!card) {
      problems.push(`${id}: stale ALLOW entry, no such card`);
    } else if (typeof reason !== "string" || reason.trim() === "") {
      problems.push(`${id}: ALLOW entry has no reason`);
    } else if (!(mustMatchHost(card) && hostMismatch(card))) {
      problems.push(`${id}: stale ALLOW entry, the card's url host now matches its sources`);
    }
  }

  return problems;
}

function loadCards() {
  return fs
    .readdirSync(PROGRAMS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(new URL(f, PROGRAMS_DIR), "utf8")));
}

const base = () => ({
  id: "fixture-card",
  verified: "fetched",
  url: "https://example.org/teens",
  apply_url: null,
  sources_fetched: ["https://example.org/teens/apply"],
  deadline_confidence: "last-year-pattern",
  status: "closed-expect-reopen",
});

test("every program card passes the source provenance rules", () => {
  const problems = checkCards(loadCards(), ALLOW);
  assert.equal(problems.length, 0, problems.join("\n"));
});

test("the ALLOW map names only cards that exist and still mismatch", () => {
  const cards = loadCards();
  const ids = new Set(cards.map((c) => c.id));
  for (const id of Object.keys(ALLOW)) assert.ok(ids.has(id), `${id} is in ALLOW but has no card`);
});

test("a good fixture has no problems", () => {
  assert.deepEqual(checkCards([base()], {}), []);
});

test("rule 1 catches an unknown verified value", () => {
  const card = { ...base(), id: "bad-verified", verified: "verified-by-hand" };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("bad-verified:") && p.includes("verified")), problems.join("\n"));
});

test("rule 2 catches a fetched card whose url host is not among its sources", () => {
  const card = { ...base(), id: "bad-host", url: "https://other.example.net/" };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("bad-host:")), problems.join("\n"));
});

test("rule 2 passes when apply_url host matches a source", () => {
  const card = { ...base(), id: "apply-host", url: "https://other.example.net/", apply_url: "https://example.org/apply" };
  assert.deepEqual(checkCards([card], {}), []);
});

test("rule 2 passes when the url host matches a source after www is dropped", () => {
  const card = { ...base(), id: "www-host", url: "https://www.example.org/", sources_fetched: ["https://example.org/a"] };
  assert.deepEqual(checkCards([card], {}), []);
});

test("rule 2 accepts a mismatched card with a reviewed ALLOW reason", () => {
  const card = { ...base(), id: "allowed-host", url: "https://other.example.net/" };
  assert.deepEqual(checkCards([card], { "allowed-host": "Reviewed: the page on example.org is the one that was read." }), []);
});

test("rule 2 catches a snippet-only card that lists sources but mismatches them", () => {
  const card = { ...base(), id: "snip-mismatch", verified: "snippet-only", url: "https://other.example.net/" };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("snip-mismatch:")), problems.join("\n"));
});

test("rule 3 catches a snippet-only card with a confirmed deadline", () => {
  const card = { ...base(), id: "snip-confirmed", verified: "snippet-only", deadline_confidence: "confirmed-2026-27" };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("snip-confirmed:") && p.includes("confirmed")), problems.join("\n"));
});

test("rule 3 catches a snippet-only card with open-now or opens-soon", () => {
  for (const status of ["open-now", "opens-soon"]) {
    const card = { ...base(), id: `snip-${status}`, verified: "snippet-only", status };
    const problems = checkCards([card], {});
    assert.ok(problems.some((p) => p.startsWith(`snip-${status}:`)), problems.join("\n"));
  }
});

test("rule 3 allows a fetched card to show open-now", () => {
  const card = { ...base(), id: "fetched-open", status: "open-now", deadline_confidence: "confirmed-2026-27" };
  assert.deepEqual(checkCards([card], {}), []);
});

test("rule 4 catches an http sources_fetched entry", () => {
  const card = { ...base(), id: "http-source", sources_fetched: ["http://example.org/teens/apply"] };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("http-source:") && p.includes("https")), problems.join("\n"));
});

test("rule 4 catches a non-URL sources_fetched entry", () => {
  const card = { ...base(), id: "text-source", sources_fetched: ["see the city page"] };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("text-source:")), problems.join("\n"));
});

test("rule 4 catches a repeated sources_fetched entry", () => {
  const url = "https://example.org/teens/apply";
  const card = { ...base(), id: "dup-source", sources_fetched: [url, url] };
  const problems = checkCards([card], {});
  assert.ok(problems.some((p) => p.startsWith("dup-source:") && p.includes("repeats")), problems.join("\n"));
});

test("rule 5 catches a stale ALLOW entry for a card that no longer mismatches", () => {
  const card = { ...base(), id: "stale-allow" };
  const problems = checkCards([card], { "stale-allow": "No longer needed." });
  assert.ok(problems.some((p) => p.startsWith("stale-allow:") && p.includes("stale")), problems.join("\n"));
});

test("rule 5 catches an ALLOW entry for an id that is not a card", () => {
  const problems = checkCards([base()], { "no-such-card": "Reason." });
  assert.ok(problems.some((p) => p.startsWith("no-such-card:") && p.includes("stale")), problems.join("\n"));
});

test("rule 5 catches an ALLOW entry with an empty reason", () => {
  const card = { ...base(), id: "empty-reason", url: "https://other.example.net/" };
  const problems = checkCards([card], { "empty-reason": "  " });
  assert.ok(problems.some((p) => p.startsWith("empty-reason:")), problems.join("\n"));
});
