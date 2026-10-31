import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCanvas} from './canvas-runtime.mjs';
import {illustratedContext} from './illustrated-runtime.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),names=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const api=await illustratedContext(names.slice(0,names.indexOf('soft_art.js')+1).map(n=>read('src/'+n)).join('\n')+';({MAPS,ART,WORLD_ART,NATIONAL_MAP_PAIRS})');
const state=JSON.stringify(api.MAPS),profiles=Object.entries(api.NATIONAL_MAP_PAIRS).map(([id,pair])=>({id,town:api.MAPS[pair.town],field:api.MAPS[pair.field]}));
assert.equal(profiles.length,51);assert.equal(new Set(profiles.map(x=>x.town.regional.name)).size,51);
const sheet=createCanvas(1600,Math.ceil(51/5)*240),g=sheet.getContext('2d'),hashes=new Set(),styles=new Set();g.fillStyle='#142a38';g.fillRect(0,0,sheet.width,sheet.height);
for(const [i,{id,town,field}]of profiles.entries()){
 const p=town.regional;assert.equal(p.id,id);assert.deepEqual(p,field.regional);styles.add(p.architecture);
 for(const k of ['roof','wall','paving','accent'])assert(/^#[0-9a-f]{6}$/i.test(p[k]));
 const key='__regional_qa_'+id,tiles=Array.from({length:10},(_,y)=>Array.from({length:14},(_,x)=>y===0?'W':y===9?'~':x===7?',':'.'));
 for(let y=2;y<7;y++)for(let x=1;x<6;x++)tiles[y][x]=y<5?'c':'#';tiles[6][3]=',';tiles[3][10]='T';tiles[6][10]='T';
 api.MAPS[key]={kind:'town',terrain:town.terrain,w:14,h:10,tiles,regional:p,objects:[],buildings:[{...town.buildings[0],x:1,y:2,w:5,h:5,door:[3,6]}]};
 const layer=api.ART.mapLayer(key,0),bytes=layer.toBuffer('image/png');hashes.add(createHash('sha256').update(bytes).digest('hex'));
 assert.strictEqual(api.ART.mapLayer(key,2),layer,'regional scenery uses static cache');assert(api.WORLD_ART.stats().bytes<=api.WORLD_ART.stats().limit);
 const X=i%5*320,Y=Math.floor(i/5)*240;g.drawImage(layer,0,0,layer.width,layer.height,X,Y+27,320,210);g.fillStyle='#f0dfb8';g.font='16px sans-serif';g.textAlign='left';g.fillText(town.name+' / '+p.architecture,X+7,Y+20);
 delete api.MAPS[key];
}
assert.equal(hashes.size,51,'all profiles must change actual pixels on identical geometry');assert.equal(styles.size,10);
assert.equal(JSON.stringify(api.MAPS),state,'regional rendering cannot alter maps, objects or routes');
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/regional-contact.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('51 distinct regional renders on identical geometry; 10 architecture families, field consistency, unchanged gameplay data and bounded static cache');
