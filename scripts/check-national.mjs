import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented,routes}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES})`);
const expected='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const fail=msg=>{throw new Error(msg)};
if(routes.some(r=>r.status==='playable'&&(!r.firstArrival||typeof r.firstArrival!=='string'))) fail('playable routes need a first-arrival point');
if(regions.length!==8||new Set(regions.map(r=>r[0])).size!==8) fail('8 region IDs required');
if(prefs.length!==47) fail('47 prefectures required');
for(let i=0;i<47;i++){
  const p=prefs[i];
  if(p.id!==`JP${String(i+1).padStart(2,'0')}`||p.name!==expected[i]) fail(`prefecture ${i+1} mismatch`);
  if(!regions.some(r=>r[0]===p.regionId)) fail(`${p.id} has unknown region`);
}
if(new Set(prefs.map(p=>p.name)).size!==47) fail('duplicate prefecture');
const counts=regions.map(r=>prefs.filter(p=>p.regionId===r[0]).length);
if(counts.join(',')!=='1,6,7,9,7,5,4,8') fail(`region counts ${counts}`);
const data=readFileSync(resolve(root,'src/data.js'),'utf8');
const match=data.match(/const HUBS = (\{[\s\S]*?\n\});/);
if(!match) fail('HUBS not found');
const hubs=runInNewContext(`(${match[1]})`);
if(Object.keys(implemented).join(',')!=='JP40,JP41,JP42'||implemented.JP40.join(',')!=='KY01,KY02'||implemented.JP41.join(',')!=='KY03,KY04'||implemented.JP42.join(',')!=='KY05') fail('playable prefectures must match current game');
for(const ids of Object.values(implemented)) for(const id of ids) if(!hubs[id]) fail(`missing playable hub ${id}`);
const {maps,joins}=runInNewContext(`${data.slice(0,data.indexOf('const NPCS'))}\n({maps:MAPS,joins:JOIN_PLAN})`);
for(const route of routes.filter(r=>r.status==='playable'&&r.mode==='road')){
  const gate=maps[route.from]?.objects.find(o=>o.id===route.firstGateId);
  if(!gate||gate.type!=='gate'||gate.to!==route.to||!maps[route.to]||!Number.isInteger(gate.tx)||!Number.isInteger(gate.ty)) fail(`${route.id} first-arrival gate missing or misdirected`);
}
if(!maps.KY03||maps.KY03.hub!=='KY03'||Object.keys(maps.KY03.zones).join(',')!=='1,2,3') fail('Karatsu exploration zones missing');
if(!joins.some(j=>j.hub==='KY03'&&j.cid==='kohei')) fail('Karatsu join plan missing');
const walkable=(m,x,y)=>x>=0&&y>=0&&x<m.w&&y<m.h&&!m.objects.some(o=>o.x===x&&o.y===y&&!o.walk)&&'.,123w='.includes(m.tiles[y][x]);
const reachable=(m,from,to)=>{const seen=new Set([from.join(',')]),q=[from];for(let i=0;i<q.length;i++){const [x,y]=q[i];if(x===to[0]&&y===to[1])return true;for(const [dx,dy] of [[0,1],[0,-1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!seen.has(k)&&walkable(m,nx,ny)){seen.add(k);q.push([nx,ny])}}}return false};
for(const route of routes.filter(r=>r.status==='playable'&&r.mode==='road')){
  const from=maps[route.from],to=maps[route.to],gate=from.objects.find(o=>o.id===route.firstGateId);
  const approaches=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const pos=[gate.x+dx,gate.y+dy];return walkable(from,...pos)&&reachable(from,from.safeAnchor,pos)});
  if(!approaches||!walkable(to,gate.tx,gate.ty)||!reachable(to,[gate.tx,gate.ty],to.safeAnchor)) fail(`${route.id} first-arrival gate has no safe path`);
}
for(const id of ['KY02','KY03','KY04','KY05']) if(!walkable(maps[id],...maps[id].safeAnchor)) fail(`${id} unsafe anchor`);
const east=maps.KY02.objects.find(o=>o.id==='gate_saga'),west=maps.KY03.objects.find(o=>o.id==='gate_kitakyushu');
if(!east||!west||east.to!=='KY03'||west.to!=='KY02'||east.tx!==2||east.ty!==24||west.tx!==45||west.ty!==24) fail('Karatsu gates are not reciprocal');
if(!reachable(maps.KY02,maps.KY02.safeAnchor,[45,24])||!reachable(maps.KY03,[2,24],maps.KY03.safeAnchor)||!reachable(maps.KY03,maps.KY03.safeAnchor,[2,24])) fail('Karatsu gate or return path blocked');
for(const type of ['npc','landmark','inn','rest','board','shelf']) if(!maps.KY03.objects.some(o=>o.type===type)) fail(`Karatsu ${type} missing`);
for(const zone of ['1','2','3']){
  const id=maps.KY03.zones[zone];
  const tile=maps.KY03.tiles.flatMap((row,y)=>row.map((value,x)=>value===zone?[x,y]:null)).find(Boolean);
  if(id!==`KY03-A${zone}`||!tile||!reachable(maps.KY03,maps.KY03.safeAnchor,tile)) fail(`Karatsu zone ${zone} unreachable`);
  if(!maps.KY03.objects.some(o=>o.type==='sign'&&o.area===id)) fail(`Karatsu zone ${zone} sign missing`);
}
if(!maps.KY03.objects.some(o=>o.type==='boss'&&o.boss==='B02')) fail('Karatsu boss missing');
const cityGate=maps.KY03.objects.find(o=>o.id==='gate_sagacity'),returnGate=maps.KY04.objects.find(o=>o.id==='gate_karatsu');
if(!cityGate||!returnGate||cityGate.to!=='KY04'||returnGate.to!=='KY03'||cityGate.tx!==2||cityGate.ty!==20||returnGate.tx!==46||returnGate.ty!==25) fail('Saga city gates are not reciprocal');
if(!reachable(maps.KY03,maps.KY03.safeAnchor,[46,25])||!reachable(maps.KY04,[2,20],maps.KY04.safeAnchor)||!reachable(maps.KY04,maps.KY04.safeAnchor,[2,20])) fail('Saga city gate or return path blocked');
for(const type of ['npc','inn','rest','board','shelf']) if(!maps.KY04.objects.some(o=>o.type===type)) fail(`Saga city ${type} missing`);
for(const zone of ['1','2','3']){
  const id=maps.KY04.zones[zone];
  const tile=maps.KY04.tiles.flatMap((row,y)=>row.map((value,x)=>value===zone?[x,y]:null)).find(Boolean);
  if(id!==`KY04-A${zone}`||!tile||!reachable(maps.KY04,maps.KY04.safeAnchor,tile)) fail(`Saga city zone ${zone} unreachable`);
  if(!maps.KY04.objects.some(o=>o.type==='sign'&&o.area===id)) fail(`Saga city zone ${zone} sign missing`);
}
const cityBoss=maps.KY04.objects.find(o=>o.type==='boss'&&o.boss==='B03');
if(!cityBoss||!reachable(maps.KY04,maps.KY04.safeAnchor,[cityBoss.x,cityBoss.y])) fail('Saga city boss unreachable');
const saseboGate=maps.KY04.objects.find(o=>o.id==='gate_sasebo'),saseboReturn=maps.KY05.objects.find(o=>o.id==='gate_sagacity');
if(!saseboGate||!saseboReturn||saseboGate.to!=='KY05'||saseboReturn.to!=='KY04'||saseboGate.tx!==2||saseboGate.ty!==20||saseboReturn.tx!==37||saseboReturn.ty!==20) fail('Sasebo gates are not reciprocal');
if(Object.keys(maps.KY05.zones).length||!reachable(maps.KY05,maps.KY05.safeAnchor,[2,20])) fail('Sasebo must remain a safe hub without exploration zones');
for(const type of ['npc','inn','rest','board','shelf']) if(!maps.KY05.objects.some(o=>o.type===type)) fail(`Sasebo ${type} missing`);
if(!joins.some(j=>j.hub==='KY05'&&j.cid==='kayo')) fail('Sasebo join plan missing');
const playable=new Set(Object.values(implemented).flat());
const known=new Set([...playable,...[...data.matchAll(/\["(KY\d+)","[^"]+","[^"]+"\]/g)].map(m=>m[1])]);
if(new Set(routes.map(r=>r.id)).size!==routes.length) fail('duplicate route ID');
for(const r of routes){
  if(r.from===r.to||!known.has(r.from)||!known.has(r.to)) fail(`invalid route endpoint ${r.id}`);
  if(!['playable','planned'].includes(r.status)||!['always','fukuokaClear','karatsuClear','sagaCityClear'].includes(r.unlock)) fail(`invalid route state ${r.id}`);
  if(r.status==='playable'&&(!playable.has(r.from)||!playable.has(r.to))) fail(`unimplemented playable route ${r.id}`);
}
const edges=routes.filter(r=>r.status==='playable');
const reached=new Set(['KY01']);
let changed=true;
while(changed){ changed=false; for(const r of edges){ if(reached.has(r.from)&&!reached.has(r.to)){reached.add(r.to);changed=true} if(reached.has(r.to)&&!reached.has(r.from)){reached.add(r.from);changed=true} } }
for(const id of playable) if(!reached.has(id)) fail(`unreachable playable hub ${id}`);
if(routes.find(r=>r.id==='RT-KY02-KY03')?.status!=='playable') fail('Karatsu route must be playable');
const ui=readFileSync(resolve(root,'src/ui.js'),'utf8');
const routeFn=ui.match(/function nationalRouteAvailable\(st,from,to\)\{[\s\S]*?\n\}/)?.[0];
if(!routeFn) fail('travel route guard missing');
const can=runInNewContext(`${source}\n${routeFn}\nnationalRouteAvailable`);
if(can({fukuokaClear:false},'KY02','KY03')||!can({fukuokaClear:true},'KY02','KY03')||!can({fukuokaClear:true},'KY03','KY02')||can({fukuokaClear:true},'KY01','KY03')) fail('Karatsu unlock or adjacency guard failed');
if(can({quests:{M03:'locked'}},'KY03','KY04')||!can({quests:{M03:'complete'}},'KY03','KY04')||!can({quests:{M03:'complete'}},'KY04','KY03')) fail('Saga city unlock or return guard failed');
if(can({quests:{M04:'locked'}},'KY04','KY05')||!can({quests:{M04:'complete'}},'KY04','KY05')||!can({quests:{M04:'complete'}},'KY05','KY04')) fail('Sasebo unlock or return guard failed');
const futureDef=data.match(/const FUTURE_HUBS = \[[^\n]+\];/)?.[0], worldFn=ui.match(/function renderWorld\(\)\{[\s\S]*?\n\}/)?.[0], statusFn=ui.match(/function worldTravelStatus\(st,from,to,safe\)\{[\s\S]*?\n\}/)?.[0], itineraryFn=ui.match(/function nationalItinerary\(st,from,to\)\{[\s\S]*?\n\}/)?.[0], unlockFn=ui.match(/function nationalRouteUnlockReason\(from,to\)\{[\s\S]*?\n\}/)?.[0];
if(!futureDef||!worldFn||!statusFn||!itineraryFn||!unlockFn) fail('national map UI source missing');
const alternateRoutes=[
  {from:'A',to:'B',status:'playable',unlock:'always'},
  {from:'B',to:'C',status:'playable',unlock:'fukuokaClear'},
  {from:'A',to:'D',status:'playable',unlock:'always'},
  {from:'D',to:'E',status:'playable',unlock:'always'},
  {from:'E',to:'C',status:'playable',unlock:'always'}
];
const routePlanner=runInNewContext(`${routeFn}\n${itineraryFn}\nnationalItinerary`,{NATIONAL_ROUTES:alternateRoutes,HUBS:{A:{},B:{},C:{},D:{},E:{}}});
if(routePlanner({fukuokaClear:false},'A','C').join(',')!=='A,D,E,C'||routePlanner({fukuokaClear:true},'A','C').join(',')!=='A,B,C') fail('itinerary did not prefer an open route before a shorter locked route');
alternateRoutes[4].status='planned';
if(routePlanner({fukuokaClear:false},'A','C').join(',')!=='A,B,C') fail('itinerary did not show a locked route when no open route exists');
const future=runInNewContext(`${futureDef}\nFUTURE_HUBS`);
const world=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\n${itineraryFn}\n${unlockFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01'],quests:{},fukuokaClear:false,slots:6}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY01',esc:s=>String(s)});
if((world.match(/<details>/g)||[]).length!==8||!world.includes('拠点ありは3/47都道府県')||!world.includes('訪問済みは実装済みの1/3県・1/5拠点')||!world.includes('JP40 福岡県：拠点あり（福岡市・北九州市）・訪問済み')||!world.includes('JP41 佐賀県：拠点あり（唐津市・佐賀市）・未訪問')||!world.includes('JP42 長崎県：拠点あり（佐世保市）・未訪問')) fail('national directory must distinguish playable hubs from registry-only prefectures');
if(!world.includes('福岡市 ↔ 北九州市：経路解放済み')||!world.includes('北九州市 ↔ 唐津市：福岡編の完了待ち')||!world.includes('唐津市 ↔ 佐賀市：唐津編M03の完了待ち')) fail('nationwide route directory did not show unlock conditions');
if(!world.includes('初回：福岡市の東門')||!world.includes('初回：北九州の東門')||!world.includes('初回：唐津の東門')) fail('route directory did not show first-arrival entrances');
if(!world.includes('福岡市 → 北九州市 → 唐津市（計2枠・未解放区間あり）')||!world.includes('福岡市 → 北九州市 → 唐津市 → 佐賀市（計3枠・未解放区間あり）')) fail('itinerary missing route or locked segment');
if(!world.includes('北九州市→唐津市：福岡編の完了後に開きます。')||!world.includes('唐津市→佐賀市：唐津編M03の完了後に開きます。')) fail('itinerary did not identify locked legs');
if(!world.includes('北九州市の初回到達：福岡市の東門から向かってください。')||!world.includes('唐津市の初回到達：北九州の東門から向かってください。')||!world.includes('佐賀市の初回到達：唐津の東門から向かってください。')) fail('itinerary did not show first-arrival gates');
if(!world.includes('この先の拠点候補')||!world.includes('KY06 長崎・長崎市　未収録・移動不可')||world.includes('KY05 長崎・佐世保市　未収録')) fail('future hub directory mismatch');
const worldVisited=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\n${itineraryFn}\n${unlockFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01','KY03'],quests:{},fukuokaClear:true,slots:6}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY03',esc:s=>String(s)});
if(!worldVisited.includes('訪問済みは実装済みの2/3県・2/5拠点')||!worldVisited.includes('JP41 佐賀県：拠点あり（唐津市・佐賀市）・訪問済み')) fail('national visit count did not follow saved hubs');
const worldSaga=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\n${itineraryFn}\n${unlockFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01','KY02','KY03','KY04'],quests:{M03:'complete'},fukuokaClear:true,slots:3}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY04',esc:s=>String(s)});
if(!worldSaga.includes('訪問済みは実装済みの2/3県・4/5拠点')) fail('Saga city visit did not update hub count');
if(!worldSaga.includes('佐賀市 → 唐津市 → 北九州市 → 福岡市（計3枠）')) fail('unlocked itinerary missing');
if(!worldSaga.includes('佐賀市 ↔ 佐世保市：佐賀市編M04の完了待ち')) fail('Sasebo route directory did not report locked leg');
const worldLowSlots=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\n${itineraryFn}\n${unlockFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01','KY02','KY03','KY04'],quests:{M03:'complete'},fukuokaClear:true,slots:1}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY04',esc:s=>String(s)});
if(!worldLowSlots.includes('佐賀市 → 唐津市 → 北九州市 → 福岡市（計3枠・現在の旅程枠では不足）')) fail('itinerary did not report insufficient slots');
if(!worldSaga.includes('初回：佐賀市の東門')) fail('Sasebo first-arrival entrance missing');
if(!worldVisited.includes('北九州市 ↔ 唐津市：経路解放済み')||!worldVisited.includes('唐津市 ↔ 佐賀市：唐津編M03の完了待ち')) fail('route directory did not follow quest progress');
const travelStatus=runInNewContext(`${source}\n${routeFn}\n${statusFn}\n${unlockFn}\nworldTravelStatus`);
const unlockReason=runInNewContext(`${source}\n${unlockFn}\nnationalRouteUnlockReason`);
if(!unlockReason('KY02','KY03').includes('福岡編')||!unlockReason('KY03','KY04').includes('M03')||!unlockReason('KY04','KY05').includes('M04')||!unlockReason('KY01','KY04').includes('まだ開いて')) fail('gate unlock guidance mismatch');
const base={visitedHubs:['KY01','KY02'],fukuokaClear:false,quests:{M03:'locked'},slots:6};
if(!travelStatus(base,'KY01','KY02',true).available||!travelStatus(base,'KY01','KY03',true).reason.includes('直通経路')||!travelStatus(base,'KY02','KY03',true).reason.includes('福岡編')) fail('national map route reasons failed');
if(!travelStatus({...base,visitedHubs:['KY01']},'KY01','KY02',true).reason.includes('福岡市の東門')) fail('first visit to Kitakyushu bypassed the gate');
if(!travelStatus({...base,fukuokaClear:true},'KY02','KY03',true).reason.includes('東門')||!travelStatus({...base,fukuokaClear:true,visitedHubs:[...base.visitedHubs,'KY03']},'KY03','KY04',true).reason.includes('M03')) fail('national map unlock reasons failed');
const open={...base,fukuokaClear:true,visitedHubs:['KY01','KY02','KY03','KY04'],quests:{M03:'complete'}};
if(!travelStatus(open,'KY03','KY04',true).available||!travelStatus(open,'KY03','KY04',false).reason.includes('安全地帯')||!travelStatus({...open,slots:0},'KY03','KY04',true).reason.includes('旅程枠')) fail('national map travel readiness failed');
if(!travelStatus({...open,quests:{M04:'complete'}},'KY04','KY05',true).reason.includes('佐賀市の東門')||!travelStatus({...open,visitedHubs:[...open.visitedHubs,'KY05'],quests:{M04:'complete'}},'KY05','KY04',true).available) fail('Sasebo first arrival or return guard failed');
const actionDef=ui.match(/const ACT = \{[\s\S]*?\n\};/)?.[0],canTravelFn=ui.match(/function canTravelFrom\(sheet\)\{[^\n]+\}/)?.[0];
if(!actionDef||!canTravelFn) fail('travel action missing');
const actionState={st:{...base,fukuokaClear:true,visitedHubs:['KY01','KY02']},screen:'explore',sheet:'map',dlg:null,readOnly:false,walk:{path:[]}};
let moves=0,lastMessage='';
const worldGo=runInNewContext(`${source}\n${routeFn}\n${statusFn}\n${unlockFn}\n${canTravelFn}\n${actionDef}\nACT.worldGo`,{G:actionState,HUBS:hubs,MAPS:maps,curHub:()=> 'KY02',isSafe:()=>true,toast:msg=>{lastMessage=msg;},travelHub:()=>{moves++;}});
worldGo({dataset:{v:'KY03'}});
if(moves||!lastMessage.includes('東門')) fail('stale map action bypassed first-visit gate');
actionState.st.visitedHubs.push('KY03');actionState.st.slots=0;
worldGo({dataset:{v:'KY03'}});
if(moves||!lastMessage.includes('旅程枠')) fail('stale map action bypassed travel slots');
actionState.st.slots=1;worldGo({dataset:{v:'KY03'}});
if(moves!==1||actionState.sheet!==null) fail('valid map travel was rejected');
const gateState={st:{...base,visitedHubs:['KY01','KY02'],slots:2},screen:'explore',sheet:'travel',sheetData:{to:'KY03',tx:2,ty:24,gateId:'gate_saga'},dlg:null,readOnly:false,walk:{path:[]}};
let gateMoves=0;
const gateTravel=runInNewContext(`${source}\n${routeFn}\n${canTravelFn}\n${actionDef}\nACT.doTravel`,{G:gateState,HUBS:hubs,curHub:()=> 'KY02',isSafe:()=>true,nearbyObjects:()=>[maps.KY02.objects.find(o=>o.id==='gate_saga')],travelHub:()=>{gateMoves++;},toast:()=>{}});
gateTravel();
if(gateMoves) fail('locked first-arrival gate opened');
gateState.st.fukuokaClear=true;
gateState.sheetData.gateId='gate1';gateTravel();
if(gateMoves) fail('stale gate ID bypassed first-arrival route');
gateState.sheetData.gateId='gate_saga';gateTravel();
if(gateMoves!==1||gateState.sheet!==null) fail('valid first-arrival gate was rejected');
gateState.sheet='travel';gateState.sheetData=null;gateTravel();
if(gateMoves!==1) fail('missing travel sheet data moved the party');
const saseboGateState={st:{...base,visitedHubs:['KY01','KY02','KY03','KY04'],quests:{M04:'complete'},slots:2},screen:'explore',sheet:'travel',sheetData:{to:'KY05',tx:2,ty:20,gateId:'gate_sasebo'},dlg:null,readOnly:false,walk:{path:[]}};
let saseboMoves=0;
const toSasebo=runInNewContext(`${source}\n${routeFn}\n${canTravelFn}\n${actionDef}\nACT.doTravel`,{G:saseboGateState,HUBS:hubs,curHub:()=> 'KY04',isSafe:()=>true,nearbyObjects:()=>[maps.KY04.objects.find(o=>o.id==='gate_sasebo')],travelHub:()=>{saseboMoves++;},toast:()=>{}});
saseboGateState.sheetData.gateId='gate_sagacity';toSasebo();
if(saseboMoves) fail('stale gate ID bypassed Sasebo first arrival');
saseboGateState.sheetData.gateId='gate_sasebo';toSasebo();
if(saseboMoves!==1) fail('valid Sasebo first-arrival gate was rejected');
const core=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','core.js'].map(name=>readFileSync(resolve(root,'src',name),'utf8')).join('\n');
const travelMapFn=ui.match(/function travelMap\(to,tx,ty,save=true\)\{[\s\S]*?\n\}/)?.[0],travelHubFn=ui.match(/function travelHub\(to,tx,ty\)\{[\s\S]*?\n\}/)?.[0];
if(!travelMapFn||!travelHubFn) fail('hub travel implementation missing');
let saved=0,dialogs=[];const savedStates=[];
const journey=runInNewContext(`${core}\n${travelMapFn}\n${travelHubFn}\n({newGame,travelHub,G})`,{G:{st:null,walk:{path:[]},fol:null,sheet:null},commit:()=>{saved++;savedStates.push(JSON.parse(JSON.stringify(journey.G.st)));},render:()=>{},say:lines=>{dialogs.push(lines);},openSheet:()=>{throw new Error('unexpected rest sheet');}});
const traveler=journey.newGame('旅人','女性');traveler.mapId='KY04';traveler.pos={x:37,y:20};traveler.visitedMaps.push('KY04');traveler.visitedHubs.push('KY04');traveler.quests.M04='complete';traveler.slots=2;journey.G.st=traveler;
journey.travelHub('KY05',2,20);
if(traveler.mapId!=='KY05'||traveler.pos.x!==2||traveler.pos.y!==20||traveler.slots!==1||!traveler.visitedHubs.includes('KY05')||!traveler.roster.includes('kayo')||!traveler.vitals.kayo||saved!==1||savedStates[0].mapId!=='KY05'||!savedStates[0].roster.includes('kayo')||dialogs.length!==1) fail('Sasebo first arrival, atomic save, or Kayo join failed');
journey.travelHub('KY04',37,20);
if(traveler.mapId!=='KY04'||traveler.slots!==0||traveler.roster.filter(cid=>cid==='kayo').length!==1||saved!==2) fail('Sasebo return duplicated join or lost travel state');
const questViewFn=ui.match(/function renderQuests\(\)\{[\s\S]*?\n\}/)?.[0];
if(!questViewFn) fail('quest UI missing');
traveler.mapId='KY05';
const saseboQuests=runInNewContext(`${core}\n${questViewFn}\nrenderQuests()`,{G:{st:traveler},curHub:()=> 'KY05',isSafe:()=>true,esc:s=>String(s)});
if(!saseboQuests.includes('長崎編の依頼・探索区域・配信はまだ収録されていません')) fail('Sasebo quest board implied a playable Nagasaki chapter');
console.log('National registry: 8 regions, 47 prefectures, 5 connected hubs, Sasebo safe hub and routes OK');


