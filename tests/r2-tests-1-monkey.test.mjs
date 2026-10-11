// Click-everything monkey test. For every built page, under 3 fixed seeds, do 40 random steps
// (click, toggle, select, type), then re-run the structure rules on the rendered DOM every 10 steps.
// A seeded PRNG (mulberry32) makes every failure repeat. Run with: node --test tests/r2-tests-1-monkey.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPage, tick } from "./dom-helper.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const SEEDS = [11, 2026, 90210];
const STEPS = 40;
const BAD_TEXT = /NaN|undefined|Invalid Date|\{\{|\bnull\b/;

// page -> { rule name: one line reason the rule cannot hold }. An entry that never fires fails the run.
const ALLOW = {};

function prng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];
const clean = (s) => (s || "").trim();
const desc = (el) => el.outerHTML.slice(0, 90);

function hasLabel(doc, el) {
  if (clean(el.getAttribute("aria-label"))) return true;
  const lb = el.getAttribute("aria-labelledby");
  if (lb && lb.split(/\s+/).some((id) => doc.getElementById(id))) return true;
  if (el.closest("label")) return true;
  if (el.id) return [...doc.querySelectorAll("label[for]")].some((l) => l.getAttribute("for") === el.id);
  return false;
}

function rules(doc) {
  const out = {};
  const text = doc.body.textContent;
  const m = text.match(BAD_TEXT);
  out["body text is clean"] = m ? ['body text contains "' + m[0] + '" near: ' + text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, " ")] : [];
  const counts = new Map();
  for (const el of doc.querySelectorAll("[id]")) counts.set(el.id, (counts.get(el.id) || 0) + 1);
  out["no duplicate id"] = [...counts].filter(([, n]) => n > 1).map(([id, n]) => `id "${id}" x${n}`);
  out["fields have labels"] = [...doc.querySelectorAll("input:not([type=hidden]), select, textarea")].filter((el) => !hasLabel(doc, el)).map(desc);
  out["buttons have names"] = [...doc.querySelectorAll("button, input[type=button], input[type=submit], input[type=reset]")]
    .filter((el) => !clean(el.getAttribute("aria-label")) && !clean(el.textContent) && !(el.tagName === "INPUT" && clean(el.getAttribute("value")))).map(desc);
  const h1 = doc.querySelectorAll("h1").length;
  out["exactly one h1"] = h1 === 1 ? [] : [`found ${h1} h1`];
  return out;
}

function visible(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden || n.getAttribute("aria-hidden") === "true" || n.style.display === "none" || n.style.visibility === "hidden") return false;
    if (n.tagName === "DETAILS" && n !== el && !n.open && !el.closest("summary")) { /* closed details content */
      if (!(el.tagName === "SUMMARY" && el.parentElement === n)) return false;
    }
  }
  return !el.disabled;
}

const SKIP = /print|download|mailto|\.ics|save as/i;
function clickable(doc, win) {
  return [...doc.querySelectorAll("button, summary, [role=button]")].filter((el) => {
    if (!visible(el)) return false;
    if (el.tagName === "A" || el.closest("a[href]")) return false;
    const label = [el.id, el.className, el.getAttribute("aria-label"), el.textContent, el.getAttribute("data-action")].join(" ");
    return !SKIP.test(label);
  });
}

const fired = {}; // "page|rule" -> true when seen while allowlisted

for (const file of PAGES) {
  test(`${file}: monkey clicks keep the page clean (${SEEDS.length} seeds)`, async () => {
    const allowed = ALLOW[file] || {};
    const problems = [];
    for (const seed of SEEDS) {
      const r = prng(seed);
      const seen = [];
      const p = await loadPage(file, {
        setup(w) {
          for (const level of ["error", "warn"]) {
            const orig = w.console[level] && w.console[level].bind(w.console);
            w.console[level] = (...a) => { seen.push(`console.${level}: ` + a.map(String).join(" ")); if (orig) orig(...a); };
          }
          w.addEventListener("unhandledrejection", (e) => seen.push("unhandledrejection: " + String((e.reason && e.reason.message) || e.reason)));
          w.confirm = () => true; w.alert = () => {}; w.prompt = () => "Sam";
          w.open = () => null;
          w.HTMLAnchorElement.prototype.click = function () {}; // never leave the page
          w.HTMLFormElement.prototype.submit = function () {};
        },
      });
      const { window: w, document: doc } = p;
      const log = [];
      const check = (when) => {
        const found = { "no page errors": p.errors.map(String), "no console error or warning": seen.slice(), ...rules(doc) };
        for (const [rule, list] of Object.entries(found)) {
          if (!list.length) continue;
          if (allowed[rule]) { fired[file + "|" + rule] = true; continue; }
          problems.push(`seed ${seed} ${when}: ${rule}: ${list.slice(0, 3).join(" | ")}\n   last steps: ${log.slice(-4).join(" ; ")}`);
        }
      };
      try {
        check("after load");
        for (let i = 1; i <= STEPS; i++) {
          const kind = pick(r, ["click", "click", "click", "toggle", "select", "type"]);
          const fields = (sel) => [...doc.querySelectorAll(sel)].filter(visible);
          try {
            if (kind === "click") {
              const list = clickable(doc, w);
              if (list.length) { const el = pick(r, list); log.push("click " + desc(el).slice(0, 50)); el.click(); }
            } else if (kind === "toggle") {
              const list = fields("input[type=checkbox], input[type=radio]");
              if (list.length) { const el = pick(r, list); log.push("toggle " + desc(el).slice(0, 50)); el.click(); }
            } else if (kind === "select") {
              const list = fields("select");
              if (list.length) {
                const el = pick(r, list);
                if (el.options.length) { el.selectedIndex = Math.floor(r() * el.options.length); log.push("select " + el.id + "=" + el.value); el.dispatchEvent(new w.Event("change", { bubbles: true })); }
              }
            } else {
              const list = fields("textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]):not([type=submit]):not([type=hidden]):not([type=range]):not([type=color]):not([type=date]):not([type=time]):not([type=number]):not([type=email]):not([type=url])");
              if (list.length) {
                const el = pick(r, list);
                const s = Array.from({ length: 1 + Math.floor(r() * 8) }, () => pick(r, "abcdefgh xyz0123".split(""))).join("");
                el.value = s; log.push("type " + el.id + "=" + s); el.dispatchEvent(new w.Event("input", { bubbles: true }));
              }
            }
          } catch (e) { seen.push("step threw: " + (e && e.message)); }
          if (process.env.MONKEY_DEBUG && i === STEPS) console.log("MK", file, seed, log.length, log.slice(0, 3).join(" ; "));
          if (i % 10 === 0) { await tick(20); check("step " + i); }
        }
      } finally { w.close(); }
    }
    assert.deepEqual(problems, [], `${file} problems`);
  });
}

test("every allowlist entry still fires", () => {
  const stale = [];
  for (const [file, rs] of Object.entries(ALLOW)) for (const rule of Object.keys(rs)) if (!fired[file + "|" + rule]) stale.push(file + " / " + rule);
  assert.deepEqual(stale, [], "stale allowlist entries, remove them");
});
