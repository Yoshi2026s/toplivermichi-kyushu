import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(root,'src',name),'utf8');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','core.js','ui.js'];
const source=files.map(read).join('\n');
const sound={current:null,play(name){this.current=name;},sfx(){},jingle(){}};
const noop=()=>{};
const g=runInNewContext(`${source}
render=()=>{};
commit=()=>Promise.resolve(true);
refreshHere=()=>{};
let testRandomCalls=0;
randInt=()=>{testRandomCalls++;return 0;};
({G,ACT,newGame,ensureVitals,completeQuest,refreshMainQuests,applyVictory,createBossRun,
  createFieldRun,migrate,chapterCap,levelOf,rankOf,charStats,bossReward,zoneAt,walkable,
  arrive,interact,startBattle,toResult,resultDone,startTurnCue,enemyPhase,nationalRouteAvailable,
  QUESTS,BOSSES,AREAS,HUBS,MAPS,SCENES,STORY_CHAPTERS,NATIONAL_MAP_PAIRS,NATIONAL_ROUTES,
  NATIONWIDE_STORIES,NATIONWIDE_QUEST_ORDER,MOE_RANKS,MAP_LAYOUT_VERSION,
  randomCalls:()=>testRandomCalls})`,{
  document:{addEventListener:noop,querySelector:()=>null,getElementById:()=>null},
  window:{addEventListener:noop,matchMedia:()=>({matches:true})},
  navigator:{},localStorage:{getItem:()=>null},SND:sound,
  setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,
  performance:{now:()=>0},console
});
const makeState=()=>{const s=g.newGame('全国検査','女性');g.ensureVitals(s);s.settings.reduceMotion=true;return s;};
function explore(s,mapId=s.mapId){
  g.G.st=s;g.G.screen='explore';g.G.sheet=null;g.G.dlg=null;g.G.readOnly=false;
  g.G.walk={path:[],prog:0,pending:null};s.mapId=mapId;
}
function closeDialogs(){
  let count=0;
  while(g.G.dlg){assert(++count<10,'scene chain must terminate');g.ACT.dlgSkip();}
}
function position(s,map,point=map.safeAnchor){s.mapId=Object.keys(g.MAPS).find(id=>g.MAPS[id]===map);s.pos={x:point[0],y:point[1]};}
function winCurrent(){
  const run=g.G.st.run;assert(run,'battle must start');
  run.state='won';run.enemies.forEach(e=>{e.hp=0;});
  g.toResult();assert.equal(g.G.screen,'result');assert.equal(g.G.st.run,null);
  const snapshot=JSON.stringify(g.G.st);
  const duplicate=g.applyVictory(g.G.st,run);
  assert.equal(duplicate.xp,0);assert.equal(duplicate.gold,0);
  assert.equal(JSON.stringify(g.G.st),snapshot,'battle rewards must apply once');
  g.toResult();assert.equal(JSON.stringify(g.G.st),snapshot,'stale result button must do nothing');
  g.resultDone();closeDialogs();return run;
}

assert.equal(g.NATIONWIDE_QUEST_ORDER.length,51);
assert.equal(Object.keys(g.NATIONWIDE_STORIES).length,43);
assert.equal(new Set(g.NATIONWIDE_QUEST_ORDER).size,51);
assert.equal(new Set(Object.values(g.NATIONWIDE_STORIES).map(s=>s.title)).size,43);
assert.equal(new Set(Object.values(g.NATIONWIDE_STORIES).map(s=>g.BOSSES[s.bossId].name)).size,43);
assert.equal(g.MAP_LAYOUT_VERSION,makeState().mapLayoutVersion);
const patterns=new Set();
for(const story of Object.values(g.NATIONWIDE_STORIES)){
  const q=g.QUESTS[story.questId],boss=g.BOSSES[story.bossId];
  assert.equal(q.requires,story.previousQuest);assert(q.reward.xp>0&&q.reward.gold>0&&q.reward.tickets>0);
  assert(g.SCENES[q.introScene].lines('検査').length>=4);
  assert(g.SCENES[q.completeScene].lines('検査').some(line=>line[1]===story.resolution));
  assert.equal(Object.keys(g.MAPS[g.HUBS[q.hub].fieldMap].zones).length,3);
  assert(g.MAPS[q.hub].objects.some(o=>o.npc===story.npcId));
  assert(g.MAPS[g.HUBS[q.hub].fieldMap].objects.some(o=>o.boss===q.boss));
  patterns.add(boss.cycle.map(s=>s.t+(s.heavy?'!':'')).join(','));
  for(let i=0;i<boss.cycle.length;i++)if(boss.cycle[i].heavy){
    assert.equal(boss.cycle[(i+boss.cycle.length-1)%boss.cycle.length].t,'c',`${q.boss}: strong attack needs warning`);
    const run=g.createBossRun(makeState(),q.boss);
    for(const member of run.party)member.hp=member.maxHP=1000000;
    run.turn=((i+boss.cycle.length-1)%boss.cycle.length)+1;
    g.startTurnCue(run);assert.equal(run.cue.active,true);
    run.cue.ready=true;run.turn=i+1;g.startTurnCue(run);
    assert.equal(run.cue.active,false);assert.equal(run.cue.ready,true);
    g.enemyPhase(run);assert.equal(run.cue.ready,false);
  }
}
assert(patterns.size>=6,'regional bosses need varied attack patterns');

// Walk the complete UI progression: accept in town, leave through a physical exit,
// encounter outdoors, defeat the local boss, finish scenes and take the next gate.
const journey=makeState();explore(journey);
let fieldVictories=0;
for(let index=0;index<g.NATIONWIDE_QUEST_ORDER.length;index++){
  const id=g.NATIONWIDE_QUEST_ORDER[index],q=g.QUESTS[id],town=g.MAPS[q.hub];
  assert.equal(journey.mapId,q.hub,`${id}: previous route must arrive in this town`);
  assert.equal(journey.quests[id],'available',`${id}: quest must unlock in order`);
  const lockedRoute=g.NATIONAL_ROUTES.find(route=>route.from===q.hub&&route.requiredQuest===id);
  if(lockedRoute){
    assert.equal(g.nationalRouteAvailable(journey,lockedRoute.from,lockedRoute.to),false,`${id}: forward route needs boss completion`);
    assert.equal(g.nationalRouteAvailable(journey,lockedRoute.to,lockedRoute.from),true,`${id}: backward return must remain open`);
  }
  if(index+1<g.NATIONWIDE_QUEST_ORDER.length)assert.equal(journey.quests[g.NATIONWIDE_QUEST_ORDER[index+1]],'locked');
  g.G.sheet='quests';g.ACT.acceptQuest({dataset:{v:id}});
  assert.equal(journey.quests[id],'active');assert.equal(journey.activeQuest,id);closeDialogs();
  const exit=town.objects.find(o=>o.fieldExit);
  journey.pos={x:exit.x,y:exit.y};const randomBefore=g.randomCalls();g.arrive();
  assert.equal(journey.mapId,g.HUBS[q.hub].fieldMap);assert.equal(g.randomCalls(),randomBefore,'town exit cannot roll encounters');
  const field=g.MAPS[journey.mapId];
  const danger=field.tiles.flatMap((row,y)=>row.map((_,x)=>g.zoneAt(field,x,y)&&g.walkable(field,x,y)?[x,y]:null)).find(Boolean);
  assert(danger,`${id}: reachable outdoor combat tile required`);
  let fights=0;
  while(journey.quests[id]==='active'){
    assert(++fights<=q.kills,`${id}: enemy victories must advance the quest`);
    position(journey,field,danger);g.arrive();assert.equal(journey.run?.kind,'field');
    winCurrent();fieldVictories++;
  }
  assert.equal(journey.quests[id],'bossReady');
  const bossObject=field.objects.find(o=>o.boss===q.boss);assert(bossObject);
  journey.pos={x:bossObject.x,y:bossObject.y};g.G.sheet='boss';g.G.sheetData={bid:q.boss};
  g.ACT.bossGo({dataset:{v:q.boss}});assert.equal(journey.run?.bossId,q.boss);
  const before={gold:journey.gold,xp:journey.xp,tickets:journey.tickets};
  winCurrent();
  assert.equal(journey.quests[id],'complete');assert.equal(journey.activeQuest,null);
  assert.equal(journey.bossDefeated[q.boss],true);
  assert.equal(journey.gold-before.gold,g.bossReward(q.boss).gold+(q.reward?.gold||0));
  assert.equal(journey.tickets-before.tickets,q.reward?.tickets??200);
  assert.equal('stream' in journey,false);
  const settled=JSON.stringify(journey);g.completeQuest(journey,id,{});assert.equal(JSON.stringify(journey),settled,'quest rewards must apply once');
  const back=field.objects.find(o=>o.fieldExit);journey.pos={x:back.x,y:back.y};g.arrive();
  assert.equal(journey.mapId,q.hub,'return exit must reach the town');
  const nextId=g.NATIONWIDE_QUEST_ORDER[index+1];
  if(nextId){
    const nextHub=g.QUESTS[nextId].hub,gate=town.objects.find(o=>o.type==='gate'&&o.to===nextHub);
    assert(gate,`${id}: next physical transport gate missing`);
    assert(g.nationalRouteAvailable(journey,q.hub,nextHub),`${id}: completion must open route`);
    const adjacent=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>[gate.x+x,gate.y+y]).find(p=>g.walkable(town,...p));
    journey.pos={x:adjacent[0],y:adjacent[1]};g.G.sheet='travel';g.G.sheetData={to:gate.to,tx:gate.tx,ty:gate.ty,gateId:gate.id};
    g.ACT.doTravel();closeDialogs();assert.equal(journey.mapId,nextHub);
  }
}
assert(fieldVictories>=140);assert.equal(journey.nationalClear,true);
assert.equal(g.MOE_RANKS[journey.moeRank],'S6');assert.equal(journey.scenes.NATIONWIDE_END,true);
assert.equal(g.chapterCap(journey),600);
const completedSnapshot=JSON.stringify(journey);g.resultDone();assert.equal(g.G.dlg,null);assert.equal(JSON.stringify(journey),completedSnapshot);
g.G.sheet='record';g.ACT.replayStory({dataset:{v:'NATIONWIDE_END'}});assert(g.G.dlg);closeDialogs();
assert.equal(JSON.stringify(journey),completedSnapshot,'ending replay must not change rewards or progress');
const lockedReplay=makeState();explore(lockedReplay);g.G.sheet='record';
g.ACT.replayStory({dataset:{v:'NATIONWIDE_END'}});assert.equal(g.G.dlg,null);
g.ACT.replayStory({dataset:{v:g.QUESTS.N44.completeScene}});assert.equal(g.G.dlg,null);

// Old boss-cleared saves finish their remaining quest settlement once, retaining
// items, gear, gold and a separate currently active quest.
for(const id of ['M02','M03','M04','M05','M06','M07','M08','N44']){
  const legacy=makeState(),index=g.NATIONWIDE_QUEST_ORDER.indexOf(id);
  for(const previous of g.NATIONWIDE_QUEST_ORDER.slice(0,index))g.completeQuest(legacy,previous);
  legacy.quests[id]='combatDone';legacy.activeQuest=id;legacy.bossDefeated[g.QUESTS[id].boss]=true;
  legacy.stream={hub:g.QUESTS[id].hub,hand:2,score:40};delete legacy.mapLayoutVersion;
  legacy.gold=1234;legacy.vaultGold=567;legacy.bag[0].n=7;
  const bag=JSON.stringify(legacy.bag),equip=JSON.stringify(legacy.equip),tickets=legacy.tickets;
  g.migrate(legacy);assert.equal(legacy.quests[id],'complete');assert.equal(legacy.activeQuest,null);
  assert.equal('stream' in legacy,false);assert.equal(legacy.vaultGold,567);assert.equal(JSON.stringify(legacy.equip),equip);
  assert.equal(legacy.bag[0].n,7);assert(JSON.parse(bag).length<=legacy.bag.length);
  assert.equal(legacy.gold,1234+(g.QUESTS[id].reward?.gold||0));
  assert.equal(legacy.tickets,tickets+(g.QUESTS[id].reward?.tickets??200));
  assert.equal(legacy.mapLayoutVersion,g.MAP_LAYOUT_VERSION);
  const once=JSON.stringify(legacy);g.migrate(legacy);assert.equal(JSON.stringify(legacy),once,'save migration must be idempotent');
}
const separateActive=makeState();separateActive.quests.M02='combatDone';separateActive.activeQuest='S01';separateActive.quests.S01='active';
g.migrate(separateActive);assert.equal(separateActive.quests.M02,'complete');assert.equal(separateActive.activeQuest,'S01');
const currentLayout=makeState(),town=g.MAPS.KY01;
const alternate=town.tiles.flatMap((row,y)=>row.map((_,x)=>g.walkable(town,x,y)&&!town.objects.some(o=>o.x===x&&o.y===y)?[x,y]:null)).find(p=>p&&(p[0]!==town.safeAnchor[0]||p[1]!==town.safeAnchor[1]));
currentLayout.pos={x:alternate[0],y:alternate[1]};g.migrate(currentLayout);
assert.equal(currentLayout.pos.x,alternate[0]);assert.equal(currentLayout.pos.y,alternate[1],'current-layout saves keep their saved location');
const caps=makeState();
assert.equal(g.chapterCap(caps),100);
for(let i=0;i<g.STORY_CHAPTERS.length;i++){
  const chapter=g.STORY_CHAPTERS[i];assert(g.QUESTS[chapter.completionQuest]?.main);
  caps.quests[chapter.completionQuest]='complete';
  assert.equal(g.chapterCap(caps),g.STORY_CHAPTERS[Math.min(i+1,g.STORY_CHAPTERS.length-1)].cap);
}

// Every safe map rejects encounter creation even with RNG forced to encounter.
for(const [mapId,map] of Object.entries(g.MAPS).filter(([,m])=>m.kind!=='field')){
  const safe=makeState();explore(safe,mapId);safe.pos={x:map.safeAnchor[0],y:map.safeAnchor[1]};
  const before=g.randomCalls();g.arrive();assert.equal(safe.run,null,`${mapId}: encounter in a safe map`);
  assert.equal(g.randomCalls(),before,`${mapId}: safe map used encounter RNG`);
  const battle=g.createFieldRun(safe,'KY01-A1',{count:0,picks:[0,0]});g.startBattle(battle);
  assert.equal(safe.run,null,`${mapId}: direct battle entry must reject safe maps`);
}
console.log(`National story: ${g.NATIONWIDE_QUEST_ORDER.length} main quests, 43 local stories/bosses, ${patterns.size} boss patterns, ${fieldVictories} outdoor encounter victories; complete UI progression, old-save migration, rewards, ending/replay and chapter caps passed`);
