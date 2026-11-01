import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const setOn=source.match(/function setOn\(v\)\{[\s\S]*?\n  \}/)?.[0],resume=source.match(/function resume\(\)\{[^\n]+\}/)?.[0];
assert(setOn&&resume);
for(const method of ['setOn','resume'])for(const state of ['running','suspended','interrupted','closed'])for(const active of [false,true]){
 const events=[],ac={state,resume:()=>{events.push('resume');return Promise.resolve();}};
 const snd=runInNewContext(`let on=true,cur='field',timer=${active?'1':'null'},jingleT=null;const effectLast=new Map(),init=()=>true,outputLevel=()=>{},stopBgm=()=>{},stopSources=()=>{},play=id=>{events.push(id);timer=1;};${setOn}\n${resume}\n({setOn,resume})`,{ac,events,clearTimeout:()=>{}});
 snd[method](true);
 assert.equal(events.filter(x=>x==='resume').length,['suspended','interrupted'].includes(state)?1:0,`${method}: ${state}`);
 assert.equal(events.filter(x=>x==='field').length,method==='resume'&&!active?1:0,'active scheduler must not restart');
}
for(const method of ['setOn','resume']){
 const events=[],ac={state:'interrupted',resume:()=>{events.push('resume');return Promise.reject(new Error('still interrupted'));}};
 const snd=runInNewContext(`let on=true,cur='field',timer=null,jingleT=1;const effectLast=new Map(),init=()=>true,outputLevel=()=>{},stopBgm=()=>{},stopSources=()=>{},play=id=>events.push(id);${setOn}\n${resume}\n({setOn,resume,mute:()=>{on=false}})`,{ac,events,clearTimeout:()=>{}});
 snd[method](true);await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['resume'],'blocked recovery keeps the jingle and handles rejection');
 if(method==='resume'){snd.mute();events.length=0;snd.resume();assert.deepEqual(events,[],'muted audio must stay muted');}
}
console.log('PASS audio interruption: suspended/interrupted recovery, running/closed guards, active music/jingle preservation, rejection and mute');
