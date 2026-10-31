import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=n=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8');
const data=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js'].map(read).join('\n');
const ui=read('ui.js');
const helpers=ui.slice(ui.indexOf('function tileAt('),ui.indexOf('function isSafe('));
const arrive=ui.slice(ui.indexOf('function arrive(){'),ui.indexOf('function exploreBgm('));
const noop=()=>{};let rolls=[],battles=[];
const G={screen:'explore',walk:{path:[],pending:null}};
const g=runInNewContext(data+'\n'+helpers+'\n'+arrive+'\n({MAPS,NATIONAL_MAP_PAIRS,zoneAt,encounterDenominator,walkable,arrive})',{
 G,document:{hidden:false},SND:{current:'field'},exploreBgm:noop,commit:noop,keepFlush:noop,refreshHere:noop,interact:noop,
 vitalOf:()=>({hp:10}),randInt:n=>{rolls.push(n);return 0;},createFieldRun:(st,zone)=>({zone}),startBattle:r=>battles.push(r)
});
for(const [hub,pair]of Object.entries(g.NATIONAL_MAP_PAIRS)){
 const field=g.MAPS[pair.field],town=g.MAPS[pair.town];
 for(const t of ['.','w']){
  let point;for(let y=1;y<field.h-1&&!point;y++)for(let x=1;x<field.w-1;x++)if(field.tiles[y][x]===t&&g.walkable(field,x,y)&&!field.objects.some(o=>o.x===x&&o.y===y)){point={x,y};break;}
  assert(point,hub+' must contain '+t);const area=g.zoneAt(field,point.x,point.y);assert(area,hub+' encounter area missing on '+t);
  assert.equal(g.encounterDenominator(field,point.x,point.y),t==='w'?28:24);
  G.st={mapId:pair.field,pos:point,party:[{}]};rolls=[];battles=[];g.arrive();assert.equal(rolls[0],t==='w'?28:24);assert.equal(battles[0]?.zone,area);
 }
 for(const o of field.objects.filter(o=>o.walk))assert.equal(g.zoneAt(field,o.x,o.y),null,hub+' entrance must stay safe');
 G.st={mapId:pair.town,pos:{x:town.safeAnchor[0],y:town.safeAnchor[1]},party:[{}]};rolls=[];battles=[];g.arrive();assert.equal(rolls.length,0);assert.equal(battles.length,0);
}
for(const m of Object.values(g.MAPS))assert(m.objects.every(o=>o.type!=='sign'&&!(o.type==='landmark'&&o.label.includes('案内板'))));
console.log('51 outdoor maps: grass and road arrivals start encounters, 1/24 vs 1/28, safe towns/entrances and removed signs passed');
