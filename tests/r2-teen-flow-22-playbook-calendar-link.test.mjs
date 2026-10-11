// Ticket r2-teen-flow-22: the Playbook Send it step points to the Calendar.
// Run with: node --test tests/r2-teen-flow-22-playbook-calendar-link.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage } from "./dom-helper.mjs";

test("r2-teen-flow-22: #send in main has a link to calendar.html", async () => {
  const { document, errors } = await loadPage("playbook.html");
  const send = document.querySelector("main #send");
  assert.ok(send, "#send is inside main");
  const link = send.querySelector('a[href="calendar.html"]');
  assert.ok(link, "a[href=calendar.html] exists inside #send in main");
  assert.deepEqual(errors, []);
});

test("r2-teen-flow-22: the Send it text has no em or en dash", async () => {
  const { document } = await loadPage("playbook.html");
  const text = document.querySelector("main #send").textContent;
  assert.doesNotMatch(text, /[\u2013\u2014]/, "no en dash or em dash in #send");
});

test("r2-teen-flow-22: the playbook page still has one h1", async () => {
  const { document } = await loadPage("playbook.html");
  assert.equal(document.querySelectorAll("h1").length, 1);
});
