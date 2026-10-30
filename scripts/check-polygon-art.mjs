import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const names=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const code=names.slice(0,names.indexOf('polygon_art.js')+1).map(n=>read('src/'+n)).join('\n');
const api=runInNewContext(code+'\n({POLY_ART,ART,CHARS,NPCS})',{document:{createElement:()=>createCanvas(1,1)}});
assert.equal(api.POLY_ART.geometry.headHeights,2);const sheet=createCanvas(1100,570),g=sheet.getContext('2d');g.fillStyle='#203747';g.fillRect(0,0,1100,570);
const identities=[['hero','#243044','#b84b4b',false],['hero','#945b45','#b84b4b',true],['moe','#47395f','#eee0c5',true],...Object.entries(api.CHARS).filter(([id])=>!['hero','moe'].includes(id)).map(([id,c])=>[id,c.hair,c.coat,['mio','kayo','tsumugi'].includes(id)])];
for(const [i,[id,hair,coat,long]]of identities.entries())for(let dir=0;dir<4;dir++){const c=api.ART.person(id,hair,coat,dir,0,{long}),data=c.getContext('2d').getImageData(0,0,64,96).data;assert.equal(c.width,64);assert.equal(c.height,96);assert(data.filter((v,i)=>i%4===3&&v>128).length>600,'solid faceted character '+id);assert.deepEqual(Array.from(data.slice(0,4)),[0,0,0,0],'transparent corners');if(i<11)g.drawImage(c,i*100+15,dir*100,64,96);}
let i=0;for(const [id,n]of Object.entries(api.NPCS)){const c=api.ART.person(id,n.sprite[1],n.sprite[0],0,0,{long:['akari','chiyo','misuzu'].includes(id)});assert.equal(c.width,64);assert.equal(c.height,96);if(id!=='moe')assert.strictEqual(c,api.ART.person(id,n.sprite[1],n.sprite[0],0,2,{long:['akari','chiyo','misuzu'].includes(id)}),'stationary NPC uses cached still pose');if(i<11)g.drawImage(c,i++*100+15,450,64,96);}
for(let j=0;j<1000;j++)api.ART.person('resident-'+j,'#345678','#987654');assert(api.POLY_ART.stats().entries<=384,'bounded pose cache');
const html=read('index.html'),build=read('scripts/build.mjs');assert(html.includes('const POLY_ART='));assert(!html.includes('SEMIREAL_ART'),'no remaining old renderer calls in the active bundle');assert(!build.includes('__PARTY_'),'painted atlases are no longer delivered');
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/polygon-contact.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('All party/NPC identities, faceted two-head models, four directions, transparency, still residents, bounded cache and active-build replacement passed');
