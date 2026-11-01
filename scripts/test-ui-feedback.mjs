import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/ui-feedback'),browser=await chromium.launch(browserOptions()),report=[];
await mkdir(out,{recursive:true});
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
  const message='保存できませんでした。<b>確認してください</b>';
  await page.evaluate(message=>{toast(message);window.feedbackElement=document.querySelector('#toast');render();render();},message);
  assert.equal(await page.locator('#toast').count(),1);assert(await page.locator('#toast').isVisible(),'redraw retains the active notification');assert.equal(await page.locator('#toast').innerText(),message);assert.equal(await page.locator('#toast b').count(),0);
  assert(await page.evaluate(()=>document.querySelector('#toast')===window.feedbackElement),'notification element remains stable across renders');
  await page.evaluate(()=>{G.st=newGame('通知検査','男性');G.screen='explore';render();toast('画面を切り替えても確認できます。');G.st.run=createFieldRun(G.st,'KY01-A1',{count:1,picks:[0,0]});G.screen='battle';G.cmd={};render();});
  assert(await page.locator('#toast').isVisible());assert.equal(await page.locator('#toast').innerText(),'画面を切り替えても確認できます。');assert(await page.locator('#toast').evaluate(e=>getComputedStyle(e).pointerEvents==='none'),'notification never intercepts game controls');
  await page.screenshot({path:resolve(out,device+'.png')});
  await page.waitForFunction(()=>document.querySelector('#toast').hidden,{timeout:6000});
  await page.evaluate(()=>render());assert(await page.locator('#toast').isHidden(),'expired notification does not reappear');assert.deepEqual(errors,[]);report.push({device,passed:true});console.log('PASS UI feedback '+device);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,controlledFixtures:true,report},null,2));}
