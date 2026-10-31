import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/title-autoplay');await mkdir(out,{recursive:true});const report=[];
try{for(const policy of ['no-user-gesture-required','document-user-activation-required']){
 const options=browserOptions(),browser=await chromium.launch({...options,args:[...options.args,'--autoplay-policy='+policy]});
 try{for(const muted of [false,true]){const context=await browser.newContext(mobileOptions('small'));await context.addInitScript(muted=>{if(muted)localStorage.setItem('tlr-kyushu-sound','0');},muted);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url);const cdp=await context.newCDPSession(page);const read=async()=>{const r=await cdp.send('Runtime.evaluate',{expression:JSON.stringify('')+";JSON.stringify(typeof SND!=='undefined'&&document.querySelector('[data-a=\"titleMusic\"]')?({on:SND.on,playing:SND.playing,current:SND.current,notes:SND.instrumentation.sampleNotes,label:document.querySelector('[data-a=\"titleMusic\"]').textContent}):null)",returnByValue:true,userGesture:false});return JSON.parse(r.result.value);};let initial;for(let i=0;i<100;i++){initial=await read();if(initial)break;await new Promise(r=>setTimeout(r,100));}assert(initial,'title must finish booting');await new Promise(r=>setTimeout(r,500));initial=await read();
 if(muted){assert.equal(initial.on,false);assert.equal(initial.playing,false);await page.locator('.title-visual').tap();assert.equal(await page.evaluate(()=>SND.on),false);}
 else if(policy==='no-user-gesture-required'){assert.equal(initial.playing,true,'autoplay allowed: sound starts without any tap');assert(initial.notes>0);}
 else{assert.equal(initial.on,true);assert.equal(initial.playing,false,'blocked autoplay is not reported as playing');assert(!initial.label.includes('再生中'));await page.locator('.title-visual').tap();await page.waitForFunction(()=>SND.playing&&SND.instrumentation.sampleNotes>0);}
 assert.equal(await page.evaluate(()=>G.screen),'title');assert.deepEqual(errors,[]);report.push({policy,muted,initial,passed:true});
 }finally{await context.close();}}
 }finally{await browser.close();}
}}finally{await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,policySimulation:true,report},null,2));}
console.log('PASS title autoplay: no-tap playback when allowed, truthful blocked state, arbitrary touch fallback and persistent mute under both browser policies');
