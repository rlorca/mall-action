export const palette = {
  black:'#080711', ink:'#101024', night:'#161530', navy:'#1c2147', blue:'#263665',
  royal:'#3c5189', sky:'#6296c1', ice:'#94e0ec', teal:'#2c747d', aqua:'#42d7c1',
  mint:'#87f0be', pine:'#2d574c', green:'#64ce70', darkGreen:'#244338',
  plum:'#382243', purple:'#583864', violet:'#88559b', lilac:'#be8bc7',
  wine:'#59243f', burgundy:'#80283f', red:'#e34c57', coral:'#ff7c72', pink:'#f167af',
  hotPink:'#b93679', peach:'#ffc38e', cream:'#fff0c6', white:'#fff8e5',
  tan:'#c6956b', brown:'#805342', bark:'#553744', orange:'#f2995f',
  honey:'#efbc67', yellow:'#fbe481', silver:'#9c9cac', grey:'#62647b', slate:'#393950'
};
const glyphs = {
  A:'0e11111f111111',B:'1e11111e11111e',C:'0f10101010100f',D:'1e11111111111e',
  E:'1f10101e10101f',F:'1f10101e101010',G:'0f10101311110f',H:'1111111f111111',
  I:'0e04040404040e',J:'0702020212120c',K:'11121418141211',L:'1010101010101f',
  M:'111b1515111111',N:'11191915131311',O:'0e11111111110e',P:'1e11111e101010',
  Q:'0e11111115120d',R:'1e11111e141211',S:'0f10100e01011e',T:'1f040404040404',
  U:'1111111111110e',V:'11111111110a04',W:'11111115151b11',X:'11110a040a1111',
  Y:'11110a04040404',Z:'1f01020408101f',
  0:'0e11131519110e',1:'040c040404040e',2:'0e11010204081f',3:'1e01010601011e',
  4:'02060a121f0202',5:'1f10101e01011e',6:'0e10101e11110e',7:'1f010204080808',
  8:'0e11110e11110e',9:'0e11110f01010e',
  '!':'04040404040004','?':'0e110102040004','.':'00000000000c0c',',':'00000000000c08',
  ':':'000c0c000c0c00',';':'000c0c000c0c08',"'":'0c0c0800000000','"':'0a0a0000000000',
  '-':'0000001f000000','/':'01010204081010','+':'0004041f040400','=':'00001f001f0000',
  '(':'02040808080402',')':'08040202020408','&':'0c12140a15120d','#':'0a1f0a0a1f0a00',
  '%':'19190204081313','$':'040f140e051e04','*':'00150e1f0e1500','>':'08040201020408',
  '<':'02040810080402','♥':'001b1f1f0e0400','^':'040a1100000000',' ':'00000000000000'
};
const tiny = {
  A:'25755',B:'65656',C:'34443',D:'65556',E:'74647',F:'74644',G:'34553',H:'55755',
  I:'72227',J:'11152',K:'55655',L:'44447',M:'57755',N:'57775',O:'25552',P:'65644',
  Q:'25573',R:'65655',S:'34616',T:'72222',U:'55557',V:'55552',W:'55777',X:'55255',
  Y:'55222',Z:'71247',0:'25752',1:'26227',2:'61247',3:'61216',4:'55711',5:'74616',
  6:'34652',7:'71244',8:'25252',9:'25316','!':'22202','?':'61202','.':'00002',',':'00024',
  ':':'02020',';':'02024',"'":'22000','"':'55000','-':'00700','/':'11244','+':'02720',
  '=':'07070','(':'24442',')':'21112','&':'25353','#':'57575','%':'51245','$':'23662',
  '*':'05750','>':'42124','<':'12421','♥':'05772','^':'25000',' ':'00000'
};
const glyphRows = Object.fromEntries(Object.entries(glyphs).map(([letter,rows])=>[
  letter,[...rows.matchAll(/../g)].map(row=>parseInt(row[0],16))
]));
const tinyRows = Object.fromEntries(Object.entries(tiny).map(([letter,rows])=>[letter,[...rows].map(Number)]));

export function textWidth(string,scale=1,small=false) {
  return Math.max(0,([...String(string)].length*(small?4:6)-1)*scale);
}
export function sprite(width,height,colors,paint) {
  if (colors.length>3 || colors.some(color=>!Object.hasOwn(palette,color))) throw new Error('Invalid sprite palette');
  const pixels = new Uint8Array(width*height);
  paint((x,y,w,h,ink)=>{
    for (let yy=Math.max(0,y);yy<Math.min(height,y+h);yy++) {
      for (let xx=Math.max(0,x);xx<Math.min(width,x+w);xx++) pixels[yy*width+xx]=ink;
    }
  });
  return {width,height,colors,pixels};
}
const tone = color => palette[color] ?? color;
export function makePixel(ctx) {
  const cache = new WeakMap();
  function rect(x,y,w,h,color) {
    ctx.fillStyle = tone(color);
    ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
  }
  function line(x,y,endX,endY,color) {
    x=Math.round(x); y=Math.round(y); endX=Math.round(endX); endY=Math.round(endY);
    const dx=Math.abs(endX-x),dy=-Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;
    let error=dx+dy;
    while (true) {
      rect(x,y,1,1,color);
      if (x===endX && y===endY) return;
      const e=2*error;
      if (e>=dy) {error+=dy;x+=sx;}
      if (e<=dx) {error+=dx;y+=sy;}
    }
  }
  function text(value,x,y,color='cream',scale=1,small=false) {
    const width=small?3:5, table=small?tinyRows:glyphRows;
    for (const char of String(value).toUpperCase()) {
      const rows=table[char]??table['?'];
      for (const [j,bits] of rows.entries()) for (let i=0;i<width;i++) {
        if (bits & (1 << (width-1-i))) rect(x+i*scale,y+j*scale,scale,scale,color);
      }
      x+=(width+1)*scale;
    }
  }
  function image(asset,x,y,{frame=0,flip=false,scale=1}={}) {
    const source = Array.isArray(asset)?asset[frame%asset.length]:asset;
    let stamp = cache.get(source);
    if (!stamp) {
      stamp = document.createElement('canvas');
      stamp.width=source.width; stamp.height=source.height;
      const sc=stamp.getContext('2d');
      for (let iy=0;iy<source.height;iy++) for (let ix=0;ix<source.width;ix++) {
        const value=source.pixels[iy*source.width+ix];
        if (!value) continue;
        sc.fillStyle=tone(source.colors[value-1]);
        sc.fillRect(ix,iy,1,1);
      }
      cache.set(source,stamp);
    }
    ctx.save();
    ctx.translate(Math.round(x)+(flip?source.width*scale:0),Math.round(y));
    if (flip) ctx.scale(-1,1);
    ctx.drawImage(stamp,0,0,source.width*scale,source.height*scale);
    ctx.restore();
  }
  return {
    ctx,rect,line,text,image,
    outline(x,y,w,h,color) {
      rect(x,y,w,1,color); rect(x,y+h-1,w,1,color); rect(x,y+1,1,h-2,color); rect(x+w-1,y+1,1,h-2,color);
    },
    center(value,x,y,color,scale=1,small=false) { text(value,x-Math.floor(textWidth(value,scale,small)/2),y,color,scale,small); },
    right(value,x,y,color,scale=1,small=false) { text(value,x-textWidth(value,scale,small),y,color,scale,small); },
    clip(x,y,w,h,paint) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      paint();
      ctx.restore();
    },
    alpha(amount,paint) {
      ctx.save(); ctx.globalAlpha*=amount; paint(); ctx.restore();
    }
  };
}

export function wrap(text,limit) {
  const lines=[];
  let current='';
  for (const word of text.split(' ')) {
    if ((current+' '+word).trim().length>limit && current) {
      lines.push(current); current=word;
    } else current=(current+' '+word).trim();
  }
  if (current) lines.push(current);
  return lines;
}
