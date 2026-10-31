import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const handlers={};
let resumes=0,enables=0;
const sound={on:true,resume(){resumes++;},setOn(){enables++;}};
runInNewContext(readFileSync(new URL('../src/input.js',import.meta.url),'utf8'),{
  window:{addEventListener(){}},
  document:{addEventListener(type,fn){(handlers[type]??=[]).push(fn);},querySelector(){return null;}},
  G:{screen:'explore',st:{settings:{sound:false}},walk:{path:[]}},performance:{now:()=>0},boot(){},SND:sound
});
const keydown=handlers.keydown[0];
function event(key,target,extra={}){
  return {key,target,prevented:false,preventDefault(){this.prevented=true;},...extra};
}
for(const target of [{tagName:'SELECT'},{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'SUMMARY'},{tagName:'DIV',isContentEditable:true}]){
  for(const key of ['ArrowDown','ArrowUp',' ','Enter','Backspace','a','z']){
    const e=event(key,target);keydown(e);assert.equal(e.prevented,false,`${target.tagName}: ${key}`);
  }
}
for(const modifier of ['ctrlKey','metaKey','altKey','isComposing']){
  const e=event('a',{tagName:'BODY'},{[modifier]:true});keydown(e);assert.equal(e.prevented,false,modifier);
}
const move=event('ArrowRight',{tagName:'BODY'});keydown(move);assert.equal(move.prevented,true);
handlers.keydown.at(-1)();assert.equal(resumes,1,'a fresh gesture retries enabled audio');
sound.on=false;handlers.keydown.at(-1)();assert.equal(enables,0,'a fresh gesture must respect saved mute');
console.log('Native form editing, IME and modified shortcuts preserved; game movement remains active');

for(const key of ['Enter',' ']){const e=event(key,{tagName:'BUTTON'});keydown(e);assert.equal(e.prevented,false,'focused buttons keep native activation');const repeated=event(key,{tagName:'BUTTON'},{repeat:true});keydown(repeated);assert.equal(repeated.prevented,true,'held confirm cannot repeat native activation');}
