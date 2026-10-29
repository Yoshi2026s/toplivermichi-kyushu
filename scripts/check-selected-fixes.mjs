import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','core.js'];
const source=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src/ui.js'),'utf8');
const context=runInNewContext(`${source}\n({newGame,chapterCap,levelOf,levelLimit,rankOf,jobLimit,migrateGrowth,addExperience,xpFor,jpFor,charStats,createBossRun,applyVictory,bossReward,completeQuest,gearReceiveRoom,unequippedGearCount,transferVaultItem,equipmentChangeFits,validateName,QUESTS,STORY_CHAPTERS,EQUIP,BOSSES})`);
const g=context;
const fresh=g.newGame('新規確認','男性');
assert.equal('slots' in fresh,false);
assert.equal(g.chapterCap(fresh),100);
fresh.xp=g.xpFor(150);
assert.equal(g.levelOf(fresh.xp,fresh),100);
assert.equal(g.addExperience(fresh,100),0);
assert.equal(fresh.xp,g.xpFor(150),'over-cap XP is not erased');
fresh.jp.hero.J22=g.jpFor(150);
assert.equal(g.charStats(fresh,'hero',100).R,100);
fresh.visitedHubs=Object.keys(runInNewContext(`${source}\nHUBS`));
fresh.mapId='NW13';fresh.quests.M08='complete';
assert.equal(g.chapterCap(fresh),100,'nationwide visits and M08 do not finish the Kyushu chapter');
fresh.completedChapters=['kyushu','kanto'];
assert.equal(g.chapterCap(fresh),100,'unregistered save flags cannot unlock chapters');

// Only a registered real main-story finale can open the next chapter.
const future=g.newGame('将来の章','女性');
const realFinales=g.STORY_CHAPTERS.map(chapter=>chapter.completionQuest);
for(let i=0;i<g.STORY_CHAPTERS.length-1;i++){
 const id='FUTURE_END_'+i;g.STORY_CHAPTERS[i].completionQuest=id;
 g.QUESTS[id]={main:true};future.quests[id]='active';
 assert.equal(g.chapterCap(future),100*(i+1));
 future.quests[id]='complete';assert.equal(g.chapterCap(future),100*(i+2));
}
for(let i=0;i<g.STORY_CHAPTERS.length-1;i++)g.STORY_CHAPTERS[i].completionQuest=realFinales[i];

const old=g.newGame('既存の冒険','女性');
delete old.growthVersion;delete old.legacyGrowth;old.slots=0;
old.xp=g.xpFor(350)+17;old.jp.hero.J22=g.jpFor(250)+3;
old.gold=12345;old.quests.M03='complete';old.bag[0].n=21;
const oldRecord=JSON.stringify(old);
g.migrateGrowth(old);
assert.equal(g.levelOf(old.xp,old),350);
assert.equal(g.charStats(old,'hero',350).R,250);
assert.equal(g.addExperience(old,1000),0);
assert.equal(old.xp,JSON.parse(oldRecord).xp);
assert.equal(old.jp.hero.J22,JSON.parse(oldRecord).jp.hero.J22);
assert.equal(old.gold,12345);assert.equal(old.bag[0].n,21);assert.equal(old.slots,0);
assert.equal(old.quests.M03,'complete');
g.migrateGrowth(old);assert.equal(g.levelOf(old.xp,old),350);

assert.equal(g.validateName('あいうえおかきくけこさし').ok,true);
assert.equal(g.validateName('あいうえおかきくけこさしす').ok,false);

const inventory=g.newGame('在庫確認','男性');
inventory.owned={CW01:7};inventory.equip.hero={w:'CW01',a:null,acc:null};inventory.equip.moe={w:null,a:null,acc:null};
for(let i=0;i<299;i++)inventory.owned['KIND'+i]=8;
assert.equal(g.unequippedGearCount(inventory),300);
assert.equal(g.gearReceiveRoom(inventory,'CW01'),1,'existing kind accepts another copy');
assert.equal(g.gearReceiveRoom(inventory,'JW01'),0,'new kind is rejected at 300 kinds');
inventory.itemVault=[{id:'JW01',n:1}];
assert.equal(g.transferVaultItem(inventory,'withdraw','JW01',1),false);
delete inventory.owned.KIND0;
assert.equal(g.transferVaultItem(inventory,'withdraw','JW01',1),true);
assert.equal(g.unequippedGearCount(inventory),300);
inventory.owned.CW01=8;
assert.equal(g.gearReceiveRoom(inventory,'CW01'),0);
inventory.owned={CW01:1};
for(let i=0;i<300;i++)inventory.owned['KIND'+i]=1;
assert.equal(g.equipmentChangeFits(inventory,'hero','w',null),false,'unequipping cannot create kind 301');
assert.equal(g.equipmentChangeFits(inventory,'hero','w','CW01'),true);

for(const [id,boss] of Object.entries(g.BOSSES)){
 const st=g.newGame('ボス報酬','男性');
 const job=st.jobs.hero;st.roster.push('naoki');st.jobs.naoki='J15';st.jp.naoki={J15:51};st.equip.naoki={w:null,a:null,acc:null};
 const run=g.createBossRun(st,id);run.state='won';run.enemies.forEach(e=>{e.hp=0;});
 const before=st.gold,waitingJP=st.jp.naoki.J15;
 const result=g.applyVictory(st,run);
 assert.equal(result.xp,3*(8+3*boss.q));assert.equal(result.gold,3*(20+2*boss.q));
 assert.equal(st.gold-before,result.gold);assert.equal(st.jp.naoki.J15,waitingJP,'waiting JP stays unchanged');
 assert.ok(st.jp.hero[job]>0);
 const snapshot=JSON.stringify(st);const second=g.applyVictory(st,run);
 assert.equal(second.gold,0);assert.equal(second.xp,0);assert.equal(JSON.stringify(st),snapshot);
}
const capped=g.newGame('上限の報酬','男性');capped.xp=g.xpFor(100);capped.jp.hero.J22=g.jpFor(100);
const battle=g.createBossRun(capped,'B01');battle.state='won';battle.enemies[0].hp=0;
const cappedResult=g.applyVictory(capped,battle);
assert.equal(cappedResult.xp,0);assert.equal(cappedResult.gold,108);assert.equal(capped.jp.hero.J22,g.jpFor(100));
const quest=g.newGame('別々の報酬','女性');quest.quests.M02='bossReady';
const run=g.createBossRun(quest,'B01');run.state='won';run.enemies[0].hp=0;
const reward=g.applyVictory(quest,run);assert.equal(reward.xp,136);assert.equal(quest.quests.M02,'complete');
assert.equal(quest.xp,136);assert.equal(quest.gold,108);assert.equal(quest.quests.M03,'available');
g.completeQuest(quest,'M02',reward);assert.equal(reward.xp,136);assert.equal(quest.xp,136);assert.equal(quest.gold,108);
g.completeQuest(quest,'M02',reward);assert.equal(quest.xp,136);

assert.doesNotMatch(ui,/st\.slots|旅程枠|（[012]枠）|集中力|MP（CP）/);
assert.doesNotMatch(readFileSync(resolve(root,'src/core.js'),'utf8'),/\bslots:/);
console.log('Selected changes: chapter gating, over-cap legacy saves, 300 gear kinds, 8-copy cap, boss settlement, waiting JP, names and MP labels OK');
