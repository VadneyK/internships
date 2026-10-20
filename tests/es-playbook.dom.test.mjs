// 2026-10-17: the Playbook tools on the Spanish page (es/playbook.html, ADR 0008): the people map and the five-line message
// builder run playbook.js with the Spanish words from es-playbook.js. These drive the page the way tests/playbook.dom.test.mjs
// and tests/playbook-coverage.test.mjs drive the English one, and check what a teen sees, saves and sends is in Spanish.
// Run with: node --test tests/es-playbook.dom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadPage, type, tick, waitFor } from "./dom-helper.mjs";

const require = createRequire(import.meta.url);
const ES = require("../assets/js/es-playbook.js");
const PAGE = "es/playbook.html";
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const esDate = (isoDay) => { const [y, m, d] = isoDay.split("-").map(Number); return ES.date(new Date(y, m - 1, d)); };
const readBlob = (window, blob) => new Promise((res) => { const fr = new window.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(blob); });
const toastText = (document) => document.getElementById("toast").textContent;
const text = (document, id) => document.getElementById(id).textContent;

// Records what the page saves: every a.click() on a download link, and the blob behind it.
function watchDownloads(window) {
  const saved = [];
  window.URL.createObjectURL = (b) => { saved.push({ blob: b }); return "blob:test"; };
  window.HTMLAnchorElement.prototype.click = function () { if (this.download) saved[saved.length - 1].name = this.download; };
  return saved;
}
// A stand-in for the browser's canvas: records the words drawn and hands back a small blob.
function canvasSetup(drawn) {
  return (w) => {
    w.HTMLCanvasElement.prototype.getContext = function () {
      return new Proxy({}, { get: (t, k) => (k === "fillText" ? (s) => drawn.push(s) : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    };
    w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(["png"], { type: "image/png" })); };
  };
}
// Every English string playbook.js would write, long enough not to match by chance. None may show on the Spanish page.
const ENGLISH = Object.keys(ES.WORDS).map((s) => s.trim()).filter((s) => s.length > 6);
function englishLeft(document) {
  const root = document.querySelector("main");
  const seen = [root.textContent, ...[...root.querySelectorAll("[placeholder], [aria-label]")].map((e) => (e.getAttribute("placeholder") || "") + " " + (e.getAttribute("aria-label") || ""))].join(" ");
  const whole = (s) => new RegExp("(^|[^\\p{L}])" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^\\p{L}])", "u"); // dentist is not inside dentista
  return ENGLISH.filter((s) => whole(s).test(seen));
}

test("es playbook: loads with no script errors, five person cards in Spanish and no English from playbook.js", async () => {
  const { document, errors } = await loadPage(PAGE);
  assert.deepEqual(errors, []);
  assert.equal(document.querySelectorAll(".person").length, 5);
  const card = document.querySelector(".person");
  assert.equal(card.querySelector(".ph b").textContent, "Persona 1");
  assert.equal(card.querySelector('label[for="ps0"]').textContent, "Estado de la persona 1");
  assert.deepEqual([...card.querySelectorAll(".field label")].map((l) => l.textContent), ["Nombre", "En qué trabaja", "Cómo lo conozco (una oración)"]);
  assert.equal(document.getElementById("pn0").placeholder, "Sra. López");
  assert.deepEqual([...document.getElementById("ps0").options].map((o) => o.textContent), ES.statuses.map((s) => s[1]));
  assert.equal(text(document, "pf0"), "Escribe un nombre para poder escribirle.");
  assert.equal(text(document, "planSummary"), "0 de 5 enviados");
  assert.equal(document.getElementById("fToSel").options[0].textContent, "Elige de tu mapa o escribe abajo");
  assert.deepEqual([...document.querySelectorAll("#howChips .chip")].map((b) => b.textContent), ES.hows.map((h) => h[0]));
  assert.equal(document.querySelectorAll("#checks li").length, 6);
  assert.match(document.querySelector("#checks li").textContent, /^✓Es tan corto que se lee en unos 20 segundos \(menos de 90 palabras\) \(listo\)$/);
  assert.equal(text(document, "wc").replace(/^\d+/, ""), " palabras");
  assert.deepEqual(englishLeft(document), []);
});

test("es playbook: an empty builder shows a Spanish letter and lists the blanks to fill in Spanish", async () => {
  const { document } = await loadPage(PAGE);
  const letter = text(document, "letter");
  assert.match(letter, /^Asunto: Una pregunta de \[tu nombre\], estudiante de \[escuela\]\n\nHola, \[su nombre\]:/);
  assert.match(letter, /estoy en \[grado\] en \[escuela\]/);
  const note = document.getElementById("blankNote");
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, "Completa antes de enviar: [tu nombre], [escuela], [su nombre], [grado], [cómo lo conoces], [lo que te da curiosidad]");
  assert.match(document.querySelector("#checks li:not(.ok) .sr").textContent, /todavía no/);
});

test("es playbook: Escribirle fills the builder, the email is Spanish with usted, and Ya lo envié starts the follow-up", async () => {
  const { window, document } = await loadPage(PAGE);
  type(window, document.getElementById("pn0"), "Sra. López");
  type(window, document.getElementById("ph0"), "es la mamá de mi amiga");
  document.querySelector('[data-write="0"]').click();
  await tick();
  assert.equal(document.querySelector('[data-write="0"]').textContent, "Escribirle");
  assert.equal(document.getElementById("fTo").value, "Sra. López");
  assert.equal(document.getElementById("fHow").value, "Es la mamá de mi amiga.");
  type(window, document.getElementById("fMe"), "Maya");
  type(window, document.getElementById("fGrade"), "10");
  type(window, document.getElementById("fSchool"), "Davis High");
  type(window, document.getElementById("fCurious"), "la odontología");
  const letter = text(document, "letter");
  assert.equal(letter, "Asunto: Una pregunta de Maya, estudiante de Davis High\n\nHola, Sra. López:\n\nMe llamo Maya y estoy en 10.º grado en Davis High. Es la mamá de mi amiga.\n\nMe interesa la odontología. ¿Le podría hacer unas preguntas durante 15 minutos, por teléfono o en persona?\n\nNo hay problema si no tiene tiempo. ¡Gracias por leer esto!\n\nMaya");
  assert.equal(document.getElementById("blankNote").hidden, true);
  assert.equal(document.querySelectorAll("#checks li.ok").length, 6, "every check passes");
  assert.match(document.querySelector("#checks li .sr").textContent, /listo/);
  const mail = new URL(document.getElementById("sendMail").href);
  assert.equal(mail.protocol, "mailto:");
  const q = new URLSearchParams(mail.search);
  assert.equal(q.get("subject"), "Una pregunta de Maya, estudiante de Davis High", "the Asunto line becomes the email subject");
  assert.match(q.get("body"), /^Hola, Sra\. López:/, "and is not repeated in the body");
  document.getElementById("markSent").click();
  assert.equal(text(document, "planSummary"), "1 de 5 enviados");
  const due = iso(new Date(Date.now() + 7 * 864e5));
  assert.equal(text(document, "pf0").replace(/\s+/g, " ").trim(), "EscribirleEnviado el " + ES.date(new Date()) + ". Haz seguimiento el " + esDate(due) + ". Agregar a mi calendario");
  assert.equal(text(document, "planNext"), "Próximo seguimiento: Sra. López el " + esDate(due) + ".");
  assert.equal(toastText(document), "Marcado como enviado. Tu seguimiento queda para dentro de una semana.");
  assert.deepEqual(englishLeft(document), []);
});

test("es playbook: a text message is Spanish, opens Messages, and each ask and how-chip writes Spanish", async () => {
  const { window, document } = await loadPage(PAGE, { storage: { me: { n: "Sam", g: "senior", s: "Oakland Tech" } } });
  type(window, document.getElementById("fFormat"), "text");
  type(window, document.getElementById("fTo"), "Sr. Chen");
  document.querySelector('#howChips [data-how="1"]').click();
  assert.equal(document.getElementById("fHow").value, "Vamos a la misma iglesia.");
  type(window, document.getElementById("fCurious"), "el diseño");
  type(window, document.getElementById("fWhen"), "este sábado");
  assert.equal(text(document, "letter"), "Hola, Sr. Chen. Soy Sam y estoy en 12.º grado en Oakland Tech. Vamos a la misma iglesia. Me interesa el diseño. ¿Podríamos hablar 15 minutos este sábado? No hay problema si no tiene tiempo. ¡Gracias!");
  assert.equal(document.getElementById("sendMail").hidden, true);
  assert.equal(document.getElementById("sendSms").hidden, false);
  assert.equal(decodeURIComponent(document.getElementById("sendSms").href.replace(/^sms:\?&body=/, "")), text(document, "letter"));
  for (const [key, pair] of Object.entries(ES.ask)) {
    type(window, document.getElementById("fAsk"), key);
    assert.ok(text(document, "letter").includes(pair[1] + " este sábado?"), key);
  }
  document.querySelector('#howChips [data-how="0"]').click();
  assert.equal(document.getElementById("blankNote").textContent, "Completa antes de enviar: ____", "the parent chip leaves a blank for the name");
});

test("es playbook: the people map is saved on the device and comes back in Spanish", async () => {
  const a = await loadPage(PAGE);
  type(a.window, a.document.getElementById("pn0"), "Sra. López");
  type(a.window, a.document.getElementById("pw0"), "dentista");
  type(a.window, a.document.getElementById("pn1"), "Sr. Chen");
  type(a.window, a.document.getElementById("ps1"), "replied");
  type(a.window, a.document.getElementById("fMe"), "Maya");
  const people = JSON.parse(a.window.localStorage.getItem("people"));
  assert.equal(people[0].n, "Sra. López");
  assert.equal(people[0].w, "dentista");
  assert.equal(people[1].s, "replied");
  const me = JSON.parse(a.window.localStorage.getItem("me"));
  const b = await loadPage(PAGE, { storage: { people, me } });
  assert.equal(b.document.getElementById("pn0").value, "Sra. López");
  assert.equal(b.document.getElementById("pw0").value, "dentista");
  assert.equal(b.document.getElementById("ps1").value, "replied");
  assert.equal(b.document.getElementById("fMe").value, "Maya");
  assert.equal(text(b.document, "planSummary"), "1 de 5 enviados");
  assert.match(text(b.document, "pf1"), /Dale las gracias en 1 a 2 días/);
  assert.deepEqual([...b.document.getElementById("fToSel").options].slice(1).map((o) => o.textContent), ["Sra. López (dentista)", "Sr. Chen"]);
});

test("es playbook: the status menu gives each Spanish hint, and a late follow-up says so", async () => {
  const { window, document } = await loadPage(PAGE, { storage: { people: [{ n: "Sam" }, { n: "Sra. López", s: "sent", d: daysAgo(10) }] } });
  const sel = document.getElementById("ps0");
  type(window, sel, "meeting");
  assert.equal(text(document, "pf0").replace("Escribirle", ""), "Elige dos preguntas para hacerle. Mira el paso 4 más abajo.");
  type(window, sel, "thanked");
  assert.match(text(document, "pf0"), /^Escribirle¡Muy bien! Vuelve a escribirle en unos meses/);
  assert.match(text(document, "pf1"), /Ya es hora de hacer seguimiento\./);
  assert.ok(document.querySelectorAll(".person")[1].classList.contains("is-due"));
  assert.equal(text(document, "planNext"), "Haz seguimiento con Sra. López ahora.");
});

test("es playbook: Guardar mi plan como imagen draws the map in Spanish and saves mi-mapa-de-personas.png", async () => {
  const drawn = [];
  const sent = daysAgo(10);
  const people = [{ n: "Sra. López", w: "dentista", h: "mi entrenadora", s: "sent", d: sent }, { n: "Sam", s: "replied" }, { n: "Ana", w: "enfermera" }, {}, {}];
  const { window, document } = await loadPage(PAGE, { storage: { people }, setup: canvasSetup(drawn) });
  const saved = watchDownloads(window);
  assert.equal(document.getElementById("planPng").textContent, "Guardar mi plan como imagen");
  document.getElementById("planPng").click();
  assert.ok(await waitFor(() => saved.length === 1 && toastText(document) === "La imagen se guardó en tu aparato"));
  assert.equal(saved[0].name, "mi-mapa-de-personas.png");
  const followUp = esDate(iso(new Date(Date.now() - 3 * 864e5)));
  assert.ok(drawn.includes("2 de 5 mensajes enviados   |   Próximo seguimiento: Sra. López, " + followUp), drawn.join(" / "));
  for (const t of ["MI MAPA DE PERSONAS", "Sra. López", "dentista  |  mi entrenadora", "Te respondió", "Sin enviar", "Enviado, seguimiento el " + followUp]) assert.ok(drawn.includes(t), t + " is drawn: " + drawn.join(" / "));
  assert.ok(drawn.some((s) => s.endsWith("Privado en tu aparato. No es una publicación oficial de Ignition.")));
});

test("es playbook: Agregar a mi calendario saves a Spanish reminder", async () => {
  const { window, document } = await loadPage(PAGE, { storage: { people: [{ n: "Sra. Lee", s: "sent", d: daysAgo(1) }] } });
  const saved = watchDownloads(window);
  document.querySelector("[data-ics='0']").click();
  assert.equal(saved[0].name, "seguimiento-sra-lee.ics");
  const ics = await readBlob(window, saved[0].blob);
  assert.match(ics, /SUMMARY:Haz seguimiento con Sra\. Lee/);
  assert.match(ics.replace(/\r\n /g, ""), /DESCRIPTION:Envía una nota corta de seguimiento\. Si no te responde\\, pasa al siguiente nombre de tu lista\./);
  assert.equal(toastText(document), "Se guardó el archivo del calendario. Ábrelo para agregar el recordatorio.");
});

test("es playbook: Borrar todo asks in Spanish, and Agregarlo a mi mapa adds and marks in Spanish", async () => {
  const asked = [];
  const { window, document } = await loadPage(PAGE, { storage: { people: [{ n: "Sam" }] }, setup: (w) => { w.confirm = (m) => { asked.push(m); return true; }; } });
  type(window, document.getElementById("fTo"), "Dra. Park");
  type(window, document.getElementById("fHow"), "Es la dentista de mi tía.");
  const add = document.getElementById("addMark");
  assert.equal(add.hidden, false);
  assert.equal(add.textContent, "Agregarlo a mi mapa y marcarlo como enviado");
  add.click();
  assert.equal(document.getElementById("pn1").value, "Dra. Park");
  assert.equal(toastText(document), "Se agregó a tu mapa y se marcó como enviado. Tu seguimiento queda para dentro de una semana.");
  document.getElementById("clearMap").click();
  assert.deepEqual(asked, ["¿Borrar de este aparato todas tus personas y tus datos?"]);
  assert.equal(toastText(document), "Borrado");
  assert.equal(document.getElementById("pn0").value, "");
});

test("es playbook: screen readers hear a short Spanish update, and Compartirlo shares with a Spanish title", async () => {
  const shared = [];
  const { window, document } = await loadPage(PAGE, { setup: (w) => { w.navigator.share = (d) => { shared.push(d); return Promise.resolve(); }; } });
  type(window, document.getElementById("fMe"), "Maya");
  const status = document.getElementById("letterStatus");
  assert.ok(await waitFor(() => status.textContent !== ""));
  assert.equal(status.textContent, "Mensaje actualizado. " + parseInt(text(document, "wc"), 10) + " palabras.");
  type(window, document.getElementById("fFormat"), "text");
  document.getElementById("shareMsg").click();
  assert.equal(shared[0].title, "Mi mensaje", "a text message has no Asunto, so the share sheet gets a Spanish title");
  type(window, document.getElementById("fFormat"), "email");
  document.getElementById("shareMsg").click();
  assert.equal(shared[1].title, "Una pregunta de Maya, estudiante de [escuela]");
  assert.doesNotMatch(shared[1].text, /^Asunto/);
});

test("es playbook: Add another person grows the map with Spanish cards", async () => {
  const { document } = await loadPage(PAGE);
  document.getElementById("addPerson").click();
  assert.equal(document.querySelectorAll(".person").length, 6);
  assert.equal(document.querySelectorAll(".person")[5].querySelector(".ph b").textContent, "Persona 6");
  assert.equal(document.activeElement.id, "pn5");
  assert.equal(document.getElementById("pn5").placeholder, "Sra. López");
  assert.equal(document.getElementById("ph5").placeholder, "Estoy en el grupo de jóvenes con su hijo.");
});
