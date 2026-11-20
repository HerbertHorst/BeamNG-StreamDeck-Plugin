// End-to-end tests for the Stream Deck plugin (run: node --test tests/)
// A fake Stream Deck app starts the real plugin; fake BeamNG/AC data is fed in.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const dgram = require("dgram");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startFakeStreamDeck } = require("./fake-sd");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FAKE_AC = path.join(__dirname, "fake-acbridge.js");

const BEAMNG_STATE = {
  game: "beamng", veh: true, modVersion: "test", sigL: true, sigR: false, haz: false, blinkL: true, blinkR: false,
  lights: 2, fog: false, esc: { has: true, mode: "comfort" }, drive: { has: true, awd: true },
  range: { has: true, low: true }, lockF: { has: true, on: false }, lockR: { has: true, on: true },
  lockC: { has: false }, engine: true, ign: 2, pbrake: 0, gear: "3", speed: 47.3, horn: false,
  lightbar: { has: true, mode: 1 }, home: true, nos: { has: true, on: false }, rocket: { has: true, on: false },
};

// sends fake BeamNG state packets to the plugin while the test runs
function feedBeamNG(state = BEAMNG_STATE) {
  const u = dgram.createSocket("udp4");
  const timer = setInterval(() => u.send(JSON.stringify(state), 47010, "127.0.0.1"), 100);
  return () => { clearInterval(timer); u.close(); };
}

test("registers with the uuid field and draws all 15 keys", async () => {
  const sdk = await startFakeStreamDeck();
  await sleep(800);
  sdk.stop();
  assert.strictEqual(sdk.registered && sdk.registered.uuid, "TESTUUID");
  assert.strictEqual(Object.keys(sdk.images).length, 15);
});

test("BeamNG: labels follow the language (en / de)", async () => {
  for (const [language, word, other] of [["en", "Indicator", "Blinker"], ["de", "Blinker", "Indicator"]]) {
    const stop = feedBeamNG();
    const sdk = await startFakeStreamDeck({ language });
    await sleep(1000);
    sdk.stop(); stop();
    assert.match(sdk.images.k0, new RegExp(word), `key 0 should say ${word} (${language})`);
    assert.doesNotMatch(sdk.images.k0, new RegExp(other));
    // ESC mode key "comfort" is translated, drive key shows 4L
    assert.match(sdk.images.k5, language === "de" ? /Komfort/ : /Comfort/);
    assert.match(sdk.images.k6, /4L/);
  }
});

test("language setting overrides the Stream Deck language", async () => {
  const stop = feedBeamNG();
  const sdk = await startFakeStreamDeck({ language: "en", globalSettings: { lang: "de" } });
  await sleep(1000);
  sdk.stop(); stop();
  assert.match(sdk.images.k0, /Blinker/);
});

test("BeamNG: key press sends the command over UDP", async () => {
  const received = [];
  const rx = dgram.createSocket("udp4");
  await new Promise((r) => rx.bind(47011, "127.0.0.1", r));
  rx.on("message", (m) => received.push(m.toString()));
  const stop = feedBeamNG();
  const sdk = await startFakeStreamDeck();
  await sleep(700);
  sdk.send({ event: "keyDown", context: "k6", payload: {} }); // drive key
  sdk.send({ event: "keyDown", context: "k13", payload: {} }); // horn (momentary)
  sdk.send({ event: "keyUp", context: "k13", payload: {} });
  await sleep(300);
  sdk.stop(); stop(); rx.close();
  assert.deepStrictEqual(received, ["down drive", "down horn", "up horn"]);
});

test("page 2 and reserved navigation slots", async () => {
  const stop = feedBeamNG();
  const sdk = await startFakeStreamDeck({ settings: { page: "2" } });
  await sleep(1000);
  sdk.stop(); stop();
  assert.match(sdk.images.k5, /Repair/);
  assert.match(sdk.images.k14, /Switch/); // "Switch profile" placeholder
});

test("Assetto Corsa: data shown and key combos sent to the bridge", async () => {
  const keyLog = path.join(os.tmpdir(), `simdeck-keys-${process.pid}.log`);
  try { fs.unlinkSync(keyLog); } catch (_) {}
  const sdk = await startFakeStreamDeck({
    env: { SIMDECK_BRIDGE: process.execPath, SIMDECK_BRIDGE_SCRIPT: FAKE_AC, FAKE_AC_RUNNING: "1", FAKE_AC_KEYLOG: keyLog },
  });
  await sleep(1200);
  sdk.send({ event: "keyDown", context: "k1", payload: {} }); // TC display -> ctrl+t
  sdk.send({ event: "keyDown", context: "k5", payload: {} }); // ABS - -> ctrl+shift+a
  await sleep(600);
  const tcImage = sdk.images.k1;
  const gearImage = sdk.images.k12;
  sdk.stop();
  assert.match(tcImage, /TC/);
  assert.match(gearImage, /142 km\/h/);
  const keys = fs.readFileSync(keyLog, "utf8").trim().split("\n");
  assert.deepStrictEqual(keys, ["key ctrl+t", "key ctrl+shift+a"]);
});
