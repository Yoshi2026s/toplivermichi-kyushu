import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(root,'src',name),'utf8');
const ui=read('ui.js'),core=read('core.js');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const actions=ui.match(/const ACT = \{[\s\S]*?\n\};/)?.[0];
assert(actions,'UI action table missing');
const act=runInNewContext(`${actions}\nACT`);
assert(!Object.keys(act).some(key=>/^stream/.test(key)),'removed stream actions remain callable');
for(const name of ['renderStream','renderStreamSetup','streamPending','streamFinish','savedStreamUsable'])assert(!new RegExp(`function ${name}\\(`).test(ui),`removed ${name} remains in UI`);
for(const name of ['newStream','streamPlay','streamGrade'])assert(!new RegExp(`function ${name}\\(`).test(core),`removed ${name} remains in core`);
assert(!ui.includes('data-k="streamSetup"')&&!ui.includes('data-a="streamStart"'),'stream entry point remains');
assert(ui.includes('配信イベントの廃止に伴い'),'legacy migration notice missing');

const data=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js'].map(read).join('\n');
const extract=name=>ui.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];
const migrate=extract('migrate'),supportAvailable=extract('supportAvailable');
assert(migrate&&supportAvailable,'legacy save migration missing');
const game=runInNewContext(`${data}\n${core}\nfunction soundPref(){return true}\n${supportAvailable}\n${migrate}\n({newGame,migrate,QUESTS,MAPS})`);
assert(Object.values(game.QUESTS).every(q=>q.stream!==true),'main quest still requires a stream');
const copy=st=>JSON.parse(JSON.stringify(st));
const stats=st=>JSON.stringify({xp:st.xp,gold:st.gold,tickets:st.tickets,bag:st.bag,quests:st.quests,rank:st.moeRank});
assert(!('stream' in game.newGame('新規','女性')),'fresh save has stream state');

for(const id of ['M02','M03','M04','M05','M06','M07','M08']){
  const st=game.newGame('配信待ち','女性'),q=game.QUESTS[id];
  st.quests[id]='combatDone';st.activeQuest=id;st.bossDefeated[q.boss]=true;
  st.stream={hub:q.hub,hand:2,score:60,done:false};
  const tickets=st.tickets,next=game.migrate(copy(st));
  assert(!('stream' in next)&&next.quests[id]==='complete'&&next.activeQuest===null,`${id} pending save did not complete`);
  assert(next.tickets===tickets+200&&next.moeRank>=Number(id.slice(1)),`${id} migrated rewards or rank missing`);
  const again=game.migrate(copy(next));
  assert(stats(again)===stats(next),`${id} migration duplicated rewards`);
}

// A partially missing save can recover from the persisted boss-defeated flag.
const defeated=game.newGame('討伐済み','男性');
defeated.bossDefeated.B07=true;delete defeated.quests.M08;
const recovered=game.migrate(copy(defeated));
assert(recovered.quests.M08==='complete'&&recovered.quests.N44==='available','defeated flag did not recover national unlock');

// Orphaned or malformed stream data does not complete a still-active battle quest.
const orphan=game.newGame('孤立記録','女性');orphan.quests.M03='active';orphan.activeQuest='M03';orphan.stream={hub:'unknown',score:999};
const orphaned=game.migrate(copy(orphan));
assert(!('stream' in orphaned)&&orphaned.quests.M03==='active'&&orphaned.activeQuest==='M03'&&orphaned.tickets===orphan.tickets,'orphaned stream granted unearned rewards');

// Migrating one old pending quest preserves an unrelated active quest.
const mixed=game.newGame('混在記録','女性');mixed.quests.M03='combatDone';mixed.quests.M04='active';mixed.activeQuest='M04';
const repaired=game.migrate(copy(mixed));
assert(repaired.quests.M03==='complete'&&repaired.quests.M04==='active'&&repaired.activeQuest==='M04','migration abandoned another active quest');

const multiple=game.newGame('複数待機','女性');multiple.quests.M03='combatDone';multiple.quests.M04='combatDone';
const multipleNext=game.migrate(copy(multiple));
assert(multipleNext.quests.M03==='complete'&&multipleNext.quests.M04==='complete'&&multipleNext.tickets===multiple.tickets+400,'migration lost a second pending quest');
assert(stats(game.migrate(copy(multipleNext)))===stats(multipleNext),'multiple pending quests rewarded twice');

const finished=game.newGame('完了記録','男性');finished.quests.M05='complete';finished.stream={done:true,score:100};
const finishedNext=game.migrate(copy(finished));
assert(finishedNext.tickets===finished.tickets&&!('stream' in finishedNext),'completed quest rewarded again while dropping old stream');
console.log('Removed stream feature: no live actions/screens, pending saves complete once, orphaned saves preserve earned progress OK');
