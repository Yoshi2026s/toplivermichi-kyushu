import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),out=resolve(root,'.task/audio-render');
await mkdir(out,{recursive:true});const report=[];
try{
 const page=await browser.newPage();await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
 const source=await readFile(resolve(root,'src/audio.js'),'utf8');
 for(const scene of ['title','field','battle']){
  const result=await page.evaluate(async({source,scene})=>{
   const rate=22050,seconds=5,offline=new OfflineAudioContext(2,rate*seconds,rate),callbacks=new Set();
   const factory=function(){return offline;};
   const sound=new Function('window','document','setInterval','clearInterval','setTimeout','clearTimeout','ORCHESTRA_BANK','ORCHESTRA_CODEC',source+';return SND;')({AudioContext:factory},{hidden:false},f=>{callbacks.add(f);return f;},f=>callbacks.delete(f),()=>1,()=>{},ORCHESTRA_BANK,ORCHESTRA_CODEC);
   sound.setOn(true);sound.play(scene);
   const waits=[];
   for(let i=1;i<25;i++)waits.push(offline.suspend(i*.2).then(()=>{
    if(i===5)sound.setVolumes(.25,.5);
    if(i===9)sound.sfx('damage');
    if(i===15)sound.setVolumes(0,0);
    if(i===17)sound.setVolumes(.75,.75);
    for(const callback of [...callbacks])callback();
    return offline.resume();
   }));
   const buffer=await offline.startRendering();await Promise.all(waits);
   const channels=Array.from({length:buffer.numberOfChannels},(_,channel)=>{
    const data=buffer.getChannelData(channel);let peak=0,sum=0,muted=0,resumed=0,finite=true;
    for(let i=0;i<data.length;i++){const v=data[i];finite&&=Number.isFinite(v);peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i>rate*3.1&&i<rate*3.3)muted=Math.max(muted,Math.abs(v));if(i>rate*3.6&&i<rate*4.6)resumed+=v*v;}
    return {channel,peak,rms:Math.sqrt(sum/data.length),muted,resumedRms:Math.sqrt(resumed/rate),finite};
   });
   const samples=[];for(let i=0;i<buffer.length;i++)for(let channel=0;channel<buffer.numberOfChannels;channel++)samples.push(Math.max(-32768,Math.min(32767,Math.round(buffer.getChannelData(channel)[i]*32767))));
   sound.setOn(false);return {scene,rate,channels,peak:Math.max(...channels.map(c=>c.peak)),rms:Math.sqrt(channels.reduce((n,c)=>n+c.rms*c.rms,0)/channels.length),muted:Math.max(...channels.map(c=>c.muted)),resumedRms:Math.min(...channels.map(c=>c.resumedRms)),finite:channels.every(c=>c.finite),sourcesAfterMute:sound.sourceCount,samples};
  },{source,scene});
  assert.equal(result.channels.length,2);assert(result.finite);assert(result.peak>0&&result.peak<1,'rendered score stays below full scale');assert(result.muted<1e-7,'music and wet returns become silent together');assert(result.resumedRms>.0001,'score resumes after zero volume');assert.equal(result.sourcesAfterMute,0);
  const samples=result.samples;delete result.samples;const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(result.rate,24);wav.writeUInt32LE(result.rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((n,i)=>wav.writeInt16LE(n,44+i*2));await writeFile(resolve(out,scene+'.wav'),wav);report.push(result);console.log('PASS offline audio render '+scene);
 }
}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({physicalDevice:false,auditoryReview:false,renderedSeconds:5,report},null,2));}
