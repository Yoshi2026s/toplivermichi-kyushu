/* 店・装備・街の会話を補完。超レア交換品6点は本版の新規制作。 */
const MANAGEMENT_PAGE_SIZE=6;
const MANAGEMENT_SHOP_FILTERS={all:"すべて",w:"武器",a:"防具",acc:"アクセサリー",item:"道具",pet:"ペット用品",event:"イベント品"};
const MANAGEMENT_RARE_GEAR={
  UX01:{name:"星つなぎの放送マイク",slot:"w",atk:6,strength:3,cost:1200,quests:8,text:"攻撃＋6、ちから＋3。応援チケット交換専用。売却・廃棄不可。"},
  UX02:{name:"返事を待つ銀のベル",slot:"w",atk:4,charm:8,cost:1400,quests:12,text:"攻撃＋4、魅力＋8。応援チケット交換専用。売却・廃棄不可。"},
  UX03:{name:"旅人の星空コート",slot:"a",d:4,hp:18,cost:1600,quests:20,text:"防御＋4、最大体力＋18。応援チケット交換専用。売却・廃棄不可。"},
  UX04:{name:"潮風の軽やかケープ",slot:"a",d:3,agility:6,cost:1800,quests:28,text:"防御＋3、すばやさ＋6。応援チケット交換専用。売却・廃棄不可。"},
  UX05:{name:"ひと息の琥珀ボトル",slot:"acc",c:2,rest:2,cost:2000,quests:36,text:"最大MP＋2、ひと息のMP回復＋2。応援チケット交換専用。売却・廃棄不可。"},
  UX06:{name:"四十七色の応援ブローチ",slot:"acc",commentA:4,meter:3,cost:2400,quests:51,text:"応援コメントのエール＋4、メーター突破＋3。応援チケット交換専用。売却・廃棄不可。"}
};
for(const [id,it] of Object.entries(MANAGEMENT_RARE_GEAR))if(!Object.hasOwn(EQUIP,id))EQUIP[id]={...it,price:0,sell:-1,discard:false,exchangeOnly:true};
const managementNormalize=s=>String(s??"").normalize("NFKC").toLocaleLowerCase().trim();
function managementToken(st){return checksum(JSON.stringify([st.saveGeneration,st.mapId,st.pos,st.day,st.gold,st.tickets,st.owned,st.equip,st.bag,st.itemVault,st.party,st.roster,st.jobs,st.jp]));}
function managementCanAct(){return !!G.st&&!G.readOnly&&!G.featureSaving&&!G.shopSaving&&!G.vaultSaving&&!G.petSaving&&!G.oceanSaving&&!G.characterSaving&&G.screen==="explore"&&!G.dlg&&!G.st.run&&!G.st.jobEvent&&!G.walk.path.length&&isSafe()&&(typeof document==="undefined"||!document.hidden);}
async function managementMutation(el,fn,{sheet=G.sheet,message="記録しました。",sound="ok"}={}){
  if(!managementCanAct()||G.sheet!==sheet||!el.dataset.token||el.dataset.token!==managementToken(G.st))return toast("状態が変わりました。現在の画面で確認し直してください。");
  const st=G.st,before=clone(st);let result;
  try{result=fn(st);}catch(e){Object.keys(st).forEach(k=>delete st[k]);Object.assign(st,before);return toast("処理できませんでした。元の記録を保持しています。");}
  if(!result?.ok)return toast(result?.reason||"現在はこの操作を行えません。");
  G.featureSaving=true;el.disabled=true;render();let saved=false;try{saved=await commit();}catch(e){}
  if(!saved&&G.st===st){Object.keys(st).forEach(k=>delete st[k]);Object.assign(st,before);}
  G.featureSaving=false;if(G.st!==st)return false;
  if(saved){if(result.after)result.after();SND.sfx(sound);toast(result.message||message);}else toast("保存できなかったため、金額・所持品・進行を元に戻しました。");
  render();return saved;
}
function managementShopEntries(st,d){
  const shop=SHOPS[d.shop];if(!shop)return [];
  const tab=d.tab||"buy",gifts=[...JOB_IDS.filter(j=>st.gifts.W[j]).map(j=>"JW"+j.slice(1)),...JOB_IDS.filter(j=>st.gifts.A[j]).map(j=>"JA"+j.slice(1))];
  let ids=tab==="buy"?[...new Set([...shop.items,...gifts])]:tab==="item"?SHOP_ITEMS.slice():[...Object.keys(st.owned).filter(id=>st.owned[id]>0),...st.bag.filter(e=>e.n>0).map(e=>e.id)];
  const words=managementNormalize(d.query).split(/\s+/).filter(Boolean),filter=Object.hasOwn(MANAGEMENT_SHOP_FILTERS,d.filter)?d.filter:"all";
  return ids.filter(id=>Object.hasOwn(EQUIP,id)||Object.hasOwn(ITEMS,id)).filter(id=>{const it=ITEMS[id]||EQUIP[id],kind=ITEMS[id]?(it.petSupply?"pet":it.acq==="E"?"event":"item"):it.slot;return (filter==="all"||kind===filter)&&words.every(word=>managementNormalize(id+" "+it.name+" "+it.text).includes(word));});
}
const managementBaseShopOffer=shopOffer;
shopOffer=function(st,d){const offer=managementBaseShopOffer(st,d);if(offer&&d.tab==="sell"&&EQUIP[d.item]?.exchangeOnly)return {...offer,unit:-1};return offer;};
const managementBaseRenderShop=renderShop;
renderShop=function(){
  const st=G.st,d=G.sheetData,shop=SHOPS[d.shop];if(!shop)return '<p>お店を調べ直してください。</p>';
  const dialogue=`<details class="shop-chat"><summary>店員に相談</summary><div class="opts"><button class="btn opt" data-a="managementShopTalk" data-v="advice">店員に道具の相談</button><button class="btn opt" data-a="managementShopTalk" data-v="prepare">旅の備えを聞く</button><button class="btn opt" data-a="managementShopTalk" data-v="town">街の話を聞く</button></div></details>`;
  if(d.item){
    const it=ITEMS[d.item]||EQUIP[d.item];if(!it)return '<p>品物を選び直してください。</p>';
    if(d.tab==="sell"&&it.exchangeOnly)return `<p><b>${esc(it.name)}</b></p><p class="warn">応援チケット交換専用の超レア装備です。売却・廃棄はできません。装備や金庫への保管はできます。</p><button class="btn" data-a="shopItem" data-v="">一覧へ戻る</button>`;
    let html=managementBaseRenderShop(),offer=shopOffer(st,{...d,qty:d.qty||1}),max=offer?.max||0;
    if(G.readOnly)html=html.replaceAll('data-a="shopDo"','data-a="shopDo" disabled')+'<p class="small">閲覧専用：数量比較はできますが、売買はできません。</p>';
    const afford=offer?.tab==="sell"?max:offer?.unit>0?Math.min(max,Math.floor(st.gold/offer.unit)):max;
    return html+`<h3 class="label">数量を選ぶ</h3><div class="opts">${[1,5,10].filter(n=>n<=afford).map(n=>`<button class="btn opt" data-a="managementShopQty" data-v="${n}">${n}個</button>`).join("")}<button class="btn opt" data-a="managementShopQty" data-v="max" ${afford>0?"":"disabled"}>${offer?.tab==="sell"?"売却":"購入"}できる最大${Math.max(0,afford)}個</button></div>`+dialogue;
  }
  const tab=d.tab||"buy",list=managementShopEntries(st,d),pages=Math.max(1,Math.ceil(list.length/MANAGEMENT_PAGE_SIZE)),page=Math.min(Math.max(0,Number.isInteger(d.page)?d.page:0),pages-1);
  return `<p>所持 ${st.gold.toLocaleString()}ゴールド・チケット${st.tickets}枚</p><div class="row3">${[["buy","装備を買う"],["item","道具を買う"],["sell","売る"]].map(([id,name])=>`<button class="btn ${tab===id?"on":""}" data-a="shopTab" data-v="${id}">${name}</button>`).join("")}</div>${listSearchForm('shop')}<details class="shop-categories"><summary>分類：${esc(Object.hasOwn(MANAGEMENT_SHOP_FILTERS,d.filter)?MANAGEMENT_SHOP_FILTERS[d.filter]:MANAGEMENT_SHOP_FILTERS.all)}</summary><div class="opts">${Object.entries(MANAGEMENT_SHOP_FILTERS).map(([id,label])=>`<button class="btn opt ${(d.filter||"all")===id?"on":""}" data-a="managementShopFilter" data-v="${id}" aria-pressed="${(d.filter||"all")===id}">${label}</button>`).join("")}</div></details><div class="stack">${list.slice(page*MANAGEMENT_PAGE_SIZE,page*MANAGEMENT_PAGE_SIZE+MANAGEMENT_PAGE_SIZE).map(id=>{const it=ITEMS[id]||EQUIP[id],own=ITEMS[id]?bagCount(st.bag,id):st.owned[id]||0,sell=ITEMS[id]?it.sell:it.exchangeOnly?-1:Math.floor(it.price/2);return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><b>${esc(it.name)}</b><span class="small">${tab==="sell"?(sell<0?"売却不可":`買取${sell}G・売却可能${ITEMS[id]?own:availableCount(st,id)}個`):`${it.price}G`}・所持${own}個${EQUIP[id]?`・装備中${equippedCount(st,id)}個`:""}<br>${esc(itemText(it,Vof(levelOf(st.xp,st))))}</span></button>`;}).join("")||'<p>見つかりません。解除で検索条件をリセットできます。</p>'}</div><div class="row3"><button class="btn" data-a="managementShopPage" data-v="${page-1}" ${page>0?"":"disabled"}>前の6件</button><span role="status" aria-live="polite">${list.length}件・${page+1}／${pages}</span><button class="btn" data-a="managementShopPage" data-v="${page+1}" ${page+1<pages?"":"disabled"}>次の6件</button></div>${dialogue}<button class="btn" data-a="openSheet" data-k="pointExchange">応援チケットで超レア装備と交換</button><button class="btn" data-a="openSheet" data-k="gearManage">未装備品を整理する</button>${G.readOnly?'<p class="small">閲覧専用：一覧・分類・比較だけ利用できます。</p>':""}`;
};
const managementBaseShopTab=ACT.shopTab;
ACT.shopTab=function(el){managementBaseShopTab(el);if(G.sheet==="shop"){G.sheetData.page=0;G.sheetData.filter="all";render();}};
function managementGearPlan(st,cid,slot,id,from=null){
  if(!st.roster.includes(cid)||!["w","a","acc"].includes(slot)||id&&!Object.hasOwn(EQUIP,id))return {ok:false,reason:"装備を選び直してください。"};
  const it=id?EQUIP[id]:null,current=charStats(st,cid,levelOf(st.xp,st));if(it&&(it.slot!==slot||it.job&&(it.job!==current.job||current.R<it.needR)))return {ok:false,reason:"職業・熟練度・部位が合いません。"};
  const next=clone(st.equip),mine=next[cid][slot]===id;
  if(from&&mine)return {ok:false,reason:"既に同じ装備です。他の人から外す必要はありません。"};
  if(from){if(from===cid||!st.roster.includes(from)||next[from][slot]!==id)return {ok:false,reason:"装備している人が変わりました。"};next[from][slot]=null;}
  else if(id&&!mine&&availableCount(st,id)<1)return {ok:false,reason:"未装備の在庫がありません。他の人から外す場合は相手を指定してください。"};
  next[cid][slot]=id||null;
  const preview={...st,equip:next},beforeCount=unequippedGearCount(st),afterCount=unequippedGearCount(preview);
  if(afterCount>UNEQUIPPED_GEAR_MAX&&afterCount>beforeCount)return {ok:false,reason:"未装備品の上限300種類を超えます。金庫へ預けてください。"};
  return {ok:true,cid,slot,id:id||null,from,equipment:next,affected:[cid,...(from?[from]:[])]};
}
function managementStatsCompare(st,cid,equip){const L=levelOf(st.xp,st),a=charStats(st,cid,L),b=charStats(st,cid,L,null,equip);const labels=[['maxHP','最大体力'],['startC','最大MP'],['strength','ちから'],['defense','身の守り'],['agility','すばやさ'],['charm','魅力']];return `<b>${esc(charName(st,cid))}</b><dl class="kv">${labels.filter(([k])=>a[k]!==undefined).map(([k,label])=>`<dt>${label}</dt><dd>${a[k]} → ${b[k]}（${b[k]-a[k]>=0?"＋":""}${b[k]-a[k]}）</dd>`).join("")}<dt>攻撃力</dt><dd>${attackPower(a,L)} → ${attackPower(b,L)}</dd><dt>防御力</dt><dd>${defensePower(a,L)} → ${defensePower(b,L)}</dd></dl>`;}
const managementBaseRenderParty=renderParty;
renderParty=function(){
  const st=G.st,d=G.sheetData;if(!st.roster.includes(d.cid)||!d.view?.startsWith("eq:"))return managementBaseRenderParty();
  const slot=d.view.slice(3);if(!["w","a","acc"].includes(slot))return managementBaseRenderParty();
  const cid=d.cid,L=levelOf(st.xp,st),stats=charStats(st,cid,L),index=st.roster.indexOf(cid),switcher=(offset)=>st.roster[(index+offset+st.roster.length)%st.roster.length],list=Object.keys(EQUIP).filter(id=>EQUIP[id].slot===slot&&(st.owned[id]||0)>0);
  return `<div class="gear-actor"><button class="btn" data-a="partyView" data-c="${switcher(-1)}" data-v="eq:${slot}" aria-label="前の仲間の装備" ${st.roster.length>1?"":"disabled"}>◀</button><span>${esc(charName(st,cid))}・Lv${L}・${st.party.includes(cid)?"同行":"控え"}</span><button class="btn" data-a="partyView" data-c="${switcher(1)}" data-v="eq:${slot}" aria-label="次の仲間の装備" ${st.roster.length>1?"":"disabled"}>▶</button></div><dl class="gear-stat-grid">${[["最大HP",stats.maxHP],["最大MP",stats.startC],["攻撃力",attackPower(stats,L)],["防御力",defensePower(stats,L)]].map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl><div class="gear-slot-tabs">${[["w","武器"],["a","防具"],["acc","アクセサリー"]].map(([key,label])=>`<button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:${key}" aria-pressed="${slot===key}">${label}</button>`).join("")}</div><p>${esc(charName(st,cid))}の${{w:"武器",a:"防具",acc:"アクセサリー"}[slot]}。変更前に比較できます。</p><button class="btn" data-a="managementEquipPreview" data-c="${cid}" data-s="${slot}" data-v="">外した場合を比較</button>${list.map(id=>{const it=EQUIP[id],owners=st.roster.filter(c=>c!==cid&&st.equip[c][slot]===id);return `<div class="qcard"><b>${esc(it.name)}</b><p class="small">${esc(it.text)}<br>所持${st.owned[id]}個・未装備${availableCount(st,id)}個</p>${availableCount(st,id)>0||st.equip[cid][slot]===id?`<button class="btn" data-a="managementEquipPreview" data-c="${cid}" data-s="${slot}" data-v="${id}">未装備の在庫で比較</button>`:""}${owners.map(owner=>`<button class="btn" data-a="managementEquipPreview" data-c="${cid}" data-s="${slot}" data-v="${id}" data-from="${owner}">${esc(charName(st,owner))}から付け替える場合を比較</button>`).join("")}</div>`;}).join("")||'<p>この部位の装備を持っていません。</p>'}<button class="btn" data-a="partyView" data-c="${cid}" data-v="">人物へ戻る</button>`;
};
function managementEquipPlanToken(st,d){return checksum(JSON.stringify([managementToken(st),d.cid,d.slot,d.item,d.from]));}
function renderManagementEquipPreview(){const st=G.st,d=G.sheetData,plan=managementGearPlan(st,d.cid,d.slot,d.item,d.from);if(!plan.ok)return `<p>${esc(plan.reason)}</p>`;const skillList=eq=>[...new Set(Object.values(eq).filter(Boolean).flatMap(id=>{const it=EQUIP[id];return [...(it.skills||[]),...(it.skill?[it.skill]:[])];}))];return `${plan.from?`<p class="warn">${esc(charName(st,plan.from))}の${esc(EQUIP[plan.id].name)}を外し、${esc(charName(st,plan.cid))}へ渡します。</p>`:'<p>他の仲間の装備は変更しません。</p>'}${plan.affected.map(cid=>`<section class="qcard">${managementStatsCompare(st,cid,plan.equipment[cid])}<p class="small">装備専用技：${skillList(st.equip[cid]).join("・")||"なし"} → ${skillList(plan.equipment[cid]).join("・")||"なし"}</p></section>`).join("")}<button class="btn primary" data-a="managementEquipConfirm" data-token="${managementToken(st)}" data-plan="${managementEquipPlanToken(st,d)}" ${managementCanAct()?"":"disabled"}>この装備変更を確定</button>`;}
function managementExchangePreview(st,id){const it=MANAGEMENT_RARE_GEAR[id];if(!it||!Object.hasOwn(MANAGEMENT_RARE_GEAR,id))return {ok:false,reason:"交換品を選び直してください。"};const count=Object.entries(QUESTS).filter(([qid,q])=>q.main&&st.quests[qid]==="complete").length;if(count<it.quests)return {ok:false,reason:`本編依頼${it.quests}件の達成が必要です。`};if(st.tickets<it.cost)return {ok:false,reason:`チケットが${it.cost-st.tickets}枚足りません。`};if(gearReceiveRoom(st,id)<1)return {ok:false,reason:"同じ装備8個または未装備300種類の上限です。"};return {ok:true,cost:it.cost};}
function renderManagementExchange(){const st=G.st;return `<p>応援チケット${st.tickets}枚。街の店のそばで交換できます。6品とも交換専用・売却不可・廃棄不可です。</p>${Object.entries(MANAGEMENT_RARE_GEAR).map(([id,it])=>{const offer=managementExchangePreview(st,id);return `<section class="qcard"><b>${esc(it.name)}</b><p>${esc(it.text)}</p><p class="small">本編${it.quests}件・${it.cost}チケット／手元${st.owned[id]||0}個</p>${offer.ok?"":`<p class="warn">${esc(offer.reason)}</p>`}<button class="btn" data-a="managementExchangeDo" data-v="${id}" data-token="${managementToken(st)}" ${managementCanAct()&&offer.ok&&nearbyObjects().some(o=>o.type==="shop")?"":"disabled"}>${it.cost}チケットで1個交換</button></section>`;}).join("")}`;}
function renderManagementGear(){const st=G.st,d=G.sheetData,words=managementNormalize(d.query).split(/\s+/).filter(Boolean),list=Object.keys(st.owned).filter(id=>EQUIP[id]&&st.owned[id]>0&&words.every(w=>managementNormalize(EQUIP[id].name+" "+id).includes(w))),pages=Math.max(1,Math.ceil(list.length/6)),page=Math.min(Math.max(0,d.page||0),pages-1);return `<p>未装備品 ${unequippedGearCount(st)}/${UNEQUIPPED_GEAR_MAX}種類。装備中の品と交換専用品は廃棄できません。</p>${listSearchForm('gear')}${list.slice(page*6,page*6+6).map(id=>`<section class="qcard"><b>${esc(EQUIP[id].name)}</b><p>所持${st.owned[id]}・装備中${equippedCount(st,id)}・未装備${availableCount(st,id)}</p><button class="btn" data-a="managementDisposePreview" data-v="${id}" ${availableCount(st,id)>0&&!EQUIP[id].exchangeOnly&&EQUIP[id].discard!==false?"":"disabled"}>1個の廃棄を確認</button></section>`).join("")||'<p>見つかりません。解除で検索をリセットできます。</p>'}<div class="row3"><button class="btn" data-a="managementGearPage" data-v="${page-1}" ${page>0?"":"disabled"}>前へ</button><span>${page+1}／${pages}</span><button class="btn" data-a="managementGearPage" data-v="${page+1}" ${page+1<pages?"":"disabled"}>次へ</button></div>`;}
function managementFacilityOffer(st,type){
  if(!["inn","rest"].includes(type)||!isSafe())return null;
  const object=nearbyObjects().find(o=>o.type===type);if(!object)return null;
  const price=type==="inn"?(INN_PRICE[curHub()]||10)*st.roster.length:0;
  return {type,map:st.mapId,object:object.id,day:st.day,price,gold:st.gold,roster:st.roster.slice(),token:checksum(JSON.stringify([managementToken(st),type,object.id,price]))};
}
async function managementFacilityConfirm(el,type){
  const offer=managementFacilityOffer(G.st,type);if(!offer||G.sheet!==type||el.dataset.facility!==offer.token||!managementCanAct())return toast("施設のそばで確認し直してください。");
  if(G.st.gold<offer.price)return toast(`ゴールドが${offer.price-G.st.gold}足りません。`);
  const bridge={dataset:{token:managementToken(G.st)},disabled:false};
  return managementMutation(bridge,st=>{st.gold-=offer.price;if(type==="inn")restoreAll(st);st.day++;return {ok:true,message:type==="inn"?`${offer.price}Gで宿泊。${st.day}日目の朝、全員の体力とMPが全回復しました。`:`${st.day}日目の朝。日次回数が戻りました。体力とMPは持ち越します。`,after:()=>{G.sheet=null;G.sheetHistory=[];}};},{sheet:type,sound:type==="inn"?"heal":"ok"});
}
const managementBaseRenderSheet=renderSheet;
renderSheet=function(){
  const screens={gearPreview:["装備の比較と確認",renderManagementEquipPreview],pointExchange:["応援チケット交換所",renderManagementExchange],gearManage:["未装備品の整理",renderManagementGear]};
  if(screens[G.sheet])return sheetWrap(screens[G.sheet][0],screens[G.sheet][1]());
  if(G.sheet==="gearDispose"){const id=G.sheetData.item,it=EQUIP[id];return sheetWrap("装備を廃棄する前に確認",it?`<p>${esc(it.name)}の未装備分を1個廃棄します。所持${G.st.owned[id]||0}個・装備中${equippedCount(G.st,id)}個。</p><button class="btn" data-a="managementGearDrop" data-v="${id}" data-token="${managementToken(G.st)}" ${managementCanAct()?"":"disabled"}>この1個を廃棄</button>`:'<p>装備を選び直してください。</p>');}
  let html=managementBaseRenderSheet();
  if(["inn","rest"].includes(G.sheet)){
    const offer=managementFacilityOffer(G.st,G.sheet),can=offer&&managementCanAct(),action=G.sheet==="inn"?"doInn":"doRest";
    html=html.replace(`data-a="${action}"`,`data-a="${action}" data-facility="${offer?.token||""}" ${can?"":"disabled"}`);
    if(!offer)html=html.replace('</div></div>','</div></div><p class="warn facility-warning" role="status">この施設のそばへ移動してから確認してください。</p>');
  }
  return html;
};
const managementBaseRecord=renderRecord;
renderRecord=function(){return managementBaseRecord()+'<h3 class="label">持ち物の整理</h3><button class="btn" data-a="openSheet" data-k="gearManage">未装備品を整理する</button>';};
const managementBaseTalkNpc=talkNpc;
talkNpc=function(id){if(!Object.hasOwn(NPCS,id))return;const result=managementBaseTalkNpc(id);if(!G.dlg)return result;const n=NPCS[id],hub=n.hub||curHub(),main=Object.entries(QUESTS).find(([,q])=>q.main&&q.hub===hub),stage=main&&G.st.quests[main[0]]==="complete"?2:main&&["active","bossReady"].includes(G.st.quests[main[0]])?1:0,story=typeof NATIONWIDE_STORIES!=="undefined"?NATIONWIDE_STORIES[hub]:null;const lines=[`${HUBS[hub]?.name||"この街"}では、旅の前に互いの話を聞く時間を大切にしています。`,`街外へ行く時は、戻る道と持ち物を確かめて。${story?.approach||"困っている声を、一つずつ確かめてください。"}`,story?.resolution||"街に静けさが戻りました。旅先から帰って来た人にも、今日の話を聞かせたいですね。"];G.dlg.lines.push([n.name,lines[stage]]);render();return result;};
Object.assign(ACT,{
  managementShopSearch(){if(G.sheet!=="shop"||G.shopSaving)return;G.sheetData.query=String($("#managementShopSearch")?.value||"").slice(0,80);G.sheetData.page=0;render();},
  managementShopFilter(el){if(G.sheet!=="shop"||G.shopSaving||!Object.hasOwn(MANAGEMENT_SHOP_FILTERS,el.dataset.v))return;G.sheetData.filter=el.dataset.v;G.sheetData.page=0;render();},
  managementShopPage(el){if(G.sheet!=="shop"||G.shopSaving)return;const page=Number(el.dataset.v),pages=Math.max(1,Math.ceil(managementShopEntries(G.st,G.sheetData).length/6));if(!Number.isInteger(page)||page<0||page>=pages)return;G.sheetData.page=page;render();},
  managementShopQty(el){if(G.sheet!=="shop"||G.shopSaving)return;const offer=shopOffer(G.st,{...G.sheetData,qty:G.sheetData.qty||1});if(!offer)return;const max=offer.tab==="sell"?offer.max:offer.unit>0?Math.min(offer.max,Math.floor(G.st.gold/offer.unit)):offer.max,qty=el.dataset.v==="max"?max:Number(el.dataset.v);if(!Number.isSafeInteger(qty)||qty<1||qty>max)return;G.sheetData.qty=qty;render();},
  managementShopTalk(el){if(G.sheet!=="shop"||!SHOPS[G.sheetData.shop]||!["advice","prepare","town"].includes(el.dataset.v)||G.petSaving||G.shopSaving)return;const name=NPCS[G.sheetData.npc]?.name||"店員",city=HUBS[curHub()].name,lines={advice:["道具の用途と、持っている数から選んでください。効果がない回復では使わないので、いざという時の分も残せます。","非売品や交換専用の装備は、売る一覧にも理由を表示しています。"],prepare:["街外へ出る前にHPとMP、回復品を確かめましょう。ペット用品は育成で使うため、戦闘道具とは別です。","金庫は全街共通です。袋が満杯の時は、受取先の案内を確認してください。"],town:[`${city}の店で、旅人が次の街の話をしてくれます。今度はあなたの話も聞かせてください。`,Object.entries(QUESTS).some(([id,q])=>q.main&&q.hub===curHub()&&G.st.quests[id]==="complete")?"街の声をつないでくれてありがとう。帰り道でも立ち寄ってください。":"街外で困っている人の依頼は、街のやることで受けられます。"]};say(lines[el.dataset.v].map(text=>[name,text]));},
  managementEquipPreview(el){if(G.sheet!=="party"||!G.st.roster.includes(el.dataset.c))return;const plan=managementGearPlan(G.st,el.dataset.c,el.dataset.s,el.dataset.v||null,el.dataset.from||null);if(!plan.ok)return toast(plan.reason);openSheet("gearPreview",{cid:plan.cid,slot:plan.slot,item:plan.id,from:plan.from});},
  managementEquipConfirm(el){if(G.sheet!=="gearPreview"||el.dataset.plan!==managementEquipPlanToken(G.st,G.sheetData))return;const d={...G.sheetData};return managementMutation(el,st=>{const plan=managementGearPlan(st,d.cid,d.slot,d.item,d.from);if(!plan.ok)return plan;st.equip=plan.equipment;ensureVitals(st);return {ok:true,message:"比較した装備へ変更しました。",after:()=>{G.sheet="party";G.sheetData={cid:d.cid,view:""};G.sheetHistory=[];}};},{sound:"ok"});},
  managementExchangeDo(el){if(G.sheet!=="pointExchange"||!nearbyObjects().some(o=>o.type==="shop"))return;return managementMutation(el,st=>{const offer=managementExchangePreview(st,el.dataset.v);if(!offer.ok)return offer;st.tickets-=offer.cost;st.owned[el.dataset.v]=(st.owned[el.dataset.v]||0)+1;return {ok:true,message:`${EQUIP[el.dataset.v].name}を受け取りました。`};},{sound:"buy"});},
  managementGearSearch(){if(G.sheet!=="gearManage")return;G.sheetData.query=String($("#managementGearSearch")?.value||"").slice(0,80);G.sheetData.page=0;render();},
  managementGearPage(el){if(G.sheet!=="gearManage")return;const page=Number(el.dataset.v);if(!Number.isInteger(page)||page<0)return;G.sheetData.page=page;render();},
  managementDisposePreview(el){if(G.sheet!=="gearManage"||!EQUIP[el.dataset.v])return;openSheet("gearDispose",{item:el.dataset.v});},
  managementGearDrop(el){const id=el.dataset.v;if(G.sheet!=="gearDispose"||G.sheetData.item!==id)return;return managementMutation(el,st=>{const it=EQUIP[id];if(!it||it.exchangeOnly||it.discard===false||availableCount(st,id)<1)return {ok:false,reason:"装備中、交換専用、廃棄不可の品は処分できません。"};st.owned[id]--;return {ok:true,message:`${it.name}の未装備分を1個廃棄しました。`,after:()=>{G.sheet="gearManage";G.sheetData={};G.sheetHistory=[];}};});},
  doInn(el){return managementFacilityConfirm(el,"inn");},
  doRest(el){return managementFacilityConfirm(el,"rest");}
});
