import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createCanvas} from './canvas-runtime.mjs';
import {illustratedContext} from './illustrated-runtime.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),names=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const api=await illustratedContext(names.slice(0,names.indexOf('soft_art.js')+1).map(n=>read('src/'+n)).join('\n')+';({WORLD_ART,MAPS,ART})');
assert(api.WORLD_ART.ready());const state=JSON.stringify(api.MAPS),ids=[];
for(const terrain of ['plain','coast','forest','mountain','river','lake'])for(const kind of ['town','field']){const id=Object.keys(api.MAPS).find(id=>api.MAPS[id].terrain===terrain&&api.MAPS[id].kind===kind);assert(id,'map for '+terrain+'/'+kind);ids.push(id);}
const sheet=createCanvas(1200,1200),g=sheet.getContext('2d');g.fillStyle='#112737';g.fillRect(0,0,1200,1200);
const first=api.ART.mapLayer(ids[0],0),firstBytes=first.toBuffer('image/png');assert.strictEqual(api.ART.mapLayer(ids[0],3),first,'static environment shares cache across frames');
for(const [i,id]of ids.entries()){const m=api.MAPS[id],layer=api.ART.mapLayer(id,0);assert.equal(layer.width,m.w*16*layer.artScale);assert.equal(layer.height,m.h*16*layer.artScale);assert.equal(layer.artScale,4);assert(api.WORLD_ART.stats().bytes<=32*1024*1024);const p=m.safeAnchor||[m.w/2,m.h/2];g.drawImage(layer,Math.max(0,p[0]-5)*64,Math.max(0,p[1]-4)*64,640,512,i%3*400,Math.floor(i/3)*300,400,300);}
const seaId=Object.keys(api.MAPS).find(id=>api.MAPS[id].combatDomain==='sea');assert(seaId);const sea=api.WORLD_ART.mapLayer(seaId,0);assert.equal(sea.artScale,4);assert.equal(sea.width,api.MAPS[seaId].w*64);
assert.deepEqual(api.ART.mapLayer(ids[0],0).toBuffer('image/png'),firstBytes,'evicted maps regenerate identical pixels');assert.equal(JSON.stringify(api.MAPS),state,'terrain, objects, encounters and routes are unchanged');
const stats=api.WORLD_ART.stats();assert(stats.materials<=12);assert.equal(stats.error,null);mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/world-contact.png',import.meta.url),sheet.toBuffer('image/png'));console.log('Painted towns and fields in all six terrains; 4x resolution, frame-independent cache, deterministic regeneration, 32MB budget and unchanged gameplay maps');
