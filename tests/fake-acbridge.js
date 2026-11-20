// Fake AC bridge for tests: prints AC-like JSON lines and records received keys.
"use strict";
const fs = require("fs");
let tc = 0.12;
const keyLog = process.env.FAKE_AC_KEYLOG;
require("readline").createInterface({ input: process.stdin }).on("line", (l) => {
  if (keyLog) fs.appendFileSync(keyLog, l + "\n");
  if (l === "key ctrl+t") tc = tc >= 0.16 ? 0 : +(tc + 0.02).toFixed(2);
});
setInterval(() => {
  if (process.env.FAKE_AC_RUNNING !== "1") return console.log(JSON.stringify({ game: "ac", running: false }));
  console.log(JSON.stringify({
    game: "ac", running: true, status: 2, car: "ks_bmw_m3_e30", tc, abs: 0.5, gear: 4, speed: 142.4,
    fuel: 31.6, maxFuel: 62, pit: 0, kers: 0.4, kersIn: 0, auto: 0, eb: 2, ersRec: 0, ersPow: 0,
    drsA: 1, drsE: 0, bias: 0.62, hasDRS: 1, hasERS: 0, hasKERS: 1,
  }));
}, 100);
