import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8'),loop=source.slice(source.indexOf('function startLoop(){'),source.indexOf('function bfs('));
function fixture(speed='normal',onArrival=()=>{}){
 const G={screen:'explore',st:{mapId:'town',settings:{moveSpeed:speed},pos:{x:0,y:0}},walk:{path:Array.from({length:40},(_,i)=>({x:i+1,y:0})),prog:0},frame:0};let frame,arrivals=[];const document={hidden:false};
 const start=runInNewContext(loop+'\nstartLoop',{G,document,reducedMotion:()=>true,drawMap(){},requestAnimationFrame(fn){frame=fn;return 1;},cancelAnimationFrame(){},arrive(){arrivals.push(G.st.pos.x);onArrival(G,document);}});start();G.lastTs=1;
 return {G,document,arrivals,step:t=>frame(t),distance:()=>G.st.pos.x+G.walk.prog};
}
for(const speed of ['normal','fast'])for(const hz of [30,50,60,90,120]){
 const f=fixture(speed),ms=speed==='normal'?1600:1100,frames=Math.round(hz*ms/1000);for(let i=1;i<=frames;i++)f.step(1+ms*i/frames);
 assert(Math.abs(f.distance()-10)<1e-8,`${speed} simulated ${hz}Hz keeps ten tiles worth of time`);assert(f.arrivals.length>=9&&f.arrivals.length<=10);assert.deepEqual(f.arrivals,Array.from({length:f.arrivals.length},(_,i)=>i+1),'arrival order never skips a tile');
}
const boundary=fixture();boundary.G.walk.prog=.95;boundary.step(51);assert.equal(boundary.arrivals.length,1);assert(Math.abs(boundary.G.walk.prog-.2625)<1e-9,'remaining frame time carries across a tile boundary');
for(const [name,change]of Object.entries({battle:G=>{G.screen='battle';},menu:G=>{G.sheet='menu';},dialog:G=>{G.dlg={};},lock:G=>{G.lock=true;},map:G=>{G.st.mapId='other';},state:G=>{G.st={...G.st};},route:G=>{G.walk.path=[{x:2,y:0}];},hidden:(G,d)=>{d.hidden=true;},token:G=>{G.mapLoopToken++;}})){
 const f=fixture('fast',change);f.G.walk.prog=.99;f.step(251);assert.equal(f.arrivals.length,1,name+' arrival stops leftover time');assert.equal(f.G.walk.prog,0,name+' cannot advance the next segment');
}
const delayed=fixture('fast');delayed.step(10001);assert(delayed.distance()<2.28,'large delays retain the existing 250ms catch-up cap');assert.deepEqual(delayed.arrivals,[1,2]);
const paused=fixture();paused.G.sheet='menu';paused.step(251);assert.equal(paused.distance(),0);paused.G.sheet=null;paused.step(267);assert(Math.abs(paused.distance()-.1)<1e-9,'menu time is not replayed after closing');
console.log('PASS elapsed-time walking at simulated 30/50/60/90/120Hz; ordered arrivals; battle/menu/map/route/visibility cancellation; catch-up cap');
