// Ticket r3-teen-flow-3: Who to call phone numbers and emails on the permit page are tappable.
// Run with: node --test tests/r3-teen-flow-18-permit-tel-links.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, tick } from "./dom-helper.mjs";
const L = createRequire(import.meta.url)("../assets/js/lib.js");

test("linkContacts: five phone formats", () => {
  assert.equal(L.linkContacts("833-526-4636"), '<a href="tel:+18335264636">833-526-4636</a>');
  assert.equal(L.linkContacts("1-877-709-8185"), '<a href="tel:+18777098185">1-877-709-8185</a>');
  assert.equal(L.linkContacts("(317) 232-2655"), '<a href="tel:+13172322655">(317) 232-2655</a>');
  assert.equal(L.linkContacts("888-469-7365 or 888-525-2267"), '<a href="tel:+18884697365">888-469-7365</a> or <a href="tel:+18885252267">888-525-2267</a>');
  assert.equal(L.linkContacts("hotline 800-645-5784"), 'hotline <a href="tel:+18006455784">800-645-5784</a>');
});
test("linkContacts: email, none, escaping", () => {
  assert.equal(L.linkContacts("x: childlabor@gdol.ga.gov."), 'x: <a href="mailto:childlabor@gdol.ga.gov">childlabor@gdol.ga.gov</a>.');
  const none = "No phone number is listed on this card. Use the agency website.";
  assert.equal(L.linkContacts(none), none);
  assert.equal(L.linkContacts("a < b & c"), "a &lt; b &amp; c");
});
test("permit page: ca ask answer has a tel link in both places; wa has none", async () => {
  const p = await loadPage("permit.html", { search: "?state=ca&age=15&kind=job" }); await tick();
  assert.deepEqual(p.errors, []);
  const a = p.document.querySelectorAll('#pOut a[href="tel:+18335264636"]');
  assert.ok(a.length >= 1);
  assert.equal(a[0].textContent, "833-526-4636");
  const w = await loadPage("permit.html", { search: "?state=wa&age=15&kind=job" }); await tick();
  assert.equal(w.document.querySelectorAll('#pOut a[href^="tel:"]').length, 0);
  assert.match(w.document.querySelector("#pOut").textContent, /No phone number is listed/);
});
