import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8'),ui=read('src/ui.js'),files=[...read('scripts/build.mjs').match(/const files = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const data=files.slice(0,files.indexOf('core.js')+1).map(n=>read('src/'+n)).join('\n');
// Preserve the previous search as a reference, including its tie-break and transition rules.
function referenceBfs(m,sx,sy,goal,avoidTransitions=false){
 const key=(x,y)=>y*m.w+x,prev=new Map(),q=[[sx,sy]];prev.set(key(sx,sy),null);
 while(q.length){const [x,y]=q.shift();if(goal(x,y)&&!(x===sx&&y===sy)){const path=[];let k=key(x,y);while(k!==key(sx,sy)){path.unshift({x:k%m.w,y:Math.floor(k/m.w)});k=prev.get(k);}return path;}
 for(const [dx,dy]of [[0,1],[0,-1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=m.w||ny>=m.h)continue;const k=key(nx,ny);if(prev.has(k)||!walkable(m,nx,ny))continue;const transit=objAt(m,nx,ny);if(avoidTransitions&&transit?.walk&&transit.to&&!goal(nx,ny))continue;prev.set(k,key(x,y));q.push([nx,ny]);}}
 return null;
}
const adapter=`function objAt(m,x,y){return m.objects.find(o=>o.x===x&&o.y===y);}function walkable(m,x,y){const o=objAt(m,x,y);return m.combatDomain==='sea'?(x>=0&&y>=0&&x<m.w&&y<m.h&&'ESP'.includes(m.tiles[y]?.[x]||'?')&&(!o||!!o.walk)):(o?!!o.walk:'.,123w='.includes(m.tiles[y]?.[x]||'T'));}`;
const {MAPS,bfs,reference,walkable}=runInNewContext(data+'\n'+adapter+'\n'+ui.slice(ui.indexOf('function bfs('),ui.indexOf('function walkTo('))+'\n'+referenceBfs.toString()+'\n({MAPS,bfs,reference:referenceBfs,walkable})');let cases=0,reachable=0;
for(const [id,m]of Object.entries(MAPS)){const [sx,sy]=m.safeAnchor;let far=[sx,sy],distance=0;for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(walkable(m,x,y)&&Math.abs(x-sx)+Math.abs(y-sy)>distance){far=[x,y];distance=Math.abs(x-sx)+Math.abs(y-sy);}for(const avoid of [false,true])for(const [x,y]of [[1,1],[m.w-2,m.h-2],...m.objects.slice(0,3).map(o=>[o.x,o.y]),far]){const goal=(gx,gy)=>gx===x&&gy===y,actual=bfs(m,sx,sy,goal,avoid);assert.equal(JSON.stringify(actual),JSON.stringify(reference(m,sx,sy,goal,avoid)),id+' exact route including tie-break');if(actual)reachable++;cases++;}}
const fork={w:5,h:3,tiles:['.....','.....','.....'],objects:[{x:2,y:1,walk:true,to:'other'}]};for(const avoid of [false,true]){const goal=(x,y)=>x===4&&y===1;assert.equal(JSON.stringify(bfs(fork,0,1,goal,avoid)),JSON.stringify(reference(fork,0,1,goal,avoid)));}
const blocked={w:3,h:3,tiles:['TTT','T.T','TTT'],objects:[]};assert.equal(bfs(blocked,1,1,()=>true),null,'own tile is not a destination');assert.equal(bfs(blocked,1,1,(x,y)=>x===0&&y===0),null);
assert(reachable>100,'comparison includes reachable long routes, not only unreachable targets');
console.log('PASS '+cases+' real-MAP route comparisons ('+reachable+' reachable); same tie-break/transition rules, disconnected and own-tile behavior');
