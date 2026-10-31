import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{runInNewContext}from'node:vm';
const noop=()=>{},windowEvents={},events={},buttonEvents={},backEvents={};let confirmations=0,backCount=0;
const base={dataset:{},classList:{add:noop,remove:noop},setPointerCapture:noop,getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),addEventListener:(name,fn)=>events[name]=fn};
const center={tagName:'BUTTON',addEventListener:(name,fn)=>buttonEvents[name]=fn};
const knob={style:{}},back={disabled:false,classList:{add:noop,remove:noop},setPointerCapture:noop,addEventListener:(name,fn)=>backEvents[name]=fn},screen={querySelectorAll:()=>[]};
const dock={dataset:{},querySelector:s=>s==='.stick'?base:s==='.knob'?knob:s==='.stick-confirm'?center:back};
const G={screen:'title',dlg:{},walk:{path:[]}};
const document={hidden:false,activeElement:null,hasFocus:()=>true,addEventListener:noop,querySelector:s=>s==='#dock .stick'?base:s==='#dock .knob'?knob:null,getElementById:id=>id==='dock'?dock:id==='dlgNext'?{click(){confirmations++;}}:screen};
const pad=runInNewContext(readFileSync(new URL('../src/input.js',import.meta.url),'utf8')+'\nPAD',{document,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},G,ACT:{dlgBack(){G.dlg.i--;backCount++;}},SND:{sfx:noop},boot:noop,requestAnimationFrame:noop,performance:{now:()=>0}});
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
pointer('pointermove',66,54);assert.equal(base.dataset.dir,'','small central thumb jitter remains a tap');pointer('pointermove',74,54);assert.equal(base.dataset.dir,'右');
pointer('pointermove',76,68);assert.equal(base.dataset.dir,'右','diagonal margin keeps the current direction');
pointer('pointermove',64,82);assert.equal(base.dataset.dir,'下','deliberate turn changes direction');
pointer('pointermove',58,54);assert.equal(base.dataset.dir,'','returning to the touch origin stops');
pointer('pointerup',58,54);assert.equal(confirmations,3,'movement never confirms');
console.log('Off-center origin, sensitive start, direction stability, deliberate turns and neutral return passed');

const beforeStale=confirmations;G.controlEpoch=1;pointer('pointerdown');G.controlEpoch=2;pointer('pointerup');assert.equal(confirmations,beforeStale,'a screen redraw cancels held confirm');

function backPointer(type,x=50,y=50,id=7){backEvents[type]({type,pointerId:id,clientX:x,clientY:y,preventDefault:noop});}
G.dlg={i:1,lines:[['','a'],['','b']]};backPointer('pointerdown');backPointer('pointermove',60);backPointer('pointerup',60);backEvents.click({detail:1});assert.equal(backCount,1,'Back runs once on release and ignores the following physical click');
for(const cancel of ['pointercancel','lostpointercapture']){G.dlg.i=1;backPointer('pointerdown');backPointer(cancel);backPointer('pointerup');assert.equal(G.dlg.i,1);}
backPointer('pointerdown');backPointer('pointermove',80);backPointer('pointerup',80);assert.equal(G.dlg.i,1,'Back drag cancels');
G.controlEpoch=10;backPointer('pointerdown');G.controlEpoch=11;backPointer('pointerup');assert.equal(G.dlg.i,1,'redraw cancels held Back');
backPointer('pointerdown');windowEvents.blur();backPointer('pointerup');assert.equal(G.dlg.i,1,'app switch cancels held Back');backEvents.click({detail:0});assert.equal(G.dlg.i,0,'keyboard and assistive Back work');console.log('Back release, jitter, duplicate click, drag, redraw, capture loss and blur guards passed');
