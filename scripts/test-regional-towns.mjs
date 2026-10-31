import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/regional-qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();await page.evaluate(()=>Promise.all([WORLD_ART.loaded,SOFT_ART.loaded,document.fonts.ready]));
  const ids=device==='standard'?['KY01','KY02','KY03','KY04','KY05','KY06','KY07','KY08','NW01','NW13','NW14','NW17','NW22','NW26','NW38','NW44','NW45','NW46','NW47']:['NW01','NW26','NW44','NW47'];
  for(const id of ids){
   const info=await page.evaluate(id=>{G.st=newGame('街並み確認','男性');G.st.settings.sound=false;G.st.settings.reduceMotion=true;const m=MAPS[id];G.st.mapId=id;G.st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]};G.screen='explore';G.sheet=null;G.dlg=null;G.walk={path:[],prog:0,pending:null};G.fol={...G.st.pos};render();return {name:m.name,profile:m.regional.name,architecture:m.regional.architecture,overflow:document.documentElement.scrollWidth>innerWidth+1,stats:WORLD_ART.stats()};},id);
   assert.equal(info.overflow,false);assert(info.stats.bytes<=info.stats.limit);await page.screenshot({path:resolve(out,device+'-'+id+'.png')});report.push({device,id,...info});
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}console.log('PASS regional town styles in 19 cities and four mobile profiles, no runtime errors or overflow');
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,report},null,2)+'\n');await browser.close();await app.close();}
