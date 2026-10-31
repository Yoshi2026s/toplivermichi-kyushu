import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8'),code=ui.slice(ui.indexOf('function resultDone(){'),ui.indexOf('/* ---- シート',ui.indexOf('function resultDone(){')));
let renders=0,flushes=0,scenes=0;
const G={st:{lastResult:{},scenes:{}},screen:'result',walk:{path:[1],pending:{}},cursorSig:'old'};
const done=runInNewContext(code+';resultDone',{G,SCENES:{},QUESTS:{},render:()=>renders++,keepFlush:()=>flushes++,exploreBgm(){},playScene:()=>scenes++});
for(const flag of ['sheet','dlg','readOnly']){G[flag]=true;done();assert.equal(renders,0);G[flag]=false;}
G.st.run={};done();assert.equal(renders,0);G.st.run=null;
done();assert.equal(G.screen,'explore');assert.equal(G.walk.path.length,0);assert.equal(G.walk.pending,null);assert.equal(flushes,1);assert.equal(renders,1);
done();assert.equal(renders,1,'stale double return does nothing');assert.equal(scenes,0);
console.log('Result return is one action, cancels stale movement, rejects modal/read-only/battle and repeated callbacks');
