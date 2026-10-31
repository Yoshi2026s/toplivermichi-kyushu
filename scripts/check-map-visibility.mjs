import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const visible=runInNewContext(source.slice(source.indexOf('function mapObjectVisible('),source.indexOf('function drawMap(){'))+'\nmapObjectVisible');
const cam={x:100,y:100},w=80,h=48;
for(const [name,x,y]of [['left',68,100],['right',196,100],['top',100,76],['bottom',100,188]]){
 assert(visible({x:x/16,y:y/16},cam,w,h),name+' inclusive margin retains touching sprites');
}
for(const [name,x,y]of [['left',67.99,100],['right',196.01,100],['top',100,75.99],['bottom',100,188.01]])assert(!visible({x:x/16,y:y/16},cam,w,h),name+' outside conservative margin is culled');
// Every currently drawn sprite shape (including its conservative shadow) must survive if any part intersects.
const shapes=[[-10,-32,36,52],[-5,-17,26,38],[-3,-11,22,30]];
for(let y=-100;y<=200;y+=3)for(let x=-100;x<=200;x+=3)for(const [dx,dy,sw,sh]of shapes){const intersects=x+dx+sw>=0&&x+dx<=80&&y+dy+sh>=0&&y+dy<=48;if(intersects)assert(visible({x:x/16,y:y/16},{x:0,y:0},80,48),'visible artwork or shadow must never be culled');}
let queries=0,os=false;const settings={reduceMotion:false},media={get matches(){return os;}};
const check=runInNewContext(source.match(/function reducedMotion\(\)\{[\s\S]*?\n\}/)[0]+'\nreducedMotion',{G:{st:{settings}},window:{matchMedia(q){queries++;assert.equal(q,'(prefers-reduced-motion: reduce)');return media;}}});
for(let i=0;i<1000;i++)assert.equal(check(),false);assert.equal(queries,1,'repeated animation checks reuse one live MediaQueryList');os=true;assert(check());os=false;assert(!check());settings.reduceMotion=true;assert(check());assert.equal(queries,1);
const unsupported=runInNewContext(source.match(/function reducedMotion\(\)\{[\s\S]*?\n\}/)[0]+'\nreducedMotion',{G:{st:{settings:{}}},window:{}});assert.equal(unsupported(),false);
console.log('PASS conservative viewport margins preserve sprites/shadows; one live media query follows OS changes and game override');
