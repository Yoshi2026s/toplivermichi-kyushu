import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const server=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions());
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.url);await page.waitForFunction(()=>typeof G!=='undefined');
 await page.evaluate(()=>{G.st=newGame('長い名前の旅人','男性');G.st.settings.sound=false;G.st.run=createFieldRun(G.st,Object.keys(AREAS)[0],{count:1,picks:[0,0]});G.st.run.party[0].hp=3;G.screen='battle';G.cmd={};render();});
 await page.waitForTimeout(900);
 assert.equal(await page.locator('.listener-comment').count(),1);
 assert.equal(await page.locator('.listener-comments').evaluate(e=>getComputedStyle(e).position),'static');
 assert(await page.locator('.pcard').first().evaluate(e=>e.scrollWidth<=e.clientWidth+1),'party text fits');
 await page.locator('[data-a="cmdType"][data-v="attack"]').tap();await page.locator('[data-a="cmdSet"][data-k="target"]').first().tap();await page.locator('[data-a="confirmAct"]').scrollIntoViewIfNeeded();assert(await page.locator('[data-a="confirmAct"]').isEnabled());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 await page.screenshot({path:resolve('.task',`battle-readability-${device}.png`),fullPage:true});
 await page.locator('[data-a="autoOn"]').scrollIntoViewIfNeeded();await page.locator('[data-a="autoOn"]').tap();await page.locator('[data-a="autoOff"]').tap();assert.equal(await page.evaluate(()=>G.auto),false);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{G.auto=false;clearTimeout(G.autoT);G.st.run=null;G.st.lastResult={seq:1,kind:'field',turns:6,levelBefore:1,levelAfter:1,xp:23,gold:30,gifts:[],notes:[],members:[],itemsUsedKnown:true};G.screen='result';render();});
 await page.waitForTimeout(900);assert.equal(await page.locator('.listener-comment').count(),1);assert.equal(await page.locator('.result .listener-comments').count(),1);await page.locator('[data-a="resultDone"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve('.task',`result-readability-${device}.png`),fullPage:true});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS readability '+device);
}}finally{await browser.close();await server.close();}
