import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),out=resolve(root,'.task/audio-render');
await mkdir(out,{recursive:true});const report=[];let longNoise;
try{
 const page=await browser.newPage();await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
 const source=await readFile(resolve(root,'src/audio.js'),'utf8');
 longNoise=await page.evaluate(async source=>{
  const rate=22050,ac=new OfflineAudioContext(1,rate*2,rate),noiseBuf=ac.createBuffer(1,rate,rate),data=noiseBuf.getChannelData(0);let seed=12345;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
  const math=Object.create(Math);math.random=()=>.9;
  const block=source.slice(source.indexOf('  function noise('),source.indexOf('  function kick('));
  const noise=new Function('ac','activeSources','noiseBuf','musicBus','sfxBus','trackSource','Math',block+';return noise;')(ac,new Map(),noiseBuf,ac.destination,{},()=>{},math);
  noise(.05,1.6,.5,1200,{type:'bandpass'});const rendered=await ac.startRendering(),wave=rendered.getChannelData(0);let tail=0,count=0,end=0;
  for(let i=0;i<wave.length;i++){if(i>rate*1.2&&i<rate*1.4){tail+=wave[i]*wave[i];count++;}if(i>rate*1.8)end=Math.max(end,Math.abs(wave[i]));}
  return {seconds:1.6,tailRms:Math.sqrt(tail/count),afterRelease:end};
 },source);
 assert(longNoise.tailRms>1e-6,'long noise continues beyond the one-second source material');assert(longNoise.afterRelease<1e-7,'long noise stops after its release');console.log('PASS long noise buffer and release render');
 const sampledTone=await page.evaluate(async source=>{
  const render=async cutoff=>{
   const rate=22050,ac=new OfflineAudioContext(2,rate/2,rate),buffer=ac.createBuffer(1,rate/2,rate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=.5*Math.sin(2*Math.PI*7000*i/rate);
   const sampleBanks=new Map([['glock',[{root:69,buffer,loopEnd:0,loopStart:0}]]]),out=ac.destination,ended=[];
   const block=source.slice(source.indexOf('  function sampleVoice('),source.indexOf('  /* 1音'));
   const play=new Function('ac','sampleBanks','activeSources','musicBus','sfxBus','trackSource','revIn','let sampleTurns=0,sampleNotes=0,droppedSampleNotes=0;'+block+';return sampleVoice;')(ac,sampleBanks,new Map(),{},out,(_src,_out,cleanup)=>ended.push(cleanup),null);
   play(440,.02,.25,'glock',.5,{out,cutoff,r:.04});const rendered=await ac.startRendering();
   const channels=Array.from({length:2},(_,c)=>{const wave=rendered.getChannelData(c);let sum=0,tail=0;for(let i=0;i<wave.length;i++){sum+=wave[i]*wave[i];if(i>rate*.4)tail=Math.max(tail,Math.abs(wave[i]));}return {rms:Math.sqrt(sum/wave.length),tail};});ended.forEach(clean=>clean());return channels;
  };
  return {raw:await render(undefined),softened:await render(3000)};
 },source);
 for(let c=0;c<2;c++){assert(sampledTone.raw[c].rms>.001);assert(sampledTone.softened[c].rms<sampledTone.raw[c].rms*.15,'recorded effects honor their high-frequency rolloff');assert(sampledTone.softened[c].tail<1e-7,'filtered sample releases completely');}
 await writeFile(resolve(out,'sample-tone.json'),JSON.stringify(sampledTone,null,2));console.log('PASS recorded effect tone control on both channels');
 for(const scene of ['title','field','battle']){
  const result=await page.evaluate(async({source,scene})=>{
   const rate=22050,seconds=5,offline=new OfflineAudioContext(2,rate*seconds,rate),callbacks=new Set();
   // Offline fixtures model a running audio device while scheduling the render.
   const factory=function(){return new Proxy(offline,{get(target,key){if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});};
   const sound=new Function('window','document','setInterval','clearInterval','setTimeout','clearTimeout','ORCHESTRA_BANK','ORCHESTRA_CODEC',source+';return SND;')({AudioContext:factory},{hidden:false},f=>{callbacks.add(f);return f;},f=>callbacks.delete(f),()=>1,()=>{},ORCHESTRA_BANK,ORCHESTRA_CODEC);
   sound.setOn(true);sound.play(scene);
   const waits=[];
   for(let i=1;i<25;i++)waits.push(offline.suspend(i*.2).then(()=>{
    if(i===5)sound.setVolumes(.25,.5);
    if(i===9)sound.sfx('damage');
    if(i===12)sound.play(scene==='title'?'field':scene==='field'?'battle':'title');
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
   const transitionTo=sound.current;sound.setOn(false);return {scene,transitionTo,rate,channels,peak:Math.max(...channels.map(c=>c.peak)),rms:Math.sqrt(channels.reduce((n,c)=>n+c.rms*c.rms,0)/channels.length),muted:Math.max(...channels.map(c=>c.muted)),resumedRms:Math.min(...channels.map(c=>c.resumedRms)),finite:channels.every(c=>c.finite),sourcesAfterMute:sound.sourceCount,samples};
  },{source,scene});
  assert.equal(result.channels.length,2);assert.equal(result.transitionTo,scene==='title'?'field':scene==='field'?'battle':'title');assert(result.finite);assert(result.peak>0&&result.peak<1,'rendered score stays below full scale');assert(result.muted<1e-7,'music and wet returns become silent together');assert(result.resumedRms>.0001,'score resumes after zero volume');assert.equal(result.sourcesAfterMute,0);
  const samples=result.samples;delete result.samples;const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(result.rate,24);wav.writeUInt32LE(result.rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((n,i)=>wav.writeInt16LE(n,44+i*2));await writeFile(resolve(out,scene+'.wav'),wav);report.push(result);console.log('PASS offline audio render '+scene);
 }
}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({physicalDevice:false,auditoryReview:false,renderedSeconds:5,longNoise,report},null,2));}
