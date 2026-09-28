import { Container } from 'pixi.js';
import { makeText } from '../gfx/font.js';
// Temporary stand-in for scenes not built yet (removed when MallScene lands).
export class PlaceholderScene {
  constructor(label) { this.container = new Container(); this.label = label; }
  enter() { this.container.removeChildren(); const t = makeText(this.label); t.position.set(100, 116); this.container.addChild(t); }
  update() {}
  exit() {}
}
