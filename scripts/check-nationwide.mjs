import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(root,'src',name),'utf8');
const data=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js'].map(read).join('\n');
const ui=read('ui.js');
const guard=ui.match(/function nationalRouteAvailable\(st,from,to\)\{[\s\S]*?\n\}/)?.[0];
if(!guard) throw new Error('route guard missing');
const {prefs,implemented,routes,hubs,maps,areas,can,order}=runInNewContext(`${data}\n${guard}\n({prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES,hubs:HUBS,maps:MAPS,areas:AREAS,can:nationalRouteAvailable,order:NATIONWIDE_ORDER})`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
assert(prefs.length===47&&Object.keys(implemented).length===47,'47 prefectures need playable hubs');
assert(order.length===43&&new Set(order).size===43,'new city registry missing or duplicated');
assert(Object.keys(hubs).length===51&&routes.length===50,'hub or route count wrong');
const walkable=(m,x,y)=>x>=0&&x<m.w&&y>=0&&y<m.h&&'.,123w='.includes(m.tiles[y][x])&&!m.objects.some(o=>o.x===x&&o.y===y&&!o.walk);
const reachable=(m,start,target)=>{
  const queue=[start],seen=new Set([start.join(',')]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];if(x===target[0]&&y===target[1])return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(!seen.has(key)&&walkable(m,nx,ny)){seen.add(key);queue.push([nx,ny]);}
    }
  }
  return false;
};
for(const p of prefs){
  const ids=implemented[p.id];assert(ids?.length>0,`${p.id} lacks a playable hub`);
  for(const id of ids) assert(hubs[id]&&maps[id],`${id} missing hub or map`);
}
for(const n of order){
  const id=`NW${String(n).padStart(2,'0')}`,m=maps[id];
  assert(walkable(m,...m.safeAnchor),`${id} unsafe arrival`);
  assert(new Set(m.objects.map(o=>`${o.x},${o.y}`)).size===m.objects.length,`${id} overlapping objects`);
  for(let zone=1;zone<=3;zone++){
    const area=m.zones[zone];assert(areas[area]?.list.length===50,`${area} enemy list missing`);
    const point=m.tiles.flatMap((row,y)=>row.map((tile,x)=>tile===String(zone)?[x,y]:null)).find(Boolean);
    assert(point&&reachable(m,m.safeAnchor,point),`${area} unreachable`);
  }
}
const locked={quests:{M08:'locked'}},open={quests:{M08:'complete'}};
assert(!can(locked,'KY08','NW44')&&can(open,'KY08','NW44'),'Aso completion gate failed');
assert(can(open,'NW44','KY08')&&can(open,'NW01','NW02'),'reverse or final route failed');
for(const r of routes){
  const fm=maps[r.from],tm=maps[r.to];assert(fm&&tm,`${r.id} missing map`);
  const forward=fm.objects.find(o=>o.id===r.firstGateId&&o.to===r.to);
  assert(forward,`${r.id} first gate missing`);
  const approach=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walkable(fm,forward.x+dx,forward.y+dy)&&reachable(fm,fm.safeAnchor,[forward.x+dx,forward.y+dy]));
  assert(approach&&reachable(tm,[forward.tx,forward.ty],tm.safeAnchor),`${r.id} forward travel blocked`);
  if(r.from.startsWith('NW')||r.to.startsWith('NW')){
    const back=tm.objects.find(o=>o.type==='gate'&&o.to===r.from);
    assert(back&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walkable(tm,back.x+dx,back.y+dy)&&reachable(tm,tm.safeAnchor,[back.x+dx,back.y+dy])),`${r.id} return gate blocked`);
  }
}
const seen=new Set(['KY01']);let changed=true;
while(changed){changed=false;for(const r of routes){if(seen.has(r.from)&&!seen.has(r.to)){seen.add(r.to);changed=true;}if(seen.has(r.to)&&!seen.has(r.from)){seen.add(r.from);changed=true;}}}
assert(seen.size===51,'some hubs disconnected');
console.log('Nationwide: 47 prefectures, 51 hubs, 50 connected routes, 129 new areas, gates and unlock OK');

