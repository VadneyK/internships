// Keep my list without an account (docs/adr/0008). On the Programs page, My list gets Download my list (a text file made in
// the browser), Send to a parent (a mailto with an empty To line), Copy a link to my list (find.html#saved=id1,id2), and a
// Save and Load a backup file pair. A #saved= link or a backup file is offered, never merged without a tap.
// Run with: node --test tests/keep-my-list.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick, waitFor } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries-lite.json"), "utf8"));
const SITE = "https://vadneyk.github.io/internships/";
const byId = Object.fromEntries(DATA.map((e) => [e.id, e]));
// Programs from different parts of the country, so a place-only load (one chunk) does not have them all.
const A = DATA[0].id, B = DATA[1].id, C = DATA[2].id, D = DATA[3].id;
const GONE = "no-such-program-anywhere";

async function loadFind(opts = {}) {
  const r = await loadPage("find.html", opts);
  await waitFor(() => !/Loading/.test(r.document.getElementById("count").textContent));
  return r;
}
const saved = (window) => JSON.parse(window.localStorage.getItem("saved") || "[]");
// Stub the clipboard so Copy writes into an array the test can read.
function stubClipboard(window) {
  const written = [];
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText: (t) => { written.push(t); return Promise.resolve(); } } });
  return written;
}
// Stub the shared download helper so the test can read the file the page would save.
function stubDownload(window) {
  const files = [];
  window.TIG.download = (name, data, mime) => files.push({ name, data, mime });
  return files;
}
// jsdom cannot open mailto: links. Cancel the navigation after the page's own click handler has run.
const clickLink = (el) => { el.addEventListener("click", (e) => e.preventDefault()); el.click(); };
const decodeBody = (href) => { const i = href.indexOf("&body="); assert.ok(i > 0, href.slice(0, 60)); return decodeURIComponent(href.slice(i + 6)); };
const toast = (document) => document.getElementById("toast").textContent;
// Feed a file to the hidden file input the way a file picker would.
function pickFile(window, text, name = "my-internship-list.json") {
  const input = window.document.getElementById("importFile");
  const file = new window.File([text], name, { type: "application/json" });
  Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file } });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("keep: the new actions hide until the list has programs; Load a backup file is always there", async () => {
  const { document, errors } = await loadFind();
  const ids = ["downloadList", "parentList", "keepLink", "exportList", "listHow"];
  document.getElementById("savedOnly").click();
  await tick();
  assert.equal(document.getElementById("listActions").hidden, false);
  for (const id of ids) assert.equal(document.getElementById(id).hidden, true, id + " hides with an empty list");
  assert.equal(document.getElementById("importList").hidden, false);
  assert.equal(document.getElementById("importFile").hidden, true, "the file input is hidden; the button opens it");
  assert.equal(document.getElementById("keepAsk").hidden, true);
  assert.deepEqual(errors, []);
});

test("keep: with saved programs the actions show, each a real button or link with a name, hidden from print, with the no-accounts line", async () => {
  const { document, errors } = await loadFind({ storage: { saved: [A, B] } });
  document.getElementById("savedOnly").click();
  await tick();
  for (const id of ["downloadList", "parentList", "keepLink", "exportList", "listHow", "importList"]) {
    const el = document.getElementById(id);
    assert.equal(el.hidden, false, id);
    assert.ok(el.closest(".noprint"), id + " is inside a noprint block");
  }
  assert.equal(document.getElementById("downloadList").textContent.trim(), "Download my list");
  assert.equal(document.getElementById("parentList").textContent.trim(), "Send to a parent");
  assert.equal(document.getElementById("parentList").getAttribute("href"), "mailto:", "a placeholder until click");
  assert.equal(document.getElementById("keepLink").textContent.trim(), "Copy a link to my list");
  assert.equal(document.getElementById("exportList").textContent.trim(), "Save a backup file");
  assert.equal(document.getElementById("importList").textContent.trim(), "Load a backup file");
  const how = document.getElementById("listHow").textContent;
  assert.match(how, /We do not make accounts or collect emails/);
  assert.match(how, /A parent or teacher can open the same link/);
  assert.equal(document.getElementById("keepCapNote").hidden, true, "no cap note for a short list");
  assert.deepEqual(errors, []);
});

test("keep: Download my list saves a .txt made from the saved cards: name, place, ages, pay, dates, official page, the guide address and the keep link", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [A, B] } });
  const files = stubDownload(window);
  document.getElementById("savedOnly").click();
  await tick();
  document.getElementById("downloadList").click();
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "my-internship-list.txt");
  assert.equal(files[0].mime, "text/plain");
  const txt = files[0].data;
  assert.ok(txt.startsWith("My internship list\nFrom the Teen Internship Guide: " + SITE + "\n"), txt.slice(0, 120));
  assert.ok(txt.includes("Open this list again: " + SITE + "find.html#saved=" + A + "," + B), "keep link in the file");
  [A, B].forEach((id, i) => {
    const e = byId[id];
    assert.ok(txt.includes((i + 1) + ". " + e.name), "name of " + id);
    assert.ok(txt.includes("Where: " + (e.city || "Not stated")), "place of " + id);
    assert.ok(txt.includes(window.TIG.lib.ageText(e) + ". "), "ages of " + id);
    assert.ok(txt.includes("Dates: " + (e.deadline_text || "No date posted yet. Ask them.")), "dates of " + id);
    assert.ok(txt.includes("Official page: " + e.url), "url of " + id);
  });
  assert.match(txt, /Confirm ages, pay and dates on each program's own page/);
  assert.match(txt, /no accounts and no tracking/);
  assert.doesNotMatch(txt, /[\u2013\u2014]/, "no long dashes");
  assert.match(toast(document), /Saved my-internship-list\.txt/);
  assert.deepEqual(errors, []);
});

test("keep: Send to a parent is a mailto with no address, a parent-friendly note, each official page and the keep link", async () => {
  const { document, errors } = await loadFind({ storage: { saved: [A, B] } });
  document.getElementById("savedOnly").click();
  await tick();
  const a = document.getElementById("parentList");
  clickLink(a);
  const href = a.getAttribute("href");
  assert.ok(href.startsWith("mailto:?subject="), "no To address, ever: " + href.slice(0, 40));
  assert.doesNotMatch(href, /@/, "no address anywhere in the link");
  assert.equal(decodeURIComponent(href.slice("mailto:?subject=".length, href.indexOf("&body="))), "My internship list: can you take a look?");
  const body = decodeBody(href);
  assert.ok(body.startsWith("Hi,\n\nI made a list of 2 programs I want to apply to."), body.slice(0, 80));
  assert.match(body, /free guide that students help run/);
  assert.match(body, /not an official site/);
  assert.match(body, /no accounts, no sign-up and no tracking/);
  assert.match(body, /nobody there sees this email or my list/);
  for (const id of [A, B]) {
    assert.ok(body.includes("- " + byId[id].name), "name of " + id);
    assert.ok(body.includes(byId[id].url), "official page of " + id);
  }
  assert.ok(body.includes("Open my list on your phone or computer: " + SITE + "find.html#saved=" + A + "," + B));
  assert.doesNotMatch(body, /[\u2013\u2014]/, "no long dashes");
  assert.deepEqual(errors, []);
});

test("keep: Copy a link to my list copies find.html#saved= with the saved ids in order", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [B, A] } });
  const written = stubClipboard(window);
  document.getElementById("savedOnly").click();
  await tick();
  document.getElementById("keepLink").click();
  await tick();
  assert.deepEqual(written, [SITE + "find.html#saved=" + B + "," + A]);
  assert.deepEqual(errors, []);
});

test("keep: a list over 40 programs shows the cap note and the link carries the first 40", async () => {
  const many = DATA.slice(0, 45).map((e) => e.id);
  const { window, document, errors } = await loadFind({ storage: { saved: many } });
  const written = stubClipboard(window);
  document.getElementById("savedOnly").click();
  await tick();
  assert.equal(document.getElementById("keepCapNote").hidden, false);
  assert.match(document.getElementById("listHow").textContent, /A link holds your first 40 programs\. Save a backup file keeps all of them\./);
  document.getElementById("keepLink").click();
  await tick();
  assert.equal(written[0], SITE + "find.html#saved=" + many.slice(0, 40).join(","));
  assert.deepEqual(errors, []);
});

test("keep: the id parser drops bad, unknown-shaped and repeated ids and caps a long link", async () => {
  const { window } = await loadFind();
  const k = (...a) => [...window.TIG.keepIds(...a)]; // copied into this realm, so deepEqual compares values, not Array prototypes
  assert.equal(window.TIG.KEEP_MAX, 40);
  assert.deepEqual(k("#saved=a-1,b-2,c"), ["a-1", "b-2", "c"]);
  assert.deepEqual(k("saved=b,a"), ["b", "a"]);
  assert.deepEqual(k("#saved="), []);
  assert.deepEqual(k("#saved=ok-1,Bad,has space,../x,a.b,'q',<b>,,ok-2"), ["ok-1", "ok-2"]);
  assert.deepEqual(k(["ok", 3, null, {}, "also-ok", "-starts-with-dash"]), ["ok", "also-ok"]);
  assert.deepEqual(k("#saved=" + "x".repeat(80) + "," + "y".repeat(81)), ["x".repeat(80)], "80 characters is the longest id");
  assert.deepEqual(k("#saved=a%2Db,%E0%A4%A"), ["a-b"], "an encoded id is decoded once; a broken encoding is dropped");
  assert.deepEqual(k("#saved=a,b,a,a,c,b"), ["a", "b", "c"]);
  assert.deepEqual(k(42), []);
  const many = Array.from({ length: 60 }, (_, i) => "p-" + i);
  assert.deepEqual(k("#saved=" + many.join(",")), many.slice(0, 40));
  assert.equal(k(many, 500).length, 60, "a backup file may hold more than a link");
  assert.deepEqual(k("#saved=a,a,b,c", 2), ["a", "b"], "repeats do not use up the cap");
});

test("keep: a #saved= link asks before adding: the panel names the new count, focus moves to it, nothing is saved until Add", async () => {
  const { window, document, errors } = await loadFind({ search: "#saved=" + A + ",Bad/../x," + B + "," + GONE + "," + A, storage: { saved: [C] } });
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  const box = document.getElementById("keepAsk");
  assert.equal(box.getAttribute("role"), "group");
  assert.equal(box.getAttribute("aria-labelledby"), "keepAskH");
  assert.equal(document.getElementById("keepAskH").textContent, "Add 2 programs to your list?");
  assert.match(document.getElementById("keepAskP").textContent, /^This link has 2 programs that are not on your list yet\. Your list keeps what is on it\. Nothing is added until you tap Add\.$/);
  assert.equal(document.activeElement, document.getElementById("keepAskH"), "focus moves to the question");
  assert.deepEqual(saved(window), [C], "nothing saved yet");
  assert.equal(document.getElementById("savedN").textContent, "1");

  document.getElementById("keepAdd").click();
  await tick();
  assert.deepEqual(saved(window), [C, A, B], "the list keeps what it had and adds the two known ids once");
  assert.equal(box.hidden, true);
  assert.equal(window.location.hash, "", "the link's hash is dropped so a reload does not ask again");
  assert.equal(document.getElementById("savedOnly").getAttribute("aria-pressed"), "true", "My list opens");
  assert.equal(document.getElementById("savedN").textContent, "3");
  assert.equal(document.querySelectorAll("article.prog").length, 3);
  assert.equal(toast(document), "Added 2 programs to your list");
  assert.equal(document.activeElement, document.getElementById("savedOnly"));
  assert.deepEqual(errors, []);
});

test("keep: No thanks adds nothing, drops the hash and says so", async () => {
  const { window, document, errors } = await loadFind({ search: "#saved=" + A, storage: { saved: [C] } });
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  assert.equal(document.getElementById("keepAskH").textContent, "Add 1 program to your list?");
  assert.match(document.getElementById("keepAskP").textContent, /^This link has 1 program that is not on your list yet\./);
  document.getElementById("keepSkip").click();
  await tick();
  assert.deepEqual(saved(window), [C]);
  assert.equal(document.getElementById("keepAsk").hidden, true);
  assert.equal(window.location.hash, "");
  assert.equal(toast(document), "Nothing was added");
  assert.deepEqual(errors, []);
});

test("keep: the panel counts the ids already saved, and a link whose programs are all saved only says so", async () => {
  const a = await loadFind({ search: "#saved=" + A + "," + B + "," + C, storage: { saved: [A, B] } });
  await waitFor(() => !a.document.getElementById("keepAsk").hidden);
  assert.equal(a.document.getElementById("keepAskH").textContent, "Add 1 program to your list?");
  assert.match(a.document.getElementById("keepAskP").textContent, /1 program that is not on your list yet, and 2 you already saved\./);

  const b = await loadFind({ search: "#saved=" + A + "," + B, storage: { saved: [B, A] } });
  await waitFor(() => /already has/.test(toast(b.document)));
  assert.equal(b.document.getElementById("keepAsk").hidden, true);
  assert.equal(toast(b.document), "Your list already has these 2 programs");
  assert.equal(b.window.location.hash, "");
  assert.deepEqual(saved(b.window), [B, A]);
  assert.deepEqual(b.errors, []);
});

test("keep: a link with only bad or unknown ids adds nothing and says the link has no programs on the list", async () => {
  const { window, document, errors } = await loadFind({ search: "#saved=" + GONE + ",Bad%20Id,<script>", storage: { saved: [C] } });
  await waitFor(() => /no programs/.test(toast(document)));
  assert.equal(document.getElementById("keepAsk").hidden, true);
  assert.equal(toast(document), "This link has no programs that are on the list now");
  assert.deepEqual(saved(window), [C]);
  assert.equal(window.location.hash, "");
  assert.deepEqual(errors, []);
});

test("keep: a link with too many ids offers the first 40 only", async () => {
  const many = DATA.slice(0, 60).map((e) => e.id);
  const { window, document, errors } = await loadFind({ search: "#saved=" + many.join(",") });
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  assert.equal(document.getElementById("keepAskH").textContent, "Add 40 programs to your list?");
  document.getElementById("keepAdd").click();
  await tick();
  assert.deepEqual(saved(window), many.slice(0, 40));
  assert.deepEqual(errors, []);
});

test("keep: a #saved= link pasted into an open page (hashchange) asks too", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [] } });
  assert.equal(document.getElementById("keepAsk").hidden, true);
  window.location.hash = "#saved=" + A + "," + D;
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  assert.equal(document.getElementById("keepAskH").textContent, "Add 2 programs to your list?");
  document.getElementById("keepAdd").click();
  await tick();
  assert.deepEqual(saved(window), [A, D]);
  assert.deepEqual(errors, []);
});

test("keep: with one place loaded, a link to programs elsewhere loads the whole list first and still offers them", async () => {
  // DATA is sorted by id, so the first cards are not Bay Area cards; the saved Oakland place loads only its own part.
  const far = DATA.filter((e) => !(e.regions || []).some((r) => /oakland|berkeley|san-francisco|silicon-valley|san-jose|peninsula|fremont|statewide|online/.test(r))).slice(0, 2).map((e) => e.id);
  assert.equal(far.length, 2);
  const { window, document, errors } = await loadFind({ search: "#saved=" + far.join(","), storage: { findprefs: { age: "", place: "city:oakland" } } });
  assert.ok(await waitFor(() => !document.getElementById("keepAsk").hidden, { timeout: 15000 }), "the panel opens after the whole list loads");
  assert.equal(document.getElementById("keepAskH").textContent, "Add 2 programs to your list?");
  document.getElementById("keepAdd").click();
  await tick();
  assert.deepEqual(saved(window), far);
  assert.deepEqual(errors, []);
});

test("keep: Save a backup file writes a small .json with the guide address and the saved ids", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [A, B] } });
  const files = stubDownload(window);
  document.getElementById("savedOnly").click();
  await tick();
  document.getElementById("exportList").click();
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "my-internship-list.json");
  assert.equal(files[0].mime, "application/json");
  assert.deepEqual(JSON.parse(files[0].data), { guide: SITE, saved: [A, B] });
  assert.ok(files[0].data.length < 400, "a small file: " + files[0].data.length);
  assert.match(toast(document), /Saved my-internship-list\.json/);
  assert.deepEqual(errors, []);
});

test("keep: Load a backup file opens the file picker, reads the file in the browser and asks before adding", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [A] } });
  let opened = 0;
  document.getElementById("importFile").click = () => { opened++; };
  document.getElementById("importList").click();
  assert.equal(opened, 1, "the button opens the hidden file input");

  pickFile(window, JSON.stringify({ guide: SITE, saved: [A, B, "Bad Id", C, C, GONE] }));
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  assert.equal(document.getElementById("keepAskH").textContent, "Add 2 programs to your list?");
  assert.match(document.getElementById("keepAskP").textContent, /^This file has 2 programs that are not on your list yet, and 1 you already saved\./);
  assert.deepEqual(saved(window), [A], "nothing added before the tap");
  document.getElementById("keepAdd").click();
  await tick();
  assert.deepEqual(saved(window), [A, B, C]);
  assert.deepEqual(errors, []);
});

test("keep: a backup file that is a plain array works; one that is not JSON, or holds no known id, adds nothing", async () => {
  const { window, document, errors } = await loadFind({ storage: { saved: [] } });
  pickFile(window, JSON.stringify([B, D]));
  await waitFor(() => !document.getElementById("keepAsk").hidden);
  assert.equal(document.getElementById("keepAskH").textContent, "Add 2 programs to your list?");
  document.getElementById("keepSkip").click();
  await tick();
  assert.deepEqual(saved(window), []);

  pickFile(window, "{not json", "notes.json");
  await waitFor(() => /This file has no programs/.test(toast(document)));
  assert.equal(document.getElementById("keepAsk").hidden, true);

  pickFile(window, JSON.stringify({ saved: [GONE] }));
  await tick(100);
  assert.equal(document.getElementById("keepAsk").hidden, true);
  assert.deepEqual(saved(window), []);
  assert.deepEqual(errors, []);
});

test("keep: the parents page explains the four ways and the about page privacy text covers them", async () => {
  const parents = fs.readFileSync(path.join(ROOT, "parents.html"), "utf8");
  assert.match(parents, /<section id="list">/);
  assert.match(parents, /How your teen can share their list with you/);
  for (const t of ["Send to a parent", "Copy a link to my list", "Download my list", "Load a backup file", "Your teen types your address. We never see it."]) assert.ok(parents.includes(t), t);
  assert.match(parents, /<a class="chip" href="#list">Your teen's list<\/a>/, "the on-this-page chips link to it");
  const about = fs.readFileSync(path.join(ROOT, "about.html"), "utf8");
  assert.match(about, /the email opens in your own mail app with an empty To line, and the link holds only the ids of the saved programs\. We never see the list or any email address\./);
  for (const f of ["parents.html", "about.html", "find.html"]) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), "utf8"), /[\u2013\u2014]/, f + " has no long dashes");
});
