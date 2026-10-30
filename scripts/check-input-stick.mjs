import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const noop=()=>{},windowEvents={},events={},buttonEvents={};let confirmations=0;
const base={dataset:{},classList:{add:noop,remove:noop},setPointerCapture:noop,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),addEventListener:(name,fn)=>events[name]=fn};
const center={tagName:'BUTTON',addEventListener:(name,fn)=>buttonEvents[name]=fn};
const knob={style:{}},back={addEventListener:noop},screen={querySelectorAll:()=>[]};
const dock={dataset:{},querySelector:s=>s==='.stick'?base:s==='.knob'?knob:s==='.stick-confirm'?center:back};
const G={screen:'title',dlg:{},walk:{path:[]}};
const document={hidden:false,activeElement:null,hasFocus:()=>true,addEventListener:noop,querySelector:s=>s==='#dock .stick'?base:s==='#dock .knob'?knob:null,getElementById:id=>id==='dock'?dock:id==='dlgNext'?{click(){confirmations++;}}:screen};
const pad=runInNewContext(readFileSync(new URL('../src/input.js',import.meta.url),'utf8')+'\nPAD',{document,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},G,SND:{sfx:noop},boot:noop,requestAnimationFrame:noop,performance:{now:()=>0}});
pad.mount();
function pointer(type,x=50,y=50,onCenter=true,id=1){events[type]({type,pointerId:id,clientX:x,clientY:y,target:{closest:s=>onCenter&&s==='.stick-confirm'?center:null},preventDefault:noop});}
pointer('pointerdown');pointer('pointerup');assert.equal(confirmations,1,'center tap confirms once');buttonEvents.click({detail:1});assert.equal(confirmations,1,'browser click after pointerup does not double confirm');
pointer('pointerdown');pointer('pointermove',90);pointer('pointermove',50);pointer('pointerup');assert.equal(confirmations,1,'dragging out and back does not confirm');
pointer('pointerdown',50,50,false);pointer('pointerup',50,50,false);assert.equal(confirmations,1,'ring tap does not confirm');
for(const cancel of ['pointercancel','lostpointercapture']){pointer('pointerdown');pointer(cancel);pointer('pointerup');assert.equal(confirmations,1,cancel+' cannot confirm');}
pointer('pointerdown');windowEvents.blur();pointer('pointerup');assert.equal(confirmations,1,'blur clears a pending central tap');
buttonEvents.click({detail:0});assert.equal(confirmations,2,'assistive click still confirms');
pointer('pointerdown');pointer('pointerdown',90,50,true,2);pointer('pointerup',90,50,true,2);pointer('pointerup');assert.equal(confirmations,3,'additional fingers cannot steal a central gesture');
console.log('Joystick center confirms once; drag, ring, cancel, capture loss, blur and extra-pointer guards passed');

// Off-center thumb placement stays neutral; short drags respond and diagonal jitter stays stable.
pointer('pointerdown',58,54);assert.equal(base.dataset.dir,'');
pointer('pointermove',66,54);assert.equal(base.dataset.dir,'右');
pointer('pointermove',68,65);assert.equal(base.dataset.dir,'右','diagonal margin keeps the current direction');
pointer('pointermove',63,74);assert.equal(base.dataset.dir,'下','deliberate turn changes direction');
pointer('pointermove',58,54);assert.equal(base.dataset.dir,'','returning to the touch origin stops');
pointer('pointerup',58,54);assert.equal(confirmations,3,'movement never confirms');
console.log('Off-center origin, sensitive start, direction stability, deliberate turns and neutral return passed');
