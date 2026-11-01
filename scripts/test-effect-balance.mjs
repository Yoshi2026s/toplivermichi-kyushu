import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),out=resolve(root,'.task/effect-balance');await mkdir(out,{recursive:true});
try{const page=await browser.newPage();await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();const source=await readFile(resolve(root,'src/audio.js'),'utf8');
const rows=await page.evaluate(async source=>{
 const names=new Function(source.slice(source.indexOf('  const SFX ='),source.indexOf('  function duckBgm'))+';return Object.keys(SFX);')(),rows=[];
 const scenarios=names.map(name=>({name,parts:[name]})).concat([{name:"overlap-combat",parts:["damage","critical","slash","skillhit","down","allhit"]},{name:"overlap-reward",parts:["win","rank","level","heal","kira"]},{name:"overlap-all",parts:names}]);
 // The offline waveform facade models a running device; real suspension is covered by test-sound-comfort.
 for(const sampled of [true,false])for(const {name,parts} of scenarios){
  const rate=22050,ac=new OfflineAudioContext(2,rate*3,rate),sound=new Function('window','document','setInterval','clearInterval','setTimeout','clearTimeout','ORCHESTRA_BANK','ORCHESTRA_CODEC',source+';return SND;')({AudioContext:function(){return new Proxy(ac,{get(target,key){if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}},{hidden:false},()=>1,()=>{},()=>1,()=>{},sampled?ORCHESTRA_BANK:undefined,ORCHESTRA_CODEC);
  sound.setOn(true);for(const effect of parts)sound.sfx(effect);const wave=await ac.startRendering();let peak=0,maxRms=0,finite=true,tail=0;const bin=Math.round(rate*.05);
  for(let c=0;c<2;c++){const d=wave.getChannelData(c);let sum=0;for(let i=0;i<d.length;i++){finite&&=Number.isFinite(d[i]);peak=Math.max(peak,Math.abs(d[i]));sum+=d[i]*d[i];if(i>rate*2.5)tail=Math.max(tail,Math.abs(d[i]));if(i%bin===bin-1){maxRms=Math.max(maxRms,Math.sqrt(sum/bin));sum=0;}}}
  const sampleNotes=sound.instrumentation.sampleNotes;sound.setOn(false);rows.push({name,sampled,peak,maxRms,finite,tail,sampleNotes,sourcesAfterMute:sound.sourceCount});
 }return rows;
},source);
assert.equal(rows.length,64,'29 single effects and 3 overlap scenarios with recorded and synthesized instruments');
const impacts=['damage','down','meter','skillhit','allhit','slash','defeat','enc','overlap-combat'];
for(const row of rows){assert(row.finite&&row.peak>0&&row.peak<.8,row.name+' finite audible headroom');assert(row.maxRms<.14||!impacts.includes(row.name),row.name+' impact must avoid a large sustained loudness jump');assert(row.tail<1e-7,row.name+' stops fully');assert.equal(row.sourcesAfterMute,0);if(row.sampled&&['win','rank','level','seaRescue','kira','lose'].includes(row.name))assert(row.sampleNotes>0,row.name+' uses the acoustic event palette');}
await writeFile(resolve(out,'report.json'),JSON.stringify({physicalDevice:false,auditoryReview:false,rmsWindowMs:50,rows},null,2));console.log('PASS 29 effects and 3 overlap scenarios: recorded/synthetic fallback, impact loudness ceiling, stereo headroom and release');
}finally{await browser.close();await app.close();}
