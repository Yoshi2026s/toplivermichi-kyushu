/* ===== platform: 保存（IndexedDB＋世代）と排他 ===== */
const DB = (()=>{
  let db=null;
  function open(){ return new Promise((res,rej)=>{ try{ const r=indexedDB.open("toplivermichi-kyushu",1); r.onupgradeneeded=()=>r.result.createObjectStore("saves"); r.onsuccess=()=>{db=r.result;res(db);}; r.onerror=()=>rej(r.error);}catch(e){rej(e);} }); }
  async function tx(mode, fn){ if(!db) await open(); return new Promise((res,rej)=>{ const t=db.transaction("saves",mode,{durability:"strict"}); const s=t.objectStore("saves"); let out; fn(s,v=>out=v); t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); }
  const get=k=>tx("readonly",(s,set)=>{ const r=s.get(k); r.onsuccess=()=>set(r.result); });
  const putPair=(cur,prev)=>tx("readwrite",s=>{ if(prev) s.put(prev,"auto-prev"); s.put(cur,"auto"); });
  return { get, putPair };
})();
function checksum(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return (h>>>0).toString(16); }

const G = { st:null, screen:"title", saveStatus:"未保存", readOnly:false, hasSave:false,
  walk:{path:[], prog:0, pending:null}, cv:null, vw:11, vh:9, scale:2, raf:0, lastTs:0, frame:0,
  cmd:{}, dlg:null, sheet:null, sheetData:{}, toast:null, newGame:{name:"",gender:null,composing:false,step:1},
  battleTimer:0, lastLog:[] };
let saveChain = Promise.resolve();
function commit(){
  const st=G.st; if(!st || G.readOnly) return Promise.resolve();
  if(!st.run) ensureVitals(st);
  st.saveGeneration++;
  const json=JSON.stringify(st); const rec={gen:st.saveGeneration, time:Date.now(), state:json, sum:checksum(json)};
  setSave("保存中…");
  saveChain = saveChain.then(async()=>{
    try{ const prev=await DB.get("auto"); await DB.putPair(rec, prev&&prev.gen<rec.gen?prev:null); setSave("保存済み"); return true; }
    catch(e){ try{ localStorage.setItem("tlr-kyushu-auto", JSON.stringify(rec)); setSave("保存済み（簡易保存）"); return true; }catch(e2){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); return false; } }
  });
  return saveChain;
}
async function loadSave(){
  const decode = r => { if(!r||typeof r.state!=="string"||checksum(r.state)!==r.sum) return null; try{ const state=JSON.parse(r.state); validateState(state); return state; }catch(e){ return null; } };
  let rec=null, prev=null, local=null;
  try{ rec=await DB.get("auto"); prev=await DB.get("auto-prev"); }catch(e){}
  try{ local=JSON.parse(localStorage.getItem("tlr-kyushu-auto")||"null"); }catch(e){}
  const candidates=[
    {record:rec,storage:"indexeddb",fromPrev:false},
    {record:local,storage:"local",fromPrev:false},
    {record:prev,storage:"indexeddb",fromPrev:true}
  ].map(c=>({...c,state:decode(c.record)})).filter(c=>c.state);
  candidates.sort((a,b)=>{
    const gen=c=>Number.isSafeInteger(c.state.saveGeneration)&&c.state.saveGeneration>=0?c.state.saveGeneration:Number.isSafeInteger(c.record.gen)&&c.record.gen>=0?c.record.gen:0;
    return gen(b)-gen(a);
  });
  const best=candidates[0];
  return best?{state:best.state,time:best.record.time,storage:best.storage,fromPrev:best.fromPrev}:null;
}
function setSave(t){ G.saveStatus=t; const el=document.getElementById("saveStat"); if(el) el.textContent=t; }
function acquireLock(){
  try{ if(navigator.locks){ navigator.locks.request("toplivermichi-kyushu-owner",{ifAvailable:true}, lock=>{ if(!lock){ G.readOnly=true; render(); return; } return new Promise(()=>{}); }); } }catch(e){}
}

/* ===== ui 共通 ===== */
const $ = s=>document.querySelector(s);
const esc = s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const P = ()=>esc(G.st.profile.name);
function toast(msg){ G.toast=msg; const el=$("#toast"); if(el){ el.textContent=msg; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>{el.hidden=true;},2600);} }
function hubOf(mapId){ return MAPS[mapId].hub; }
function curHub(){ return hubOf(G.st.mapId); }
function tileAt(m,x,y){ return (m.tiles[y]&&m.tiles[y][x])||"T"; }
function objAt(m,x,y){ return m.objects.find(o=>o.x===x&&o.y===y); }
function walkable(m,x,y){ const o=objAt(m,x,y); if(o) return !!o.walk; return ".,123w=".includes(tileAt(m,x,y)); }
function zoneAt(m,x,y){ const o=objAt(m,x,y); if(o&&o.walk) return null; return m.zones[tileAt(m,x,y)]||null; }
function isSafe(){ return !zoneAt(MAPS[G.st.mapId],G.st.pos.x,G.st.pos.y); }
function busyReason(){ const st=G.st; if(st.run) return "戦闘中です。"; return null; }
function streamPending(){
  const st=G.st, active=st?.activeQuest;
  if(active&&st.quests[active]==="combatDone") return active;
  const pending=Object.keys(QUESTS).fi); track("B042",count(f.healTargets),2);
    track("B055",count(f.mpTargets),2); track("B062",count(f.commentLines),3);
    track("B094",count(f.jobs),3);
  }
  if(run.itemHistoryComplete===true){progress.B082=`（${Math.min(used,1)}/1）`;progress.B084=`（${Math.min(new Set(run.itemHistory.map(x=>x.id)).size,2)}/2）`;}
  const status=id=>{
    if(owned.has(id)) return "獲得済み";
    if(Object.hasOwn(PENDING_BADGES,id)) return "制作中";
    if(outside(id)) return "対象外";
    if(run.state==="lost") return "今回達成不可";
    if(speedImpossible[id]||itemImpossible[id]) return "今回達成不可";
    if(eligible.has(id)&&(run.state==="won"||STABLE_BATTLE_BADGES.has(id))) return "勝利で確定";
    return "未達成";
  };
  const hints={B001:"1ターン以内に勝利",B002:"3ターン以内に勝利",B007:"初ターンに実ダメージを与える",B008:"8ターン以内にボスへ勝利",B011:"基本攻撃で実ダメージを与える",B021:"3種類の行動を使う",B023:"2人が行動する",B031:"ガードで攻撃を受ける",B041:"実際に体力を回復する",B061:"コメントを使う",B081:"道具を使わず勝利する"};
  const healReady=run.party.some(m=>m.hp>0&&m.hp<m.maxHP)&&run.party.some(a=>a.hp>0&&!a.acted&&aiCandidates(run,a).some(act=>{
    if(act.type!=="item"&&act.type!=="skill"&&act.type!=="family") return false;
    const plan=planAction(run,a.pos,act);
    return plan.ok&&plan.heal.some(h=>h.amt>0&&!h.revive);
  }));
  const recommendations=Object.keys(hints).filter(id=>status(id)==="未達成"&&(id!=="B041"||healReady)).slice(0,3);
  const suggestion=recommendations.length?`<h3 class="label">今回のおすすめ</h3><ul class="list">${recommendations.map(id=>`<li>${id} ${esc(names[id])}：${hints[id]}</li>`).join("")}</ul>`:"<p class=\"small\">今おすすめできる未達成の条件はありません。</p>";
  const onlyActionable=!!G.sheetData.onlyActionable;
  const sections=BADGE_GROUPS.map((group,i)=>{const ids=Array.from({length:10},(_,n)=>`B${String(i*10+n+1).padStart(3,"0")}`);const applicable=ids.filter(id=>!Object.hasOwn(PENDING_BADGES,id)&&!outside(id));const shown=ids.filter(id=>!onlyActionable||status(id)==="未達成");return `<h3 class="label">${group}（今回の対象 ${applicable.length}件）</h3>${shown.length?`<ul class="list">${shown.map(id=>`<li>${status(id)}・${id} ${esc(names[id])}${progress[id]||""}</li>`).join("")}</ul>`:`<p class="small">表示する条件はありません。</p>`}`;}).join("");
  return `<p class="small">獲得は勝利結果で確定します。達成済みの条件も戦闘を終えるまでは未保存です。制作中・対象外は今回の対象件数から除きます。</p><button class="btn" data-a="battleChallengeFilter" aria-pressed="${onlyActionable}">${onlyActionable?"すべて表示":"今回狙える条件のみ表示"}</button>${suggestion}${sections}`;
}
function renderBadgeRecord(st){
  const implemented={...ITEM_BADGES,...GROWTH_BADGES,...PARTY_BADGES,...ACTION_BADGES,...HEAL_BADGES,...MP_BADGES,...CHEER_BADGES,...SPEED_BADGES,...ATTACK_BADGES,...GUARD_BADGES,...DEFENSE_BADGES};
  const names={...implemented,...PENDING_BADGES};
  const owned=new Set(st.battleBadges||[]), onlyMissing=!!G.sheetData.badgeOnlyUnowned;
  const acquired=Object.keys(names).filter(id=>owned.has(id)).length;
  const sections=BADGE_GROUPS.map((group,i)=>{
    const entries=Array.from({length:10},(_,n)=>`B${String(i*10+n+1).padStart(3,"0")}`).filter(id=>!onlyMissing||!owned.has(id));
    const count=Array.from({length:10},(_,n)=>`B${String(i*10+n+1).padStart(3,"0")}`).filter(id=>owned.has(id)).length;
    return `<h4 class="label">${group} ${count}/10</h4>${entries.length?`<ul class="list">${entries.map(id=>`<li>${owned.has(id)?"● 獲得済み":Object.hasOwn(implemented,id)?"○ 未獲得":"― 制作中"} ${id} ${esc(names[id])}</li>`).join("")}</ul>`:`<p class="small">この分野はすべて獲得済みです。</p>`}`;
  });
  return `<h3 class="label">戦闘バッジ</h3><p class="small">獲得${acquired}/100種。実装済み${Object.keys(implemented).length}種、制作中${Object.keys(PENDING_BADGES).length}種。</p><button class="btn" data-a="badgeFilter" aria-pressed="${onlyMissing}">${onlyMissing?"すべて表示":"未獲得のみ表示"}</button>${sections.join("")}`;
}
function renderRecord(){
  const st=G.st; const L=levelOf(st.xp);
  const milestones=[["E1","新規開始"],["D1","M01完了"],["D2","M02完了"],["D3","M03完了"],["C1","M04完了"],["C2","M05完了"],["C3","M06完了"],["B1","M07完了"],["B2","M08完了"]];
  return `<dl class="kv"><dt>共通レベル</dt><dd>${L}（経験値 ${st.xp.toLocaleString()}${L<999?`・次まで${(xpFor(L+1)-st.xp).toLocaleString()}`:"・最大"}）</dd>
    <dt>もえのシナリオ到達ランク</dt><dd>${MOE_RANKS[st.moeRank]}</dd><dt>旅</dt><dd>${st.day}日目</dd></dl>
    <p class="small">もえのランクは物語上の到達記録です。レベル・熟練度・実際の応援ポイントとは別に表示します。</p>
    <ul class="list">${milestones.map(([r,c],i)=>`<li>${i<=st.moeRank?"●":"○"} ${r}：${c}</li>`).join("")}<li class="dim">…S6：M16完了（この版には未収録）</li></ul>
    ${G.screen==="explore"&&isSafe()?`<h3 class="label">ゴールド金庫</h3><p class="small">全街共通・手数料と利息なし。金庫の残高は買物や敗北時の減額に使われません。</p><button class="btn" data-a="vaultOpen">金庫を開く（${(st.vaultGold||0).toLocaleString()}G）</button>`:""}
    <h3 class="label">仲間</h3><ul class="list">${st.roster.map(c=>{const s=charStats(st,c,L); return `<li>${esc(charName(st,c))}：${esc(JOBS[s.job].name)} 熟練度${s.R}・最大体力${s.maxHP}</li>`;}).join("")}</ul>
    <h3 class="label">九州アルバム</h3><ul class="list">${Object.entries(BOX_CARDS).map(([k,n])=>`<li>${st.cards.includes(k)?"● "+esc(n):"○ 未取得"}</li>`).join("")}</ul>
    <h3 class="label">訪れた拠点</h3><ul class="list">${Object.entries(HUBS).map(([id,h])=>`<li>${st.visitedHubs.includes(id)?"●":"○"} ${esc(h.pref)}・${esc(h.name)}</li>`).join("")}</ul>
    <h3 class="label">応援者帳</h3><ul class="list"><li>灯里（福岡市）：${st.talked.akari?"話を聞いた":"未会話"}</li><li>奏太（北九州市）：${st.talked.sota?"話を聞いた":"未会話"}</li><li>唐津の案内人：${st.talked.karatsuGuide?"話を聞いた":"未会話"}</li><li>佐賀市の案内人：${st.talked.sagaCityGuide?"話を聞いた":"未会話"}</li><li>佐世保市の案内人：${st.talked.saseboGuide?"話を聞いた":"未会話"}</li></ul>
    <h3 class="label">配信記録</h3><p>福岡の最高得点：${st.streamBest.PR01!=null?st.streamBest.PR01+"点":"未配信"}／佐賀の最高得点：${st.streamBest.PR02!=null?st.streamBest.PR02+"点":"未配信"}／長崎の最高得点：${st.streamBest.PR03!=null?st.streamBest.PR03+"点":"未配信"}</p>
    ${renderBadgeRecord(st)}
    ${st.lastResult?`<h3 class="label">直前の戦闘結果</h3><p class="small">経験値＋${st.lastResult.xp}・${st.lastResult.gold}ゴールド・${st.lastResult.jp.map(j=>`${esc(j.name)} 熟練度経験値＋${j.gain}`).join("、")}</p>`:""}`;
}
function renderGoldVault(){
  const st=G.st,d=G.sheetData,mode=d.mode==="withdraw"?"withdraw":"deposit",from=mode==="deposit"?st.gold:st.vaultGold,can=canEditVault();
  const preview=d.preview;
  return `<p>手持ち ${st.gold.toLocaleString()}G／金庫 ${st.vaultGold.toLocaleString()}G</p><p class="small">全街共通。1G単位で預入・引出できます。手数料・利息なし。金庫残高は買物・敗北時の減額に使いません。</p>
    <div class="stack"><button class="btn ${mode==="deposit"?"on":""}" data-a="vaultMode" data-v="deposit" aria-pressed="${mode==="deposit"}" ${can?"":"disabled"}>預け入れ</button><button class="btn ${mode==="withdraw"?"on":""}" data-a="vaultMode" data-v="withdraw" aria-pressed="${mode==="withdraw"}" ${can?"":"disabled"}>引き出し</button></div>
    <label class="label" for="vaultAmount">${mode==="deposit"?"預ける":"引き出す"}金額（G）</label><input id="vaultAmount" type="number" min="1" step="1" inputmode="numeric" value="${esc(d.amount||"")}" ${can&&!preview?"":"disabled"}>
    <div class="stack">${[100,1000,10000].map(n=>`<button class="btn" data-a="vaultAmount" data-v="${n}" ${can&&!preview?"":"disabled"}>${n.toLocaleString()}G</button>`).join("")}<button class="btn" data-a="vaultAmount" data-v="half" ${can&&!preview?"":"disabled"}>半分</button><button class="btn" data-a="vaultAmount" data-v="max" ${can&&!preview?"":"disabled"}>最大（${from.toLocaleString()}G）</button></div>
    ${preview?`<p class="small">${mode==="deposit"?"預入":"引出"} ${preview.amount.toLocaleString()}G：手持ち ${preview.afterGold.toLocaleString()}G／金庫 ${preview.afterVault.toLocaleString()}G</p><button class="btn primary" data-a="vaultCommit" data-token="${preview.token}" ${can?"":"disabled"}>送金を確定</button><button class="btn" data-a="vaultEdit" ${can?"":"disabled"}>金額を修正する</button>`:`<button class="btn primary" data-a="vaultPreview" ${can?"":"disabled"}>金額を確認</button>`}
    <button class="btn" data-a="vaultBack" ${G.vaultSaving?"disabled":""}>記録へ戻る</button>`;
}
function renderDex(){
  const st=G.st; const d=G.sheetData; const area=d.area||"KY01-A1"; const page=d.page||0;
  if(d.detail){
    const [a,i]=d.detail.split("|"); const e=enemyDef(a,+i); const seen=st.seen[e.id];
    const q=e.q; const steps=e.cycle.map(([t,p])=>t==="c"?"ため":`${t==="s"?"単体":"全体"}${p+Math.floor(4*(q-1)/5)}`).join(" → ");
    return `<div class="who"><canvas class="sprite-lg" data-dex="${a}|${i}" width="32" height="32" aria-hidden="true"></canvas><div><b>${esc(e.name)}</b><br><span class="small">${e.id}</span></div></div>
      <dl class="kv"><dt>種族／属性／種類</dt><dd>${esc(e.species)}／${esc(e.attr)}／${esc(e.type)}</dd><dt>レア度</dt><dd>${"★".repeat(e.rarity)} ${["","通常","やや珍しい","希少","極希少","幻影"][e.rarity]}</dd>
      <dt>エリア</dt><dd>${esc(AREAS[a].name)}・推奨レベル${q}</dd><dt>体力／防御力</dt><dd>${e.baseHP+12*(q-1)}／${e.baseDEF+Math.floor((q-1)/12)}（標準）</dd>
      <dt>行動周期</dt><dd>${steps}</dd><dt>対処</dt><dd>${esc(e.counter)}</dd>
      <dt>1枠の出現率</dt><dd>${(e.weight/100).toFixed(2)}%</dd><dt>歩行遭遇率</dt><dd>危険タイル1歩ごとに1/24</dd>
      <dt>記録</dt><dd>${seen?"遭遇済み":"未遭遇"}・討伐${st.killCount[e.id]||0}</dd></dl>
      <button class="btn" data-a="dexNav" data-k="detail" data-v="">一覧へ戻る</button>`;
  }
  const list=AREAS[area].list.map((_,i)=>enemyDef(area,i));
  const seenN=list.filter(e=>st.seen[e.id]).length;
  return `<div class="opts">${Object.keys(AREAS).map(a=>`<button class="btn opt ${a===area?"on":""}" data-a="dexNav" data-k="area" data-v="${a}">${a===area?"▶ ":""}${esc(MAPS[a.slice(0,4)].name)}・${esc(AREAS[a].name)}</button>`).join("")}</div>
    <p class="small">${esc(AREAS[area].name)}：50件中 遭遇済み${seenN}件（${page*10+1}～${page*10+10}件目を表示）</p>
    <div class="stack">${list.slice(page*10,page*10+10).map((e,k)=>`<button class="btn dexrow" data-a="dexNav" data-k="detail" data-v="${area}|${page*10+k}"><span>${st.seen[e.id]?"●":"○"} ${esc(e.name)}</span><span class="small">${esc(e.species)}／${esc(e.attr)}／${"★".repeat(e.rarity)}</span></button>`).join("")}</div>
    <div class="row3"><button class="btn" data-a="dexNav" data-k="page" data-v="${page-1}" ${page>0?"":"disabled"}>前の10件</button><span></span><button class="btn" data-a="dexNav" data-k="page" data-v="${page+1}" ${page<4?"":"disabled"}>次の10件</button></div>`;
}
function renderShop(){
  const st=G.st; const d=G.sheetData; const S=SHOPS[d.shop]; const tab=d.tab||"buy";
  const locked = !!st.run || !!streamPending() || !!G.shopSaving;
  const head=`<p>所持 ${st.gold.toLocaleString()}ゴールド・道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類</p><div class="row3"><button class="btn ${tab==="buy"?"on":""}" data-a="shopTab" data-v="buy">装備を買う</button><button class="btn ${tab==="item"?"on":""}" data-a="shopTab" data-v="item">道具を買う</button><button class="btn ${tab==="sell"?"on":""}" data-a="shopTab" data-v="sell">売る</button></div>${locked?`<p class="warn">配信待ちの間は売買できません。</p>`:""}`;
  if(d.item && ITEMS[d.item]){
    const it=ITEMS[d.item]; const qty=d.qty||1; const own=bagCount(st.bag,d.item);
    if(tab==="item"){ const room=itemPurchaseRoom(st,d.item),bagSpace=bagRoom(st.bag,d.item); const total=it.price*qty; const can=!locked&&qty<=room&&st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>（${esc(ITEM_RARITY[it.stars])}）</p><p>${esc(itemText(it,Vof(levelOf(st.xp))))}。${it.battleOnly?"戦闘中だけ使えます。":"戦闘中・移動中に使えます。"}</p><p>単価${it.price}ゴールド・所持${own}/${BAG_STACK}</p>${qtyRow(qty,Math.max(1,room))}${qty>bagSpace?`<p class="small">袋に入らない${qty-bagSpace}個はアイテム金庫へ保管します。</p>`:""}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${room<=0?"道具袋と金庫がいっぱいです。":qty>room?`あと${room}個までしか受け取れません。`:st.gold<total?"ゴールドが足りません。":""}</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を買う</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`; }
    const unit=it.sell; const can=!locked&&unit>=0&&qty<=own;
    return head+`<p><b>${esc(it.name)}</b>　所持${own}</p>${unit<0?`<p class="warn">この道具は売れません（${esc(ITEM_ACQ[it.acq])}）。</p>`:`<p>買取単価${unit}ゴールド</p>${qtyRow(qty,Math.max(1,own))}<p>受取${unit*qty}ゴールド → 取引後${(st.gold+unit*qty).toLocaleString()}ゴールド</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を売る</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`;
  }
  if(tab==="item"){
    return head+`<div class="stack">${SHOP_ITEMS.map(id=>{const it=ITEMS[id]; return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(it.name)}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${it.price}ゴールド・${esc(itemText(it,Vof(levelOf(st.xp))))}・所持${bagCount(st.bag,id)}</span></button>`;}).join("")}</div><p class="small">道具袋は通常300種類・イベント400種類、1種類99個まで。各県の店で品ぞろえが増えます（この版は福岡の品）。</p>`;
  }
  if(d.item){
    const it=EQUIP[d.item]; const qty=d.qty||1; const own=st.owned[d.item]||0;
    if(tab==="buy"){ const total=it.price*qty,room=shopOffer(st,{shop:d.shop,tab:"buy",item:d.item,qty})?.max||0,can=!locked&&qty<=room&&st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>：${esc(itemText(it,Vof(levelOf(st.xp))))}</p><p>単価${it.price}ゴールド・手元${own}個・金庫${bagCount(st.itemVault,d.item)}個（合計上限8）・未装備品${unequippedGearCount(st)}/${UNEQUIPPED_GEAR_MAX}</p>${qtyRow(qty,Math.max(1,room))}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${own+bagCount(st.itemVault,d.item)+qty>8?"金庫の分を含め、同じ装備の所持上限8を超えます。":qty>room?"未装備品の上限300個を超えます。":st.gold<total?"ゴールドが足りません。":""}</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を買う</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`; }
    const sellable=availableCount(st,d.item); const unit=Math.floor(it.price/2); const can=!locked&&qty<=sellable;
    return head+`<p><b>${esc(it.name)}</b>　所持${own}・装備中${equippedCount(st,d.item)}・売却可能${sellable}</p><p>買取単価${unit}ゴールド${unit===0?"（返却してもゴールドは増えません）":""}</p>${qtyRow(qty,Math.max(1,sellable))}<p>受取${unit*qty}ゴールド → 取引後${(st.gold+unit*qty).toLocaleString()}ゴールド</p>
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can&&sellable>0?"":"disabled"}>${esc(it.name)}×${qty}を売る</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`;
  }
  if(tab==="buy"){
    const ex=[...JOB_IDS.filter(j=>st.gifts.W[j]).map(j=>"JW"+j.slice(1)), ...JOB_IDS.filter(j=>st.gifts.A[j]).map(j=>"JA"+j.slice(1))];
    return head+`<div class="stack">${[...S.items,...ex].map(id=>{const it=EQUIP[id]; const who=st.roster.filter(c=>!it.job||(st.jobs[c]===it.job&&rankOf(jpOf(st,c,it.job))>=it.needR)).length; return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(it.name)}</span><span class="small">${it.price}ゴールド・${esc(itemText(it,Vof(levelOf(st.xp))))}・装備できる人${who}</span></button>`;}).join("")}</div><p class="small">地域の強化品は各県の店で順次追加されます（この版は福岡の共通品と専用品）。</p>`;
  }
  const ids=Object.keys(st.owned).filter(id=>st.owned[id]>0);
  return head+`<h3 class="label">装備</h3><div class="stack">${ids.map(id=>`<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(EQUIP[id].name)}</span><span class="small">所持${st.owned[id]}・売却可能${availableCount(st,id)}・買取${Math.floor(EQUIP[id].price/2)}ゴールド</span></button>`).join("")}</div>
    <h3 class="label">道具</h3><div class="stack">${st.bag.map(e=>{const it=ITEMS[e.id]; return `<button class="btn dexrow" data-a="shopItem" data-v="${e.id}"><span>${esc(it.name)}</span><span class="small">所持${e.n}・${it.sell<0?"売却不可":`買取${it.sell}ゴールド`}</span></button>`;}).join("")||`<p class="small">道具はありません。</p>`}</div>`;
}
function itemPurchaseRoom(st,id){ return bagRoom(st.bag,id)+Math.max(0,ITEM_VAULT_MAX-itemVaultCount(st)); }
function shopOffer(st,d){
  if(!SHOPS[d.shop]||!["buy","item","sell"].includes(d.tab)||!Number.isSafeInteger(d.qty)||d.qty<1) return null;
  const id=d.item, item=Object.hasOwn(ITEMS,id), equip=Object.hasOwn(EQUIP,id);
  if(!item&&!equip) return null;
  if(d.tab==="item"&&!item||d.tab==="buy"&&!equip) return null;
  if(d.tab==="item"&&!SHOP_ITEMS.includes(id)) return null;
  if(d.tab==="buy"){
    const gifts=[...JOB_IDS.filter(j=>st.gifts.W[j]).map(j=>"JW"+j.slice(1)),...JOB_IDS.filter(j=>st.gifts.A[j]).map(j=>"JA"+j.slice(1))];
    if(!SHOPS[d.shop].items.includes(id)&&!gifts.includes(id)) return null;
  }
  const own=item?bagCount(st.bag,id):(st.owned[id]||0);
  const max=d.tab==="item"?itemPurchaseRoom(st,id):d.tab==="buy"?Math.max(0,Math.min(8-own-bagCount(st.itemVault,id),UNEQUIPPED_GEAR_MAX-unequippedGearCount(st))):item?own:availableCount(st,id);
  const unit=d.tab==="sell"?(item?ITEMS[id].sell:Math.floor(EQUIP[id].price/2)):(item?ITEMS[id].price:EQUIP[id].price);
  return {shop:d.shop,tab:d.tab,item:id,qty:d.qty,unit,own,max,gold:st.gold};
}
function shopOfferToken(st,d){ const offer=shopOffer(st,d); return offer?checksum(JSON.stringify(offer)):""; }
function canTradeAtShop(d){ return !!G.st&&!G.readOnly&&!G.shopSaving&&G.screen==="explore"&&G.sheet==="shop"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&!streamPending()&&isSafe()&&nearbyObjects().some(o=>o.type==="shop"&&o.shop===d.shop); }
function tradeSnapshot(st){ return {gold:st.gold,bag:clone(st.bag),itemVault:clone(st.itemVault),keep:clone(st.keep),owned:clone(st.owned)}; }
function restoreTrade(st,snap){ Object.assign(st,snap); }
function itemText(it,V){ return it.text.replace(/(\d+)×V/g,(m,n)=>String(+n*V)).replace("−防御のダメージ","から敵の防御力を引いたダメージ"); }
function keepFlush(){
  const st=G.st;
  if(!st||G.readOnly||G.screen!=="explore"||G.sheet||G.dlg||st.run||!st.keep||!st.keep.length||!isSafe()) return 0;
  const before={bag:clone(st.bag),itemVault:clone(st.itemVault),keep:clone(st.keep),gen:st.saveGeneration};
  const moved=flushKeep(st),n=moved.bagged+moved.vaulted;
  if(n){
    const after=JSON.stringify([st.bag,st.itemVault,st.keep]);
    commit().then(saved=>{
      if(saved||G.st!==st||st.saveGeneration!==before.gen+1||JSON.stringify([st.bag,st.itemVault,st.keep])!==after) return;
      st.bag=before.bag; st.itemVault=before.itemVault; st.keep=before.keep; st.saveGeneration=before.gen;
      render(); toast("預かり所からの受取を取り消しました。保存できませんでした。");
    });
    toast(`預かり所から道具を${n}個受け取った。${moved.vaulted?`うち${moved.vaulted}個はアイテム金庫へ保管した。`:""}`);
  }
  return n;
}
function canEditParty(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="party"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function canEditVault(){ return !!G.st&&!G.readOnly&&!G.vaultSaving&&G.screen==="explore"&&G.sheet==="goldVault"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe()&&!streamPending(); }
function canViewItemVault(){ return !!G.st&&G.screen==="explore"&&G.sheet==="itemVault"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function canEditItemVault(){ return canViewItemVault()&&!G.readOnly&&!G.vaultSaving&&!streamPending(); }
function vaultAmountValue(raw,from,to){
  const value=String(raw);
  if(!/^[1-9][0-9]*$/.test(value)) return 0;
  const amount=Number(value);
  return Number.isSafeInteger(amount)&&Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&amount<=from&&Number.isSafeInteger(to+amount)?amount:0;
}
function canEditItems(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="items"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&!streamPending(); }
function canManageQuests(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="quests"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&!streamPending(); }
function canTravelFrom(sheet){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet===sheet&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function dropToken(st,id){ return ITEMS[id]?checksum(JSON.stringify([id,bagCount(st.bag,id),st.bag.length])):""; }
function renderItems(){
  const st=G.st, d=G.sheetData||{}; const L=levelOf(st.xp);
  if(d.item && ITEMS[d.item] && bagCount(st.bag,d.item)>0){
    const it=ITEMS[d.item], n=bagCount(st.bag,d.item), nd=itemNeeds(it);
    let use="";
    if(it.battleOnly) use=`<p class="small">攻撃の道具は戦闘中の「道具」から使います。</p>`;
    else if(nd==="allyAll"||nd==="downAll") use=`<button class="btn primary" data-a="itemUse">使う（${nd==="downAll"?"戦闘不能の全員":"全員"}）</button>`;
    else use=`<h3 class="label">誰に使う？</h3>`+st.roster.map(c=>{const s=charStats(st,c,L),v=vitalOf(c); const dis = nd==="down"? v.hp>0 : v.hp<=0; return `<button class="btn ${isLow(v.hp,s.maxHP)?"low":""}" data-a="itemUse" data-c="${c}" ${dis?"disabled":""}>${esc(charName(st,c))}　体力 ${v.hp}/${s.maxHP}・集中力 ${v.c}/${s.startC}${v.hp<=0?"（戦闘不能）":""}</button>`;}).join("");
    return `<p><b>${esc(it.name)}</b>　×${n}</p><p class="small">${esc(ITEM_RARITY[it.stars])}・${esc(it.cat)}・入手：${esc(ITEM_ACQ[it.acq])}${it.sell>=0?`・売値${it.sell}ゴールド`:"・売却不可"}</p><p>${esc(itemText(it,Vof(levelOf(st.xp))))}。${it.battleOnly?"戦闘中だけ使えます。":"戦闘中・移動中に使えます。"}</p>
      <div class="stack">${use}${d.confirmDrop?`<p class="warn">${esc(it.name)}を1個捨てますか？ ${it.acq==="E"?"イベントの品は二度と手に入りません。":""}</p><button class="btn" data-a="itemDropDo" data-drop="${dropToken(st,d.item)}">捨てる</button><button class="btn" data-a="itemDropNo">やめる</button>`:`<button class="btn" data-a="itemDrop">1個捨てる</button>`}<button class="btn" data-a="itemView" data-v="">一覧へ</button></div>`;
  }
  return `<p class="small">道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類（1種類${BAG_STACK}個まで）。回復・蘇生は移動中にも使えます。</p>
    <div class="stack">${st.bag.map(e=>{const it=ITEMS[e.id]; return `<button class="btn dexrow" data-a="itemView" data-v="${e.id}"><span>${esc(it.name)}　×${e.n}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${esc(itemText(it,Vof(levelOf(st.xp))))}${it.battleOnly?"（戦闘のみ）":""}</span></button>`;}).join("")||`<p>道具を持っていません。ショップで買えます。</p>`}</div>
    <h3 class="label">アイテム金庫（${itemVaultCount(st)}/${ITEM_VAULT_MAX}）</h3><p class="small">道具と未装備品を全街共通で保管します。${st.pendingGifts?.length?`受取保留の贈り物が${st.pendingGifts.length}件あります。`:""}</p>${st.itemVault.length?`<ul class="list">${st.itemVault.map(e=>`<li>${esc((ITEMS[e.id]||EQUIP[e.id]).name)} ×${e.n}</li>`).join("")}</ul>`:""}${G.screen==="explore"&&isSafe()?`<button class="btn" data-a="itemVaultOpen">金庫の${G.readOnly?"中身を見る":"品物を出し入れ"}</button>`:""}
    ${st.keep&&st.keep.length?`<h3 class="label">宿屋の預かり所（${st.keep.length}/${KEEP_MAX}）</h3><p class="small">安全な場所で、袋またはアイテム金庫に空きがあれば自動的に受け取ります。</p><ul class="list">${st.keep.map(id=>`<li>${esc(ITEMS[id].name)}</li>`).join("")}</ul>`:""}`;
}
function vaultHeldCount(st,id){ return EQUIP[id]?availableCount(st,id):bagCount(st.bag,id); }
function vaultTransferRoom(st,mode,id){
  if(mode==="deposit") return Math.min(vaultHeldCount(st,id),ITEM_VAULT_MAX-itemVaultCount(st));
  const stored=bagCount(st.itemVault,id);
  return EQUIP[id]?Math.min(stored,8-(st.owned[id]||0),UNEQUIPPED_GEAR_MAX-unequippedGearCount(st)):Math.min(stored,bagRoom(st.bag,id));
}
function vaultEntries(st,mode){
  if(mode==="withdraw") return st.itemVault;
  return [...st.bag,...Object.keys(st.owned).filter(id=>EQUIP[id]&&availableCount(st,id)>0).map(id=>({id,n:availableCount(st,id)}))];
}
function vaultCategory(id){ return EQUIP[id]?"gear":ITEMS[id]?.acq==="E"?"event":"normal"; }
function vaultName(id){ return (ITEMS[id]||EQUIP[id])?.name||id; }
function pendingGiftBlockReason(st,id){
  if((st.owned[id]||0)+bagCount(st.itemVault,id)>=8) return "同じ装備が8個あります";
  if(unequippedGearCount(st)>=UNEQUIPPED_GEAR_MAX&&itemVaultCount(st)>=ITEM_VAULT_MAX) return "手元と金庫が満杯です";
  return "";
}
function renderItemVault(){
  const st=G.st,d=G.sheetData,mode=d.mode==="withdraw"?"withdraw":"deposit",source=vaultEntries(st,mode),query=String(d.query||"").trim().toLocaleLowerCase(),filter=d.filter||"all",list=source.filter(e=>(ITEMS[e.id]||EQUIP[e.id])&&(filter==="all"||filter===vaultCategory(e.id))&&(!query||e.id.toLocaleLowerCase().includes(query)||vaultName(e.id).toLocaleLowerCase().includes(query))),pages=Math.max(1,Math.ceil(list.length/10)),page=Math.max(0,Math.min(pages-1,d.page||0)),id=d.id||"",max=id?vaultTransferRoom(st,mode,id):0,qty=d.qty||1,can=canEditItemVault(),view=canViewItemVault(),p=d.preview;
  return `<p>道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類・未装備品${unequippedGearCount(st)}/${UNEQUIPPED_GEAR_MAX}個・金庫 ${itemVaultCount(st)}/${ITEM_VAULT_MAX}個</p>${G.readOnly?`<p class="small">閲覧専用：移動できません。</p>`:""}${st.pendingGifts?.length?`<h3 class="label">受取保留の贈り物</h3><p class="small">同じ装備の上限と手元・金庫の空きを確認して受け取れます。</p><div class="stack">${st.pendingGifts.map(id=>`<div><button class="btn" data-a="pendingGiftClaim" data-v="${id}" ${can&&!G.vaultSaving&&!pendingGiftBlockReason(st,id)?"":"disabled"}>${esc(EQUIP[id].name)}を受け取る</button>${pendingGiftBlockReason(st,id)?`<span class="small">${pendingGiftBlockReason(st,id)}</span>`:""}</div>`).join("")}</div>`:""}<div class="stack"><button class="btn ${mode==="deposit"?"on":""}" data-a="itemVaultMode" data-v="deposit" ${view&&!G.vaultSaving?"":"disabled"}>預け入れ</button><button class="btn ${mode==="withdraw"?"on":""}" data-a="itemVaultMode" data-v="withdraw" ${view&&!G.vaultSaving?"":"disabled"}>引き出し</button></div>
    <div class="stack">${[["all","すべて"],["normal","通常の道具"],["event","イベント限定道具"],["gear","未装備品"]].map(([k,label])=>`<button class="btn ${filter===k?"on":""}" data-a="itemVaultFilter" data-v="${k}" aria-pressed="${filter===k}" ${view&&!G.vaultSaving?"":"disabled"}>${label}</button>`).join("")}</div><label class="label" for="itemVaultSearch">名前・IDで検索</label><input id="itemVaultSearch" value="${esc(d.query||"")}" maxlength="60"><button class="btn" data-a="itemVaultSearch" ${view&&!G.vaultSaving?"":"disabled"}>検索</button><div class="stack">${list.slice(page*10,page*10+10).map(e=>`<button class="btn ${id===e.id?"on":""}" data-a="itemVaultSelect" data-v="${e.id}" ${view&&!G.vaultSaving&&!p?"":"disabled"}>${esc(vaultName(e.id))} ×${e.n} <span class="small">${vaultCategory(e.id)==="gear"?"装備":vaultCategory(e.id)==="event"?"イベント限定":"道具"}</span></button>`).join("")||"該当する品はありません。"}</div><div class="row3"><button class="btn" data-a="itemVaultPage" data-v="${page-1}" ${view&&page>0?"":"disabled"}>前の10件</button><span>${page+1}/${pages}ページ</span><button class="btn" data-a="itemVaultPage" data-v="${page+1}" ${view&&page+1<pages?"":"disabled"}>次の10件</button></div>
    ${id&&(ITEMS[id]||EQUIP[id])?`<p>${esc(vaultName(id))}：移動できる数 ${max}個</p><div class="stack">${[["1個",1],["5個",5],["10個",10],[`最大（${max}個）`,max]].filter(([label])=>!label.startsWith("最大")||![1,5,10].includes(max)).map(([label,n])=>`<button class="btn" data-a="itemVaultQty" data-v="${n}" ${can&&!p&&n>=1&&n<=max?"":"disabled"}>${label}</button>`).join("")}</div><p>選択 ${qty}個</p>${p?`<p>${EQUIP[id]?"未装備":"袋"} ${p.bagBefore}→${p.bagAfter}個／金庫 ${p.vaultBefore}→${p.vaultAfter}個</p><button class="btn primary" data-a="itemVaultCommit" data-token="${p.token}" ${can?"":"disabled"}>移動を確定</button><button class="btn" data-a="itemVaultEdit" ${can?"":"disabled"}>選び直す</button>`:`<button class="btn primary" data-a="itemVaultPreview" ${can&&qty<=max?"":"disabled"}>数量を確認</button>`}`:""}<button class="btn" data-a="itemVaultBack" ${G.vaultSaving?"disabled":""}>道具へ戻る</button>`;
}
function qtyRow(q,max){ return `<div class="row3"><button class="btn" data-a="shopQty" data-v="${q-1}" ${q>1?"":"disabled"}>−</button><span class="qty">数量 ${q}個（最大${max}個）</span><button class="btn" data-a="shopQty" data-v="${q+1}" ${q<max?"":"disabled"}>＋</button></div>`; }
function renderMoe(){
  const st=G.st; const r=MOE_RANKS[st.moeRank];
  const line = st.moeRank===0?"まずは福岡の声を整えよう。放送塔の丘の奥で、大きな重なりが起きてるみたい。":st.moeRank===1?"北九州の港で、初めての採点配信をしたいな。準備、手伝ってくれる？":st.moeRank===2?"福岡、ありがとう。唐津でも、一人ずつの声に返事をしていきたい。":st.moeRank===3?"唐津の声を聞けたね。次は佐賀市で、街の声をつなごう。":st.moeRank===4?"佐賀市の声も届けられたね。次は佐世保市で港からの返事を聞こう。":"佐世保市の返事も届けられたね。次の旅に向けて準備しよう。";
  const read=Object.keys(SCENES).filter(k=>st.scenes[k]);
  return `<div class="who"><canvas class="sprite-md" data-char="moe" width="16" height="24" aria-hidden="true"></canvas><div><b>雪餅羽もえ</b>（のわんもえ）<br><span class="small">メインライバー・シナリオ到達ランク ${r}</span></div></div>
    <p class="dlg-text">「${esc(line)}」</p>
    <h3 class="label">物語を読み返す</h3><div class="stack">${read.length?read.map(k=>`<button class="btn" data-a="replay" data-v="${k}">${esc(SCENES[k].title)}</button>`).join(""):`<p class="small">まだありません。</p>`}</div>`;
}
function renderStreamSetup(){
  const st=G.st; const d=G.sheetData;
  const hosts=st.roster.filter(c=>c!=="moe");
  d.host=d.host||hosts[0]; d.theme=d.theme||"newbie"; d.style=d.style||"video";
  const req=STREAM_REQ[HUBS[curHub()].prefId];
  return `<p>メインライバーはもえ。配信サポート担当とテーマを選びます。人物・ジョブによる得点差はありません。</p>
    <h3 class="label">配信サポート担当</h3><div class="opts">${hosts.map(c=>`<button class="btn opt ${d.host===c?"on":""}" data-a="ssSet" data-k="host" data-v="${c}">${d.host===c?"▶ ":""}${esc(charName(st,c))}</button>`).join("")}</div>
    <h3 class="label">番組テーマ</h3><div class="opts">${Object.entries(STREAM_THEMES).map(([k,t])=>`<button class="btn opt ${d.theme===k?"on":""}" data-a="ssSet" data-k="theme" data-v="${k}">${d.theme===k?"▶ ":""}${t.name}（${STREAM_ACTS[t.act].name}の初回に＋10）</button>`).join("")}</div>
    <h3 class="label">スタイル</h3><div class="opts">${[["video","映像あり"],["voice","声中心"]].map(([k,n])=>`<button class="btn opt ${d.style===k?"on":""}" data-a="ssSet" data-k="style" data-v="${k}">${d.style===k?"▶ ":""}${n}</button>`).join("")}</div>
    <h3 class="label">4手番の予定</h3><ol class="list">${req.map((r,i)=>`<li>${STREAM_TIMES[i]}：「${esc(STREAM_ACTS[r].req)}」→ ${esc(STREAM_ACTS[r].name)}</li>`).join("")}</ol>
    <p class="small">得点：初めて使う行動20点＋要望に合えば20点＋テーマ初回10点。最大170点、80点で達成。</p>
    <button class="btn primary wide" data-a="streamStart">配信を始める</button>`;
}

/* ===== 操作の受付 ===== */
const ACT = {
  battleLogLine(el){ if(G.screen!=="battle"||!G.st?.run||G.dlg||!['battleLog',null].includes(G.sheet)) return; const lines=Array.isArray(G.st.run.log)?G.st.run.log:[],index=Number(el.dataset.v),first=Math.max(0,lines.length-80); if(!Number.isInteger(index)||index<first||index>=lines.length) return; const reversed=lines.length-1-index; G.sheet='battleLog'; G.sheetData={page:Math.floor(reversed/8),line:reversed}; render(); },
  battleLogBack(){ if(G.screen!=="battle"||G.sheet!=="battleLog"||!G.st?.run) return; delete G.sheetData.line; render(); },
  battleLogExpand(){ if(G.screen!=="battle"||G.sheet||G.dlg||!G.st?.run) return; if(G.auto){G.auto=false;clearTimeout(G.autoT);G.autoLast=null;G.cmd={};G.cursorSig=null;} G.logExpanded=!G.logExpanded; render(); },
  battleLogPage(el){ if(G.screen!=="battle"||G.sheet!=="battleLog"||!G.st?.run) return; const lines=Array.isArray(G.st.run.log)?G.st.run.log:[]; const pages=Math.max(1,Math.ceil(Math.min(lines.length,80)/8)); const page=Number(el.dataset.v); if(!Number.isInteger(page)||page<0||page>=pages) return; G.sheetData.page=page; render(); },
  newGame(){ if(G.screen!=="title") return; G.newGame={name:"",gender:null,composing:false,step:1}; G.screen="new"; render(); },
  pickGender(el){ G.newGame.gender=el.dataset.v; const inp=$("#nameInput"); if(inp) G.newGame.name=inp.value; render(); },
  newNext(){ if(G.screen!=="new"||G.newGame.step!==1||G.newGame.composing) return; const inp=$("#nameInput"); if(inp) G.newGame.name=inp.value; const v=validateName(G.newGame.name); if(!v.ok) return toast(v.errors[0]); if(!G.newGame.gender) return toast("性別を選んでください。"); G.newGame.name=v.value; G.newGame.step=2; render(); },
  newBack(){ G.newGame.step=1; render(); },
  async startGame(el){
    if(G.starting||G.screen!=="new"||G.newGame.step!==2||G.newGame.composing||!["男性","女性"].includes(G.newGame.gender)) return; G.starting=true; el.disabled=true;
    const v=validateName(G.newGame.name); if(!v.ok){ G.starting=false; return toast(v.errors[0]); }
    const snd=soundIsOn(); G.st=newGame(v.value, G.newGame.gender); if(G.tmpSettings) Object.assign(G.st.settings,G.tmpSettings); G.st.settings.sound=snd; G.st.settings.soundV=2; G.st.settings.padSide=padSide(); G.soundWant=null;
    await commit(); G.starting=false; G.hasSave=true;
    G.screen="explore"; exploreBgm(); render(); playScene("HS00");
  },
  async continue(){ const s=await loadSave(); if(!s) return toast("記録が見つかりません。"); const hadStream=!!s.state.stream,oldPos=s.state.pos&&{x:s.state.pos.x,y:s.state.pos.y}; G.st=migrate(s.state); G.soundWant=null; setSave(s.fromPrev?"前の記録から復旧":s.storage==="local"?"保存済み（簡易保存）":"保存済み"); if(G.st.settings.sound===false&&SND.on) SND.setOn(false); else if(G.st.settings.sound!==false&&!SND.on) SND.setOn(true);
    if(G.st.run){ G.screen="battle"; SND.play(G.st.run.kind==="boss"?"boss":"battle"); } else if(G.st.stream){ G.screen="stream"; SND.play("stream"); } else { G.screen="explore"; exploreBgm(); }
    render(); const notices=[]; if(s.fromPrev) notices.push("前の世代の記録から再開しました。設定からバックアップを確認できます。"); if(hadStream&&!G.st.stream) notices.push("配信記録に欠損があったため解除しました。依頼帳で状態を確認してください。"); if(!oldPos||oldPos.x!==G.st.pos.x||oldPos.y!==G.st.pos.y) notices.push("保存位置を現在の地形に合わせて拠点の安全地帯へ戻しました。"); if(notices.length) toast(notices.join(" ")); },
  toTitle(){ G.sheet=null; G.screen="title"; G.dlg=null; SND.play("title"); render(); },
  openSheet(el){ openSheet(el.dataset.k); }, closeSheet(){ closeSheet(); },
  badgeFilter(){ if(G.sheet!=="record") return; G.sheetData.badgeOnlyUnowned=!G.sheetData.badgeOnlyUnowned; render(); },
  battleChallengeFilter(){ if(G.sheet!=="battleChallenges") return; G.sheetData.onlyActionable=!G.sheetData.onlyActionable; render(); },
  vaultOpen(){ if(!G.st||G.screen!=="explore"||G.sheet!=="record"||G.dlg||G.st.run||!isSafe()||G.walk.path.length) return; openSheet("goldVault",{mode:"deposit",amount:"",preview:null}); },
  itemVaultOpen(){ if(!G.st||G.screen!=="explore"||G.sheet!=="items"||G.dlg||G.st.run||G.walk.path.length||!isSafe()||G.vaultSaving) return; openSheet("itemVault",{mode:"deposit",id:null,qty:1,preview:null,query:"",page:0}); },
  async pendingGiftClaim(el){
    if(!canEditItemVault()||G.vaultSaving) return;
    const st=G.st,id=el.dataset.v,before={owned:clone(st.owned),itemVault:clone(st.itemVault),pendingGifts:clone(st.pendingGifts||[])},gen=st.saveGeneration;
    const destination=claimPendingGift(st,id); if(!destination) return toast("受取先に空きがありません。");
    el.disabled=true; G.vaultSaving=true; const after=JSON.stringify([st.owned,st.itemVault,st.pendingGifts]); render();
    let saved=false; try{ saved=await commit(); }catch(e){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); } finally{ G.vaultSaving=false; }
    let rolledBack=false; if(!saved&&G.st===st&&st.saveGeneration===gen+1&&JSON.stringify([st.owned,st.itemVault,st.pendingGifts])===after){ st.owned=before.owned; st.itemVault=before.itemVault; st.pendingGifts=before.pendingGifts; st.saveGeneration=gen; rolledBack=true; }
    if(G.st===st){ render(); toast(saved?`${EQUIP[id].name}を${destination}へ受け取った。`:rolledBack?"保存できなかったため受取を取り消しました。":"受取を保存できませんでした。バックアップを書き出してください。"); }
  },
  itemVaultBack(){ if(G.sheet!=="itemVault"||G.vaultSaving) return; openSheet("items"); },
  itemVaultMode(el){ if(!canViewItemVault()||G.vaultSaving||!['deposit','withdraw'].includes(el.dataset.v)) return; G.sheetData={mode:el.dataset.v,id:null,qty:1,preview:null,query:G.sheetData.query||"",filter:G.sheetData.filter||"all",page:0}; render(); },
  itemVaultFilter(el){ if(!canViewItemVault()||G.vaultSaving||!["all","normal","event","gear"].includes(el.dataset.v)) return; G.sheetData.filter=el.dataset.v; G.sheetData.page=0; G.sheetData.id=null; G.sheetData.preview=null; render(); },
  itemVaultSearch(){ if(!canViewItemVault()||G.vaultSaving) return; G.sheetData.query=String($("#itemVaultSearch")?.value||"").slice(0,60); G.sheetData.page=0; G.sheetData.id=null; G.sheetData.preview=null; render(); },
  itemVaultPage(el){ if(!canViewItemVault()||G.vaultSaving) return; const d=G.sheetData,q=String(d.query||"").trim().toLocaleLowerCase(),filter=d.filter||"all",count=vaultEntries(G.st,d.mode).filter(e=>(ITEMS[e.id]||EQUIP[e.id])&&(filter==='all'||filter===vaultCategory(e.id))&&(!q||e.id.toLocaleLowerCase().includes(q)||vaultName(e.id).toLocaleLowerCase().includes(q))).length,pages=Math.max(1,Math.ceil(count/10)),next=Number(el.dataset.v); if(!Number.isInteger(next)||next<0||next>=pages) return; d.page=next; d.id=null; d.preview=null; render(); },
  itemVaultSelect(el){ if(!canViewItemVault()||G.vaultSaving||G.sheetData.preview||!(ITEMS[el.dataset.v]||EQUIP[el.dataset.v])) return; const id=el.dataset.v,source=vaultEntries(G.st,G.sheetData.mode); if(bagCount(source,id)<1) return; G.sheetData.id=id; G.sheetData.qty=1; render(); },
  itemVaultQty(el){ if(!canEditItemVault()||G.sheetData.preview) return; const n=Number(el.dataset.v),d=G.sheetData,id=d.id,max=vaultTransferRoom(G.st,d.mode,id); if(!Number.isSafeInteger(n)||n<1||n>max) return; d.qty=n; render(); },
  itemVaultEdit(){ if(!canEditItemVault()) return; G.sheetData.preview=null; render(); },
  itemVaultPreview(){ if(!canEditItemVault()) return; const st=G.st,d=G.sheetData,id=d.id,n=d.qty,mode=d.mode,bagBefore=vaultHeldCount(st,id),vaultBefore=bagCount(st.itemVault,id),total=itemVaultCount(st); if(!(ITEMS[id]||EQUIP[id])||!Number.isSafeInteger(n)||n<1||vaultTransferRoom(st,mode,id)<n) return toast('数量と空きを確認してください。'); const p={mode,id,n,bagBefore,vaultBefore,total,gen:st.saveGeneration,bagAfter:bagBefore+(mode==='deposit'?-n:n),vaultAfter:vaultBefore+(mode==='deposit'?n:-n)}; p.token=checksum(JSON.stringify(p)); d.preview=p; render(); },
  async itemVaultCommit(el){ if(!canEditItemVault()) return; const st=G.st,d=G.sheetData,p=d.preview; if(!p||el.dataset.token!==p.token||checksum(JSON.stringify({mode:p.mode,id:p.id,n:p.n,bagBefore:p.bagBefore,vaultBefore:p.vaultBefore,total:p.total,gen:p.gen,bagAfter:p.bagAfter,vaultAfter:p.vaultAfter}))!==p.token||d.mode!==p.mode||d.id!==p.id||d.qty!==p.n||st.saveGeneration!==p.gen||vaultHeldCount(st,p.id)!==p.bagBefore||bagCount(st.itemVault,p.id)!==p.vaultBefore||itemVaultCount(st)!==p.total||vaultTransferRoom(st,p.mode,p.id)<p.n) return toast('所持数が変わりました。確認し直してください。');
    const oldBag=clone(st.bag),oldVault=clone(st.itemVault),oldOwned=clone(st.owned); if(!transferVaultItem(st,p.mode,p.id,p.n)) return toast('品物を移動できません。'); el.disabled=true; G.vaultSaving=true; d.preview=null; render(); let saved=false; try{ saved=await commit(); }catch(e){ setSave('未保存：この端末では保存できません。設定からバックアップを書き出してください。'); } finally{ G.vaultSaving=false; }
    let rolledBack=false; if(!saved&&G.st===st&&st.saveGeneration===p.gen+1&&vaultHeldCount(st,p.id)===p.bagAfter&&bagCount(st.itemVault,p.id)===p.vaultAfter&&itemVaultCount(st)===p.total+(p.mode==='deposit'?p.n:-p.n)){ st.bag=oldBag; st.itemVault=oldVault; st.owned=oldOwned; st.saveGeneration=p.gen; rolledBack=true; }
    if(G.st===st){ G.sheetData={mode:p.mode,id:null,qty:1,preview:null,filter:d.filter||"all",query:d.query||"",page:d.page||0}; render(); toast(saved?`${vaultName(p.id)}を${p.n}個${p.mode==='deposit'?'預けました':'引き出しました'}。`:rolledBack?'保存できなかったため移動を取り消しました。':'移動を保存できませんでした。バックアップを書き出してください。'); } },
  vaultBack(){ if(G.sheet!=="goldVault"||G.vaultSaving) return; openSheet("record"); },
  vaultMode(el){ if(!canEditVault()||!["deposit","withdraw"].includes(el.dataset.v)) return; G.sheetData={mode:el.dataset.v,amount:"",preview:null}; render(); },
  vaultAmount(el){ if(!canEditVault()) return; const mode=G.sheetData.mode==="withdraw"?"withdraw":"deposit",from=mode==="deposit"?G.st.gold:G.st.vaultGold;
    const amount=el.dataset.v==="max"?from:el.dataset.v==="half"?Math.floor(from/2):Number(el.dataset.v);
    if(!Number.isSafeInteger(amount)||amount<1) return toast("送金できる残高がありません。"); G.sheetData.amount=String(amount); G.sheetData.preview=null; render(); },
  vaultEdit(){ if(!canEditVault()||!G.sheetData.preview) return; G.sheetData.preview=null; render(); },
  vaultPreview(){ if(!canEditVault()) return; const d=G.sheetData,st=G.st,mode=d.mode==="withdraw"?"withdraw":"deposit",raw=$("#vaultAmount")?.value||"",from=mode==="deposit"?st.gold:st.vaultGold,to=mode==="deposit"?st.vaultGold:st.gold,amount=vaultAmountValue(raw,from,to);
    if(!amount) return toast("1G以上の整数を残高以内で入力してください。");
    const p={mode,amount,gold:st.gold,vault:st.vaultGold,gen:st.saveGeneration,afterGold:st.gold+(mode==="deposit"?-amount:amount),afterVault:st.vaultGold+(mode==="deposit"?amount:-amount)};
    p.token=checksum(JSON.stringify(p)); d.amount=raw; d.preview=p; render(); },
  async vaultCommit(el){ if(!canEditVault()) return; const st=G.st,p=G.sheetData.preview,raw=$("#vaultAmount")?.value||"";
    if(!p||el.dataset.token!==p.token||checksum(JSON.stringify({mode:p.mode,amount:p.amount,gold:p.gold,vault:p.vault,gen:p.gen,afterGold:p.afterGold,afterVault:p.afterVault}))!==p.token||G.sheetData.mode!==p.mode||raw!==String(p.amount)||st.saveGeneration!==p.gen||st.gold!==p.gold||st.vaultGold!==p.vault) return toast("残高か入力が変わりました。確認し直してください。");
    if(!transferVaultGold(st,p.mode,p.amount)) return toast("送金できません。残高を確認してください。");
    el.disabled=true; G.vaultSaving=true; G.sheetData={mode:p.mode,amount:"",preview:null}; render();
    let saved=false;
    try{ saved=await commit(); }catch(e){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); }
    finally{ G.vaultSaving=false; }
    let rolledBack=false;
    if(!saved && G.st===st && st.saveGeneration===p.gen+1 && st.gold===p.afterGold && st.vaultGold===p.afterVault){ st.gold=p.gold; st.vaultGold=p.vault; st.saveGeneration=p.gen; rolledBack=true; }
    if(G.st===st){ render(); toast(saved?`${p.amount.toLocaleString()}Gを${p.mode==="deposit"?"預け入れました":"引き出しました"}。`:rolledBack?"送金を保存できなかったため取り消しました。保存設定を確認してください。":"送金を保存できませんでした。設定からバックアップを書き出してください。"); } },
  itemView(el){ if(!canEditItems()) return; const id=el.dataset.v||null; if(id&&(!ITEMS[id]||bagCount(G.st.bag,id)<1)) return; G.sheetData={item:id}; render(); },
  itemUse(el){ if(!canEditItems()) return; const st=G.st, id=G.sheetData.item; if(!ITEMS[id]||bagCount(st.bag,id)<1) return toast("道具を選び直してください。"); const r=useItemField(st,id,el.dataset.c||null); if(!r.ok) return toast(r.reason); commit(); SND.sfx("heal"); if(bagCount(st.bag,id)<=0) G.sheetData={item:null}; render(); toast(r.log.join("・")); },
  itemDrop(){ if(!canEditItems()) return; const id=G.sheetData.item; if(!ITEMS[id]||bagCount(G.st.bag,id)<1) return toast("道具を選び直してください。"); G.sheetData.confirmDrop=true; render(); },
  itemDropDo(el){ if(!canEditItems()||!G.sheetData.confirmDrop) return; const st=G.st, id=G.sheetData.item; if(!ITEMS[id]||bagCount(st.bag,id)<1||!el.dataset.drop||el.dataset.drop!==dropToken(st,id)) return toast("所持数が変わりました。道具を選び直してください。"); el.disabled=true; bagRemove(st.bag,id,1); G.sheetData={item:bagCount(st.bag,id)?id:null}; commit(); render(); toast(`${ITEMS[id].name}を1個捨てた。`); },
  itemDropNo(){ if(!canEditItems()) return; G.sheetData.confirmDrop=false; render(); },
  dlgNext(){ const d=G.dlg; if(d.i<d.lines.length-1){ d.i++; render(); } else { G.dlg=null; render(); if(d.after) d.after(); } },
  dlgBack(){ if(G.dlg.i>0){ G.dlg.i--; render(); } },
  dlgSkip(){ const d=G.dlg; G.dlg=null; render(); if(d.after) d.after(); },
  step(el){ if(G.sheet||G.dlg) return; const d=+el.dataset.d; const st=G.st; const m=MAPS[st.mapId]; st.dir=d; const v=[[0,1],[0,-1],[-1,0],[1,0]][d];
    const nx=st.pos.x+v[0], ny=st.pos.y+v[1]; const o=objAt(m,nx,ny); if(o&&!o.walk) return interact(o); if(walkable(m,nx,ny)){ G.walk.path=[{x:nx,y:ny}]; G.walk.prog=0; } },
  stop(){ if(G.walk.path.length>1) G.walk.path=G.walk.path.slice(0,1); G.walk.pending=null; },
  interactId(el){ const o=MAPS[G.st.mapId].objects.find(x=>x.id===el.dataset.v); G.sheet=null; render(); interact(o); },
  guideTo(el){ const o=MAPS[G.st.mapId].objects.find(x=>x.id===el.dataset.v); G.sheet=null; render(); walkTo(o.x,o.y); },
  doTravel(){ if(!canTravelFrom("travel")) return; const d=G.sheetData; const from=curHub(); if(!d||typeof d.to!=="string"||!Number.isInteger(d.tx)||!Number.isInteger(d.ty)||typeof d.gateId!=="string") return toast("移動先が変わりました。門を調べ直してください。"); const route=NATIONAL_ROUTES.find(r=>r.status==="playable"&&((r.from===from&&r.to===d.to)||(r.from===d.to&&r.to===from))); const first=!(G.st.visitedHubs||[]).includes(d.to); if(!HUBS[d.to]||from===d.to||!route||!nationalRouteAvailable(G.st,from,d.to)||first&&route.from===from&&route.firstGateId!==d.gateId||!nearbyObjects().some(o=>o.type==="gate"&&o.id===d.gateId&&o.to===d.to&&o.tx===d.tx&&o.ty===d.ty)) return toast("移動先が変わりました。門を調べ直してください。"); G.sheet=null; travelHub(d.to,d.tx,d.ty); },
  worldGo(el){ if(!canTravelFrom("map")) return; const to=el.dataset.v; if(!Object.hasOwn(HUBS,to)||curHub()===to) return toast("行先を選び直してください。"); const status=worldTravelStatus(G.st,curHub(),to,true); if(!status.available) return toast(status.reason); const map=MAPS[to]; if(!map||!Array.isArray(map.safeAnchor)) return toast("この行先にはまだ移動できません。"); const s=map.safeAnchor; G.sheet=null; travelHub(to,s[0],s[1]); },
  doInn(el){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="inn"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; const total=(INN_PRICE[curHub()]||10)*st.roster.length; if(st.gold<total) return toast(`ゴールドが足りません（あと${total-st.gold}）。`); el.disabled=true; G.sheet=null; st.gold-=total; restoreAll(st); st.day++; st.slots=6; commit(); render(); SND.sfx("heal"); say([["",`${total}ゴールドを払って泊まった。`],["",`${st.day}日目の朝。全員の体力と集中力が全回復した！`]]); },
  doRest(){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="rest"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; G.sheet=null; st.day++; st.slots=6; commit(); render(); toast(`${st.day}日目の朝。旅程枠が6に戻った。`); },
  acceptQuest(el){ if(!canManageQuests()) return; const st=G.st, id=el.dataset.v, q=QUESTS[id]; if(!q||st.quests[id]!=="available"||st.activeQuest||curHub()!==q.hub||!isSafe()) return toast("依頼の状態が変わりました。選び直してください。"); if(st.slots<2) return openSheet("rest",{reason:"受注には旅程枠2が必要です。"});
    el.disabled=true;
    st.slots-=2; st.quests[id]="active"; st.activeQuest=id; st.qprog[id]=st.qprog[id]||0; commit(); G.sheet=null; render();
    say([["",`依頼「${id} ${QUESTS[id].name}」を受けた。`],["もえ",id==="M01"?"呼びかけと紹介の順番が重なってる……。始まりと返事の順番を取り戻そう。":id==="M02"?"港の声を、ひとつずつ届けたいな。":id==="M03"?"唐津の海辺で聞いた返事を、配信でも届けたいな。":id==="M04"?"佐賀市の川沿いと駅前で、街の声を集めよう。":id==="M05"?"佐世保市の港沿いと坂道で、届いた返事を集めよう。":id==="M06"?"長崎市の港と丘で、街の声を届けよう。":id==="M07"?"熊本市の川辺と石垣で、届いた声を集めよう。":id==="M08"?"阿蘇市の風の中で、返事を集めよう。":"一緒に考えよう。"],["",QUESTS[id].goal]]); },
  abandonQuest(el){ if(!canManageQuests()) return; const st=G.st, id=el.dataset.v; if(!QUESTS[id]||st.activeQuest!==id||!["active","bossReady"].includes(st.quests[id])) return toast("依頼の状態が変わりました。選び直してください。"); el.disabled=true; st.quests[id]="available"; st.qprog[id]=0; st.activeQuest=null; commit(); render(); toast("依頼を放棄した。受注費は戻りません。"); },
  bossGo(el){ const st=G.st,bid=el.dataset.v,qid=Object.keys(QUESTS).find(k=>QUESTS[k].boss===bid); if(!st||G.readOnly||G.screen!=="explore"||G.sheet!=="boss"||G.sheetData.bid!==bid||G.dlg||st.run||G.walk.path.length||!qid||st.activeQuest!==qid||st.quests[qid]!=="bossReady"||st.bossDefeated[bid]||!nearbyObjects().some(o=>o.type==="boss"&&o.boss===bid)) return toast("ボスへの挑戦条件が変わりました。調べ直してください。"); el.disabled=true; startBattle(createBossRun(st,bid)); },
  pickActor(el){ const i=+el.dataset.i; const m=G.st.run.party[i]; if(m.hp<=0||m.acted) return; G.cmd={actor:i}; render(); },
  cmdType(el){ const t=el.dataset.v; G.cmd={actor:G.cmd.actor, type:t}; render(); },
  cmdSet(el){ const k=el.dataset.k; let v=el.dataset.v; if(k==="target"||k==="ally") v=+v; G.cmd[k]=v; if(k==="mode"||k==="item"){ delete G.cmd.ally; } render(); },
  confirmAct(el){ el.disabled=true; confirmAct(); },
  autoOn(){ const run=G.st.run; if(!run||run.state!=="input") return; G.auto=true; G.autoLast=null; G.cursorSig="autoOff||||||"; render(); SND.sfx("ok"); G.autoT=setTimeout(autoStep,300); },
  autoOff(){ G.auto=false; clearTimeout(G.autoT); G.autoLast=null; G.cmd={}; G.cursorSig=null; render(); SND.sfx("cancel"); toast("オートを中断しました。手動で操作できます。"); },
  toResult(){ toResult(); },
  resultDone(){ resultDone(); },
  defeatReturn(){ const st=G.st; const run=st.run; if(run.bag) st.bag=clone(run.bag); st.run=null; const m=MAPS[run.returnPos.map]; st.mapId=run.returnPos.map; st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]}; G.fol={...st.pos};
    const lost=Math.floor(st.gold/2); st.gold-=lost; restoreAll(st); commit(); G.screen="explore"; exploreBgm(); render(); say([["",`安全な場所へ運ばれた。所持ゴールドの半分（${lost}）を失った。`],["","全員の体力と集中力が回復した。"]]); },
  retreat(){ openSheet("retreat"); },
  doRetreat(){ const st=G.st; const run=st.run; storeVitals(st,run); if(run.bag) st.bag=clone(run.bag); st.run=null; st.mapId=run.returnPos.map; st.pos={x:run.returnPos.x,y:run.returnPos.y}; G.sheet=null; commit(); G.screen="explore"; exploreBgm(); render(); toast("撤退した。"); },
  pauseBattle(){ commit(); openSheet("pause"); },
  setOpt(el){ const k=el.dataset.k; let v=el.dataset.v; if(v==="true")v=true; if(v==="false")v=false; const s=G.st?G.st.settings:(G.tmpSettings=G.tmpSettings||{difficulty:"std",sound:soundPref(),reduceMotion:false}); s[k]=v; if(G.st) commit(); render(); },
  setPad(el){ const v=el.dataset.v==="left"?"left":"right"; if(G.st){ G.st.settings.padSide=v; commit(); } else { G.tmpSettings=G.tmpSettings||{difficulty:"std",sound:soundPref(),reduceMotion:false}; G.tmpSettings.padSide=v; }
    try{ localStorage.setItem("tlr-kyushu-pad",v); }catch(e){} render(); toast(v==="right"?"スティックを右、A・Bボタンを左にしました。":"スティックを左、A・Bボタンを右にしました。"); },
  toggleSound(){ const want=!soundIsOn(); const on=SND.setOn(want); G.soundWant=want; try{ localStorage.setItem("tlr-kyushu-sound", want?"1":"0"); }catch(e){}
    if(G.st){ G.st.settings.sound=want; commit(); } if(G.tmpSettings) G.tmpSettings.sound=want;
    if(want&&!on) toast("この端末では音を出せませんでした。消音で続けます。"); render(); },
  showBackup(){ G.sheetData.backup=JSON.stringify({app:"toplivermichi-kyushu",version:GAME_VERSION,state:G.st}); render(); },
  copyBackup(){ const t=$("#backupOut"); try{ navigator.clipboard.writeText(t.value).then(()=>toast("コピーしました。メモ帳などへ貼り付けて保管してください。"),()=>{t.select();toast("文字列を選択しました。コピーしてください。");}); }catch(e){ t.select(); toast("文字列を選択しました。コピーしてください。"); } },
  async restore(){ if(G.readOnly||G.sheet!=="settings") return toast("この画面では復元できません。"); const t=$("#restoreIn"); if(!t) return toast("復元欄がありません。"); const raw=(t.value||"").trim(); if(raw.length>5000000) return toast("大きすぎます（上限5,000,000バイト）。");
    try{ const o=JSON.parse(raw); if(o.app!=="toplivermichi-kyushu"||!o.state||o.state.schemaVersion!==SCHEMA_VERSION||!o.state.profile) throw 0; validateState(o.state);
      const oldPos=o.state.pos&&{x:o.state.pos.x,y:o.state.pos.y},next=migrate(o.state),previous=G.st,previousStatus=G.saveStatus; G.st=next;
      let saved=false; try{ saved=await commit(); }catch(e){}
      if(!saved){ G.st=previous; setSave(previousStatus); return toast("記録を保存できませんでした。元の記録を維持しています。バックアップの文字列を保管してください。"); }
      G.auto=false; clearTimeout(G.autoT); G.walk={path:[],prog:0,pending:null}; G.dlg=null; G.cmd={}; G.hasSave=true; G.sheet=null; G.screen=G.st.run?"battle":"explore"; render(); toast("記録を読み込みました。"+(!oldPos||oldPos.x!==next.pos.x||oldPos.y!==next.pos.y?" 保存位置を現在の地形に合わせて拠点の安全地帯へ戻しました。":"")); }
    catch(e){ toast("読み込めませんでした。文字列が途中で切れていないか確認してください。"); } },
  partyView(el){ G.sheetData={cid:el.dataset.c||null, view:el.dataset.v||""}; render(); drawMiniSprites(); },
  partyUp(el){ if(!canEditParty()) return; const st=G.st,i=Number(el.dataset.v),c=el.dataset.c; if(!Number.isInteger(i)||i<1||i>=st.party.length||st.party[i]!==c) return toast("編成が変わりました。選び直してください。"); [st.party[i-1],st.party[i]]=[st.party[i],st.party[i-1]]; commit(); render(); },
  partyLeave(el){ if(!canEditParty()) return; const st=G.st,i=Number(el.dataset.v),c=el.dataset.c; if(!Number.isInteger(i)||i<0||i>=st.party.length||st.party[i]!==c) return toast("編成が変わりました。選び直してください。"); if(st.party.length<=1) return toast("最後の1人は待機にできません。"); st.party.splice(i,1); commit(); render(); toast(`${charName(st,c)}を待機にした。`); },
  partyIn(el){ if(!canEditParty()) return; const st=G.st,c=el.dataset.v; if(!st.roster.includes(c)||st.party.includes(c)||st.party.length>=4) return toast("この仲間は追加できません。編成を確認してください。"); st.party.push(c); commit(); render(); toast(`${charName(st,c)}を戦闘メンバーに入れた。`); },
  partySwap(el){ if(!canEditParty()) return; const st=G.st,c=el.dataset.v,i=Number(el.dataset.i),old=el.dataset.c; if(!Number.isInteger(i)||i<0||i>=st.party.length||st.party[i]!==old||!st.roster.includes(c)||st.party.includes(c)) return toast("編成が変わりました。選び直してください。"); st.party[i]=c; commit(); render(); toast(`${charName(st,old)}と${charName(st,c)}を入れ替えた。`); },
  setJob(el){ if(!canEditParty()||streamPending()) return; const st=G.st,cid=el.dataset.c,j=el.dataset.v; if(!st.roster.includes(cid)||!Object.hasOwn(JOBS,j)||G.sheetData.cid!==cid||G.sheetData.view!=="job") return; st.jobs[cid]=j; st.equip[cid]=previewEquipFor(st,cid,j);
    for(const [s,id] of [["w","CW01"],["a","CA01"]]) if(!st.equip[cid][s]&&availableCount(st,id)>0) st.equip[cid][s]=id;
    commit(); G.sheetData={cid,view:""}; render(); drawMiniSprites(); toast(`${charName(st,cid)}のジョブを${JOBS[j].name}にした。`); },
  setEquip(el){ if(!canEditParty()||streamPending()) return; const st=G.st,cid=el.dataset.c,s=el.dataset.s,id=el.dataset.v||null; if(!st.roster.includes(cid)||!["w","a","acc"].includes(s)||G.sheetData.cid!==cid||G.sheetData.view!==`eq:${s}`) return; if(id&&(!Object.hasOwn(EQUIP,id)||EQUIP[id].slot!==s)) return; if(id){ const it=EQUIP[id], cur=charStats(st,cid,levelOf(st.xp)); if(it.job&&(it.job!==cur.job||cur.R<it.needR)) return toast("現在の職業と熟練度では装備できません。"); } if(id&&availableCount(st,id)<=0&&st.equip[cid][s]!==id) return toast("未装備の在庫がありません。"); st.equip[cid][s]=id; commit(); G.sheetData={cid,view:""}; render(); drawMiniSprites(); },
  setSupport(el){ if(!canEditParty()||streamPending()) return; const v=el.dataset.v||null; if(v!==null&&!supportAvailable(G.st,v)) return toast("この地域支援はまだ使えません。"); G.st.support=v; commit(); render(); },
  dexNav(el){ const k=el.dataset.k, v=el.dataset.v; if(k==="area"){ G.sheetData={area:v,page:0}; } else if(k==="page"){ G.sheetData.page=+v; } else { G.sheetData.detail=v||null; } render(); drawMiniSprites(); const s=$(".sheet"); if(s) s.scrollTop=0; },
  shopTab(el){ if(G.sheet!=="shop"||G.shopSaving||!["buy","item","sell"].includes(el.dataset.v)) return; G.sheetData.tab=el.dataset.v; G.sheetData.item=null; render(); },
  shopItem(el){ if(G.sheet!=="shop"||G.shopSaving) return; const id=el.dataset.v||null; if(id&&(!Object.hasOwn(ITEMS,id)&&!Object.hasOwn(EQUIP,id))) return; G.sheetData.item=id; G.sheetData.qty=1; render(); },
  shopQty(el){ if(G.sheet!=="shop"||G.shopSaving) return; const q=Number(el.dataset.v), offer=shopOffer(G.st,G.sheetData); if(!offer||!Number.isSafeInteger(q)||q<1||q>offer.max) return toast("数量を選び直してください。"); G.sheetData.qty=q; render(); },
  async shopDo(el){ const st=G.st,d=G.sheetData; if(!canTradeAtShop(d)) return toast("この場所では売買できません。"); const offer=shopOffer(st,d); if(!offer||!el.dataset.offer||el.dataset.offer!==shopOfferToken(st,d)||offer.max<offer.qty||offer.unit<0||!Number.isSafeInteger(offer.unit)||(offer.tab!=="sell"&&st.gold<offer.unit*offer.qty)) return toast("内容が変わりました。商品と数量を選び直してください。");
    el.disabled=true; G.shopSaving=true; const before=tradeSnapshot(st),gen=st.saveGeneration,q=offer.qty,id=offer.item,it=ITEMS[id]||EQUIP[id];
    let vaulted=0;
    if(ITEMS[id]){ if(offer.tab==="sell"){ bagRemove(st.bag,id,q); st.gold+=offer.unit*q; } else { const received=giveItem(st,id,q); if(received.got+received.vaulted!==q){ restoreTrade(st,before); G.shopSaving=false; el.disabled=false; return toast("受取先がいっぱいです。数量を選び直してください。"); } vaulted=received.vaulted; st.gold-=offer.unit*q; } }
    else if(offer.tab==="sell"){ st.owned[id]-=q; st.gold+=offer.unit*q; }
    else { st.gold-=offer.unit*q; st.owned[id]=(st.owned[id]||0)+q; }
    const after=JSON.stringify(tradeSnapshot(st)); d.item=null; render(); let saved=false;
    try{ saved=await commit(); }catch(e){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); }
    finally{ G.shopSaving=false; }
    let rolledBack=false; if(!saved&&G.st===st&&st.saveGeneration===gen+1&&JSON.stringify(tradeSnapshot(st))===after){ restoreTrade(st,before); st.saveGeneration=gen; rolledBack=true; }
    if(G.st===st){ render(); if(saved) SND.sfx("buy"); toast(saved?`${it.name}×${q}を${offer.tab==="sell"?"売った":"買った"}。${vaulted?` ${vaulted}個は金庫へ保管しました。`:""}`:rolledBack?"取引を保存できなかったため取り消しました。":"取引を保存できませんでした。バックアップを書き出してください。"); } },
  replay(el){ G.sheet=null; playScene(el.dataset.v); },
  ssSet(el){ G.sheetData[el.dataset.k]=el.dataset.v; render(); },
  streamStart(){ const st=G.st, d=G.sheetData, qid=streamPending(); if(!st||G.readOnly||G.screen!=="explore"||G.sheet!=="streamSetup"||!qid||QUESTS[qid].hub!==curHub()||!STREAM_REQ[HUBS[curHub()].prefId]||!st.roster.includes(d.host)||!STREAM_THEMES[d.theme]||!["video","voice"].includes(d.style)) return toast("配信の開始条件が変わりました。依頼帳を確認してください。"); st.stream=newStream(st,curHub(),d.host,d.theme,d.style); commit(); G.sheet=null; G.screen="stream"; SND.play("stream"); render(); },
  streamAct(el){ const s=G.st?.stream,k=el.dataset.v; if(G.readOnly||G.screen!=="stream"||G.sheet||G.dlg||!s||s.done||s.hand<0||s.hand>=4||!Object.hasOwn(STREAM_ACTS,k)) return; streamAct(k); },
  streamRetry(){ const s=G.st?.stream; if(G.readOnly||G.screen!=="stream"||G.sheet||G.dlg||!s?.done||s.score>=80) return; Object.assign(s,{hand:0,score:0,used:[],themeBonusUsed:false,picks:[],done:false}); commit(); render(); },
  streamLeave(){ const s=G.st?.stream; if(G.readOnly||G.screen!=="stream"||G.sheet||G.dlg||!s?.done||s.score>=80) return; G.st.stream=null; commit(); G.screen="explore"; exploreBgm(); render(); },
  streamFinish(){ streamFinish(); }
};
function drawMiniSprites(){
  document.querySelectorAll("canvas[data-char]").forEach(c=>{ const g=c.getContext("2d"); g.clearRect(0,0,16,24); const id=c.dataset.char; g.drawImage(id==="moe"?ART.person("moe",PAL.violet,PAL.cream,0,0,{long:true,ribbon:PAL.coral}):charSprite(id,0,0),0,0); });
  document.querySelectorAll("canvas[data-dex]").forEach(c=>{ const [a,i]=c.dataset.dex.split("|"); const e=enemyDef(a,+i); const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(ART.enemy(e.profile,e.species,e.attr,a,0),0,0); });
}
function validateState(s){
  const okNum=v=>Number.isFinite(v)&&v>=0;
  if(!okNum(s.xp)||!okNum(s.gold)||!okNum(s.tickets)||!MAPS[s.mapId]||!Array.isArray(s.roster)||!Array.isArray(s.party)||s.party.length<1||s.party.length>4||new Set(s.party).size!==s.party.length||s.party.some(c=>!CHARS[c]||!s.roster.includes(c))) throw new Error("bad");
  if(s.vaultGold!==undefined&&(!Number.isSafeInteger(s.vaultGold)||s.vaultGold<0)) throw new Error("bad vault");
  if(s.itemVault!==undefined&&(!Array.isArray(s.itemVault)||s.itemVault.some(e=>!ITEMS[e.id]&&!EQUIP[e.id]||!Number.isSafeInteger(e.n)||e.n<1)||itemVaultCount(s)>ITEM_VAULT_MAX||new Set(s.itemVault.map(e=>e.id)).size!==s.itemVault.length||s.itemVault.some(e=>EQUIP[e.id]&&(s.owned[e.id]||0)+e.n>8))) throw new Error("bad item vault");
  if(s.pendingGifts!==undefined&&(!Array.isArray(s.pendingGifts)||s.pendingGifts.some(id=>!EQUIP[id])||new Set(s.pendingGifts).size!==s.pendingGifts.length)) throw new Error("bad pending gifts");
  for(const c of s.party) if(!JOBS[s.jobs[c]]) throw new Error("bad job");
}
function padSide(){ const s=G.st?G.st.settings:G.tmpSettings; if(s&&(s.padSide==="left"||s.padSide==="right")) return s.padSide; try{ const v=localStorage.getItem("tlr-kyushu-pad"); if(v==="left"||v==="right") return v; }catch(e){} return "right"; }
function soundIsOn(){ if(G.soundWant!=null) return G.soundWant; if(G.st&&G.st.settings) return G.st.settings.sound!==false; return soundPref(); }
function soundPref(){ try{ return localStorage.getItem("tlr-kyushu-sound")!=="0"; }catch(e){ return true; } }
function savedStreamUsable(s,st){
  if(!s||typeof s!=="object"||!HUBS[s.hub]||HUBS[s.hub].prefId!==s.prefId||!st.roster.includes(s.host)||!STREAM_THEMES[s.theme]||!["video","voice"].includes(s.style)) return false;
  if(!Object.entries(QUESTS).some(([id,q])=>q.hub===s.hub&&st.quests[id]==="combatDone"&&(!st.activeQuest||st.activeQuest===id))) return false;
  const request=STREAM_REQ[s.prefId];
  if(!Array.isArray(request)||!Array.isArray(s.requestIds)||s.requestIds.length!==4||s.requestIds.some((id,i)=>id!==request[i])) return false;
  if(!Number.isInteger(s.hand)||s.hand<0||s.hand>4||typeof s.done!=="boolean"||s.done!==(s.hand===4)||!Number.isFinite(s.score)||s.score<0) return false;
  if(!Array.isArray(s.used)||s.used.some(id=>!Object.hasOwn(STREAM_ACTS,id))||!Array.isArray(s.picks)||s.picks.length!==s.hand||s.picks.some(p=>!p||!Object.hasOwn(STREAM_ACTS,p.act))) return false;
  const replay={requestIds:request.slice(),theme:s.theme,hand:0,score:0,used:[],themeBonusUsed:false,picks:[],done:false};
  for(const pick of s.picks){ const step=streamPlay(replay,pick.act); if(pick.total!==step.total) return false; }
  if(s.score!==replay.score||s.themeBonusUsed!==replay.themeBonusUsed||s.used.length!==replay.used.length||s.used.some((id,i)=>id!==replay.used[i])) return false;
  return true;
}
function supportAvailable(st,id){
  if(id==="PR01") return !!st.talked?.akari&&st.quests?.M01==="complete"&&st.quests?.S01==="complete";
  if(id==="PR02") return !!st.talked?.karatsuGuide&&st.quests?.M03==="complete";
  if(id==="PR03") return !!st.talked?.saseboGuide&&st.quests?.M05==="complete";
  return false;
}
function migrate(s){
  const map=MAPS[s.mapId],p=s.pos;
  if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=map.w||p.y>=map.h||!".,123w=".includes(map.tiles[p.y]?.[p.x])||map.objects.some(o=>o.x===p.x&&o.y===p.y&&!o.walk)) s.pos={x:map.safeAnchor[0],y:map.safeAnchor[1]};
  if(!Array.isArray(s.visitedMaps)) s.visitedMaps=[];
  if(!Array.isArray(s.visitedHubs)) s.visitedHubs=[];
  if(!s.visitedMaps.includes(s.mapId)) s.visitedMaps.push(s.mapId);
  for(const mapId of s.visitedMaps){
    const hub=MAPS[mapId]?.hub;
    if(hub&&!s.visitedHubs.includes(hub)) s.visitedHubs.push(hub);
  }
  if(s.vaultGold===undefined) s.vaultGold=0;
  if(s.itemVault===undefined) s.itemVault=[];
  if(!Array.isArray(s.pendingGifts)) s.pendingGifts=[];
  if(!s.itemsVersion){ s.bag=INITIAL_ITEMS.map(([id,n])=>({id,n})); s.keep=[]; s.itemsVersion=1; s.gameVersion=GAME_VERSION; }
  if(s.run&&!s.run.bag) s.run.bag=clone(s.bag);
  if(s.run){
    s.run.log=Array.isArray(s.run.log)?s.run.log.filter(line=>typeof line==="string").slice(-80):[];
    if(!Array.isArray(s.run.itemHistory)){ s.run.itemHistory=[]; s.run.itemHistoryComplete=false; }
    else if(s.run.itemHistoryComplete!==true) s.run.itemHistoryComplete=false;
    if(s.run.actionHistoryComplete!==true || !s.run.actionFlags) s.run.actionHistoryComplete=false;
  }
  if(s.lastResult){
    if(!Array.isArray(s.lastResult.itemsUsed)) s.lastResult.itemsUsed=[];
    if(s.lastResult.itemsUsedKnown!==true) s.lastResult.itemsUsedKnown=false;
  }
  if(s.stream&&!savedStreamUsable(s.stream,s)) s.stream=null;
  if(!Array.isArray(s.battleBadges)) s.battleBadges=[];
  if(s.settings&&s.settings.soundV!==2){ s.settings.sound=true; s.settings.soundV=2; }
  if(s.vitals===undefined) s.vitals=null;
  s.jobs.moe=s.jobs.moe||"J08"; s.jp.moe=s.jp.moe||{}; s.equip.moe=s.equip.moe||{w:null,a:null,acc:null};
  if(s.visitedHubs.includes("KY05")&&!s.roster.includes("kayo")){
    s.jobs.kayo=s.jobs.kayo||CHARS.kayo.initJob; s.jp.kayo=s.jp.kayo||{}; s.equip.kayo=s.equip.kayo||{w:null,a:null,acc:null};
    joinMember(s,"kayo");
  }
  s.settings=Object.assign({difficulty:"std",sound:soundPref(),reduceMotion:false},s.settings||{});
  s.scenes=s.scenes||{}; s.cards=s.cards||[];
  if(!s.quests.M03) s.quests.M03=s.quests.M02==="complete"||s.fukuokaClear?"available":"locked";
  if(!s.quests.M04) s.quests.M04=s.quests.M03==="complete"?"available":"locked";
  if(!s.quests.M05) s.quests.M05=s.quests.M04==="complete"?"available":"locked";
  if(!s.quests.M06) s.quests.M06=s.quests.M05==="complete"?"available":"locked";
  if(!s.quests.M07) s.quests.M07=s.quests.M06==="complete"?"available":"locked";
  if(!s.quests.M08) s.quests.M08=s.quests.M07==="complete"?"available":"locked";
  if(s.support&&!supportAvailable(s,s.support)) s.support=null;
  return s;
}

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]"); if(!el||el.disabled) return;
  if(el.getAttribute("aria-disabled")==="true") return;
  const f=ACT[el.dataset.a]; if(!f) return;
  if(G.readOnly && !["openSheet","closeSheet","dlgNext","dlgBack","dlgSkip","toTitle","dexNav","partyView","shopTab","shopItem","vaultOpen","vaultBack"].includes(el.dataset.a)) return toast("別のタブで遊んでいるため、このタブは閲覧のみです。");
  f(el);
  if(el.dataset.a==="openSheet") drawMiniSprites();
});
document.addEventListener("visibilitychange",()=>{ if(document.hidden){ G.walk.path=G.walk.path.slice(0,1); SND.suspend(); } else { SND.resume(); if(G.screen==="explore") startLoop(); } });
window.addEventListener("resize",()=>{ if(G.screen==="explore"){ G.walk.path=[]; clearTimeout(G.rsz); G.rsz=setTimeout(()=>{ if(G.screen==="explore") mountCanvas(); },120); } });

async function boot(){
  acquireLock(); PAD.mount(); SND.play("title");
  try{ const s=await loadSave(); G.hasSave=!!s; }catch(e){}
  const hot=window.claude&&window.claude.hot;
  if(hot&&hot.snapshot) hot.snapshot(()=>({st:G.st, screen:G.screen}));
  const data = hot&&hot.data;
  if(data&&data.st){ G.st=data.st; G.screen=data.screen==="new"?"title":data.screen; G.hasSave=true; }
  render(); if(G.screen==="title") drawTitleArt();
}



