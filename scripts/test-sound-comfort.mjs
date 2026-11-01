import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/sound-comfort');
await mkdir(out,{recursive:true});const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small','landscape','short','narrow']){
 const options=device==='narrow'?{...mobileOptions('small'),viewport:{width:320,height:640}}:mobileOptions(device),context=await browser.newContext(options),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();
  await page.locator('[data-a="openSheet"][data-k="settings"]').first().tap();
  assert.equal(await page.locator('.sound-volume').count(),2);
  assert(await page.locator('.sound-volume').first().evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#restoreIn'))&Node.DOCUMENT_POSITION_FOLLOWING)),'audio controls precede unrelated restore fields');
  const sizes=await page.locator('.sound-volume button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,label:b.getAttribute('aria-label')};}));
  assert(sizes.every(r=>r.width>=48&&r.height>=48&&r.label));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'BGM 50％',exact:true}).tap();
  assert.equal(await page.getByRole('button',{name:'BGM 50％',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'BGM 50％');
  await page.getByRole('button',{name:'BGM 50％',exact:true}).press('Tab');
  await page.getByRole('button',{name:'BGM 75％',exact:true}).press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'BGM 75％');
  await page.getByRole('button',{name:'BGM 50％',exact:true}).tap();
  await page.getByRole('button',{name:'効果音 消音',exact:true}).tap();
  assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.5,effects:0});
  assert.equal(await page.locator('.sound-volume [aria-pressed="true"]').count(),2);
  await page.locator('.sound-volume').last().scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(out,device+'.png'),fullPage:true});
  await page.evaluate(()=>{SND.setOn(true);SND.play('field');SND.sfx('damage');});
  const muted=await page.evaluate(()=>SND.sourceCount);assert(muted>0&&muted<=96);
  await page.getByRole('button',{name:'効果音 75％',exact:true}).tap();
  const burst=await page.evaluate(()=>{const before=SND.sourceCount;for(let i=0;i<100;i++)SND.sfx('ok');return SND.sourceCount-before;});assert(burst>=1&&burst<=2);
  await page.evaluate(()=>{SND.setOn(false);});assert.equal(await page.evaluate(()=>SND.sourceCount),0);
  assert.deepEqual(errors,[]);report.push({device,sizes,burst,errors});console.log('PASS sound comfort '+device);
 }finally{await context.close();}
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,auditoryReview:false,report},null,2));}
