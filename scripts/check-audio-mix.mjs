import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const source=readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const param=(value=0)=>({value,events:[],setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);},exponentialRampToValueAtTime(v,t){this.value=v;},cancelScheduledValues(t){this.events.push(['cancel',t]);},cancelAndHoldAtTime(t){this.events.push(['hold',t]);}});
let context;
class AudioContext{
 constructor(){context=this;this.currentTime=10;this.sampleRate=8000;this.state='running';this.destination={};this.gains=[];}
 node(){return {connect(){},disconnect(){},frequency:param(),Q:param(),gain:param(1),detune:param(),pan:param(),delayTime:param(),playbackRate:param(1)};}
 createGain(){const n=this.node();this.gains.push(n);return n;}
 createDynamicsCompressor(){return {...this.node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
 createBiquadFilter(){return this.node();}createConvolver(){return this.node();}createDelay(){return this.node();}createStereoPanner(){return this.node();}createPeriodicWave(){return {};}
 createBuffer(channels,length){const a=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:i=>a[i]};}
 createOscillator(){const n=this.node();n.start=()=>{};n.stop=()=>{};n.setPeriodicWave=()=>{};return n;}createBufferSource(){return this.createOscillator();}
}
const sound=runInNewContext(source+';SND',{window:{AudioContext},document:{hidden:false},setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},Float32Array,Math});
sound.setOn(true);
const channels=[context.gains[1].gain,context.gains[4].gain,context.gains[7].gain],effects=context.gains[2].gain;
sound.setVolumes(.5,.25);
for(const [i,level]of [.25,.275,.225].entries())assert(channels[i].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-level)<1e-9&&e[2]>10),'music and wet returns must fade to the requested volume');
assert(effects.events.some(e=>e[0]==='ramp'&&e[1]===.1875&&e[2]>10),'effect volume must fade');
sound.play('field');channels.forEach(g=>g.events.length=0);sound.sfx('damage');
for(const [i,level]of [.25,.275,.225].entries()){
 assert(channels[i].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-level*.68)<1e-9),'important effects duck direct and wet music together');
 assert(channels[i].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-level)<1e-9&&e[2]>10.1),'all music returns recover');
}
context.currentTime=10.01;channels.forEach(g=>g.events.length=0);sound.setVolumes(0,0);
for(const g of [...channels,effects])assert.equal(g.events.filter(e=>e[0]==='ramp').at(-1)[1],0);
context.currentTime=11;sound.setVolumes(1,1);
for(const g of [...channels,effects])delete g.cancelAndHoldAtTime;
context.currentTime=12;channels.forEach(g=>g.events.length=0);sound.setVolumes(.25,.25);
for(const [i,level]of [.125,.1375,.1125].entries()){
 assert(channels[i].events.some(e=>e[0]==='cancel'&&e[1]===12));
 assert(channels[i].events.some(e=>e[0]==='ramp'&&Math.abs(e[1]-level)<1e-9&&e[2]===12.025));
}
sound.setOn(false);
assert.equal(sound.sourceCount,0);
console.log('Audio mix: smooth independent volume, coordinated direct/reverb/delay duck and recovery, zero levels during active duck and cleanup pass');
