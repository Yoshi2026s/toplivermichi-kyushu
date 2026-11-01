import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const src=readFileSync(resolve(import.meta.dirname,'../src/audio.js'),'utf8');
const play=src.slice(src.indexOf('  function play(name){'),src.indexOf('  /* ジングル'));
const jingle=src.slice(src.indexOf('  function jingle(name, next){'),src.indexOf('  function stopBgm'));
const events=[];
const sound=runInNewContext(`let cur='field',timer=1,jingleT=7,on=true,ac={},song,step,nextT,dly;const SONGS={field:{}},JINGLES={fanfare:{}},pageHidden=()=>false,stopBgm=()=>events.push('stop'),compile=()=>{throw Error('unexpected compile')},schedule=()=>{};${play}${jingle};({play,jingle,get current(){return cur},get pending(){return jingleT}})`,{events,clearTimeout:()=>events.push('clear'),setInterval(){},setTimeout(){}});
for(const name of ['missing','__proto__','constructor','toString']){
 assert.doesNotThrow(()=>sound.play(name));assert.equal(sound.current,'field');assert.equal(sound.pending,7);assert.deepEqual(events,[]);
 assert.doesNotThrow(()=>sound.jingle(name,'victory'));assert.equal(sound.pending,7);assert.deepEqual(events,[]);
}
console.log('Unknown and prototype track/jingle names preserve current music and its scheduled transition');
