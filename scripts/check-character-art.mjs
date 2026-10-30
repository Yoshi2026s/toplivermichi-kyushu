import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createCanvas} from './canvas-runtime.mjs';
const require=createRequire(import.meta.url),{loadImage}=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const code=[...files.slice(0,files.indexOf('core.js')+1),'art.js','art_detail.js','character_art.js','pets.js','ocean.js'].map(f=>read('src/'+f)).join('\n');
const api=runInNewContext(code+'\n({ART,NPCS,CHARS,PET_SPECIES,petSpriteSvg,oceanEnemySprite,CHARACTER_ART})',{document:{createElement:()=>createCanvas(1,1)}});
const sheet=createCanvas(1200,1080),g=sheet.getContext('2d');g.fillStyle='#e3dfd4';g.fillRect(0,0,1200,1080);g.fillStyle='#243747';g.font='20px sans-serif';g.fillText('CHARACTERS / directions, people, pets and ocean creatures',20,28);
const heroes=['hero','moe',...Object.keys(api.CHARS)].slice(0,12);
let count=0;
for(const [id,n]of Object.entries(api.NPCS)){for(let d=0;d<4;d++){const c=api.ART.person(id,n.sprite[1],n.sprite[0],d,d,{long:count%2===0});assert.equal(c.width,64);assert.equal(c.height,96);}count++;}
for(let i=0;i<heroes.length;i++)for(let d=0;d<4;d++){const c=api.ART.person(heroes[i],i%2?'#735174':'#493f39',i%2?'#ba6265':'#4d818b',d,d,{long:i%2,ribbon:i===1?'#de8b8e':null});g.drawImage(c,20+i*96,48+d*100,64,96);}
let i=0;
for(const [id,p]of Object.entries(api.PET_SPECIES)){for(const stage of [1,5,10]){const svg=api.petSpriteSvg(id,stage);const img=await loadImage(Buffer.from(svg));assert.equal(img.width,96);if(stage===5)g.drawImage(img,20+i%11*106,465+Math.floor(i/11)*105,96,96);}i++;}
for(let f=0;f<5;f++)for(let r=0;r<8;r++){const c=api.oceanEnemySprite(r,f,0,64);g.drawImage(c,20+r*100,700+f*70,64,64);}
for(let i=0;i<8;i++){const c=api.ART.enemy('updated'+i,['鉱殻体','反響体','火花体','容器体'][i%4],['水','熱','電','光'][i%4],'A1',0,128,i>3);g.drawImage(c,850+i%2*150,700+Math.floor(i/2)*90,84,84);}
assert.ok(api.CHARACTER_ART.stats().entries<=256);
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/character-quality.png',import.meta.url),sheet.toBuffer('image/png'));
console.log(`Rendered ${count} NPC identities in four directions; all 22 pets at three growth stages; all 40 ocean family palettes; bounded character cache`);
