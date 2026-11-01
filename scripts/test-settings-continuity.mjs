import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/settings-continuity'),browser=await chromium.launch(browserOptions()),report=[];await mkdir(out,{recursive:true});
try{for(const device of process.env.UI_DEVICE?[process.env.UI_DEVICE]:['standard','small','landscape','short','narrow','keyboard']){
 const options=['narrow','keyboard'].includes(device)?{...mobileOptions('small'),viewport:device==='narrow'?{width:320,height:640}:{width:360,height:440}}:mobileOptions(device),context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();await page.locator('.title-sound-row [data-k="settings"]').tap();
 const draft='復元前の確認用\n{"app":"toplivermichi-kyushu","text":"<b>貼り付け</b>"}';await page.locator('#restoreIn').fill(draft);await page.locator('#restoreIn').evaluate(el=>{el.focus();el.setSelectionRange(3,12);});
 await page.evaluate(()=>render());assert.equal(await page.locator('#restoreIn').inputValue(),draft,'redraw must preserve pasted backup');assert.deepEqual(await page.locator('#restoreIn').evaluate(el=>[document.activeElement===el,el.selectionStart,el.selectionEnd]),[true,3,12]);
 await page.locator('details.control-help > summary').tap();assert(await page.locator('details.control-help').evaluate(el=>el.open));
 for(const selector of ['[data-a="soundVolume"][data-k="musicVolume"][data-v="0.5"]','[data-a="toggleSound"]','[data-a="setOpt"][data-k="reduceMotion"]','[data-a="moveSpeed"]','[data-a="listenerToggle"]']){
  const control=page.locator(selector);await control.scrollIntoViewIfNeeded();await control.focus();const before=await page.locator('.sheet').evaluate(el=>el.scrollTop);await control.press('Enter');
  assert.equal(await page.locator('#restoreIn').inputValue(),draft);assert(await page.locator('details.control-help').evaluate(el=>el.open));assert(Math.abs(await page.locator('.sheet').evaluate(el=>el.scrollTop)-before)<=1,'settings redraw keeps reading position');assert(await page.locator(selector).evaluate(el=>document.activeElement===el),'changed option retains focus');
 }
 assert.equal(await page.locator('[data-k="reduceMotion"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-a="listenerToggle"]').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(async()=>await loadSave()),null,'settings draft never creates a save');
 assert.equal(await page.locator('#restoreIn b').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('#restoreIn').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,device+'.png')});await page.locator('[data-a="closeSheet"]').tap();await page.locator('.title-sound-row [data-k="settings"]').tap();assert.equal(await page.locator('#restoreIn').inputValue(),'','closing settings discards the unsubmitted draft');assert.deepEqual(errors,[]);report.push({device,passed:true});console.log('PASS settings continuity '+device);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,submittedRestore:false,report},null,2));}
