import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','core.js'];
const source=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src/ui.js'),'utf8');
const extract=name=>ui.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
const toResult=extract('toResult');
assert(toResult,'battle result action missing');
for(const invalid of [{screen:'explore',state:'won'},{screen:'battle',state:'input'},{screen:'battle',state:'lost'},{screen:'battle',state:'won',readOnly:true},{screen:'battle',state:'won',sheet:'party'},{screen:'battle',state:'won',dlg:{}}]){
  const G={st:{run:{state:invalid.state}},screen:invalid.screen,readOnly:!!invalid.readOnly,sheet:invalid.sheet||null,dlg:invalid.dlg||null};
  runInNewContext(`${toResult}\ntoResult()`,{G,applyVictory:()=>{throw new Error('stale battle result applied')}});
}
const migration=extract('migrate'),supportAvailable=extract('supportAvailable');
assert(migration&&supportAvailable,'save migration missing');
const game=runInNewContext(`${source}\nfunction soundPref(){return true}\n${supportAvailable}\n${migration}\n({newGame,completeQuest,createFieldRun,createBossRun,applyVictory,migrate,enemyDef,AREAS,QUESTS,SUPPORTS,MAPS})`);
const fresh=game.newGame('確認用','女性');
for(let n=2;n<=8;n++)assert(fresh.quests[`M${String(n).padStart(2,'0')}`]==='locked',`M${n} must start locked`);
assert(fresh.quests.N44==='locked','national main quest must start locked');

// Legacy Kyushu saves retain existing inventory and unlock the next main quest.
for(let n=2;n<=7;n++){
  const old=game.newGame('旧記録','男性');
  const current=`M${String(n).padStart(2,'0')}`,next=`M${String(n+1).padStart(2,'0')}`;
  old.quests[current]='complete';if(n===2)old.fukuokaClear=true;
  old.gold=317;old.bag.push({id:'IT001',n:2});old.lastResult={itemsUsed:[]};
  delete old.quests[next];delete old.mapLayoutVersion;
  const migrated=game.migrate(JSON.parse(JSON.stringify(old)));
  assert(migrated.quests[next]==='available',`${current} legacy completion must unlock ${next}`);
  assert(migrated.gold===317&&JSON.stringify(migrated.bag)===JSON.stringify(old.bag),'migration changed existing inventory');
  assert(migrated.lastResult.itemsUsedKnown===false&&migrated.lastResult.itemsUsed.length===0,'old item history must remain unknown');
  assert(migrated.pos.x===game.MAPS[migrated.mapId].safeAnchor[0]&&migrated.pos.y===game.MAPS[migrated.mapId].safeAnchor[1],'legacy layout arrival not repaired');
}

for(let h=3;h<=8;h++)for(let z=1;z<=3;z++){
  const id=`KY${String(h).padStart(2,'0')}-A${z}`;
  assert(game.AREAS[id]?.list.length===50&&game.enemyDef(id,0).id.startsWith(`EN-${id}-`),`${id} enemy catalog invalid`);
  const run=game.createFieldRun(fresh,id,{count:0,picks:[0,0]});
  assert(run.hub===id.slice(0,4)&&run.areaId===id&&run.enemies.length===1,`${id} battle creation failed`);
}

// M01–M08 now finish immediately when their regional boss is defeated.
const flow=game.newGame('九州進行','女性');
for(let n=1;n<=8;n++){
  const id=`M${String(n).padStart(2,'0')}`,q=game.QUESTS[id];
  assert(flow.quests[id]==='available',`${id} did not unlock in order`);
  flow.quests[id]='active';flow.activeQuest=id;flow.mapId=`${q.hub}-field`;
  flow.pos={x:game.MAPS[flow.mapId].safeAnchor[0],y:game.MAPS[flow.mapId].safeAnchor[1]};
  for(let i=0;i<q.kills;i++)game.applyVictory(flow,game.createFieldRun(flow,`${q.hub}-A1`,{count:0,picks:[0,0]}));
  assert(flow.qprog[id]===q.kills&&flow.quests[id]==='bossReady',`${id} field victories did not unlock boss`);
  const boss=game.createBossRun(flow,q.boss);
  assert(boss.hub===q.hub&&boss.areaId===`${q.hub}-A3`&&boss.enemies[0].id===q.boss,`${id} boss battle invalid`);
  const before=flow.tickets,result=game.applyVictory(flow,boss);
  assert(flow.bossDefeated[q.boss]&&flow.quests[id]==='complete'&&flow.activeQuest===null,`${id} boss did not finish quest`);
  assert(flow.moeRank===n&&flow.tickets>before&&result.quest===id,`${id} rank or rewards missing`);
  assert(!Object.values(flow.quests).includes('combatDone')&&!flow.stream,`${id} retained removed stream state`);
  const once=JSON.stringify({xp:flow.xp,gold:flow.gold,tickets:flow.tickets,bag:flow.bag});
  game.applyVictory(flow,boss);game.completeQuest(flow,id,{xp:0,tickets:0});
  assert(JSON.stringify({xp:flow.xp,gold:flow.gold,tickets:flow.tickets,bag:flow.bag})===once,`${id} rewards duplicated`);
}
assert(flow.fukuokaClear&&flow.quests.N44==='available','M08 must unlock the national main story');
for(const [id,area,bonus] of [['PR02','KY03-A1',12],['PR03','KY05-A1',14]]){
  assert(game.SUPPORTS[id].startA===bonus,`${id} support bonus changed`);
  const withSupport=game.createFieldRun({...flow,support:id},area,{count:0,picks:[0,0]});
  const without=game.createFieldRun({...flow,support:null},area,{count:0,picks:[0,0]});
  assert(withSupport.A===without.A+bonus,`${id} support not applied at battle start`);
}
console.log('Kyushu M01–M08: save compatibility, battles, direct boss completion, ranks, rewards and stale-result guards OK');
