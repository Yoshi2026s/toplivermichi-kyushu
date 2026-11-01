import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const source=readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const block=source.slice(source.indexOf('  const effectLast='),source.indexOf('  function outputLevel'));
const table=source.slice(source.indexOf('  const SFX ='),source.indexOf('  function duckBgm'));
const notes=[],noises=[],ducks=[],ac={currentTime:10,state:"running"},document={hidden:false};
const sound=runInNewContext(`let on=true,effectVolume=1;const pageHidden=()=>document.hidden,sfxBus={},activeSources=new Map(),hz=n=>n;
const voice=(...a)=>notes.push(a),noise=(...a)=>noises.push(a),duckBgm=n=>ducks.push(n);
${table}${block}
({sfx,prepareEffects,mute:v=>effectVolume=v,fill:()=>{for(let i=0;i<24;i++)activeSources.set(i,'sfx');},clear:()=>activeSources.clear()})`,{ac,document,notes,noises,ducks});
sound.sfx('ok');assert.equal(notes.length,1);assert.equal(notes[0][3],'triangle');assert(notes[0][4]<.25);assert.equal(ducks.length,0);
for(let i=0;i<100;i++)sound.sfx('ok');assert.equal(notes.length,1,'same-frame repeats do not stack');
ac.currentTime+=.08;sound.sfx('ok');assert.equal(notes.length,2,'deliberate repeated input still sounds');
sound.sfx('step');assert.equal(noises.length,1);assert(noises[0][2]<.06);assert.equal(ducks.length,0,'footsteps do not pump the score');
sound.sfx('damage');assert.equal(ducks.length,1,'important battle events remain audible over music');
const before=[notes.length,noises.length,ducks.length];sound.mute(0);ac.currentTime+=1;sound.sfx('damage');assert.deepEqual([notes.length,noises.length,ducks.length],before,'muted effects never duck BGM or allocate voices');
sound.mute(1);sound.fill();sound.sfx('heal');assert.deepEqual([notes.length,noises.length,ducks.length],before,'effect bursts respect their voice budget');
sound.clear();document.hidden=true;sound.sfx('heal');assert.deepEqual([notes.length,noises.length,ducks.length],before);
document.hidden=false;sound.sfx('heal');assert(notes.length>before[0]);
sound.sfx('__proto__');sound.sfx('toString');
console.log('Sound comfort: muted/hidden effects, repeat suppression, subtle footsteps/UI, important-event ducking and 24-effect-source budget pass');

for(const state of ['suspended','interrupted','closed']){ac.state=state;ac.currentTime+=1;const counts=[notes.length,noises.length,ducks.length];sound.sfx('rank');sound.sfx('critical');assert.deepEqual([notes.length,noises.length,ducks.length],counts,state+' must not reserve effects on a frozen audio clock');}
ac.state='running';sound.sfx('rank');assert(notes.length>before[0],'returning audio accepts a fresh event');

let complete;ac.state='interrupted';ac.resume=()=>new Promise(resolve=>{complete=()=>{ac.state='running';resolve();};});const recovery=sound.prepareEffects();sound.mute(0);complete();assert.equal(await recovery,false,'muting during recovery prevents preview readiness');sound.mute(1);assert.equal(await sound.prepareEffects(),true);
