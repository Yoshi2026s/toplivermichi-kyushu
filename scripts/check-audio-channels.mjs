import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const source=readFileSync(resolve(import.meta.dirname,'../src/audio_samples.js'),'utf8').replace('__ORCHESTRA_BANK_JSON__',readFileSync(resolve(import.meta.dirname,'../assets/audio/orchestra-bank.json'),'utf8').trim())+';'+readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const param=(value=0)=>({value,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){},cancelAndHoldAtTime(){}});
let context;
class FakeContext{
  constructor(){context=this;this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination={};this.sources=[];this.gains=[];this.live=new Set();}
  addEventListener(name,fn){(this.events||=new Map()).set(name,fn);}
  transition(state){this.state=state;this.events?.get('statechange')?.();}
  node(){return {connect(){},disconnect(){this.disconnected=true;},frequency:param(),Q:param(),gain:param(1),detune:param(),pan:param(),delayTime:param(),playbackRate:param(1)};}
  createGain(){const n=this.node();this.gains.push(n);return n;}
  createDynamicsCompressor(){return {...this.node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
  createBiquadFilter(){return this.node();}createConvolver(){return this.node();}createDelay(){return this.node();}createStereoPanner(){return this.node();}createPeriodicWave(){return {};}
  createBuffer(channels,length){const arrays=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:i=>arrays[i]};}
  createSource(){const n=this.node();n.setPeriodicWave=()=>{};n.start=t=>{n.started=t;};n.stop=t=>{n.end=t??this.currentTime;if(t===undefined){n.onended?.();n.onended=null;}};this.sources.push(n);this.live.add(n);return n;}
  createOscillator(){return this.createSource();}createBufferSource(){return this.createSource();}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
  advance(t){this.currentTime=t;for(const n of this.live)if(n.end<=t){if(n.onended){n.onended();n.onended=null;}this.live.delete(n);}}
}
const bank=JSON.parse(readFileSync(resolve(import.meta.dirname,'../assets/audio/orchestra-bank.json'),'utf8'));
const callbacks=new Set();
const document={hidden:false};
const sound=runInNewContext(source+'\nSND',{ORCHESTRA_BANK:bank,atob:s=>Buffer.from(s,'base64').toString('binary'),document,window:{AudioContext:FakeContext},setInterval:f=>{callbacks.add(f);return f;},clearInterval:f=>callbacks.delete(f),setTimeout:()=>1,clearTimeout:()=>{},Float32Array,Math});
assert.equal(sound.songs.filter(n=>n.startsWith('sea_RG')).length,8);assert(sound.songs.includes('seaBattle'));
assert(sound.setOn(true));assert(sound.instrumentation.sampledInstruments>=10);sound.setVolumes(.25,.75);assert.equal(sound.volumes.music,.25);assert.equal(sound.volumes.effects,.75);assert.equal(context.gains[1].gain.value,.125);assert.equal(context.gains[2].gain.value,.5625);
for(const name of sound.songs){sound.play(name);for(let i=0;i<12;i++){context.advance(context.currentTime+.1);for(const callback of [...callbacks])callback();assert(sound.sourceCount<=96);}}
assert(sound.instrumentation.sampleNotes>100,'BGM uses recorded acoustic instruments');
for(const id of sound.songs){sound.play(id);const seconds=sound.scores[id].seconds*2.05;for(let t=0;t<seconds;t+=.2){context.advance(context.currentTime+.2);for(const callback of [...callbacks])callback();assert(sound.sourceCount<=96,'two complete arranged cycles remain bounded');}}
assert.equal(sound.instrumentation.droppedSampleNotes,0,'normal full-cycle scores never exhaust the voice budget');
sound.play('seaBattle');for(let i=0;i<50;i++)sound.sfx(i%2?'critical':'seaWave');assert(sound.sourceCount<=96);sound.setOn(false);assert.equal(sound.sourceCount,0);assert.equal(callbacks.size,0);assert(context.sources.every(n=>n.disconnected||n.end<=context.currentTime));
sound.setOn(true);sound.play('battle');sound.suspend();assert.equal(sound.sourceCount,0);assert.equal(callbacks.size,0);sound.resume();assert(callbacks.size===1);sound.resume();assert(callbacks.size===1);sound.setVolumes(0,1);assert.equal(context.gains[1].gain.value,0);sound.setOn(false);
sound.setOn(true);sound.play('battle');sound.suspend();document.hidden=true;
const created=context.sources.length;
sound.sfx('damage');sound.jingle('fanfare','victory');sound.play('field');
assert.equal(sound.sourceCount,0,'late callbacks in hidden pages cannot queue sounds');
assert.equal(context.sources.length,created);assert.equal(callbacks.size,0);
document.hidden=false;sound.resume();assert.equal(sound.current,'field');assert.equal(callbacks.size,1);assert(sound.sourceCount>0);
sound.setOn(false);
sound.setOn(true);sound.play('field');
for(const delay of [.2,.35,1.8]){context.advance(context.currentTime+delay);const before=context.sources.length;for(const callback of [...callbacks])callback();assert(context.sources.slice(before).every(n=>n.started>=context.currentTime),'late scheduler must never burst old notes');assert(sound.sourceCount<=96);}
assert(sound.metrics.lookahead>=.35);assert(sound.metrics.recoveries>0&&sound.metrics.skippedSteps>0,'long stalls resynchronize the music timeline');sound.setOn(false);

sound.setOn(true);sound.play('field');const musicSources=sound.sourceCount;sound.sfx('rank');assert(sound.sourceCount>musicSources);context.transition('interrupted');assert.equal(sound.sourceCount,musicSources,'interruption clears effects while preserving the BGM clock');const pausedSources=context.sources.length;sound.sfx('rank');assert.equal(context.sources.length,pausedSources);context.transition('running');sound.sfx('rank');assert(sound.sourceCount>musicSources,'interruption clears the stale repeat lock');sound.setOn(false);

context.state='suspended';
context.resume=()=>Promise.reject(new Error('audio resume blocked'));
sound.setOn(true);
await new Promise(resolve=>setTimeout(resolve,0));
sound.setOn(false);
console.log('Audio channels: 25 scene/terrain/sea tracks, alternating melody, independent saved volume levels, zero music with effects enabled, 96-source ceiling, mute/suspend cleanup, idempotent resume and blocked-resume handling passed');

const fallback=runInNewContext(source+'\nSND',{ORCHESTRA_BANK:bank,atob:()=>{throw Error('sample decoder unavailable');},document,window:{AudioContext:FakeContext},setInterval:f=>{callbacks.add(f);return f;},clearInterval:f=>callbacks.delete(f),setTimeout:()=>1,clearTimeout:()=>{},Float32Array,Math});
assert(fallback.setOn(true));fallback.play('field');assert.equal(fallback.instrumentation.sampledInstruments,0);assert(fallback.sourceCount>0,'failed sample decoder preserves synthetic music fallback');fallback.setOn(false);assert.equal(fallback.sourceCount,0);console.log('Unavailable sample decoder falls back to synthesis without breaking mute or cleanup');
