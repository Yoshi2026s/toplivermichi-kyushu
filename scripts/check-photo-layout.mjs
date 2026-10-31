import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..'),ui=readFileSync(resolve(root,'src/ui.js'),'utf8'),fn=ui.slice(ui.indexOf('function battleProgressIndex('),ui.indexOf('function renderBattleLog('));
const action=ui.match(/  battleProgressMove\(el\)\{[^\n]+/)[0].trim().replace(/,$/,'');
const G={screen:'battle',sheet:null,dlg:null,st:{run:{seq:1,turn:4,party:[{hp:100,c:8}],log:['初め','回復','<script>危険なHTMLではなく文章</script>']}}};let renders=0;
const api=vm.runInNewContext(fn+'\nconst actions={'+action+'};({battleProgressIndex,renderBattleProgress,actions})',{G,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),render:()=>renders++});
const before=JSON.stringify(G.st),r=G.st.run;
assert.equal(api.battleProgressIndex(r),2);assert(api.renderBattleProgress(r).includes('&lt;script&gt;'));assert(!api.renderBattleProgress(r).includes('<script>'));
api.actions.battleProgressMove({dataset:{v:'-1'}});assert.equal(api.battleProgressIndex(r),1);assert(api.renderBattleProgress(r).includes('回復'));assert.equal(JSON.stringify(G.st),before);
for(const flag of ['sheet','dlg']){G[flag]='blocked';const old=G.battleReader.index;api.actions.battleProgressMove({dataset:{v:'-1'}});assert.equal(G.battleReader.index,old);G[flag]=null;}
const old=renders;for(const value of ['2','NaN','Infinity','0'])api.actions.battleProgressMove({dataset:{v:value}});assert.equal(renders,old);
r.log.push('新しい進行');assert.equal(api.battleProgressIndex(r),1,'new progress does not displace a reader browsing history');api.actions.battleProgressMove({dataset:{v:'1'}});api.actions.battleProgressMove({dataset:{v:'1'}});r.log.push('続き');assert.equal(api.battleProgressIndex(r),4,'latest follows newly appended progress');
const long={seq:2,log:Array.from({length:80},(_,i)=>'行'+i)};G.st.run=long;assert.equal(api.battleProgressIndex(long),79);api.actions.battleProgressMove({dataset:{v:'-1'}});long.log=[...long.log.slice(1),'行80'];assert.equal(api.battleProgressIndex(long),77);assert.equal(long.log[G.battleReader.index],'行78','trim preserves the chosen existing line');
G.st.run={seq:3,log:[]};assert.equal(api.battleProgressIndex(G.st.run),0);assert(api.renderBattleProgress(G.st.run).includes('進行 0／0'));
console.log('Photo layout progress: pure reading, escaping, boundaries, stale sheets, latest following, 80-line trim and new/empty battle reset passed');
