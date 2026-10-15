// 2026-10-15: playbook.js was the least covered page script (88.3 percent of lines in CI). These tests drive the paths no test reached.
// Run with: node --test tests/playbook-coverage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type, waitFor } from "./dom-helper.mjs";

const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const named = (n) => Array.from({ length: n }, (_, i) => ({ n: "Person " + (i + 1), w: "job " + (i + 1) }));
const readBlob = (window, blob) => new Promise((res) => { const fr = new window.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(blob); });

// Records what the page saves: every a.click() on a download link, and the blob behind it.
function watchDownloads(window) {
  const saved = [];
  window.URL.createObjectURL = (b) => { saved.push({ blob: b }); return "blob:test"; };
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) saved[saved.length - 1].name = this.download; };
  return saved;
}
const toastText = (document) => document.getElementById("toast").textContent;

test("playbook: a follow-up date that has passed says it is time, marks the card and leads the summary", async () => {
  const { document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee", s: "sent", d: daysAgo(10) }] } });
  assert.match(document.getElementById("pf0").textContent, /Time to follow up\./);
  assert.doesNotMatch(document.getElementById("pf0").textContent, /Follow up on/);
  assert.ok(document.querySelector(".person").classList.contains("is-due"));
  assert.equal(document.getElementById("planNext").textContent, "Follow up with Mrs. Lee now.");
});

test("playbook: Add to my calendar saves a .ics named for the person and says so", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee", s: "sent", d: daysAgo(1) }] } });
  const saved = watchDownloads(window);
  document.querySelector("[data-ics='0']").click();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "follow-up-mrs-lee.ics");
  const text = await readBlob(window, saved[0].blob);
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /SUMMARY:Follow up with Mrs\. Lee/);
  assert.match(text, new RegExp("DTSTART;VALUE=DATE:" + iso(new Date(Date.now() + 6 * 864e5)).replace(/-/g, "")));
  assert.equal(toastText(document), "Calendar file saved. Open it to add the reminder.");
});

test("playbook: the status menu drives each hint, and choosing Not sent yet drops the send date", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Sam" }] } });
  const sel = document.getElementById("ps0");
  type(window, sel, "sent");
  assert.equal(JSON.parse(window.localStorage.getItem("people"))[0].d, iso(new Date()));
  assert.match(document.getElementById("pf0").textContent, /Sent .*Follow up on/);
  type(window, sel, "replied");
  assert.match(document.getElementById("pf0").textContent, /Say thank you within 1 to 2 days/);
  type(window, sel, "meeting");
  assert.match(document.getElementById("pf0").textContent, /Pick two questions/);
  type(window, sel, "thanked");
  assert.match(document.getElementById("pf0").textContent, /Check in again in a few months/);
  type(window, sel, "");
  assert.equal(document.getElementById("pf0").querySelector("p"), null);
  const row = JSON.parse(window.localStorage.getItem("people"))[0];
  assert.equal(row.s, "");
  assert.equal(row.d, "");
  assert.equal(document.getElementById("planSummary").textContent, "0 of 5 sent");
});

test("playbook: a card with no name asks for one, and the Write button is off until there is a name", async () => {
  const { window, document } = await loadPage("playbook.html");
  assert.match(document.getElementById("pf0").textContent, /Add a name to write to them\./);
  type(window, document.getElementById("pn0"), "Coach Diaz");
  const write = document.querySelector("[data-write='0']");
  assert.equal(write.disabled, false);
  assert.equal(document.querySelector("#fToSel option[value='0']").textContent, "Coach Diaz");
  type(window, document.getElementById("pw0"), "baseball coach");
  assert.equal(document.querySelector("#fToSel option[value='0']").textContent, "Coach Diaz (baseball coach)");
});

test("playbook: Add another person grows the map to 8, focuses the new name, then hides itself", async () => {
  const { window, document } = await loadPage("playbook.html");
  const add = document.getElementById("addPerson");
  add.click();
  assert.equal(document.querySelectorAll(".person").length, 6);
  assert.equal(document.activeElement.id, "pn5");
  add.click(); add.click();
  assert.equal(document.querySelectorAll(".person").length, 8);
  assert.equal(document.activeElement.id, "pn7");
  assert.equal(add.hidden, true);
  assert.equal(JSON.parse(window.localStorage.getItem("people")).length, 8);
  add.click(); // a hidden button still cannot add a ninth
  assert.equal(document.querySelectorAll(".person").length, 8);
  assert.equal(JSON.parse(window.localStorage.getItem("people")).length, 8);
});

test("playbook: Clear everything asks first, and keeps your people when you say no", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Sam", w: "nurse" }], me: { n: "Maya", g: "10th", s: "Davis High" } } });
  let asked = "";
  window.confirm = (m) => { asked = m; return false; };
  document.getElementById("clearMap").click();
  assert.match(asked, /Clear all your people and your details/);
  assert.equal(document.getElementById("pn0").value, "Sam");
  assert.equal(document.getElementById("fMe").value, "Maya");
  window.confirm = () => true;
  document.getElementById("clearMap").click();
  assert.equal(document.getElementById("pn0").value, "");
  assert.equal(document.getElementById("fSchool").value, "");
  assert.equal(window.localStorage.getItem("me") && JSON.parse(window.localStorage.getItem("me")).n, "");
  assert.equal(toastText(document), "Cleared");
  assert.equal(document.activeElement.id, "clearMap");
});

test("playbook: Clear everything on an empty page does not ask", async () => {
  const { window, document } = await loadPage("playbook.html");
  let asked = 0;
  window.confirm = () => { asked++; return false; };
  document.getElementById("clearMap").click();
  assert.equal(asked, 0);
  assert.equal(toastText(document), "Cleared");
});

test("playbook: picking a name fills the builder without moving focus; picking the blank choice redraws with blanks", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee", h: "she is my coach!" }, { n: "Sam", h: "" }] } });
  const pick = document.getElementById("fToSel");
  document.getElementById("fCurious").focus();
  type(window, pick, "0");
  assert.equal(document.getElementById("fTo").value, "Mrs. Lee");
  assert.equal(document.getElementById("fHow").value, "She is my coach!");
  assert.equal(document.activeElement.id, "fCurious");
  type(window, pick, "1");
  assert.equal(document.getElementById("fTo").value, "Sam");
  assert.equal(document.getElementById("fHow").value, "She is my coach!", "no how-sentence on Sam leaves the field as it was");
  type(window, pick, "");
  assert.match(document.getElementById("letter").textContent, /Hi Sam,/);
  assert.match(document.getElementById("blankNote").textContent, /Fill in before you send/);
});

test("playbook: a chosen person whose name is later erased leaves the picker on the blank choice", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee" }] } });
  type(window, document.getElementById("fToSel"), "0");
  assert.equal(document.getElementById("fToSel").value, "0");
  type(window, document.getElementById("pn0"), "");
  assert.equal(document.getElementById("fToSel").value, "");
});

test("playbook: Write to them moves focus to the message, then to the first empty field", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee", h: "my coach" }] } });
  document.querySelector("[data-write='0']").click();
  const msg = document.getElementById("message");
  assert.equal(msg.getAttribute("tabindex"), "-1");
  assert.equal(document.activeElement, msg);
  assert.ok(await waitFor(() => document.activeElement.id === "fMe"), "focus goes to your first name, the first empty field");
  type(window, document.getElementById("fMe"), "Maya");
  type(window, document.getElementById("fGrade"), "10th");
  type(window, document.getElementById("fSchool"), "Davis High");
  type(window, document.getElementById("fCurious"), "dentistry");
  document.querySelector("[data-write='0']").click();
  assert.ok(await waitFor(() => document.activeElement.id === "fCurious"), "with every field full, focus lands on the last one");
});

test("playbook: Write to them scrolls smoothly, and without motion when the teen asks for less", async () => {
  const calm = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee" }] } });
  const seen = [];
  calm.window.HTMLElement.prototype.scrollIntoView = function (o) { seen.push(o.behavior); };
  calm.document.querySelector("[data-write='0']").click();
  const reduced = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee" }] }, setup: (w) => { w.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} }); } });
  reduced.window.HTMLElement.prototype.scrollIntoView = function (o) { seen.push(o.behavior); };
  reduced.document.querySelector("[data-write='0']").click();
  assert.deepEqual(seen, ["smooth", "auto"]);
});

test("playbook: the how-you-know-them chips fill the box and focus it; a click between chips does nothing", async () => {
  const { window, document } = await loadPage("playbook.html");
  const chips = document.querySelectorAll("#howChips [data-how]");
  assert.equal(chips.length, 5);
  chips[1].click();
  assert.equal(document.getElementById("fHow").value, "We go to the same church.");
  assert.equal(document.activeElement.id, "fHow");
  assert.match(document.getElementById("letter").textContent, /We go to the same church\./);
  type(window, document.getElementById("fHow"), "My own words");
  document.getElementById("howChips").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.equal(document.getElementById("fHow").value, "My own words");
});

test("playbook: Mark as sent only shows for a chosen person who has no status yet", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Mrs. Lee" }, { n: "Sam", s: "replied" }] } });
  const mark = document.getElementById("markSent");
  assert.equal(mark.hidden, true, "nobody chosen");
  type(window, document.getElementById("fToSel"), "1");
  assert.equal(mark.hidden, true, "Sam already has a status");
  type(window, document.getElementById("fToSel"), "0");
  assert.equal(mark.hidden, false);
  mark.click();
  assert.equal(mark.hidden, true);
  assert.equal(document.getElementById("ps0").value, "sent");
  assert.equal(toastText(document), "Marked as sent. Follow-up reminder set for one week.");
});

test("playbook: a name typed in the builder can be added to the map as sent, in the first empty card", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Sam" }] } });
  const add = document.getElementById("addMark");
  assert.equal(add.hidden, true, "no name typed yet");
  type(window, document.getElementById("fTo"), "A");
  assert.equal(add.hidden, true, "one letter is not a name");
  type(window, document.getElementById("fTo"), "Dr. Park");
  type(window, document.getElementById("fHow"), "She is my aunt's dentist.");
  assert.equal(add.hidden, false);
  add.click();
  const rows = JSON.parse(window.localStorage.getItem("people"));
  assert.equal(rows[1].n, "Dr. Park");
  assert.equal(rows[1].h, "She is my aunt's dentist.");
  assert.equal(rows[1].s, "sent");
  assert.equal(document.getElementById("pn1").value, "Dr. Park");
  assert.equal(document.getElementById("fToSel").value, "1");
  assert.equal(add.hidden, true, "now a person on the map is chosen");
  assert.equal(toastText(document), "Added to your map and marked as sent. Follow-up reminder set for one week.");
});

test("playbook: with every card named, Add to my map opens a new card; with no how-sentence it saves none", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: named(5) } });
  type(window, document.getElementById("fTo"), "Newcomer");
  assert.equal(document.getElementById("addMark").hidden, false);
  document.getElementById("addMark").click();
  const rows = JSON.parse(window.localStorage.getItem("people"));
  assert.equal(rows.length, 6);
  assert.equal(rows[5].n, "Newcomer");
  assert.equal(rows[5].h || "", "");
  assert.equal(document.querySelectorAll(".person").length, 6);
});

test("playbook: with eight named people there is no room, so Add to my map stays hidden and does nothing", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: named(8) } });
  type(window, document.getElementById("fTo"), "Ninth Person");
  const add = document.getElementById("addMark");
  assert.equal(add.hidden, true);
  add.click();
  assert.equal(JSON.parse(window.localStorage.getItem("people")).length, 8);
  type(window, document.getElementById("fToSel"), "3");
  add.click(); // a person is already chosen, so nothing is added
  assert.equal(JSON.parse(window.localStorage.getItem("people")).length, 8);
});

test("playbook: Copy message copies the letter and says Copied; a refused clipboard falls back to a hint", async () => {
  const wrote = [];
  const ok = await loadPage("playbook.html", { setup: (w) => { Object.defineProperty(w.navigator, "clipboard", { value: { writeText: (t) => { wrote.push(t); return Promise.resolve(); } }, configurable: true }); } });
  ok.document.getElementById("copyMsg").click();
  assert.ok(await waitFor(() => toastText(ok.document) === "Copied"));
  assert.equal(wrote[0], ok.document.getElementById("letter").textContent);
  const refused = await loadPage("playbook.html", { setup: (w) => { Object.defineProperty(w.navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true }); } });
  refused.document.getElementById("copyMsg").click();
  assert.ok(await waitFor(() => /Ctrl\+C or Cmd\+C/.test(toastText(refused.document))));
  assert.equal(refused.document.querySelectorAll("textarea[readonly]").length, 0, "the helper box is removed again");
});

test("playbook: each template's Copy button copies that template's text", async () => {
  const wrote = [];
  const { document } = await loadPage("playbook.html", { setup: (w) => { Object.defineProperty(w.navigator, "clipboard", { value: { writeText: (t) => { wrote.push(t); return Promise.resolve(); } }, configurable: true }); } });
  const btn = document.querySelector("[data-copy='t3']");
  btn.click();
  assert.ok(await waitFor(() => wrote.length === 1));
  assert.equal(wrote[0], document.getElementById("t3").textContent);
  assert.ok(wrote[0].length > 20);
});

test("playbook: Share it only appears where the phone can share, and shares the subject and body", async () => {
  const none = await loadPage("playbook.html");
  assert.equal(none.document.getElementById("shareMsg").hidden, true);
  const shared = [];
  const { window, document } = await loadPage("playbook.html", { setup: (w) => { w.navigator.share = (d) => { shared.push(d); return Promise.reject(new Error("cancelled")); }; } });
  const btn = document.getElementById("shareMsg");
  assert.equal(btn.hidden, false);
  type(window, document.getElementById("fSchool"), "Davis High");
  btn.click();
  assert.equal(shared.length, 1);
  assert.match(shared[0].title, /Quick question from a student at Davis High/);
  assert.doesNotMatch(shared[0].text, /^Subject:/);
  type(window, document.getElementById("fFormat"), "text");
  btn.click();
  assert.equal(shared[1].title, "My message", "a text has no subject line");
  await waitFor(() => false, { timeout: 30 }); // the cancelled share rejects quietly
  assert.equal(toastText(document), "");
});

test("playbook: switching to a text message swaps Email for Messages and builds an sms link", async () => {
  const { window, document } = await loadPage("playbook.html");
  assert.equal(document.getElementById("sendSms").hidden, true);
  assert.equal(document.getElementById("sendMail").hidden, false);
  type(window, document.getElementById("fFormat"), "text");
  assert.equal(document.getElementById("sendMail").hidden, true);
  assert.equal(document.getElementById("sendSms").hidden, false);
  assert.match(document.getElementById("sendSms").getAttribute("href"), /^sms:/);
  assert.doesNotMatch(document.getElementById("letter").textContent, /^Subject:/);
});

test("playbook: after a pause in typing a screen reader gets one short note with the word count", async () => {
  const { window, document } = await loadPage("playbook.html");
  const status = document.getElementById("letterStatus");
  type(window, document.getElementById("fMe"), "Maya");
  type(window, document.getElementById("fCurious"), "dentistry");
  assert.equal(status.textContent, "", "nothing is announced while typing");
  assert.ok(await waitFor(() => /^Message updated\. \d+ words\.$/.test(status.textContent)));
  assert.equal(status.textContent, "Message updated. " + parseInt(document.getElementById("wc").textContent, 10) + " words.");
});

test("playbook: a very long message turns the word meter red and fails the short-enough check", async () => {
  const { window, document } = await loadPage("playbook.html");
  type(window, document.getElementById("fCurious"), Array.from({ length: 120 }, () => "word").join(" "));
  assert.ok(document.getElementById("meter").classList.contains("over"));
  assert.equal(document.getElementById("meter").firstElementChild.style.width, "100%");
  assert.equal(document.querySelector("#checks li").classList.contains("ok"), false);
  assert.match(document.querySelector("#checks li .sr").textContent, /not yet/);
});

// A stand-in for the browser's canvas: records the words drawn and hands back a small blob.
function canvasSetup(drawn, { noBlob = false, fonts } = {}) {
  return (w) => {
    w.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, { get: (t, k) => (k === "fillText" ? (s) => drawn.push(s) : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    };
    w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(noBlob ? null : new w.Blob(["png"], { type: "image/png" })); };
    if (fonts) Object.defineProperty(w.document, "fonts", { value: fonts, configurable: true });
  };
}

test("playbook: Save my plan as an image draws every named person and downloads my-people-map.png", async () => {
  const drawn = [];
  const people = [{ n: "Mrs. Lee", w: "dentist", h: "my coach", s: "sent", d: daysAgo(10) }, { n: "Sam", s: "replied" }, { n: "Ana", w: "nurse" }, {}, {}];
  const { window, document } = await loadPage("playbook.html", { storage: { people }, setup: canvasSetup(drawn) });
  const saved = watchDownloads(window);
  document.getElementById("planPng").click();
  assert.ok(await waitFor(() => saved.length === 1 && toastText(document) === "Image saved to your device"));
  assert.equal(saved[0].name, "my-people-map.png");
  assert.ok(drawn.some((s) => /^2 of 5 messages sent/.test(s) && /Next follow-up: Mrs\. Lee/.test(s)));
  for (const t of ["MY PEOPLE MAP", "Mrs. Lee", "Sam", "Ana", "dentist  |  my coach"]) assert.ok(drawn.includes(t), t + " is drawn");
  assert.ok(drawn.some((s) => /^Sent, follow up /.test(s)));
  assert.ok(drawn.includes("They replied"));
  assert.ok(drawn.includes("Not sent yet"));
});

test("playbook: the plan image waits for the fonts, and still saves when a font fails to load", async () => {
  const asked = [];
  const fonts = { load: (spec) => { asked.push(spec); return Promise.reject(new Error("no font")); } };
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Sam" }] }, setup: canvasSetup([], { fonts }) });
  const saved = watchDownloads(window);
  document.getElementById("planPng").click();
  assert.ok(await waitFor(() => saved.length === 1));
  assert.equal(asked.length, 2);
  assert.equal(saved[0].name, "my-people-map.png");
});

test("playbook: if the browser cannot make the image, nothing is saved and no false 'saved' message shows", async () => {
  const { window, document } = await loadPage("playbook.html", { storage: { people: [{ n: "Sam" }] }, setup: canvasSetup([], { noBlob: true }) });
  const saved = watchDownloads(window);
  document.getElementById("planPng").click();
  await waitFor(() => false, { timeout: 100 });
  assert.equal(saved.length, 0);
  assert.equal(toastText(document), "");
});

test("playbook: the image button and hint follow whether anyone is named", async () => {
  const { window, document } = await loadPage("playbook.html");
  assert.equal(document.getElementById("planPng").disabled, true);
  assert.equal(document.getElementById("planHint").hidden, false);
  type(window, document.getElementById("pn0"), "Sam");
  assert.equal(document.getElementById("planPng").disabled, false);
  assert.equal(document.getElementById("planHint").hidden, true);
});

test("playbook: a damaged save (wrong types, bad dates, non-objects) still opens five clean cards", async () => {
  const { document, errors } = await loadPage("playbook.html", { storage: { people: [null, 7, "x", ["a"], { n: 5, w: ["z"], s: "sent", d: "2026-13-45" }, { n: "Ok", s: "sent", d: "2026-10-01" }] } });
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll(".person").length, 6);
  assert.equal(document.getElementById("pn4").value, "");
  assert.equal(document.getElementById("pn5").value, "Ok");
  assert.match(document.getElementById("pf5").textContent, /Sent Oct 1/);
});

test("playbook: when the device refuses to save, the page still works and nothing breaks", async () => {
  const { window, document, errors } = await loadPage("playbook.html", { setup: (w) => { w.Storage.prototype.setItem = () => { throw new Error("quota"); }; } });
  type(window, document.getElementById("pn0"), "Sam");
  type(window, document.getElementById("fMe"), "Maya");
  assert.equal(document.getElementById("pn0").value, "Sam");
  assert.match(document.getElementById("letter").textContent, /My name is Maya/);
  assert.equal(window.localStorage.getItem("people"), null);
  assert.deepEqual(errors, []);
});
