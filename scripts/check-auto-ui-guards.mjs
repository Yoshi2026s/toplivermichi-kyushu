import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const ui=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const body=ui.match(/  autoOn\(\)\{([\s\S]*?)\},\r?\n/)[1],step=ui.slice(ui.indexOf('function autoStep(){'),ui.indexOf('function toResult(){'));
let timers=0,actions=0,renders=0;
const G={screen:'battle',st:{run:{state:'input'}},cmd:{}},document={hidden:false};
const g=runInNewContext(step+'\n({autoOn(){'+body+'},autoStep})',{G,document,clearTimeout(){},setTimeout(){timers++;return timers;},render(){renders++;},SND:{sfx(){}},reducedMotion:()=>true,toast(){},aiChoose:()=>({name:'hero',label:'attack',idx:0,act:{type:'attack'}}),confirmAct(){actions++;}});
for(const flag of ['sheet','dlg','readOnly']){G[flag]=true;g.autoOn();assert.equal(timers,0);G[flag]=false;}
g.autoOn();g.autoOn();assert.equal(timers,1,'repeated start must schedule only one timer');assert.equal(renders,1);
document.hidden=true;g.autoStep();assert.equal(actions,0,'hidden battle must pause');document.hidden=false;G.readOnly=true;g.autoStep();assert.equal(G.auto,false);assert.equal(actions,0);
G.readOnly=false;G.auto=true;G.st.run.state='won';g.autoStep();assert.equal(G.auto,false);assert.equal(actions,0,'completed fight cannot act');
console.log('Auto UI rejects repeated start, modal/read-only starts and hidden/read-only/completed actions');
