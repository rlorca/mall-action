import {Synth} from './synth.js';
class MallSynth extends AudioWorkletProcessor{
 constructor(){super();this.synth=new Synth(sampleRate);this.report=0;this.port.onmessage=({data})=>{if('track'in data)this.synth.setTrack(data.track);if('duck'in data)this.synth.setDuck(data.duck);};}
 process(_inputs,outputs){const channel=outputs[0]?.[0];if(channel){this.synth.process(channel);this.report+=channel.length;if(this.report>=sampleRate/4){this.report=0;this.port.postMessage(this.synth.status());}}return true;}
}
registerProcessor('mall-synth',MallSynth);
