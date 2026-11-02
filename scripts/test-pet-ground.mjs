import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,chromium,browserOptions,mobileOptions,serveGame} from './mobile-runtime.mjs';
const app=process.env.GAME_TEST_URL?{url:process.env.GAME_TEST_URL,close:async()=>{}}:await serveGame(),browser=await chromium.launch(browserOptions()),results=[];
const out=resolve(root,'.task/pet-ground-browser');await mkdir(out,{recursive:true});
try{for(const device of ['standard','small','landscape','short','narrow','keyboard']){
 const options=mobileOptions(['narrow','keyboard'].includes(device)?'standard':device);
 if(device==='narrow')options.viewport={width:320,height:568};if(device==='keyboard')options.viewport={width:393,height:360};
 const context=await browser.newContext(options),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(app.url,{waitUntil:'domcontentloaded',timeout:90000});await page.locator('[data-a="newGame"]').waitFor();await page.waitForFunction(()=>SOFT_ART.ready('pets')&&SOFT_ART.ready('petsRear'));
 await page.evaluate(()=>{SND.setOn(false);G.st=newGame('足元確認','男性');ensureVitals(G.st);G.st.settings.sound=false;G.st.petState.owned.PT02=petDefault('PT02');G.st.petState.companions=['PT01','PT02'];for(const p of Object.values(G.st.petState.owned))p.bond=PET_GROWTH_THRESHOLDS[2];G.screen='explore';G.sheet=null;G.dlg=null;G.walk={path:[],prog:0,pending:null};
 const m=MAPS[G.st.mapId];let spot;for(let y=Math.floor(m.h/2);y<m.h-2&&!spot;y++)for(let x=6;x<m.w-2&&!spot;x++)if([0,1,2,3].every(i=>walkable(m,x-i,y)&&!objAt(m,x-i,y)))spot={x,y};if(!spot)throw Error('No open ground');
 G.st.pos=spot;G.st.dir=3;G.partyTrail={state:G.st,map:G.st.mapId,last:{...spot},points:[1,2,3].map(i=>({x:spot.x-i,y:spot.y}))};render();});
 for(const dir of [0,1,2,3]){
 const count=await page.evaluate(dir=>{const t=partyTrail(G.st),[dx,dy]=[[0,1],[0,-1],[-1,0],[1,0]][dir];for(let i=0;i<t.points.length;i++)t.points[i]={x:G.st.pos.x-dx*(i+1),y:G.st.pos.y-dy*(i+1)};G.st.dir=dir;const sprites=[];petMapFollowers(G.st,playerPixel(),0,sprites);for(const s of sprites){const c=s.img;if(c.direction!==dir)throw Error('Wrong direction');const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let bottom=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>=128)bottom=y+1;if(c.mapFootY!==bottom)throw Error('Floating feet');}drawMap();return sprites.length;},dir);assert.equal(count,2);
 }
 await page.screenshot({path:resolve(out,device+'.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 results.push({device,passed:true,pets:2});await context.close();console.log('PASS pet ground browser '+device);
}}finally{await browser.close();await app.close();await writeFile(resolve(out,'report.json'),JSON.stringify({url:app.url,physicalDevice:false,results},null,2));}
