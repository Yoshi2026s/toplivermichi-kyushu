import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
await mkdir(resolve('.task'),{recursive:true});const layouts=[];
const server=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions());
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.url);await page.locator('[data-a="newGame"]').waitFor();
 await page.evaluate(()=>{G.st=newGame('長い名前の旅人','男性');G.st.settings.sound=false;G.st.run=createFieldRun(G.st,Object.keys(AREAS)[0],{count:1,picks:[0,0]});G.st.run.party[0].hp=3;G.screen='battle';G.cmd={};render();});
 await page.waitForTimeout(900);
 const art=await page.locator('.enemies .esprite').first().evaluate(e=>({height:e.getBoundingClientRect().height,stats:parseFloat(getComputedStyle(document.querySelector('.estat')).fontSize),background:getComputedStyle(e.closest('.ecard')).backgroundColor}));assert(art.height>=84,'enemy art is prominent');assert(art.stats<=12,'enemy numbers stay compact');assert.equal(art.background,'rgba(0, 0, 0, 0)','background remains visible behind enemy');
 const targets=await page.locator('.cmdgrid .btn,.stick-confirm,.dock-back').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,width:r.width,height:r.height};}));for(const t of targets)assert(t.width>=48&&t.height>=48,'48px primary touch target '+JSON.stringify(t));
 await page.evaluate(()=>scrollTo(0,0));
 const initial=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom};};return {viewport:innerHeight,dockTop:rect('.dock').top,enemies:rect('.enemies'),party:rect('.party'),commands:rect('.cmdgrid')};});
 if(['standard','small'].includes(device))for(const [name,rect]of Object.entries(initial).filter(([k])=>['enemies','party','commands'].includes(k)))assert(rect.top>=0&&rect.bottom<=initial.dockTop,name+' must be visible without scrolling in '+device+': '+JSON.stringify(initial));
 await page.screenshot({path:resolve('.task',`battle-initial-${device}.png`)});
 layouts.push({device,initial});
 assert.equal(await page.locator('.listener-comment').count(),1);
 assert.equal(await page.locator('.listener-comments').evaluate(e=>getComputedStyle(e).position),'static');
 assert(await page.locator('.pcard').first().evaluate(e=>e.scrollWidth<=e.clientWidth+1),'party text fits');
 await page.locator('[data-a="cmdType"][data-v="attack"]').tap();await page.locator('[data-a="cmdSet"][data-k="target"]').first().tap();await page.evaluate(()=>scrollTo(0,0));if(['standard','small'].includes(device)){const bounds=await page.evaluate(()=>({confirm:document.querySelector('[data-a="confirmAct"]').getBoundingClientRect().bottom,dock:document.querySelector('.dock').getBoundingClientRect().top}));assert(bounds.confirm<=bounds.dock,'selected attack confirm must fit without scroll '+JSON.stringify(bounds));}await page.locator('[data-a="confirmAct"]').scrollIntoViewIfNeeded();assert(await page.locator('[data-a="confirmAct"]').isEnabled());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 await page.screenshot({path:resolve('.task',`battle-readability-${device}.png`),fullPage:true});
 await page.locator('[data-a="autoOn"]').scrollIntoViewIfNeeded();await page.locator('[data-a="autoOn"]').tap();await page.locator('[data-a="autoOff"]').tap();assert.equal(await page.evaluate(()=>G.auto),false);assert.deepEqual(errors,[]);
 await page.evaluate(()=>{G.auto=false;clearTimeout(G.autoT);G.st.run=createBossRun(G.st,Object.keys(BOSSES)[0]);G.st.run.cue.active=true;G.cmd={actor:0,type:'attack',target:0};render();scrollTo(0,0);});
 if(['standard','small'].includes(device)){const boss=await page.evaluate(()=>({confirm:document.querySelector('[data-a="confirmAct"]').getBoundingClientRect().bottom,dock:document.querySelector('.dock').getBoundingClientRect().top}));assert(boss.confirm<=boss.dock,'boss telegraph and attack confirm fit without scrolling '+JSON.stringify(boss));layouts.at(-1).boss=boss;}
 await page.screenshot({path:resolve('.task',`battle-boss-${device}.png`)});
 await page.evaluate(()=>{G.auto=false;clearTimeout(G.autoT);G.st.run=null;G.st.lastResult={seq:1,kind:'field',turns:6,levelBefore:1,levelAfter:1,xp:23,gold:30,gifts:[],notes:[],members:[],itemsUsedKnown:true};G.screen='result';render();});
 await page.waitForTimeout(900);assert.equal(await page.locator('.listener-comment').count(),1);assert.equal(await page.locator('.result .listener-comments').count(),1);await page.locator('[data-a="resultDone"]').scrollIntoViewIfNeeded();await page.screenshot({path:resolve('.task',`result-readability-${device}.png`),fullPage:true});
 assert.deepEqual(errors,[]);await context.close();console.log('PASS readability '+device);
}}finally{await writeFile(resolve('.task/battle-viewport-layout.json'),JSON.stringify({url:server.url,mode:'browser-emulation',layouts},null,2)+'\n');await browser.close();await server.close();}
