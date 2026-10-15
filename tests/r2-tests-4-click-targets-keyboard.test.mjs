// Every element that JS gives a click listener must work from the keyboard.
// A spy on addEventListener records every element wired for "click" on each built root page,
// including cards drawn from data after load. Native controls pass. Anything else (a div, span, li)
// needs a button-like role, tabindex 0 or -1, and a keydown or keyup handler.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html") && f !== "404.html").sort();

// Elements allowed to be click targets without keyboard support. Selector, reason. Keep this short.
const ALLOW = [
  ["#pOut", "Delegate on the permit answer card. It only handles clicks on the real a[href] jump link inside it; the card itself is not a control."],
  ["#mapBox svg", "The map picture is hidden from screen readers on purpose. Every city on it is in the list under it and in the typed place box, which work from the keyboard (tests/map.dom.test.mjs)."],
];

const ROLES = new Set(["button", "link", "tab", "option", "menuitem"]);
const NATIVE = (el) => {
  const t = el.localName;
  if (t === "button" || t === "select" || t === "textarea" || t === "summary" || t === "label") return true;
  if (t === "a") return el.hasAttribute("href");
  if (t === "input") return el.type !== "hidden";
  return false;
};

// Run in beforeParse: record which elements got which listener types.
export function spy(w) {
  const log = new w.Map();
  w.__listenLog = log;
  for (const proto of [w.EventTarget.prototype, w.Element.prototype]) {
    if (!Object.prototype.hasOwnProperty.call(proto, "addEventListener")) continue;
    const orig = proto.addEventListener;
    proto.addEventListener = function (type, ...rest) {
      if (type === "click" || type === "keydown" || type === "keyup") {
        if (!log.has(this)) log.set(this, new w.Set());
        log.get(this).add(type);
      }
      return orig.call(this, type, ...rest);
    };
  }
}

function describe(el) {
  const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "";
  return el.localName + (el.id ? "#" + el.id : "") + cls + ' "' + (el.textContent || "").trim().slice(0, 30) + '"';
}

const hasKey = (el, log) => {
  for (let n = el; n; n = n.parentElement) { const s = log.get(n); if (s && (s.has("keydown") || s.has("keyup"))) return true; }
  return false;
};

// Returns a list of problems for one element that must be keyboard usable.
function check(el, log) {
  if (ALLOW.some(([sel]) => el.matches(sel))) return [];
  if (NATIVE(el)) return [];
  const role = el.getAttribute("role");
  const ti = el.getAttribute("tabindex");
  const bad = [];
  if (!ROLES.has(role)) bad.push("no native control and no role of button, link, tab, option or menuitem");
  if (ti !== "0" && ti !== "-1") bad.push("no tabindex of 0 or -1");
  if (!hasKey(el, log)) bad.push("no keydown or keyup handler");
  return bad;
}

// Collects every element that needs checking: direct listeners, onclick properties, and delegated descendants.
export function problems(document, log, pageName) {
  const out = [];
  const seen = new Set();
  const add = (el, why) => out.push(pageName + ": " + describe(el) + " (" + why.join("; ") + ")");
  const targets = new Set();
  for (const [el, types] of log) {
    if (!types.has("click") || !el.localName) continue;
    if (el === document.documentElement || el === document.body) continue;
    targets.add(el);
  }
  for (const el of document.querySelectorAll("*")) if (typeof el.onclick === "function") targets.add(el);
  for (const el of targets) {
    if (!el.isConnected) continue;
    const interactive = NATIVE(el) || ROLES.has(el.getAttribute("role"));
    const clickables = [...el.querySelectorAll("[role],[tabindex],.chip,.tile,.btn,.star")];
    const hasNative = !!el.querySelector("button,a[href],input,select,textarea,summary,label");
    if (!interactive && (clickables.length || hasNative)) {
      // A container with a delegated listener: check every descendant that looks clickable.
      for (const d of clickables) { if (seen.has(d)) continue; seen.add(d); const p = check(d, log); if (p.length) add(d, p); }
      continue;
    }
    if (seen.has(el)) continue; seen.add(el);
    const p = check(el, log); if (p.length) add(el, p);
  }
  return out;
}

for (const file of pages) {
  test(file + ": every click target works from the keyboard", async () => {
    const { window, document } = await loadPage(file, { setup: spy });
    await new Promise((r) => setTimeout(r, 150));
    const log = window.__listenLog;
    assert.deepEqual(problems(document, log, file), [], "before any click");
    const first = document.querySelector("main .chip, main .tile, main button");
    if (first) {
      try { first.click(); } catch (e) { /* a page may refuse; the checks below still run */ }
      await new Promise((r) => setTimeout(r, 150));
      assert.deepEqual(problems(document, log, file), [], "after one click on " + describe(first));
    }
    window.close();
  });
}

test("fixture: a div with a click handler and no keyboard support is caught", async () => {
  const { window, document } = await loadPage("about.html", { setup: spy });
  const log = window.__listenLog;
  const bad = document.createElement("div"); bad.id = "fixBad"; bad.textContent = "Go";
  bad.addEventListener("click", () => {});
  const prop = document.createElement("span"); prop.id = "fixProp"; prop.onclick = () => {};
  const good = document.createElement("div"); good.setAttribute("role", "button"); good.tabIndex = 0; good.id = "fixGood";
  good.addEventListener("click", () => {}); good.addEventListener("keydown", () => {});
  document.body.append(bad, prop, good);
  const found = problems(document, log, "about.html");
  assert.ok(found.some((s) => s.includes("about.html") && s.includes("div#fixBad")), found.join("\n"));
  assert.ok(found.some((s) => s.includes("span#fixProp")), found.join("\n"));
  assert.ok(!found.some((s) => s.includes("fixGood")), found.join("\n"));
  window.close();
});
