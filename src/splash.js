import {drawText} from './font.js';
const rainbow=['#f74657','#ff8060','#ffca61','#f8ef70','#78d779','#4a8ec9','#9168b7','#f7a8c7','#ffca61','#78d779','#4a8ec9','#f74657'];
export function splashVisible(letterIndex,frame){return frame>=60||((frame+letterIndex)&1)===0}
export function drawSplash(ctx,frame){ctx.fillStyle='#0c0b18';ctx.fillRect(0,0,256,240);const word='FLICKERSOFT';for(let i=0;i<word.length;i++)if(splashVisible(i,frame))drawText(ctx,word[i],16+i*19,100,rainbow[i],4);if(frame>=65){ctx.fillStyle='#f8ef70';ctx.fillRect(20,130,216,3)}if(frame>=95)drawText(ctx,'PRESENTS',128,157,'#e1c9aa',2,'center')}
