import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium,browserOptions} from './mobile-runtime.mjs';
const source=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const browser=await chromium.launch(browserOptions()),page=await browser.newPage();
const report=[];mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});
try{for(const track of ['title','field','battle']){
 const result=await page.evaluate(async({source,track})=>{
  const duration=track==='title'?82:18,rate=22050,offline=new OfflineAudioContext(2,rate*duration,rate);let callback;
  const context=new Proxy(offline,{get(t,key){if(key==='state')return 'running';const v=t[key];return typeof v==='function'?v.bind(t):v;}});
  const sound=new Function('window','setInterval','clearInterval',source+';return SND;')({AudioContext:function(){return context;}},fn=>(callback=fn,1),()=>{});
  sound.setOn(true);sound.play(track);
  let paused=offline.suspend(.2);const rendering=offline.startRendering();
  for(let time=.2;time<duration-.21;time+=.2){await paused;callback();if(time+.2<duration-.21)paused=offline.suspend(time+.2);await offline.resume();}
  const buffer=await rendering,left=buffer.getChannelData(0),right=buffer.getChannelData(1);let sum=0,tail=0,peak=0,clipped=0;
  const pcm=new Int16Array(left.length*2);for(let i=0;i<left.length;i++){for(const [j,data]of [[0,left],[1,right]]){const n=data[i];sum+=n*n;if(i>left.length-rate*2)tail+=n*n;peak=Math.max(peak,Math.abs(n));if(Math.abs(n)>=.999)clipped++;pcm[i*2+j]=Math.round(Math.max(-1,Math.min(1,n))*32767);}}
  const bytes=new Uint8Array(pcm.buffer);let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {pcm:btoa(binary),rate,peak,rms:Math.sqrt(sum/(left.length*2)),clipped,tailRms:Math.sqrt(tail/(rate*4))};
 },{source,track});
 const data=Buffer.from(result.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(result.rate,24);header.writeUInt32LE(result.rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 writeFileSync(new URL('../.task/'+track+'-orchestra.wav',import.meta.url),Buffer.concat([header,data]));delete result.pcm;report.push({track,...result});if(result.rms<.01||result.tailRms<.005||result.clipped)throw Error('Silent/clipped output: '+track);
 }writeFileSync(new URL('../.task/orchestra-audio-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
