import { Btn } from './pad.js';
/**
 * Letter keys are matched by the PRINTED letter (`event.key`), so QWERTZ and
 * AZERTY layouts get the letters they see on their keycaps. Everything else
 * (arrows, space, enter, shift, tab) is matched by physical position
 * (`event.code`). A letter that has no mapping falls back to its physical position.
 */
const LETTER_MAP = {
    w: { btn: Btn.UP },
    a: { btn: Btn.LEFT },
    s: { btn: Btn.DOWN },
    d: { btn: Btn.RIGHT },
    z: { btn: Btn.A },
    j: { btn: Btn.A },
    x: { btn: Btn.B },
    k: { btn: Btn.B },
    c: { sys: 'crt' },
    m: { sys: 'mute' },
};
const CODE_MAP = {
    ArrowUp: { btn: Btn.UP },
    ArrowDown: { btn: Btn.DOWN },
    ArrowLeft: { btn: Btn.LEFT },
    ArrowRight: { btn: Btn.RIGHT },
    KeyW: { btn: Btn.UP },
    KeyA: { btn: Btn.LEFT },
    KeyS: { btn: Btn.DOWN },
    KeyD: { btn: Btn.RIGHT },
    KeyZ: { btn: Btn.A },
    KeyJ: { btn: Btn.A },
    KeyX: { btn: Btn.B },
    KeyK: { btn: Btn.B },
    Space: { btn: Btn.B },
    ShiftLeft: { btn: Btn.SELECT },
    ShiftRight: { btn: Btn.SELECT },
    Tab: { btn: Btn.SELECT },
    Enter: { btn: Btn.START },
    NumpadEnter: { btn: Btn.START },
    KeyC: { sys: 'crt' },
    KeyM: { sys: 'mute' },
};
/** Fallback when `code` is empty (some virtual keyboards / synthetic events). */
const KEYNAME_MAP = {
    ArrowUp: { btn: Btn.UP },
    ArrowDown: { btn: Btn.DOWN },
    ArrowLeft: { btn: Btn.LEFT },
    ArrowRight: { btn: Btn.RIGHT },
    ' ': { btn: Btn.B },
    Shift: { btn: Btn.SELECT },
    Tab: { btn: Btn.SELECT },
    Enter: { btn: Btn.START },
};
const LETTER_RE = /^\p{L}$/u;
export function resolveKey(key, code) {
    if (key && key.length <= 2 && LETTER_RE.test(key)) {
        const byLetter = LETTER_MAP[key.toLowerCase()];
        if (byLetter)
            return byLetter;
        // Unmapped letter -> physical position.
        return CODE_MAP[code] ?? null;
    }
    if (code && CODE_MAP[code])
        return CODE_MAP[code];
    if (!code)
        return KEYNAME_MAP[key] ?? null;
    return null;
}
/**
 * Tracks which physical keys are down. A key release always clears exactly the
 * physical key that was pressed (looked up by `code`), no matter what the
 * keyboard layout / Shift / AltGr now reports as `key`, so keys never get stuck.
 */
export class KeyboardState {
    active = new Map();
    sys = [];
    keyDown(key, code, repeat = false) {
        const id = code || `key:${key}`;
        if (this.active.has(id))
            return; // auto-repeat or duplicate
        const action = resolveKey(key, code);
        if (!action)
            return;
        this.active.set(id, { action, key });
        if ('sys' in action && !repeat)
            this.sys.push(action.sys);
    }
    keyUp(key, code) {
        if (code) {
            this.active.delete(code);
            return;
        }
        // No physical code: clear whatever was pressed with this key (case-insensitive).
        for (const [id, a] of this.active) {
            if (id.startsWith('key:') && a.key.toLowerCase() === key.toLowerCase())
                this.active.delete(id);
        }
    }
    releaseAll() {
        this.active.clear();
    }
    held() {
        let m = 0;
        for (const a of this.active.values())
            if ('btn' in a.action)
                m |= a.action.btn;
        return m;
    }
    drainSystem() {
        const out = this.sys;
        this.sys = [];
        return out;
    }
}
const STICK_DEADZONE = 0.5;
/** Standard-mapping gamepad -> virtual pad mask. A=0 shoot, B=1 jump, Select=8, Start=9, D-pad 12..15, left stick. */
export function gamepadMask(gp) {
    let m = 0;
    const b = (i) => !!gp.buttons[i]?.pressed;
    if (b(0))
        m |= Btn.A;
    if (b(1))
        m |= Btn.B;
    if (b(8))
        m |= Btn.SELECT;
    if (b(9))
        m |= Btn.START;
    if (b(12))
        m |= Btn.UP;
    if (b(13))
        m |= Btn.DOWN;
    if (b(14))
        m |= Btn.LEFT;
    if (b(15))
        m |= Btn.RIGHT;
    const ax = gp.axes[0] ?? 0;
    const ay = gp.axes[1] ?? 0;
    if (ax < -STICK_DEADZONE)
        m |= Btn.LEFT;
    if (ax > STICK_DEADZONE)
        m |= Btn.RIGHT;
    if (ay < -STICK_DEADZONE)
        m |= Btn.UP;
    if (ay > STICK_DEADZONE)
        m |= Btn.DOWN;
    return m;
}
const BITS = [Btn.UP, Btn.DOWN, Btn.LEFT, Btn.RIGHT, Btn.A, Btn.B, Btn.SELECT, Btn.START];
const MAX_QUEUE = 16;
/**
 * Merges keyboard + gamepad into the virtual pad and hands the simulation one
 * `Pad` per fixed step via `sampleStep()`.
 *
 * Tap queue: raw press/release transitions that arrive between animation frames
 * are queued per button, and each simulation step consumes AT MOST ONE
 * transition per button. So a tap that begins and ends inside a single animation
 * frame (when several simulation steps run at once) still produces a press on
 * step N and a release on step N+1; fast repeated taps are never lost.
 */
export class Input {
    keyboard = new KeyboardState();
    gp = 0;
    live = 0;
    seen = 0;
    pending = BITS.map(() => []);
    sysQueue = [];
    /** Call after any keyboard / gamepad change (the DOM adapter does this). */
    sync() {
        const now = this.keyboard.held() | this.gp;
        const diff = now ^ this.live;
        if (diff) {
            for (let i = 0; i < BITS.length; i++) {
                const bit = BITS[i];
                if (diff & bit) {
                    const q = this.pending[i];
                    if (q.length < MAX_QUEUE)
                        q.push((now & bit) !== 0);
                }
            }
            this.live = now;
        }
        for (const s of this.keyboard.drainSystem())
            this.sysQueue.push(s);
    }
    keyDown(key, code, repeat = false) {
        this.keyboard.keyDown(key, code, repeat);
        this.sync();
    }
    keyUp(key, code) {
        this.keyboard.keyUp(key, code);
        this.sync();
    }
    /** Window blur / visibility change: release everything. */
    releaseAll() {
        this.keyboard.releaseAll();
        this.gp = 0;
        this.sync();
    }
    /** Set the merged gamepad mask (0 when no pad is connected). Call once per animation frame. */
    setGamepad(mask) {
        if (mask === this.gp)
            return;
        this.gp = mask;
        this.sync();
    }
    /** Inject a press+release pair (virtual tap), e.g. from the debug API. */
    tap(mask) {
        for (let i = 0; i < BITS.length; i++) {
            if (mask & BITS[i]) {
                const q = this.pending[i];
                q.push(true, false);
            }
        }
    }
    /** Called once per simulation step. */
    sampleStep() {
        let pressed = 0;
        let released = 0;
        for (let i = 0; i < BITS.length; i++) {
            const q = this.pending[i];
            if (q.length === 0)
                continue;
            const down = q.shift();
            const bit = BITS[i];
            if (down && !(this.seen & bit)) {
                this.seen |= bit;
                pressed |= bit;
            }
            else if (!down && this.seen & bit) {
                this.seen &= ~bit;
                released |= bit;
            }
        }
        return { held: this.seen, pressed, released };
    }
    drainSystem() {
        const out = this.sysQueue;
        this.sysQueue = [];
        return out;
    }
    /** Currently-down mask as of right now (for the "press any button" checks outside the sim). */
    liveHeld() {
        return this.live;
    }
}
