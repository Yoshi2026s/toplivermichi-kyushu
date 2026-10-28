import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','core.js'];
const source=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src/ui.js'),'utf8');
const migration=ui.match(/function migrate\(s\)\{[\s\S]*?\n\}/)?.[0];
if(!migration) throw new Error('save migration missing');
const game=runInNewContext(`${source}\nfunction soundPref(){return true}\n${migration}\n({newGame,completeQuest,createFieldRun,createBossRun,newStream,streamPlay,migrate,enemyDef,AREAS,QUESTS,SUPPORTS})`);
const fail=msg=>{throw new Error(msg)};

const fresh=game.newGame('確認用','女性');
if(fresh.quests.M03!=='locked') fail('M03 must start locked');
fresh.quests.M02='combatDone';
game.completeQuest(fresh,'M02',{xp:0,tickets:0});
if(fresh.quests.M03!=='available'||!fresh.fukuokaClear) fail('M02 must unlock M03');

const old=game.newGame('旧記録','男性');
old.quests.M02='complete'; old.fukuokaClear=true; old.gold=317; old.bag.push({id:'IT001',n:2});
delete old.quests.M03;
const migrated=game.migrate(JSON.parse(JSON.stringify(old)));
if(migrated.quests.M03!=='available'||migrated.gold!==317||migrated.bag.length!==old.bag.length) fail('old save migration changed existing progress');

for(const id of ['KY03-A1','KY03-A2','KY03-A3']){
  if(game.AREAS[id]?.list.length!==50||!game.enemyDef(id,0).id.startsWith(`EN-${id}-`)) fail(`${id} enemy catalog invalid`);
  const run=game.createFieldRun(fresh,id,{count:0,picks:[0,0]});
  if(run.hub!=='KY03'||run.areaId!==id||run.enemies.length!==1) fail(`${id} battle creation failed`);
}
const boss=game.createBossRun(fresh,'B02');
if(boss.hub!=='KY03'||boss.areaId!=='KY03-A3'||boss.enemies[0].id!=='B02') fail('Karatsu boss battle invalid');
const stream=game.newStream(fresh,'KY03','hero','local','voice');
for(const act of ['local','reply','first','thanks']) game.streamPlay(stream,act);
if(!stream.done||stream.score<80||stream.prefId!=='PR02') fail('Saga stream cannot complete');
fresh.quests.M03='combatDone';
const before=fresh.tickets;
game.completeQuest(fresh,'M03',{xp:0,tickets:0});
if(fresh.quests.M03!=='complete'||fresh.moeRank!==3||fresh.tickets<=before) fail('M03 completion failed');
const once=fresh.tickets;
game.completeQuest(fresh,'M03',{xp:0,tickets:0});
if(fresh.tickets!==once) fail('M03 reward duplicated');
if(game.SUPPORTS.PR02.startA!==12) fail('Saga support bonus invalid');
fresh.support='PR02';
const supported=game.createFieldRun(fresh,'KY03-A1',{count:0,picks:[0,0]});
if(supported.A!==game.createFieldRun({...fresh,support:null},'KY03-A1',{count:0,picks:[0,0]}).A+12) fail('Saga support battle bonus invalid');
console.log('Saga M03: old save, battles, boss, stream, rank and reward OK');
