// Programs page: "Text it to myself" and "Email it to myself" next to "Copy my list".
// Run with: node --test tests/r2-teen-flow-10-find.test.mjs
// The message text is the same text Copy my list copies. Both links build their href when clicked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/entries.json"), "utf8"));
const SITE = "https://vadneyk.github.io/internships/";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".csv": "text/csv", ".txt": "text/plain" };

let serverPromise;
function server() {
  if (!serverPromise) {
    serverPromise = new Promise((resolve) => {
      const s = http.createServer((req, res) => {
        const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
        const p = path.join(ROOT, rel);
        if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404, { Connection: "close" }); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", Connection: "close" }); // close: a reused keep-alive socket the server already dropped gave ECONNRESET under load (2026-10-16)
        res.end(fs.readFileSync(p));
      });
      s.listen(0, "127.0.0.1", () => { s.unref(); resolve(s.address().port); });
    });
  }
  return serverPromise;
}

// Same loader as tests/find.dom.test.mjs: jsdom has no fetch, so the page's fetch reads the real data over the local server.
async function loadFind({ storage = {} } = {}) {
  const port = await server();
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String((e && e.message) || e)));
  vc.on("error", (...a) => errors.push(a.join(" ")));
  const dom = await JSDOM.fromURL("http://127.0.0.1:" + port + "/find.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, JSON.stringify(v));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
      w.print = () => {};
      w.scrollTo = () => {};
      w.HTMLElement.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
      w.fetch = (u, opts) => globalThis.fetch(new URL(u, "http://127.0.0.1:" + port + "/"), opts);
    },
  });
  const { document } = dom.window;
  await new Promise((r) => (document.readyState === "complete" ? r() : dom.window.addEventListener("load", r)));
  for (let i = 0; i < 80 && /Loading/.test(document.getElementById("count").textContent); i++) await tick(25);
  return { window: dom.window, document, errors };
}

// Stub the clipboard so Copy my list writes into an array the test can read.
function stubClipboard(window) {
  const written = [];
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text) => { written.push(text); return Promise.resolve(); } },
  });
  return written;
}

// jsdom cannot open sms: or mailto: links. Cancel the navigation after the page's own click handler has run.
const clickLink = (el) => { el.addEventListener("click", (e) => e.preventDefault()); el.click(); };

// Save the first two cards on the first page, then open My list.
async function savePairAndOpenList(document) {
  const ids = [...document.querySelectorAll("article.prog .star")].slice(0, 2).map((s) => s.getAttribute("data-id"));
  for (const id of ids) document.querySelector('.star[data-id="' + id + '"]').click();
  document.getElementById("savedOnly").click();
  await tick();
  return ids;
}

const decodeBody = (href, prefix) => {
  assert.ok(href.startsWith(prefix), "unexpected href: " + href.slice(0, 40));
  const i = href.indexOf("body=");
  assert.ok(i > -1, "no body in " + href.slice(0, 60));
  return decodeURIComponent(href.slice(i + 5));
};

test("r2-find-1: both message links are hidden on a fresh load and while My list is empty", async () => {
  const { document, errors } = await loadFind();
  const text = document.getElementById("textList"), mail = document.getElementById("emailList");
  assert.equal(text.hidden, true);
  assert.equal(mail.hidden, true);
  document.getElementById("savedOnly").click();
  await tick();
  assert.match(document.getElementById("out").textContent, /Your list is empty/);
  assert.equal(text.hidden, true, "text link stays hidden with an empty list");
  assert.equal(mail.hidden, true, "email link stays hidden with an empty list");
  assert.deepEqual(errors, []);
});

test("r2-find-1: with saved programs both links show, with the labels from the acceptance", async () => {
  const { document, errors } = await loadFind();
  await savePairAndOpenList(document);
  const text = document.getElementById("textList"), mail = document.getElementById("emailList");
  assert.equal(text.hidden, false);
  assert.equal(mail.hidden, false);
  assert.equal(text.textContent.trim(), "Text it to myself");
  assert.equal(mail.textContent.trim(), "Email it to myself");
  assert.equal(text.getAttribute("href"), "sms:", "the href is only a placeholder until click");
  assert.equal(mail.getAttribute("href"), "mailto:", "the href is only a placeholder until click");
  assert.deepEqual(errors, []);
});

test("r2-find-1: the text link body is the Copy my list text and starts with the site address", async () => {
  const { window, document, errors } = await loadFind();
  const written = stubClipboard(window);
  await savePairAndOpenList(document);

  document.getElementById("copyList").click();
  await tick();
  assert.equal(written.length, 1);
  const copied = written[0];
  assert.ok(copied.startsWith(SITE + "\n"), "copy text starts with the site address");

  const text = document.getElementById("textList");
  clickLink(text);
  const body = decodeBody(text.getAttribute("href"), "sms:?&body=");
  assert.equal(body, copied, "sms body is the same text Copy my list copies");
  assert.ok(body.startsWith(SITE));
  assert.deepEqual(errors, []);
});

test("r2-find-1: the email link is a mailto with subject My first job list and the same body", async () => {
  const { window, document, errors } = await loadFind();
  const written = stubClipboard(window);
  await savePairAndOpenList(document);

  document.getElementById("copyList").click();
  await tick();

  const mail = document.getElementById("emailList");
  clickLink(mail);
  const href = mail.getAttribute("href");
  assert.ok(href.startsWith("mailto:?subject=My%20first%20job%20list&body="), href.slice(0, 80));
  assert.equal(decodeBody(href, "mailto:?subject="), written[0], "mail body is the same text Copy my list copies");
  assert.deepEqual(errors, []);
});

test("r2-find-1: the message text lists each saved program with its name, org, deadline and link", async () => {
  const { document, errors } = await loadFind();
  const ids = await savePairAndOpenList(document);
  clickLink(document.getElementById("textList"));
  const body = decodeBody(document.getElementById("textList").getAttribute("href"), "sms:?&body=");
  for (const id of ids) {
    const prog = DATA.find((e) => e.id === id);
    assert.ok(body.includes("- " + prog.name + " ("), "missing " + prog.name);
    if (prog.deadline_text) assert.ok(body.includes(prog.deadline_text), "missing deadline for " + prog.name);
    if (prog.url) assert.ok(body.includes(prog.url), "missing URL for " + prog.name);
  }
  assert.deepEqual(errors, []);
});

test("r2-find-1: the href is built at click time, so a program removed from the list is gone from the next click", async () => {
  const { document, errors } = await loadFind();
  const ids = await savePairAndOpenList(document);
  const text = document.getElementById("textList");
  clickLink(text);
  const before = decodeBody(text.getAttribute("href"), "sms:?&body=");
  const gone = DATA.find((e) => e.id === ids[1]);
  assert.ok(before.includes("\n- " + gone.name + " ("));

  document.querySelector('.star[data-id="' + ids[1] + '"]').click();
  await tick();
  assert.equal(text.hidden, false, "one saved program is left, so the link still shows");
  clickLink(text);
  const after = decodeBody(text.getAttribute("href"), "sms:?&body=");
  // Match the list line, not any mention: another card's dates can name the removed program (2026-10-27, Berkeley YouthWorks).
  assert.ok(!after.includes("\n- " + gone.name + " ("), "removed program is not in the new text");
  assert.ok(after.includes(DATA.find((e) => e.id === ids[0]).name));
  assert.deepEqual(errors, []);
});

test("r2-find-1: removing the last saved program hides both links again", async () => {
  const { document, errors } = await loadFind();
  const ids = await savePairAndOpenList(document);
  for (const id of ids) {
    const star = document.querySelector('.star[data-id="' + id + '"]');
    if (star) star.click();
    await tick();
  }
  assert.equal(document.getElementById("textList").hidden, true);
  assert.equal(document.getElementById("emailList").hidden, true);
  assert.deepEqual(errors, []);
});

test("r2-find-1: a saved list that is already in storage shows both links on load", async () => {
  const id = DATA[0].id;
  const { document, errors } = await loadFind({ storage: { saved: [id] } });
  document.getElementById("savedOnly").click();
  await tick();
  assert.equal(document.getElementById("textList").hidden, false);
  assert.equal(document.getElementById("emailList").hidden, false);
  assert.deepEqual(errors, []);
});
