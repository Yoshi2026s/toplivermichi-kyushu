import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,browserOptions,mobileOptions,serveGame,root} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame();
const out=resolve(root,'.task/result-overview');await mkdir(out,{recursive:true});
const browser=await chromium.launch(browserOptions()),results=[];
try{for(const device of ['standard','small','landscape','short']){
 const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
 for(const kind of ['normal','levelup','boss','legacy','full-party','large-reward','quest','empty','combined']){
  await page.evaluate(kind=>{G.st=newGame('長い名前の旅人','男性');G.st.settings.sound=false;G.st.settings.reduceMotion=true;ensureVitals(G.st);const st=G.st;if(kind==='levelup'||kind==='combined'){st.xp=xpFor(2);ensureVitals(st);}if(kind==='full-party'||kind==='combined'){for(const cid of Object.keys(CHARS).filter(c=>!st.roster.includes(c)).slice(0,2))joinMember(st,cid);ensureVitals(st);}
   st.lastResult={seq:1,kind:kind==='boss'?'boss':'field',turns:12,levelBefore:1,levelAfter:kind==='levelup'?2:1,xp:123,gold:456,gifts:[],notes:['技能・装備の効果量が上昇'],newBadges:Object.keys(ITEM_BADGES).slice(0,4),itemsUsedKnown:kind!=='legacy',enemies:[{name:'メーターキングと長い名前のノイズ体'}],members:st.party.map(cid=>({cid,maxBefore:52,maxAfter:kind==='levelup'?58:52})),jp:st.party.map(cid=>({cid,gain:12,R0:1,R1:2}))};
   if(kind==='large-reward'){st.lastResult.xp=99999999;st.lastResult.gold=999999999;st.gold=9999999999;}if(kind==='quest')st.lastResult.quest='M01';if(kind==='empty')st.lastResult.members=[];
   if(kind==='combined'){st.lastResult.kind='boss';st.lastResult.quest='M01';st.lastResult.levelBefore=1;st.lastResult.levelAfter=2;for(const m of st.lastResult.members)m.maxAfter=m.maxBefore+6;}
   st.vitals[st.party[0]].hp=1;st.vitals[st.party[1]].hp=0;G.screen='result';G.sheet=null;G.dlg=null;render();scrollTo(0,0);
  },kind);await page.waitForTimeout(100);
  const bounds=await page.evaluate(()=>{const b=document.querySelector('[data-a="resultDone"]').getBoundingClientRect(),d=document.querySelector('.dock').getBoundingClientRect(),r=document.querySelector('.result').getBoundingClientRect();return {button:{top:b.top,bottom:b.bottom,height:b.height},dock:d.top,resultBottom:r.bottom,scroll:document.documentElement.scrollWidth,width:innerWidth};});
  assert(bounds.button.top>=0&&bounds.button.bottom<=bounds.dock,device+' '+kind+' return visible '+JSON.stringify(bounds));assert(bounds.button.height>=48);assert(bounds.resultBottom<=bounds.dock,device+' '+kind+' overview fits '+JSON.stringify(bounds));assert(bounds.scroll<=bounds.width+1);
  assert.equal(await page.locator('.result-details[open]').count(),0);assert.equal(await page.locator('.rmem.low').count(),2);assert(await page.locator('.rvitals').nth(1).textContent().then(t=>t.includes('戦闘不能')));
  await page.screenshot({path:resolve(out,device+'-'+kind+'.png')});
  await page.locator('.result-details>summary').tap();assert(await page.locator('.result-details').textContent().then(t=>t.includes(kind==='legacy'?'使用記録がありません':'道具は使いませんでした')));await page.locator('.result-details>summary').tap();
  await page.locator('[data-a="resultDone"]').tap();await page.waitForFunction(()=>G.screen==='explore');assert.equal(await page.locator('#map').count(),1,JSON.stringify(await page.evaluate(()=>({screen:G.screen,sheet:G.sheet,dlg:!!G.dlg,html:document.querySelector('#screen').innerHTML.slice(0,300)}))));results.push({device,kind,passed:true,bounds});
 }
 assert.deepEqual(errors,[]);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({mode:'browser-emulation',physicalDevice:false,url:app.url,results},null,2));}
console.log('PASS '+results.length+' result scenarios: summary fits, 48px one-click MAP return, low/KO and legacy history');
