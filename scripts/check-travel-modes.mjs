import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(n=>n!=='input.js');
const noop=()=>{};
const g=runInNewContext(files.map(n=>read('src/'+n)).join('\n')+`
render=()=>{};refreshHere=()=>{};commit=()=>Promise.resolve(true);say=()=>{G.dlg=null;};randInt=()=>1;
({G,ACT,MAPS,HUBS,NATIONAL_ROUTES,newGame,walkTo,arrive,interact,railTravelStatus,nationalRouteAvailable,migrate})`,{
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
  assert(exit,hub+' exit');assert(walkToObject(exit)>0);assert.equal(st.mapId,h.fieldMap,hub+' town-to-field');
  const back=g.MAPS[st.mapId].objects.find(o=>o.fieldExit);assert(walkToObject(back)>0);assert.equal(st.mapId,hub,hub+' field-to-town');
  assert(g.MAPS[hub].objects.some(o=>o.type==='station'));assert(!g.MAPS[hub].objects.some(o=>o.type==='gate'));
}
for(const route of g.NATIONAL_ROUTES)for(const [from,to] of [[route.from,route.to],[route.to,route.from]]){
  place(st,g.HUBS[from].fieldMap);const gate=g.MAPS[st.mapId].objects.find(o=>o.fieldRoute&&o.toHub===to);
  assert(gate);const original=st.mapId;g.interact(gate);assert.equal(st.mapId,original,'remote exit cannot teleport');
  assert(walkToObject(gate)>0);assert.equal(st.mapId,g.HUBS[to].fieldMap,'intercity arrival remains outdoors');
  assert.notEqual(st.pos.x,g.MAPS[st.mapId].objects.find(o=>o.fieldRoute&&o.toHub===from).x,'arrival must avoid automatic bounce');
}
for(const route of g.NATIONAL_ROUTES.filter(r=>r.requiredQuest)){
  const locked=fresh();locked.quests[route.requiredQuest]='active';place(locked,g.HUBS[route.from].fieldMap);
  const gate=g.MAPS[locked.mapId].objects.find(o=>o.fieldRoute&&o.toHub===route.to);walkToObject(gate);
  assert.equal(locked.mapId,g.HUBS[route.from].fieldMap,'boss progression lock must remain');
}
const rail=fresh();rail.visitedHubs=['KY01','KY02'];place(rail,'KY01');
const station=g.MAPS.KY01.objects.find(o=>o.type==='station');walkToObject(station);assert.equal(g.G.sheet,'rail');
g.ACT.railGo({dataset:{v:'KY03'}});assert.equal(rail.mapId,'KY01','train cannot reach an unvisited city');
g.G.readOnly=true;g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01');g.G.readOnly=false;
const stationPosition={...rail.pos};rail.pos={x:19,y:19};g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01','station proximity required');
rail.pos=stationPosition;g.G.sheetData.stationId='stale';g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01');g.G.sheetData.stationId=station.id;
g.ACT.railGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY02','train must arrive in visited town');
place(rail,'KY01');g.G.sheet='travel';g.ACT.doTravel();assert.equal(rail.mapId,'KY01','legacy direct travel disabled');
g.G.sheet='map';g.ACT.worldGo({dataset:{v:'KY02'}});assert.equal(rail.mapId,'KY01','map only plans a walk');assert(g.G.walk.path.length>0);finishWalk();assert.equal(rail.mapId,g.HUBS.KY01.fieldMap);
place(rail,'KY01');rail.pos={x:station.x,y:station.y};const restored=g.migrate(JSON.parse(JSON.stringify(rail)));assert.notDeepEqual(restored.pos,{x:station.x,y:station.y},'legacy gate position recovers to walkable ground');
console.log('Travel: all51 physical town exits, all50 outdoor routes both ways, progression locks, station-only visited trains, stale/readonly guards and legacy position recovery passed');
