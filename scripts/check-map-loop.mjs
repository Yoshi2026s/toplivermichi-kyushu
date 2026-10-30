import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/ui.js',import.meta.url),'utf8');
const start=source.indexOf('function startLoop(){'),end=source.indexOf('function bfs(',start);
assert(start>=0&&end>start);
const frames=new Map();let sequence=0,draws=0,loop;
const G={raf:0,st:{settings:{},pos:{x:0,y:0}},screen:'explore',walk:{path:[{x:1,y:0}],prog:.99},frame:0};
loop=runInNewContext(source.slice(start,end)+'\nstartLoop',{
  G,document:{hidden:false},drawMap(){draws++;},arrive(){loop();},
  requestAnimationFrame(fn){frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>frames.delete(id)
});
loop();const [firstId,firstFrame]=frames.entries().next().value;frames.delete(firstId);firstFrame(16);
assert.equal(frames.size,1,'arrival that mounts a new map must not create two animation loops');
const oldFrame=frames.values().next().value;loop();const before=draws;oldFrame(32);
assert.equal(frames.size,1,'obsolete callback cannot schedule another frame');assert.equal(draws,before);
console.log('Map transitions keep one animation loop and ignore obsolete callbacks');

G.walk.path=[];G.sheet='menu';loop();const paused=draws;const pausedFrame=frames.values().next().value;frames.clear();pausedFrame(160);assert.equal(draws,paused,'menu pauses background canvas rendering');G.sheet=null;const resumedFrame=frames.values().next().value;frames.clear();resumedFrame(176);assert(draws>paused,'closing the menu resumes drawing');
