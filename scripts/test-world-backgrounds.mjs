import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/world-qa');await mkdir(out,{recursive:true});const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short']){const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();await page.evaluate(()=>WORLD_ART.loaded);assert(await page.evaluate(()=>WORLD_ART.ready()));
 const terrains=device==='standard'?['plain','coast','forest','mountain','river','lake']:['forest'];
 for(const terrain of terrains)for(const kind of ['town','field']){
  const info=await page.evaluate(({terrain,kind})=>{G.st=newGame('背景検査','男性');G.st.settings.sound=false;G.st.settings.reduceMotion=true;const id=Object.keys(MAPS).find(id=>MAPS[id].terrain===terrain&&MAPS[id].kind===kind),m=MAPS[id];G.st.mapId=id;G.st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]};G.screen='explore';G.dlg=null;G.sheet=null;G.walk={path:[],prog:0,pending:null};G.fol={...G.st.pos};render();const c=ART.mapLayer(id,0);return {id,ratio:c.artScale,stats:WORLD_ART.stats(),overflow:document.documentElement.scrollWidth>innerWidth+1};},{terrain,kind});assert.equal(info.ratio,4);assert.equal(info.overflow,false);assert(info.stats.bytes<=info.stats.limit);await page.screenshot({path:resolve(out,`${device}-${terrain}-${kind}.png`)});report.push({device,terrain,kind,...info});
 }
 for(const terrain of ['plain','coast','forest','mountain']){
  await page.evaluate(terrain=>{const id=Object.keys(MAPS).find(id=>MAPS[id].kind==='field'&&MAPS[id].terrain===terrain),m=MAPS[id];G.st.mapId=id;G.st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]};const area=Object.values(m.zones)[0]||Object.keys(AREAS)[0];G.st.run=createFieldRun(G.st,area,{count:1,picks:[0,0]});G.screen='battle';G.cmd={};render();scrollTo(0,0);},terrain);
  const stage=await page.locator('.enemies').evaluate(async el=>{const css=getComputedStyle(el),src=css.backgroundImage.match(/url\("?([^"\)]+)"?\)/)[1],img=new Image();img.src=src;await img.decode();const r=el.getBoundingClientRect();return {terrain:el.dataset.terrain,imageWidth:img.naturalWidth,height:r.height,hiddenLegacy:getComputedStyle(el.querySelector('.stagebg')).display};});assert.equal(stage.terrain,terrain);assert.equal(stage.imageWidth,1440);assert.equal(stage.hiddenLegacy,'none');await page.screenshot({path:resolve(out,`${device}-battle-${terrain}.png`)});report.push({device,stage});
 }
 const sea=await page.evaluate(()=>{G.st.run=null;const id=Object.keys(MAPS).find(id=>MAPS[id].combatDomain==='sea'),m=MAPS[id];G.st.mapId=id;G.st.pos={x:3,y:3};G.screen='explore';G.walk={path:[],prog:0,pending:null};G.fol={...G.st.pos};render();return {ratio:ART.mapLayer(id,0).artScale};});assert.equal(sea.ratio,4);await page.screenshot({path:resolve(out,`${device}-sea-field.png`)});
 await page.evaluate(()=>{const route=OCEAN_ROUTES[MAPS[G.st.mapId].oceanRoute];G.st.run=createOceanRun(G.st,route.areas[0],{count:1,picks:[0,0]});G.screen='battle';G.cmd={};render();});assert.equal(await page.locator('.enemies').getAttribute('data-terrain'),'coast');report.push({device,seaMapAndBattle:true});
 assert.deepEqual(errors,[]);
 }finally{await context.close();}}console.log('PASS painted town/field/battle backgrounds, six terrains, four battle images and four mobile profiles');
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,report},null,2));await browser.close();await app.close();}
