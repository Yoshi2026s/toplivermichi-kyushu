import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),out=resolve(root,'.task/music-qa');await mkdir(out,{recursive:true});const browser=await chromium.launch(browserOptions()),report=[];
try{for(const device of ['standard','small']){const context=await browser.newContext(mobileOptions(device)),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(app.url);await page.locator('[data-a="newGame"]').waitFor();await page.locator('[data-a="newGame"]').tap();await page.waitForFunction(()=>SND.on&&SND.instrumentation.sampleNotes>0);assert(await page.evaluate(()=>SND.instrumentation.sampledInstruments>=11));
 const routing=[];for(const terrain of ['plain','forest','mountain','coast','river','lake'])for(const kind of ['town','field']){const actual=await page.evaluate(({kind,terrain})=>{G.st=newGame('音楽検査','男性');const id=Object.keys(MAPS).find(id=>MAPS[id].kind===kind&&MAPS[id].terrain===terrain);G.st.mapId=id;exploreBgm();return {id,current:SND.current,expected:SND.sceneForMap(MAPS[id]),sources:SND.sourceCount};},{kind,terrain});assert.equal(actual.current,actual.expected);assert(actual.sources>0&&actual.sources<=96);routing.push(actual);}
 await page.evaluate(()=>{const m=Object.values(MAPS).find(m=>m.combatDomain==='sea');G.st.mapId=Object.keys(MAPS).find(id=>MAPS[id]===m);exploreBgm();});assert((await page.evaluate(()=>SND.current)).startsWith('sea_RG'));
 await page.evaluate(()=>{SND.play('battle');SND.setVolumes(.25,.75);});assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:.25,effects:.75});
 await page.evaluate(()=>SND.suspend());assert.equal(await page.evaluate(()=>SND.sourceCount),0);await page.evaluate(()=>SND.resume());await page.waitForFunction(()=>SND.sourceCount>0);
 await page.evaluate(()=>SND.setOn(false));assert.equal(await page.evaluate(()=>SND.sourceCount),0);await page.evaluate(()=>SND.setOn(true));await page.waitForFunction(()=>SND.sourceCount>0);
 await page.evaluate(()=>{SND.setVolumes(0,1);SND.sfx('heal');});assert.deepEqual(await page.evaluate(()=>SND.volumes),{music:0,effects:1});await page.evaluate(()=>{SND.setOn(false);});assert.equal(await page.evaluate(()=>SND.sourceCount),0);assert.deepEqual(errors,[]);
 report.push({device,routing,scores:await page.evaluate(()=>SND.scores),instrumentation:await page.evaluate(()=>SND.instrumentation),muteAndResume:true,errors});
 }finally{await context.close();}}console.log('PASS real AudioContext acoustic playback, 12 terrain routes, sea route, independent volume, mute and suspend/resume at two mobile sizes');
}finally{await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,auditoryReview:false,report},null,2));await browser.close();await app.close();}
