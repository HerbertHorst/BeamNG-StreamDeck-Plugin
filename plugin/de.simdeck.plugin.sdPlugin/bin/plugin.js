// SimDeck – Stream Deck plugin for BeamNG.drive and Assetto Corsa
//
// Data flow:
//   BeamNG mod  --UDP 47010-->  plugin  --UDP 47011-->  BeamNG mod   (status / commands)
//   acbridge.ps1 (stdout JSON lines)  -->  plugin  --stdin "key ctrl+t"-->  acbridge.ps1
//   plugin  <--WebSocket-->  Stream Deck app (draws the keys via setImage)
"use strict";
const fs = require("fs");
const path = require("path");
const dgram = require("dgram");
const { spawn } = require("child_process");
const { MiniWebSocket } = require("./ws");
const { ALL, LAYOUT, RESERVED, reservedKey, needsKeyOverlay, pressedOverlay } = require("./functions");
const { toDataUrl } = require("./render");
const i18n = require("./i18n");

const BNG_STATUS_PORT = 47010; // BeamNG -> plugin
const BNG_CMD_PORT = 47011;    // plugin -> BeamNG
const STALE_MS = 1500;         // a game counts as "running" while data is younger than this
const ACTION_UUID = "de.simdeck.plugin.slot";

let PLUGIN_VERSION = "dev";
try {
  PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")).Version;
} catch (_) {}

// ------------------------------------------------------------------ logging
const LOG_FILE = path.join(__dirname, "..", "simdeck.log");
try { if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) fs.unlinkSync(LOG_FILE); } catch (_) {}
function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(" ")}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch (_) {}
}
process.on("uncaughtException", (e) => log("ERROR", e && e.stack ? e.stack : e));

// ------------------------------------------------------------------ start arguments from the Stream Deck app
const args = {};
for (let i = 2; i < process.argv.length - 1; i++) {
  if (process.argv[i].startsWith("-")) args[process.argv[i].replace(/^-+/, "")] = process.argv[i + 1];
}
const PORT = Number(args.port);
const PLUGIN_UUID = args.pluginUUID;
const REGISTER_EVENT = args.registerEvent || "registerPlugin";
let APP_LANGUAGE = "en";
try { APP_LANGUAGE = JSON.parse(args.info || "{}").application.language || "en"; } catch (_) {}

// ------------------------------------------------------------------ state
const contexts = new Map(); // context -> { settings, coords, lastImg, pressedUntil }
let globalSettings = { acKeys: {}, levels: {}, lang: "auto" };
const games = {
  beamng: { data: null, t: 0 },
  ac: { data: null, t: 0 },
};
let lastGame = "beamng";
let ws = null;

function lang() { return i18n.resolveLang(globalSettings.lang, APP_LANGUAGE); }
function tr(key, vars) { return i18n.t(lang(), key, vars); }

function sd(event, context, payload, action) {
  if (!ws) return;
  const msg = { event };
  if (action) msg.action = action;
  if (context) msg.context = context;
  if (payload !== undefined) msg.payload = payload;
  ws.send(JSON.stringify(msg));
}

function activeGame() {
  const now = Date.now();
  const b = games.beamng, a = games.ac;
  const bLive = b.data && b.data.veh && now - b.t < STALE_MS;
  const aLive = a.data && a.data.running && now - a.t < STALE_MS;
  if (bLive && aLive) return b.t >= a.t ? "beamng" : "ac";
  if (bLive) return "beamng";
  if (aLive) return "ac";
  return null;
}

// Which function does this key have right now? A fixed one from its settings,
// or – in "auto" mode – the one from the layout for its position, page and the running game.
function resolveFunction(ctx, game) {
  const sel = (ctx.settings && ctx.settings.func) || "auto";
  if (sel !== "auto") return ALL[sel] || null;
  const c = ctx.coords;
  if (!c || c.column > 4 || c.row > 2) return null;
  const idx = c.row * 5 + c.column;
  const page = String((ctx.settings && ctx.settings.page) || "1") === "2" ? 2 : 1;
  const id = LAYOUT[game || lastGame][page][idx];
  if (id && RESERVED[id]) return { reserved: id };
  return ALL[id] || null;
}

function acKeyFor(fn) {
  const custom = globalSettings.acKeys && globalSettings.acKeys[fn.id];
  if (typeof custom === "string" && custom.trim() !== "") return custom.trim().toLowerCase();
  return fn.defKey || "";
}

// ---------------------------------------------------- learned TC/ABS levels (AC)
// AC only reports the slip-ratio value of TC/ABS. Every distinct value seen per car
// is remembered (sorted), so after cycling once the key can show "level 3/5".
let saveTimer = null;
function saveGlobal() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => sd("setGlobalSettings", PLUGIN_UUID, globalSettings), 2000);
}

function learnLevels(d) {
  if (!d || !d.car) return;
  globalSettings.levels = globalSettings.levels || {};
  for (const k of ["tc", "abs"]) {
    const v = Math.round((d[k] || 0) * 1000) / 1000;
    if (!v) continue;
    const id = `${d.car}|${k}`;
    const entry = globalSettings.levels[id] || { vals: [] };
    if (entry.bad) continue;
    if (!entry.vals.includes(v)) {
      entry.vals.push(v);
      entry.vals.sort((x, y) => x - y);
      if (entry.vals.length > 12) { entry.bad = true; entry.vals = []; } // value fluctuates -> no levels
      globalSettings.levels[id] = entry;
      saveGlobal();
    }
  }
}

function levelsHelper(d) {
  return (k) => {
    if (!d || !d.car) return null;
    const entry = globalSettings.levels && globalSettings.levels[`${d.car}|${k}`];
    const v = Math.round((d[k] || 0) * 1000) / 1000;
    if (!entry || entry.bad || !v || entry.vals.length < 2) return null;
    const i = entry.vals.indexOf(v);
    return i < 0 ? null : { idx: i + 1, n: entry.vals.length };
  };
}

// ------------------------------------------------------------------ rendering
function renderContext(context, ctx, game) {
  const fn = resolveFunction(ctx, game);
  let svg;
  if (fn && fn.reserved) {
    svg = reservedKey(fn.reserved, tr);
  } else if (!fn) {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="20" fill="rgb(16,18,22)"/></svg>`;
  } else {
    const live = game === fn.game;
    const d = live ? games[fn.game].data : null;
    try {
      svg = fn.render(d, { levels: levelsHelper(d), t: tr });
    } catch (e) {
      log("Render error", fn.id, e.stack);
      svg = fn.render(null, { levels: () => null, t: tr });
    }
    if (fn.game === "ac" && fn.defKey !== null && !acKeyFor(fn)) svg = needsKeyOverlay(svg, tr);
    if (ctx.pressedUntil && Date.now() < ctx.pressedUntil) svg = pressedOverlay(svg);
  }
  if (svg !== ctx.lastImg) {
    ctx.lastImg = svg;
    sd("setImage", context, { image: toDataUrl(svg), target: 0 });
  }
}

function renderAll() {
  const game = activeGame();
  if (game) lastGame = game;
  for (const [context, ctx] of contexts) renderContext(context, ctx, game);
}

// ------------------------------------------------------------------ BeamNG (UDP)
const udp = dgram.createSocket("udp4");
udp.on("message", (msg) => {
  try {
    const d = JSON.parse(msg.toString("utf8"));
    if (d.game === "beamng") {
      d.drive = d.drive || {}; d.range = d.range || {};
      games.beamng = { data: d, t: Date.now() };
    }
  } catch (e) { /* ignore malformed packets */ }
});
udp.on("error", (e) => log("UDP error", e.message));
udp.bind(BNG_STATUS_PORT, "127.0.0.1", () => log("Waiting for BeamNG on port", BNG_STATUS_PORT));

function sendBeamNG(phase, action) {
  const buf = Buffer.from(`${phase} ${action}`);
  udp.send(buf, BNG_CMD_PORT, "127.0.0.1");
}

// ------------------------------------------------------------------ AC bridge (PowerShell)
// SIMDECK_BRIDGE / SIMDECK_BRIDGE_SCRIPT let the tests replace PowerShell with a fake bridge.
let bridge = null;
let bridgeBuf = "";
function startBridge() {
  if (process.platform !== "win32" && !process.env.SIMDECK_BRIDGE) return;
  const script = path.join(__dirname, "acbridge.ps1");
  const cmd = process.env.SIMDECK_BRIDGE || "powershell.exe";
  const cmdArgs = process.env.SIMDECK_BRIDGE
    ? [process.env.SIMDECK_BRIDGE_SCRIPT || script]
    : ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
  try {
    bridge = spawn(cmd, cmdArgs, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    log("AC bridge could not start:", e.message);
    return;
  }
  log("AC bridge started");
  bridge.stdout.on("data", (chunk) => {
    bridgeBuf += chunk.toString("utf8");
    let i;
    while ((i = bridgeBuf.indexOf("\n")) >= 0) {
      const line = bridgeBuf.slice(0, i).trim();
      bridgeBuf = bridgeBuf.slice(i + 1);
      if (!line.startsWith("{")) { if (line) log("AC bridge:", line); continue; }
      try {
        const d = JSON.parse(line);
        if (d.game === "ac") {
          games.ac = { data: d, t: Date.now() };
          if (d.running) learnLevels(d);
        }
      } catch (_) {}
    }
  });
  bridge.stderr.on("data", (c) => log("AC bridge (stderr):", c.toString().trim()));
  bridge.on("exit", (code) => {
    log("AC bridge exited, code", code, "- restarting in 10 s");
    bridge = null;
    setTimeout(startBridge, 10000);
  });
  bridge.stdin.on("error", () => {});
}

function sendAcKey(combo) {
  if (!bridge) { log("AC key not sent (bridge not running):", combo); return false; }
  bridge.stdin.write(`key ${combo}\n`);
  return true;
}

// ------------------------------------------------------------------ key presses
function onKey(context, down) {
  const ctx = contexts.get(context);
  if (!ctx) return;
  const game = activeGame();
  const fn = resolveFunction(ctx, game);
  if (!fn || fn.reserved) return;

  if (fn.game === "beamng") {
    if (!fn.action) return; // display only
    if (down) {
      if (game !== "beamng") { sd("showAlert", context); return; }
      sendBeamNG("down", fn.action);
      ctx.pressedUntil = Date.now() + 180;
    } else if (fn.momentary) {
      sendBeamNG("up", fn.action);
    }
    return;
  }

  if (fn.game === "ac" && down) {
    if (fn.defKey === null) return; // display only
    const combo = acKeyFor(fn);
    if (!combo) { sd("showAlert", context); return; }
    if (game !== "ac") { sd("showAlert", context); return; }
    if (sendAcKey(combo)) ctx.pressedUntil = Date.now() + 180;
    else sd("showAlert", context);
  }
}

// ------------------------------------------------------------------ Stream Deck events
function handle(msg) {
  const { event, context, payload } = msg;
  switch (event) {
    case "willAppear":
      if (msg.action !== ACTION_UUID) break;
      contexts.set(context, {
        settings: (payload && payload.settings) || {},
        coords: payload && payload.coordinates,
        lastImg: null,
        pressedUntil: 0,
      });
      renderContext(context, contexts.get(context), activeGame());
      break;
    case "willDisappear":
      contexts.delete(context);
      break;
    case "didReceiveSettings": {
      const ctx = contexts.get(context);
      if (ctx) { ctx.settings = payload.settings || {}; ctx.lastImg = null; }
      break;
    }
    case "didReceiveGlobalSettings":
      globalSettings = Object.assign({ acKeys: {}, levels: {}, lang: "auto" }, payload.settings || {});
      for (const ctx of contexts.values()) ctx.lastImg = null; // redraw (language may have changed)
      break;
    case "keyDown":
      onKey(context, true);
      break;
    case "keyUp":
      onKey(context, false);
      break;
    case "sendToPlugin":
      if (payload && payload.cmd === "dump") sendBeamNG("down", "dump");
      if (payload && payload.cmd === "resetLevels") { globalSettings.levels = {}; saveGlobal(); }
      if (payload && payload.cmd === "status") {
        log("Status request from the Property Inspector");
        sd("sendToPropertyInspector", context, {
          status: {
            game: activeGame(),
            beamng: games.beamng.t ? Math.round((Date.now() - games.beamng.t) / 1000) : null,
            ac: games.ac.t ? Math.round((Date.now() - games.ac.t) / 1000) : null,
            bridge: !!bridge,
            modVersion: games.beamng.data && games.beamng.data.modVersion ? games.beamng.data.modVersion : null,
            pluginVersion: PLUGIN_VERSION,
          },
        }, msg.action || ACTION_UUID);
      }
      break;
  }
}

function connect() {
  if (!PORT || !PLUGIN_UUID) {
    log("No Stream Deck start parameters - test mode without Stream Deck");
    return;
  }
  ws = new MiniWebSocket(PORT);
  log("SimDeck plugin " + PLUGIN_VERSION + ", app language " + APP_LANGUAGE);
  ws.on("open", () => {
    // registration must use "uuid" (not "context")
    ws.send(JSON.stringify({ event: REGISTER_EVENT, uuid: PLUGIN_UUID }));
    sd("getGlobalSettings", PLUGIN_UUID);
    log("Connected to Stream Deck");
  });
  ws.on("message", (m) => {
    try { handle(JSON.parse(m)); } catch (e) { log("Message error", e.stack); }
  });
  ws.on("close", () => { log("Stream Deck disconnected - exiting"); process.exit(0); });
  ws.on("error", (e) => log("WebSocket error", e.message));
}

connect();
startBridge();
setInterval(renderAll, 100);

module.exports = { handle, games, contexts, renderAll, activeGame };
