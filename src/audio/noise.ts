// NES-style noise LFSR (pure). Long mode: 32767-step period. Short mode: 93-step period (metallic).

/** Returns `length` samples of -1/+1 from a 15-bit LFSR. */
export function lfsrSequence(mode: 'long' | 'short', length: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(length * 4));
  let reg = 1;
  const tap = mode === 'short' ? 6 : 1;
  for (let i = 0; i < length; i++) {
    const fb = (reg & 1) ^ ((reg >> tap) & 1);
    reg = (reg >> 1) | (fb << 14);
    out[i] = reg & 1 ? 1 : -1;
  }
  return out;
}
