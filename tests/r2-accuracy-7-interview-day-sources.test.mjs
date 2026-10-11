import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPage, tick } from "./dom-helper.mjs";
const D = JSON.parse(fs.readFileSync(new URL("../data/interview.json", import.meta.url), "utf8"));

test("interview.json: daySource has https urls and no day tip leans on unnamed 'the sources'", () => {
  assert.ok(Array.isArray(D.daySource) && D.daySource.length >= 1);
  D.daySource.forEach((s) => { assert.ok(s.title); assert.match(s.url, /^https:\/\//); });
  D.day.forEach((t) => assert.ok(!/the sources/i.test(t), t));
  assert.ok(D.day.some((t) => /^Dress/.test(t) && /religious or uniform/.test(t)), "dress tip carries the gaps caveat");
  assert.ok(D.day.some((t) => /Our suggestion, not from a source\./.test(t)));
  assert.ok(!D.day.some((t) => /polo|paperwork/i.test(t)));
  assert.ok(![...D.day, ...D.daySource.map((s) => s.title)].some((t) => /[\u2013\u2014]/.test(t)));
});

test("interview page renders the day-of source links", async () => {
  const p = await loadPage("interview.html"); await tick(150);
  assert.deepEqual(p.errors, []);
  const links = [...p.document.querySelectorAll("#daySrc a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(links, D.daySource.map((s) => s.url));
  assert.equal(p.document.querySelectorAll("#dayList li").length, D.day.length);
});
