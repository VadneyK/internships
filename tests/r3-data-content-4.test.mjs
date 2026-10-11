import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ticket r3-data-content-4: cards whose pay_detail says pay is not stated are "not-stated", not "mixed".
const entries = JSON.parse(readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = new Map(entries.map((e) => [e.id, e]));

const FIXED = {
  "boston-museum-of-science-youth-internships": "Pay is not stated on the museum pages.",
  "nyc-brooklyn-cbh-summer-scholars-internship": "Pay is not stated on the page. Ask CBH Education whether there is a stipend.",
  "ousd-linked-learning-work-based-learning": "Rate not posted (checked 2026-10-07)",
};

test("r3-data-content-4: the three not-stated cards are not-stated and keep their pay_detail", () => {
  for (const [id, text] of Object.entries(FIXED)) {
    const e = byId.get(id);
    assert.ok(e, id + " missing");
    assert.equal(e.paid_type, "not-stated", id + " must be not-stated when pay is not stated");
    assert.equal(e.pay_detail, text, id + " pay_detail changed");
  }
});
