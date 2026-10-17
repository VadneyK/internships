// 2026-10-17: the Spanish words for the Playbook tools (assets/js/es-playbook.js, ADR 0008), checked in Node.
// playbook.js passes every English string through t("..."), so the table must have a row for each one and no row that is never
// used: an English edit then fails here until the Spanish row is updated, instead of showing English on the Spanish page.
// The page itself is driven in tests/es-playbook.dom.test.mjs.
// Run with: node --test tests/es-playbook.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ES = require("../assets/js/es-playbook.js");
const L = require("../assets/js/lib.js");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const PLAYBOOK = read("assets/js/playbook.js").replace(/\/\*[\s\S]*?\*\//g, ""); // code only: a comment may name t()
const numbers = (s) => (s.match(/\d+/g) || []).sort();

test("every t() in playbook.js has a Spanish row, and every row is used", () => {
  const calls = PLAYBOOK.match(/\bt\(/g).length;
  const literals = [...PLAYBOOK.matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)].map((m) => JSON.parse('"' + m[1] + '"'));
  assert.equal(literals.length, calls, "every t() call takes one plain string, so this test can read it");
  const used = new Set(literals);
  const rows = Object.keys(ES.WORDS);
  assert.deepEqual(rows.filter((k) => !used.has(k)), [], "rows no t() call uses (the English changed or the call is gone)");
  assert.deepEqual([...used].filter((k) => !rows.includes(k)), [], "t() strings with no Spanish row");
});

test("each Spanish row is translated and fits where the English went", () => {
  for (const [en, es] of Object.entries(ES.WORDS)) {
    assert.notEqual(es, en, en + " is translated");
    assert.ok(es.trim().length >= Math.min(3, en.trim().length) && es.length >= en.length * 0.5, JSON.stringify(en) + " has real Spanish words, not an empty row");
    assert.equal(/^ /.test(es), /^ /.test(en), JSON.stringify(en) + ": the same leading space, so pieces join the same way");
    assert.equal(/ $/.test(es), / $/.test(en), JSON.stringify(en) + ": the same trailing space");
    assert.deepEqual(numbers(es), numbers(en), en + ": the same numbers");
    assert.doesNotMatch(es, /[<>"]/, en + ": safe to put inside HTML and attributes");
  }
  assert.ok(ES.WORDS["[their name]"].startsWith("[") && L.blanksLeft(ES.WORDS["[their name]"]).length === 1, "blanks stay in brackets, so the blank check still finds them");
});

test("t() gives the Spanish row, and passes anything else through untouched", () => {
  assert.equal(ES.t("Write to them"), "Escribirle");
  assert.equal(ES.t("Something new"), "Something new");
  assert.equal(ES.t("constructor"), "constructor", "only the table's own rows, never inherited names");
  assert.equal(ES.t("toString"), "toString");
});

test("no em or en dash, and no tú in the sentences that speak to the adult", () => {
  assert.doesNotMatch(read("assets/js/es-playbook.js"), /[–—]/);
  const toAdult = [...ES.hows.map((h) => h[1]), ...Object.values(ES.ask).flat()];
  for (const s of toAdult) assert.doesNotMatch(s, /\b(tú|tu|te|ti|contigo|puedes|podrías|eres|estás|tienes)\b/i, s + " uses usted");
});

test("statuses, how-chips and asks have the shape playbook.js expects", () => {
  assert.deepEqual(ES.statuses.map((s) => s[0]), L.STATUSES.map((s) => s[0]), "the same status keys in the same order");
  for (const s of ES.statuses) assert.ok(s[1].length > 3);
  assert.equal(ES.hows.length, 5);
  for (const [label, line] of ES.hows) {
    assert.ok(label.length > 3 && label.length < 40, label);
    assert.match(line, /^[A-ZÁÉÍÓÚÑ].*\.$/, line + " is one sentence");
  }
  assert.equal(ES.hows.filter((h) => L.blanksLeft(h[1]).length).length, 1, "only the parent chip has a blank to fill");
  const options = (rel) => [...read(rel).match(/<select id="fAsk">([\s\S]*?)<\/select>/)[1].matchAll(/value="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(options("src/es/playbook.html"), options("src/playbook.html"), "the Spanish ask menu has the English values");
  assert.deepEqual(Object.keys(ES.ask).sort(), options("src/playbook.html").sort(), "one ask pair per menu value");
  for (const [email, text] of Object.values(ES.ask)) {
    for (const a of [email, text]) {
      assert.match(a, /^¿/, a + " opens the question");
      assert.doesNotMatch(a, /\?$/, a + " leaves the ? to the message, after the when");
    }
    assert.ok(text.length < email.length, "the text-message ask is the short one");
  }
});

test("date() writes a Spanish date and gives \"\" for a bad one, like L.fmtDate", () => {
  assert.equal(ES.date(new Date(2026, 9, 17)), "17 oct. 2026");
  assert.equal(ES.date(new Date(2027, 0, 1)), "1 ene. 2027");
  assert.equal(ES.date(new Date(2026, 11, 31)), "31 dic. 2026");
  assert.equal(ES.date(new Date(2027, 4, 9)), "9 mayo 2027", "mayo is short already");
  const months = Array.from({ length: 12 }, (_, m) => ES.date(new Date(2027, m, 2)).replace(/^2 | 2027$/g, ""));
  assert.deepEqual(months, ["ene.", "feb.", "mar.", "abr.", "mayo", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."]);
  const longest = "Enviado" + ES.WORDS[", follow up "] + ES.date(new Date(2026, 8, 30));
  assert.ok(longest.length <= 40, longest + " fits the 40 characters the plan image keeps for a status");
  assert.equal(ES.date(new Date("nope")), "");
  assert.equal(ES.date(null), "");
  assert.equal(ES.date("2026-10-17"), "");
  assert.equal(ES.date(L.parseISO("2026-02-30")), "", "a day that does not exist");
});

test("grade() turns what a teen types into the words after estoy", () => {
  const cases = [
    ["", "en [grado]"], [null, "en [grado]"], [undefined, "en [grado]"], ["   ", "en [grado]"],
    ["10", "en 10.º grado"], ["10th", "en 10.º grado"], ["10TH", "en 10.º grado"], ["10mo", "en 10.º grado"], ["9no", "en 9.º grado"],
    ["11vo", "en 11.º grado"], ["1ro", "en 1.º grado"], ["2do", "en 2.º grado"], ["3ro", "en 3.º grado"], ["4to", "en 4.º grado"], ["12o", "en 12.º grado"],
    ["10.º", "en 10.º grado"], ["10º", "en 10.º grado"], ["10°", "en 10.º grado"], ["10.", "en 10.º grado"], ["10 º", "en 10.º grado"],
    ["grado 10", "en 10.º grado"], ["Grado 11", "en 11.º grado"], ["grade 6", "en 6.º grado"], ["10 grado", "en 10.º grado"], ["10th grade", "en 10.º grado"],
    ["freshman", "en 9.º grado"], ["Sophomore", "en 10.º grado"], ["JUNIOR", "en 11.º grado"], ["senior", "en 12.º grado"],
    ["décimo", "en décimo grado"], ["noveno grado", "en noveno grado"], ["primer año de preparatoria", "en primer año de preparatoria grado"],
    ["0", "en 0 grado"], ["13", "en 13 grado"], ["100", "en 100 grado"], ["10x", "en 10x grado"], ["freshman year", "en freshman year grado"],
    ["sophomore grade", "en sophomore grade grado"], ["10th grado extra", "en 10th grado extra"], [" 10 ", "en 10.º grado"], [7, "en 7.º grado"],
    ["not a senior", "en not a senior grado"], ["año 10", "en año 10 grado"], ["10  grado", "en 10.º grado"], ["grado  10", "en 10.º grado"],
    ["10 grade grado", "en 10 grade grado"], ["la grado 10", "en la grado 10"],
  ];
  for (const [raw, want] of cases) assert.equal(ES.grade(raw), want, JSON.stringify(raw));
});

test("split() reads the Asunto line, like L.splitMessage reads Subject", () => {
  assert.deepEqual(ES.split("Asunto: Hola\n\nCuerpo\n\nFin"), { subject: "Hola", body: "Cuerpo\n\nFin" });
  assert.deepEqual(ES.split("Asunto:   Con espacios\n\nB"), { subject: "Con espacios", body: "B" });
  assert.deepEqual(ES.split("Hola, sin asunto."), { subject: "", body: "Hola, sin asunto." });
  assert.deepEqual(ES.split("Asunto: sin cuerpo"), { subject: "", body: "Asunto: sin cuerpo" });
  assert.deepEqual(ES.split("Subject: English\n\nB"), { subject: "", body: "Subject: English\n\nB" }, "only the Spanish word");
  assert.deepEqual(ES.split("Hola\nAsunto: X\n\nB"), { subject: "", body: "Hola\nAsunto: X\n\nB" }, "only at the very start");
});

test("msg() builds the five lines in Spanish, with usted, for a text and for an email", () => {
  const args = ["Sra. López", "Maya", ES.grade("10"), "Davis High", "Estoy en el grupo de jóvenes con su hijo.", "la odontología", ES.ask.call];
  const text = ES.msg("text", ...args, " este sábado");
  assert.equal(text, "Hola, Sra. López. Soy Maya y estoy en 10.º grado en Davis High. Estoy en el grupo de jóvenes con su hijo. Me interesa la odontología. ¿Podríamos hablar 15 minutos este sábado? No hay problema si no tiene tiempo. ¡Gracias!");
  const email = ES.msg("email", ...args, "");
  const parts = ES.split(email);
  assert.equal(parts.subject, "Una pregunta de Maya, estudiante de Davis High");
  assert.equal(parts.body, "Hola, Sra. López:\n\nMe llamo Maya y estoy en 10.º grado en Davis High. Estoy en el grupo de jóvenes con su hijo.\n\nMe interesa la odontología. ¿Le podría hacer unas preguntas durante 15 minutos, por teléfono o en persona?\n\nNo hay problema si no tiene tiempo. ¡Gracias por leer esto!\n\nMaya");
  for (const m of [text, email]) {
    assert.deepEqual(L.blanksLeft(m), []);
    assert.ok((parts.body.match(/\S+/g) || []).length <= 90, "a filled message is under the 90 word check");
    assert.equal((m.match(/¿/g) || []).length, (m.match(/\?/g) || []).length, "every question opens with ¿");
  }
  const blank = ES.msg("email", "[su nombre]", "[tu nombre]", ES.grade(""), "[escuela]", "[cómo lo conoces].", "[lo que te da curiosidad]", ES.ask.help, "");
  assert.deepEqual(L.blanksLeft(blank), ["[tu nombre]", "[escuela]", "[su nombre]", "[grado]", "[cómo lo conoces]", "[lo que te da curiosidad]"]);
  for (const key of Object.keys(ES.ask)) {
    for (const fmt of ["text", "email"]) {
      const m = ES.msg(fmt, "Sr. Chen", "Sam", ES.grade("senior"), "Oakland Tech", "Vamos a la misma iglesia.", "el diseño", ES.ask[key], " en junio");
      assert.ok((ES.split(m).body.match(/\S+/g) || []).length <= 90, key + " " + fmt + " stays under 90 words");
      assert.match(m, / en junio\?/, "the when sits inside the question");
    }
  }
});

test("in a browser the file puts its words on TIG.es and keeps what lib.js and common.js already put on TIG", () => {
  const src = read("assets/js/es-playbook.js");
  const fresh = {};
  vm.runInNewContext(src, { self: fresh });
  assert.equal(typeof fresh.TIG.es.t, "function", "no TIG yet: the file makes one");
  assert.equal(fresh.TIG.es.t("Name"), "Nombre");
  const page = { TIG: { lib: L, toast() {} } };
  const sandbox = { self: page };
  vm.runInNewContext(src, sandbox);
  assert.equal(page.TIG.lib, L, "lib.js stays");
  assert.equal(typeof page.TIG.toast, "function", "common.js stays");
  assert.equal(page.TIG.es.grade("9"), "en 9.º grado");
  assert.equal(sandbox.TIG, undefined, "it uses self (the window), not the script's own this");
});
