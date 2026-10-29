import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..'),read=f=>readFileSync(resolve(root,'src',f),'utf8');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js','data_character.js','data_pets.js','data_ocean.js','data_extras.js','core.js','pets.js','ocean.js','listeners.js','ui.js','ui_character.js','ui_pets.js','ui_ocean.js','ui_systems.js','ui_management.js'].filter(f=>existsSync(resolve(root,'src',f)));
const noop=()=>{},fields={};
const ctx={console,performance:{now:()=>0},setTimeout:()=>0,clearTimeout:noop,setInterval:()=>0,clearInterval:noop,navigator:{},localStorage:{getItem:()=>null},SND:{sfx:noop,play:noop,setVolumes:noop},document:{hidden:false,addEventListener:noop,querySelector:s=>fields[s]||null,getElementById:()=>null},window:{addEventListener:noop,matchMedia:()=>({matches:true})}};
vm.createContext(ctx);
const g=vm.runInContext(files.map(read).join('\n')+`\nrender=()=>{};commit=()=>Promise.resolve(true);drawMiniSprites=()=>{};({G,ACT,MAPS,HUBS,NPCS,EQUIP,QUESTS,newGame,ensureVitals,restoreAll,charStats,shopOffer,shopOfferToken,managementToken,managementEquipPlanToken,managementGearPlan,managementExchangePreview,managementFacilityOffer,MANAGEMENT_RARE_GEAR,managementShopEntries,renderShop,renderParty,renderManagementEquipPreview,renderManagementExchange,renderManagementGear,availableCount,equippedCount,talkNpc})`,ctx);
const make=()=>{const st=g.newGame('管理検査','女性');g.ensureVitals(st);return st;};
function explore(st,map='KY01'){g.G.st=st;g.G.screen='explore';g.G.sheet=null;g.G.dlg=null;g.G.readOnly=false;g.G.walk={path:[]};st.mapId=map;st.pos={x:g.MAPS[map].safeAnchor[0],y:g.MAPS[map].safeAnchor[1]};}
function near(st,type){const o=g.MAPS[st.mapId].objects.find(o=>o.type===type);assert(o,`map must contain ${type}`);st.pos={x:o.x+1,y:o.y};return o;}
const st=make();explore(st);st.gold=10000;const shop=near(st,'shop');g.G.sheet='shop';g.G.sheetData={shop:shop.shop,npc:shop.npc,tab:'buy'};
let html=g.renderShop();assert.match(html,/検索/);assert.match(html,/1／\d+ページ/);assert((html.match(/data-a="shopItem"/g)||[]).length<=6);
g.G.sheetData.query='声合わせ';assert(g.managementShopEntries(st,g.G.sheetData).every(id=>g.EQUIP[id].name.includes('声合わせ')));
g.G.sheetData.query='ｃｗ０１';assert(g.managementShopEntries(st,g.G.sheetData).includes('CW01'),'search normalizes fullwidth IDs');
g.G.sheetData.query='存在しない品';assert.match(g.renderShop(),/一致する品物がありません/);
g.G.sheetData.query='';g.G.sheetData.filter='w';assert(g.managementShopEntries(st,g.G.sheetData).every(id=>g.EQUIP[id].slot==='w'));
g.ACT.managementShopFilter({dataset:{v:'constructor'}});assert.equal(g.G.sheetData.filter,'w','inherited filter keys rejected');
g.G.sheetData={shop:shop.shop,npc:shop.npc,tab:'item',item:'IT001',qty:1};
html=g.renderShop();assert.match(html,/最大\d+個/);g.ACT.managementShopQty({dataset:{v:'max'}});assert(g.G.sheetData.qty>=1);const qty=g.G.sheetData.qty;g.ACT.managementShopQty({dataset:{v:'NaN'}});assert.equal(g.G.sheetData.qty,qty);
const viewBefore=JSON.stringify(st);g.G.readOnly=true;g.ACT.managementShopQty({dataset:{v:'1'}});assert.equal(JSON.stringify(st),viewBefore);assert.match(g.renderShop(),/閲覧専用/);g.G.readOnly=false;
g.G.sheetData={shop:shop.shop,npc:shop.npc,tab:'buy'};g.ACT.managementShopTalk({dataset:{v:'advice'}});assert(g.G.dlg.lines.some(([,t])=>t.includes('道具')));assert.equal(JSON.stringify(st),viewBefore,'keeper conversation does not charge');g.G.dlg=null;
// Explicit equipment transfer previews both owners and never steals during preview.
st.owned.CW03=1;st.equip.moe.w='CW03';const equipBefore=JSON.stringify(st);
assert(!g.managementGearPlan(st,'hero','w','CW03').ok);const plan=g.managementGearPlan(st,'hero','w','CW03','moe');assert(plan.ok);assert.equal(plan.equipment.moe.w,null);assert.equal(plan.equipment.hero.w,'CW03');assert.equal(JSON.stringify(st),equipBefore);
assert(!g.managementGearPlan(st,'hero','w','constructor').ok);assert(!g.managementGearPlan(st,'hero','w','CA01').ok);
g.G.sheet='gearPreview';g.G.sheetData={cid:'hero',slot:'w',item:'CW03',from:'moe'};assert.match(g.renderManagementEquipPreview(),/もえ/);assert.match(g.renderManagementEquipPreview(),/最大体力/);
g.G.readOnly=true;const equipEl={dataset:{token:g.managementToken(st),plan:g.managementEquipPlanToken(st,g.G.sheetData)},disabled:false};await g.ACT.managementEquipConfirm(equipEl);assert.equal(JSON.stringify(st),equipBefore);g.G.readOnly=false;
equipEl.dataset.token=g.managementToken(st);await g.ACT.managementEquipConfirm(equipEl);assert.equal(st.equip.hero.w,'CW03');assert.equal(st.equip.moe.w,null);const equipped=JSON.stringify(st);await g.ACT.managementEquipConfirm(equipEl);assert.equal(JSON.stringify(st),equipped);
// Rare exchange uses tickets, protects sell/drop and refuses stale/capacity/readonly.
assert.equal(Object.keys(g.MANAGEMENT_RARE_GEAR).length,6);for(const id of Object.keys(g.QUESTS))st.quests[id]='complete';st.tickets=50000;g.G.sheet='pointExchange';g.G.sheetData={};near(st,'shop');
for(const id of Object.keys(g.MANAGEMENT_RARE_GEAR)){
 assert(g.managementExchangePreview(st,id).ok);const el={dataset:{v:id,token:g.managementToken(st)},disabled:false},beforeTickets=st.tickets;
 await g.ACT.managementExchangeDo(el);assert.equal(st.owned[id],1);assert.equal(st.tickets,beforeTickets-g.MANAGEMENT_RARE_GEAR[id].cost);
 const saved=JSON.stringify(st);await g.ACT.managementExchangeDo(el);assert.equal(JSON.stringify(st),saved);
 assert.equal(g.shopOffer(st,{shop:shop.shop,tab:'sell',item:id,qty:1}).unit,-1);
}
const rare='UX01';g.G.sheet='gearDispose';g.G.sheetData={item:rare};const rareBefore=JSON.stringify(st);await g.ACT.managementGearDrop({dataset:{v:rare,token:g.managementToken(st)}});assert.equal(JSON.stringify(st),rareBefore,'rare equipment cannot be discarded');
// Atomic inn/rest: require a fresh facility confirmation, exact nearby facility, no double days.
const hotel=make();explore(hotel);hotel.gold=1000;near(hotel,'inn');hotel.vitals.hero.hp=1;g.G.sheet='inn';g.G.sheetData={};let offer=g.managementFacilityOffer(hotel,'inn');assert(offer);
const innEl={dataset:{facility:offer.token},disabled:false},day=hotel.day,money=hotel.gold;
const one=g.ACT.doInn(innEl),two=g.ACT.doInn(innEl);await Promise.all([one,two]);assert.equal(hotel.day,day+1);assert.equal(hotel.gold,money-offer.price);assert(hotel.vitals.hero.hp>1);
g.G.sheet='inn';g.G.sheetData={};offer=g.managementFacilityOffer(hotel,'inn');const stale={dataset:{facility:offer.token}};hotel.gold++;const moved=JSON.stringify(hotel);await g.ACT.doInn(stale);assert.equal(JSON.stringify(hotel),moved,'changed price/state invalidates old confirmation');
hotel.pos={x:0,y:0};g.G.sheet='inn';await g.ACT.doInn({dataset:{facility:'anything'}});assert.equal(hotel.day,day+1,'remote inn cannot advance day');
hotel.mapId=Object.entries(g.MAPS).find(([,m])=>m.kind!=='field'&&m.objects.some(o=>o.type==='rest'))[0];near(hotel,'rest');g.G.sheet='rest';g.G.sheetData={};hotel.vitals.hero.hp=5;hotel.vitals.hero.c=2;offer=g.managementFacilityOffer(hotel,'rest');const restBefore=clone(hotel),restEl={dataset:{facility:offer.token}};
await g.ACT.doRest(restEl);assert.equal(hotel.day,restBefore.day+1);assert.equal(hotel.gold,restBefore.gold);assert.equal(hotel.vitals.hero.hp,5);assert.equal(hotel.vitals.hero.c,2);
hotel.mapId='KY01';near(hotel,'inn');g.G.sheet='inn';g.G.sheetData={};offer=g.managementFacilityOffer(hotel,'inn');const failedBefore=JSON.stringify(hotel);vm.runInContext('commit=()=>Promise.resolve(false);',ctx);await g.ACT.doInn({dataset:{facility:offer.token}});assert.equal(JSON.stringify(hotel),failedBefore,'failed save rolls back inn fee/healing/day');
vm.runInContext('commit=()=>Promise.resolve(true);',ctx);g.G.readOnly=true;offer=g.managementFacilityOffer(hotel,'inn');await g.ACT.doInn({dataset:{facility:offer.token}});assert.equal(JSON.stringify(hotel),failedBefore);
console.log('Management: six-item searchable shops, readonly views, quantity units, explicit equipment transfer/preview, six protected ticket gear, keeper conversations, atomic nearby inn/rest and save rollback passed');
function clone(v){return JSON.parse(JSON.stringify(v));}
