import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
const world=readFileSync(new URL('../src/world_art.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const facade=runInNewContext(world.slice(world.indexOf(' function serviceFacade('),world.indexOf(' function regionalBuilding('))+';serviceFacade');
const symbols=runInNewContext(ui.slice(ui.indexOf('function mapFacilityKind('),ui.indexOf('function drawMiniMap('))+';({mapFacilityKind,drawFacilitySymbol})');
const hash=c=>createHash('sha256').update(c.toBuffer('image/png')).digest('hex');
const buildings=new Set(),icons=new Set();
for(const type of ['inn','shop','jobcenter']){const c=createCanvas(120,120);facade(c.getContext('2d'),{x:0,y:0,w:5,h:5,door:[2,4],service:type},20);buildings.add(hash(c));assert.equal(symbols.mapFacilityKind({type}),type);}
assert.equal(buildings.size,3,'store types have distinct facade geometry');
for(const kind of ['inn','shop','jobcenter','fort','town']){const c=createCanvas(32,32);symbols.drawFacilitySymbol(c.getContext('2d'),kind,16,16,24);icons.add(hash(c));}
assert.equal(icons.size,5,'facility icons are distinct');assert.equal(symbols.mapFacilityKind({type:'boss'}),'fort');assert.equal(symbols.mapFacilityKind({type:'door',fieldExit:true}),'town');assert.equal(symbols.mapFacilityKind({type:'npc'}),null,'residents do not clutter minimap');
console.log('3 distinct storefront facades, 5 unique map symbols, town/fort mapping and uncluttered NPC handling passed');
