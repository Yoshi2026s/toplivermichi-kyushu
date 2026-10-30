import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const handlers={};
runInNewContext(readFileSync(new URL('../src/input.js',import.meta.url),'utf8'),{
  window:{addEventListener(){}},
  document:{addEventListener(type,fn){(handlers[type]??=[]).push(fn);},querySelector(){return null;}},
  G:{screen:'explore',st:{},walk:{path:[]}},performance:{now:()=>0},boot(){}
});
const keydown=handlers.keydown[0];
function event(key,target,extra={}){
  return {key,target,prevented:false,preventDefault(){this.prevented=true;},...extra};
}
for(const target of [{tagName:'SELECT'},{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'DIV',isContentEditable:true}]){
  for(const key of ['ArrowDown','ArrowUp',' ','Enter','Backspace','a','z']){
    const e=event(key,target);keydown(e);assert.equal(e.prevented,false,`${target.tagName}: ${key}`);
  }
}
for(const modifier of ['ctrlKey','metaKey','altKey','isComposing']){
  const e=event('a',{tagName:'BODY'},{[modifier]:true});keydown(e);assert.equal(e.prevented,false,modifier);
}
const move=event('ArrowRight',{tagName:'BODY'});keydown(move);assert.equal(move.prevented,true);
console.log('Native form editing, IME and modified shortcuts preserved; game movement remains active');
