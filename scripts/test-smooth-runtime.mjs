import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/smooth-runtime');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('[data-a="newGame"]').waitFor();
 await page.evaluate(()=>{SND.setOn(false);G.st=newGame('動作確認','男性');ensureVitals(G.st);G.st.settings.reduceMotion=false;G.st.settings.listenerComments=false;G.screen='explore';G.sheet=null;G.dlg=null;G.walk={path:[],prog:0,pending:null};render();});
 const metrics=await page.evaluate(async()=>{
  // Static geometry must render identical pixels, without re-clearing the canvas.
  const cv=document.querySelector('#minimap'),m=MAPS[G.st.mapId],cam=camera();drawMiniMap(m,cam);const before=cv.toDataURL();let resets=0;const width=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width');Object.defineProperty(cv,'width',{configurable:true,get(){return width.get.call(this);},set(v){resets++;width.set.call(this,v);}});
  const times=[];for(let i=0;i<100;i++){const t=performance.now();drawMiniMap(m,cam);times.push(performance.now()-t);}const same=before===cv.toDataURL();delete cv.width;
  refreshHere();let mutations=0;const observer=new MutationObserver(list=>mutations+=list.length);observer.observe(document.querySelector('.here'),{subtree:true,childList:true,characterData:true});for(let i=0;i<20;i++)refreshHere();await Promise.resolve();observer.disconnect();
  const realDraw=drawMap;let draws=0;drawMap=function(){draws++;return realDraw();};await new Promise(r=>setTimeout(r,1000));drawMap=realDraw;
  return {same,resets,locationMutations:mutations,idleDraws:draws,cachedMiniMap100Ms:times.reduce((a,b)=>a+b,0)};
 });assert(metrics.same);assert.equal(metrics.resets,0);assert.equal(metrics.locationMutations,0);assert(metrics.idleDraws>0,'ambient remains animated');
 // A viewport resize must keep in-flight route, progress and pending interaction.
 const route=await page.evaluate(()=>{cancelAnimationFrame(G.raf);G.mapLoopToken++;const m=MAPS[G.st.mapId],p=G.st.pos,path=bfs(m,p.x,p.y,(x,y)=>Math.abs(x-p.x)+Math.abs(y-p.y)>=2,true);if(!path)throw Error('fixture needs a walkable route');G.walk={path,prog:.4,pending:{fixture:true}};G.lock=true;return JSON.stringify(G.walk);});
 const size=page.viewportSize();await page.setViewportSize({width:size.width,height:size.height-12});await page.waitForTimeout(220);assert.equal(await page.evaluate(()=>JSON.stringify(G.walk)),route,'resize preserves route and progress');await page.setViewportSize(size);await page.waitForTimeout(220);
 const destination=await page.evaluate(()=>{const last=G.walk.path.at(-1);G.walk.pending=null;G.lock=false;return last;});await page.waitForFunction(last=>G.st.pos.x===last.x&&G.st.pos.y===last.y&&!G.walk.path.length,destination);await page.evaluate(()=>render());
 for(const key of ['menu','guide','items','settings','pets']){await page.evaluate(key=>openSheet(key),key);await page.locator('.sheet').waitFor();await page.locator('.sheet-head [data-a="closeSheet"]').tap();assert.equal(await page.locator('.sheet').count(),0);}
 const battle=await page.evaluate(()=>{G.st.run=createFieldRun(G.st,'KY01-A1',{count:0,picks:[0,0]});G.screen='battle';G.cmd={};render();stopBattleTimer();G.st.settings.reduceMotion=true;drawEnemies();const cv=document.querySelector('canvas[data-enemy]'),ctx=cv.getContext('2d');let clears=0;const clear=ctx.clearRect;ctx.clearRect=function(...args){clears++;return clear.apply(this,args);};for(let i=0;i<20;i++)drawEnemies();const retained=clears===0;G.st.run.enemies.find(e=>e.slot===+cv.dataset.enemy).hp=0;drawEnemies();const empty=ctx.getImageData(0,0,cv.width,cv.height).data.every(v=>v===0);ctx.clearRect=clear;return {retained,empty,clears};});assert(battle.retained);assert(battle.empty);assert.equal(battle.clears,1);
 await page.screenshot({path:resolve(out,device+'-battle.png')});assert.deepEqual(errors,[]);report.push({device,metrics,battle,errors,resizeRoutePreserved:true,menuRoundTrips:5});console.log('PASS smooth runtime '+device);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,controlledFixtures:true,report},null,2));}
