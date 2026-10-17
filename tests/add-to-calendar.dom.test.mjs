// Add to calendar (issue #10) on the real pages: find.html cards and calendar.html cards show the .ics button and the
// Google Calendar link only where lib.calEvent says so, and the button saves a .ics file with the reminders.
// Run with: node --test tests/add-to-calendar.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";
const require = createRequire(import.meta.url);
globalThis.self = globalThis;
const L = require("../assets/js/lib.js");
const BY = new Map(JSON.parse(fs.readFileSync(new URL("../data/entries.json", import.meta.url), "utf8")).map((e) => [e.id, e]));

const NOW = new Date(2026, 9, 16, 10, 0, 0).getTime();

function catchDownloads(window) {
  const files = [];
  window.URL.createObjectURL = (blob) => { files.push({ blob }); return "blob:test-" + files.length; };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) files[files.length - 1].name = this.download; };
  return files;
}
const readBlob = (window, blob) => new Promise((resolve, reject) => {
  const fr = new window.FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(fr.error);
  fr.readAsText(blob);
});

// Every card on screen: an id, and its calendar controls.
function checkCards(cards, idOf, where) {
  let shown = 0;
  for (const card of cards) {
    const e = BY.get(idOf(card));
    assert.ok(e, where + ": card maps to a program");
    const btn = card.querySelectorAll("button[data-cal]");
    const g = [...card.querySelectorAll("a")].filter((a) => a.href.startsWith("https://calendar.google.com/"));
    if (L.calEvent(e, NOW)) {
      shown++;
      assert.equal(btn.length, 1, where + " " + e.id + ": one .ics button");
      assert.equal(g.length, 1, where + " " + e.id + ": one Google Calendar link");
      assert.equal(btn[0].getAttribute("data-cal"), e.id);
      assert.equal(g[0].getAttribute("href"), L.gcalHref(L.calEvent(e, NOW)));
    } else {
      assert.equal(btn.length + g.length, 0, where + " " + e.id + " (" + e.status + ", " + e.deadline_confidence + "): no calendar controls");
    }
  }
  return shown;
}

async function clickAndRead(window, document, btn) {
  const files = catchDownloads(window);
  btn.click();
  await tick();
  assert.equal(files.length, 1, "one file saved");
  assert.equal(files[0].blob.type, "text/calendar");
  return { name: files[0].name, text: await readBlob(window, files[0].blob), toast: document.getElementById("toast").textContent };
}

test("find.html: calendar controls follow calEvent on every card, and the button saves the .ics with reminders", async () => {
  const { window, document, errors } = await loadPage("find.html", { now: NOW });
  await waitFor(() => document.querySelectorAll("article.prog").length > 0);
  // Show more until every card is drawn, so every card is checked.
  for (let i = 0; i < 80; i++) {
    const more = document.getElementById("more");
    if (!more || more.hidden || more.closest("[hidden]")) break;
    more.click(); await tick(10);
  }
  const cards = [...document.querySelectorAll("article.prog")];
  const shown = checkCards(cards, (c) => c.id.replace(/^p-/, ""), "find");
  assert.ok(shown > 10, "some cards show the controls (" + shown + ")");

  const btn = document.querySelector("article.prog button[data-cal]");
  const id = btn.getAttribute("data-cal");
  const e = BY.get(id);
  const got = await clickAndRead(window, document, btn);
  assert.equal(got.name, id + "-deadline.ics");
  assert.match(got.text, /^BEGIN:VCALENDAR\r\n/);
  assert.ok(got.text.includes("DTSTART;VALUE=DATE:" + e.deadline_iso.replace(/-/g, "")));
  assert.ok(got.text.includes("\r\nTRIGGER:-P6DT15H\r\n"), "a reminder a week before");
  assert.ok(got.text.includes("\r\nUID:deadline-" + id + "@vadneyk.github.io\r\n"));
  assert.match(got.toast, /Calendar file saved\..*Google Calendar/);
  assert.deepEqual(errors, []);
});

test("calendar.html: cards show the controls only for a real dated deadline, and the button saves the .ics", async () => {
  let shown = 0, clicked = false;
  const { window, document, errors } = await loadPage("calendar.html", { search: "?m=1", now: NOW });
  await waitFor(() => /program/.test(document.getElementById("cCount").textContent));
  for (let m = 1; m <= 12; m++) {
    document.querySelector('#months .chip[data-m="' + m + '"]').click();
    const cards = [...document.querySelectorAll("#cClose li, #cOpen li")];
    // The Details link is find.html#p-<id>.
    shown += checkCards(cards, (c) => c.querySelector('a[href^="find.html#p-"]').getAttribute("href").slice(12), "calendar m=" + m);
    const btn = document.querySelector("#cClose button[data-cal], #cOpen button[data-cal]");
    if (btn && !clicked) {
      clicked = true;
      const id = btn.getAttribute("data-cal");
      const got = await clickAndRead(window, document, btn);
      assert.equal(got.name, id + "-deadline.ics");
      assert.ok(got.text.includes("DTSTART;VALUE=DATE:" + BY.get(id).deadline_iso.replace(/-/g, "")));
      assert.ok(got.text.includes("\r\nTRIGGER:-PT15H\r\n"), "a reminder the day before");
      assert.match(got.toast, /Calendar file saved/);
    }
  }
  assert.deepEqual(errors, []);
  assert.ok(clicked, "some calendar card has the button");
  assert.ok(shown > 10, "calendar cards show the controls (" + shown + " across the months)");
});
