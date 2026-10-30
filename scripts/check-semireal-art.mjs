import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createCanvas} from './canvas-runtime.mjs';
const require=createRequire(import.meta.url),{Image}=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sources={__PARTY_FRONT_DATA_URI__:'front',__PARTY_BACK_DATA_URI__:'back',__PARTY_SIDE_DATA_URI__:'side',__PARTY_DOWN_DATA_URI__:'down',__NPC_FRONT_DATA_URI__:'npc'};
let code=read('src/character_art.js')+'\n'+read('src/semireal_frames.js')+'\n'+read('src/walk_animation.js')+'\n'+'\nconst profilePerson=ART.person;ART.person=(...args)=>{fallbackCallsProbe();return profilePerson(...args);};\n'+read('src/semireal_art.js');
for(const [token,name] of Object.entries(sources))code=code.replaceAll(token,'data:image/webp;base64,'+readFileSync(new URL('../assets/semireal/'+(name==='npc'?'npc-front':'party-'+name)+'.webp',import.meta.url)).toString('base64'));
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const residents=runInNewContext(files.slice(0,files.indexOf('core.js')+1).map(f=>read('src/'+f)).join('\n')+'\nNPCS');
const pending=[];
class AtlasImage extends Image{set src(v){pending.push(new Promise((resolve,reject)=>{this.onload=resolve;this.onerror=reject;super.src=v;}));}}
let fallbackCalls=0;
const api=runInNewContext(code+'\n({art:SEMIREAL_ART,frames:SEMIREAL_FRAMES,person:ART.person})',{
 NPCS:residents,fallbackCallsProbe:()=>{fallbackCalls++;},Image:AtlasImage,ART:{person:()=>{fallbackCalls++;return createCanvas(64,96);}},G:{st:{profile:{gender:'男性'},heroine:{gender:'女性'}}},
 document:{createElement:()=>createCanvas(1,1),querySelector:()=>null},
});
assert.equal(api.person('hero','#000','#000',0,0,{}).width,64,'fallback available while decoding');
await Promise.all(pending);assert(api.art.ready('front'));assert(api.art.ready('back'));assert(api.art.ready('down'));assert(api.art.ready('npc'));assert.equal(api.frames.down.length,12);assert.equal(api.frames.npc.length,12);
assert.equal(api.art.index('hero',{long:true}),1);assert.equal(api.art.index('moe',{long:false}),3);assert.equal(api.art.index('unknown'),null);
const ids=['hero','hero','moe','moe','naoki','kohei','mio','kayo','tsumugi','makoto','gaku'];
const sheet=createCanvas(1100,780),g=sheet.getContext('2d');g.fillStyle='#243f42';g.fillRect(0,0,1100,780);
const digests=new Set();
for(const [i,id]of ids.entries()){
 const opt={long:i===1||i===2};
 for(let d=0;d<4;d++)for(let f=0;f<=8;f++){
  const c=api.person(id,'#000','#000',d,f,opt);assert.equal(c.width,64);assert.equal(c.height,96);
  const pixels=c.getContext('2d').getImageData(0,0,64,96).data;
  assert(pixels.some((v,j)=>j%4===3&&v>128),'every direction/frame contains opaque artwork');
  if(f===0)g.drawImage(c,i*100+18,d*100,64,96);
 }
 const c=createCanvas(96,160);api.art.portrait(c,id,i===1||i===2?'女性':'男性');
 const bytes=c.toBuffer('image/png');digests.add(bytes.toString('base64'));g.drawImage(c,i*100,410);
}
assert.equal(digests.size,11,'all identities and both gender variants have distinct portraits');
const alphaBounds=c=>{const p=c.getContext('2d').getImageData(0,0,64,96).data;let top=96,bottom=0;for(let y=0;y<96;y++)for(let x=0;x<64;x++)if(p[(y*64+x)*4+3]>100){top=Math.min(top,y);bottom=Math.max(bottom,y);}return {height:bottom-top+1,bottom};};
const npcCalls=fallbackCalls;
const npcIds=[...Object.keys(residents).filter(id=>id!=='moe'),'innkeeper'];
for(const id of npcIds){const c=api.person(id,'#000','#000',0,0),bounds=alphaBounds(c);assert(bounds.height>=84&&bounds.height<=90,'NPC body height matches party: '+id);assert(bounds.bottom>=90&&bounds.bottom<=93,'shared NPC foot baseline: '+id);assert.strictEqual(api.person(id,'#000','#000',0,2),c,'stationary NPC does not walk in place: '+id);}
assert.equal(fallbackCalls,npcCalls,'all registered MAP residents use painted art');
for(const [i,id]of ['hero','moe','akari','ryosuke','chiyo','sota','shigeru','misuzu','nwGuide01','nwGuide02','innkeeper'].entries())g.drawImage(api.person(id,'#000','#000',0,0),i*100+18,610,64,96);
for(const id of ['hero','moe']){const bounds=alphaBounds(api.person(id,'#000','#000',0,0));assert(bounds.height>=84&&bounds.height<=90&&bounds.bottom>=90&&bounds.bottom<=93,'party shares resident scale and baseline');}
const calls=fallbackCalls;api.person('village-npc','#000','#000');assert.equal(fallbackCalls,calls+1,'NPC rendering remains available');
assert(api.art.stats().entries<=192);
const manifest=JSON.parse(read('release-manifest.json'));assert.equal(Object.keys(manifest.assets).filter(p=>p.startsWith('assets/semireal/')).length,9);
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/semireal-contact.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('56 painted stationary residents at the shared party scale and foot baseline; strict down atlas; 11 party/gender identities, front/back/left/right, all movement phases, full alpha decoding, distinct high-resolution portraits, NPC fallback, cache bound and embedded assets pass');
