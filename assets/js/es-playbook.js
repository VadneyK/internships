/*
  Spanish words for the Playbook tools (the people map and the five-line message builder), for es/playbook.html only (ADR 0008).
  playbook.js passes each English string through t(); English pages never load this file, so they carry none of its bytes.
  In the messages the teen writes to adults with usted. Draft wording, waiting for review by a fluent speaker.
  Works in the browser as window.TIG.es and in Node as module.exports (tests/es-playbook.test.mjs).
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else { root.TIG = root.TIG || {}; root.TIG.es = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* Every t("...") in playbook.js has a row here, and every row is used there (tests/es-playbook.test.mjs checks both ways). */
  var WORDS = {
    "Person ": "Persona ",
    "Status for person ": "Estado de la persona ",
    "Name": "Nombre",
    "Mrs. Lee": "Sra. López",
    "What they do": "En qué trabaja",
    "dentist": "dentista",
    "How I know them (one sentence)": "Cómo lo conozco (una oración)",
    "I'm in youth group with her son.": "Estoy en el grupo de jóvenes con su hijo.",
    "Write to them": "Escribirle",
    "Add a name to write to them.": "Escribe un nombre para poder escribirle.",
    "Sent ": "Enviado el ",
    "Time to follow up.": "Ya es hora de hacer seguimiento.",
    "Follow up on ": "Haz seguimiento el ",
    "Add to my calendar": "Agregar a mi calendario",
    "Say thank you within 1 to 2 days, then ask for the 15 minutes.": "Dale las gracias en 1 a 2 días y después pídele los 15 minutos.",
    "Pick two questions to ask. See step 4 below.": "Elige dos preguntas para hacerle. Mira el paso 4 más abajo.",
    "Nice. Check in again in a few months with one line about what you did.": "¡Muy bien! Vuelve a escribirle en unos meses con una línea sobre lo que hiciste.",
    " of ": " de ",
    " sent": " enviados",
    "Follow up with ": "Haz seguimiento con ",
    " now.": " ahora.",
    "Next follow-up: ": "Próximo seguimiento: ",
    " on ": " el ",
    "Pick from your map, or type below": "Elige de tu mapa o escribe abajo",
    "follow-up-": "seguimiento-",
    "person": "persona",
    "Send one short follow-up note. If there is no reply, move on to the next name on your list.": "Envía una nota corta de seguimiento. Si no te responde, pasa al siguiente nombre de tu lista.",
    "Calendar file saved. Open it to add the reminder.": "Se guardó el archivo del calendario. Ábrelo para agregar el recordatorio.",
    "Clear all your people and your details from this device?": "¿Borrar de este aparato todas tus personas y tus datos?",
    "Cleared": "Borrado",
    "MY PEOPLE MAP": "MI MAPA DE PERSONAS",
    " messages sent": " mensajes enviados",
    ", follow up ": ", seguimiento el ",
    "Private to your device. Not an official Ignition publication.": "Privado en tu aparato. No es una publicación oficial de Ignition.",
    "my-people-map.png": "mi-mapa-de-personas.png",
    "Image saved to your device": "La imagen se guardó en tu aparato",
    "[their name]": "[su nombre]",
    "[your name]": "[tu nombre]",
    "[school]": "[escuela]",
    "[how you know them]": "[cómo lo conoces]",
    "[what you are curious about]": "[lo que te da curiosidad]",
    "Fill in before you send: ": "Completa antes de enviar: ",
    " words": " palabras",
    "Short enough to read in about 20 seconds (under 90 words)": "Es tan corto que se lee en unos 20 segundos (menos de 90 palabras)",
    "Says who you are: name, grade, school": "Dice quién eres: nombre, grado y escuela",
    "Says how you know them": "Dice cómo lo conoces",
    "Says what you are curious about": "Dice qué te da curiosidad",
    "One small ask with a limit (like 15 minutes or one afternoon)": "Un pedido pequeño con un límite (como 15 minutos o una tarde)",
    "Makes it easy to say no, and says thank you": "Hace que sea fácil decir que no, y da las gracias",
    " (done)": " (listo)",
    " (not yet)": " (todavía no)",
    "Message updated. ": "Mensaje actualizado. ",
    " word.": " palabra.",
    " words.": " palabras.",
    "My message": "Mi mensaje",
    "Marked as sent. Follow-up reminder set for one week.": "Marcado como enviado. Tu seguimiento queda para dentro de una semana.",
    "Added to your map and marked as sent. Follow-up reminder set for one week.": "Se agregó a tu mapa y se marcó como enviado. Tu seguimiento queda para dentro de una semana."
  };
  function t(s) { return Object.prototype.hasOwnProperty.call(WORDS, s) ? WORDS[s] : s; }

  /* Same keys and order as L.STATUSES. */
  var STATUSES = [
    ["", "Sin enviar"], ["sent", "Enviado"], ["replied", "Te respondió"], ["meeting", "Reunión acordada"], ["thanked", "Ya le di las gracias"]
  ];

  /* The how-chips: [chip label, the sentence it puts in the message]. Addressed to the adult with usted. */
  var HOWS = [
    ["Mi mamá o mi papá trabaja con usted", "Mi mamá/papá, ____, trabaja con usted."],
    ["Misma iglesia", "Vamos a la misma iglesia."],
    ["Conoce a mi familia", "Usted conoce a mi familia."],
    ["Me da clases o me entrena", "Estoy en su clase."],
    ["Compro en su negocio", "Voy a su negocio con mi familia."]
  ];

  /* The asks, keyed like the #fAsk options: [for an email, for a text]. Each opens the question with ¿; the message closes it. */
  var ASK = {
    call: ["¿Le podría hacer unas preguntas durante 15 minutos, por teléfono o en persona", "¿Podríamos hablar 15 minutos"],
    shadow: ["¿Podría pasar una tarde con usted para ver cómo es un día de trabajo", "¿Podría pasar una tarde con usted"],
    email: ["¿Me podría contestar tres preguntas cortas por correo electrónico", "¿Le puedo enviar tres preguntas cortas por correo"],
    help: ["¿Podría ayudar unas horas como voluntario", "¿Podría ayudar unas horas"],
    advice: ["¿Me podría dar consejos para empezar, en una charla de 15 minutos", "¿Me podría dar consejos en 15 minutos"]
  };

  /* Short months, like the English "Oct 17, 2026", so a sent card's status still fits on one line of the plan image (40 characters). */
  var MESES = ["ene.", "feb.", "mar.", "abr.", "mayo", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];
  /* "17 oct. 2026"; "" for a bad date, like L.fmtDate */
  function date(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    return d.getDate() + " " + MESES[d.getMonth()] + " " + d.getFullYear();
  }

  /* The words after "estoy" in a message, from the grade a teen typed. Like L.gradePhrase:
     "10", "10th", "10mo", "10.º", "grado 10" and "10 grade" give "en 10.º grado"; freshman to senior give 9.º to 12.º.
     Anything else is kept as typed, with " grado" added unless it already has the word grado ("décimo" gives "en décimo grado"). */
  var CLASSES = { freshman: 9, sophomore: 10, junior: 11, senior: 12 };
  function grade(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (!s) return "en [grado]";
    var cls = /^(freshman|sophomore|junior|senior)$/i.exec(s);
    var num = /^(\d{1,2})\s*(?:st|nd|rd|th|[rdtvmn]?o|\.?[º°])?\.?(?:\s+(?:grado|grade))?$/i.exec(s.replace(/^(?:grado|grade)\s+/i, ""));
    var n = cls ? CLASSES[cls[1].toLowerCase()] : num ? +num[1] : 0;
    if (n >= 1 && n <= 12) return "en " + n + ".º grado";
    if (/\bgrado\b/i.test(s)) return "en " + s;
    return "en " + s + " grado";
  }

  /* Split "Asunto: ...\n\nbody" into parts, like L.splitMessage. */
  function split(msg) {
    var m = /^Asunto:\s*(.*)\n\n([\s\S]*)/.exec(msg);
    return m ? { subject: m[1], body: m[2] } : { subject: "", body: msg };
  }

  /* The message itself. fmt is "text" or "email"; how ends in . ! or ?; ask is one ASK pair; when is "" or " " + when. */
  function msg(fmt, to, me, phrase, school, how, cur, ask, when) {
    if (fmt === "text") return "Hola, " + to + ". Soy " + me + " y estoy " + phrase + " en " + school + ". " + how + " Me interesa " + cur + ". " + ask[1] + when + "? No hay problema si no tiene tiempo. ¡Gracias!";
    return "Asunto: Una pregunta de " + me + ", estudiante de " + school + "\n\nHola, " + to + ":\n\nMe llamo " + me + " y estoy " + phrase + " en " + school + ". " + how +
      "\n\nMe interesa " + cur + ". " + ask[0] + when + "?\n\nNo hay problema si no tiene tiempo. ¡Gracias por leer esto!\n\n" + me;
  }

  return { t: t, WORDS: WORDS, statuses: STATUSES, hows: HOWS, ask: ASK, date: date, grade: grade, split: split, msg: msg };
});
