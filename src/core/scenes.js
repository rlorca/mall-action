export const FADE_FRAMES = 12;

export class SceneManager {
  constructor({ layer, overlayLayer, setFade }, ctx) {
    Object.assign(this, { layer, overlayLayer, setFade, ctx });
    this.scene = null; this.overlays = []; this.pending = null; this.fadeT = 0; this.fadeDir = 0;
  }
  get fading() { return this.fadeDir !== 0; }
  _swap() {
    const { scene, params } = this.pending; this.pending = null;
    if (this.scene) { this.scene.exit(this.ctx); this.layer.removeChild(this.scene.container); }
    this.scene = scene; this.layer.addChild(scene.container); scene.enter(this.ctx, params);
  }
  replace(scene, params = {}, { fade = true } = {}) {
    while (this.overlays.length) this.pop();
    this.pending = { scene, params };
    if (!fade) { this._swap(); return; }
    this.fadeDir = 1; this.fadeT = 0;
  }
  push(overlay, params = {}) { this.overlays.push(overlay); this.overlayLayer.addChild(overlay.container); overlay.enter(this.ctx, params); }
  pop() { const o = this.overlays.pop(); if (!o) return; o.exit(this.ctx); this.overlayLayer.removeChild(o.container); }
  update() {
    if (this.fadeDir === 1) {
      this.fadeT++; this.setFade(this.fadeT / FADE_FRAMES);
      if (this.fadeT >= FADE_FRAMES) { this._swap(); this.fadeDir = -1; }
      return;
    }
    if (this.fadeDir === -1) {
      this.fadeT--; this.setFade(this.fadeT / FADE_FRAMES);
      if (this.fadeT <= 0) this.fadeDir = 0;
      return;
    }
    (this.overlays.at(-1) ?? this.scene)?.update(this.ctx);
  }
}
