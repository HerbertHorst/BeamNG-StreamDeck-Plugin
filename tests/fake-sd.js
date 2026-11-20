// Tiny fake of the Stream Deck app for tests: a WebSocket server that starts the
// plugin, places 15 SimDeck keys (5 x 3) and records everything the plugin sends.
"use strict";
const net = require("net");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");

const PLUGIN = path.join(__dirname, "..", "plugin", "de.simdeck.plugin.sdPlugin", "bin", "plugin.js");

function frame(text) {
  const p = Buffer.from(text);
  let h;
  if (p.length < 126) h = Buffer.from([0x81, p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, p]);
}

// opts: { language, settings (per key), globalSettings, env }
function startFakeStreamDeck(opts = {}) {
  return new Promise((resolve) => {
    const state = { messages: [], images: {}, registered: null, client: null, proc: null };
    const send = (o) => state.client.write(frame(JSON.stringify(o)));

    const srv = net.createServer((sock) => {
      state.client = sock;
      let buf = Buffer.alloc(0), handshake = false;
      sock.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        if (!handshake) {
          const i = buf.indexOf("\r\n\r\n");
          if (i < 0) return;
          const head = buf.slice(0, i).toString();
          buf = buf.slice(i + 4);
          const key = /Sec-WebSocket-Key: (.*)/.exec(head)[1].trim();
          const acc = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
          sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
          handshake = true;
        }
        for (;;) {
          if (buf.length < 2) return;
          let len = buf[1] & 0x7f, off = 2;
          if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
          else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + 4 + len) return;
          const mask = buf.slice(off, off + 4);
          const p = Buffer.from(buf.slice(off + 4, off + 4 + len));
          for (let i = 0; i < p.length; i++) p[i] ^= mask[i & 3];
          buf = buf.slice(off + 4 + len);
          const m = JSON.parse(p.toString());
          state.messages.push(m);
          if (m.event === "registerPlugin") {
            state.registered = m;
            send({ event: "didReceiveGlobalSettings", payload: { settings: opts.globalSettings || {} } });
            for (let k = 0; k < 15; k++) {
              send({ event: "willAppear", action: "de.simdeck.plugin.slot", context: "k" + k,
                payload: { settings: (opts.settings || {}), coordinates: { column: k % 5, row: Math.floor(k / 5) } } });
            }
          }
          if (m.event === "setImage") {
            state.images[m.context] = Buffer.from(m.payload.image.split(",")[1], "base64").toString("utf8");
          }
        }
      });
    });

    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      const info = JSON.stringify({ application: { language: opts.language || "en" } });
      state.proc = spawn(process.execPath, [PLUGIN, "-port", String(port), "-pluginUUID", "TESTUUID",
        "-registerEvent", "registerPlugin", "-info", info],
      { env: { ...process.env, ...(opts.env || {}) }, stdio: "ignore" });
      state.send = send;
      state.stop = () => { state.proc.kill(); srv.close(); };
      resolve(state);
    });
  });
}

module.exports = { startFakeStreamDeck };
