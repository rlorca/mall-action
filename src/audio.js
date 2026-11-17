// Sequencer pitches are semitones above each track's root. A dot holds a rest.
const tracks = {
  title: {bpm:146,root:57,lead:'0 7 12 . 10 7 5 . 3 7 10 12 14 . 7 . 0 7 12 15 14 12 10 7 8 12 17 15 14 12 7 .',bass:[0,3,5,-2],h:[4,7,3,5],beat:'x.h.xhh.',volume:.15},
  mall: {bpm:72,root:55,lead:'. . . . 19 . . . . . . . . . . . . . 16 . . . . . . . . . 21 . . .',bass:[0,-2,-5,-2],h:[7,10,7,5],beat:'........',volume:.046,sparse:true},
  alarm: {bpm:168,root:52,lead:'0 . 0 3 0 . 6 3 0 . 0 5 7 5 3 . 12 13 12 13 . 8 . 7 12 13 12 13 3 . 6 .',bass:[0,0,-2,1],h:[7,6,7,9],beat:'xhhxhhxh',volume:.127},
  elevator: {bpm:94,root:57,lead:'0 . 7 12 10 . 7 5 . 3 7 10 12 . . 7 . 0 7 12 . 15 14 . 10 . 8 12 17 14 7 .',bass:[0,3,5,-2],h:[9,5,9,7],beat:'..h...h.',volume:.085,swing:true},
  fashion: {bpm:125,root:57,lead:'12 . 12 10 . 7 . 10 12 . 15 17 . 15 14 12',bass:[0,0,5,3],h:[7,7,12,10],beat:'xhhhxhhh',volume:.11},
  radio: {bpm:147,root:54,lead:'0 4 7 12 7 4 11 7 2 5 9 14 12 9 5 2 4 7 11 16 14 11 7 4 2 5 9 14 17 14 9 5',bass:[0,2,4,2],h:[7,9,11,9],beat:'x.h.x.h.',volume:.09},
  toys: {bpm:109,root:60,lead:'12 . 16 . 19 16 17 . 16 . 14 . 12 14 16 . 12 9 7 . 14 11 7 .',bass:[0,5,0,-5],h:[7,9,7,11],beat:'x.h.h.',volume:.085,meter:6},
  food: {bpm:156,root:60,lead:'0 4 7 . 12 . 9 7 5 9 12 . 16 14 12 . 7 5 4 2 0 2 4 5 7 . 5 . 4 . 2 .',bass:[0,5,-5,-5],h:[4,9,2,2],beat:'x.h.x.h.',volume:.1},
  sports: {bpm:117,root:55,lead:'0 0 7 . 12 . 7 . 5 5 9 . 14 12 9 . 10 10 14 . 17 14 10 . 7 . 10 7 0 . . .',bass:[0,5,3,-5],h:[7,9,10,7],beat:'x.h.xhhh',volume:.113},
  music: {bpm:128,root:50,lead:'0 0 3 5 . 3 0 . 0 3 6 5 3 0 . . 7 7 10 12 . 10 7 . 5 3 5 6 5 3 0 .',bass:[0,0,7,5],h:[7,7,14,12],beat:'xhh.xhh.',volume:.117},
  crook: {bpm:112,root:58,lead:'16 . . 14 12 . 9 . 10 . 14 . 17 14 . . 15 . 12 . 8 5 . 8 12 14 . 10 . 7 . .',bass:[0,2,-2,-5],h:[9,10,7,10],beat:'x.h..h.h',volume:.083,swing:true},
  sharper: {bpm:83,root:53,lead:'19 . . . 17 . . . 16 . . . 12 . . . 14 . . . 17 . . . 19 . 21 . 16 . . .',bass:[0,4,2,7],h:[7,11,9,14],beat:'....h...',volume:.076,sparse:true},
  gifts: {bpm:158,root:51,lead:'0 7 12 7 10 7 5 3 5 12 17 12 15 12 10 8 3 10 15 10 13 10 8 6 2 9 14 9 12 9 7 .',bass:[0,5,3,2],h:[7,12,10,9],beat:'x.hhx.hh',volume:.105},
  games: {bpm:180,root:57,lead:'12 16 19 24 22 19 16 12 14 17 21 26 24 21 17 14 15 18 22 27 26 22 18 15 17 21 24 29 31 29 24 .',bass:[0,2,3,5],h:[7,9,10,12],beat:'xhhxxhhh',volume:.087},
  sideB: {bpm:138,root:61,lead:'12 14 16 . 19 16 14 . 12 . 11 12 14 16 . . 17 16 14 . 12 14 16 . 19 16 14 11 12 . . .',bass:[0,4,5,7],h:[7,11,12,14],beat:'xhh.xhhh',volume:.11}
};
for (const song of Object.values(tracks)) song.notes = song.lead.split(' ').map(note=>note==='.'?null:Number(note));
const effects = {
  studio:[72,76,79,84],clear:[60,64,67,72,74,76,79,84],package:[69,74,81,86],
  power:[64,69,76],item:[63,67,70,75,79],gameover:[63,60,57,53,48],
  shot:[91,70],foeShot:[61,47],jump:[58,65,72],ding:[91,84],crush:[32,27,22],
  fall:[65,56,49,44],glass:[88,93,64],search:[74],hurt:[47,40],death:[61,55,50,41],
  door:[52,58],text:[69],whistle:[82,90,82,90],ping:[88,74],coin:[82,89],
  slide:[60,66,72],zip:[81,76,70,64,58,52],pa:[72,67,74],smoke:[39,33],
  shriek:[96,90,94],buzzer:[33,29,31],pause:[54,61],tick:[70],
  land:[34],photo:[91,36],alarm:[74,83,74,83,74],toy:[73,77,85],paper:[40,35]
};
const percussion = new Set(['shot','foeShot','crush','glass','zip','land','smoke','photo','paper']);
const long = new Set(['studio','clear','gameover','whistle','alarm']);
const freq = note=>440*2**((note-69)/12);
function pulse(ctx,duty) {
  const real = new Float32Array(20), imag = new Float32Array(20);
  for (let i=1;i<real.length;i++) {
    real[i] = Math.sin(Math.PI*i*duty)*2/(Math.PI*i);
  }
  return ctx.createPeriodicWave(real,imag);
}

export function createSound() {
  let ctx, master, music, hum, humGain, pulses, noise, track, cursor=0, next=0;
  let attempted=false;
  function unlock() {
    const Audio = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!ctx && !attempted && Audio) {
      attempted = true;
      try {
        ctx = new Audio();
        master = ctx.createGain();
        music = ctx.createGain();
        music.connect(master);
        master.gain.value=.28;
        master.connect(ctx.destination);
        pulses = [pulse(ctx,.25),pulse(ctx,.5)];
        noise = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
        const data = noise.getChannelData(0);
        let lfsr=0x5ae1;
        for (let i=0;i<data.length;i++) {
          const feedback=(lfsr^(lfsr>>1))&1;
          lfsr=(lfsr>>1)|(feedback<<14);
          data[i]=(lfsr&1)?1:-1;
        }
        hum = ctx.createOscillator();
        hum.type='triangle';hum.frequency.value=47;
        humGain=ctx.createGain();humGain.gain.value=0;
        hum.connect(humGain).connect(master);
        hum.start();
      } catch {
        ctx = null;
      }
    }
    if (ctx?.state==='suspended') ctx.resume().catch(()=>{});
  }

  function note(shape,pitch,time,duration,level,destination) {
    const osc = shape==='noise'?ctx.createBufferSource():ctx.createOscillator();
    const gate = ctx.createGain();
    if (shape==='noise') {
      osc.buffer=noise;
      osc.playbackRate.value=Math.max(.18,Math.min(2,freq(pitch)/900));
    } else {
      osc.frequency.value=freq(pitch);
      if (shape==='tri') osc.type='triangle';
      else osc.setPeriodicWave(pulses[shape]);
    }
    gate.gain.setValueAtTime(.0001,time);
    gate.gain.exponentialRampToValueAtTime(Math.max(.0002,level),time+.009);
    gate.gain.exponentialRampToValueAtTime(.0001,time+duration);
    osc.connect(gate).connect(destination);
    osc.start(time);osc.stop(time+duration+.01);
    osc.onended=()=>{osc.disconnect();gate.disconnect();};
  }
  function effect(name,time) {
    const melody=effects[name];
    if (!melody) return;
    const interval=long.has(name)?.118:melody.length>4?.059:.044;
    for (const [i,n] of melody.entries()) {
      const type=percussion.has(name)&&i%2===0?'noise':name==='land'?'tri':i%2;
      note(type,n,time+i*interval,interval*1.55,name==='text'?.055:type==='noise'?.09:.15,master);
    }
  }
  function pattern(song,index,time,stepTime) {
    const number=song.notes[index%song.notes.length], bar=Math.floor(index/(song.meter??8))%4;
    const at=index%(song.meter??8);
    if (number!==null) note(0,song.root+number,time,stepTime*(song.sparse?2.9:.83),song.volume,music);
    if (at===0 || !song.sparse && at===4) {
      note('tri',song.root-24+song.bass[bar]+(at===4?7:0),time,stepTime*(song.sparse?7:2.8),song.volume*.72,music);
    }
    if (at===0 || at===3 || !song.sparse && at===6) {
      note(1,song.root+song.h[bar],time,stepTime*(song.sparse?6:1.3),song.volume*(song.sparse?.36:.25),music);
    }
    const drum=song.beat[index%song.beat.length];
    if (drum==='x') note('noise',44,time,.08,song.volume*.5,music);
    if (drum==='h') note('noise',77,time,.045,song.volume*.25,music);
  }
  return {
    unlock,
    active:()=>ctx?.state==='running',
    update(state,name,events) {
      if (!ctx || ctx.state!=='running') return;
      const now=ctx.currentTime;
      master.gain.setTargetAtTime(state.muted?0:.35,now,.028);
      music.gain.setTargetAtTime(state.overlay ? .24 : .78,now,.055);
      humGain.gain.setTargetAtTime(name==='elevator' && !state.overlay ? .028 : 0,now,.08);
      if (!state.muted) for (const event of events) if (event.type==='sound') effect(event.name,now+.01);
      if (track!==name) {
        track=name;cursor=0;next=now+.025;
      }
      const song=tracks[name];
      if (!song) return;
      if (next<now-.09) next=now+.01;
      while (next<now+.10) {
        const duration=60/song.bpm/2*(song.swing?(cursor%2?.82:1.18):1);
        pattern(song,cursor++,next,duration);
        next+=duration;
      }
    }
  };
}
