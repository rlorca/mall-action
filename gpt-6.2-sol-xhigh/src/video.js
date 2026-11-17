import {H,W} from './data.js';

export function fitViewport(width,height) {
  const maximum = Math.min(width/W,height/H);
  const scale = Math.floor(maximum) || maximum;
  return {
    width:Math.floor(W*scale),height:Math.floor(H*scale),
    x:Math.floor((width-W*scale)/2),y:Math.floor((height-H*scale)/2)
  };
}

export function createVideo(output,source) {
  const context=output.getContext('2d',{alpha:false});
  if (!context) return null;
  context.imageSmoothingEnabled=false;
  const mask=document.createElement('canvas');
  mask.width=W;mask.height=H;
  const crt=mask.getContext('2d');
  for(let y=1;y<H;y+=2) {
    crt.fillStyle='rgba(5,4,14,.23)';crt.fillRect(0,y,W,1);
  }
  const gradient=crt.createRadialGradient(W/2,H/2,74,W/2,H/2,169);
  gradient.addColorStop(0,'rgba(6,4,14,0)');
  gradient.addColorStop(.58,'rgba(6,4,14,.07)');
  gradient.addColorStop(1,'rgba(6,4,14,.50)');
  crt.fillStyle=gradient;crt.fillRect(0,0,W,H);
  const rowStarts=Array.from({length:H},(_,y)=>Math.round(3*((y-(H-1)/2)/(H/2))**2));
  return {
    resize(width,height) {
      const size=fitViewport(width,height);
      Object.assign(output.style,{left:size.x+'px',top:size.y+'px',width:size.width+'px',height:size.height+'px'});
    },
    present(enabled,frame) {
      if (!enabled) {
        context.drawImage(source,0,0);
        return;
      }
      context.fillStyle='#000';context.fillRect(0,0,W,H);
      for (let y=0;y<H;y++) {
        const x=rowStarts[y];
        context.drawImage(source,0,y,W,1,x,y,W-2*x,1);
      }
      context.drawImage(mask,0,0);
      context.fillStyle='rgba(248,226,236,.085)';
      let noise=(frame%11+1)*104729;
      for(let i=0;i<150;i++) {
        noise=(noise*16807)%2147483647;
        context.fillRect(noise&255,(noise>>>8)%H,1,1);
      }
    }
  };
}
