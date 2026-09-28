export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function gridToRGBA(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  const cache = pal.map(hexToRgb);
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error('ragged grid');
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      const idx = parseInt(ch, 36) - 1;
      const rgb = cache[idx];
      if (!rgb || Number.isNaN(idx)) throw new Error(`bad pixel "${ch}"`);
      const o = (y * w + x) * 4;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
    }
  }
  return { w, h, data };
}
