import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const core=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','core.js'].map(name=>readFileSync(resolve(root,'src',name),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src','ui.js'),'utf8');
const checksum=ui.match(/function checksum\(str\)\{[^\n]+\}/)?.[0];
const load=ui.match(/async function loadSave\(\)\{[\s\S]*?\n\}/)?.[0];
const validate=ui.match(/function validateState\(s\)\{[\s\S]*?\n\}/)?.[0];
const migrate=ui.match(/function migrate\(s\)\{[\s\S]*?\n\}/)?.[0];
const actions=ui.match(/const ACT = \{[\s\S]*?\n\};/)?.[0];
if(!checksum||!load||!validate||!migrate||!actions) throw new Error('save functions missing');
const db={auto:null,'auto-prev':null},store={value:null};
const game=runInNewContext(`${core}\n${checksum}\n${validate}\n${load}\n({newGame,checksum,loadSave})`,{
  DB:{get:async key=>db[key]},localStorage:{getItem:()=>store.value}
});
const makeRecord=(state,gen=1)=>{const text=JSON.stringify({...state,saveGeneration:gen});return {state:text,sum:game.checksum(text),gen,time:gen};};
const old=game.newGame('古い記録','男性'),newer=game.newGame('新しい記録','女性');
const migrateVisit=runInNewContext(`${core}\n${migrate}\nmigrate`,{soundPref:()=>true});
const missingVisit=game.newGame('訪問記録','男性');
missingVisit.mapId='KY03'; delete missingVisit.visitedMaps; delete missingVisit.visitedHubs;
migrateVisit(missingVisit);
if(!missingVisit.visitedMaps.includes('KY03')||!missingVisit.visitedHubs.includes('KY03')) throw new Error('current location missing from migrated visits');
const partialVisit=game.newGame('部分訪問','男性');
partialVisit.mapId='KY04'; partialVisit.visitedMaps=['KY01','KY02','KY03']; partialVisit.visitedHubs=['KY01'];
migrateVisit(partialVisit);
if(!partialVisit.visitedMaps.includes('KY04')||!['KY01','KY02','KY03','KY04'].every(id=>partialVisit.visitedHubs.includes(id))) throw new Error('partial visit history was not repaired');
const saseboVisit=game.newGame('佐世保の記録','女性');
saseboVisit.mapId='KY05';saseboVisit.pos={x:12,y:20};saseboVisit.quests.M04='complete';saseboVisit.visitedMaps=['KY01','KY05'];saseboVisit.visitedHubs=['KY01'];
migrateVisit(saseboVisit);
if(!saseboVisit.visitedHubs.includes('KY05')||saseboVisit.mapId!=='KY05'||saseboVisit.pos.x!==12||saseboVisit.quests.M04!=='complete') throw new Error('Sasebo visit migration lost location or main quest');
const lostPosition=game.newGame('位置欠損','女性');lostPosition.mapId='KY05';delete lostPosition.pos;migrateVisit(lostPosition);
if(lostPosition.pos.x!==12||lostPosition.pos.y!==20) throw new Error('missing Sasebo position was not recovered');
const outsidePosition=game.newGame('範囲外','女性');outsidePosition.mapId='KY05';outsidePosition.pos={x:99,y:99};migrateVisit(outsidePosition);
if(outsidePosition.pos.x!==12||outsidePosition.pos.y!==20) throw new Error('out-of-bounds Sasebo position was not recovered');
const blockedPosition=game.newGame('障害物','女性');blockedPosition.mapId='KY05';blockedPosition.pos={x:0,y:0};migrateVisit(blockedPosition);
if(blockedPosition.pos.x!==12||blockedPosition.pos.y!==20) throw new Error('blocked Sasebo position was not recovered');
const brokenLog=game.newGame('旧戦闘記録','男性');
brokenLog.run={log:{text:'old'},bag:[]};migrateVisit(brokenLog);
if(!Array.isArray(brokenLog.run.log)||brokenLog.run.log.length) throw new Error('malformed battle log was not repaired');
const longLog=game.newGame('長い戦闘記録','男性');
longLog.run={log:[...Array.from({length:83},(_,i)=>`行${i}`),null,42],bag:[]};migrateVisit(longLog);
if(longLog.run.log.length!==80||longLog.run.log[0]!=='行3'||longLog.run.log.at(-1)!=='行82') throw new Error('battle log migration lost recent valid entries');
db.auto=makeRecord(newer,2); db['auto-prev']=makeRecord(old,1);
let loaded=await game.loadSave();
if(loaded.state.profile.name!=='新しい記録'||loaded.fromPrev||loaded.storage!=='indexeddb') throw new Error('current save not loaded');
db.auto={...db.auto,sum:'wrong'};
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||!loaded.fromPrev) throw new Error('broken checksum did not recover previous save');
db.auto={state:'{bad',sum:game.checksum('{bad'),time:2};
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||!loaded.fromPrev) throw new Error('bad JSON did not recover previous save');
db.auto=makeRecord({...newer,mapId:'unknown'},2);
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||!loaded.fromPrev) throw new Error('invalid game state did not recover previous save');
store.value=JSON.stringify(makeRecord(newer,3));
loaded=await game.loadSave();
if(loaded.state.profile.name!=='新しい記録'||loaded.storage!=='local'||loaded.fromPrev) throw new Error('local save fallback failed');
db.auto=makeRecord(old,2);
loaded=await game.loadSave();
if(loaded.state.profile.name!=='新しい記録'||loaded.storage!=='local') throw new Error('newer local save was ignored');
db.auto.gen=999;
loaded=await game.loadSave();
if(loaded.state.profile.name!=='新しい記録'||loaded.storage!=='local') throw new Error('outer generation overrode the valid save body');
db.auto.gen=2;
const oldShape={...old}; delete oldShape.saveGeneration;
db.auto={...makeRecord(oldShape,4),state:JSON.stringify(oldShape)};
db.auto.sum=game.checksum(db.auto.state);
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||loaded.storage!=='indexeddb') throw new Error('legacy record generation fallback failed');
db.auto=makeRecord(old,2);
store.value=JSON.stringify(makeRecord(newer,1));
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||loaded.storage!=='indexeddb'||loaded.fromPrev) throw new Error('older local save replaced current save');
store.value=JSON.stringify(makeRecord(newer,2));
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||loaded.storage!=='indexeddb'||loaded.fromPrev) throw new Error('same-generation local save replaced current save');
db.auto={...db.auto,sum:'wrong'}; db['auto-prev']=makeRecord(old,4);
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||!loaded.fromPrev) throw new Error('newer previous save was ignored');
const resumeState={st:null,screen:'title',soundWant:null};
let resumeStatus='',resumeMessage='';
const resume=runInNewContext(`${actions}\nACT.continue`,{
  G:resumeState,loadSave:async()=>({state:old,storage:'indexeddb',fromPrev:true}),migrate:s=>s,
  setSave:value=>{resumeStatus=value;},toast:value=>{resumeMessage=value;},render:()=>{},
  SND:{on:true,setOn:()=>{},play:()=>{}},exploreBgm:()=>{}
});
await resume();
if(resumeState.screen!=='explore'||resumeStatus!=='前の記録から復旧'||!resumeMessage.includes('前の世代')||resumeMessage.includes('壊れ')) throw new Error('previous-save resume notice was misleading');
const positionState=game.newGame('位置復旧','女性');positionState.mapId='KY05';positionState.pos={x:99,y:99};
let positionMessage='';
const resumePosition=runInNewContext(`${core}\n${migrate}\n${actions}\nACT.continue`,{
  G:{st:null,screen:'title',soundWant:null},loadSave:async()=>({state:positionState,storage:'indexeddb',fromPrev:false}),
  setSave:()=>{},toast:value=>{positionMessage=value;},render:()=>{},soundPref:()=>true,
  SND:{on:true,setOn:()=>{},play:()=>{}},exploreBgm:()=>{}
});
await resumePosition();
if(positionState.pos.x!==12||positionState.pos.y!==20||!positionMessage.includes('保存位置を現在の地形')) throw new Error('position recovery was not explained on resume');
const current=game.newGame('維持する記録','男性'),incoming=game.newGame('復元する記録','女性');
const uiState={st:current,screen:'explore',sheet:'settings',readOnly:false,saveStatus:'保存済み',hasSave:true,walk:{path:[]},dlg:null,cmd:{}};
let saveSucceeds=false,rendered=0,message='';
const restore=runInNewContext(`${core}\n${validate}\n${migrate}\n${actions}\nACT.restore`,{
  G:uiState,$:()=>({value:JSON.stringify({app:'toplivermichi-kyushu',state:incoming})}),
  commit:async()=>{uiState.st.saveGeneration++;return saveSucceeds;},
  setSave:value=>{uiState.saveStatus=value;},toast:value=>{message=value;},render:()=>{rendered++;},
  soundPref:()=>true,clearTimeout:()=>{}
});
await restore();
if(uiState.st!==current||uiState.screen!=='explore'||uiState.sheet!=='settings'||uiState.saveStatus!=='保存済み'||rendered||!message.includes('元の記録を維持')) throw new Error('failed backup restore replaced the current game');
saveSucceeds=true; await restore();
if(uiState.st.profile.name!=='復元する記録'||uiState.sheet!==null||uiState.screen!=='explore'||rendered!==1||!message.includes('読み込みました')) throw new Error('successful backup restore failed');
const incomingPosition=game.newGame('位置を直す記録','女性');incomingPosition.mapId='KY05';incomingPosition.pos={x:99,y:99};
const positionUi={st:current,screen:'explore',sheet:'settings',readOnly:false,saveStatus:'保存済み',hasSave:true,walk:{path:[]},dlg:null,cmd:{}};
let restoredPositionMessage='';
const restorePosition=runInNewContext(`${core}\n${validate}\n${migrate}\n${actions}\nACT.restore`,{
  G:positionUi,$:()=>({value:JSON.stringify({app:'toplivermichi-kyushu',state:incomingPosition})}),
  commit:async()=>true,setSave:()=>{},toast:value=>{restoredPositionMessage=value;},render:()=>{},soundPref:()=>true,clearTimeout:()=>{}
});
await restorePosition();
if(positionUi.st.pos.x!==12||positionUi.st.pos.y!==20||!restoredPositionMessage.includes('保存位置を現在の地形')) throw new Error('backup restore did not explain position recovery');
console.log('Save recovery: generation choice, corrupt checksum, malformed JSON, invalid state, local fallback, visit migration, restore rollback OK');
