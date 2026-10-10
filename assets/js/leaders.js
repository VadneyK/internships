/* Leaders kit: fill-in sheets that print one at a time. Group details are saved on this device only. No names of teens or adults are collected. */
(function () {
  "use strict";
  var G = window.TIG;
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = ["gName", "gDate", "gPlace", "gLead", "gContact"];
  var saved = G.store.get("leader", {});
  FIELDS.forEach(function (id) { $(id).value = saved[id] || ""; });

  function v(id, fallback) { var x = $(id).value.trim(); return x || fallback; }
  function line(parts) { return parts.join("\n"); }

  function render() {
    var grp = v("gName", "[group name]"), date = v("gDate", "[date and time]"), place = v("gPlace", "[place]");
    var lead = v("gLead", "[leader name]"), contact = v("gContact", "[phone or email]");

    $("outParent").textContent = line([
      "Dear parents and guardians,", "",
      grp + " is hosting a Career Connections Night for teens on " + date + " at " + place + ".", "",
      "Adults from our community will sit at small tables and tell teens what they do and how they got started. Teens will ask questions, practice introducing themselves, and begin a thank-you or follow-up message.", "",
      "How we keep it safe:",
      "- Teens meet adults in small groups in one room, with other adults in sight. No one-on-one meetings.",
      "- Guests are welcomed and accompanied by one of our leaders for the whole evening.",
      "- No private messages between adults and teens. Teens send follow-up notes through a parent or our group, and a leader reads them first.", "",
      "What you can do:",
      "- Talk with your teen about the adults you both know. A neighbor, a coworker, a coach or a shop owner counts.",
      "- Read your teen's message before it is sent.",
      "- If your work might interest teens, tell us. We would love to have you at a table.", "",
      "Questions? Contact " + lead + " at " + contact + ".", "",
      "[If your group's policy requires a permission slip, add your wording here.]"
    ]);

    $("outGuest").textContent = line([
      "GUEST BRIEFING: " + grp, "",
      "Thank you for coming on " + date + " at " + place + ". Please arrive 15 minutes early and ask for " + lead + ".", "",
      "What to expect:",
      "- About 90 minutes. You will sit at a table with 5 or 6 teens. Teens rotate; you stay put.",
      "- Share for 2 or 3 minutes: what you do, how you got started, and one thing you wish you had known at 16. Then take their questions.",
      "- Be real. Teens like honest answers, including about mistakes and detours.", "",
      "Ground rules:",
      "- A leader from our group stays with you for the whole visit.",
      "- Stay at your table and in the room. Do not leave with a teen or take a teen anywhere.",
      "- Do not trade phone numbers, social media or private messages with individual teens.",
      "- If a teen asks about a job, say: \"Send a message through the group and I would be glad to help.\"",
      "- If a teen asks to talk privately, say: \"Let's ask a leader to join us.\"",
      "- If anything worries you, tell a leader right away. No photos, please.", "",
      "Questions before the night: " + lead + ", " + contact + "."
    ]);

    $("outSignup").textContent = line([
      "ADULT SIGN-UP: " + grp + " Career Connections Night", "",
      "Name: ____________________________________________",
      "Phone or email: ____________________________________",
      "What I do for work: __________________________________",
      "How long I have done it: ______________________________", "",
      "I can help by (check any):",
      "[ ] Sitting at a table with a small group of teens on " + date,
      "[ ] Giving a short talk to the whole group",
      "[ ] Hosting a visit to my workplace for a group with a leader present",
      "[ ] Serving as a reference for a teen I have supervised", "",
      "I understand that:",
      "- I will meet teens only in groups with other adults present and a leader with me.",
      "- I will follow " + grp + "'s child-protection policy.",
      "- My details stay with " + lead + " and are not posted online.", "",
      "Signature: ____________________   Date: ______________"
    ]);

    $("outEval").textContent = line([
      "CAREER CONNECTIONS NIGHT: QUICK CARD (no name needed)", "",
      "The best thing I learned tonight: ______________________________",
      "____________________________________________________________", "",
      "One job I want to learn more about: ______________________________", "",
      "One thing I will do this week: __________________________________", "",
      "How useful was tonight?   1   2   3   4   5", "",
      "What should we change next time? _______________________________",
      "____________________________________________________________"
    ]);
  }

  function renderRef() {
    var t = v("rTeen", "[teen's first name]"), w = v("rWriter", "[your name and title]");
    var known = v("rKnown", "[how you know them and for how long]"), job = v("rJob", "[the job or role]");
    var story = v("rStory", "[one true story of what you saw them do]"), q = v("rQuality", "[two or three words]");
    function end(s) { return /[.!?]$/.test(s) ? s : s + "."; }
    $("outRef").textContent = line([
      "To whom it may concern,", "",
      "I am writing to recommend " + t + " for " + job + ".", "",
      end(known.charAt(0).toUpperCase() + known.slice(1)), "",
      end(story.charAt(0).toUpperCase() + story.slice(1)) + " That showed me that " + t + " is " + q + ".", "",
      "[Add anything else you saw yourself. Say only what is true.]", "",
      "You can reach me at [phone or email].", "",
      "Sincerely,", w
    ]);
  }

  /* One short, debounced note for screen readers instead of re-reading the whole letter on each keystroke. */
  var refTimer;
  function onRefEdit() {
    renderRef();
    clearTimeout(refTimer);
    refTimer = setTimeout(function () { $("refStatus").textContent = "Letter updated."; }, 800);
  }

  function save() {
    var o = {}; FIELDS.forEach(function (id) { o[id] = $(id).value; }); G.store.set("leader", o);
  }
  FIELDS.forEach(function (id) { $(id).addEventListener("input", function () { save(); render(); }); });
  ["rTeen", "rWriter", "rKnown", "rJob", "rStory", "rQuality"].forEach(function (id) { $(id).addEventListener("input", onRefEdit); });

  document.addEventListener("click", function (e) {
    var p = e.target.closest("[data-print]");
    if (p) { var el = $(p.getAttribute("data-print")); G.printOnly(el, p.getAttribute("data-title") || "Print"); return; }
    var c = e.target.closest("[data-copy]");
    if (c) { G.copy($(c.getAttribute("data-copy")).textContent); }
  });
  $("clearLeader").addEventListener("click", function () {
    G.store.set("leader", {});
    FIELDS.concat(["rTeen", "rWriter", "rKnown", "rJob", "rStory", "rQuality"]).forEach(function (id) { $(id).value = ""; });
    render(); renderRef(); G.toast("Cleared");
  });
  render(); renderRef();
})();
