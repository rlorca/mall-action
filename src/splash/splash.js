// Renderer-agnostic, reusable studio ident. Time is always in 60 Hz frames.
export const DURATION = 180;
export function splashFrame(frame) {
  return {
    letters: [..."FLICKERSOFT"].map((letter, i) => ({
      letter,
      visible: frame >= 60 || (frame + i) % 2 === 0,
      color: i % 6,
    })),
    underline: frame >= 60,
    presents: frame >= 100,
    jingle: frame === 60,
    done: frame >= DURATION,
  };
}
