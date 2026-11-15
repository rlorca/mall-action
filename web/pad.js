/**
 * The virtual NES pad. Keyboard and gamepad are merged into this; the game only
 * ever sees `Pad`. All timings in the game are in 60 Hz frames.
 */
export const Btn = {
    UP: 1,
    DOWN: 2,
    LEFT: 4,
    RIGHT: 8,
    A: 16, // shoot
    B: 32, // jump (mall), search (store)
    SELECT: 64, // map
    START: 128, // pause, confirm
};
export const BTN_ORDER = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'A', 'B', 'SELECT', 'START'];
export const NO_PAD = Object.freeze({ held: 0, pressed: 0, released: 0 });
export function hasBtn(mask, b) {
    return (mask & b) !== 0;
}
/** Build a Pad from a previous and a current held mask. */
export function padFromHeld(prevHeld, held) {
    return { held, pressed: held & ~prevHeld, released: prevHeld & ~held };
}
/** `maskOf('UP','A')` -> bit mask. Handy for tests and the debug stepper. */
export function maskOf(...names) {
    let m = 0;
    for (const n of names)
        m |= Btn[n];
    return m;
}
/** Parse "UP+A" / "up,a" / "LEFT" into a mask (used by the ?debug=1 stepper). */
export function parseButtons(spec) {
    if (typeof spec === 'number')
        return spec;
    if (!spec)
        return 0;
    let m = 0;
    for (const part of spec.split(/[+,\s|]+/)) {
        const key = part.trim().toUpperCase();
        if (key in Btn)
            m |= Btn[key];
    }
    return m;
}
