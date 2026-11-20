// SVG icons for the Stream Deck keys (144x144).
// Deliberately simple shapes so the Stream Deck's SVG renderer draws everything correctly.
"use strict";

const COL = {
  bg: "rgb(16,18,22)",
  off: "rgb(205,210,218)",
  na: "rgb(62,65,72)",
  naText: "rgb(80,84,92)",
  green: "rgb(46,214,96)",
  blue: "rgb(64,150,255)",
  amber: "rgb(255,176,32)",
  red: "rgb(240,64,56)",
  white: "rgb(240,242,246)",
  dimGreen: "rgb(28,110,52)",
  grey: "rgb(150,155,165)",
};

const TINT = {
  [COL.green]: "rgb(14,46,26)",
  [COL.blue]: "rgb(14,32,58)",
  [COL.amber]: "rgb(58,40,8)",
  [COL.red]: "rgb(60,16,14)",
  [COL.white]: "rgb(40,44,52)",
  [COL.dimGreen]: "rgb(14,30,20)",
  [COL.grey]: "rgb(36,38,44)",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function text(x, y, s, size, color, weight = "bold") {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle">${esc(s)}</text>`;
}

// ---------------------------------------------------------------- symbols
const SYM = {
  arrowL: (c) => `<polygon points="20,58 60,22 60,42 108,42 108,74 60,74 60,94" fill="${c}"/>`,
  arrowR: (c) => `<polygon points="124,58 84,22 84,42 36,42 36,74 84,74 84,94" fill="${c}"/>`,
  hazard: (c) =>
    `<polygon points="72,16 120,98 24,98" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round"/>` +
    `<polygon points="72,48 94,86 50,86" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`,
  lamp: (c) => `<path d="M 84 28 C 124 28 124 90 84 90 Z" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/>`,
  lowbeam: (c) =>
    SYM.lamp(c) +
    [34, 48, 62, 76].map((y) => `<line x1="72" y1="${y}" x2="34" y2="${y + 12}" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`).join(""),
  highbeam: (c) =>
    SYM.lamp(c) +
    [34, 48, 62, 76, 90].slice(0, 4).map((y) => `<line x1="72" y1="${y + 2}" x2="30" y2="${y + 2}" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`).join(""),
  fog: (c) =>
    SYM.lamp(c) +
    [34, 48, 62, 76].map((y) => `<line x1="72" y1="${y}" x2="30" y2="${y + 8}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`).join("") +
    `<path d="M 52 24 q 9 8 0 17 q -9 8 0 17 q 9 8 0 17 q -9 8 0 17" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  car: (c, y = 0) =>
    `<path d="M 30 ${58 + y} L 30 ${46 + y} L 44 ${44 + y} L 54 ${30 + y} L 92 ${30 + y} L 102 ${44 + y} L 114 ${46 + y} L 114 ${58 + y} Z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="${60 + y}" r="7" fill="${c}"/><circle cx="94" cy="${60 + y}" r="7" fill="${c}"/>`,
  esc: (c) =>
    SYM.car(c, -6) +
    `<path d="M 50 70 c 14 6 -12 14 0 26" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M 94 70 c 14 6 -12 14 0 26" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
  chassis: (c, awd) => {
    const wheel = (x, y, driven) =>
      `<rect x="${x}" y="${y}" width="14" height="26" rx="4" fill="${driven ? c : "none"}" stroke="${c}" stroke-width="5"/>`;
    return (
      `<line x1="40" y1="34" x2="104" y2="34" stroke="${c}" stroke-width="6"/>` +
      `<line x1="40" y1="84" x2="104" y2="84" stroke="${c}" stroke-width="6"/>` +
      `<line x1="72" y1="34" x2="72" y2="84" stroke="${c}" stroke-width="6"/>` +
      wheel(26, 21, awd) + wheel(104, 21, awd) + wheel(26, 71, true) + wheel(104, 71, true)
    );
  },
  axle: (c, locked) =>
    `<line x1="34" y1="56" x2="110" y2="56" stroke="${c}" stroke-width="7"/>` +
    `<rect x="18" y="30" width="16" height="52" rx="5" fill="none" stroke="${c}" stroke-width="6"/>` +
    `<rect x="110" y="30" width="16" height="52" rx="5" fill="none" stroke="${c}" stroke-width="6"/>` +
    `<circle cx="72" cy="56" r="17" fill="${COL.bg}" stroke="${c}" stroke-width="6"/>` +
    (locked
      ? `<line x1="62" y1="46" x2="82" y2="66" stroke="${c}" stroke-width="6"/><line x1="82" y1="46" x2="62" y2="66" stroke="${c}" stroke-width="6"/>`
      : `<line x1="72" y1="42" x2="72" y2="70" stroke="${c}" stroke-width="5" stroke-dasharray="5,5"/>`),
  engine: (c) =>
    `<path d="M 26 46 L 34 46 L 34 38 L 48 38 L 48 30 L 82 30 L 82 38 L 96 38 L 104 46 L 110 46 L 110 40 L 118 40 L 118 76 L 110 76 L 110 70 L 104 70 L 94 84 L 52 84 L 46 76 L 34 76 L 34 84 L 26 84 Z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`,
  parkbrake: (c) =>
    `<circle cx="72" cy="58" r="28" fill="none" stroke="${c}" stroke-width="7"/>` +
    text(72, 72, "P", 38, c) +
    `<path d="M 34 26 A 44 44 0 0 0 34 90" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M 110 26 A 44 44 0 0 1 110 90" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`,
  abs: (c) =>
    `<circle cx="72" cy="56" r="30" fill="none" stroke="${c}" stroke-width="6"/>` +
    text(72, 66, "ABS", 24, c) +
    `<path d="M 32 26 A 44 44 0 0 0 32 86" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M 112 26 A 44 44 0 0 1 112 86" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
  horn: (c) =>
    `<path d="M 26 46 L 44 46 L 82 22 L 82 94 L 44 70 L 26 70 Z" fill="${c}"/>` +
    `<path d="M 94 42 Q 102 58 94 74" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M 106 32 Q 120 58 106 84" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
  bolt: (c) => `<polygon points="82,14 44,62 68,62 58,100 100,48 76,48" fill="${c}"/>`,
  wrench: (c) =>
    `<path d="M 96 18 A 24 24 0 0 0 74 50 L 28 96 A 9 9 0 0 0 40 108 L 86 62 A 24 24 0 0 0 118 40 L 104 50 L 92 46 L 88 34 L 98 20 Z" fill="${c}"/>`,
  pinSave: (c) =>
    `<path d="M 60 104 L 60 18" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M 60 20 L 104 32 L 60 46 Z" fill="${c}"/>` +
    `<ellipse cx="60" cy="104" rx="26" ry="7" fill="none" stroke="${c}" stroke-width="5"/>` +
    `<path d="M 104 70 L 104 98 M 90 84 L 118 84" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`,
  pinLoad: (c) =>
    `<path d="M 88 104 L 88 18" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M 88 20 L 124 32 L 88 46 Z" fill="${c}"/>` +
    `<ellipse cx="88" cy="104" rx="24" ry="7" fill="none" stroke="${c}" stroke-width="5"/>` +
    `<path d="M 20 76 L 64 76 M 50 62 L 64 76 L 50 90" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  camera: (c) =>
    `<rect x="22" y="36" width="78" height="52" rx="8" fill="none" stroke="${c}" stroke-width="7"/>` +
    `<polygon points="100,52 124,38 124,86 100,72" fill="${c}"/>` +
    `<circle cx="61" cy="62" r="13" fill="none" stroke="${c}" stroke-width="6"/>`,
  nos: (c) =>
    `<rect x="50" y="34" width="44" height="72" rx="12" fill="none" stroke="${c}" stroke-width="7"/>` +
    `<rect x="62" y="18" width="20" height="16" rx="3" fill="${c}"/>` +
    text(72, 80, "N2O", 14, c),
  rocket: (c) =>
    `<path d="M 72 12 Q 96 34 92 74 L 52 74 Q 48 34 72 12 Z" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>` +
    `<circle cx="72" cy="44" r="8" fill="${c}"/>` +
    `<path d="M 52 60 L 36 84 L 54 78 M 92 60 L 108 84 L 90 78" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round"/>` +
    `<path d="M 60 82 Q 72 108 84 82" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
  selector: (c) =>
    SYM.car(c, 6) +
    `<rect x="24" y="16" width="96" height="10" rx="4" fill="${c}"/>` +
    `<rect x="24" y="32" width="64" height="8" rx="4" fill="${c}"/>`,
  walk: (c) =>
    `<rect x="18" y="18" width="46" height="84" rx="6" fill="none" stroke="${c}" stroke-width="6"/>` +
    `<circle cx="92" cy="28" r="10" fill="${c}"/>` +
    `<path d="M 90 42 L 84 72 L 100 100 M 84 72 L 70 98 M 88 50 L 106 64 M 88 50 L 72 60" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  pump: (c) =>
    `<rect x="34" y="26" width="44" height="66" rx="5" fill="none" stroke="${c}" stroke-width="6"/>` +
    `<rect x="42" y="34" width="28" height="18" fill="${c}"/>` +
    `<path d="M 78 44 L 92 44 L 102 54 L 102 82 Q 102 90 94 90 Q 88 90 88 82 L 88 62" fill="none" stroke="${c}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`,
};

// ---------------------------------------------------------------- key layout
// state: "na" (not available / greyed out), "off", "on", "dim" (blink phase off), "warn"
function key({ body = "", label = "", labelColor, border, bg, sub = "", subColor, labelSize = 20 }) {
  const b = border ? `<rect x="3" y="3" width="138" height="138" rx="18" fill="none" stroke="${border}" stroke-width="4"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<rect x="0" y="0" width="144" height="144" rx="20" fill="${bg || COL.bg}"/>` +
    b +
    body +
    (sub ? text(72, 112, sub, 18, subColor || labelColor || COL.off, "bold") : "") +
    (label ? text(72, 134, label, labelSize, labelColor || COL.off) : "") +
    `</svg>`
  );
}

// default key: symbol + label, colour depends on state
function simple(symFn, label, state, onColor, opts = {}) {
  let c, bg, border, lc;
  if (state === "na") { c = COL.na; lc = COL.naText; }
  else if (state === "on") { c = onColor; bg = TINT[onColor]; border = onColor; lc = onColor; }
  else if (state === "dim") { c = COL.dimGreen; bg = TINT[COL.dimGreen]; border = COL.dimGreen; lc = COL.green; }
  else { c = COL.off; lc = COL.off; }
  return key({ body: symFn(c), label, labelColor: lc, bg, border, ...opts });
}

// value key: big value + small label, optional level bar
function valueKey({ title, value, label, state, color = COL.white, levels, levelIdx, valueSize = 40 }) {
  let c = color, bg, border, lc = COL.off;
  if (state === "na") { c = COL.na; lc = COL.naText; }
  else if (state === "on") { bg = TINT[color] || undefined; border = color; lc = color; }
  else if (state === "warn") { c = COL.amber; bg = TINT[COL.amber]; border = COL.amber; lc = COL.amber; }
  let body = "";
  if (title) body += text(72, 34, title, 24, state === "na" ? COL.na : COL.off);
  body += text(72, title ? 82 : 76, value, valueSize, c);
  if (levels && levels > 1 && state !== "na") {
    const w = 104, gap = 3, seg = (w - gap * (levels - 1)) / levels;
    for (let i = 0; i < levels; i++) {
      const x = 20 + i * (seg + gap);
      body += `<rect x="${x.toFixed(1)}" y="96" width="${seg.toFixed(1)}" height="8" rx="2" fill="${i < levelIdx ? c : COL.na}"/>`;
    }
  }
  return key({ body, label, labelColor: lc, bg, border });
}

function plusMinusKey(title, sign, state, extra) {
  const c = state === "na" ? COL.na : COL.off;
  const body =
    text(72, 40, title, 26, c) +
    text(72, 100, sign, 64, state === "na" ? COL.na : COL.white);
  return key({ body, label: extra || "", labelColor: state === "na" ? COL.naText : COL.off });
}

function toDataUrl(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

module.exports = { COL, SYM, key, simple, valueKey, plusMinusKey, text, toDataUrl };
