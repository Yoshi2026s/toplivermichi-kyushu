import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const handlers={},document={activeElement:null,addEventListener(type,fn){(handlers[type]??=[]).push(fn);},
  getElementById(){return null;},querySelector(selector){return selector==='.overlay'?overlay:null;}};
function control(tagName){return {tagName,disabled:false,getAttribute:()=>null,closest:()=>null,
  getBoundingClientRect:()=>({width:100,height:30}),focus(){document.activeElement=this;}};}
const first=control('BUTTON'),select=control('SELECT'),last=control('INPUT');
const overlay={querySelectorAll:()=>[first,select,last]};
const G={screen:'title',sheet:'settings',dlg:null};
runInNewContext(readFileSync(new URL('../src/input.js',import.meta.url),'utf8'),{
  document,G,window:{addEventListener(){}},getComputedStyle:()=>({visibility:'visible'}),requestAnimationFrame(){},boot(){}
});
function tab(target,shiftKey=false){const e={key:'Tab',target,shiftKey,prevented:false,preventDefault(){this.prevented=true;}};handlers.keydown[0](e);return e;}
document.activeElement=last;assert(tab(last).prevented);assert.equal(document.activeElement,first);
assert(tab(first,true).prevented);assert.equal(document.activeElement,last);
document.activeElement=select;assert.equal(tab(select).prevented,false,'native traversal inside dialog stays available');
document.activeElement=control('BUTTON');assert(tab(document.activeElement).prevented);assert.equal(document.activeElement,first);
G.sheet=null;document.activeElement=last;assert.equal(tab(last).prevented,false,'main page keeps native Tab behavior');
console.log('Modal Tab boundaries wrap, native form traversal remains available and page Tab is unchanged');
