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
const makeRecord=(state,gen=1)=>{const text=JSON.stringify(state);return {state:text,sum:game.checksum(text),gen,time:gen};};
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
store.value=JSON.stringify(makeRecord(newer,1));
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||loaded.storage!=='indexeddb'||loaded.fromPrev) throw new Error('older local save replaced current save');
store.value=JSON.stringify(makeRecord(newer,2));
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||loaded.storage!=='indexeddb'||loaded.fromPrev) throw new Error('same-generation local save replaced current save');
db.auto={...db.auto,sum:'wrong'}; db['auto-prev']=makeRecord(old,4);
loaded=await game.loadSave();
if(loaded.state.profile.name!=='古い記録'||!loaded.fromPrev) throw new Error('newer previous save was ignored');
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
console.log('Save recovery: generation choice, corrupt checksum, malformed JSON, invalid state, local fallback, visit migration, restore rollback OK');
