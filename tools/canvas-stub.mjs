// Shared headless Canvas2D stub (software rasterizer) used by the screenshot
// harness and the boot test. Not part of the game.
import { deflateSync } from 'node:zlib';
// ---------- 5x7 bitmap font (rows top->bottom, 5 bits each) ----------
const GLYPHS = {
  A: '01110/10001/10001/11111/10001/10001/10001', B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01110/10001/10000/10000/10000/10001/01110', D: '11100/10010/10001/10001/10001/10010/11100',
  E: '11111/10000/10000/11110/10000/10000/11111', F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01110/10001/10000/10111/10001/10001/01111', H: '10001/10001/10001/11111/10001/10001/10001',
  I: '01110/00100/00100/00100/00100/00100/01110', J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001', L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001', N: '10001/11001/10101/10011/10001/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110', P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101', R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110', T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110', V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010', X: '10001/01010/00100/00100/00100/01010/10001',
  Y: '10001/01010/00100/00100/00100/00100/00100', Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110', '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00110/01000/10000/11111', '3': '11111/00010/00100/00010/00001/10001/01110',
  '4': '00010/00110/01010/10010/11111/00010/00010', '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110', '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110', '9': '01110/10001/10001/01111/00001/00010/01100',
  ' ': '00000/00000/00000/00000/00000/00000/00000', '.': '00000/00000/00000/00000/00000/01100/01100',
  ',': '00000/00000/00000/00000/01100/00100/01000', "'": '00100/00100/01000/00000/00000/00000/00000',
  '-': '00000/00000/00000/01110/00000/00000/00000', ':': '00000/01100/01100/00000/01100/01100/00000',
  ';': '00000/01100/01100/00000/01100/00100/01000', '!': '00100/00100/00100/00100/00100/00000/00100',
  '?': '01110/10001/00001/00010/00100/00000/00100', '$': '00100/01111/10100/01110/00101/11110/00100',
  '/': '00001/00010/00010/00100/01000/01000/10000', '(': '00010/00100/01000/01000/01000/00100/00010',
  ')': '01000/00100/00010/00010/00010/00100/01000', '+': '00000/00100/00100/01110/00100/00100/00000',
  '&': '01100/10010/10100/01000/10101/10010/01101', '%': '11001/11010/00010/00100/01000/01011/10011',
  '*': '00000/10101/01110/10101/00000/00000/00000', '=': '00000/00000/11111/00000/11111/00000/00000',
  '"': '01010/01010/00000/00000/00000/00000/00000', '_': '00000/00000/00000/00000/00000/00000/11111',
  '<': '00010/00100/01000/10000/01000/00100/00010', '>': '01000/00100/00010/00001/00010/00100/01000',
};

// ---------- colour ----------
function parseColor(c) {
  if (typeof c !== 'string') return [0, 0, 0, 1];
  if (c.startsWith('#')) {
    const n = Number.parseInt(c.slice(1), 16);
    if (c.length === 4) return [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17, 1];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((v) => Number.parseFloat(v));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  return [0, 0, 0, 1];
}

// ---------- canvas stub ----------
export class StubCanvas {
  constructor() { this._w = 300; this._h = 150; this._alloc(); }
  set width(v) { this._w = v; this._alloc(); }
  get width() { return this._w; }
  set height(v) { this._h = v; this._alloc(); }
  get height() { return this._h; }
  _alloc() { this.buf = new Uint8Array(this._w * this._h * 4); }
  getContext() { if (!this._ctx) this._ctx = new StubCtx(this); return this._ctx; }
}

class StubCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000'; this.strokeStyle = '#000';
    this.lineWidth = 1; this.globalAlpha = 1;
    this.font = '10px sans-serif'; this.textAlign = 'left'; this.textBaseline = 'alphabetic';
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.path = [];
  }
  save() { this.stack.push({ m: [...this.m], a: this.globalAlpha }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.globalAlpha = s.a; } }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  translate(x, y) {
    const [a, b, c, d, e, f] = this.m;
    this.m = [a, b, c, d, e + a * x + c * y, f + b * x + d * y];
  }
  pt(x, y) { const [a, b, c, d, e, f] = this.m; return [a * x + c * y + e, b * x + d * y + f]; }
  blend(px, py, [r, g, b, a]) {
    const alpha = a * this.globalAlpha;
    if (alpha <= 0) return;
    const { buf, _w: w, _h: h } = this.canvas;
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = (py * w + px) * 4;
    if (alpha >= 1) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; return; }
    buf[i] = Math.round(r * alpha + buf[i] * (1 - alpha));
    buf[i + 1] = Math.round(g * alpha + buf[i + 1] * (1 - alpha));
    buf[i + 2] = Math.round(b * alpha + buf[i + 2] * (1 - alpha));
    buf[i + 3] = 255;
  }
  fillRect(x, y, w, h) {
    const col = parseColor(this.fillStyle);
    const [x0, y0] = this.pt(x, y);
    const [x1, y1] = this.pt(x + w, y + h);
    const xa = Math.round(Math.min(x0, x1)); const xb = Math.round(Math.max(x0, x1));
    const ya = Math.round(Math.min(y0, y1)); const yb = Math.round(Math.max(y0, y1));
    for (let py = ya; py < yb; py += 1) for (let px = xa; px < xb; px += 1) this.blend(px, py, col);
  }
  strokeRect(x, y, w, h) {
    this.beginPath();
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h);
    this.closePath(); this.stroke();
  }
  beginPath() { this.path = []; }
  moveTo(x, y) { this.path.push({ t: 'M', p: this.pt(x, y) }); }
  lineTo(x, y) { this.path.push({ t: 'L', p: this.pt(x, y) }); }
  closePath() { this.path.push({ t: 'Z' }); }
  arc(x, y, r, a0, a1) {
    const steps = Math.max(10, Math.floor(Math.abs(a1 - a0) / (Math.PI / 14)));
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const p = this.pt(x + Math.cos(a) * r, y + Math.sin(a) * r);
      this.path.push({ t: i === 0 ? 'M' : 'L', p });
    }
  }
  ellipse(x, y, rx, ry, rot, a0, a1) {
    const steps = 26;
    for (let i = 0; i <= steps; i += 1) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const lx = Math.cos(a) * rx; const ly = Math.sin(a) * ry;
      const p = this.pt(x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot));
      this.path.push({ t: i === 0 ? 'M' : 'L', p });
    }
  }
  polygonPoints() {
    const pts = [];
    for (const seg of this.path) if (seg.p) pts.push(seg.p);
    return pts;
  }
  fill() {
    const pts = this.polygonPoints();
    if (pts.length < 3) return;
    const col = parseColor(this.fillStyle);
    let minY = Infinity; let maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const yA = Math.max(0, Math.floor(minY)); const yB = Math.min(this.canvas._h - 1, Math.ceil(maxY));
    for (let py = yA; py <= yB; py += 1) {
      const xs = [];
      for (let i = 0; i < pts.length; i += 1) {
        const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= py && y2 > py) || (y2 <= py && y1 > py)) xs.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])); const xb = Math.min(this.canvas._w - 1, Math.round(xs[k + 1]));
        for (let px = xa; px <= xb; px += 1) this.blend(px, py, col);
      }
    }
  }
  stroke() {
    const pts = this.polygonPoints();
    if (pts.length < 2) return;
    const col = parseColor(this.strokeStyle);
    const half = Math.max(0.6, this.lineWidth / 2);
    const closed = this.path.some((s) => s.t === 'Z');
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i += 1) {
      const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(len / 1.5));
      for (let sIdx = 0; sIdx <= steps; sIdx += 1) {
        const cx = x1 + ((x2 - x1) * sIdx) / steps; const cy = y1 + ((y2 - y1) * sIdx) / steps;
        for (let oy = -Math.ceil(half); oy <= Math.ceil(half); oy += 1) {
          for (let ox = -Math.ceil(half); ox <= Math.ceil(half); ox += 1) {
            if (ox * ox + oy * oy <= half * half + 0.5) this.blend(Math.round(cx + ox), Math.round(cy + oy), col);
          }
        }
      }
    }
  }
  fillText(str, x, y) {
    const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(this.font);
    const size = sizeMatch ? Number.parseFloat(sizeMatch[1]) : 16;
    const unitY = size / 7;
    const unitX = size / 8.6; // squeezed to approximate a proportional font's advance
    const col = parseColor(this.fillStyle);
    const s = String(str).toUpperCase();
    const charW = 6 * unitX;
    let totalW = s.length * charW - unitX;
    let startX = x;
    if (this.textAlign === 'center') startX = x - totalW / 2;
    else if (this.textAlign === 'right' || this.textAlign === 'end') startX = x - totalW;
    let topY = y;
    if (this.textBaseline === 'middle') topY = y - (7 * unitY) / 2;
    else if (this.textBaseline === 'alphabetic' || this.textBaseline === 'bottom') topY = y - 7 * unitY;
    // apply transform to origin; scale assumed ~1 in the harness
    const [ox, oy] = this.pt(startX, topY);
    const cellW = Math.max(1, Math.round(unitX));
    const cellH = Math.max(1, Math.round(unitY));
    for (let ci = 0; ci < s.length; ci += 1) {
      const glyph = GLYPHS[s[ci]] || GLYPHS[' '];
      const rows = glyph.split('/');
      for (let ry = 0; ry < 7; ry += 1) {
        for (let rx = 0; rx < 5; rx += 1) {
          if (rows[ry][rx] !== '1') continue;
          const gx = Math.round(ox + ci * charW + rx * unitX);
          const gy = Math.round(oy + ry * unitY);
          for (let py = gy; py < gy + cellH; py += 1) for (let px = gx; px < gx + cellW; px += 1) this.blend(px, py, col);
        }
      }
    }
  }
}

// ---------- PNG ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function toPNG(canvas) {
  const w = canvas._w; const h = canvas._h;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x += 1) {
      const si = (y * w + x) * 4; const di = y * (w * 4 + 1) + 1 + x * 4;
      raw[di] = canvas.buf[si]; raw[di + 1] = canvas.buf[si + 1]; raw[di + 2] = canvas.buf[si + 2]; raw[di + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}


