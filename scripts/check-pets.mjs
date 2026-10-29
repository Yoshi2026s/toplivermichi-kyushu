import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..'),read=f=>readFileSync(resolve(root,'src',f),'utf8');
const data=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','data_character.js','data_pets.js'].filter(f=>existsSync(resolve(root,'src',f))).map(read).join('\n');
const ctx={console,setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},performance:{now:()=>0},document:{hidden:false,addEventListener:()=>{},querySelector:()=>null,getElementById:()=>null},window:{addEventListener:()=>{},matchMedia:()=>({matches:true})},navigator:{},localStorage:{getItem:()=>null}};
const code=data+'\n'+read('core.js')+'\n'+read('pets.js')+'\n'+read('ui.js')+'\n'+read('ui_pets.js')+`\nrender=()=>{};commit=()=>Promise.resolve(true);SND={sfx:()=>{}};({PET_SPECIES,PET_SKILLS,PET_SUPPLIES,PET_GROWTH_THRESHOLDS,PET_BADGES,newGame,migratePets,petData,petStage,petOwned,adoptPet,petAdoptPreview,petCarePreview,carePet,petReceivePreview,petCelebrationPreview,claimPetCelebration,petWalkPreview,walkPet,petTravelPreview,petTravelHelp,preparePetRun,petTurnStart,petBattleBadges,petSpriteSvg,createFieldRun,ensureVitals,restoreAll,bagCount,bagAdd,itemVaultAdd,PET_CARE_TYPES,G,ACT,renderPetList,renderPetCare,renderPetWalk,renderPetTravel,renderPetShop,renderPetAdopt,petUiToken,petUiMutation})`;
ctx.SND={sfx:()=>{},play:()=>{}};
vm.createContext(ctx);
const g=vm.runInContext(code,ctx),make=()=>{const st=g.newGame('ペット検査','女性');g.ensureVitals(st);return st;};
assert.equal(Object.keys(g.PET_SPECIES).length,22);
assert.equal(Object.keys(g.PET_SUPPLIES).length,264);
assert.equal(Object.keys(g.PET_SKILLS).length,88);
for(const [id,s] of Object.entries(g.PET_SPECIES)){
 assert.equal(s.skills.length,4);assert.equal(s.skills.map(k=>g.PET_SKILLS[k]).filter(s=>s.family==='heal').length,2);
 assert.equal(s.skills.map(k=>g.PET_SKILLS[k]).filter(s=>s.family==='support').length,2);
 const svg=g.petSpriteSvg(id,10);assert.match(svg,/<svg/);assert.match(svg,/成長10/);
}
const stage=make().petState.owned.PT01;
for(let i=0;i<g.PET_GROWTH_THRESHOLDS.length;i++){stage.bond=g.PET_GROWTH_THRESHOLDS[i];assert.equal(g.petStage(stage),i+1);}
stage.bond=99;assert.equal(g.petStage(stage),9);stage.bond=100;assert.equal(g.petStage(stage),10);
const st=make(),p=st.petState.owned.PT01;
assert.equal(p.bond,0);assert.deepEqual(Array.from(st.petState.companions),[]);
for(const invalid of ['__proto__','constructor','toString','PT99','']){const before=JSON.stringify(st);assert(!g.adoptPet(st,invalid).ok);assert(!g.walkPet(st,'PT01',invalid).ok);assert(!g.petTravelHelp(st,invalid).ok);assert.equal(JSON.stringify(st),before);}
const preserved=JSON.stringify(st);g.migratePets(st);assert.equal(JSON.stringify(st),preserved,'migration must be idempotent');
const old=make();delete old.petState;old.pets={PET02:{name:'古い猫',affection:99,fullness:80,mood:90,clean:70,celebrations:[20]}};g.migratePets(old);
assert.equal(old.petState.owned.PT02.name,'古い猫');assert.equal(old.petState.owned.PT02.bond,99);assert(old.pets.PET02,'legacy raw pets must remain');
// Capped actual changes and daily independent actions; no-effect operations do not consume.
p.bond=99;p.mood=99;
const offer=g.petCarePreview(st,'PT01','practice');assert.equal(offer.gains.bond,1);assert.equal(offer.gains.mood,1);
assert(g.carePet(st,'PT01','practice').ok);assert.equal(p.bond,100);assert.equal(p.mood,100);
assert(!g.carePet(st,'PT01','practice').ok);assert(!g.carePet(st,'PT01','pat').ok);assert(!p.daily.pat,'zero effect must not use daily action');
st.day++;p.mood=90;assert(g.carePet(st,'PT01','pat').ok);assert.equal(p.mood,93);assert.equal(p.daily.pat,st.day);
for(const action of ['feed','play','groom','rest']){
 st.day++;p.bond=0;p.fullness=10;p.mood=10;p.clean=10;const id=`PT01-${action}-1`;g.bagAdd(st.bag,id,1);
 const out=g.carePet(st,'PT01',action,id);assert(out.ok);assert.equal(g.bagCount(st.bag,id),0);assert.equal(p.daily[action],st.day);assert(!g.carePet(st,'PT01',action,id).ok);
}
// Adoption needs progress and tickets, rejects duplicate charging.
st.tickets=9999;for(const id of Object.keys(g.PET_SPECIES)){
 if(id==='PT01')continue;for(const q of Object.keys(st.quests))st.quests[q]='complete';assert(g.adoptPet(st,id).ok);const money=st.tickets;assert(!g.adoptPet(st,id).ok);assert.equal(st.tickets,money);
}
assert.equal(Object.keys(st.petState.owned).length,22);
// Celebration and walk deliveries are atomic and use per-item capacity.
p.bond=100;p.celebrations=[];assert(g.claimPetCelebration(st,'PT01',20).ok);const count=g.bagCount(st.bag,'PT01-feed-1');assert(!g.claimPetCelebration(st,'PT01',20).ok);assert.equal(g.bagCount(st.bag,'PT01-feed-1'),count);
const full=make(),fp=full.petState.owned.PT01;fp.bond=100;full.bag=[{id:'PT01-feed-1',n:99},{id:'PT01-play-1',n:1}];full.itemVault=[{id:'IT001',n:999}];
assert(!g.petCelebrationPreview(full,'PT01',20).ok);const before=JSON.stringify(full);assert(!g.claimPetCelebration(full,'PT01',20).ok);assert.equal(JSON.stringify(full),before);
assert(!g.petWalkPreview(full,'PT01','garden').ok);assert(g.petWalkPreview(full,'PT01','plaza').ok,'full garden supply must not block other walk locations');
const failed=JSON.stringify(full);assert(!g.walkPet(full,'PT01','garden').ok);assert.equal(JSON.stringify(full),failed);
assert(g.walkPet(full,'PT01','plaza').ok);assert(!g.walkPet(full,'PT01','brook').ok,'all pets/places share daily walk cap');
full.day++;full.itemVault=[];const vaultWalk=g.walkPet(full,'PT01','garden');assert(vaultWalk.ok);assert.equal(vaultWalk.vaulted,1);assert.equal(g.bagCount(full.itemVault,'PT01-feed-1'),1);
// Travel preview does not mutate state, does not resurrect or waste a daily use.
const travel=make();travel.petState.owned.PT01.bond=20;travel.petState.favorite='PT01';travel.vitals.hero.hp=10;travel.vitals.moe.hp=0;travel.vitals.hero.c=1;
const prev=JSON.stringify(travel),preview=g.petTravelPreview(travel,'balanced');assert(preview.ok);assert.equal(JSON.stringify(travel),prev);
assert(preview.targets.find(t=>t.cid==='moe').hp===0);assert(g.petTravelHelp(travel,'balanced').ok);assert.equal(travel.vitals.moe.hp,0);assert(!g.petTravelHelp(travel,'hp').ok);
travel.day++;g.restoreAll(travel);travel.vitals.moe.hp=0;const helpDay=travel.petState.travelDay;assert(!g.petTravelHelp(travel,'balanced').ok);assert.equal(travel.petState.travelDay,helpDay);
// First-turn support, save resume and subsequent turns use snapshot companions and act once.
const battle=make();battle.petState.owned.PT01.bond=100;battle.petState.owned.PT01.policy='heal';battle.petState.companions=['PT01'];battle.vitals.hero.hp=10;
const run=g.createFieldRun(battle,'KY01-A1',{count:0,picks:[0,0]});g.preparePetRun(battle,run);
const heroHP=run.party[0].hp;assert(g.petTurnStart(battle,run).length>0);assert(run.party[0].hp>heroHP);assert.equal(run.petHistory.actions,1);
const after=JSON.stringify(run);g.petTurnStart(battle,run);assert.equal(JSON.stringify(run),after,'same turn must not act twice');
const reload=JSON.parse(JSON.stringify(run));g.petTurnStart(battle,reload);assert.equal(JSON.stringify(reload),after,'resume must not duplicate pet action');
run.turn++;g.petTurnStart(null,run);assert.equal(run.petHistory.actions,2);
run.state='won';const done=JSON.stringify(run);g.petTurnStart(battle,run);assert.equal(JSON.stringify(run),done,'finished battles cannot get pet support');
assert(g.petBattleBadges(run).includes('B071'));assert(g.petBattleBadges(run).includes('B072'));assert(g.petBattleBadges(run).includes('B075'));assert(g.petBattleBadges(run).includes('B077'));
// Two pets and genuine MP/boost/stop histories, no duplicated creature identifiers.
battle.petState.owned.PT02={...battle.petState.owned.PT01,id:'PT02',name:'猫',policy:'support'};battle.petState.companions=['PT01','PT02'];
const two=g.createFieldRun(battle,'KY01-A1',{count:0,picks:[0,0]});g.preparePetRun(battle,two);two.party[1].c=0;g.petTurnStart(battle,two);
assert.equal(two.pets.length,2);assert.equal(two.petHistory.species.length,2);assert(two.petHistory.healedMP);assert(two.petHistory.support);
two.petHistory.stopped=true;two.petHistory.boostedHit=true;two.petHistory.targets.push('moe');const badges=g.petBattleBadges(two);for(const id of ['B074','B076','B078','B079','B080'])assert(badges.includes(id));
// UI: every page renders, read-only/stale/hidden actions cannot charge; failed save rolls back.
g.G.st=st;g.G.screen='explore';g.G.sheet='petCare';g.G.sheetData={pet:'PT01'};g.G.walk={path:[]};g.G.dlg=null;g.G.readOnly=false;
for(const f of ['renderPetList','renderPetCare','renderPetWalk','renderPetTravel','renderPetShop','renderPetAdopt'])assert(g[f]().length>20,`${f} empty`);
st.gold=100;g.G.sheet='petShop';const el={dataset:{v:'PT01-feed-1',token:g.petUiToken(st)},disabled:false},original=JSON.stringify(st);
g.G.readOnly=true;g.ACT.petBuy(el);assert.equal(JSON.stringify(st),original);g.G.readOnly=false;
el.dataset.token='stale';g.ACT.petBuy(el);assert.equal(JSON.stringify(st),original);
ctx.document.hidden=true;el.dataset.token=g.petUiToken(st);g.ACT.petBuy(el);assert.equal(JSON.stringify(st),original);ctx.document.hidden=false;
vm.runInContext('commit=()=>Promise.resolve(false);',ctx);
el.dataset.token=g.petUiToken(st);await g.ACT.petBuy(el);assert.equal(JSON.stringify(st),original,'failed save must restore money and inventory');assert(!g.G.petSaving);
vm.runInContext('commit=()=>Promise.resolve(true);',ctx);
el.disabled=false;el.dataset.token=g.petUiToken(st);await g.ACT.petBuy(el);assert.equal(st.gold,88);assert.equal(g.bagCount(st.bag,'PT01-feed-1'),count+1);
const bought=JSON.stringify(st);await g.ACT.petBuy(el);assert.equal(JSON.stringify(st),bought,'stale purchase must not charge twice');
console.log('Pets: 22 species, 88 learned skills, 264 supplies, 10 stages, care/daily/capacity, travel, two battle companions, once-per-turn/resume, UI guards passed');
