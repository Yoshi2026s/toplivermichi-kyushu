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
if(fresh.quests.M04!=='locked') fail('M04 must start locked');
fresh.quests.M02='combatDone';
game.completeQuest(fresh,'M02',{xp:0,tickets:0});
if(fresh.quests.M03!=='available'||!fresh.fukuokaClear) fail('M02 must unlock M03');

const old=game.newGame('旧記録','男性');
old.quests.M02='complete'; old.fukuokaClear=true; old.gold=317; old.bag.push({id:'IT001',n:2});
delete old.quests.M03;
delete old.quests.M04;
const migrated=game.migrate(JSON.parse(JSON.stringify(old)));
if(migrated.quests.M03!=='available'||migrated.quests.M04!=='locked'||migrated.gold!==317||migrated.bag.length!==old.bag.length) fail('old save migration changed existing progress');
const karatsuOld=game.newGame('唐津済','女性'); karatsuOld.quests.M03='complete'; delete karatsuOld.quests.M04;
if(game.migrate(JSON.parse(JSON.stringify(karatsuOld))).quests.M04!=='available') fail('Karatsu save must unlock M04');

for(const id of ['KY03-A1','KY03-A2','KY03-A3','KY04-A1','KY04-A2','KY04-A3']){
  if(game.AREAS[id]?.list.length!==50||!game.enemyDef(id,0).id.startsWith(`EN-${id}-`)) fail(`${id} enemy catalog invalid`);
  const run=game.createFieldRun(fresh,id,{count:0,picks:[0,0]});
  if(run.hub!==id.slice(0,4)||run.areaId!==id||run.enemies.length!==1) fail(`${id} battle creation failed`);
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
if(fresh.quests.M04!=='available') fail('M03 must unlock M04');
const once=fresh.tickets;
game.completeQuest(fresh,'M03',{xp:0,tickets:0});
if(fresh.tickets!==once) fail('M03 reward duplicated');
if(game.SUPPORTS.PR02.startA!==12) fail('Saga support bonus invalid');
fresh.support='PR02';
const supported=game.createFieldRun(fresh,'KY03-A1',{count:0,picks:[0,0]});
if(supported.A!==game.createFieldRun({...fresh,support:null},'KY03-A1',{count:0,picks:[0,0]}).A+12) fail('Saga support battle bonus invalid');
const cityBoss=game.createBossRun(fresh,'B03');
if(cityBoss.hub!=='KY04'||cityBoss.areaId!=='KY04-A3'||cityBoss.enemies[0].id!=='B03') fail('Saga city boss battle invalid');
const cityStream=game.newStream(fresh,'KY04','hero','local','voice');
for(const act of ['local','reply','first','thanks']) game.streamPlay(cityStream,act);
if(!cityStream.done||cityStream.score<80||cityStream.hub!=='KY04'||cityStream.prefId!=='PR02') fail('Saga city stream cannot complete');
fresh.quests.M04='combatDone';
const cityBefore=fresh.tickets;
game.completeQuest(fresh,'M04',{xp:0,tickets:0});
if(fresh.quests.M04!=='complete'||fresh.moeRank!==4||fresh.tickets<=cityBefore) fail('M04 completion failed');
const cityOnce=fresh.tickets;
game.completeQuest(fresh,'M04',{xp:0,tickets:0});
if(fresh.tickets!==cityOnce) fail('M04 reward duplicated');
console.log('Saga M03-M04: old saves, battles, bosses, streams, ranks and rewards OK');
