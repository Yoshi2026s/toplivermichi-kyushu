import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),out=resolve(root,'.task/result-reading'),report=[];await mkdir(out,{recursive:true});
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
  await page.evaluate(()=>{G.st=newGame('結果検査','男性');G.st.settings.sound=false;G.st.settings.reduceMotion=true;ensureVitals(G.st);const st=G.st;st.lastResult={seq:1,kind:'field',turns:12,levelBefore:1,levelAfter:1,xp:123,gold:456,gifts:[],notes:Array.from({length:30},(_,i)=>'検査した戦闘の記録 '+i),newBadges:[],itemsUsedKnown:true,enemies:[{name:'エールスライム'}],members:st.party.map(cid=>({cid,maxBefore:52,maxAfter:52})),jp:[]};G.screen='result';G.sheet=null;G.dlg=null;render();});
  await page.locator('.result-details>summary').tap();await page.evaluate(()=>scrollTo(0,Math.min(450,document.documentElement.scrollHeight-innerHeight)));const before=await page.evaluate(()=>scrollY);assert(before>40);
  await page.evaluate(()=>{openSheet('settings');closeSheet();});const after=await page.evaluate(()=>scrollY);assert(Math.abs(before-after)<3,'returning from a sheet preserves the result reading position');assert(await page.locator('.result-details').evaluate(e=>e.open),'expanded result details stay open');
  const unchanged=await page.evaluate(()=>JSON.stringify(G.st.lastResult));await page.evaluate(()=>render());assert.equal(await page.evaluate(()=>JSON.stringify(G.st.lastResult)),unchanged);assert(Math.abs(await page.evaluate(()=>scrollY)-after)<3,'redraw keeps the result reading position');
  await page.screenshot({path:resolve(out,device+'.png')});
  await page.evaluate(()=>{G.st.lastResult={...G.st.lastResult,seq:2};render();});assert.equal(await page.evaluate(()=>scrollY),0,'a new result opens at the beginning');assert.equal(await page.locator('.result-details').evaluate(e=>e.open),false);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.a),'resultDone');assert.deepEqual(errors,[]);report.push({device,before,after,passed:true});console.log('PASS result reading '+device);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,controlledFixtures:true,report},null,2));}
