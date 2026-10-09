import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, type } from "./dom-helper.mjs";

const FIELD_IDS = ["gName", "gDate", "gPlace", "gLead", "gContact"];
const REF_IDS = ["rTeen", "rWriter", "rKnown", "rJob", "rStory", "rQuality"];
const SHEETS = ["outParent", "outGuest", "outSignup", "outEval", "outRef"];
const DASH = /[–—]/; // en dash and em dash, written as escapes

const GROUP = {
  gName: "Hillside Youth Group",
  gDate: "Friday, Nov 14, 6:30 to 8:00 pm",
  gPlace: "Fellowship hall, 123 Main St.",
  gLead: "Pastor Kim",
  gContact: "office@example.org",
};
const BLANK_GROUP = { gName: "", gDate: "", gPlace: "", gLead: "", gContact: "" };
const REF = {
  rTeen: "Maya",
  rWriter: "Ana Lopez, Nursery Lead",
  rKnown: "I supervised Maya in the nursery for 14 months",
  rJob: "a summer camp counselor job",
  rStory: "One Sunday two toddlers were crying at once. Maya sat down, calmed one, and signaled me to take the other.",
  rQuality: "calm, reliable, kind",
};

function fill(page, values) {
  for (const [id, val] of Object.entries(values)) type(page.window, page.document.getElementById(id), val);
}

test("leaders: loads with no script errors and all five sheets render", async () => {
  const { document, errors } = await loadPage("leaders.html");
  assert.deepEqual(errors, []);
  for (const id of SHEETS) assert.ok(document.getElementById(id).textContent.trim().length > 0, id + " should render");
  assert.equal(document.querySelectorAll("[data-print]").length, 5);
});

test("leaders: group details fill the parent note, guest briefing and sign-up sheet", async () => {
  const p = await loadPage("leaders.html");
  fill(p, GROUP);
  const out = (id) => p.document.getElementById(id).textContent;

  const parent = out("outParent");
  for (const id of FIELD_IDS) assert.ok(parent.includes(GROUP[id]), "parent note should include " + GROUP[id]);

  const guest = out("outGuest");
  for (const id of FIELD_IDS) assert.ok(guest.includes(GROUP[id]), "guest briefing should include " + GROUP[id]);

  const signup = out("outSignup");
  for (const id of ["gName", "gDate", "gLead"]) assert.ok(signup.includes(GROUP[id]), "sign-up sheet should include " + GROUP[id]);

  for (const id of SHEETS.slice(0, 3)) assert.doesNotMatch(out(id), /\[group name\]|\[leader name\]/, id + " should show no placeholder once filled");
});

test("leaders: blank group fields show bracketed placeholders, never undefined or NaN", async () => {
  const p = await loadPage("leaders.html");
  const expected = {
    outParent: ["[group name]", "[date and time]", "[place]", "[leader name]", "[phone or email]"],
    outGuest: ["[group name]", "[date and time]", "[place]", "[leader name]", "[phone or email]"],
    outSignup: ["[group name]", "[date and time]", "[leader name]"],
  };
  const check = (label) => {
    for (const [id, marks] of Object.entries(expected)) {
      const text = p.document.getElementById(id).textContent;
      for (const m of marks) assert.ok(text.includes(m), label + ": " + id + " should show " + m);
      assert.doesNotMatch(text, /undefined|NaN/, label + ": " + id);
    }
  };
  check("first load");

  fill(p, GROUP);
  fill(p, BLANK_GROUP);
  check("after clearing the fields by typing");
});

test("leaders: group details are remembered across a reload under the 'leader' key", async () => {
  const a = await loadPage("leaders.html");
  fill(a, GROUP);
  const raw = a.window.localStorage.getItem("leader");
  assert.ok(raw, "details should be stored under 'leader'");
  assert.deepEqual(JSON.parse(raw), GROUP);

  const b = await loadPage("leaders.html", { rawStorage: { leader: raw } });
  for (const id of FIELD_IDS) assert.equal(b.document.getElementById(id).value, GROUP[id], id + " should be restored");
  assert.ok(b.document.getElementById("outParent").textContent.includes("Hillside Youth Group is hosting"));
});

test("leaders: the clear button empties every field and the stored value", async () => {
  const a = await loadPage("leaders.html", { storage: { leader: GROUP } });
  fill(a, REF);
  assert.equal(a.document.getElementById("gName").value, GROUP.gName, "saved details should load first");
  assert.match(a.document.getElementById("clearLeader").textContent, /Clear everything I typed on this page/);

  a.document.getElementById("clearLeader").click();

  for (const id of [...FIELD_IDS, ...REF_IDS]) assert.equal(a.document.getElementById(id).value, "", id + " should be empty");
  const stored = JSON.parse(a.window.localStorage.getItem("leader"));
  assert.deepEqual(Object.values(stored).filter(Boolean), [], "no typed value should stay in storage");
  assert.ok(a.document.getElementById("outParent").textContent.includes("[group name]"));
  assert.ok(a.document.getElementById("outRef").textContent.includes("[teen's first name]"));

  const b = await loadPage("leaders.html", { rawStorage: { leader: a.window.localStorage.getItem("leader") } });
  for (const id of FIELD_IDS) assert.equal(b.document.getElementById(id).value, "", id + " should stay empty after reload");
});

test("leaders: the reference letter carries the story and the 'That showed me that' line", async () => {
  const p = await loadPage("leaders.html");
  fill(p, REF);
  const letter = p.document.getElementById("outRef").textContent;
  assert.ok(letter.includes(REF.rStory), "letter should contain the story text");
  assert.ok(letter.includes("That showed me that Maya is calm, reliable, kind."));
  assert.ok(letter.includes("I am writing to recommend Maya for a summer camp counselor job."));
  assert.doesNotMatch(letter, /undefined|NaN/);
});

test("leaders: blank reference fields give bracketed placeholders", async () => {
  const p = await loadPage("leaders.html");
  const letter = p.document.getElementById("outRef").textContent;
  for (const ph of [
    "[teen's first name]",
    "[your name and title]",
    "[how you know them and for how long]",
    "[the job or role]",
    "[one true story of what you saw them do]",
    "[two or three words]",
  ]) assert.ok(letter.includes(ph), "letter should show " + ph);
  assert.ok(letter.includes("That showed me that [teen's first name] is [two or three words]."));
  assert.doesNotMatch(letter, /undefined|NaN/);
});

const PRINT_CASES = [
  ["outParent", "Dear parents and guardians"],
  ["outGuest", "GUEST BRIEFING"],
  ["outSignup", "ADULT SIGN-UP"],
  ["outEval", "QUICK CARD"],
  ["outRef", "To whom it may concern"],
];

test("leaders: each print button calls print only after print-one is set, with just its sheet in #printRoot, then cleans up", async () => {
  const { window, document, errors } = await loadPage("leaders.html");
  assert.deepEqual(errors, []);
  const buttons = [...document.querySelectorAll("[data-print]")];
  assert.equal(buttons.length, PRINT_CASES.length);
  const titleBefore = document.title;

  for (const [sheet, marker] of PRINT_CASES) {
    const btn = buttons.find((b) => b.getAttribute("data-print") === sheet);
    assert.ok(btn, "a print button for " + sheet);
    assert.equal(document.body.classList.contains("print-one"), false, "no print layer before " + sheet);
    assert.equal(document.getElementById("printRoot"), null, "no printRoot before " + sheet);

    const original = window.print;
    const calls = [];
    window.print = function () {
      const root = document.getElementById("printRoot");
      calls.push({
        bodyHasPrintOne: document.body.classList.contains("print-one"),
        rootChildCount: root ? root.children.length : -1,
        rootFirstId: root && root.firstElementChild ? root.firstElementChild.id : null,
        rootText: root ? root.textContent : "",
        title: document.title,
      });
    };
    btn.click();
    window.print = original;

    assert.equal(calls.length, 1, sheet + " should call print exactly once");
    const c = calls[0];
    assert.equal(c.bodyHasPrintOne, true, "body should have print-one when print is called for " + sheet);
    assert.equal(c.rootChildCount, 1, "printRoot should hold one sheet for " + sheet);
    assert.equal(c.rootFirstId, sheet, "printRoot should hold " + sheet);
    assert.ok(c.rootText.includes(marker), sheet + " print layer should include its text");
    assert.equal(c.title, btn.getAttribute("data-title"), "document title should be the sheet title during print");

    window.dispatchEvent(new window.Event("afterprint"));
    assert.equal(document.body.classList.contains("print-one"), false, "print-one removed after " + sheet);
    assert.equal(document.getElementById("printRoot"), null, "printRoot removed after " + sheet);
    assert.equal(document.title, titleBefore, "title restored after " + sheet);
  }
});

test("leaders: the four series weeks carry the pastor placeholder and no scripture references", async () => {
  const { document } = await loadPage("leaders.html");
  const weeks = [...document.querySelectorAll("#series article.card")];
  assert.equal(weeks.length, 4);
  for (const w of weeks) {
    assert.ok(w.textContent.includes("PLACEHOLDER FOR PASTOR"), w.querySelector("h3").textContent + " needs the placeholder");
  }
  const text = document.body.textContent;
  assert.doesNotMatch(text, /\b(Genesis|Exodus|Psalm|Proverbs|Matthew|Mark|Luke|John|Romans|Corinthians|Colossians|Philippians|James)\s+\d+:\d+/);
  assert.doesNotMatch(text, /\b(Gen|Exod?|Ps|Psa|Prov|Isa|Matt|Mk|Lk|Jn|Rom|Cor|Gal|Eph|Phil|Col|Heb|Jas|Rev)\.?\s+\d+:\d+/);
});

test("leaders: the safety section states the groups rule and cites at least four https sources with noopener", async () => {
  const { document } = await loadPage("leaders.html");
  const safe = document.getElementById("safe");
  assert.match(safe.textContent, /groups, not one-on-one/);
  const links = [...safe.querySelectorAll('a[href^="http"]')];
  assert.ok(links.length >= 4, "safety section should link at least four external sources, found " + links.length);
  for (const a of links) {
    assert.match(a.getAttribute("href"), /^https:\/\//, a.getAttribute("href"));
    assert.match(a.getAttribute("rel") || "", /noopener/, a.getAttribute("href") + " should have rel noopener");
  }
});

test("leaders: output sheets never contain an em dash or an en dash", async () => {
  const p = await loadPage("leaders.html");
  const check = (label) => {
    for (const id of SHEETS) assert.doesNotMatch(p.document.getElementById(id).textContent, DASH, label + ": " + id);
  };
  check("blank sheets");
  fill(p, GROUP);
  fill(p, REF);
  check("filled sheets");
});
