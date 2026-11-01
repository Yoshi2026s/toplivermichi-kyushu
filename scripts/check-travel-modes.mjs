import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {illustratedContext} from './illustrated-runtime.mjs';
const root=new URL('../',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(n=>n!=='input.js');
const noop=()=>{};
const g=await illustratedContext(files.map(n=>read('src/'+n)).join('\n')+`
render=()=>{};refreshHere=()=>{};commit=()=>Promise.resolve(true);say=()=>{G.dlg=null;};randInt=()=>1;
({G,ACT,WORLD,WORLD_ID,WORLD_OLD_ROUTES,worldSeaRoute,worldRefreshAccess,worldPointPath,encodeWorldSave,worldHubUnlocked,walkable,worldRegionAt,MAPS,HUBS,NATIONAL_ROUTES,newGame,walkTo,arrive,interact,railTravelStatus,nationalRouteAvailable,migrate})`,{
  document:{hidden:false,addEventListener:noop,querySelector:()=>null,getElementById:()=>null},
  window:{addEventListener:noop},navigator:{},setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,
  localStorage:{getItem:()=>null},performance:{now:()=>0}
});
function fresh(){const s=g.newGame('移動検証','男性');s.settings.listenerComments=false;s.fukuokaClear=true;for(const id of Object.keys(s.quests))s.quests[id]='complete';return s;}
function place(st,map){g.G.st=st;st.mapId=map;const [x,y]=g.MAPS[map].safeAnchor;st.pos={x,y};st.run=null;g.G.screen='explore';g.G.sheet=null;g.G.dlg=null;g.G.readOnly=false;g.G.lock=false;g.G.walk={path:[],prog:0,pending:null};}
function finishWalk(){let steps=0;while(g.G.walk.path.length){assert(++steps<2000,'walk must terminate');const p=g.G.walk.path.shift();g.G.st.pos={x:p.x,y:p.y};g.G.walk.prog=0;g.arrive();}return steps;}
function walkToObject(o){g.walkTo(o.x,o.y);return finishWalk();}
const st=fresh();
for(const [hub,h] of Object.entries(g.HUBS)){
  place(st,hub);const exit=g.MAPS[hub].objects.find(o=>o.fieldExit&&!o.oceanRoute);
  assert(exit,hub+' exit');assert(walkToObject(exit)>0);assert.equal(st.mapId,g.WORLD_ID,hub+' town-to-continuous-field');
  const back=g.MAPS[st.mapId].objects.find(o=>o.fieldExit&&o.regionHub===hub);assert(walkToObject(back)>0);assert.equal(st.mapId,hub,hub+' field-to-town');
  assert(g.MAPS[hub].objects.some(o=>o.type==='station'));assert(!g.MAPS[hub].objects.some(o=>o.type==='gate'));
}
for(const route of g.WORLD.links)for(const [from,to] of [[route.from,route.to],[route.to,route.from]]){
 place(st,g.WORLD_ID);g.worldRefreshAccess(st,true);const a=g.WORLD.byHub.get(from),b=g.WORLD.byHub.get(to);st.pos={x:a.x+a.old.safeAnchor[0],y:a.y+a.old.safeAnchor[1]};
 if(route.sea){if(g.worldSeaRoute({from,to})&&!(from.startsWith('KY')&&to.startsWith('KY'))){const goal={x:b.x+b.old.safeAnchor[0],y:b.y+b.old.safeAnchor[1]},land=g.worldPointPath(g.MAPS[g.WORLD_ID],st.pos.x,st.pos.y,(x,y)=>x===goal.x&&y===goal.y,goal);assert.equal(land,null,from+' sea route must not have an accidental walking bridge to '+to);}const port=a.port;assert(port);g.interact(port);assert.equal(g.G.sheet,null,'remote port cannot open');st.pos={x:port.x-1,y:port.y};for(const screen of ['battle','result','title']){g.G.screen=screen;g.interact(port);assert.equal(g.G.sheet,null,'port interaction requires exploration');}g.G.screen='explore';g.G.sheet='settings';g.interact(port);assert.equal(g.G.sheet,'settings','port cannot replace another screen');g.G.sheet=null;g.G.dlg={};g.interact(port);assert.equal(g.G.sheet,null);g.G.dlg=null;g.G.lock=true;g.interact(port);assert.equal(g.G.sheet,null);g.G.lock=false;g.interact(port);assert.equal(g.G.sheet,'worldFerry');g.G.screen='result';const beforeSail=JSON.stringify(st);g.ACT.worldSail({dataset:{port:port.id,to}});assert.equal(JSON.stringify(st),beforeSail,'stale ship action cannot travel outside exploration');g.G.screen='explore';g.G.lock=true;g.ACT.worldSail({dataset:{port:port.id,to}});assert.equal(JSON.stringify(st),beforeSail);g.G.lock=false;g.G.readOnly=true;g.ACT.worldSail({dataset:{port:port.id,to}});assert.equal(g.worldRegionAt(st.pos).hub,from);g.G.readOnly=false;g.ACT.worldSail({dataset:{port:port.id,to}});assert.equal(st.mapId,g.WORLD_ID);assert.equal(g.worldRegionAt(st.pos).hub,to,'ship arrives at destination port');}
 else{const target={x:b.x+b.old.safeAnchor[0],y:b.y+b.old.safeAnchor[1]},path=g.worldPointPath(g.MAPS[g.WORLD_ID],st.pos.x,st.pos.y,(x,y)=>x===target.x&&y===target.y,target);assert(path?.length,from+' continuous road '+to);for(const p of path)assert(g.walkable(g.MAPS[g.WORLD_ID],p.x,p.y));assert.equal(st.mapId,g.WORLD_ID,'land route retains the same map');}
}
const locked=g.newGame('未解放','男性');place(locked,g.WORLD_ID);g.worldRefreshAccess(locked,true);for(const r of g.WORLD.regions)if(!g.worldHubUnlocked(locked,r.hub)){const x=r.x+r.old.safeAnchor[0],y=r.y+r.old.safeAnchor[1];assert(!g.walkable(g.MAPS[g.WORLD_ID],x,y),r.hub+' locked ground');}
for(const r of g.WORLD.regions){const saved=fresh();place(saved,r.field);const old={...saved.pos};g.migrate(saved);assert.equal(saved.mapId,g.WORLD_ID);assert.equal(saved.pos.x,r.x+old.x);const packed=g.encodeWorldSave(saved);assert.equal(packed.mapId,r.field);assert.deepEqual({...packed.pos},old);const restored=g.migrate(JSON.parse(JSON.stringify(packed)));assert.equal(restored.pos.x,saved.pos.x);assert.equal(restored.pos.y,saved.pos.y);}
const townSave=fresh();place(townSave,'KY02');townSave.visitedMaps.push(g.WORLD_ID);const encodedTown=g.encodeWorldSave(townSave);assert(!encodedTown.visitedMaps.includes(g.WORLD_ID),'town save strips world ID for old clients');const townRestored=g.migrate(JSON.parse(JSON.stringify(encodedTown)));assert.equal(townRestored.mapId,'KY02');
const rail=fresh();rail.visitedHubs=['KY01','KY02'];place(rail,'KY01');
const station=g.MAPS.KY01.objects.find(o=>o.type==='station');walkToObject(station);assert.equal(g.G.sheet,'rail');
g.ACT.railGo({dataset:{v:'KY03'}});assert.equal(rail.mapId,'KY01','train cannot reach an unvisited city');
g.G.readOnly=true;g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01');g.G.readOnly=false;
const stationPosition={...rail.pos};rail.pos={x:19,y:19};g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01','station proximity required');
rail.pos=stationPosition;g.G.sheetData.stationId='stale';g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01');g.G.sheetData.stationId=station.id;
g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY02','train must arrive in visited town');
place(rail,'KY01');g.G.sheet='travel';g.ACT.doTravel();assert.equal(rail.mapId,'KY01','legacy direct travel disabled');
g.G.sheet='map';g.ACT.worldGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01','map only plans a walk');assert(g.G.walk.path.length>0);finishWalk();assert.equal(rail.mapId,g.WORLD_ID);
place(rail,'KY01');rail.pos={x:station.x,y:station.y};const restored=g.migrate(JSON.parse(JSON.stringify(rail)));assert.notDeepEqual(restored.pos,{x:station.x,y:station.y},'legacy gate position recovers to walkable ground');
console.log('Travel: all51 physical town exits, all continuous roads and port ships both ways, all51 save fallbacks, progression locks, station-only visited trains, stale/readonly guards and legacy position recovery passed');
