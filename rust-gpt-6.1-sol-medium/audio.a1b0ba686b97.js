import {SCORES,STORE_TRACKS} from './score.a1b0ba686b97.js';
export {SCORES} from './score.a1b0ba686b97.js';
export class AudioEngine{
 constructor(){this.ctx=null;this._mute=false;this.started=false;this.starting=null;this.track='';this.hidden=false;this.lastState=null;this.nodes=new Set;this.metrics={voices:0,samples:0,steps:0};this.error=null;}
 get mute(){return this._mute;}
 set mute(value){this._mute=!!value;this.applyGain();}
 applyGain(){if(!this.master)return;const value=this._mute?0:.65;if(value!==this.lastVolume){this.lastVolume=value;this.master.gain.setTargetAtTime(value,this.ctx.currentTime,.025);}}
 async start(){
  if(this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});
  if(this.starting)return this.starting;
  if(this.ctx&&this.node){if(this.ctx.state==='suspended')await this.ctx.resume().catch(()=>{});this.started=this.ctx.state==='running';return;}
  this.starting=this.initialize();await this.starting;this.starting=null;
 }
 async initialize(){try{
  if(!this.ctx)this.ctx=new (globalThis.AudioContext||globalThis.webkitAudioContext)({latencyHint:'interactive'});
  await this.ctx.resume();
  this.master=this.ctx.createGain();this.master.gain.value=.65;
  this.musicBus=this.ctx.createGain();this.fxBus=this.ctx.createGain();this.fxBus.gain.value=.28;
  this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=6500;this.filter.Q.value=.5;
  this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-12;this.compressor.knee.value=12;this.compressor.ratio.value=4;this.compressor.attack.value=.006;this.compressor.release.value=.12;
  this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=2048;
  this.musicBus.connect(this.master);this.fxBus.connect(this.master);this.master.connect(this.filter).connect(this.compressor).connect(this.analyser).connect(this.ctx.destination);
  this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);let x=98765;const a=this.noise.getChannelData(0);for(let i=0;i<a.length;i++){x^=x<<13;x^=x>>>17;x^=x<<5;a[i]=(x>>>0)/2147483648-1;}
  await this.ctx.audioWorklet.addModule(new URL('./synth-worklet.a1b0ba686b97.js',import.meta.url));
  this.node=new AudioWorkletNode(this.ctx,'mall-synth',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});
  this.node.port.onmessage=({data})=>{this.metrics=data;};this.node.onprocessorerror=()=>{this.error='Audio processor stopped';};this.node.connect(this.musicBus);
  this.started=this.ctx.state==='running';this.track='';if(this.lastState)this.music(this.lastState);
 }catch(error){this.error=String(error.message??error);this.started=false;}}
 tone(freq,t,dur,type='square',vol=.2){if(!this.node||this.mute)return;const o=this.ctx.createOscillator(),v=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(vol,t+.008);v.gain.exponentialRampToValueAtTime(.001,t+Math.max(.012,dur));o.connect(v).connect(this.fxBus);o.start(t);o.stop(t+dur+.01);this.nodes.add(o);o.onended=()=>{o.disconnect();v.disconnect();this.nodes.delete(o);};}
 hiss(dur=.1,vol=.1){if(!this.node||this.mute)return;const t=this.ctx.currentTime,n=this.ctx.createBufferSource(),v=this.ctx.createGain(),f=this.ctx.createBiquadFilter();n.buffer=this.noise;f.type='lowpass';f.frequency.value=1800;v.gain.setValueAtTime(vol,t);v.gain.exponentialRampToValueAtTime(.001,t+dur);n.connect(f).connect(v).connect(this.fxBus);n.start(t);n.stop(t+dur);n.onended=()=>{n.disconnect();v.disconnect();f.disconnect();};}
 fx(n){if(!this.node||this.mute)return;const t=this.ctx.currentTime;switch(n){case 1:this.tone(150,t,.055,'square',.28);this.hiss(.035,.07);break;case 2:this.tone(220,t,.09);this.tone(440,t+.04,.09);break;case 3:this.tone(880,t,.25,'triangle',.5);this.tone(1320,t+.06,.3,'triangle',.25);break;case 4:this.tone(95,t,.07);break;case 5:case 7:case 15:this.hiss(.22);this.tone(60,t,.18,'triangle',.4);break;case 6:this.tone(440,t,.025);break;case 8:{const score=SCORES[this.track];const base=440*2**(((score?.root??60)+12-69)/12);const third=score?score.chords[0][1]-score.chords[0][0]:4;[0,third,7,12].forEach((n,i)=>this.tone(base*2**(n/12),t+i*.09,.18,'triangle',.22));break;}case 11:this.tone(1100,t,.06);this.tone(1650,t+.06,.1);break;case 12:this.tone(100,t,.17);break;case 13:this.tone(1000,t,.2,'triangle',.2);break;case 16:[660,550,440].forEach((f,i)=>this.tone(f,t+i*.16,.3,'triangle'));break;default:this.tone(300,t,.06,'triangle');}}
 music(state){this.lastState=state;if(!this.node)return;
  const key=state.scene===0||state.scene===9?'':state.scene===5?(state.bonusTrack?'sideb':STORE_TRACKS[state.store]):state.scene===4?(state.lift>=0?'elevator':state.alarm?'alarm':'ambient'):state.scene===6?'clear':state.scene===10?'over':state.scene===7||state.scene===8?'elevator':'title';
  if(key!==this.track){this.track=key;this.node.port.postMessage({track:key});}
  const duck=this.hidden?0:state.paused?.16:state.map?.2:1;
  if(duck!==this.lastDuck){this.lastDuck=duck;this.node.port.postMessage({duck});}
  this.applyGain();
 }
 setHidden(hidden){this.hidden=hidden;if(this.lastState)this.music(this.lastState);}
 status(){let rms=0,peak=0;if(this.analyser){const a=new Float32Array(this.analyser.fftSize);this.analyser.getFloatTimeDomainData(a);for(const x of a){rms+=x*x;peak=Math.max(peak,Math.abs(x));}rms=Math.sqrt(rms/a.length);}return {state:this.ctx?.state??'not-started',engine:this.node?'audio-worklet':'starting',sampleRate:this.ctx?.sampleRate??0,track:SCORES[this.track]?.name,muted:this.mute,rms,peak,voices:this.metrics.voices+this.nodes.size,samples:this.metrics.samples,steps:this.metrics.steps,error:this.error};}
}
