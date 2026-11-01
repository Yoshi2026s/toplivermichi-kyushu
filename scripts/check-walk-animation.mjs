import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
import {illustratedContext} from './illustrated-runtime.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const {SOFT_ART:gait}=await illustratedContext(read('src/soft_art.js')+'\n({SOFT_ART})',{ART:{},CHARS:{hero:{},moe:{}}});
for(let i=0;i<8;i++)assert.equal(gait.phase(i*4,true),i+1);
assert.equal(gait.phase(32,true),1);assert.equal(gait.phase(14,false),0);assert.equal(gait.phase(14,true,true),0);
assert.equal(gait.pose(0).stride,0);assert(gait.pose(3).stride>0&&gait.pose(7).stride<0,'opposite phases counter-swing arms and legs');assert(gait.pose(1).lift>0&&gait.pose(5).lift<0,'alternate the lifted foot');
for(let dir=0;dir<4;dir++){const frames=new Set();for(let frame=0;frame<=8;frame++){const c=gait.person('hero','#243044','#b84b4b',dir,frame);assert.equal(c.artScale,4);frames.add(c.toBuffer('image/png').toString('base64'));}assert.equal(frames.size,9,'all illustrated walking phases distinct in direction '+dir);}
// Drive the real update loop: animation distance must follow actual movement and freeze with overlays.
const ui=read('src/ui.js'),loopCode=ui.slice(ui.indexOf('function startLoop(){'),ui.indexOf('function bfs('));
for(const speed of ['normal','fast']){
 const queue=[],G={st:{settings:{moveSpeed:speed},pos:{x:0,y:0}},screen:'explore',walk:{path:[{x:1,y:0}],prog:0},frame:0};
 const doc={hidden:false};let draws=0;
 const start=runInNewContext(ui.match(/function reducedMotion\(\)\{[\s\S]*?\n\}/)[0]+'\n'+loopCode+'\nstartLoop',{G,window:{matchMedia:()=>({matches:false})},document:doc,drawMap(){draws++;},arrive(){},requestAnimationFrame:fn=>{queue.push(fn);return queue.length;},cancelAnimationFrame(){}});
 start();queue.shift()(100);assert(Math.abs(G.walkDistance-16*16/(speed==='fast'?110:160))<1e-9);
 for(const key of ['sheet','dlg','lock']){G[key]=true;const distance=G.walkDistance;queue.shift()(116);assert.equal(G.walkDistance,distance,key+' freezes gait distance');G[key]=null;}
 const distance=G.walkDistance;doc.hidden=true;queue.shift()(132);assert.equal(G.walkDistance,distance,'background freezes gait');assert.equal(queue.length,0);
}
const drawCode=ui.slice(ui.indexOf('function drawMap(){'),ui.indexOf('function startLoop(){'));
for(const state of ['walking','idle','reduced','menu','initial-follower']){
 const draws=[],calls=[],g={save(){},restore(){},setTransform(){},fillRect(){},drawImage(...args){draws.push(args);},beginPath(){},ellipse(){},fill(){},strokeRect(){}};
 const stopped=state==='idle',G={cv:{isConnected:true,getContext:()=>g},st:{mapId:'test',pos:{x:state==='initial-follower'?0:1,y:0},party:['hero','moe'],dir:3},fol:{x:0,y:0},vw:2,vh:2,walkDistance:4,walk:{path:stopped?[]:[{x:2,y:0}],prog:.5},sheet:state==='menu'?'menu':null};
 runInNewContext(ui.slice(ui.indexOf('function drawMapAmbient('),ui.indexOf('function drawMap(){'))+drawCode+'\ndrawMap();',{G,partyMapFollowers:(st,frame,sprites)=>sprites.push({y:0,px:{x:0,y:0},img:{artScale:4,...(calls.push({id:'moe',frame:state==='walking'?6:0}),{})}}),drawMiniMap(){},document:{hidden:false},performance:{now:()=>100},MAPS:{test:{objects:[],w:2,h:2,tiles:[['\u002c','\u002c'],['\u002c','\u002c']]}},PAL:{ink:'#000'},ART:{mapLayer:()=>({width:32,height:32})},camera:()=>({x:0,y:0}),playerPixel:()=>({x:16,y:0}),SOFT_ART:gait,reducedMotion:()=>state==='reduced',charSprite:(id,dir,frame)=>{calls.push({id,frame});return {artScale:4};}});
 assert(draws.filter(a=>a[0].artScale).every(a=>a[3]===20&&a[4]===30),'party uses readable size with original foot anchor');
 assert.equal(calls.find(c=>c.id==='hero').frame,['walking','initial-follower'].includes(state)?2:0,state+' leader');
 assert.equal(calls.find(c=>c.id==='moe').frame,state==='walking'?6:0,state+' follower');
}
console.log('Illustrated cached walking poses, eight phases, four directions, movement-distance sync, follower, pause and map-loop checks passed');
const {SOFT_ART:lru}=await illustratedContext(read('src/soft_art.js')+'\n({SOFT_ART})',{ART:{},CHARS:{hero:{},moe:{}}});
const hot=lru.person('hero','#243044','#b84b4b',0,3),hotPixels=hot.toBuffer('image/png');let cold;
for(let i=0;i<150;i++){assert.equal(lru.person('hero','#243044','#b84b4b',0,3),hot,'recently used walking pose survives unrelated artwork churn');const c=lru.creature('cache-test-'+i,'bird','#83b9ae',32,0);if(i===0)cold=c;assert(lru.stats().entries<=lru.stats().limit);}
const regenerated=lru.creature('cache-test-0','bird','#83b9ae',32,0);assert.notEqual(regenerated,cold,'unused oldest artwork is evicted');assert.deepEqual(regenerated.toBuffer('image/png'),cold.toBuffer('image/png'));assert.deepEqual(hot.toBuffer('image/png'),hotPixels);assert.equal(lru.stats().limit,128);
console.log('Pose LRU: hot walking image survives 150 cold entries; unused artwork regenerates identical pixels; 128-entry limit retained');
