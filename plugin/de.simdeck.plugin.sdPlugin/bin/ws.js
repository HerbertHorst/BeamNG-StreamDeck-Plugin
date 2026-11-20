// Minimal WebSocket client (only for the local Stream Deck connection).
// No external dependencies, so the plugin runs without npm install.
"use strict";
const net = require("net");
const crypto = require("crypto");
const { EventEmitter } = require("events");

class MiniWebSocket extends EventEmitter {
  constructor(port) {
    super();
    this.buffer = Buffer.alloc(0);
    this.handshakeDone = false;
    this.fragments = [];
    this.socket = net.connect(port, "127.0.0.1", () => {
      const key = crypto.randomBytes(16).toString("base64");
      this.socket.write(
        "GET / HTTP/1.1\r\n" +
        `Host: 127.0.0.1:${port}\r\n` +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Key: ${key}\r\n` +
        "Sec-WebSocket-Version: 13\r\n\r\n"
      );
    });
    this.socket.on("data", (d) => this._onData(d));
    this.socket.on("close", () => this.emit("close"));
    this.socket.on("error", (e) => this.emit("error", e));
  }

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (!this.handshakeDone) {
      const idx = this.buffer.indexOf("\r\n\r\n");
      if (idx < 0) return;
      const head = this.buffer.slice(0, idx).toString();
      this.buffer = this.buffer.slice(idx + 4);
      if (!/^HTTP\/1\.1 101/.test(head)) {
        this.emit("error", new Error("WebSocket handshake failed: " + head.split("\r\n")[0]));
        this.socket.destroy();
        return;
      }
      this.handshakeDone = true;
      this.emit("open");
    }
    this._parseFrames();
  }

  _parseFrames() {
    for (;;) {
      const b = this.buffer;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        len = Number(b.readBigUInt64BE(2));
        off = 10;
      }
      let mask = null;
      if (masked) {
        if (b.length < off + 4) return;
        mask = b.slice(off, off + 4);
        off += 4;
      }
      if (b.length < off + len) return;
      let payload = Buffer.from(b.slice(off, off + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = b.slice(off + len);

      if (opcode === 0x8) { this.socket.end(); return; }
      if (opcode === 0x9) { this._sendFrame(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
        this.fragments.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.fragments).toString("utf8");
          this.fragments = [];
          this.emit("message", msg);
        }
      }
    }
  }

  _sendFrame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = 0x80 | len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = 0x80 | opcode;
    const mask = crypto.randomBytes(4);
    const data = Buffer.alloc(len);
    for (let i = 0; i < len; i++) data[i] = payload[i] ^ mask[i & 3];
    this.socket.write(Buffer.concat([header, mask, data]));
  }

  send(text) {
    if (!this.handshakeDone) return;
    this._sendFrame(0x1, Buffer.from(text, "utf8"));
  }
}

module.exports = { MiniWebSocket };
