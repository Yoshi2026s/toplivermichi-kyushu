import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8');
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const data=files.slice(0,files.indexOf('core.js')+1).map(n=>read('src/'+n)).join('\n');
const {ART,MAPS}=runInNewContext(data+'\n'+read('src/art.js')+'\n'+read('src/art_detail.js')+'\n({ART,MAPS})',{
  document:{createElement:()=>createCanvas(1,1)}
});
const [a,b,c]=Object.keys(MAPS).sort((a,b)=>MAPS[a].w*MAPS[a].h-MAPS[b].w*MAPS[b].h);
const tile=ART.tile('.',0),first=ART.mapLayer(a,0),old=ART.mapLayer(a,1);
for(const frame of [2,3])ART.mapLayer(a,frame);
for(let frame=0;frame<4;frame++)ART.mapLayer(b,frame);
assert.equal(ART.mapLayer(a,0),first);
ART.mapLayer(c,0);
assert.equal(ART.mapLayer(a,0),first,'recently viewed frame remains cached');
const regenerated=ART.mapLayer(a,1);
assert.notEqual(regenerated,old,'oldest frame is released after eight cached layers');
assert.deepEqual(regenerated.toBuffer('image/png'),old.toBuffer('image/png'),'evicted frames regenerate identical pixels');
assert.equal(ART.tile('.',0),tile,'small sprite cache is independent');
console.log('Map cache retains recent frames, evicts old layers and regenerates identical pixels');
