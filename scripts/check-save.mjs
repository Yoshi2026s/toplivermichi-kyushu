import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const core=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','core.js'].map(name=>readFileSync(resolve(root,'src',name),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src','ui.js'),'utf8');
const checksum=ui.match(/function checksum\(str\)\{[^\n]+\}/)?.[0];
const load=ui.match(/async function loadSave\(\)\{[\s\S]*?\n\}/)?.[0];
const validate=ui.match(/function validateState\(s\)\{[\s\S]*?\n\}/)?.[0];
if(!checksum||!load||!validate) throw new Error('save functions missing');
const db={auto:null,'auto-prev':null},store={value:null};
const game=runInNewContext(`${core}\n${checksum}\n${validate}\n${load}\n({newGame,checksum,loadSave})`,{
  DB:{get:async key=>db[key]},localStorage:{getItem:()=>store.value}
});
const makeRecord=(state,gen=1)=>{const text=JSON.stringify(state);return {state:text,sum:game.checksum(text),gen,time:gen};};
const old=game.newGame('古い記録','男性'),newer=game.newGame('新しい記録','女性');
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
console.log('Save recovery: current, corrupt checksum, malformed JSON, invalid state, local fallback OK');
