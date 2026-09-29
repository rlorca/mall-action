// Events flow OUT of the pure game rules to the audio / rendering layers.
// Rules never import audio or rendering; they push events into an EventSink.

export type SfxName =
  | 'shot' | 'enemyShot' | 'jump' | 'land' | 'thud' | 'ding' | 'hum' | 'crush' | 'lamp' | 'glass'
  | 'tick' | 'fanfare' | 'powerup' | 'hurt' | 'death' | 'door' | 'blip' | 'whistle' | 'ping'
  | 'coin' | 'zip' | 'chime' | 'smoke' | 'shriek' | 'buzzer' | 'pause' | 'beep' | 'flash'
  | 'kick' | 'select' | 'step' | 'elevatorMove' | 'alarm' | 'extraLife';

export type StoreId =
  | 'forever12' | 'radioshock' | 'crookstone' | 'gamestonk'
  | 'kgbtoys' | 'blockblustervideo' | 'spendersgifts'
  | 'sambaddy' | 'sharperimagine' | 'hotspy' | 'circuitpity'
  | 'footlockpicker' | 'borderlinebooks';

export type OpenStoreId = Exclude<StoreId, 'blockblustervideo' | 'circuitpity' | 'borderlinebooks'>;

export type MusicName =
  | 'title' | 'mall' | 'alarm' | 'elevator' | 'booth'
  | `store:${OpenStoreId}`
  | 'jingle:levelclear' | 'jingle:gameover' | 'jingle:itemget' | 'jingle:splash' | 'jingle:package'
  | 'jingle:pa' | 'jingle:continue' | 'jingle:selfie';

export type GameEvent =
  | { t: 'sfx'; name: SfxName }
  | { t: 'music'; name: MusicName | null }
  | { t: 'shake'; frames: number; mag: number }
  | { t: 'banner'; lines: string[]; frames?: number; kind?: 'info' | 'alarm' | 'pa' | 'item' | 'package' | 'floor' }
  | { t: 'popup'; x: number; y: number; text: string; color?: number }
  | { t: 'flash'; frames: number };

export interface EventSink {
  push(ev: GameEvent): void;
}

/** Simple array-backed sink; the app drains it every frame, tests just read it. */
export class EventBuffer implements EventSink {
  events: GameEvent[] = [];
  push(ev: GameEvent): void {
    this.events.push(ev);
  }
  drain(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
  has(pred: (e: GameEvent) => boolean): boolean {
    return this.events.some(pred);
  }
  sfxCount(name: SfxName): number {
    return this.events.filter((e) => e.t === 'sfx' && e.name === name).length;
  }
}
