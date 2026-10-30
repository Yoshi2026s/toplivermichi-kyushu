import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=f=>readFileSync(resolve(root,'src',f),'utf8');
const data=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js'].map(read).join('\n');
const ui=read('ui.js'),assert=(v,m)=>{if(!v)throw Error(m);};
const fn=name=>{const v=ui.match(new RegExp('function '+name+'\\([^\\n]*\\)\\{[\\s\\S]*?\\n\\}'))?.[0];assert(v,`${name} missing`);return v;};
const funcs=['nationalRouteAvailable','nationalRouteUnlockReason','worldTravelStatus','nationalItinerary','renderWorld','travelMap','travelHub'].map(fn).join('\n');
const context={G:{st:null,walk:{path:[]},sheet:null},esc:String,curHub:()=>context.G.st.mapId,isSafe:()=>true,commit:()=>{},render:()=>{},say:()=>{},exploreBgm:()=>{}};
const game=runInNewContext(`${data}\n${read('core.js')}\n${funcs}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES,hubs:HUBS,maps:MAPS,joins:JOIN_PLAN,newGame,can:nationalRouteAvailable,status:worldTravelStatus,itinerary:nationalItinerary,renderWorld,travelHub})`,context);
const {regions,prefs,implemented,routes,hubs,maps,joins,can,status,itinerary}=game;
const expected='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
assert(regions.length===8&&new Set(regions.map(r=>r[0])).size===8,'8 unique regions required');
assert(prefs.length===47&&Object.keys(implemented).length===47,'all 47 prefectures must have playable hubs');
for(let i=0;i<47;i++)assert(prefs[i].id===`JP${String(i+1).padStart(2,'0')}`&&prefs[i].name===expected[i]&&regions.some(r=>r[0]===prefs[i].regionId),`prefecture registry ${i+1} mismatch`);
assert(regions.map(r=>prefs.filter(p=>p.regionId===r[0]).length).join(',')==='1,6,7,9,7,5,4,8','regional prefecture counts mismatch');
const hubIds=Object.values(implemented).flat();assert(hubIds.length===51&&new Set(hubIds).size===51&&Object.keys(hubs).length===51,'51 unique playable hubs required');
for(const id of hubIds)assert(hubs[id]&&maps[id]?.kind==='town'&&maps[hubs[id].fieldMap]?.kind==='field',`${id} town or field absent`);
assert(routes.length===50&&new Set(routes.map(r=>r.id)).size===50,'50 unique transport routes required');
for(const route of routes){
 assert(route.status==='playable'&&hubs[route.from]&&hubs[route.to]&&route.from!==route.to,`${route.id}: invalid endpoints`);
 assert(typeof route.firstArrival==='string'&&route.firstArrival.length>0,`${route.id}: first-arrival guidance absent`);
 const gate=maps[hubs[route.from].fieldMap].objects.find(o=>o.id===route.firstGateId&&o.fieldRoute&&o.toHub===route.to);
 const back=maps[hubs[route.to].fieldMap].objects.find(o=>o.fieldRoute&&o.toHub===route.from);
 assert(gate&&back,`${route.id}: reciprocal gates absent`);
 assert(gate.to===hubs[route.to].fieldMap&&back.to===hubs[route.from].fieldMap,`${route.id}: walking must arrive outdoors`);
}
const complete=game.newGame('旅人','女性');complete.fukuokaClear=true;for(const id of Object.keys(complete.quests))complete.quests[id]='complete';complete.visitedHubs=Object.keys(hubs);complete.slots=0;
for(const [from,to,quest] of [['KY03','KY04','M03'],['KY04','KY05','M04'],['KY05','KY06','M05'],['KY06','KY07','M06'],['KY07','KY08','M07'],['KY08','NW44','M08']]){
 const locked={...complete,quests:{...complete.quests,[quest]:'locked'}};
 assert(!can(locked,from,to)&&can(complete,from,to)&&can(complete,to,from),`${quest}: forward lock or return failed`);
}
assert(!can({...complete,fukuokaClear:false},'KY02','KY03')&&can(complete,'KY02','KY03'),'Fukuoka completion transport lock failed');
for(const route of routes.filter(r=>r.requiredQuest)){
 const locked={...complete,quests:{...complete.quests,[route.requiredQuest]:'active'}};
 assert(!can(locked,route.from,route.to)&&can(complete,route.from,route.to)&&can(locked,route.to,route.from),`${route.id}: regional boss lock/return failed`);
}
assert(!can(complete,'KY01','KY03')&&!status(complete,'KY01','KY03',true).available,'nonadjacent travel bypass');
assert(status(complete,'KY03','KY04',true).available&&!status(complete,'KY03','KY04',false).available,'travel requires safe town, ignores obsolete slots');
assert(status({...complete,visitedHubs:['KY01']},'KY01','KY02',true).available,'first-visit route must offer walking directions');
const path=itinerary(complete,'KY01','NW01');assert(path?.length===51&&path[0]==='KY01'&&path.at(-1)==='NW01','national itinerary must connect all 51 hubs');
for(let i=1;i<path.length;i++)assert(can(complete,path[i-1],path[i]),`itinerary locked at ${path[i]}`);
const alternate=[{from:'A',to:'B',status:'playable',unlock:'always'},{from:'B',to:'C',status:'playable',unlock:'fukuokaClear'},{from:'A',to:'D',status:'playable',unlock:'always'},{from:'D',to:'E',status:'playable',unlock:'always'},{from:'E',to:'C',status:'playable',unlock:'always'}];
const planner=runInNewContext(`${fn('nationalRouteAvailable')}\n${fn('nationalItinerary')}\nnationalItinerary`,{NATIONAL_ROUTES:alternate,HUBS:{A:{},B:{},C:{},D:{},E:{}}});
assert(planner({fukuokaClear:false},'A','C').join(',')==='A,D,E,C'&&planner({fukuokaClear:true},'A','C').join(',')==='A,B,C','planner must prefer unlocked routes');
const state=game.newGame('旅人','女性');context.G.st=state;state.slots=0;let saves=0;const snapshots=[];context.commit=()=>{saves++;snapshots.push(JSON.parse(JSON.stringify(state)));};
for(const join of joins){
 assert(hubs[join.hub],`${join.cid} joins at an unreachable hub`);
 const before=saves,anchor=maps[join.hub].safeAnchor;game.travelHub(join.hub,...anchor);
 assert(state.mapId===join.hub&&state.pos.x===anchor[0]&&state.pos.y===anchor[1]&&state.visitedHubs.includes(join.hub)&&state.roster.includes(join.cid)&&state.vitals[join.cid],`${join.cid}: first arrival/join failed`);
 assert(saves===before+1&&snapshots.at(-1).roster.includes(join.cid),`${join.cid}: save must include arrival and joined member atomically`);
 game.travelHub(join.hub,...anchor);assert(state.roster.filter(id=>id===join.cid).length===1,`${join.cid}: repeated arrival duplicated member`);
}
assert(state.slots===0,'transport must preserve legacy zero slot value');
context.G.st={...complete,mapId:'KY01',visitedHubs:['KY01']};const world=game.renderWorld();
assert(world.includes('拠点ありは47/47都道府県')&&world.includes('訪問済みは1/47県・1/51拠点'),'national directory counts do not reflect all implemented prefectures');
assert((world.match(/<details>/g)||[]).length===9&&world.includes('街外MAP'),'region/route directory missing');
context.G.st=complete;complete.mapId='KY01';assert(game.renderWorld().includes('全国踏破達成'),'full national visit not recorded');
console.log('National registry, progression locks, itineraries, atomic joins and directory OK; travel actions covered by check-travel-modes.mjs');
