import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createCanvas} from './canvas-runtime.mjs';
const require=createRequire(import.meta.url),{Image}=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const walkSource=read('src/walk_animation.js');
const gait=runInNewContext(walkSource+'\nWALK_ART',{document:{createElement:()=>createCanvas(1,1)}});
for(let i=0;i<8;i++)assert.equal(gait.phase(i*4,true),i+1);
assert.equal(gait.phase(32,true),1);assert.equal(gait.phase(14,false),0);assert.equal(gait.phase(14,true,true),0);
assert.deepEqual(Array.from(gait.pose(18,90,0,0)),[18,90],'idle does not deform the figure');
const left=gait.pose(24,91,0,3),right=gait.pose(40,91,0,3);
assert(left[0]<24&&right[0]>40,'opposite feet step apart instead of scaling the whole image');
assert(gait.pose(40,91,0,1)[1]<gait.pose(24,91,0,1)[1],'one foot is lifted');
assert(gait.pose(24,91,0,5)[1]<gait.pose(40,91,0,5)[1],'the next half-cycle lifts the other foot');
assert(gait.pose(16,48,2,3)[0]>16&&gait.pose(48,48,2,3)[0]<48,'arms counter-swing');
let code=read('src/character_art.js')+'\n'+read('src/semireal_frames.js')+'\n'+walkSource+'\n'+read('src/semireal_art.js');
for(const side of ['front','back','side'])code=code.replaceAll('__PARTY_'+side.toUpperCase()+'_DATA_URI__','data:image/webp;base64,'+readFileSync(new URL('../assets/semireal/party-'+side+'.webp',import.meta.url)).toString('base64'));
const pending=[];class AtlasImage extends Image{set src(value){pending.push(new Promise((resolve,reject)=>{this.onload=resolve;this.onerror=reject;super.src=value;}));}}
const api=runInNewContext(code+'\n({ART,SEMIREAL_ART})',{Image:AtlasImage,document:{createElement:()=>createCanvas(1,1),querySelector:()=>null},ART:{person:()=>createCanvas(64,96)}});
await Promise.all(pending);
const sprite=dir=>api.ART.person('hero','#000','#000',dir,0,{long:false}).getContext('2d').getImageData(0,0,64,96).data;
const front=sprite(0),leftProfile=sprite(2),rightProfile=sprite(3);
assert.notDeepEqual(leftProfile,front,'lateral view must use the side atlas, not the frontal painting');
// Mirrored canvas resampling can round an antialiased channel by one level.
let mirrorError=0;for(let y=0;y<96;y++)for(let x=0;x<64;x++)for(let c=0;c<4;c++)mirrorError+=Math.abs(leftProfile[(y*64+x)*4+c]-rightProfile[(y*64+63-x)*4+c]);
assert(mirrorError/(64*96*4)<1,'right view mirrors the left profile within canvas antialiasing tolerance');
const sheet=createCanvas(9*96,4*150),g=sheet.getContext('2d');g.fillStyle='#294341';g.fillRect(0,0,sheet.width,sheet.height);
for(let dir=0;dir<4;dir++){
 const lower=new Set(),upper=new Set();
 for(let frame=0;frame<=8;frame++){
  const c=api.ART.person('hero','#000','#000',dir,frame,{long:false});
  g.drawImage(c,frame*96+16,dir*150+24,64,96);
  const p=c.getContext('2d');lower.add(Buffer.from(p.getImageData(0,64,64,32).data).toString('base64'));
  upper.add(Buffer.from(p.getImageData(0,20,64,40).data).toString('base64'));
  if(frame>0){
   assert.equal(c.artScale,4);const alpha=p.getImageData(0,0,64,96).data.filter((v,i)=>i%4===3);
   assert(alpha.filter(v=>v>200).length>400,'the articulated figure retains substantial opaque coverage');
   assert(Math.max(...alpha)>240,'antialiased mesh must retain near-opaque body pixels');
  }
 }
 assert.equal(lower.size,9,'idle and all eight foot poses are visually distinct in direction '+dir);
 assert(upper.size>4,'torso/arm motion is not a foot-only substitution');
}
assert(api.SEMIREAL_ART.stats().entries<=192);
// Drive the real update loop: animation distance must follow actual movement and freeze with overlays.
const ui=read('src/ui.js'),loopCode=ui.slice(ui.indexOf('function startLoop(){'),ui.indexOf('function bfs('));
for(const speed of ['normal','fast']){
 const queue=[],G={st:{settings:{moveSpeed:speed},pos:{x:0,y:0}},screen:'explore',walk:{path:[{x:1,y:0}],prog:0},frame:0};
 const doc={hidden:false};let draws=0;
 const start=runInNewContext(loopCode+'\nstartLoop',{G,document:doc,drawMap(){draws++;},arrive(){},requestAnimationFrame:fn=>{queue.push(fn);return queue.length;},cancelAnimationFrame(){}});
 start();queue.shift()(100);assert(Math.abs(G.walkDistance-16*16/(speed==='fast'?110:160))<1e-9);
 for(const key of ['sheet','dlg','lock']){G[key]=true;const distance=G.walkDistance;queue.shift()(116);assert.equal(G.walkDistance,distance,key+' freezes gait distance');G[key]=null;}
 const distance=G.walkDistance;doc.hidden=true;queue.shift()(132);assert.equal(G.walkDistance,distance,'background freezes gait');assert.equal(queue.length,0);
}
const drawCode=ui.slice(ui.indexOf('function drawMap(){'),ui.indexOf('function startLoop(){'));
for(const state of ['walking','idle','reduced','menu','initial-follower']){
 const calls=[],g={setTransform(){},fillRect(){},drawImage(){},beginPath(){},ellipse(){},fill(){},strokeRect(){}};
 const stopped=state==='idle',G={cv:{isConnected:true,getContext:()=>g},st:{mapId:'test',pos:{x:state==='initial-follower'?0:1,y:0},party:['hero','moe'],dir:3},fol:{x:0,y:0},vw:2,vh:2,walkDistance:4,walk:{path:stopped?[]:[{x:2,y:0}],prog:.5},sheet:state==='menu'?'menu':null};
 runInNewContext(drawCode+'\ndrawMap();',{G,document:{hidden:false},performance:{now:()=>100},MAPS:{test:{objects:[]}},PAL:{ink:'#000'},ART:{mapLayer:()=>({width:32,height:32})},camera:()=>({x:0,y:0}),playerPixel:()=>({x:16,y:0}),WALK_ART:gait,reducedMotion:()=>state==='reduced',charSprite:(id,dir,frame)=>{calls.push({id,frame});return {};}});
 assert.equal(calls.find(c=>c.id==='hero').frame,['walking','initial-follower'].includes(state)?2:0,state+' leader');
 assert.equal(calls.find(c=>c.id==='moe').frame,state==='walking'?6:0,state+' follower');
}
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/walk-contact.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('Eight articulated poses in four directions, alternating feet and counter-swing, stable idle, travel-distance sync, normal/fast pace, modal/background pause, follower idle and bounded cache pass');
