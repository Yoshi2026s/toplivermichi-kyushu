import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const start=ui.indexOf('function confirmAct(forced){'),end=ui.indexOf('/* ---- 戦闘オート',start);
assert(start>=0&&end>start);
for(const outcome of ['won','lost'])for(const destination of ['battle','result','explore','title','newSave','newBattle']){
  const run={party:[{}],enemies:[{slot:0,hp:1}],state:'input'},st={run};
  const G={st,screen:'battle',cmd:{actor:0}},timers=[],jingles=[];
  const confirm=runInNewContext(ui.slice(start,end)+'\nconfirmAct',{
    G,applyAction(){run.state=outcome;run.enemies[0].hp=0;return {ok:true,log:[]};},
    SND:{sfx(){},jingle:(...a)=>jingles.push(a)},setTimeout:(fn,ms)=>timers.push({fn,ms}),
    commit(){},render(){},battleFx(){}
  });
  confirm({type:'attack'});
  if(destination==='newSave')G.st={run};else if(destination==='newBattle')st.run={...run};else G.screen=destination;
  if(destination==='result')st.run=null;
  timers.find(t=>t.ms===(outcome==='won'?250:450)).fn();
  assert.equal(jingles.length,destination==='battle'?1:0,`${outcome}: ${destination}`);
}
console.log('Delayed battle jingles respect active screen, battle identity and save identity');
for(const destination of ['battle','result','explore','title','newSave','newBattle','hidden','won','noSave']){
 const run={party:[{}],enemies:[{slot:0,hp:1},{slot:1,hp:2}],state:'input'},st={run},G={st,screen:'battle',cmd:{actor:0}},timers=[],sounds=[],document={hidden:false};
 const confirm=runInNewContext(ui.slice(start,end)+'\nconfirmAct',{
  G,document,applyAction(){run.enemies[0].hp=0;return {ok:true,log:[]};},
  SND:{sfx:n=>sounds.push(n),jingle(){}},setTimeout:(fn,ms)=>timers.push({fn,ms}),commit(){},render(){},battleFx(){}
 });
 confirm({type:'attack'});sounds.length=0;
 if(destination==='newSave')G.st={run};else if(destination==='newBattle')st.run={...run};else if(destination==='hidden')document.hidden=true;else if(destination==='won')run.state='won';else if(destination==='noSave')G.st=null;else G.screen=destination;
 timers.find(t=>t.ms===180).fn();
 assert.equal(sounds.length,destination==='battle'?1:0,'defeat sound: '+destination);
}
console.log('Delayed defeat sound rejects obsolete battles, save switches, screens and hidden pages');
