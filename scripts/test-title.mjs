import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/title-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short']){const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();await page.evaluate(()=>document.fonts.ready);
 const detail=await page.evaluate(async()=>{const cv=document.querySelector('#titleArt'),logo=document.querySelector('.logo'),style=getComputedStyle(cv),image=new Image();image.src=style.backgroundImage.slice(5,-2);await image.decode();const r=logo.getBoundingClientRect(),v=document.querySelector('.title-visual').getBoundingClientRect();return {imageWidth:image.naturalWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,logoInside:r.x>=v.x&&r.right<=v.right&&r.bottom<=v.bottom,animation:getComputedStyle(logo.querySelector('.main>span')).animationName,height:parseFloat(style.height),innerHeight,startBottom:document.querySelector('[data-a="newGame"]').getBoundingClientRect().bottom,dockTop:document.querySelector('#dock').getBoundingClientRect().top,source:SND.current};});
 if(device==='landscape'){assert(detail.height<=200,'short-screen title height must override legacy CSS');assert(detail.startBottom<=detail.dockTop,'start stays above dock');}assert.equal(detail.imageWidth,1440);assert.equal(detail.overflow,false);assert.equal(detail.logoInside,true);assert.equal(detail.animation,'title-gilding');assert.equal(detail.source,'title');
 await page.screenshot({path:resolve(out,'title-'+device+'.png'),fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.logo .main>span').first().evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.title-sparkles').evaluate(e=>getComputedStyle(e).display),'none');
 await page.locator('[data-a="openSheet"][data-k="settings"]').tap();await page.locator('[data-a="closeSheet"]').tap();await page.locator('[data-a="newGame"]').tap();await page.locator('#nameInput').waitFor();assert.deepEqual(errors,[]);report.push({device,...detail,reducedMotion:true,settingsAndNewGame:true,errors});
 }finally{await context.close();}}console.log('PASS title art, logo bounds, animations, reduced motion, settings and start at four mobile sizes');
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,report},null,2));await browser.close();await app.close();}
