import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const get = (id) => JSON.parse(readFileSync(new URL(`../data/programs/${id}.json`, import.meta.url), "utf8"));

test("Sacramento Zoo Teens is open now with the live form", () => {
  const e = get("sac-zoo-zoo-teens");
  assert.equal(e.status, "open-now");
  assert.match(e.apply_url, /betterimpact/);
});

test("BBG GAP has a confirmed Dec 4 cutoff", () => {
  const e = get("nyc-bbg-garden-apprentice-program");
  assert.equal(e.deadline_iso, "2026-12-04");
  assert.equal(e.deadline_confidence, "confirmed-2026-27");
});

test("Phipps, Illinois YMCA, IMSA and NIST stay without a firm date", () => {
  for (const id of ["pittsburgh-phipps-summer-camp-teen-volunteers", "illinois-ymca-youth-and-government", "imsa-ai-credential-online", "nist-ship-gaithersburg"]) {
    const e = get(id);
    assert.equal(e.deadline_iso, null, id);
    // 2026-10-10 fact check: the IMSA cohort page lists only the September 2026 cohort, and the NIST page says applications are not open yet. Both are now closed-expect-reopen. Neither page gives a firm date, so deadline_iso must stay null.
    assert.ok(["unconfirmed", "closed-expect-reopen"].includes(e.status), id + " status is " + e.status);
  }
  assert.match(get("illinois-ymca-youth-and-government").deadline_text, /Closed/);
  assert.match(get("imsa-ai-credential-online").deadline_text, /already started/);
});

test("built entries match the program files", () => {
  const all = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
  const list = Array.isArray(all) ? all : all.entries || all.programs;
  const z = list.find((x) => x.id === "sac-zoo-zoo-teens");
  assert.equal(z.status, "open-now");
});
