import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/title-focus'),report=[];
await mkdir(out,{recursive:true});const browser=await chromium.launch(browserOptions());
try{for(const device of ['standard','small','landscape','short','narrow','keyboard']){
 const options=['narrow','keyboard'].includes(device)?{...mobileOptions('small'),viewport:device==='narrow'?{width:320,height:640}:{width:360,height:440}}:mobileOptions(device),context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();
 const positions=[];
 for(const action of ['titleMusic','openSheet']){
  const button=action==='titleMusic'?page.locator('[data-a="titleMusic"]'):page.locator('.title-sound-row [data-k="settings"]');
  await page.evaluate(()=>window.scrollTo(0,0));await button.evaluate(el=>{el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest'});});
  const position=await button.evaluate(el=>{const r=el.getBoundingClientRect(),dock=document.querySelector('#dock').getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,dockTop:dock.top};});
  assert(position.top>=0&&position.bottom<=position.dockTop,`${device}: selected ${action} must remain above dock`);assert(position.width>=48&&position.height>=48);positions.push(position);
 }
 await page.screenshot({path:resolve(out,device+'.png')});assert.deepEqual(errors,[]);report.push({device,positions,passed:true});
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,report},null,2));}
console.log('PASS six title layouts: focused sound/settings buttons above dock, 48px targets');
