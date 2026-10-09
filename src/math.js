export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function random(s) {
  let x = s.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export const pick = (s, a) => a[Math.floor(random(s) * a.length)];
export const wrap = (text, width) => {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line.length + word.length + 1 > width && line) {
      lines.push(line);
      line = "";
    }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
};
