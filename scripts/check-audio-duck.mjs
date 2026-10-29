import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const source=readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const duck=source.match(/function duckBgm\(duration\)\{[\s\S]*?\n  \}/)?.[0];
const stop=source.match(/function stopBgm\(\)\{[^\n]+\}/)?.[0];
if(!duck||!stop) throw new Error('BGM ducking functions missing');
const calls=[];
const gain={value:0.5,cancelAndHoldAtTime:t=>calls.push(['hold',t]),cancelScheduledValues:t=>calls.push(['cancel',t]),setValueAtTime:(v,t)=>calls.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>calls.push(['ramp',v,t])};
const state={currentTime:10};
const sound=runInNewContext(`let ac=state,musicBus={gain},timer=1,duckUntil=0;${duck}\n${stop}\n({duckBgm,stopBgm})`,{state,gain,clearInterval:()=>{}});
sound.duckBgm(0.2);
if(!calls.some(c=>c[0]==='ramp'&&c[1]===0.5&&Math.abs(c[2]-10.38)<1e-6)) throw new Error('BGM did not recover after effect');
state.currentTime=10.1;calls.length=0;sound.duckBgm(0.3);
if(!calls.some(c=>c[0]==='ramp'&&c[1]===0.5&&Math.abs(c[2]-10.58)<1e-6)) throw new Error('overlapping effect restored BGM too early');
calls.length=0;sound.stopBgm();
if(!calls.some(c=>c[0]==='set'&&c[1]===0.5&&c[2]===10.1)) throw new Error('stopping BGM did not reset gain');
console.log('Audio: short duck, overlapping effects and stop reset OK');
