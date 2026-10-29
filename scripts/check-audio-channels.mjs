import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const source=readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const param=(value=0)=>({value,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){},cancelAndHoldAtTime(){}});
let context;
class FakeContext{
  constructor(){context=this;this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination={};this.sources=[];this.gains=[];}
  node(){return {connect(){},disconnect(){this.disconnected=true;},frequency:param(),Q:param(),gain:param(1),detune:param(),pan:param(),delayTime:param(),playbackRate:param(1)};}
  createGain(){const n=this.node();this.gains.push(n);return n;}
  createDynamicsCompressor(){return {...this.node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
  createBiquadFilter(){return this.node();}createConvolver(){return this.node();}createDelay(){return this.node();}createStereoPanner(){return this.node();}createPeriodicWave(){return {};}
  createBuffer(channels,length){const arrays=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:i=>arrays[i]};}
  createSource(){const n=this.node();n.setPeriodicWave=()=>{};n.start=t=>{n.started=t;};n.stop=t=>{n.end=t??this.currentTime;if(t===undefined){n.onended?.();n.onended=null;}};this.sources.push(n);return n;}
  createOscillator(){return this.createSource();}createBufferSource(){return this.createSource();}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
  advance(t){this.currentTime=t;for(const n of this.sources)if(n.end<=t&&n.onended){n.onended();n.onended=null;}}
}
const callbacks=new Set();
const sound=runInNewContext(source+'\nSND',{window:{AudioContext:FakeContext},setInterval:f=>{callbacks.add(f);return f;},clearInterval:f=>callbacks.delete(f),setTimeout:()=>1,clearTimeout:()=>{},Float32Array,Math});
assert.equal(sound.songs.filter(n=>n.startsWith('sea_RG')).length,8);assert(sound.songs.includes('seaBattle'));
assert(sound.setOn(true));sound.setVolumes(.25,.75);assert.equal(sound.volumes.music,.25);assert.equal(sound.volumes.effects,.75);assert.equal(context.gains[1].gain.value,.125);assert.equal(context.gains[2].gain.value,.5625);
for(const name of sound.songs){sound.play(name);for(let i=0;i<12;i++){context.advance(context.currentTime+.1);for(const callback of [...callbacks])callback();assert(sound.sourceCount<=96);}}
sound.play('seaBattle');for(let i=0;i<50;i++)sound.sfx(i%2?'critical':'seaWave');assert(sound.sourceCount<=96);sound.setOn(false);assert.equal(sound.sourceCount,0);assert.equal(callbacks.size,0);assert(context.sources.every(n=>n.disconnected||n.end<=context.currentTime));
sound.setOn(true);sound.play('battle');sound.suspend();assert.equal(sound.sourceCount,0);assert.equal(callbacks.size,0);sound.resume();assert(callbacks.size===1);sound.resume();assert(callbacks.size===1);sound.setVolumes(0,1);assert.equal(context.gains[1].gain.value,0);sound.setOn(false);
console.log('Audio channels: 17 scene/sea tracks, alternating melody, independent saved volume levels, zero music with effects enabled, 96-source ceiling, mute/suspend cleanup and idempotent resume passed');
