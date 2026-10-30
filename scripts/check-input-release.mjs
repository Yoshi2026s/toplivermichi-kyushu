import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../src/input.js',import.meta.url),'utf8');
const start=code.indexOf('  function releaseInput(){');
const end=code.indexOf('  window.addEventListener("blur",releaseInput);',start);
assert.ok(start>=0&&end>start);
const sources={key:3,gamepad:1,stick:2}, prev={a:true};
const G={walk:{path:[{x:1,y:1}],prog:0.5,pending:{type:'interact'}}};
const base={classList:{remove(name){assert.equal(name,'on');this.removed=true;}}};
const knob={style:{transform:'translate(4px,0)'}};
let released=false;
const result=runInNewContext(`${code.slice(start,end)}; releaseInput(); prevBtn`,{
  sources,prevBtn:prev,G,
  setDir(d,s){assert.equal(d,null);assert.equal(s,'key');released=true;},
  document:{querySelector(s){return s.endsWith('.stick')?base:knob;}}
});
assert.equal(released,true);
assert.ok(Object.values(sources).every(v=>v===null));
assert.equal(Object.keys(result).length,0);
assert.equal(G.walk.path.length,0);
assert.equal(G.walk.prog,0);
assert.equal(G.walk.pending,null);
assert.equal(base.classList.removed,true);
assert.equal(knob.style.transform,'');
assert.ok(code.includes('window.addEventListener("blur",releaseInput)'));
assert.ok(code.includes('if(document.hidden) releaseInput()'));
console.log('Focus loss clears held input, queued movement and stick visuals');
