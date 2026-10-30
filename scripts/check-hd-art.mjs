import assert from 'node:assert/strict';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{runInNewContext}from'node:vm';import{createCanvas}from'./canvas-runtime.mjs';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');const files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const code=files.slice(0,files.indexOf('art_detail.js')+1).map(n=>read('src/'+n)).join('\n');
const {ART,ART_HD,MAPS}=runInNewContext(code+'\n({ART,ART_HD,MAPS})',{document:{createElement:()=>createCanvas(1,1)}});
const sheet=createCanvas(960,720),g=sheet.getContext('2d');g.fillStyle='#192c38';g.fillRect(0,0,960,720);g.imageSmoothingEnabled=false;
const ids=Object.keys(MAPS);const layer=ART.mapLayer(ids[0],0);assert.equal(layer.width,MAPS[ids[0]].w*32);assert.equal(layer.artScale,2);g.drawImage(layer,0,0,Math.min(640,layer.width),Math.min(400,layer.height),0,0,640,400);
for(let i=0;i<8;i++){const c=ART.person('hero'+i,'#775441','#51928b',i%4,i%4,{long:i%2});assert.equal(c.width,32);assert.equal(c.height,48);g.drawImage(c,660+i%4*70,25+Math.floor(i/4)*120,64,96);}
for(let i=0;i<12;i++){const c=ART.enemy('HD'+i,['水紋体','反響体','機材体','灯籠体'][i%4],['熱','水','無'][i%3],'A1',i%2,128,i>7);assert.equal(c.width,128);g.drawImage(c,i%6*160,420+Math.floor(i/6)*145,128,128);}
const ui=read('src/ui.js'),tap=ui.slice(ui.indexOf('function onMapTap('),ui.indexOf('function arrive('));let target;
for(const ratio of [1,2])for(const cssScale of [1,2,3]){runInNewContext(tap+'\nonMapTap({clientX:10+80*'+cssScale+',clientY:20+44*'+cssScale+'})',{G:{cv:{width:240*ratio,height:160*ratio,getBoundingClientRect:()=>({left:10,top:20,width:240*cssScale,height:160*cssScale})},mapRenderScale:ratio},camera:()=>({x:32,y:16}),walkTo:(x,y)=>target=[x,y]});assert.deepEqual(target,[7,4]);}
assert.ok(ART_HD.stats().mapBytes<=32*1024*1024);mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/hd-art-contact.png',import.meta.url),sheet.toBuffer('image/png'));console.log('HD sprites render; doubled maps retain logical tap coordinates at three CSS scales; cache memory bounded');
