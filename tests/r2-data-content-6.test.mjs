import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Ticket r2-data-content-6. On these cards the first sentence of pay_detail states the plain pay fact
// (a rate, "Unpaid.", or "Rate not posted."). The exception (unpaid first week or hours, tuition covered,
// scholarship not wages) comes in a later sentence. Card paid_type values are not changed here.

const ENTRIES = JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8"));
const byId = Object.fromEntries(ENTRIES.map((c) => [c.id, c]));

const CASES = {
  "seattle-ymca-wages-ten-week-internship": { first: /^\$20\.97 an hour\b/, exception: /first week is unpaid/ },
  "boston-artists-for-humanity-teen-jobs": { first: /^Rate not posted\./, exception: /36 Foundation Studio hours, which are unpaid/ },
  "richmond-sd38-youth-train-in-trades": { first: /^Unpaid\./, exception: /pays tuition/ },
  "ywca-elgin-youth-leadership-scholarship": { first: /^Unpaid\./, exception: /not wages/ },
  "boston-boys-girls-clubs-ready-to-work": { first: /^Rate not posted\./, exception: null },
  "sf-breakthrough-sf": { first: /^Rate not posted\./, exception: null },
};

function sentences(text) {
  return text.split(/(?<=\.)\s+/);
}

for (const [id, want] of Object.entries(CASES)) {
  test(`${id}: pay_detail opens with the plain pay fact`, () => {
    const card = byId[id];
    assert.ok(card, `missing card ${id}`);
    const s = sentences(card.pay_detail);
    assert.match(s[0], want.first);
  });

  if (want.exception) {
    test(`${id}: the exception is in a later sentence`, () => {
      const s = sentences(byId[id].pay_detail);
      assert.ok(s.length >= 2, "pay_detail needs a second sentence");
      assert.ok(s.slice(1).some((x) => want.exception.test(x)), "exception not found after the first sentence");
    });
  }
}

test("the six cards keep their paid_type values", () => {
  assert.equal(byId["seattle-ymca-wages-ten-week-internship"].paid_type, "paid");
  assert.equal(byId["boston-artists-for-humanity-teen-jobs"].paid_type, "paid");
  assert.equal(byId["richmond-sd38-youth-train-in-trades"].paid_type, "unpaid");
  assert.equal(byId["ywca-elgin-youth-leadership-scholarship"].paid_type, "unpaid");
  assert.equal(byId["boston-boys-girls-clubs-ready-to-work"].paid_type, "paid");
  assert.equal(byId["sf-breakthrough-sf"].paid_type, "paid");
});

test("no em dash or en dash in the six pay_detail texts", () => {
  for (const id of Object.keys(CASES)) {
    assert.doesNotMatch(byId[id].pay_detail, /[\u2013\u2014]/, id);
  }
});
