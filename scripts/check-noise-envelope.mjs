import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8'),start=source.indexOf('  function noise('),end=source.indexOf('  function kick(',start);
assert(start>=0&&end>start);
const gains=[],sources=[],activeSources=new Map();let created=0;
const ac={createBufferSource(){created++;const source={playbackRate:{},connect(){},start(){},stop(t){this.ends=t;}};sources.push(source);return source;},createBiquadFilter(){return {frequency:{},Q:{},connect(){}};},createGain(){const events=[];gains.push(events);return {gain:{setValueAtTime:(v,t)=>events.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>events.push(['ramp',v,t]),exponentialRampToValueAtTime:(v,t)=>events.push(['decay',v,t])},connect(){}};}};
const noise=runInNewContext(source.slice(start,end)+';noise',{ac,activeSources,noiseBuf:{},musicBus:{},sfxBus:{},trackSource(){},Math});
for(const duration of [.012,.035,.16,1.2]){
 noise(10,duration,.5,1800);
 const events=gains.at(-1);assert(events[0][1]<=.0001,'noise must begin near silence rather than a full-volume step');
 assert(events.some(e=>e[0]==='ramp'&&e[1]===.5&&e[2]>10&&e[2]<=10+Math.min(.003,duration*.2)),'short attack keeps percussion responsive');
 assert(events.some(e=>e[0]==='decay'&&e[1]<=.0001&&e[2]===10+duration),'noise fades near silence before stopping');
 if(duration>1)assert.equal(sources.at(-1).loop,true,'long noise outlives the one-second source buffer');assert.equal(sources.at(-1).ends,10+duration+.02);
}
for(let i=0;i<96;i++)activeSources.set(i,'music');noise(10,.1,.5,1800);assert.equal(created,4,'full source budget does not allocate another noise');
console.log('Noise envelope: soft short attack, quiet release and source ceiling pass');
