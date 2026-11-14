import {SCORES} from './score.js';
const TAU=Math.PI*2;
const frequency=midi=>440*2**((midi-69)/12);
// PolyBLEP smooths a pulse edge at the sample boundary, reducing brittle high harmonics.
function blep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1}return 0}
class Voice{
 constructor(rate,kind){this.rate=rate;this.kind=kind;this.phase=0;this.frequency=220;this.age=1e9;this.length=0;this.volume=0;this.duty=.5;}
 note(midi,duration,volume,duty=.5){this.frequency=frequency(midi);this.age=0;this.length=Math.max(1,Math.round(duration*this.rate));this.volume=volume;this.duty=duty;}
 sample(){const dt=Math.min(.2,this.frequency/this.rate);const t=this.phase;this.phase=(t+dt)%1;this.age++;
  if(this.age>=this.length)return 0;
  const attack=Math.min(1,this.age/(this.rate*.009));const release=Math.min(1,(this.length-this.age)/(this.rate*.025));
  const decay=.65+.35*Math.exp(-this.age/(this.rate*.06));
  let wave;if(this.kind==='triangle'){wave=1-4*Math.abs(t-.5)}else{wave=(t<this.duty?1:-1)+blep(t,dt)-blep((t+1-this.duty)%1,dt);wave-=2*this.duty-1;}
  return wave*this.volume*attack*release*decay;
 }
 stop(){this.age=this.length;}
}
/** Sample-clock transport; process() requires no timers, browser frames or wall clock. */
export class Synth{
 constructor(rate=48000){this.rate=rate;this.voices=[new Voice(rate,'pulse'),new Voice(rate,'pulse'),new Voice(rate,'triangle')];this.track='';this.pending=null;this.step=0;this.remaining=0;this.samples=0;this.stepsPlayed=0;this.fade=0;this.transition=0;this.duck=1;this.duckTarget=1;this.noiseSeed=0x517acafe;this.noiseAge=1e9;this.noiseLength=0;this.noiseVolume=0;this.noiseFilter=0;this.lowpass=0;this.previousInput=0;this.highpass=0;}
 setTrack(key){key=key&&SCORES[key]?key:'';if(key===this.track&&this.pending===null||key===this.pending)return;this.pending=key;this.transition=Math.max(1,Math.round(this.rate*.015));}
 setDuck(value){this.duckTarget=Math.max(0,Math.min(1,value));}
 trigger(){const score=SCORES[this.track];if(!score)return;
  const n=this.step++;if(score.once&&n>=score.lead.length)return;
  const meter=score.meter??4,bar=meter*2,chord=score.chords[Math.floor(n/bar)%score.chords.length];
  const duration=60/score.bpm/2,note=score.lead[n%score.lead.length];
  if(note>=0)this.voices[0].note(score.root+12+note,duration*(score.ambient?2.8:.9),score.ambient?.018:score.soft?.075:.10,.375);
  if(!score.ambient&&n%2===1){const harmony=chord[Math.floor(n/2)%3];this.voices[1].note(score.root+harmony,duration*.72,score.soft?.025:.035,.5);}
  if(n%2===0){const bass=chord[0]+(Math.floor(n/2)%2===1?7:0);this.voices[2].note(score.root-12+bass,duration*1.9,score.ambient?.055:.12);}
  if(!score.ambient&&!score.soft){this.noiseAge=0;this.noiseLength=Math.round(this.rate*(n%4===2?.07:.025));this.noiseVolume=n%4===2?.024:.009;}
  this.stepsPlayed++;
 }
 sample(){this.samples++;
  if(this.pending!==null){this.fade=Math.max(0,this.fade-1/(this.rate*.015));if(--this.transition<=0){this.track=this.pending;this.pending=null;this.step=0;this.remaining=0;this.fade=0;for(const v of this.voices)v.stop();this.noiseAge=1e9;}}
  else this.fade=Math.min(1,this.fade+1/(this.rate*.025));
  const score=SCORES[this.track];if(score){if(this.remaining<=0){this.trigger();this.remaining+=this.rate*60/score.bpm/2;}this.remaining--;}
  let sample=0;for(const v of this.voices)sample+=v.sample();
  if(++this.noiseAge<this.noiseLength){let x=this.noiseSeed;x^=x<<13;x^=x>>>17;x^=x<<5;this.noiseSeed=x>>>0;const white=this.noiseSeed/2147483648-1;this.noiseFilter+=.12*(white-this.noiseFilter);sample+=this.noiseFilter*this.noiseVolume*(1-this.noiseAge/this.noiseLength);}
  // A gentle low-pass and DC blocker keep pulse voices warm and avoid clicks/DC offset.
  this.lowpass+=.36*(sample-this.lowpass);this.highpass=this.lowpass-this.previousInput+.997*this.highpass;this.previousInput=this.lowpass;
  this.duck+=(this.duckTarget-this.duck)*.001;
  return this.highpass*this.fade*this.duck;
 }
 process(output){for(let i=0;i<output.length;i++)output[i]=this.sample();}
 status(){return {track:this.track,samples:this.samples,steps:this.stepsPlayed,voices:this.voices.filter(v=>v.age<v.length).length};}
}
