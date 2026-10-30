import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=n=>readFileSync(resolve(root,'src',n),'utf8');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','data_extras.js','core.js','listeners.js'];
const g=runInNewContext(files.map(read).join('\n')+'\n({newGame,createListenerBatch,visibleListenerComments,migrateListeners,LISTENER_CONTEXTS,LISTENER_TEXTS,LISTENER_NAMES,LISTENER_SPECIAL_NAMES,SUPPORTS,SUPPORT_REQUIREMENTS,MAPS,HUBS})');
assert.equal(g.LISTENER_TEXTS.length,352);assert.equal(new Set(g.LISTENER_TEXTS.map(t=>t.text)).size,352);assert.equal(g.LISTENER_NAMES.length,512);assert.equal(new Set(g.LISTENER_NAMES).size,512);assert.equal(g.LISTENER_SPECIAL_NAMES.length,77);assert.equal(new Set(g.LISTENER_SPECIAL_NAMES).size,77);
const st=g.newGame('検査する旅人','女性'),seenTexts=[],seenNames=[];
for(let cycle=0;cycle<100;cycle++)for(const [context] of g.LISTENER_CONTEXTS){
  const count=1+cycle%5,batch=g.createListenerBatch(st,context,count,1000);
  assert.equal(batch.length,count);assert.equal(g.visibleListenerComments(batch,1000).length,1);
  for(let i=0;i<batch.length;i++){
    const c=batch[i],text=g.LISTENER_TEXTS.find(t=>t.text===c.text);assert.equal(text.context,context);assert(!seenTexts.slice(-12).includes(text.id),'repeat among last12texts');assert(!seenNames.slice(-24).includes(c.name),'repeat among last24names');seenTexts.push(text.id);seenNames.push(c.name);
    assert.equal(c.end-c.start,5000);if(i)assert(c.start-batch[i-1].start>=650&&c.start-batch[i-1].start<=1000);
  }
  assert.equal(g.visibleListenerComments(batch,batch.at(-1).end).length,0);assert(st.listenerHistory.texts.length<=12&&st.listenerHistory.names.length<=24);
}
assert.equal(g.createListenerBatch(st,'__proto__').length,0);assert.equal(g.createListenerBatch(st,'town',6).length,0);const restored=JSON.parse(JSON.stringify(st));const before=JSON.stringify(restored);g.migrateListeners(restored);assert.equal(JSON.stringify(restored),before);
assert.equal(Object.keys(g.SUPPORTS).length,47);assert.equal(Object.keys(g.SUPPORT_REQUIREMENTS).length,47);assert.equal(g.SUPPORTS.PR06.kiraBonus,5);
for(const [hub,H]of Object.entries(g.HUBS)){assert(g.MAPS[hub].objects.some(o=>o.type==='jobcenter'));assert(!g.MAPS[hub].objects.some(o=>o.type==='boss'));}
console.log('Listeners: 352 contextual texts, 512+77 names, 1–5 timed bubbles, 650–1000ms spacing, 5sec lifetime, 12text/24name deduplication, independent save histories; 47 regional supports and 51 jobcenters passed');

const events={},timers=new Map();let box=null,now=0,seq=0;
const document={hidden:false,addEventListener(name,fn){events[name]=fn;},
  getElementById(){return box;},createElement(){return {setAttribute(){},innerHTML:'',remove(){box=null;}};},
  body:{appendChild(node){box=node;}}};
const G={st:g.newGame('再表示検査','女性'),screen:'explore',sheet:null,dlg:null,readOnly:false};
G.st.settings.listenerComments=true;
const display=runInNewContext(files.map(read).join('\n')+'\n({observeListenerScene})',{
  G,document,performance:{now:()=>now},esc:s=>String(s),
  setTimeout(fn){timers.set(++seq,fn);return seq;},clearTimeout:id=>timers.delete(id)
});
display.observeListenerScene();assert(box?.innerHTML);assert(timers.size>0);
document.hidden=true;events.visibilitychange?.();
assert.equal(box,null,'hiding the tab removes displayed comments');assert.equal(timers.size,0);
now=20000;document.hidden=false;events.visibilitychange?.();
assert(box?.innerHTML,'returning to the tab refreshes comments');assert(timers.size>0);
G.st.settings.listenerComments=false;document.hidden=true;events.visibilitychange?.();
document.hidden=false;events.visibilitychange?.();assert.equal(box,null);assert.equal(timers.size,0);
console.log('Listener visibility cleanup, fresh return and saved-off preference passed');
