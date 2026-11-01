import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/jingle-pause'),browser=await chromium.launch(browserOptions());await mkdir(out,{recursive:true});
const page=await browser.newPage({hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original{constructor(...args){super(...args);window.testAudioContext=this;}};});
 await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').tap();await page.waitForFunction(()=>SND.playing);
 const frozen=await page.evaluate(async()=>{await window.testAudioContext.suspend();SND.suspend();SND.jingle('fanfare','victory');return {notes:SND.instrumentation.sampleNotes,time:window.testAudioContext.currentTime,sources:SND.sourceCount};});
 // Wait beyond the whole fanfare using wall time while the audio clock is frozen.
 await page.waitForTimeout(5500);
 assert.deepEqual(await page.evaluate(()=>({notes:SND.instrumentation.sampleNotes,time:window.testAudioContext.currentTime,sources:SND.sourceCount})),frozen,'paused audio must retain the fanfare instead of starting destination BGM');
 await page.evaluate(()=>window.testAudioContext.resume());await page.waitForFunction(()=>SND.playing&&SND.current==='victory',{},{timeout:12000});
 assert(await page.evaluate(n=>SND.instrumentation.sampleNotes>n,frozen.notes));await page.evaluate(()=>SND.setOn(false));assert.equal(await page.evaluate(()=>SND.sourceCount),0);assert.deepEqual(errors,[]);
 await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,frozen,passed:true,physicalDevice:false,auditoryReview:false,interruptionSimulated:true,errors},null,2));
 console.log('PASS real audio clock: paused fanfare survives wall timeout, resumes and returns to BGM, mute releases sources');
}finally{await browser.close();await app.close();}
