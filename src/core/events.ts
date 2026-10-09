/**
 * Events flow OUT of the rules: the render / audio layers react to them and never feed back.
 * (kind strings are the contract; keep them in sync with src/audio/sfx.ts and the renderers.)
 */
export interface GameEvent {
  kind: string;
  [k: string]: any;
}

export class EventQueue {
  items: GameEvent[] = [];
  emit(kind: string, data: Record<string, any> = {}): void {
    this.items.push({ kind, ...data });
  }
  /** Take and clear. */
  drain(): GameEvent[] {
    const out = this.items;
    this.items = [];
    return out;
  }
  has(kind: string): boolean {
    return this.items.some((e) => e.kind === kind);
  }
}
