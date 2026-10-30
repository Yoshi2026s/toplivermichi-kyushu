import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createCanvas} from './canvas-runtime.mjs';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','data_character.js','data_extras.js','data_pets.js','data_ocean.js','core.js','art.js','ocean.js','ui.js','ui_ocean.js'].filter(f=>existsSync(resolve(root,'src',f)));
const source=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const noop=()=>{},sound={current:null,play(id){this.current=id;},sfx:noop,jingle:noop};
const document={hidden:false,addEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:type=>type==='canvas'?createCanvas(1,1):{style:{},classList:{add:noop,remove:noop},remove:noop}};
const g=runInNewContext(`${source}\nrender=()=>{};commit=()=>Promise.resolve(true);refreshHere=()=>{};({G,ACT,MAPS,HUBS,AREAS,QUESTS,DIFFICULTY,OCEAN_AREAS,OCEAN_ROUTES,OCEAN_THEMES,OCEAN_ART_CACHE,OCEAN_ENEMY_COUNT,newGame,ensureVitals,migrateOcean,validateOceanState,createFieldRun,createOceanRun,oceanEnemyDef,pickOceanEnemy,applyVictory,recordOceanVictory,oceanAreaRecord,oceanRouteAvailable,currentOceanArea,oceanEventAvailability,oceanEventToken,claimOceanEvent,walkable,zoneAt,isSafe,interact,startBattle,bfs,oceanEnemySprite,oceanBattleStage,renderSheet,renderDex,ART,setCommitResult(v){commit=()=>Promise.resolve(v);}})`,{
 document,window:{addEventListener:noop,matchMedia:()=>({matches:false})},navigator:{},localStorage:{getItem:()=>null},SND:sound,
 performance:{now:()=>0},setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,requestAnimationFrame:()=>0,cancelAnimationFrame:noop,console
});
function fresh(){const s=g.newGame('海域検査','女性');g.ensureVitals(s);s.settings.reduceMotion=true;g.migrateOcean(s);return s;}
function openSea(s,a){s.quests[g.OCEAN_ROUTES[a.routeId].quest]='complete';s.mapId=a.mapId;s.pos={x:a.point[0],y:a.point[1]};g.G.st=s;g.G.screen='explore';g.G.sheet=null;g.G.sheetData={};g.G.dlg=null;g.G.lock=false;g.G.readOnly=false;g.G.walk={path:[],prog:0,pending:null};}
assert.equal(Object.keys(g.OCEAN_AREAS).length,65);assert.equal(Object.keys(g.OCEAN_ROUTES).length,8);assert.equal(g.OCEAN_ENEMY_COUNT,3250);
const enemyIds=new Set(),names=new Set(),areas=Object.values(g.OCEAN_AREAS);let seaCells=0,portCells=0;
for(const a of areas){
  assert.equal(g.AREAS[a.id].list.length,50);assert(g.OCEAN_ROUTES[a.routeId].areas.includes(a.id));
  const m=g.MAPS[a.mapId];assert.equal(g.zoneAt(m,...a.point),a.id);assert(g.walkable(m,...a.point));
  for(let i=0;i<50;i++){const e=g.oceanEnemyDef(a.id,i);assert(!enemyIds.has(e.id));enemyIds.add(e.id);names.add(e.name);assert(e.q>=a.q&&e.baseHP>0&&e.baseDEF>=0&&e.cycle.every(s=>['s','a','c'].includes(s[0])&&Number.isFinite(s[1])));}
  for(const r of [0,1,4999,9999,123456])assert(g.pickOceanEnemy(a.id,r)>=0&&g.pickOceanEnemy(a.id,r)<50);
}
assert.equal(enemyIds.size,3250);assert.equal(names.size,3250);assert.throws(()=>g.oceanEnemyDef('__proto__',0));assert.throws(()=>g.oceanEnemyDef(areas[0].id,50));
for(const r of Object.values(g.OCEAN_ROUTES)){
  const m=g.MAPS[r.mapId],safe=fresh();assert.equal(m.kind,'field');assert.equal(m.combatDomain,'sea');assert.equal(r.points.length,28);
  assert(!g.oceanRouteAvailable(safe,r.id));safe.quests[r.quest]='complete';assert(g.oceanRouteAvailable(safe,r.id));
  const q=[[...m.safeAnchor]],seen=new Set([m.safeAnchor.join(',')]);
  for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=`${xx},${yy}`;if(!seen.has(k)&&g.walkable(m,xx,yy)){seen.add(k);q.push([xx,yy]);}}}
  assert.equal(seen.size,28,`${r.id}: connected route`);assert(seen.has(r.destination.join(',')));
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=m.tiles[y][x];if('ES'.includes(t)){seaCells++;assert(g.zoneAt(m,x,y));}else if(t==='P'){portCells++;assert.equal(g.zoneAt(m,x,y),null);}else assert(!g.walkable(m,x,y));}
  const town=g.MAPS[r.hub],dock=town.objects.find(o=>o.oceanRoute===r.id);assert(dock&&dock.to===r.mapId);assert(g.bfs(town,...town.safeAnchor,(x,y)=>x===dock.x&&y===dock.y));
  for(const id of r.areas){const a=g.OCEAN_AREAS[id];assert(seen.has(a.point.join(',')));assert(m.objects.some(o=>o.oceanArea===id));}
  safe.mapId=r.mapId;safe.pos={x:3,y:3};g.G.st=safe;g.G.screen='explore';g.G.sheet=null;g.G.dlg=null;g.G.walk={path:[],prog:0,pending:null};assert(g.isSafe());
  g.startBattle(g.createOceanRun(safe,r.areas[0],{count:0,picks:[0,0]}));assert.equal(safe.run,null,'safe port must refuse battle entry');
  g.startBattle(g.createFieldRun(safe,'KY01-A1',{count:0,picks:[0,0]}));assert.equal(safe.run,null,'safe port must refuse a forged land battle too');
}
assert.equal(seaCells,216);assert.equal(portCells,8);
for(const difficulty of Object.keys(g.DIFFICULTY))for(const a of areas){const s=fresh();openSea(s,a);s.settings.difficulty=difficulty;const run=g.createFieldRun(s,a.id,{count:1,picks:[0,9999]});assert(run.enemies.every(e=>Number.isFinite(e.hp)&&e.hp>0&&e.cycle.every(step=>Number.isFinite(step.p)&&step.p>=0)));}
const a=areas[0],s=fresh();openSea(s,a);const run=g.createFieldRun(s,a.id,{count:1,picks:[0,9999]});assert.equal(run.oceanArea,a.id);assert.equal(run.enemies.length,2);
g.startBattle(run);assert.equal(s.run,run);assert.equal(sound.current,'seaBattle');assert(run.enemies.every(e=>s.seen[e.id]));
s.activeQuest='M02';s.quests.M02='active';s.qprog.M02=0;run.state='won';run.enemies.forEach(e=>e.hp=0);
g.applyVictory(s,run);assert.equal(s.qprog.M02,0,'sea kills cannot advance a land quest');assert.equal(g.oceanAreaRecord(s,a.id).kills,2);
const before=JSON.stringify(s);g.applyVictory(s,run);assert.equal(JSON.stringify(s),before,'sea victory reward once');
s.run=null;s.quests.M02='complete';g.recordOceanVictory(s,{oceanArea:a.id,enemies:[{}]}, {notes:[]});assert.equal(g.oceanAreaRecord(s,a.id).kills,3);
const other=areas[1];assert.equal(g.oceanAreaRecord(s,other.id).kills,0);
const gold0=s.gold,tk0=s.tickets;
assert(!g.claimOceanEvent(s,a.id,'treasure').ok);assert(!g.claimOceanEvent(s,a.id,'rescue',{readOnly:true}).ok);assert(!g.claimOceanEvent(s,a.id,'rescue',{busy:true}).ok);
assert(g.claimOceanEvent(s,a.id,'rescue').ok);assert.equal(s.gold,gold0+80);assert(!g.claimOceanEvent(s,a.id,'rescue').ok);
assert(g.claimOceanEvent(s,a.id,'survey').ok);assert.equal(s.tickets,tk0+60);assert(g.claimOceanEvent(s,a.id,'treasure').ok);assert.equal(s.gold,gold0+200);
assert(!g.claimOceanEvent(s,a.id,'survey').ok);assert(!g.claimOceanEvent(s,a.id,'treasure').ok);
const loaded=JSON.parse(JSON.stringify(s)),stable=JSON.stringify(loaded);g.migrateOcean(loaded);assert.equal(JSON.stringify(loaded),stable);
assert(!g.claimOceanEvent(loaded,a.id,'rescue').ok);assert(!g.claimOceanEvent(loaded,other.id,'rescue').ok,'stale area rejects');
for(const bad of [null,[],{version:1,areas:{bad:{kills:0,rescue:false,survey:false,treasure:false}},visitedRoutes:[]},{version:1,areas:{[a.id]:{kills:0,rescue:false,survey:false,treasure:true}},visitedRoutes:[]}]){
  const broken=fresh();broken.ocean=bad;assert.throws(()=>g.validateOceanState(broken));
}
const uiState=fresh();openSea(uiState,a);g.G.sheet='ocean';g.G.sheetData={area:a.id};
g.ACT.oceanEventSelect({dataset:{area:a.id,event:'rescue'}});const pending=g.G.sheetData.pendingEvent;assert(pending);
const oldGold=uiState.gold;g.setCommitResult(false);await g.ACT.oceanEventDo({dataset:{area:a.id,event:'rescue',token:pending.token}});
assert.equal(uiState.gold,oldGold);assert(!g.oceanAreaRecord(uiState,a.id).rescue,'failed save rolls event back');
g.setCommitResult(true);g.G.sheet='ocean';g.G.sheetData={area:a.id};g.G.dlg=null;g.ACT.oceanEventSelect({dataset:{area:a.id,event:'rescue'}});
const good=g.G.sheetData.pendingEvent;await g.ACT.oceanEventDo({dataset:{area:a.id,event:'rescue',token:good.token}});assert(g.oceanAreaRecord(uiState,a.id).rescue);
const unchanged=JSON.stringify(uiState);await g.ACT.oceanEventDo({dataset:{area:a.id,event:'rescue',token:good.token}});assert.equal(JSON.stringify(uiState),unchanged);
g.G.dlg=null;g.G.sheet='ocean';g.G.sheetData={area:a.id};assert(g.renderSheet().includes('65海域'));g.G.sheet='oceanDex';assert(g.renderSheet().includes('/3250項目'));
const forms=new Set();
for(let region=0;region<8;region++)for(let family=0;family<5;family++){
  const c=g.oceanEnemySprite(region,family,0,32);forms.add(createHash('sha256').update(c.toBuffer('image/png')).digest('hex'));
  for(const frame of [0,1])for(const size of [32,64,128])assert.equal(g.oceanEnemySprite(region,family,frame,size).width,size);
}
assert.equal(forms.size,40,'40 distinct sea forms');assert(g.OCEAN_ART_CACHE.enemies.size<=96);
for(const id of Object.keys(g.OCEAN_AREAS))for(let frame=0;frame<4;frame++)assert.equal(g.oceanBattleStage(id,frame).width,160);
assert(g.OCEAN_ART_CACHE.backgrounds.size<=24);
const atlas=createCanvas(8*128,5*128),ctx=atlas.getContext('2d');for(let region=0;region<8;region++)for(let family=0;family<5;family++)ctx.drawImage(g.oceanEnemySprite(region,family,0,128),region*128,family*128);
mkdirSync(resolve(root,'.task'),{recursive:true});writeFileSync(resolve(root,'.task/ocean-forms.png'),atlas.toBuffer('image/png'));
console.log('Ocean: 65 areas, 3,250 distinct enemy records, 8 connected routes (224 cells/216 sea), safe ports, 40 rendered forms, capped caches, isolated kills, transactional once-only events and save/read-only/stale guards passed');
