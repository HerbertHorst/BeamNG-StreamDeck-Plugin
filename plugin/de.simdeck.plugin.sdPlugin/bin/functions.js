// All key functions for BeamNG.drive and Assetto Corsa:
// how each key is drawn (render) and what it does (BeamNG command or AC key combo).
//
// Every render function gets (d, x):
//   d = live game data for the key's game, or null if that game is not running
//   x = { t(key), levels(name) }  – t() translates labels, levels() is used by AC TC/ABS
"use strict";
const { COL, SYM, simple, valueKey, plusMinusKey, key, text } = require("./render");

// shorten long labels so they fit on a key
const short = (s, n = 10) => (s && s.length > n ? s.slice(0, n - 1) + "." : s || "");

// ------------------------------------------------------------------ BeamNG
const B = {};
// momentary = also send a "release" command (horn, starter, rocket …)
const bng = (id, action, render, momentary = false) => {
  B[id] = { id, game: "beamng", action, render, momentary };
};

bng("bng_signal_left", "signal_left", (d, { t }) =>
  !d ? simple(SYM.arrowL, t("indicator"), "na") :
  simple(SYM.arrowL, t("indicator"), d.sigL || d.haz ? (d.blinkL ? "on" : "dim") : "off", COL.green));

bng("bng_signal_right", "signal_right", (d, { t }) =>
  !d ? simple(SYM.arrowR, t("indicator"), "na") :
  simple(SYM.arrowR, t("indicator"), d.sigR || d.haz ? (d.blinkR ? "on" : "dim") : "off", COL.green));

bng("bng_hazard", "hazard", (d, { t }) =>
  !d ? simple(SYM.hazard, t("hazard"), "na") :
  simple(SYM.hazard, t("hazard"), d.haz ? "on" : "off", COL.red));

bng("bng_lowbeam", "lowbeam", (d, { t }) =>
  !d ? simple(SYM.lowbeam, t("lights"), "na") :
  simple(SYM.lowbeam, d.lights >= 1 ? t("lightsOn") : t("lights"), d.lights >= 1 ? "on" : "off", COL.green));

bng("bng_highbeam", "highbeam", (d, { t }) =>
  !d ? simple(SYM.highbeam, t("highBeam"), "na") :
  simple(SYM.highbeam, t("highBeam"), d.lights === 2 ? "on" : "off", COL.blue));

bng("bng_fog", "fog", (d, { t }) =>
  !d ? simple(SYM.fog, t("fog"), "na") :
  simple(SYM.fog, t("fog"), d.fog ? "on" : "off", COL.green));

// ESC colour by mode: off = grey, comfort = blue, normal = green, sport = red.
// The mod sends a normalised mode key (e.g. "comfort") or, for unknown modes, the raw name.
const MODE_KEYS = ["off", "comfort", "eco", "wet", "snow", "normal", "on", "sport", "sportplus",
  "track", "race", "drift", "dynamic", "offroad", "rally"];

function escColor(mode) {
  const m = String(mode || "").toLowerCase();
  if (/^(off|aus|disabled)$/.test(m) || /\b(off|aus|disabled|deaktiv)\b/.test(m)) return COL.grey;
  if (/(komfort|comfort|eco|nass|wet|schnee|snow)/.test(m)) return COL.blue;
  if (/(sport|track|race|drift|dynamik|dynamic|rally)/.test(m)) return COL.red;
  return COL.green;
}

bng("bng_esc", "esc", (d, { t }) => {
  const e = d && d.esc;
  if (!e || !e.has) return simple(SYM.esc, "ESC", "na");
  let mode = e.mode ? String(e.mode) : "";
  if (/^table:|^userdata:/.test(mode)) mode = "";
  if (!mode) return simple(SYM.esc, "ESC", "on", COL.green);
  const col = escColor(mode);
  if (col === COL.grey) return simple(SYM.esc, t("escOff"), "on", col);
  const label = MODE_KEYS.includes(mode.toLowerCase()) ? t("mode." + mode.toLowerCase()) : mode;
  return simple(SYM.esc, short(label), "on", col);
});

// One key for the whole drivetrain: shows 2H / 4H / 4L, colour green (4WD), amber (low range)
bng("bng_drive", "drive", (d) => {
  if (!d || (!d.drive.has && !d.range.has)) {
    return key({ body: SYM.chassis(COL.na, true), label: "4WD", labelColor: COL.naText, labelSize: 26 });
  }
  const awd = d.drive.has ? d.drive.awd : true;
  const lbl = (awd ? "4" : "2") + (d.range.has ? (d.range.low ? "L" : "H") : "WD");
  const col = d.range.has && d.range.low ? COL.amber : awd ? COL.green : COL.off;
  const state = col === COL.off ? "off" : "on";
  return simple((c) => SYM.chassis(c, awd), lbl, state, col, { labelSize: 26 });
});

bng("bng_range", "range", (d, { t }) => {
  if (!d || !d.range.has) return valueKey({ value: "H/L", label: t("range"), state: "na", valueSize: 44 });
  return valueKey({ value: d.range.low ? t("lowRange") : t("highRange"), label: t("range"),
    state: d.range.low ? "warn" : "off", valueSize: 38 });
});

const lockFn = (field, lblKey) => (d, { t }) => {
  const l = d && d[field];
  if (!l || !l.has) return simple((c) => SYM.axle(c, false), t(lblKey), "na");
  return simple((c) => SYM.axle(c, l.on), t(lblKey), l.on ? "on" : "off", COL.amber);
};
bng("bng_lock_rear", "lock_rear", lockFn("lockR", "lockR"));
bng("bng_lock_front", "lock_front", lockFn("lockF", "lockF"));
bng("bng_lock_center", "lock_center", lockFn("lockC", "lockC"));

bng("bng_engine", "engine", (d, { t }) => {
  if (!d) return simple(SYM.engine, t("engine"), "na");
  if (d.engine) return simple(SYM.engine, t("engineOn"), "on", COL.green);
  return simple(SYM.engine, d.ign > 0 ? t("ignition") : t("engineOff"), "off");
}, true);

bng("bng_parkbrake", "parkbrake", (d, { t }) =>
  !d ? simple(SYM.parkbrake, t("handbrake"), "na", null, { labelSize: 18 }) :
  simple(SYM.parkbrake, t("handbrake"), d.pbrake > 0.5 ? "on" : "off", COL.red, { labelSize: 18 }));

bng("bng_horn", "horn", (d, { t }) =>
  !d ? simple(SYM.horn, t("horn"), "na") : simple(SYM.horn, t("horn"), d.horn ? "on" : "off", COL.amber), true);

bng("bng_flash", "flash", (d, { t }) =>
  !d ? simple(SYM.highbeam, t("flash"), "na") :
  simple(SYM.highbeam, t("flash"), d.lights === 2 ? "on" : "off", COL.blue), true);

bng("bng_lightbar", "lightbar", (d, { t }) => {
  const lb = d && d.lightbar;
  if (!lb || !lb.has) return valueKey({ value: "LB", label: t("lightbar"), state: "na", valueSize: 44 });
  return valueKey({ value: lb.mode > 0 ? `LB ${lb.mode}` : "LB", label: lb.mode > 0 ? t("on") : t("lightbar"),
    state: lb.mode > 0 ? "warn" : "off", valueSize: 40 });
});

bng("bng_repair", "repair", (d, { t }) =>
  simple(SYM.wrench, t("repair"), d ? "off" : "na", null, { labelSize: 18 }));

bng("bng_home_save", "home_save", (d, { t }) =>
  !d ? simple(SYM.pinSave, t("setPoint"), "na", null, { labelSize: 17 }) :
  simple(SYM.pinSave, d.home ? t("pointSet") : t("setPoint"), d.home ? "on" : "off", COL.green, { labelSize: 17 }));

bng("bng_home_load", "home_load", (d, { t }) =>
  !d ? simple(SYM.pinLoad, t("goBack"), "na") :
  simple(SYM.pinLoad, t("goBack"), d.home ? "on" : "off", COL.blue));

bng("bng_camera", "camera", (d, { t }) => simple(SYM.camera, t("camera"), d ? "off" : "na"));

bng("bng_nos", "nos", (d, { t }) => {
  const n = d && d.nos;
  if (!n || !n.has) return simple(SYM.nos, t("nos"), "na");
  return simple(SYM.nos, n.on ? t("nosOn") : t("nos"), n.on ? "on" : "off", COL.blue);
});

bng("bng_rocket", "rocket", (d, { t }) => {
  const r = d && d.rocket;
  if (!r || !r.has) return simple(SYM.rocket, t("rocket"), "na");
  return simple(SYM.rocket, t("rocket"), r.on ? "on" : "off", COL.amber);
}, true);

bng("bng_selector", "selector", (d, { t }) =>
  simple(SYM.selector, t("vehicles"), d ? "off" : "na", null, { labelSize: 18 }));

bng("bng_walk", "walk", (d, { t }) =>
  simple(SYM.walk, t("exitCar"), d ? "off" : "na", null, { labelSize: 18 }));

const bngGear = (g) => {
  if (g === undefined || g === null) return "-";
  const n = Number(g);
  if (String(g).trim() !== "" && !isNaN(n)) return n === 0 ? "N" : n < 0 ? "R" : String(n);
  return String(g).slice(0, 3);
};
bng("bng_gear", null, (d) =>
  !d ? valueKey({ value: "-", label: "km/h", state: "na", valueSize: 64 }) :
  valueKey({ value: bngGear(d.gear), label: `${Math.round(d.speed || 0)} km/h`, state: "off", valueSize: 64 }));

// ------------------------------------------------------------------ Assetto Corsa
const A = {};
// defKey: default AC key combo; "" = no default (user must set one); null = display only
const ac = (id, defKey, render) => {
  A[id] = { id, game: "ac", defKey, render };
};

// TC/ABS: AC only exposes the slip-ratio value, not the level number. The plugin
// learns the levels per car while you cycle through them (see learnLevels in plugin.js).
const levelKey = (title, val, info, t) => {
  if (val === undefined) return valueKey({ title, value: "-", label: "", state: "na" });
  if (!val) return valueKey({ title, value: t("off"), label: "", state: "off", color: COL.white, valueSize: 36 });
  if (info && info.idx) {
    return valueKey({ title, value: `${info.idx}/${info.n}`, label: val.toFixed(2), state: "on", color: COL.green,
      levels: info.n, levelIdx: info.idx, valueSize: 38 });
  }
  return valueKey({ title, value: val.toFixed(2), label: t("on"), state: "on", color: COL.green, valueSize: 34 });
};

// Default keys from the AC keyboard shortcut list (Ctrl+Shift+… = cycle backwards)
ac("ac_tc_down", "ctrl+shift+t", (d) => plusMinusKey("TC", "−", d ? "off" : "na"));
ac("ac_tc_up", "ctrl+t", (d) => plusMinusKey("TC", "+", d ? "off" : "na"));
ac("ac_tc", "ctrl+t", (d, x) => levelKey("TC", d ? d.tc : undefined, x.levels("tc"), x.t));
ac("ac_abs_down", "ctrl+shift+a", (d) => plusMinusKey("ABS", "−", d ? "off" : "na"));
ac("ac_abs_up", "ctrl+a", (d) => plusMinusKey("ABS", "+", d ? "off" : "na"));
ac("ac_abs", "ctrl+a", (d, x) => levelKey("ABS", d ? d.abs : undefined, x.levels("abs"), x.t));

ac("ac_autoshift", "ctrl+g", (d, { t }) =>
  !d ? valueKey({ title: t("gearbox"), value: "AUTO", state: "na", valueSize: 34 }) :
  valueKey({ title: t("gearbox"), value: d.auto ? "AUTO" : "MAN", label: d.auto ? t("automatic") : t("manual"),
    state: d.auto ? "on" : "off", color: d.auto ? COL.green : COL.white, valueSize: 36 }));

// AC exposes no state for these, so they only show the symbol
ac("ac_lights", "", (d, { t }) => simple(SYM.lowbeam, t("lights"), d ? "off" : "na"));
ac("ac_sig_left", "", (d, { t }) => simple(SYM.arrowL, t("indicator"), d ? "off" : "na"));
ac("ac_sig_right", "", (d, { t }) => simple(SYM.arrowR, t("indicator"), d ? "off" : "na"));

const ersNa = (d) => !d || !(d.hasERS || d.hasKERS);
ac("ac_mguk_rec", "ctrl+1", (d, { t }) =>
  ersNa(d) ? valueKey({ title: "MGU-K", value: "-", label: t("recovery"), state: "na" }) :
  valueKey({ title: "MGU-K", value: String(d.ersRec), label: t("recovery"), state: "on", color: COL.blue }));
ac("ac_mguk_del", "ctrl+2", (d, { t }) =>
  ersNa(d) ? valueKey({ title: "MGU-K", value: "-", label: t("deploy"), state: "na" }) :
  valueKey({ title: "MGU-K", value: String(d.ersPow), label: t("deploy"), state: "on", color: COL.blue }));

ac("ac_bias", null, (d, { t }) =>
  !d || !d.bias ? valueKey({ title: t("brakeBias"), value: "-", label: t("front"), state: "na" }) :
  valueKey({ title: t("brakeBias"), value: `${(d.bias * 100).toFixed(1)}%`, label: t("front"), state: "off", valueSize: 32 }));

// AC gear index: 0 = R, 1 = N, 2 = 1st …
const acGear = (g) => (g === 0 ? "R" : g === 1 ? "N" : String(g - 1));
ac("ac_gear", null, (d) =>
  !d ? valueKey({ value: "-", label: "km/h", state: "na", valueSize: 64 }) :
  valueKey({ value: acGear(d.gear), label: `${Math.round(d.speed || 0)} km/h`, state: "off", valueSize: 64 }));

ac("ac_fuel", null, (d, { t }) => {
  if (!d) return valueKey({ title: t("fuel"), value: "-", state: "na" });
  const pct = d.maxFuel > 0 ? Math.max(0, Math.min(100, (d.fuel / d.maxFuel) * 100)) : null;
  const low = pct !== null && pct < 10;
  return valueKey({ title: t("fuel"), value: `${d.fuel.toFixed(1)} L`, label: pct !== null ? `${Math.round(pct)} %` : "",
    state: low ? "warn" : "off", valueSize: 32, levels: pct !== null ? 10 : 0, levelIdx: pct !== null ? Math.ceil(pct / 10) : 0 });
});

ac("ac_drs", "", (d, { t }) => {
  if (!d || !d.hasDRS) return valueKey({ value: "DRS", label: "", state: "na", valueSize: 40 });
  if (d.drsE) return valueKey({ value: "DRS", label: t("drsOpen"), state: "on", color: COL.green, valueSize: 40 });
  if (d.drsA) return valueKey({ value: "DRS", label: t("drsReady"), state: "on", color: COL.white, valueSize: 40 });
  return valueKey({ value: "DRS", label: "", state: "off", valueSize: 40 });
});

ac("ac_kers", "", (d) => {
  if (!d || !d.hasKERS) return simple(SYM.bolt, "KERS", "na");
  return simple(SYM.bolt, `${Math.round((d.kers || 0) * 100)} %`, d.kersIn > 0 ? "on" : "off", COL.blue);
});

ac("ac_enginebrake", "ctrl+4", (d, { t }) =>
  !d ? valueKey({ title: t("engineBrake"), value: "-", state: "na" }) :
  valueKey({ title: t("engineBrake"), value: String(d.eb), state: "off" }));

// ------------------------------------------------------------------ automatic layout (5 x 3, two pages)
// "#next" / "#prev" / "#profile" = slots reserved for Stream Deck navigation actions
const LAYOUT = {
  beamng: {
    1: [
      "bng_signal_left", "bng_hazard", "bng_signal_right", "bng_lowbeam", "bng_highbeam",
      "bng_esc", "bng_drive", "bng_lock_rear", "bng_lock_center", "bng_lock_front",
      "bng_engine", "bng_parkbrake", "bng_gear", "bng_horn", "#next",
    ],
    2: [
      "bng_fog", "bng_flash", "bng_lightbar", "bng_nos", "bng_rocket",
      "bng_repair", "bng_home_save", "bng_home_load", "bng_camera", "bng_selector",
      "bng_walk", null, null, "#prev", "#profile",
    ],
  },
  ac: {
    1: [
      "ac_tc_down", "ac_tc", "ac_tc_up", "ac_autoshift", "ac_lights",
      "ac_abs_down", "ac_abs", "ac_abs_up", "ac_mguk_rec", "ac_mguk_del",
      "ac_sig_left", "ac_bias", "ac_gear", "ac_sig_right", "#next",
    ],
    2: [
      "ac_fuel", "ac_drs", "ac_kers", "ac_enginebrake", null,
      null, null, null, null, null,
      null, null, null, "#prev", "#profile",
    ],
  },
};

const RESERVED = { "#next": "res.next", "#prev": "res.prev", "#profile": "res.profile" };

// placeholder drawn on a reserved slot: "put the Stream Deck navigation action here"
function reservedKey(kind, t) {
  const words = t(RESERVED[kind]).split("|");
  return key({
    body: `<rect x="10" y="10" width="124" height="124" rx="14" fill="none" stroke="${COL.na}" stroke-width="3" stroke-dasharray="8,6"/>` +
      text(72, 52, words[0], 20, COL.naText) + text(72, 78, words[1] || "", 20, COL.naText) +
      text(72, 110, t("keepFree"), 15, COL.na, "normal"),
  });
}

const ALL = { ...B, ...A };

// hint banner when an AC function has no key combo yet
function needsKeyOverlay(svg, t) {
  return svg.replace("</svg>",
    `<rect x="4" y="114" width="136" height="28" rx="8" fill="rgb(58,40,8)"/>` +
    text(72, 134, t("setKey"), 17, COL.amber) + "</svg>");
}

// short white frame as feedback after a key press
function pressedOverlay(svg) {
  return svg.replace("</svg>", `<rect x="3" y="3" width="138" height="138" rx="18" fill="none" stroke="${COL.white}" stroke-width="6"/></svg>`);
}

module.exports = { ALL, LAYOUT, RESERVED, reservedKey, needsKeyOverlay, pressedOverlay };
