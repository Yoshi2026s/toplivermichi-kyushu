import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),results=[];
const out=resolve(root,'.task/pet-battle-fix');await mkdir(out,{recursive:true});
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(app.url,{waitUntil:'domcontentloaded'});await page.locator('[data-a="newGame"]').waitFor();
 await page.evaluate(()=>{SND.setOn(false);G.st=newGame('同行検査','男性');ensureVitals(G.st);G.screen='explore';G.sheet='pets';G.sheetData={};G.dlg=null;G.walk={path:[],prog:0,pending:null};G.st.settings.sound=false;G.st.petState.owned.PT02=petDefault('PT02');G.st.petState.companions=['PT01','PT02'];const o=MAPS[G.st.mapId].objects.find(o=>o.type==='petroom');G.st.pos={x:o.x,y:o.y+1};render();});
 assert.equal(await page.locator('#pet-supplies').count(),0);assert.equal(await page.locator('#pet-adoption').count(),0);
 await page.locator('[data-a="petView"][data-k="care"]').first().tap();assert.equal(await page.locator('[data-k="shop"]').count(),0);assert(await page.locator('[data-a="petFollowing"]').count());
 await page.evaluate(()=>{const o=MAPS[G.st.mapId].objects.find(o=>o.type==='petshop');G.st.pos={x:o.x,y:o.y+1};G.sheet='petShopHome';G.sheetData={};render();});
 await page.locator('#pet-supplies').tap();assert.equal(await page.locator('[data-k="care"]').count(),0);assert(await page.locator('[data-a="petBuy"]').count());
 await page.evaluate(()=>{G.sheet=null;render();});await page.waitForFunction(()=>petMapImages.size===2&&[...petMapImages.values()].every(i=>i.complete&&i.naturalWidth));
 assert.equal(await page.evaluate(()=>{const sprites=[];petMapFollowers(G.st,playerPixel(),2,sprites);return sprites.length;}),2);
 for(const [key,dx,dy] of [['ArrowDown',0,1],['ArrowUp',0,-1],['ArrowLeft',-1,0],['ArrowRight',1,0]]){
 const before=await page.evaluate(({dx,dy})=>{const m=MAPS[G.st.mapId];for(let y=2;y<m.h-2;y++)for(let x=2;x<m.w-2;x++)if(walkable(m,x,y)&&walkable(m,x+dx,y+dy)&&!objAt(m,x,y)&&!objAt(m,x+dx,y+dy)){G.st.pos={x,y};G.fol=null;G.walk={path:[],prog:0,pending:null};render();return {x,y};}}, {dx,dy});
 await page.locator('body').click({position:{x:2,y:2}});await page.keyboard.down(key);try{await page.waitForFunction(p=>G.st.pos.x!==p.x||G.st.pos.y!==p.y,before,{timeout:5000});}finally{await page.keyboard.up(key);}
 await page.waitForFunction(()=>!G.walk.path.length);assert.equal(await page.evaluate(()=>{const a=[];petMapFollowers(G.st,playerPixel(),2,a);return a.length;}),2);
 }
 if(device==='landscape'){
 await page.evaluate(()=>{for(const p of Object.values(petData(G.st).owned))p.name='ながいなまえのペットさん';render();});
 assert(await page.evaluate(()=>{const panel=document.querySelector('.pstrip'),dock=document.querySelector('#dock'),r=panel.getBoundingClientRect();return r.bottom<=dock.getBoundingClientRect().top+1&&r.height>48;}),'party panel stays above controls');
 assert(await page.evaluate(()=>{const panel=document.querySelector('.pstrip');panel.scrollTop=panel.scrollHeight;return panel.scrollTop>0&&document.querySelector('.pet-party').getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom+1;}),'all companion details remain reachable by scrolling');
 }
 assert.equal(await page.locator('.pet-party').count(),1);await page.screenshot({path:resolve(out,device+'-map.png')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.evaluate(async()=>{await commit();await saveChain;});await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-a="continue"]').tap();await page.waitForFunction(()=>G.screen==='explore');
 assert.deepEqual(await page.evaluate(()=>petData(G.st).companions),['PT01','PT02']);
 await page.evaluate(()=>{petData(G.st).companions=[];G.mapDrawKey='';render();});assert.equal(await page.locator('.pet-party').count(),0);
 assert.deepEqual(errors,[]);results.push({device,passed:true,mapSprites:2,facilities:true,saveReload:true});console.log('PASS pet battle fix '+device);await context.close();
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,results},null,2));}
