export const SPLASH_FRAMES = 180;
export const FLICKER_FRAMES = 60;
export const JINGLE_FRAME = FLICKER_FRAMES;
export function splashFrame(frame) {
  return {
    visible: index => frame >= FLICKER_FRAMES || (index + frame) % 2 === 0,
    solid: frame >= FLICKER_FRAMES,
    presents: frame >= 105,
    done: frame >= SPLASH_FRAMES
  };
}
export function drawSplash(pixel, frame, label, presents, rainbow) {
  const stage = splashFrame(frame);
  pixel.rect(0,0,256,240,'#000000');
  for (const [i,letter] of [...label].entries()) {
    if (!stage.visible(i)) continue;
    const x = 18+i*20;
    pixel.text(letter,x+1,96+2,'#303355',4);
    pixel.text(letter,x,96,rainbow[i % rainbow.length],4);
    pixel.rect(x,95,3,1,'#fff2d4');
  }
  if (stage.solid) for (let i=0;i<11;i++) pixel.rect(18+i*20,123,20,2,rainbow[i % rainbow.length]);
  if (stage.presents) pixel.center(presents,128,143,'#fff2d4',1);
}
