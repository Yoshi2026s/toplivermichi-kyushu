import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {illustratedContext} from './illustrated-runtime.mjs';
const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','data_character.js','core.js'];
const source=files.map(name=>readFileSync(resolve(root,'src',name),'utf8')).join('\n');
const g=runInNewContext(`${source}\n({CAREERS,JOB_TRAITS,EXTRA_SKILLS,SIGNATURES,JOB_EVENTS,EQUIP,newGame,migrateCharacter,charName,charStats,ensureVitals,learnCharacterSkills,baseRun,createFieldRun,createBossRun,createTrainingRun,planAction,applyAction,enemyPhase,aiChoose,aiIncoming,battleRandom,startJobEvent,jobEventToken,answerJobEvent,canChangeJob,availableBattleSkills,expandedBattleBadges,applyVictory,xpFor,jpFor,MAPS,clone})`,{console});
const fresh=()=>{const st=g.newGame('検査主人公','男性');g.ensureVitals(st);return st;};
const arena=(st=fresh())=>{st.mapId='KY01-field';st.pos={x:10,y:10};const run=g.createFieldRun(st,'KY01-A1',{count:0,picks:[0,0]});run.enemies[0].hp=run.enemies[0].maxHP=100000;run.enemies[0].evasion=0;run.enemies[0].def=10;return run;};
assert.equal(Object.keys(g.CAREERS).length,33);
assert.equal(Object.keys(g.EQUIP).filter(id=>/^H[WA]\d{2}$/.test(id)).length,66);
assert.equal(Object.keys(g.JOB_TRAITS).length,22);
assert.equal(new Set(Object.values(g.JOB_TRAITS).map(t=>t.name)).size,22);
assert.equal(Object.keys(g.EXTRA_SKILLS).length,66);
assert.equal(Object.keys(g.SIGNATURES).length,9);
assert.equal(Object.keys(g.JOB_EVENTS).length,22);
// Every one of the 22 registered traits has an observable effect, beyond its description.
for(const [job,trait] of Object.entries(g.JOB_TRAITS)){
 const st=fresh();st.jobs.hero=job;st.xp=g.xpFor(20);g.ensureVitals(st);const run=arena(st),a=run.party[0];
 if(trait.startWard)assert.ok(a.ward>=trait.startWard,job+' starting protection');
 if(trait.teamWard)assert.ok(run.party.every(m=>m.ward>=trait.teamWard),job+' team protection');
 if(trait.startA)assert.ok(run.A>=trait.startA,job+' starting cheer');
 if(trait.crit)assert.ok(a.criticalRate>=.03+trait.crit,job+' critical probability');
 if(trait.evasion)assert.ok(a.evasionRate>=.02+trait.evasion,job+' evasion probability');
 if(trait.single||trait.pierce){const p=g.planAction(run,0,{type:'attack',target:0});const neutral=g.clone(run);neutral.party[0].trait={};assert.ok(p.dmg[0].raw>g.planAction(neutral,0,{type:'attack',target:0}).dmg[0].raw,job+' single hit');}
 if(trait.attackCheer){const p=g.planAction(run,0,{type:'attack',target:0});assert.equal(p.aGain,8+trait.attackCheer,job+' attack cheer');}
 if(trait.mpDiscount){const p=g.planAction(run,0,{type:'comment',line:'greet'});assert.equal(p.cost.c,0,job+' MP discount');}
 if(trait.cheer){const neutral=g.clone(run);neutral.party[0].trait={};assert.ok(g.planAction(run,0,{type:'comment',line:'greet'}).aGain>g.planAction(neutral,0,{type:'comment',line:'greet'}).aGain,job+' comment cheer');}
 if(trait.rest){a.c=0;assert.equal(g.planAction(run,0,{type:'rest'}).cgain[0].amt,Math.min(a.maxMP,4+trait.rest),job+' rest MP');assert.equal(g.planAction(run,0,{type:'guard'}).cgain[0].amt,2,job+' guard MP');}
 if(trait.meterDiscount){run.A=100;assert.equal(g.planAction(run,0,{type:'meter'}).cost.a,75,job+' meter cost');}
 if(trait.multi){run.enemies.push({...g.clone(run.enemies[0]),slot:1});const neutral=g.clone(run);neutral.party[0].trait={};const action={type:'skill'};assert.ok(g.planAction(run,0,action).dmg[0].raw>g.planAction(neutral,0,action).dmg[0].raw,job+' multiple targets');}
 if(trait.heal||trait.itemHeal){run.A=100;for(const m of run.party){m.maxHP=100000;m.hp=1;}const neutral=g.clone(run);neutral.party[0].trait={};const action=trait.itemHeal?{type:'item',item:'IT004',ally:0}:{type:'family'};if(trait.itemHeal){run.bag=[{id:'IT004',n:1}];neutral.bag=[{id:'IT004',n:1}];}const actual=g.planAction(run,0,action),base=g.planAction(neutral,0,action);assert.ok(actual.ok&&base.ok&&actual.heal[0].amt>base.heal[0].amt,job+' living HP recovery');}
 if(trait.mpHeal){run.party[1].c=0;const neutral=g.clone(run);neutral.party[0].trait={};assert.ok(g.planAction(run,0,{type:'skill'}).cgain[0].amt>g.planAction(neutral,0,{type:'skill'}).cgain[0].amt,job+' MP recovery');}
 if(trait.reduction){run.simulation=true;run.enemies[0].cycle=[{t:'s',p:100}];for(const m of run.party)m.hp=m.maxHP=100000;const neutral=g.clone(run);neutral.party[0].trait={};g.enemyPhase(run);g.enemyPhase(neutral);assert.ok(run.party[0].hp>neutral.party[0].hp,job+' ordinary hit reduction');}
}
for(const careerId of Object.keys(g.CAREERS)){
 const st=g.newGame('検査主人公','男性',{careerId,heroine:{name:'旅の相方',gender:'男性'}});
 assert.equal(st.profile.careerId,careerId);assert.equal(g.charName(st,'moe'),'旅の相方');
 assert.equal(st.equip.hero.w,g.CAREERS[careerId].weapon);assert.equal(st.equip.hero.a,g.CAREERS[careerId].armor);
}
assert.throws(()=>g.newGame('同じ名前','男性',{careerId:'CR01',heroine:{name:'同じ名前',gender:'女性'}}));
assert.throws(()=>g.newGame('主人公','男性',{careerId:'bad',heroine:{name:'相方',gender:'女性'}}));
const old=fresh();delete old.characterVersion;delete old.heroine;old.gold=123;old.xp=4321;old.jp.hero.J15=200;const inv=JSON.stringify(old.owned);g.migrateCharacter(old);
assert.equal(old.gold,123);assert.equal(old.xp,4321);assert.equal(JSON.stringify(old.owned),inv);assert.ok(old.learnedJobs.hero.includes('J15'));
for(const job of Object.keys(g.JOB_TRAITS)){
 const st=fresh();st.jobs.hero=job;st.xp=g.xpFor(20);st.jp.hero[job]=g.jpFor(5);g.learnCharacterSkills(st);const stats=g.charStats(st,'hero',20);
 for(const key of ['vitality','strength','defense','agility','charm','maxHP','startC','attackPower','defensePower'])assert.ok(Number.isFinite(stats[key])&&stats[key]>0,`${job} ${key}`);
 assert.equal(stats.trait.name,g.JOB_TRAITS[job].name);
}
// Preview and AI use expected damage and never inspect/advance future random draws.
const run=arena(),before=JSON.stringify(run),p=g.planAction(run,0,{type:'attack',target:0});assert.ok(p.ok);assert.equal(JSON.stringify(run),before);
g.aiChoose(run);assert.equal(JSON.stringify(run),before);g.aiIncoming(run,run.party[0]);assert.equal(JSON.stringify(run),before);
const copy=g.clone(run);assert.equal(g.battleRandom(copy),g.battleRandom(g.clone(run)));assert.equal(JSON.stringify(run),before);
const crit=arena();crit.party[0].criticalRate=1;const predicted=g.planAction(crit,0,{type:'attack',target:0}).dmg[0].raw;
const hp=crit.enemies[0].hp;assert.ok(g.applyAction(crit,0,{type:'attack',target:0}).ok);assert.equal(hp-crit.enemies[0].hp,Math.ceil((predicted+crit.enemies[0].def)*1.5));assert.ok(crit.actionFlags.critical);assert.ok(g.expandedBattleBadges(crit).includes('B017'));
const dodge=arena();dodge.party.forEach(m=>m.evasionRate=1);const hp0=dodge.party.map(m=>m.hp);g.enemyPhase(dodge);assert.deepEqual(dodge.party.map(m=>m.hp),hp0);assert.ok(g.expandedBattleBadges(dodge).includes('B035'));
const pain=arena();pain.party.forEach(m=>{m.evasionRate=0;m.armorD=100;m.defense=1000;m.ward=8;m.guard=true;});pain.enemies[0].criticalRate=1;const hpPain=pain.party[0].hp;const power=pain.enemies[0].cycle[0].p;g.enemyPhase(pain);assert.equal(hpPain-pain.party[0].hp,Math.min(hpPain,Math.ceil(Math.ceil(power*1.5)/2)));assert.ok(pain.actionFlags.enemyCritical);
const learned=fresh();learned.xp=g.xpFor(25);learned.jp.hero.J22=g.jpFor(5);learned.jp.hero.J15=g.jpFor(3);g.learnCharacterSkills(learned);
const inherit=arena(learned);assert.ok(g.availableBattleSkills(inherit,inherit.party[0]).some(s=>s.id==='inherit:J15'));
assert.ok(g.applyAction(inherit,0,{type:'inherit',job:'J15',target:0}).ok);assert.ok(g.expandedBattleBadges(inherit).includes('B100'));inherit.party[0].acted=false;assert.equal(g.planAction(inherit,0,{type:'inherit',job:'J15',target:0}).ok,false);
const extra=arena(learned);assert.ok(g.applyAction(extra,0,{type:'extra',skillId:'EX-J22-1',target:0}).ok);assert.ok(extra.actionFlags.additional);
const sig=arena(learned);sig.turn=3;sig.A=60;sig.party[0].c=8;assert.ok(g.applyAction(sig,0,{type:'signature'}).ok);assert.ok(g.expandedBattleBadges(sig).includes('B099'));sig.party[0].acted=false;assert.equal(g.planAction(sig,0,{type:'signature'}).ok,false);
const fake=arena();assert.equal(g.planAction(fake,0,{type:'inherit',job:'J21',target:0}).ok,false);assert.equal(g.planAction(fake,0,{type:'extra',skillId:'constructor',target:0}).ok,false);
// All 66 authored decisions reject wrong answers, stale buttons and duplicate completion.
const worker=fresh();for(const [job,event] of Object.entries(g.JOB_EVENTS)){
 assert.ok(g.startJobEvent(worker,job));for(let stage=0;stage<3;stage++){
  const token=g.jobEventToken(worker),correct=event.stages[stage].correct;
  assert.equal(g.answerJobEvent(worker,(correct+1)%3,token).correct,false);assert.equal(worker.jobEvent.stage,stage);
  assert.equal(g.answerJobEvent(worker,correct,token).correct,true);assert.equal(g.answerJobEvent(worker,correct,token).ok,false);
 }assert.equal(worker.jobEvents[job],true);assert.equal(g.startJobEvent(worker,job),false);assert.ok(g.canChangeJob(worker,'hero',job));
}
const novice=fresh();assert.equal(g.canChangeJob(novice,'hero','J15'),false);assert.equal(g.canChangeJob(novice,'hero','__proto__'),false);
novice.mapId='KY01';assert.equal(g.createTrainingRun(novice,'J15'),null);
novice.mapId='KY01-field';const challenge=g.createTrainingRun(novice,'J15');assert.equal(challenge.kind,'challenge');challenge.enemies[0].hp=0;challenge.state='won';assert.ok(g.expandedBattleBadges(challenge).includes('B009'));assert.ok(g.expandedBattleBadges(challenge).includes('B093'));
const reward=g.applyVictory(novice,challenge),gold=novice.gold,tickets=novice.tickets;assert.ok(reward.tickets>0);g.applyVictory(novice,challenge);assert.equal(novice.gold,gold);assert.equal(novice.tickets,tickets);
const caps=arena();caps.party[0].c=caps.party[0].maxMP;assert.equal(g.planAction(caps,0,{type:'rest'}).ok,false);caps.party[0].c=0;g.applyAction(caps,0,{type:'rest'});assert.ok(caps.party[0].c<=caps.party[0].maxMP);
console.log('Expanded battle: 5 abilities, 22 traits, 33 careers/66 equipment, 66 additional skills/22 inherited skills/9 signatures; crit/evasion RNG isolation, cooldowns, 66 job decisions, physical-field practice, reward and save guards passed');

// Load the complete release modules, including wrappers, so visible entry points share the core rules.
const build=readFileSync(resolve(root,'scripts/build.mjs'),'utf8');
const releaseFiles=[...build.match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(name=>name!=='input.js');
const release=releaseFiles.map(name=>readFileSync(resolve(root,'src',name),'utf8')).join('\n');
const noop=()=>{};
const ui=await illustratedContext(`${release}\nrender=()=>{};commit=()=>Promise.resolve(true);\n({G,ACT,newGame,ensureVitals,createFieldRun,jobEventToken,JOB_EVENTS,MAPS,characterCanUseFacility,characterJobToken,renderStatus,renderExpandedSkillSheet,renderJobcenter,setSaveResult:success=>{commit=()=>Promise.resolve(success);}})`,{
 document:{addEventListener:noop,querySelector:()=>null,getElementById:()=>null,hidden:false},
 window:{addEventListener:noop,matchMedia:()=>({matches:true}),TLR_PUBLIC:true},navigator:{},localStorage:{getItem:()=>null,setItem:noop},
 setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,performance:{now:()=>0},console
});
const us=ui.newGame('統合検査','男性');ui.ensureVitals(us);ui.G.st=us;ui.G.screen='explore';ui.G.sheet='jobcenter';ui.G.sheetData={};
const center=ui.MAPS.KY01.objects.find(o=>o.type==='jobcenter');assert.ok(center,'jobcenter physical object missing');
us.pos={x:center.x,y:center.y+1};assert.equal(ui.characterCanUseFacility(),true);assert.ok(ui.renderJobcenter().includes('職業イベント'));
ui.setSaveResult(false);await ui.ACT.jobEventStart({dataset:{v:'J15'}});assert.equal(ui.G.st.jobEvent,undefined,'failed save must roll back job event start');
ui.setSaveResult(true);await ui.ACT.jobEventStart({dataset:{v:'J15'}});assert.equal(ui.G.st.jobEvent.job,'J15');
for(let stage=0;stage<3;stage++){const token=ui.jobEventToken(ui.G.st),correct=ui.JOB_EVENTS.J15.stages[stage].correct;await ui.ACT.jobEventAnswer({dataset:{v:String(correct),token}});}
assert.equal(ui.G.st.jobEvents.J15,true);assert.equal(ui.G.st.jobs.hero,'J22');
ui.G.sheetData={view:'change',cid:'hero'};const jobToken=ui.characterJobToken(ui.G.st,'hero','J15');ui.G.readOnly=true;await ui.ACT.characterJobSet({dataset:{c:'hero',v:'J15',old:'J22',token:jobToken}});assert.equal(ui.G.st.jobs.hero,'J22');
ui.G.readOnly=false;await ui.ACT.characterJobSet({dataset:{c:'hero',v:'J15',old:'J22',token:jobToken}});assert.equal(ui.G.st.jobs.hero,'J15');
ui.G.st.pos={x:0,y:0};await ui.ACT.jobEventStart({dataset:{v:'J16'}});assert.equal(ui.G.st.jobEvent,null,'facility-external event must reject');
ui.G.st.mapId='KY01-field';ui.G.st.pos={x:10,y:10};ui.G.st.xp=25*32*10;ui.G.st.jp.hero.J15=40;
const ur=ui.createFieldRun(ui.G.st,'KY01-A1',{count:0,picks:[0,0]});ui.G.st.run=ur;ui.G.screen='battle';ui.G.sheet=null;ui.G.cmd={actor:0};ui.ACT.expandedSkillsOpen();
assert.equal(ui.G.sheet,'battleSkills');assert.ok(ui.renderExpandedSkillSheet().includes('3ターン目から'));const held=JSON.stringify(ui.G.st);ui.G.readOnly=true;ui.ACT.expandedSkillConfirm();assert.equal(JSON.stringify(ui.G.st),held);
console.log('Complete release UI: physical jobcenter, 66 decision flow, save rollback, read-only and facility guards, job change and battle skill entry passed');
