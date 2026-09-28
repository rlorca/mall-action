const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteToFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return null;
  const midi = (Number(m[2]) + 1) * 12 + SEMI[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}
export function parseTrack(str) {
  const out = [];
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [name, lenStr] = tok.split(':');
    const len = lenStr ? Number(lenStr) : 1;
    if (!(len > 0)) throw new Error(`bad token ${tok}`);
    if (name === '-') out.push({ note: null, freq: null, len });
    else if (name === 'x' || name === 'X' || name === 'K') out.push({ note: name, freq: null, len });
    else { const f = noteToFreq(name); if (f === null) throw new Error(`bad token ${tok}`); out.push({ note: name, freq: f, len }); }
  }
  return out;
}
