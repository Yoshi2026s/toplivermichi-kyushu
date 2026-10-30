import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/input.js',import.meta.url),'utf8');
for(const hidden of [false,true]){
  let focused=false,advances=0,nextFrame;
  const stick={dataset:{},addEventListener(){}};
  const dock={dataset:{},querySelector:()=>stick};
  const document={hidden,hasFocus:()=>focused,addEventListener(){},querySelector:()=>null,
    getElementById:id=>id==='dock'?dock:id==='dlgNext'?{click(){advances++;}}:null};
  const pad=runInNewContext(source+'\nPAD',{
    document,window:{addEventListener(){}},G:{screen:'title',dlg:{},walk:{path:[]}},boot(){},
    navigator:{getGamepads:()=>[{id:'standard',axes:[0,0],buttons:[{pressed:true}]}]},
    requestAnimationFrame:fn=>{nextFrame=fn;}
  });
  pad.mount();nextFrame(0);
  assert.equal(advances,0,hidden?'hidden tab must ignore controller':'unfocused window must ignore controller');
  document.hidden=false;focused=true;nextFrame(16);
  assert.equal(advances,1,'focused game still responds to controller');
  nextFrame(32);assert.equal(advances,1,'held button does not repeatedly confirm');
}
console.log('Gamepad ignores hidden/unfocused pages and retains focused edge-triggered input');
