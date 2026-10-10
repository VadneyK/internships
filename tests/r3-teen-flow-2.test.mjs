import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

const $ = (p, id) => p.document.getElementById(id);

test("permit: My state is not listed is the last state option", async () => {
  const p = await loadPage("permit.html"); await tick();
  const opts = Array.from($(p, "pState").options);
  const last = opts[opts.length - 1];
  assert.equal(last.value, "other");
  assert.equal(last.textContent, "My state is not listed");
});

test("permit: choosing not listed shows the not-read answer with a link, no pay, no packet", async () => {
  const p = await loadPage("permit.html"); await tick();
  type(p.window, $(p, "pState"), "other"); await tick();
  const out = $(p, "pOut");
  assert.match(out.textContent, /have not read your state/);
  assert.doesNotMatch(out.textContent, /Pay|undefined|NaN/);
  const a = out.querySelector("a[href*='dol.gov/agencies/whd/contact/state-labor-offices']");
  assert.ok(a, "the labor offices address is a link");
  assert.match(a.getAttribute("rel"), /noopener/);
  assert.equal($(p, "packetSec").hidden, true);
  assert.deepEqual(p.errors, []);
  type(p.window, $(p, "pAge"), "15"); type(p.window, $(p, "pKind"), "job"); await tick();
  assert.match(out.textContent, /have not read your state/);
  assert.equal($(p, "packetSec").hidden, true);
  assert.deepEqual(p.errors, []);
});

test("permit: the empty message names what is still missing", async () => {
  const p = await loadPage("permit.html"); await tick();
  const out = $(p, "pOut");
  type(p.window, $(p, "pState"), "ca"); await tick();
  assert.match(out.textContent, /Now pick your age and the kind of work\./);
  type(p.window, $(p, "pAge"), "15"); await tick();
  assert.match(out.textContent, /Now pick the kind of work\./);
  type(p.window, $(p, "pAge"), ""); type(p.window, $(p, "pKind"), "job"); await tick();
  assert.match(out.textContent, /Now pick your age\./);
  type(p.window, $(p, "pState"), ""); await tick();
  assert.match(out.textContent, /Now pick your state and your age\./);
});

test("permit: ?state=other selects the option and shows the card with no errors", async () => {
  const p = await loadPage("permit.html", { search: "?state=other" }); await tick();
  assert.equal($(p, "pState").value, "other");
  assert.match($(p, "pOut").textContent, /have not read your state/);
  assert.ok($(p, "pOut").querySelector("a[href*='dol.gov']"));
  assert.equal($(p, "packetSec").hidden, true);
  assert.deepEqual(p.errors, []);
});
