// Audition the exact production sequencer without a browser or sound device.
import {writeFileSync} from 'node:fs';import {Synth} from '../synth.js';import {SCORES} from '../score.js';
const key=process.argv[2]??'title',out=process.argv[3]??'/tmp/mall-audio-preview.wav';
if(!SCORES[key])throw Error('Unknown track: '+key);
const rate=48000,seconds=Number(process.argv[4]??12);if(!(seconds>0&&seconds<=60))throw Error('Duration must be 1–60 seconds');
const synth=new Synth(rate);synth.setTrack(key);const samples=Math.floor(rate*seconds),buffer=Buffer.alloc(44+samples*2);
buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,synth.sample()*.65))*32767),44+i*2);
writeFileSync(out,buffer);console.log(out);
