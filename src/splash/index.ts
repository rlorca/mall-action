/** Reusable FLICKERSOFT identity. Frame units; no DOM or audio dependencies. */
export const duration = 180;
export function splash(frame: number) {
  return {
    letters: "FLICKERSOFT".split("").map((char, index) => ({
      char,
      visible: frame >= 60 || (frame + index) % 2 === 0,
    })),
    underline: frame >= 60,
    presents: frame >= 100,
    jingle: frame === 60,
    done: frame >= duration,
  };
}
