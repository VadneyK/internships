import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, tick } from "./dom-helper.mjs";

test("playbook: loads with no script errors and five person cards", async () => {
  const { document, errors } = await loadPage("playbook.html");
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll(".person").length, 5);
});

test("playbook: no button prints the whole page", async () => {
  const { document } = await loadPage("playbook.html");
  const printy = [...document.querySelectorAll("button, a")].filter((b) => /print/i.test(b.textContent));
  assert.equal(printy.length, 0);
});

test("playbook: Write to them fills the builder, and I sent it starts the one-week follow-up", async () => {
  const { window, document } = await loadPage("playbook.html");
  type(window, document.getElementById("pn0"), "Mrs. Lee");
  type(window, document.getElementById("ph0"), "my friend's mom");
  document.querySelector('[data-write="0"]').click();
  await tick();
  assert.equal(document.getElementById("fTo").value, "Mrs. Lee");
  assert.equal(document.getElementById("fHow").value, "My friend's mom.");
  type(window, document.getElementById("fMe"), "Maya");
  const letter = document.getElementById("letter").textContent;
  assert.match(letter, /Hi Mrs\. Lee/);
  assert.doesNotMatch(letter, /\[object/);
  assert.match(document.getElementById("sendMail").href, /^mailto:\?subject=/);
  document.getElementById("markSent").click();
  assert.match(document.getElementById("planSummary").textContent, /^1 of 5 sent/);
  assert.match(document.getElementById("pf0").textContent, /Follow up on/);
});

test("playbook: your details are remembered and Clear everything wipes them", async () => {
  const a = await loadPage("playbook.html");
  type(a.window, a.document.getElementById("fMe"), "Maya");
  const saved = a.window.localStorage.getItem("me");
  assert.match(saved, /Maya/);
  const b = await loadPage("playbook.html", { storage: { me: { n: "Sam", g: "9th", s: "Davis High" } } });
  assert.equal(b.document.getElementById("fMe").value, "Sam");
  b.window.confirm = () => true;
  b.document.getElementById("clearMap").click();
  assert.equal(b.document.getElementById("fMe").value, "");
});

test("playbook: after-the-yes callout links to the next steps, and the map links to the program list", async () => {
  const { document } = await loadPage("playbook.html");
  const after = document.getElementById("after");
  const callout = [...after.querySelectorAll(".callout")].find((c) => /Got a yes\? Do these next/.test(c.textContent));
  assert.ok(callout, "callout headed 'Got a yes? Do these next' is in the #after section");
  const hrefs = [...callout.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const target of ["permit.html", "ready.html", "resume.html", "interview.html"]) {
    assert.ok(hrefs.includes(target), `callout links to ${target}`);
  }
  const map = document.getElementById("map");
  const mapHrefs = [...map.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(mapHrefs.includes("find.html"), "the people map links to find.html");
});
