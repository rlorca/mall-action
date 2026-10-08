// Events the rules emit. The renderer and audio react to these; the rules never call them directly.
import type { PowerUpId } from './powerups';
import type { SpygramPost } from './copy';

export type SfxName =
  | 'shot'
  | 'enemyShot'
  | 'jump'
  | 'ding'
  | 'crush'
  | 'lamp'
  | 'glass'
  | 'search'
  | 'package'
  | 'powerup'
  | 'hurt'
  | 'death'
  | 'door'
  | 'blip'
  | 'whistle'
  | 'ping'
  | 'coin'
  | 'zip'
  | 'thud'
  | 'pa'
  | 'smoke'
  | 'shriek'
  | 'buzzer'
  | 'pause'
  | 'selfie'
  | 'kick'
  | 'extraLife'
  | 'itemGet'
  | 'alarm'
  | 'mop'
  | 'flash'
  | 'levelClear'
  | 'gameOver'
  | 'pop';

export type MallEvent =
  | { type: 'sfx'; name: SfxName }
  | { type: 'banner'; lines: readonly string[]; frames: number }
  | { type: 'score'; points: number; x: number; y: number }
  | { type: 'death'; cause: string }
  | { type: 'enterStore'; storeId: string }
  | { type: 'levelClear' }
  | { type: 'pkgsLeft'; n: number }
  | { type: 'spygram'; post: SpygramPost }
  | { type: 'bubble'; x: number; y: number; text: string }
  | { type: 'kiosk'; storeId: string | null }
  | { type: 'photo' }
  | { type: 'copCaught' }
  | { type: 'extraLife' }
  | { type: 'alarm' }
  | { type: 'pickup'; id: PowerUpId }
  | { type: 'hurt' };

export type StoreEvent =
  | { type: 'sfx'; name: SfxName }
  | { type: 'banner'; lines: readonly string[]; frames: number }
  | { type: 'score'; points: number; x: number; y: number }
  | { type: 'packageFound'; storeId: string; index: number }
  | { type: 'powerUp'; id: PowerUpId }
  | { type: 'death'; cause: string }
  | { type: 'exit' }
  | { type: 'bubble'; x: number; y: number; text: string }
  | { type: 'easterEgg'; item: string }
  | { type: 'sideB' }
  | { type: 'hurt' };
