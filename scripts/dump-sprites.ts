/** Dev tool: render sprites to a PNG sheet so artists (and agents) can look at them. usage: vite-node scripts/dump-sprites.ts out.png [prefix] [scale] */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import '../src/art/index';
import { allSprites, toRGBA } from '../src/art/pixel';

const out = process.argv[2] ?? 'sheet.png';
const prefix = process.argv[3] ?? '';
const scale = Number(process.argv[4] ?? 3);
const list = allSprites().filter((s) => s.name.startsWith(prefix));
const cols = Math.max(1, Math.floor(1100 / ((Math.max(...list.map((s) => s.w)) + 4) * scale)));
// layout: each frame is a cell
const cells: { rgba: Uint8ClampedArray; w: number; h: number }[] = [];
for (const s of list) for (const f of s.frames) cells.push({ rgba: toRGBA(f), w: s.w, h: s.h });
const cw = Math.max(...cells.map((c) => c.w)) + 4;
const ch = Math.max(...cells.map((c) => c.h)) + 4;
const rows = Math.ceil(cells.length / cols);
const W = cols * cw * scale;
const H = rows * ch * scale;
const img = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  img[i * 4] = 40;
  img[i * 4 + 1] = 90;
  img[i * 4 + 2] = 60;
  img[i * 4 + 3] = 255;
}
cells.forEach((c, n) => {
  const ox = (n % cols) * cw * scale + 2 * scale;
  const oy = Math.floor(n / cols) * ch * scale + 2 * scale;
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const o = (y * c.w + x) * 4;
      if (!c.rgba[o + 3]) continue;
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const d = ((oy + y * scale + sy) * W + ox + x * scale + sx) * 4;
          img[d] = c.rgba[o];
          img[d + 1] = c.rgba[o + 1];
          img[d + 2] = c.rgba[o + 2];
          img[d + 3] = 255;
        }
    }
});
function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  Buffer.from(img.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]));
console.log(`wrote ${out}: ${list.length} sprites, ${cells.length} frames`);
