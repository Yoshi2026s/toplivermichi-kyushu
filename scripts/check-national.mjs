import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented,routes}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES})`);
const expected='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const fail=msg=>{throw new Error(msg)};
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
if(Object.keys(implemented).join(',')!=='JP40,JP41'||implemented.JP40.join(',')!=='KY01,KY02'||implemented.JP41.join(',')!=='KY03,KY04') fail('playable prefectures must match current game');
for(const ids of Object.values(implemented)) for(const id of ids) if(!hubs[id]) fail(`missing playable hub ${id}`);
const {maps,joins}=runInNewContext(`${data.slice(0,data.indexOf('const NPCS'))}\n({maps:MAPS,joins:JOIN_PLAN})`);
if(!maps.KY03||maps.KY03.hub!=='KY03'||Object.keys(maps.KY03.zones).join(',')!=='1,2,3') fail('Karatsu exploration zones missing');
if(!joins.some(j=>j.hub==='KY03'&&j.cid==='kohei')) fail('Karatsu join plan missing');
const walkable=(m,x,y)=>x>=0&&y>=0&&x<m.w&&y<m.h&&!m.objects.some(o=>o.x===x&&o.y===y&&!o.walk)&&'.,123w='.includes(m.tiles[y][x]);
const reachable=(m,from,to)=>{const seen=new Set([from.join(',')]),q=[from];for(let i=0;i<q.length;i++){const [x,y]=q[i];if(x===to[0]&&y===to[1])return true;for(const [dx,dy] of [[0,1],[0,-1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!seen.has(k)&&walkable(m,nx,ny)){seen.add(k);q.push([nx,ny])}}}return false};
for(const id of ['KY02','KY03','KY04']) if(!walkable(maps[id],...maps[id].safeAnchor)) fail(`${id} unsafe anchor`);
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
const playable=new Set(Object.values(implemented).flat());
const known=new Set([...playable,...[...data.matchAll(/\["(KY\d+)","[^"]+","[^"]+"\]/g)].map(m=>m[1])]);
if(new Set(routes.map(r=>r.id)).size!==routes.length) fail('duplicate route ID');
for(const r of routes){
  if(r.from===r.to||!known.has(r.from)||!known.has(r.to)) fail(`invalid route endpoint ${r.id}`);
  if(!['playable','planned'].includes(r.status)||!['always','fukuokaClear','karatsuClear'].includes(r.unlock)) fail(`invalid route state ${r.id}`);
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
const futureDef=data.match(/const FUTURE_HUBS = \[[^\n]+\];/)?.[0], worldFn=ui.match(/function renderWorld\(\)\{[\s\S]*?\n\}/)?.[0], statusFn=ui.match(/function worldTravelStatus\(st,from,to,safe\)\{[\s\S]*?\n\}/)?.[0];
if(!futureDef||!worldFn||!statusFn) fail('national map UI source missing');
const future=runInNewContext(`${futureDef}\nFUTURE_HUBS`);
const world=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01'],quests:{},fukuokaClear:false,slots:6}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY01',esc:s=>String(s)});
if((world.match(/<details>/g)||[]).length!==8||!world.includes('拠点ありは2/47都道府県')||!world.includes('訪問済みは実装済みの1/2県')||!world.includes('JP40 福岡県：拠点あり（福岡市・北九州市）・訪問済み')||!world.includes('JP41 佐賀県：拠点あり（唐津市・佐賀市）・未訪問')||!world.includes('JP42 長崎県：地理台帳のみ・移動不可')) fail('national directory must distinguish playable hubs from registry-only prefectures');
const worldVisited=runInNewContext(`${source}\n${worldFn}\n${statusFn}\n${routeFn}\nrenderWorld()`,{G:{st:{visitedHubs:['KY01','KY03'],quests:{},fukuokaClear:true,slots:6}},HUBS:hubs,FUTURE_HUBS:future,isSafe:()=>true,curHub:()=> 'KY03',esc:s=>String(s)});
if(!worldVisited.includes('訪問済みは実装済みの2/2県')||!worldVisited.includes('JP41 佐賀県：拠点あり（唐津市・佐賀市）・訪問済み')) fail('national visit count did not follow saved hubs');
const travelStatus=runInNewContext(`${source}\n${routeFn}\n${statusFn}\nworldTravelStatus`);
const base={visitedHubs:['KY01','KY02'],fukuokaClear:false,quests:{M03:'locked'},slots:6};
if(!travelStatus(base,'KY01','KY02',true).available||!travelStatus(base,'KY01','KY03',true).reason.includes('直通経路')||!travelStatus(base,'KY02','KY03',true).reason.includes('福岡編')) fail('national map route reasons failed');
if(!travelStatus({...base,fukuokaClear:true},'KY02','KY03',true).reason.includes('東門')||!travelStatus({...base,fukuokaClear:true,visitedHubs:[...base.visitedHubs,'KY03']},'KY03','KY04',true).reason.includes('M03')) fail('national map unlock reasons failed');
const open={...base,fukuokaClear:true,visitedHubs:['KY01','KY02','KY03','KY04'],quests:{M03:'complete'}};
if(!travelStatus(open,'KY03','KY04',true).available||!travelStatus(open,'KY03','KY04',false).reason.includes('安全地帯')||!travelStatus({...open,slots:0},'KY03','KY04',true).reason.includes('旅程枠')) fail('national map travel readiness failed');
console.log('National registry: 8 regions, 47 prefectures, 4 connected hubs, directory and Saga city route OK');


