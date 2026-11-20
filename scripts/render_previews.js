#!/usr/bin/env node
// Renders the README preview images straight from the plugin code, so they always
// match what the Stream Deck shows. Writes SVG files to docs/images/.
// Convert to PNG with:  for f in docs/images/*.svg; do rsvg-convert "$f" -o "${f%.svg}.png"; done
"use strict";
const fs = require("fs");
const path = require("path");
const { ALL, LAYOUT, RESERVED, reservedKey } = require("../plugin/de.simdeck.plugin.sdPlugin/bin/functions");
const i18n = require("../plugin/de.simdeck.plugin.sdPlugin/bin/i18n");

const OUT = path.join(__dirname, "..", "docs", "images");
fs.mkdirSync(OUT, { recursive: true });

// sample game data used for the pictures
const BEAMNG = {
  veh: true, sigL: true, blinkL: true, haz: false, lights: 2, fog: false,
  esc: { has: true, mode: "sport" }, drive: { has: true, awd: true }, range: { has: true, low: true },
  lockR: { has: true, on: true }, lockC: { has: true, on: false }, lockF: { has: false },
  engine: true, ign: 2, pbrake: 0, gear: "3", speed: 47, horn: false,
  lightbar: { has: true, mode: 1 }, home: true, nos: { has: true, on: true }, rocket: { has: true, on: false },
};
const AC = {
  running: true, car: "demo", tc: 0.14, abs: 0.5, gear: 4, speed: 142, fuel: 31.6, maxFuel: 62,
  auto: 0, eb: 2, ersRec: 3, ersPow: 5, drsA: 1, drsE: 0, bias: 0.62, hasDRS: 1, hasERS: 1, hasKERS: 1, kers: 0.4,
};
const LEVELS = { tc: { idx: 2, n: 4 }, abs: { idx: 3, n: 5 } };

const KEY = 144, GAP = 10, PAD = 16;

function grid(keys, cols) {
  const rows = Math.ceil(keys.length / cols);
  const w = PAD * 2 + cols * KEY + (cols - 1) * GAP;
  const h = PAD * 2 + rows * KEY + (rows - 1) * GAP;
  const inner = keys.map((svg, i) => {
    const x = PAD + (i % cols) * (KEY + GAP), y = PAD + Math.floor(i / cols) * (KEY + GAP);
    return svg.replace("<svg ", `<svg x="${x}" y="${y}" `);
  }).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" rx="24" fill="rgb(42,44,50)"/>${inner}</svg>\n`;
}

function renderLayout(game, page, lang) {
  const t = (k, v) => i18n.t(lang, k, v);
  const data = game === "beamng" ? BEAMNG : AC;
  return LAYOUT[game][page].map((id) => {
    if (!id) return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="20" fill="rgb(16,18,22)"/></svg>`;
    if (RESERVED[id]) return reservedKey(id, t);
    return ALL[id].render(data, { t, levels: (k) => LEVELS[k] || null });
  });
}

for (const lang of ["en", "de"]) {
  for (const game of ["beamng", "ac"]) {
    for (const page of [1, 2]) {
      const file = path.join(OUT, `${game}-page${page}-${lang}.svg`);
      fs.writeFileSync(file, grid(renderLayout(game, page, lang), 5));
      console.log("wrote", path.relative(process.cwd(), file));
    }
  }
  // ESC colours
  const t = (k) => i18n.t(lang, k);
  const esc = ["off", "comfort", "normal", "sport"].map((mode) =>
    ALL.bng_esc.render({ esc: { has: true, mode } }, { t, levels: () => null }));
  const drive = [
    { drive: { has: true, awd: false }, range: { has: true, low: false } },
    { drive: { has: true, awd: true }, range: { has: true, low: false } },
    { drive: { has: true, awd: true }, range: { has: true, low: true } },
  ].map((d) => ALL.bng_drive.render(d, { t, levels: () => null }));
  fs.writeFileSync(path.join(OUT, `esc-modes-${lang}.svg`), grid(esc, 4));
  fs.writeFileSync(path.join(OUT, `drive-modes-${lang}.svg`), grid(drive, 3));
}
