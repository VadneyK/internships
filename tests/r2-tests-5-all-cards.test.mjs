// Renders every program card on find.html under three fixed clocks and checks the text a teen reads against data/entries.json.
// Run with: node --test tests/r2-tests-5-all-cards.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(path.join(ROOT, "assets/js/lib.js"));
const entries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const byId = new Map(entries.map((e) => [e.id, e]));

const STATUS_LABEL = {
  "open-now": "Open now", "opens-soon": "Opens soon", "rolling": "Apply anytime", "year-round": "Year-round",
  "event": "Event", "closed-expect-reopen": "Closed, check back",
};
const UNCONFIRMED = "Dates unconfirmed";
const CLOCKS = [["2026-10-10", "2026-10-10T12:00:00"], ["2027-03-01", "2027-03-01T12:00:00"], ["2028-01-15", "2028-01-15T12:00:00"]];
const BAD_TEXT = [/undefined/, /\bnull\b/, /NaN/, /\[object/, /\{\{/, / {2,}/];
const norm = (s) => String(s).replace(/ /g, " ").trim();

function checkCard(card, now) {
  const fails = [];
  const id = card.id.replace(/^p-/, "");
  const e = byId.get(id);
  if (!e) return [id + ": id not in data/entries.json"];
  const bad = (m) => fails.push(id + ": " + m);

  const tags = [...card.querySelector(".row").querySelectorAll(".tag")].map((t) => norm(t.textContent));
  const st = L.effStatus(e, now);
  const want = STATUS_LABEL[st] || UNCONFIRMED;
  if (tags[0] !== want) bad("status tag " + JSON.stringify(tags[0]) + " but effStatus " + st + " wants " + JSON.stringify(want));
  const payWant = L.PAID[e.paid_type];
  if (payWant) { if (tags[1] !== payWant) bad("pay tag " + JSON.stringify(tags[1]) + " wants " + JSON.stringify(payWant)); }
  else if (tags.length > 3) bad("unexpected pay tag for paid_type " + e.paid_type);
  if (!tags.every(Boolean)) bad("empty tag");

  const h3 = norm(card.querySelector("h3").textContent);
  if (h3 !== norm(e.name)) bad("title " + JSON.stringify(h3) + " vs " + JSON.stringify(e.name));
  const org = norm(card.querySelector(".org").textContent);
  const orgWant = norm((e.org || "") + (e.city ? " · " + e.city : ""));
  if (org !== orgWant) bad("org line " + JSON.stringify(org) + " vs " + JSON.stringify(orgWant));

  const ageTag = norm(card.querySelectorAll(".row")[1].textContent);
  if (ageTag !== norm(L.ageText(e))) bad("age " + JSON.stringify(ageTag) + " vs " + JSON.stringify(L.ageText(e)));
  const payLine = card.querySelector(".pay");
  if (e.pay_detail ? !payLine || !norm(payLine.textContent).includes(norm(e.pay_detail)) : !!payLine) bad("pay detail line does not match pay_detail");

  const text = card.textContent;
  for (const re of BAD_TEXT) if (re.test(text)) bad("text matches " + re);

  const main = card.querySelector(".actions a.btn");
  const href = main && main.getAttribute("href");
  if (!main) bad("no official link");
  else {
    if (href !== e.url) bad("main link " + href + " vs url " + e.url);
    if (!/^https:/.test(href)) bad("main link not https: " + href);
  }

  const when = card.querySelector(".when");
  const whenText = when ? norm(when.textContent) : "";
  const fut = L.futureDeadline(e, now);
  if (fut && e.deadline_text && !whenText.includes(norm(e.deadline_text))) bad("future deadline text missing from dates line");
  if (!fut && /Apply by/i.test(text) && !/\d{4}|\d{1,2}\b/.test(whenText)) bad("Apply by with no date");
  if (!fut && (st === "closed-expect-reopen" || st === "closed" || want === UNCONFIRMED) && /Apply by/i.test(card.querySelector("h3").parentNode.querySelector(".row, .when").textContent)) bad("closed or unconfirmed card says Apply by");
  return fails;
}

for (const [label, iso] of CLOCKS) {
  test("every card is right under the clock " + label, { timeout: 120000 }, async () => {
    const now = new Date(iso).getTime();
    const { window, document } = await loadPage("find.html", { now });
    const out = document.getElementById("out");
    for (let i = 0; i < 100; i++) {
      const more = document.getElementById("more");
      if (!more) break;
      more.click();
    }
    const cards = [...out.querySelectorAll("article.prog")];
    assert.equal(cards.length, entries.length, "all cards on the page");
    const ids = new Set(cards.map((c) => c.id));
    assert.equal(ids.size, cards.length, "card ids are unique");
    const fails = [];
    for (const c of cards) fails.push(...checkCard(c, now));
    if (fails.length) console.log(label + ": " + fails.length + " failures\n" + fails.slice(0, 10).join("\n"));
    assert.equal(fails.length, 0, fails.slice(0, 10).join("\n"));
    window.close();
  });
}
