import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {illustratedContext} from './illustrated-runtime.mjs';
import {createCanvas} from './canvas-runtime.mjs';
const root=resolve(import.meta.dirname,'..');
const build=readFileSync(resolve(root,'scripts/build.mjs'),'utf8');
const files=[...build.match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(f=>f!=='input.js');
const source=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const listeners={},elements=new Map(),noop=()=>{},classes={add:noop,remove:noop,toggle:noop};
function element(id='',value=''){return {id,value,disabled:false,hidden:false,innerHTML:'',textContent:'',style:{},dataset:{},classList:classes,isConnected:true,addEventListener(type,fn){this.events=this.events||{};this.events[type]=fn;},appendChild:noop,remove:noop,setAttribute:noop,getAttribute:()=>null,focus:noop,select:noop};}
const document={hidden:false,body:{appendChild:noop,classList:classes},addEventListener(t,fn){(listeners[t]||(listeners[t]=[])).push(fn);},querySelector:s=>elements.get(s)||null,querySelectorAll:()=>[],getElementById:id=>elements.get('#'+id)||null,createElement:t=>t==='canvas'?createCanvas(1,1):element()};
const sandbox={document,PAD:{mount:noop},window:{addEventListener:noop,matchMedia:()=>({matches:false}),location:{href:'https://example.test/'}},navigator:{},localStorage:{getItem:()=>null,setItem:noop},URL,performance:{now:()=>1000},setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,requestAnimationFrame:()=>0,cancelAnimationFrame:noop,console};
const g=await illustratedContext(`${source}\nrender=()=>{};commit=()=>Promise.resolve(true);refreshHere=()=>{};({boot,G,ACT,MAPS,HUBS,QUESTS,BOSSES,AREAS,SUPPORTS,SUPPORT_REQUIREMENTS,NATIONWIDE_QUEST_ORDER,JOB_IDS,JOB_EVENTS,CAREERS,PET_SPECIES,PET_SUPPLIES,OCEAN_AREAS,OCEAN_ROUTES,PENDING_BADGES,EXTRA_BADGES,ITEM_BADGES,GROWTH_BADGES,PARTY_BADGES,ACTION_BADGES,HEAL_BADGES,MP_BADGES,CHEER_BADGES,SPEED_BADGES,ATTACK_BADGES,GUARD_BADGES,DEFENSE_BADGES,MAP_LAYOUT_VERSION,newGame,migrate,validateState,ensureVitals,charName,charStats,clone,zoneAt,walkable,interact,walkTo,openSheet,closeSheet,renderSheet,renderExplore,renderNew,renderParty,renderMoe,renderRecord,renderBattleChallenges,eligibleBattleBadges,supportAvailable,createFieldRun,createBossRun,createTrainingRun,startBattle,toResult,resultDone,applyVictory,petDefault,petOwned,petUiToken,migratePets,petTurnStart,preparePetRun,validateSetup,mountNew,jobEventToken,characterCanManage,oceanEventToken,petUiCanEdit,oceanUiCanAct,setCommit(fn){commit=fn;},setLoad(fn){loadSave=fn;}})`,sandbox);
const tests=[],failures=[];let assertions=0;
async function test(name,fn){try{await fn();tests.push(name);console.log('PASS '+name);}catch(e){failures.push({name,error:e.stack||String(e)});console.log('FAIL '+name+': '+e.message);}}
function fresh(name='統合検査'){const s=g.newGame(name,'男性',{careerId:'CR01',heroine:{name:'相棒ひかり',gender:'女性'}});g.ensureVitals(s);s.settings.reduceMotion=true;s.settings.listenerComments=false;return s;}
function setExplore(s,map=s.mapId){g.G.st=s;g.G.screen='explore';g.G.sheet=null;g.G.sheetData={};g.G.dlg=null;g.G.readOnly=false;g.G.lock=false;g.G.auto=false;g.G.walkPlan=null;g.G.sheetHistory=[];g.G.walk={path:[],prog:0,pending:null};for(const k of ['petSaving','oceanSaving','characterSaving','featureSaving','vaultSaving','shopSaving'])g.G[k]=false;s.mapId=map;s.pos={x:g.MAPS[map].safeAnchor[0],y:g.MAPS[map].safeAnchor[1]};}
function dispatch(action,data={}){const el=element();el.dataset={a:action,...data};el.closest=()=>el;for(const fn of listeners.click||[])fn({target:el});return el;}
function closeDialogs(){let n=0;while(g.G.dlg){assert(++n<100,'dialog chain terminates');g.ACT.dlgSkip();}}
function fieldPoint(map,area){for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if(g.zoneAt(map,x,y)===area&&g.walkable(map,x,y))return {x,y};throw Error('no encounter cell '+area);}
function win(run){run.state='won';run.enemies.forEach(e=>e.hp=0);g.G.sheet=null;g.G.dlg=null;g.toResult();assert.equal(g.G.screen,'result');const once=JSON.stringify(g.G.st);g.applyVictory(g.G.st,run);assert.equal(JSON.stringify(g.G.st),once);g.resultDone();closeDialogs();}
await test('title boot completes with an image title, with or without a saved game',async()=>{
  g.G.screen='title';g.G.st=null;g.G.hasSave=false;g.setLoad(()=>Promise.resolve(null));await g.boot();assert.equal(g.G.hasSave,false);
  g.setLoad(()=>Promise.resolve({state:g.newGame('起動検査','男性')}));await g.boot();assert.equal(g.G.hasSave,true);
  g.setLoad(()=>Promise.reject(new Error('storage unavailable')));await g.boot();assert.equal(g.G.screen,'title','storage failure still reaches the title');
  g.setLoad(()=>Promise.resolve(null));g.G.hasSave=false;
});
await test('all build modules load together',()=>{assert(files.length>=24);for(const name of ['ui_character.js','ui_pets.js','ui_ocean.js','ui_systems.js','ui_management.js','ui_guards.js'])assert(files.includes(name));assert.equal(files.at(-1),'ui_guards.js');assert.equal(Object.keys(g.PENDING_BADGES).length,0);});
await test('three-stage setup, IME, same names, drafts and atomic save rollback',async()=>{
  const prior=fresh('前の冒険');prior.gold=321;g.G.st=prior;g.G.screen='title';g.G.starting=false;g.ACT.newGame();assert.equal(g.G.newGame.step,1);
  elements.set('#nameInput',element('nameInput','主人公さん'));elements.set('#careerSelect',element('careerSelect','CR02'));
  elements.set('#nameHelp',element('nameHelp'));elements.set('#toConfirm',element('toConfirm'));
  g.ACT.pickGender({dataset:{v:'男性',step:'1'}});g.mountNew();elements.get('#nameInput').events.compositionstart();assert.equal(g.G.newGame.composing,true);assert.equal(elements.get('#toConfirm').disabled,true);g.ACT.newNext();assert.equal(g.G.newGame.step,1);elements.get('#nameInput').events.compositionend();assert.equal(g.G.newGame.composing,false);g.ACT.newNext();assert.equal(g.G.newGame.step,2);
  g.ACT.pickGender({dataset:{v:'男性',step:'1'}});assert.equal(g.G.newGame.heroine.gender,'女性','stale hero gender button cannot change partner');
  elements.delete('#careerSelect');elements.get('#nameInput').value='主人公さん';g.ACT.newNext();assert.equal(g.G.newGame.step,2,'same normalized name refused');
  elements.get('#nameInput').value='相棒さん';g.ACT.newNext();assert.equal(g.G.newGame.step,3);assert(g.renderNew().includes('相棒さん'));
  elements.delete('#nameInput');g.ACT.newBack();assert.equal(g.G.newGame.step,2);assert.equal(g.G.newGame.heroine.name,'相棒さん');
  elements.set('#nameInput',element('nameInput','相棒さん'));g.ACT.newNext();elements.delete('#nameInput');assert.equal(g.G.newGame.step,3);
  g.setCommit(()=>Promise.resolve(false));await g.ACT.startGame(element());assert.equal(g.G.st,prior);assert.equal(prior.gold,321);assert.equal(g.G.screen,'new');assert.equal(g.G.starting,false);
  let resolveSave,savingStarted;const reachedSave=new Promise(r=>savingStarted=r);g.setCommit(()=>{savingStarted();return new Promise(r=>resolveSave=r);});const start=g.ACT.startGame(element());const created=g.G.st;assert(g.G.starting);await g.ACT.startGame(element());assert.equal(g.G.st,created,'double start refused');await reachedSave;resolveSave(true);await start;assert.equal(g.G.screen,'explore');assert.equal(g.G.st.profile.careerId,'CR02');assert.equal(g.charName(g.G.st,'moe'),'相棒さん');closeDialogs();
  const stable=g.G.st;await g.ACT.startGame(element());assert.equal(g.G.st,stable,'stale start refused');g.setCommit(()=>Promise.resolve(true));
});
await test('custom partner name fully replaces fixed biography and profile names',()=>{
  const s=fresh('名前検査');setExplore(s);g.G.sheet='moe';const profile=g.renderMoe();assert(profile.includes('相棒ひかり'));assert(!profile.includes('雪餅羽')&&!profile.includes('のわん'),'profile must not keep previous real name');
  s.scenes.HS00=true;g.G.sheet='moe';g.ACT.replay({dataset:{v:'HS00'}});const text=(g.G.dlg?.lines||[]).map(line=>line.join(' ')).join('\n');assert(text.includes('相棒ひかり'),'introductory dialogue actually opened with the selected name');assert(!text.includes('雪餅羽')&&!text.includes('のわん')&&!text.includes('おやすみセカイ'),'custom introduction must not splice a name into fixed personal biography');closeDialogs();
});
await test('new menus remain reachable through all render wrappers',()=>{
  const s=fresh();setExplore(s);const explore=g.renderExplore();assert(explore.includes('data-k="menu"'));assert(explore.includes('data-k="quests">やる事'));assert(explore.includes('data-k="guide">オート移動'));for(const key of ['pets','map','items','status','party','record','voyage','dex','settings'])assert(!explore.includes('data-k="'+key+'"'),key+' is inside the menu');g.G.sheet='menu';assert(g.renderSheet().includes('data-k="pets"'));
  for(const key of ['pets','ocean','jobcenter','training','help','settings','party','record','dex']){g.G.sheet=key;g.G.sheetData={};const html=g.renderSheet();assert(html&&html.includes('role="dialog"'),key+' renders');}
  g.G.sheet='guide';g.G.sheetData={};const guide=g.renderSheet();assert(guide.includes('航海・海上イベント'));assert(guide.includes('ハローワーク'));
  for(const [id,h]of Object.entries(g.HUBS))assert(g.MAPS[id].objects.some(o=>o.type==='jobcenter'),id+' job center exists');
});
await test('menu back stack and direct MAP return respect readonly, saving and battles',()=>{
  const state=fresh();setExplore(state);g.openSheet('menu');
  for(const key of ['map','items','status','party','record','pets','voyage','dex','settings','help','share'])assert(g.renderSheet().includes('data-k="'+key+'"'),key+' is reachable');
  assert(g.renderSheet().includes('data-a="returnToMap"'));
  g.openSheet('items');g.openSheet('status');assert.equal(g.G.sheetHistory.length,2);g.closeSheet();assert.equal(g.G.sheet,'items');
  g.G.readOnly=true;const saved=JSON.stringify(state);g.ACT.returnToMap();assert.equal(g.G.sheet,null);assert.equal(g.G.sheetHistory.length,0);assert.equal(JSON.stringify(state),saved);g.closeSheet();assert.equal(g.G.sheet,null,'old history cannot reopen a menu');
  g.G.readOnly=false;g.openSheet('menu');g.openSheet('voyage');assert.equal(g.G.sheet,'ocean');g.ACT.oceanBack();assert.equal(g.G.sheet,'menu','voyage returns to its actual parent menu');g.G.vaultSaving=true;g.ACT.returnToMap();assert.equal(g.G.sheet,'menu','saving blocks navigation');g.G.vaultSaving=false;
  g.G.screen='battle';g.ACT.returnToMap();assert.equal(g.G.sheet,'menu','MAP return cannot leave a battle');assert(!g.renderSheet().includes('data-a="returnToMap"'));
  setExplore(state);
});
await test('all47 regional support unlocks and readonly mutation guard',()=>{
  assert.equal(Object.keys(g.SUPPORTS).length,47);const s=fresh();setExplore(s);g.G.sheet='party';
  for(const [id,r]of Object.entries(g.SUPPORT_REQUIREMENTS)){assert(!g.supportAvailable(s,id));s.quests[r.quest]='complete';if(r.extra)s.quests[r.extra]='complete';if(r.npc)s.talked[r.npc]=true;assert(g.supportAvailable(s,id));}
  const html=g.renderParty();for(const name of Object.values(g.SUPPORTS).map(v=>v.name))assert(html.includes(name));
  g.G.readOnly=true;const before=JSON.stringify(s);dispatch('setSupport',{v:Object.keys(g.SUPPORTS)[0]});assert.equal(JSON.stringify(s),before);g.G.readOnly=false;
});
await test('all100 badge names and expanded/pet/challenge eligibility connect to main list',()=>{
  const names={...g.ITEM_BADGES,...g.GROWTH_BADGES,...g.PARTY_BADGES,...g.ACTION_BADGES,...g.HEAL_BADGES,...g.MP_BADGES,...g.CHEER_BADGES,...g.SPEED_BADGES,...g.ATTACK_BADGES,...g.GUARD_BADGES,...g.DEFENSE_BADGES,...g.EXTRA_BADGES};assert.equal(Object.keys(names).length,100);
  const s=fresh();setExplore(s,'KY01-field');const run=g.createTrainingRun(s,'J22');run.state='won';run.turn=3;run.actionFlags.critical=true;run.actionFlags.evaded=true;run.actionFlags.signature=true;run.actionFlags.additional=true;
  run.petHistory={actions:2,species:['PT01','PT02'],healedHP:true,healedMP:true,support:true,targets:['hero','moe'],boostedHit:true,stopped:true};
  const eligible=g.eligibleBattleBadges(run);for(const id of ['B009','B017','B035','B093','B099','B100',...Array.from({length:10},(_,i)=>'B0'+(71+i))])assert(eligible.includes(id),id+' connected');
  s.run=run;g.G.screen='battle';g.G.sheetData={};const html=g.renderBattleChallenges();for(const id of Object.keys(names))assert(html.includes(id),id+' displayed');assert(!html.includes('undefined'));
});
await test('legacy5.33 inventories, quest progress, sea positions and saved battle migrate once',()=>{
  const s=fresh();s.gold=999;s.vaultGold=300;s.xp=9999;s.jp.hero.J22=500;const held=JSON.stringify([s.bag,s.itemVault,s.owned,s.equip]);
  for(const key of ['characterVersion','heroine','jobEvents','jobEvent','learnedJobs','learnedSkills','trainingWins','petState','ocean','listenerHistory'])delete s[key];s.gameVersion='5.33';
  g.migrate(s);assert.equal(s.gold,999);assert.equal(s.vaultGold,300);assert.equal(s.xp,9999);assert.equal(s.jp.hero.J22,500);assert.equal(JSON.stringify([s.bag,s.itemVault,s.owned,s.equip]),held);assert(s.petState&&s.ocean&&s.characterVersion===1);
  const once=JSON.stringify(s);g.migrate(s);assert.equal(JSON.stringify(s),once,'migration idempotent');
  const a=Object.values(g.OCEAN_AREAS)[0],sea=fresh();setExplore(sea,a.mapId);sea.quests[g.OCEAN_ROUTES[a.routeId].quest]='complete';sea.pos={x:a.point[0],y:a.point[1]};g.migrate(sea);assert.equal(sea.mapId,a.mapId);assert.equal(sea.pos.x,a.point[0]);assert.equal(sea.pos.y,a.point[1]);
  const oldRun=fresh();setExplore(oldRun,'KY01-field');oldRun.run=g.createFieldRun(oldRun,'KY01-A1',{count:0,picks:[0,0]});oldRun.run.party[0].hp=12;delete oldRun.run.pets;delete oldRun.run.expanded;delete oldRun.run.actionFlags;delete oldRun.run.actionHistoryComplete;oldRun.gameVersion='5.33';g.migrate(oldRun);assert.equal(oldRun.run.party[0].hp,12);assert(Array.isArray(oldRun.run.pets));assert.equal(oldRun.run.petProcessedTurn,oldRun.run.turn);assert.equal(oldRun.run.actionHistoryComplete,false);
});
await test('character save locks prevent cross-module callbacks and rollback races',async()=>{
  const s=fresh();setExplore(s);const office=g.MAPS.KY01.objects.find(o=>o.type==='jobcenter');s.pos={x:office.x-1,y:office.y};if(!g.walkable(g.MAPS.KY01,s.pos.x,s.pos.y))s.pos={x:office.x+1,y:office.y};g.G.sheet='jobcenter';g.G.sheetData={};assert(g.characterCanManage());
  let finish;g.setCommit(()=>new Promise(r=>finish=r));const op=g.ACT.jobEventStart({dataset:{v:'J01'}});assert(g.G.characterSaving);
  dispatch('openSheet',{k:'pets'});assert.equal(g.G.sheet,'jobcenter','normal dispatcher blocks cross-module menu during character save');g.closeSheet();assert.equal(g.G.sheet,'jobcenter');
  const during=JSON.stringify(s);g.ACT.petView({dataset:{k:'care',v:'PT01'}});assert.equal(g.G.sheet,'jobcenter','direct pet callback cannot replace pending job UI');assert.equal(JSON.stringify(s),during);
  finish(false);await op;assert.equal(g.G.st.jobEvent,undefined);assert.equal(g.G.characterSaving,false);g.setCommit(()=>Promise.resolve(true));
});
await test('readonly pet details and vault navigation do not mutate saved state',()=>{
  const s=fresh();setExplore(s);g.G.sheet='petCare';g.G.sheetData={pet:'PT01'};g.G.readOnly=true;const before=JSON.stringify(s);
  dispatch('petDetails',{v:'PT01'});assert.equal(g.G.sheetData.details,true,'readonly detail expansion works');assert.equal(JSON.stringify(s),before);
  g.G.sheet='itemVault';g.G.sheetData={mode:'withdraw',filter:'all'};dispatch('itemVaultMode',{v:'deposit'});assert.equal(g.G.sheetData.mode,'deposit');assert.equal(JSON.stringify(s),before);g.G.readOnly=false;
});
await test('story replay rejects prototype IDs, unread scenes and stale readonly callbacks',()=>{
  const s=fresh();setExplore(s);g.G.sheet='moe';g.G.readOnly=true;const before=JSON.stringify(s);assert.doesNotThrow(()=>g.ACT.replay({dataset:{v:'__proto__'}}));assert.equal(JSON.stringify(s),before);
  g.ACT.replay({dataset:{v:'RANK_D1'}});assert.equal(JSON.stringify(s),before,'unread scene replay cannot set a saved flag in readonly mode');assert.equal(g.G.dlg,null);g.G.readOnly=false;
});
await test('autowalk tokens survive cancellation without reuse and save switches clear old plans',async()=>{
  const s=fresh();setExplore(s);const m=g.MAPS.KY01,points=[];for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++)if(g.walkable(m,x,y)&&!m.objects.some(o=>o.x===x&&o.y===y)&&Math.abs(x-s.pos.x)+Math.abs(y-s.pos.y)>3)points.push({x,y});
  g.walkTo(points[0].x,points[0].y);const first=g.G.walkPlan.version;g.G.sheet='guide';g.ACT.walkCancel({dataset:{v:String(first)}});assert.equal(g.G.walkPlan,null);
  g.G.sheet=null;g.walkTo(points[1].x,points[1].y);const second=g.G.walkPlan.version;assert.notEqual(second,first,'a new plan cannot reuse an old button token');g.G.sheet='guide';g.ACT.walkCancel({dataset:{v:String(first)}});assert(g.G.walkPlan&&g.G.walkPlan.version===second);
  const next=fresh('復元先');g.G.walkPlan={map:'KY01',x:points[0].x,y:points[0].y,version:999,paused:true};g.G.sheetHistory=[{key:'guide',data:{}}];g.G.sheet='settings';g.G.walk.path=[];g.setCommit(()=>Promise.resolve(true));elements.set('#restoreIn',element('restoreIn',JSON.stringify({app:'toplivermichi-kyushu',version:'5.34',state:next})));await g.ACT.restore();assert.equal(g.G.st.profile.name,'復元先');assert.equal(g.G.walkPlan,null,'restore clears former save destination');assert.equal(g.G.sheetHistory.length,0);
  g.G.walkPlan={map:'KY01',x:1,y:1,version:1000,paused:true};g.G.sheetHistory=[{key:'guide',data:{}}];g.G.sheet=null;g.ACT.toTitle();assert.equal(g.G.walkPlan,null);assert.equal(g.G.sheetHistory.length,0);
  g.G.walkPlan={map:'KY01',x:1,y:1,version:1001,paused:true};g.G.sheetHistory=[{key:'guide',data:{}}];g.setLoad(async()=>({state:fresh('再開先'),storage:'local',fromPrev:false}));await g.ACT.continue();assert.equal(g.G.st.profile.name,'再開先');assert.equal(g.G.walkPlan,null);assert.equal(g.G.sheetHistory.length,0);
});
if(!process.env.INTEGRATION_FAST)await test('all51 quests complete through callbacks with new character and pet systems enabled',()=>{
  const s=fresh('全国統合');setExplore(s);s.petState.owned.PT01.bond=100;s.petState.companions=['PT01'];let previous=null,battles=0;
  for(const qid of g.NATIONWIDE_QUEST_ORDER){
    const q=g.QUESTS[qid];
    if(previous){const field=g.MAPS[g.HUBS[g.MAPS[s.mapId].hub].fieldMap],gate=field.objects.find(o=>o.fieldRoute&&o.toHub===q.hub);assert(gate,previous+' outdoor path to '+qid);s.mapId=g.HUBS[field.hub].fieldMap;s.pos={x:gate.x,y:gate.y};g.interact(gate);closeDialogs();assert.equal(s.mapId,g.HUBS[q.hub].fieldMap);const back=g.MAPS[s.mapId].objects.find(o=>o.fieldExit);s.pos={x:back.x,y:back.y};g.interact(back);assert.equal(s.mapId,q.hub);}
    g.G.sheet='quests';g.G.sheetData={};g.ACT.acceptQuest(element('',qid));
    if(s.activeQuest!==qid){const e=element();e.dataset={v:qid};g.ACT.acceptQuest(e);}
    assert.equal(s.activeQuest,qid);closeDialogs();const exit=g.MAPS[q.hub].objects.find(o=>o.id===q.hub+'_field_exit');s.pos={x:exit.x,y:exit.y};g.interact(exit);assert.equal(s.mapId,g.HUBS[q.hub].fieldMap);
    const area=q.hub+'-A1',point=fieldPoint(g.MAPS[s.mapId],area);s.pos=point;
    for(let n=0;n<q.kills;n++){g.G.sheet=null;const run=g.createFieldRun(s,area,{count:0,picks:[0,0]});g.startBattle(run);assert.equal(s.run,run);assert.equal(run.petProcessedTurn,1);win(run);battles++;}
    assert.equal(s.quests[qid],'bossReady');const boss=g.MAPS[s.mapId].objects.find(o=>o.boss===q.boss);s.pos={x:boss.x,y:boss.y};g.interact(boss);assert.equal(g.G.sheet,'boss');g.ACT.bossGo({dataset:{v:q.boss},disabled:false});assert(s.run);win(s.run);battles++;assert.equal(s.quests[qid],'complete');
    const back=g.MAPS[s.mapId].objects.find(o=>o.id===q.hub+'_town_exit');s.pos={x:back.x,y:back.y};g.interact(back);assert.equal(s.mapId,q.hub);previous=qid;
  }
  assert(s.nationalClear);assert.equal(g.NATIONWIDE_QUEST_ORDER.filter(id=>s.quests[id]==='complete').length,51);assert(s.scenes.NATIONWIDE_END);assert.equal(s.moeRank,18);assert(battles>190);
});
if(failures.length){console.error(JSON.stringify(failures,null,2));throw Error(`${failures.length} integrated checks failed; ${tests.length} passed`);}
console.log(`Integration: ${tests.length} combined build/module/UI/save/lock/campaign checks passed`);
