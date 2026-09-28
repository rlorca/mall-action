// Helpers for authoring pixel grids. Everything here returns plain string arrays.

// Pad every row to width w with '.', and pad/crop to height h (extra rows added on top when `bottom` is true).
export function pad(rows, w, h = rows.length, { bottom = false } = {}) {
  const out = rows.map((r) => {
    if (r.length > w) throw new Error(`row too long (${r.length} > ${w}): "${r}"`);
    return r.padEnd(w, '.');
  });
  const blank = '.'.repeat(w);
  while (out.length < h) bottom ? out.unshift(blank) : out.push(blank);
  if (out.length > h) throw new Error(`too many rows (${out.length} > ${h})`);
  return out;
}

// Build a grid from a function (x, y) → pixel char.
export function grid(w, h, fn) {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => fn(x, y) || '.').join(''));
}

// Paint `src` onto `dst` at (ox, oy); '.' in src is transparent.
export function stamp(dst, src, ox = 0, oy = 0) {
  const out = dst.map((r) => r.split(''));
  src.forEach((row, y) => [...row].forEach((ch, x) => {
    const X = x + ox, Y = y + oy;
    if (ch !== '.' && out[Y] && X >= 0 && X < out[Y].length) out[Y][X] = ch;
  }));
  return out.map((r) => r.join(''));
}

export const blank = (w, h) => Array.from({ length: h }, () => '.'.repeat(w));
export const flipH = (rows) => rows.map((r) => [...r].reverse().join(''));
export const shift = (rows, dy) => {
  const w = rows[0].length;
  const b = '.'.repeat(w);
  return dy >= 0 ? [...Array(dy).fill(b), ...rows.slice(0, rows.length - dy)] : [...rows.slice(-dy), ...Array(-dy).fill(b)];
};
// Replace one slot char with another (recolour inside a single sprite).
export const swap = (rows, from, to) => rows.map((r) => r.split(from).join(to));

export const disc = (w, h, cx, cy, r, ch) => grid(w, h, (x, y) => ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r ? ch : '.'));
