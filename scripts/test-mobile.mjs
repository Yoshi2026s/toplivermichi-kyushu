import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,presets,mobileOptions,browserOptions,chromium,serveGame} from './mobile-runtime.mjs';

const dir=resolve(root,'.task/mobile/reports');
await mkdir(dir,{recursive:true});
const output=await mkdtemp(resolve(dir,'run-'));
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame();
const results=[];
const browser=browserOptions();
async function layout(page){
  const bounds=await page.evaluate(()=>({width:innerWidth,viewport:document.documentElement.clientWidth,scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),touch:navigator.maxTouchPoints}));
  assert(bounds.touch>0,'touch input is enabled');
  assert(bounds.scroll<=bounds.viewport+1,'page must not overflow horizontally: '+JSON.stringify(bounds));
}
async function closeDialogs(page){
  for(let i=0;i<60;i++){
    if(!await page.locator('#dlgNext').count())return;
    await page.locator('#dlgNext').tap();
  }
  throw Error('introductory dialogue did not finish');
}
try{
  // Server must not expose project files through the local preview URL.
  for(const path of (process.env.GAME_TEST_URL?[]:['.git/config','src/core.js','.task/mobile/preview.json']))assert.equal((await fetch(app.url+path)).status,404);
  for(const device of Object.keys(presets)){
    const errors=[],steps=[];
    let context,page;
    const profile=resolve(output,device+'-profile');
    const launch=()=>chromium.launchPersistentContext(profile,{...browser,...mobileOptions(device),reducedMotion:'reduce'});
    const observe=()=>page.on('pageerror',e=>errors.push(e.message));
    try{
      context=await launch();page=context.pages()[0]||await context.newPage();observe();
      await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
      await layout(page);
      assert.equal(await page.evaluate(()=>innerWidth),presets[device].viewport.width);
      await page.screenshot({path:resolve(output,device+'-title.png')});steps.push('title, viewport and touch capability');
      await page.locator('[data-a="newGame"]').tap();
      await page.locator('#nameInput').fill('動作検査');
      await page.locator('[data-a="pickGender"][data-v="男性"]').tap();
      await page.locator('[data-a="newNext"]').tap();
      await page.locator('#nameInput').fill('検査相棒');
      await page.locator('[data-a="newNext"]').tap();
      await page.locator('[data-a="startGame"]').tap();
      await page.waitForFunction(()=>G.screen==='explore'&&!G.starting);
      await closeDialogs(page);await page.locator('#map').waitFor();await layout(page);
      await page.screenshot({path:resolve(output,device+'-map.png')});steps.push('touch setup, start game and dialogue');
      await page.locator('[data-a="openSheet"][data-k="menu"]').tap();
      await page.locator('[data-a="openSheet"][data-k="settings"]').tap();await layout(page);
      await page.screenshot({path:resolve(output,device+'-settings.png')});
      const prior=await page.evaluate(()=>({name:G.st.profile.name,gold:G.st.gold,mapId:G.st.mapId,moveSpeed:G.st.settings.moveSpeed}));
      await page.locator('[data-a="moveSpeed"]').tap();
      await page.waitForFunction(()=>!systemOperationPending()&&G.saveStatus==='保存済み');
      const saved=await page.evaluate(()=>({name:G.st.profile.name,gold:G.st.gold,mapId:G.st.mapId,moveSpeed:G.st.settings.moveSpeed}));
      assert.notEqual(saved.moveSpeed,prior.moveSpeed);steps.push('menu, settings and saved change');
      await context.close();context=await launch();page=context.pages()[0]||await context.newPage();observe();
      await page.goto(app.url);await page.locator('[data-a="continue"]:enabled').waitFor();
      await page.locator('[data-a="continue"]').tap();await page.waitForFunction(()=>G.screen==='explore');
      const restored=await page.evaluate(()=>({name:G.st.profile.name,gold:G.st.gold,mapId:G.st.mapId,moveSpeed:G.st.settings.moveSpeed}));
      assert.deepEqual(restored,saved);steps.push('browser restart, IndexedDB save and continue');
      assert.deepEqual(errors,[],'no uncaught JavaScript errors');
      results.push({device,passed:true,steps,errors});console.log('PASS mobile '+device);
    }catch(e){
      if(page&&!page.isClosed())await page.screenshot({path:resolve(output,device+'-failure.png')}).catch(()=>{});
      results.push({device,passed:false,steps,error:e.stack,errors});console.error('FAIL mobile '+device+': '+e.message);
    }finally{await context?.close();}
  }
}finally{
  await app.close();
  const report={mode:'browser-emulation',physicalDevice:false,androidOS:false,browser:process.env.MOBILE_BROWSER||'chrome',generatedAtUTC:new Date().toISOString(),output,results};
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(resolve(dir,'latest.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(`${results.filter(r=>r.passed).length}/${Object.keys(presets).length} mobile profiles passed; reports: ${output}`);
if(results.length!==Object.keys(presets).length||results.some(r=>!r.passed))process.exitCode=1;
