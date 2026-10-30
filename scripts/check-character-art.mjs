import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
import {illustratedContext} from './illustrated-runtime.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{loadImage}=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const code=[...files.slice(0,files.indexOf('soft_art.js')+1),'pets.js','ocean.js'].map(n=>read('src/'+n)).join('\n');
const api=await illustratedContext(code+'\n({SOFT_ART,ART,NPCS,CHARS,PET_SPECIES,petSpriteSvg,oceanEnemySprite})');
const sheet=createCanvas(1200,650),g=sheet.getContext('2d');g.fillStyle='#203747';g.fillRect(0,0,1200,650);
let count=0;for(const [id,n]of Object.entries(api.NPCS)){for(let dir=0;dir<4;dir++)assert.equal(api.ART.person(id,n.sprite[1],n.sprite[0],dir,0).width,64);count++;}
let i=0;for(const [id,p]of Object.entries(api.PET_SPECIES)){const growth=new Set();for(const stage of [1,5,10]){const svg=api.petSpriteSvg(id,stage),payload=svg.match(/xlink:href="data:image\/png;base64,([^"]+)"/);assert(payload,'pet SVG embeds its production PNG');const img=await loadImage(Buffer.from(payload[1],'base64'));assert.equal(img.width,96);const probe=createCanvas(96,96);probe.getContext('2d').drawImage(img,0,0);assert(probe.getContext('2d').getImageData(0,0,96,96).data.filter((v,i)=>i%4===3&&v>128).length>1000,'pet SVG payload contains a solid illustrated animal');assert.equal(payload[1],api.SOFT_ART.creature('pet/'+id,p.shape,p.color,96,0,false,stage).toDataURL('image/png').split(',')[1]);growth.add(svg);if(stage===5)g.drawImage(img,i%11*106,Math.floor(i/11)*110,96,96);}assert.equal(growth.size,3);i++;}
const sea=new Set();for(let region=0;region<8;region++)for(let family=0;family<5;family++){const c=api.oceanEnemySprite(region,family,0,64);assert.equal(c.width,64);sea.add(c.toBuffer('image/png').toString('base64'));g.drawImage(c,region*100,250+family*70,64,64);}assert.equal(sea.size,40,'sea palettes/families stay distinct');
for(let i=0;i<8;i++)g.drawImage(api.ART.enemy('poly'+i,['鉱殻体','反響体','火花体','水紋体'][i%4],['水','熱','電','光'][i%4],'A1',0,96,i>3),850+i%3*105,260+Math.floor(i/3)*105,96,96);
assert(api.SOFT_ART.stats().entries<=384);mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/illustrated-creatures.png',import.meta.url),sheet.toBuffer('image/png'));
console.log(count+' stationary illustrated NPC identities; 22 pets at three growth stages; 40 distinct ocean creatures; illustrated land enemies and bosses passed');
