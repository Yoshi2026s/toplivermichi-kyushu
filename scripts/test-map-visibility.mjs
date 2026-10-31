import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/map-visibility');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:120000});await page.locator('[data-a="newGame"]').waitFor();
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(async()=>{SND.setOn(false);G.st=newGame('描画確認','男性');ensureVitals(G.st);G.st.settings.reduceMotion=false;G.st.settings.listenerComments=false;G.st.petState.owned.PT02=petDefault('PT02');G.st.petState.companions=['PT01','PT02'];G.screen='explore';G.sheet=null;G.dlg=null;G.walk={path:[],prog:0,pending:null};render();await Promise.all([...petMapImages.values()].map(i=>i.decode()));});
 const media=await page.evaluate(()=>{const original=window.matchMedia;let queries=0;window.matchMedia=function(q){queries++;return original.call(this,q);};delete reducedMotion.preference;for(let i=0;i<1000;i++)reducedMotion();window.matchMedia=original;return {queries};});assert.equal(media.queries,1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>reducedMotion()===true);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>reducedMotion()===false);assert(await page.evaluate(()=>{G.st.settings.reduceMotion=true;const yes=reducedMotion();G.st.settings.reduceMotion=false;return yes;}));
 const cases=await page.evaluate(()=>{
  const towns=Object.keys(MAPS).filter(id=>MAPS[id].kind==='town'),fields=Object.keys(MAPS).filter(id=>MAPS[id].kind==='field'&&MAPS[id].combatDomain!=='sea'),sea=Object.keys(MAPS).find(id=>MAPS[id].combatDomain==='sea'),ids=[...new Set([towns[0],fields[0],towns.at(-1),fields.at(-1),sea])],rows=[];
  const visible=mapObjectVisible,person=ART.person,object=ART.object,boss=bossBaseSprite;let requests=0;ART.person=function(...a){requests++;return person.apply(this,a);};ART.object=function(...a){requests++;return object.apply(this,a);};bossBaseSprite=function(){requests++;return boss();};Object.defineProperty(performance,'now',{configurable:true,value:()=>500});
  try{for(const id of ids){const m=MAPS[id];G.st.mapId=id;G.st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]};G.fol=null;G.lock=true;render();cancelAnimationFrame(G.raf);G.mapLoopToken++;
   // Start each reference/optimized draw with the same canvas state, including shadows.
   for(const p of [m.safeAnchor,[1,1],[m.w-2,m.h-2]]){G.st.pos={x:p[0],y:p[1]};const cv=G.cv,g=cv.getContext('2d');mapObjectVisible=()=>true;cv.width=cv.width;requests=0;drawMap();const allRequests=requests,all=g.getImageData(0,0,cv.width,cv.height).data;mapObjectVisible=visible;cv.width=cv.width;requests=0;drawMap();const optimizedRequests=requests,culled=g.getImageData(0,0,cv.width,cv.height).data;let matched=all.length===culled.length;for(let i=0;matched&&i<all.length;i++)if(all[i]!==culled[i])matched=false;rows.push({id,position:p,matched,allRequests,optimizedRequests});}
  }}finally{mapObjectVisible=visible;ART.person=person;ART.object=object;bossBaseSprite=boss;delete performance.now;G.lock=false;}
  return rows;
 });for(const row of cases){assert(row.matched,device+' sprite/edge/shadow pixels '+JSON.stringify(row));assert(row.optimizedRequests<=row.allRequests);}const totals=cases.reduce((a,c)=>({all:a.all+c.allRequests,optimized:a.optimized+c.optimizedRequests}),{all:0,optimized:0});assert(totals.optimized<totals.all,'offscreen sprite factory work is reduced');await page.screenshot({path:resolve(out,device+'-map.png')});assert.deepEqual(errors,[]);report.push({device,media,osChangeFollowed:true,gameOverride:true,cases,totals,errors});console.log('PASS map visibility '+device+' '+cases.length+' pixel comparisons; sprite requests '+totals.all+' -> '+totals.optimized);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,controlledFixtures:true,comparison:'same map/time/camera with and without offscreen culling',report},null,2));}
