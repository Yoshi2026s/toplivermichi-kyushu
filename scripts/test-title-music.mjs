import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/title-music-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short','narrow','keyboard']){
 const options=['narrow','keyboard'].includes(device)?{...mobileOptions('small'),viewport:device==='narrow'?{width:320,height:640}:{width:360,height:440}}:mobileOptions(device);
 const context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...args){super(...args);window.testAudioContext=this;}};});
 try{await page.goto(app.url);const button=page.locator('[data-a="titleMusic"]');await button.waitFor();
 await page.locator('.title-visual').tap();await page.waitForFunction(()=>SND.playing&&document.querySelector('[data-a="titleMusic"]').getAttribute('aria-pressed')==='true');await button.tap();
 assert.equal(await button.getAttribute('data-play'),'true');const size=await button.boundingBox();assert(size.height>=48&&size.width>=48);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await button.tap();await page.waitForFunction(()=>SND.playing&&SND.current==='title'&&SND.instrumentation.sampleNotes>0&&SND.sourceCount>0);
 assert.equal(await page.evaluate(()=>G.screen),'title');await page.waitForFunction(()=>document.querySelector('[data-a="titleMusic"]').getAttribute('aria-pressed')==='true');
 const before=await page.evaluate(()=>SND.instrumentation.sampleNotes);await page.waitForFunction(n=>SND.instrumentation.sampleNotes>n,before,{timeout:5000}).catch(async error=>{console.error(JSON.stringify({device,before,audio:await page.evaluate(()=>({state:window.testAudioContext?.state,time:window.testAudioContext?.currentTime,hidden:document.hidden,on:SND.on,playing:SND.playing,metrics:SND.metrics,instrumentation:SND.instrumentation}))}));throw error;});assert(await page.evaluate(n=>SND.instrumentation.sampleNotes>n,before));
 await button.tap();assert.equal(await page.evaluate(()=>SND.on),false);assert.equal(await page.evaluate(()=>SND.sourceCount),0);assert.equal(await page.evaluate(()=>localStorage.getItem('tlr-kyushu-sound')),'0');
 await page.reload();await button.waitFor();assert.equal(await page.evaluate(()=>SND.on),false);await page.locator('.title-visual').tap();assert.equal(await page.evaluate(()=>SND.on),false,'muted preference survives reload and background taps');
 await page.evaluate(()=>SND.setVolumes(0,.75));await button.tap();await page.locator('.overlay').waitFor();assert.equal(await page.evaluate(()=>SND.volumes.music),0,'zero volume must not be silently overwritten');await page.locator('[data-a="closeSheet"]').tap();
 await page.evaluate(()=>SND.setVolumes(.5,.75));await button.tap();await page.waitForFunction(()=>SND.playing&&SND.sourceCount>0);assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.5,effects:.75});
 await page.evaluate(()=>SND.suspend());assert.equal(await page.evaluate(()=>SND.sourceCount),0);await page.locator('.title-visual').tap();await page.waitForFunction(()=>SND.sourceCount>0);
 await page.evaluate(async()=>{const ac=window.testAudioContext;await ac.suspend();Object.defineProperty(ac,'state',{configurable:true,get:()=> 'interrupted'});const nativeResume=ac.resume.bind(ac);ac.resume=()=>{delete ac.state;return nativeResume();};refreshTitleMusic();});
 assert.equal(await button.textContent(),'♪ BGMを再生・再開');assert.equal(await button.getAttribute('aria-pressed'),'false');
 await button.press('Enter');await page.waitForFunction(()=>SND.playing&&SND.sourceCount>0);await page.waitForFunction(()=>document.querySelector('[data-a="titleMusic"]').getAttribute('aria-pressed')==='true');
 await page.evaluate(()=>{G.st=newGame('音楽確認','男性');G.st.settings.sound=true;G.screen='explore';exploreBgm();render();});assert.notEqual(await page.evaluate(()=>SND.current),'title');await page.evaluate(()=>ACT.toTitle());await page.waitForFunction(()=>SND.current==='title'&&SND.sourceCount>0);
 await page.locator('#toast').waitFor({state:'hidden'});await button.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,device+'.png')});
 await page.evaluate(async()=>{G.st.settings.musicVolume=0;G.st.settings.effectVolume=.35;await commit();});await page.reload();await button.waitFor();assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:0,effects:.35},'saved volumes apply before title playback');assert.equal(await button.getAttribute('aria-label'),'BGM音量の設定を開く');assert.equal(await button.textContent(),'♪ BGM音量0・設定');await button.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,device+'-zero.png')});await button.tap();await page.locator('.overlay').waitFor();assert.equal(await page.evaluate(()=>SND.on),false);assert.deepEqual(errors,[]);report.push({device,passed:true,interruptionSimulated:true,source:await page.evaluate(()=>SND.current),score:await page.evaluate(()=>SND.scores.title),metrics:await page.evaluate(()=>SND.instrumentation),errors});
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,auditoryReview:false,report},null,2));}
console.log('PASS title BGM at six sizes: gesture playback, ongoing notes, pause/mute persistence, zero volume settings label, simulated interruption recovery and scene changes');
