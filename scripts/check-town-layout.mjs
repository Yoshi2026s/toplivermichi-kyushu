import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const files=['data_enemies','data_saga_enemies','data_items','data_national','data','data_nationwide','data_nationwide_story','data_maps','data_character','data_extras','data_pets','data_ocean'];
const source=files.map(f=>readFileSync(new URL('../src/'+f+'.js',import.meta.url),'utf8')).join('\n');
const {maps,pairs,version}=runInNewContext(source+'\n({maps:MAPS,pairs:NATIONAL_MAP_PAIRS,version:MAP_LAYOUT_VERSION})');
assert.equal(version,3);
for(const [hub,pair] of Object.entries(pairs)){
 const town=maps[pair.town],field=maps[pair.field],footprints=new Set();
 assert.equal(town.buildings.length,8);
 for(const b of town.buildings){
  const [x,y]=b.door;
  assert.equal(town.tiles[y+1][x],',',hub+': entrance faces sidewalk');
  for(let yy=b.y;yy<b.y+b.h;yy++)for(let xx=b.x;xx<b.x+b.w;xx++){
   const key=xx+','+yy;assert(!footprints.has(key),hub+': overlapping buildings');footprints.add(key);
   if(xx===x&&yy===y)continue;
   assert('c#'.includes(town.tiles[yy][xx]),hub+': road/object cuts through building');
  }
  if(b.service)assert(town.objects.some(o=>o.id===b.objectId&&o.x===x&&o.y===y),hub+': service matches doorway');
  else assert.equal(town.tiles[y][x],'#',hub+': closed house blocks movement');
 }
 for(const o of town.objects){
  if(o.type==='npc')assert.equal(o.site,'sidewalk');
  if(o.type==='box')assert.equal(o.site,'courtyard');
  if(o.type==='port')assert('~='.includes(town.tiles[o.y][o.x])||[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>'~='.includes(town.tiles[o.y+dy]?.[o.x+dx])));
 }
 assert(!field.tiles.flat().includes(','),hub+': countryside uses dirt trails');
 assert(field.trailCells.some(row=>row.some(Boolean)),hub+': continuous trail material');
 assert(town.tiles[0].every(t=>t==='W'),hub+': town wall');
}
console.log('51 towns: separate parcels, aligned entrances, sidewalks, courtyards, waterfront ports and rural dirt trails');
