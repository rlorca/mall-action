import { Container, Sprite } from 'pixi.js';
import { textureFromGrid } from './textures.js';
import { C } from './palette.js';
import { GLYPHS } from './glyphs.js';

const cache = new Map(); // `${ch}|${color}` → Texture
function glyphTex(ch, color) {
  const key = `${ch}|${color}`;
  if (!cache.has(key)) cache.set(key, textureFromGrid(GLYPHS[ch] ?? GLYPHS['?'], [color]));
  return cache.get(key);
}
export function measure(str) {
  const lines = String(str).split('\n');
  return { w: Math.max(...lines.map((l) => l.length)) * 8, h: lines.length * 8 };
}
export function makeText(str, color = C.white) {
  const c = new Container();
  fillText(c, str, color);
  return c;
}
function fillText(c, str, color) {
  String(str).toUpperCase().split('\n').forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === ' ') return;
      const s = new Sprite(glyphTex(ch, color));
      s.position.set(col * 8, row * 8); c.addChild(s);
    });
  });
}
export function setText(container, str, color = C.white) {
  container.removeChildren().forEach((ch) => ch.destroy());
  fillText(container, str, color);
}
