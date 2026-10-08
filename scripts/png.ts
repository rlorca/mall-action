import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Framebuffer } from '../src/engine/framebuffer';

/** Minimal PNG encoder (RGBA, 8-bit) so agents/devs can LOOK at framebuffers. */
function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Write a framebuffer to a PNG, nearest-neighbour upscaled by `scale` (default 3). */
export function writeFramebufferPng(fb: Framebuffer, path: string, scale = 3): void {
  const rgba = new Uint8ClampedArray(fb.w * fb.h * 4);
  fb.toRGBA(rgba);
  const W = fb.w * scale;
  const H = fb.h * scale;
  const big = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < W; x++) {
      const sx = Math.floor(x / scale);
      const si = (sy * fb.w + sx) * 4;
      const di = (y * W + x) * 4;
      big[di] = rgba[si]!;
      big[di + 1] = rgba[si + 1]!;
      big[di + 2] = rgba[si + 2]!;
      big[di + 3] = 255;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(big, W, H));
}
