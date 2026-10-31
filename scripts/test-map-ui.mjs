import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame();
const out=resolve(import.meta.dirname,'../.task/map-ui-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),results=[];
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(app.url);await page.waitForFunction(()=>typeof G!=='undefined'&&typeof WORLD_ART!=='undefined');
 await page.evaluate(async()=>{await Promise.all([SOFT_ART.loaded,WORLD_ART.loaded]);G.st=newGame('表示確認','男性');G.screen='explore';render();});
 await page.waitForTimeout(250);
 const bounds=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,back:rect(document.querySelector('.dock-back')),stick:rect(document.querySelector('.stick')),buttons:[...document.querySelectorAll('.dock-actions button,.dock-back,.stick')].map(rect),party:rect(document.querySelector('.partymini')||document.querySelector('.explore').lastElementChild),dock:rect(document.querySelector('.dock')),mini:rect(document.querySelector('#minimap'))};});
 assert(bounds.scroll<=bounds.width+1);for(const b of bounds.buttons){assert(b.w>=48&&b.h>=48);assert(b.x>=0&&b.right<=bounds.width+1&&b.y>=bounds.dock.y&&b.bottom<=bounds.height+1,JSON.stringify({device,b,bounds}));}
 assert(bounds.back.right<=bounds.stick.x,'back left and confirm stick right, matching reference');
 await page.screenshot({path:resolve(out,device+'-town.png')});
 await page.locator('.dock-actions [data-k="guide"]').tap();await page.locator('[role="dialog"]').waitFor();await page.screenshot({path:resolve(out,device+'-guide.png')});await page.locator('[data-pad="back"]').tap();
 await page.evaluate(()=>{const m=MAPS[HUBS[curHub()].fieldMap];G.st.mapId=HUBS[curHub()].fieldMap;const boss=m.objects.find(o=>o.type==='boss');G.st.pos={x:boss.x,y:boss.y+3};G.fol=null;render();});await page.waitForTimeout(180);await page.screenshot({path:resolve(out,device+'-field.png')});
 assert.deepEqual(errors,[]);results.push({device,passed:true,bounds});
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({mode:'browser-emulation',physicalDevice:false,url:app.url,results},null,2));}
console.log('PASS final MAP UI: '+results.length+' sizes, controls >=48px, no dock clipping, guide/back and boss map');
