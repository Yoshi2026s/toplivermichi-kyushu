import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/title-volume-state'),report=[];
await mkdir(out,{recursive:true});const browser=await chromium.launch(browserOptions());
try{for(const device of ['standard','small','landscape','short','narrow','keyboard']){
 const options=['narrow','keyboard'].includes(device)?{...mobileOptions('small'),viewport:device==='narrow'?{width:320,height:640}:{width:360,height:440}}:mobileOptions(device),context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();
 await page.evaluate(async()=>{G.st=newGame('音量検査','男性');G.st.settings.musicVolume=.25;G.st.settings.effectVolume=.5;await commit();});await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();
 assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.25,effects:.5});const saved=await page.evaluate(async()=>JSON.stringify((await loadSave()).state));
 await page.locator('.title-sound-row [data-k="settings"]').tap();
 assert.equal(await page.getByRole('button',{name:'BGM 25％',exact:true}).getAttribute('aria-pressed'),'true','title settings must display the effective saved music volume');
 assert.equal(await page.getByRole('button',{name:'効果音 50％',exact:true}).getAttribute('aria-pressed'),'true');
 const effect=page.getByRole('button',{name:'効果音 75％',exact:true});await effect.evaluate(el=>el.scrollIntoView({block:'center'}));const before=await page.locator('.sheet').evaluate(el=>el.scrollTop);await effect.press('Enter');
 assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.25,effects:.75},'changing effects must preserve the saved music volume');const after=await page.locator('.sheet').evaluate(el=>el.scrollTop);assert(Math.abs(after-before)<=1,'volume redraw must retain the settings reading position');assert.equal(await effect.evaluate(el=>document.activeElement===el),true);
 await page.getByRole('button',{name:'BGM 消音',exact:true}).tap();assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:0,effects:.75});await page.locator('[data-a="closeSheet"]').tap();await page.locator('[data-a="titleMusic"]').tap();await page.locator('.overlay').waitFor();assert.equal(await page.getByRole('button',{name:'BGM 消音',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(async()=>JSON.stringify((await loadSave()).state)),saved,'title adjustments do not overwrite an existing adventure');
 await page.locator('#toast').waitFor({state:'hidden'});await page.locator('.sound-volume').last().evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:resolve(out,device+'.png')});await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.25,effects:.5},'reload restores the unchanged saved adventure volumes');assert.deepEqual(errors,[]);report.push({device,before,after,passed:true});
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,auditoryReview:false,report},null,2));}
console.log('PASS six title volume layouts: saved/effective labels, independent changes, scroll/focus, zero-volume reopening, unchanged save and reload');
