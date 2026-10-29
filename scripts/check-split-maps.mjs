import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js'].filter(f=>existsSync(resolve(root,'src',f)));
const data=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const {hubs,maps,pairs,areas}=runInNewContext(`${data}\n({hubs:HUBS,maps:MAPS,pairs:NATIONAL_MAP_PAIRS,areas:AREAS})`);
const assert=(value,msg)=>{if(!value)throw Error(msg);};
const walkable=(m,x,y)=>x>=0&&y>=0&&x<m.w&&y<m.h&&(m.objects.some(o=>o.x===x&&o.y===y)?m.objects.find(o=>o.x===x&&o.y===y).walk:'.,123w='.includes(m.tiles[y][x]));
function reachable(m){
 const queue=[m.safeAnchor],seen=new Set([m.safeAnchor.join(',')]);
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,yy=y+dy,key=`${xx},${yy}`;
   if(!seen.has(key)&&walkable(m,xx,yy)){seen.add(key);queue.push([xx,yy]);}
  }
 }return seen;
}
const layouts=new Set(),townLayouts=new Set();
for(const [hub,pair] of Object.entries(pairs)){
 const town=maps[pair.town],field=maps[pair.field];
 townLayouts.add(JSON.stringify(town.tiles));
 assert(town.kind==='town'&&field.kind==='field',`${hub}: missing town/field`);
 assert(town.objects.some(o=>o.type==='shop'),`${hub}: missing supply shop`);
 assert(town.objects.every(o=>!['boss','sign','tower'].includes(o.type)),`${hub}: combat landmark in town`);
 assert(Object.keys(town.zones).length===0&&town.tiles.every(row=>row.every(t=>!'123'.includes(t))),`${hub}: danger in town`);
 assert(field.objects.every(o=>!['inn','shop','rest','board','npc','gate'].includes(o.type)),`${hub}: town service in field`);
 for(const m of [town,field]){
  assert(walkable(m,...m.safeAnchor),`${m.name}: blocked anchor`);
  assert(new Set(m.objects.map(o=>`${o.x},${o.y}`)).size===m.objects.length,`${m.name}: overlapping objects`);
  const seen=reachable(m);
  for(const o of m.objects){
   assert(o.x>=0&&o.x<m.w&&o.y>=0&&o.y<m.h,`${m.name}: out of bounds ${o.id}`);
   const approach=o.walk?seen.has(`${o.x},${o.y}`):[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen.has(`${o.x+dx},${o.y+dy}`));
   assert(approach,`${m.name}: unreachable object ${o.id}`);
   if(o.to){assert(maps[o.to],`${m.name}: missing destination ${o.to}`);assert(walkable(maps[o.to],o.tx,o.ty),`${m.name}: blocked arrival ${o.id} -> ${o.to} ${o.tx},${o.ty}`);}
  }
  if(m.kind==='field')for(let z=1;z<=3;z++){
   assert(areas[m.zones[z]],`${hub}: unknown area ${z}`);
   assert(m.tiles.some((row,y)=>row.some((t,x)=>t===String(z)&&seen.has(`${x},${y}`))),`${hub}: unreachable zone ${z}`);
  }
 }
 layouts.add(JSON.stringify(field.tiles));
 const out=town.objects.find(o=>o.fieldExit&&o.to===pair.field),back=field.objects.find(o=>o.fieldExit&&o.to===hub);
 assert(out&&back,`${hub}: missing physical exits`);
}
assert(Object.keys(pairs).length===Object.keys(hubs).length&&Object.keys(pairs).length===51,'all 51 hubs need separate maps');
assert(layouts.size===51,'field layouts must be distinct');
assert(townLayouts.size===51,'town layouts must be distinct');
for(const m of Object.values(maps))for(const o of m.objects.filter(o=>o.type==='door'||o.type==='gate')){
 assert(maps[o.to]&&walkable(maps[o.to],o.tx,o.ty),`${m.name}: invalid door/gate destination ${o.id}`);
}
console.log(`Split maps: ${townLayouts.size} distinct safe towns, ${layouts.size} distinct outdoor maps, every zone/object/exit reachable`);
