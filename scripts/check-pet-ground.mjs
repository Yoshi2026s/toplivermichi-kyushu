import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {illustratedContext} from './illustrated-runtime.mjs';
import {createCanvas} from './canvas-runtime.mjs';
const read=n=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8'),ui=read('ui_pets.js');
const code=ui.slice(ui.indexOf('function drawPetRear'),ui.indexOf('function petMapFollowers'));
const api=await illustratedContext('const ITEMS={},ART={};\n'+read('data_pets.js')+'\n'+read('soft_art.js')+'\nconst petMapImages=new Map();\n'+code+'\n({PET_SPECIES,petWalkSprite,petMapImages})');
// Use the production destination expression, so reverting the MAP anchor fails.
const expression=read('ui.js').match(/if\(s.img.petArt\)\{g.drawImage\(s.img,([^;]+)\);\}/)?.[1];
assert(expression,'MAP pet draw call exists');
const destination=new Function('s','x','y','cam','return ['+expression+']');
let cases=0;
for(const id of Object.keys(api.PET_SPECIES))for(const stage of [1,3,8,10])for(let dir=0;dir<4;dir++)for(let frame=0;frame<=8;frame++){
 const c=api.petWalkSprite(id,stage,dir,frame),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 let bottom=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=128)bottom=y+1;
 assert(bottom>0,id+' visible art');assert.equal(c.mapFootY,bottom);
 const [,top,,height]=destination({img:c},40,60,{x:7,y:11});
 assert(Math.abs(top+bottom/c.height*height-(60+13-11))<1e-8,id+' feet meet shadow at every phase');cases++;
}
assert(api.petMapImages.size<=64);
const sheet=createCanvas(640,280),g=sheet.getContext('2d');g.fillStyle='#b7b39b';g.fillRect(0,0,640,280);
for(const [row,id] of ['PT01','PT02'].entries())for(let dir=0;dir<4;dir++){
 const c=api.petWalkSprite(id,3,dir,0),x=dir*160+80,y=row*140+115,w=c.mapWidth*3,h=c.mapHeight*3;
 g.fillStyle='#26384955';g.beginPath();g.ellipse(x,y,18,6,0,0,Math.PI*2);g.fill();g.drawImage(c,x-w/2,y-c.mapFootY/c.height*h,w,h);
}
mkdirSync(new URL('../.task/',import.meta.url),{recursive:true});writeFileSync(new URL('../.task/pet-ground.png',import.meta.url),sheet.toBuffer('image/png'));
console.log('PASS '+cases+' pet ground anchors: 22 species, four stages, four directions, idle and eight walking phases; cache <=64');
