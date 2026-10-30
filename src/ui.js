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
    catch(e){ try{ localStorage.setItem("tlr-kyushu-auto", JSON.stringify(rec)); setSave("保存済み"); return true; }catch(e2){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); return false; } }
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
// Replacing an adventure must remain newer than every surviving save candidate.
async function seedSaveGeneration(st,previous=G.st){
  const loaded=await loadSave();
  const generations=[st,previous,loaded?.state].map(s=>s?.saveGeneration).filter(n=>Number.isSafeInteger(n)&&n>=0);
  st.saveGeneration=Math.max(0,...generations);
}
function setSave(t){ G.saveStatus=t; const el=document.getElementById("saveStat"); if(el) el.textContent=t; }
function acquireLock(){
  try{ if(navigator.locks){ navigator.locks.request("toplivermichi-kyushu-owner",{ifAvailable:true}, lock=>{ if(!lock){ G.readOnly=true; render(); return; } return new Promise(()=>{}); }); } }catch(e){}
}

/* OSの演出抑制も、保存内の設定を変えずに尊重する。 */
function reducedMotion(){
  const settings=G.st?.settings||G.tmpSettings;
  return !!settings?.reduceMotion || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
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
function zoneAt(m,x,y){ if(m.kind!=="field") return null; const o=objAt(m,x,y); if(o&&o.walk) return null; return m.zones[tileAt(m,x,y)]||null; }
function isSafe(){ return MAPS[G.st.mapId].kind!=="field"; }
function busyReason(){ const st=G.st; if(st.run) return "戦闘中です。"; return null; }
function objective(){
  const st=G.st,q=st.activeQuest,Q=QUESTS[q];
  if(Q){
    const field=MAPS[HUBS[Q.hub].fieldMap];
    if(st.quests[q]==="bossReady") return q+"："+BOSSES[Q.boss].name+"に挑む（"+field.name+"の奥地）";
    return q+"：街の出口から街外へ。通常敵 "+(st.qprog[q]||0)+"/"+Q.kills+"体";
  }
  if(st.nationalClear) return "全国編クリア！ 47都道府県の声がつながりました。記録から物語を振り返れます";
  const next=NATIONWIDE_QUEST_ORDER.find(id=>st.quests[id]==="available");
  if(next) return HUBS[QUESTS[next].hub].name+"で「"+QUESTS[next].name+"」を受注しよう";
  return "街で依頼を受け、出口から街外へ進もう";
}

/* ===== 画面の描画 ===== */
function render(){
  const root=$("#screen"); if(!root) return;
  stopBattleTimer();
  if(typeof BATTLE_FX!=="undefined")BATTLE_FX.cancel();
  const s=G.screen;
  let html="";
  if(s==="title") html=renderTitle();
  else if(s==="new") html=renderNew();
  else if(s==="explore") html=renderExplore();
  else if(s==="battle") html=renderBattle();
  else if(s==="result") html=renderResult();
  root.innerHTML = html + renderSheet() + renderDialog() + `<div id="toast" class="toast" role="status" hidden></div>`;
  if(s==="explore") mountCanvas();
  document.body.classList.toggle("in-battle", s==="battle"); document.body.classList.toggle("in-explore", s==="explore");
  if(s==="battle"){ drawEnemies(); startBattleTimer(); }
  if(s==="new") mountNew();
  drawMiniSprites();
  const dockOff = s==="new" || (G.st? G.st.settings.dock===false : (G.tmpSettings&&G.tmpSettings.dock===false));
  document.body.classList.toggle("no-dock", !!dockOff);
  document.body.classList.remove("stick-left");
  document.body.classList.toggle("reduce-motion", reducedMotion());
  const dh=document.querySelector("#dock .hint"); if(dh) dh.textContent = (s==="explore"&&!G.sheet&&!G.dlg)?"スティックで移動・中央で決定":"スティックで選択・中央で決定";
  if(G.dlg){ const b=$("#dlgNext"); if(b) b.focus({preventScroll:true}); }
  PAD.restore();
}
function statusBar(){
  const st=G.st; const m=MAPS[st.mapId];
  return `<header class="status">
    <div class="srow"><span class="place">${esc(m.name)}</span><span>${st.day}日目</span></div>
    <div class="goal">${esc(objective())}</div>
    <div class="srow small"><span>レベル${levelOf(st.xp,st)}・${st.gold.toLocaleString()}ゴールド・チケット${st.tickets.toLocaleString()}</span><span>${esc(charName(st,"moe"))} ${MOE_RANKS[st.moeRank]}</span></div>
    <div class="small" aria-live="polite">保存：<span id="saveStat">${esc(G.saveStatus)}</span>${G.readOnly?"（別のタブで操作中のため閲覧のみ）":""}</div>
  </header>`;
}

/* ---- タイトル ---- */
function renderTitle(){
  return `<section class="title-screen">
    <div class="title-visual"><img id="titleArt" src="__TITLE_ART_DATA_URI__" width="960" height="640" alt="夕暮れの港町と星空を望む、ふたりの旅人" fetchpriority="high" decoding="async">
    <div class="title-caption"><h1 class="logo" aria-label="ポコチャクエスト 全国編"><span class="main" aria-hidden="true"><span>ポコチャ</span><span>クエスト</span></span><span class="sub">全国編</span></h1></div></div>
    <div class="menu">
      <button class="btn primary" data-a="newGame">はじめから</button>
      <button class="btn" data-a="continue" ${G.hasSave?"":"disabled"}>つづきから${G.hasSave?"":"（記録なし）"}</button>
      <button class="btn" data-a="openSheet" data-k="settings">設定</button>
      <button class="btn" data-a="openSheet" data-k="about">この作品について</button>
      <button class="btn" data-a="openSheet" data-k="share">友だちに教える（URLを共有）</button>
    </div>
  </section>`;
}
/* ---- 主人公設定（第06D・06E節） ---- */
function renderNew(){
  const n=G.newGame;
  if(n.step===2){
    const v=validateName(n.name);
    return `<section class="win">
      <h2 class="label">確認</h2>
      <canvas id="heroPrev" width="64" height="96" class="sprite-lg" aria-hidden="true"></canvas>
      <dl class="kv"><dt>名前</dt><dd>${esc(v.value)}（${v.count}文字）</dd><dt>性別</dt><dd>${esc(n.gender)}</dd>
      <dt>初期職業</dt><dd>アイドルオタク</dd><dt>背景</dt><dd>32歳・福岡県福岡市出身・職歴は社会福祉士</dd></dl>
      <p class="small">名前と性別はこの冒険で固定されます。性別による能力・成長・結末の差はありません。</p>
      <div class="stack"><button class="btn primary" data-a="startGame">この主人公で始める</button>
      <button class="btn" data-a="newBack">入力に戻る</button></div></section>`;
  }
  return `<section class="win">
    <h2 class="label">主人公の設定</h2>
    <label for="nameInput" class="field-label">名前（全角1～${NAME_MAX}文字）</label>
    <input id="nameInput" class="input" autocomplete="off" enterkeyhint="done" value="${esc(n.name)}" aria-describedby="nameHelp">
    <div id="nameHelp" class="small" aria-live="polite"></div>
    <fieldset class="gender"><legend class="field-label">性別（ゲーム内の主人公設定）</legend>
      ${["男性","女性"].map(g=>`<button class="btn choice ${n.gender===g?"on":""}" data-a="pickGender" data-v="${g}" aria-pressed="${n.gender===g}">${n.gender===g?"▶ ":""}${g}</button>`).join("")}
    </fieldset>
    <canvas id="heroPrev" width="64" height="96" class="sprite-lg" aria-hidden="true"></canvas>
    <div class="stack"><button class="btn primary" id="toConfirm" data-a="newNext">確認へ</button>
    <button class="btn" data-a="toTitle">タイトルへ戻る</button></div>
  </section>`;
}
function mountNew(){
  const pv=$("#heroPrev"); if(pv){ const g=pv.getContext("2d"); g.clearRect(0,0,pv.width,pv.height); if(G.newGame.gender) g.drawImage(heroSprite(0,0,G.newGame.gender),0,0,pv.width,pv.height); }
  const inp=$("#nameInput"); if(!inp) return;
  const upd=()=>{ const help=$("#nameHelp"); if(G.newGame.composing){ help.textContent="変換中"; return; }
    G.newGame.name=inp.value; const v=validateName(inp.value);
    help.innerHTML = `${v.count}／${NAME_MAX}文字` + (v.errors.length&&inp.value? `<br>`+v.errors.map(esc).join("<br>") : "");
    const b=$("#toConfirm"); if(b) b.disabled = !(v.ok && G.newGame.gender); };
  inp.addEventListener("compositionstart",()=>{G.newGame.composing=true; upd();});
  inp.addEventListener("compositionend",()=>{G.newGame.composing=false; upd();});
  inp.addEventListener("input",e=>{ if(!e.isComposing) { G.newGame.composing=false; upd(); } });
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); inp.blur(); } });
  inp.addEventListener("blur",()=>{ if(!G.newGame.composing){ const v=validateName(inp.value); if(v.value!==inp.value && v.value){ inp.value=v.value; } upd(); } });
  upd();
}
function vitalOf(cid){ const st=G.st; ensureVitals(st); return st.vitals[cid]||{hp:0,c:0}; }
function attackPower(s,L){ return 10+2*L+Vof(L)*(s.wAtk+s.accAtk); }
function defensePower(s,L){ return Vof(L)*s.armorD; }
function partyStrip(){
  const st=G.st;
  return `<div class="pstrip" aria-label="パーティーの状態"><span class="pstop"><span>レベル${levelOf(st.xp,st)}・${st.gold.toLocaleString()}ゴールド・${esc(charName(st,"moe"))} ${MOE_RANKS[st.moeRank]}</span></span>${st.party.map(cid=>{ const L=levelOf(st.xp,st), s=charStats(st,cid,L), v=vitalOf(cid);
    return `<span class="pmini ${v.hp<=0?"ko":""} ${isLow(v.hp,s.maxHP)?"low":""}"><span class="pmline"><b>${esc(charName(st,cid))}</b><span class="small">体力${v.hp}/${s.maxHP} MP${v.c}${v.hp<=0?"・戦闘不能":isLow(v.hp,s.maxHP)?"・体力わずか":""}</span></span><span class="bar"><i style="width:${Math.round(100*v.hp/s.maxHP)}%"></i></span></span>`; }).join("")}</div>`;
}
function renderStatus(){
  const st=G.st; const L=levelOf(st.xp,st);
  const head=`<dl class="kv"><dt>共通レベル</dt><dd>${L}／上限${levelLimit(st)}</dd><dt>経験値</dt><dd>${st.xp.toLocaleString()}${L<levelLimit(st)?`（次のレベルまで ${Math.max(0,xpFor(L+1)-st.xp).toLocaleString()}）`:"（現在の上限）"}</dd>
    <dt>所持ゴールド</dt><dd>${st.gold.toLocaleString()}</dd><dt>ヒロインの到達ランク</dt><dd>${MOE_RANKS[st.moeRank]}</dd></dl>
    <p class="small">本編を進めるとレベル上限が解放されます。レベルは共通、職業の熟練度は仲間ごとに成長します。</p><p class="small">体力とMPは戦闘後も持ち越します。宿屋に泊まると全員が全回復します。</p>`;
  const cards=st.roster.map(cid=>{
    const s=charStats(st,cid,L), v=vitalOf(cid), e=st.equip[cid], jp=jpOf(st,cid,s.job), C=CHARS[cid];
    const inParty=st.party.includes(cid);
    const eqName=id=>id?esc(EQUIP[id].name):"なし";
    return `<section class="scard ${v.hp<=0?"ko":""} ${isLow(v.hp,s.maxHP)?"low":""}">
      <div class="who"><canvas class="sprite-md" data-char="${cid}" width="192" height="288" aria-hidden="true"></canvas>
        <div><b class="sname">${esc(cid==="moe"?charName(st,"moe"):cid==="hero"?st.profile.name:C.full)}</b><br><span class="small">${inParty?"戦闘メンバー":"控え"}${v.hp<=0?"・戦闘不能":isLow(v.hp,s.maxHP)?"・体力わずか":""}</span></div></div>
      <dl class="kv">
        <dt>レベル</dt><dd>${L}</dd>
        <dt>職業</dt><dd>${esc(JOBS[s.job].name)}</dd>
        <dt>職業熟練度</dt><dd>${s.R}${s.R<jobLimit(st,cid,s.job)?`（次まで ${Math.max(0,jpFor(s.R+1)-jp)}）`:"（現在の上限）"}</dd>
        <dt>体力（HP）</dt><dd><span class="bar wide"><i style="width:${Math.round(100*v.hp/s.maxHP)}%"></i></span>${v.hp}／最大${s.maxHP}</dd>
        <dt>MP</dt><dd>${v.c}／最大${s.startC}</dd>
        <dt>攻撃力</dt><dd>${attackPower(s,L)}</dd>
        <dt>防御力</dt><dd>${defensePower(s,L)}</dd>
        <dt>技能</dt><dd>${esc(JOBS[s.job].skill)}（MP${JOBS[s.job].cost}・技能強化${s.S}）</dd>
        <dt>武器</dt><dd>${eqName(e.w)}</dd><dt>防具</dt><dd>${eqName(e.a)}</dd><dt>アクセサリー</dt><dd>${eqName(e.acc)}</dd>
      </dl></section>`; }).join("");
  return head+`<div class="stack">${cards}</div><p class="small">攻撃力＝通常攻撃で与える基本ダメージ（敵の防御力を引く前）。防御力＝敵の攻撃1回ごとに減らせるダメージ。</p>`;
}
function heroSprite(dir,frame,gender){ const f=(gender||G.st.profile.gender)==="女性"; return ART.person("hero",f?PAL.brown:PAL.ink,PAL.red,dir,frame,{long:f}); }
function charSprite(cid,dir,frame){ if(cid==="hero") return heroSprite(dir,frame); if(cid==="moe") return ART.person("moe",PAL.violet,PAL.cream,dir,frame,{long:true,ribbon:PAL.coral}); const c=CHARS[cid]; return ART.person(cid,c.hair,c.coat,dir,frame,{long:["mio","kayo","tsumugi"].includes(cid)}); }

/* ---- 探索 ---- */
function renderCurrentLocation(){
  const st=G.st,m=MAPS[st.mapId],zone=zoneAt(m,st.pos.x,st.pos.y),ar=zone?AREAS[zone]:null,near=nearbyObjects();
  return `<div class="here">${ar?`<span class="tag danger">遭遇エリア</span> ${esc(ar.name)}（推奨レベル${ar.q}）`:`<span class="tag ${m.kind==="field"?"danger":"safe"}">${m.kind==="field"?"街外の道":"安全な街・室内"}</span>`}${near.length?`<span class="small">／近く：${near.map(o=>esc(o.label)).join("・")}</span>`:""}</div>`;
}
function renderMainMenu(){
  return `<nav class="menu-grid main-menu" aria-label="冒険メニュー">
    ${[["map","地図"],["items","道具"],["status","ステータス"],["party","編成"],["record","記録"],["pets","ペット"],["voyage","航海"],["dex","図鑑"],["settings","設定"],["help","解説"],["share","友だちに教える"]].map(([k,label])=>`<button class="btn" data-a="openSheet" data-k="${k}">${label}</button>`).join("")}
  </nav>`;
}
function renderExplore(){
  const st=G.st,m=MAPS[st.mapId],exit=m.objects.find(o=>o.fieldExit&&!o.oceanRoute&&!o.oceanReturn);
  return `<section class="explore">
    <header class="xhead">
      <div class="srow"><span class="place">${esc(m.name)}</span><span>${st.day}日目</span></div>
      ${renderCurrentLocation()}
      <div class="goal">${esc(objective())}</div>
      <div class="xsave small" aria-live="polite">保存：<span id="saveStat">${esc(G.saveStatus)}</span>${G.readOnly?"（閲覧のみ）":""}</div>
    </header>
    <div class="mapwrap"><canvas id="map" aria-label="${esc(m.name)}の地図。地面をタップすると移動します。"></canvas>
      ${exit?`<button class="btn map-exit" data-a="guideTo" data-v="${exit.id}">${m.kind==="town"?"街外へ":"街へ戻る"}</button>`:""}
    </div>
    ${partyStrip()}
    <nav class="menu-grid explore-actions" aria-label="MAP操作">
      <button class="btn" data-a="openSheet" data-k="quests">やる事</button>
      <button class="btn" data-a="openSheet" data-k="guide">オート移動</button>
      <button class="btn primary" data-a="openSheet" data-k="menu">メニュー</button>
    </nav>
  </section>`;
}
function nearbyObjects(){ const st=G.st, m=MAPS[st.mapId]; return m.objects.filter(o=>Math.max(Math.abs(o.x-st.pos.x),Math.abs(o.y-st.pos.y))<=1 && o.type!=="tower"); }
function mountCanvas(){
  const wrap=$(".mapwrap"); const cv=$("#map"); G.cv=cv;
  // 地図以外の部品を置いた残りの高さに合わせてタイル数を決める（画面スクロールなし）
  cv.width=16; cv.height=16; cv.style.width="16px"; cv.style.height="16px";
  const A = Math.min((wrap.clientWidth||358)-8, 448), H=(wrap.clientHeight||300)-8;
  G.scale = (Math.floor(A/32)>=7 && Math.floor(H/32)>=4) ? 2 : 1;
  G.vw=Math.max(5,Math.min(14,Math.floor(A/(16*G.scale))));
  G.vh=Math.max(3,Math.min(14,Math.floor(H/(16*G.scale))));
  G.mapRenderScale=2; cv.width=G.vw*16*G.mapRenderScale; cv.height=G.vh*16*G.mapRenderScale; cv.style.width=(G.vw*16*G.scale)+"px"; cv.style.height=(G.vh*16*G.scale)+"px";
  cv.addEventListener("pointerup", onMapTap);
  drawMap(); startLoop();
}
function camera(){
  const st=G.st, m=MAPS[st.mapId]; const p=playerPixel();
  let cx=p.x+8-G.vw*8, cy=p.y+12-G.vh*8;
  cx=Math.max(0,Math.min(m.w*16-G.vw*16,cx)); cy=Math.max(0,Math.min(m.h*16-G.vh*16,cy));
  if(m.w*16<G.vw*16) cx=(m.w*16-G.vw*16)/2; if(m.h*16<G.vh*16) cy=(m.h*16-G.vh*16)/2;
  return {x:Math.round(cx),y:Math.round(cy)};
}
function playerPixel(){
  const st=G.st, w=G.walk; let x=st.pos.x*16, y=st.pos.y*16;
  if(w.path.length){ const n=w.path[0]; x+= (n.x-st.pos.x)*16*w.prog; y+=(n.y-st.pos.y)*16*w.prog; }
  return {x:Math.round(x), y:Math.round(y)};
}
function drawMap(){
  const cv=G.cv; if(!cv||!cv.isConnected) return; const g=cv.getContext("2d"); g.imageSmoothingEnabled=true; g.imageSmoothingQuality="high";
  const st=G.st, m=MAPS[st.mapId]; const cam=camera(); const now=performance.now();
  const still=reducedMotion(); const f=still?0:Math.floor(now/320)%4, f2=still?0:Math.floor(now/600)%2;
  const ratio=G.mapRenderScale||1,vw=G.vw*16,vh=G.vh*16;g.setTransform(ratio,0,0,ratio,0,0);
  g.fillStyle=PAL.ink; g.fillRect(0,0,vw,vh);
  const layer=ART.mapLayer(st.mapId,f);
  const sx=Math.max(0,cam.x), sy=Math.max(0,cam.y), w=Math.min(vw,layer.width/(layer.artScale||1)-sx), h=Math.min(vh,layer.height/(layer.artScale||1)-sy);
  const lr=layer.artScale||1;g.drawImage(layer,sx*lr,sy*lr,w*lr,h*lr,sx-cam.x,sy-cam.y,w,h);
  const sprites=[];
  for(const o of m.objects){
    let img;
    if(o.type==="npc"){ const n=NPCS[o.npc]; img = o.npc==="moe"? charSprite("moe",0,0) : ART.person(o.npc,n.sprite[1],n.sprite[0],0,f2*2,{long:["akari","chiyo","misuzu"].includes(o.npc)}); }
    else if(o.type==="shop"){ const n=NPCS[o.npc]; sprites.push({y:o.y-0.1,img:ART.object("shop",0),x:o.x}); img=ART.person(o.npc,n.sprite[1],n.sprite[0],0,f2*2); }
    else if(o.type==="inn"){ sprites.push({y:o.y-0.1,img:ART.object("inn",f),x:o.x}); img=ART.person("innkeeper",PAL.slate,PAL.navy,0,f2*2); }
    else if(o.type==="box") img=ART.object(st.boxes[o.box]?"boxOpen":"box",f);
    else if(o.type==="boss"){ if(st.bossDefeated[o.boss]) continue; img=ART.object("boss",f); }
    else img=ART.object(o.fieldExit||o.fieldRoute?"gate":o.type==="jobcenter"?"board":o.type,f);
    sprites.push({y:o.y,x:o.x,img});
  }
  const moving=G.walk.path.length>0;
  const walking=moving&&!G.dlg&&!G.sheet&&!G.lock&&!document.hidden;
  const wf=WALK_ART.phase(G.walkDistance||0,walking,still);
  const pp=playerPixel();
  // 2人目の追従表示（表示のみ。判定は先頭だけ）
  const fol=G.fol; const lead=st.party[0], second=st.party[1];
  if(second && fol && (fol.x!==st.pos.x||fol.y!==st.pos.y||moving)){
    let fx=fol.x*16, fy=fol.y*16; let tx=fol.x, ty=fol.y;
    if(moving){ tx=st.pos.x; ty=st.pos.y; fx+=(tx-fol.x)*16*G.walk.prog; fy+=(ty-fol.y)*16*G.walk.prog; }
    const dx=(moving?tx:st.pos.x)-fol.x, dy=(moving?ty:st.pos.y)-fol.y; const fd = dy>0?0:dy<0?1:dx<0?2:dx>0?3:st.dir;
    const fw=wf&&(tx!==fol.x||ty!==fol.y)?1+(wf-1+4)%8:0;
    sprites.push({y:fy/16, px:{x:Math.round(fx),y:Math.round(fy)}, img:charSprite(second,fd,fw)});
  }
  sprites.push({y:pp.y/16+0.01, px:pp, img:charSprite(lead,st.dir,wf)});
  sprites.sort((a,b)=>a.y-b.y);
  for(const s of sprites){ const x=s.px?s.px.x:s.x*16, y=s.px?s.px.y:s.y*16; g.fillStyle='rgba(6,17,28,.27)'; g.beginPath(); g.ellipse(x+8-cam.x,y+13-cam.y,6,2,0,0,Math.PI*2); g.fill(); g.drawImage(s.img,x-cam.x,y-8-cam.y,16,24); }
  if(moving){ const d=G.walk.path[G.walk.path.length-1]; const bl=Math.floor(now/250)%2; g.strokeStyle=bl?PAL.cream:PAL.gold; g.strokeRect(d.x*16-cam.x+3.5,d.y*16-cam.y+3.5,9,9); }
}
function startLoop(){
  cancelAnimationFrame(G.raf); G.lastTs=0;
  const token=G.mapLoopToken=(G.mapLoopToken||0)+1;
  const STEP=G.st?.settings?.moveSpeed==="fast"?110:160;
  const loop=ts=>{
    if(G.mapLoopToken!==token)return;
    if(G.screen!=="explore"||document.hidden){ G.raf=0; return; }
    const dt = G.lastTs? Math.min(100, ts-G.lastTs) : 16; G.lastTs=ts; G.frame++;
    const w=G.walk;
    if(w.path.length && !G.dlg && !G.sheet && !G.lock){
      const n=w.path[0]; const dx=n.x-G.st.pos.x, dy=n.y-G.st.pos.y; G.st.dir = dy>0?0:dy<0?1:dx<0?2:3;
      const advance=Math.min(1-w.prog,dt/STEP);
      G.walkDistance=((G.walkDistance||0)+advance*16)%32000;
      w.prog+=dt/STEP;
      if(w.prog>=1){ w.prog=0; w.path.shift(); G.fol={...G.st.pos}; G.st.pos={x:n.x,y:n.y}; arrive(); }
    }
    if(G.mapLoopToken!==token)return;
    drawMap();
    G.raf=requestAnimationFrame(loop);
  };
  G.raf=requestAnimationFrame(loop);
}
function bfs(m,sx,sy,goal){
  const key=(x,y)=>y*m.w+x; const prev=new Map(); const q=[[sx,sy]]; prev.set(key(sx,sy),null);
  while(q.length){ const [x,y]=q.shift(); if(goal(x,y)&&!(x===sx&&y===sy)){ const path=[]; let k=key(x,y); while(k!==key(sx,sy)){ path.unshift({x:k%m.w,y:Math.floor(k/m.w)}); k=prev.get(k);} return path; }
    for(const [dx,dy] of [[0,1],[0,-1],[-1,0],[1,0]]){ const nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=m.w||ny>=m.h) continue; const k=key(nx,ny); if(prev.has(k)) continue; if(!walkable(m,nx,ny)) continue; prev.set(k,key(x,y)); q.push([nx,ny]); } }
  return null;
}
function walkTo(x,y,pending){
  const st=G.st, m=MAPS[st.mapId]; if(G.readOnly) return toast("閲覧のみのタブです。");
  let path;
  const obj=objAt(m,x,y);
  if(obj && !obj.walk){ if(Math.abs(obj.x-st.pos.x)+Math.abs(obj.y-st.pos.y)===1 || (Math.max(Math.abs(obj.x-st.pos.x),Math.abs(obj.y-st.pos.y))<=1)){ interact(obj); return; }
    path=bfs(m,st.pos.x,st.pos.y,(px,py)=>Math.abs(px-x)+Math.abs(py-y)===1); pending=obj; }
  else { if(x===st.pos.x&&y===st.pos.y) return; if(!walkable(m,x,y)) return; path=bfs(m,st.pos.x,st.pos.y,(px,py)=>px===x&&py===y); }
  if(!path) return toast("そこへは行けません。");
  G.walk.path=path; G.walk.prog=0; G.walk.pending=pending||(obj&&obj.walk?obj:null);
}
function onMapTap(e){
  if(G.sheet||G.dlg) return; const r=G.cv.getBoundingClientRect(); const cam=camera();
  const lx=(e.clientX-r.left)*(G.cv.width/(G.mapRenderScale||1)/r.width)+cam.x, ly=(e.clientY-r.top)*(G.cv.height/(G.mapRenderScale||1)/r.height)+cam.y;
  walkTo(Math.floor(lx/16), Math.floor((ly+4)/16));
}
function arrive(){
  if(!G.st||G.readOnly||G.sheet||G.dlg||G.lock||document.hidden||G.screen!=="explore"||G.st.run)return;
  const st=G.st, m=MAPS[st.mapId]; const zone=zoneAt(m,st.pos.x,st.pos.y);
  if(SND.current!==(m.kind==="field"?"field":"fukuoka")) exploreBgm();
  if(m.kind==="field" && zone){
    // 第07A・23G節：危険タイル到着ごとに1/24の独立抽選（戦えるメンバーがいない時は抽選しない）
    const canFight = st.party.some(c=>vitalOf(c).hp>0);
    if(canFight && randInt(m.encounterRate||24)===0){
      const rolls={count:randInt(2), picks:[randInt(10000),randInt(10000)]};
      G.walk.path=[]; G.walk.pending=null;
      startBattle(createFieldRun(st,zone,rolls)); return;
    }
    commit();
  }
  else keepFlush();
  const o=objAt(m,st.pos.x,st.pos.y);
  if(!G.walk.path.length){
    const pend=G.walk.pending; G.walk.pending=null;
    if(o&&o.walk) interact(o); else if(pend) interact(pend);
    commit(); refreshHere();
  } else if(o&&o.walk&&(o.type==="door")){ G.walk.path=[]; interact(o); }
  else if(!zone) refreshHere();
}
function exploreBgm(){ const st=G.st; if(!st) return SND.play("title"); const m=MAPS[st.mapId]; SND.play(m.kind==="field"?"field":"fukuoka"); }
function refreshHere(){ if(G.screen==="explore" && !G.sheet){ const el=$(".here"); if(el){ const tmp=document.createElement("div"); tmp.innerHTML=renderCurrentLocation(); const n=tmp.querySelector(".here"); el.innerHTML=n.innerHTML; } const g=$(".goal"); if(g) g.textContent=objective(); } }

/* ---- 調べる・会話 ---- */
function interact(o){
  const st=G.st; if(!o||G.readOnly||G.screen!=="explore"||st.run) return; G.walk.path=[]; G.walk.pending=null;
  const face=()=>{ const dx=o.x-st.pos.x, dy=o.y-st.pos.y; if(dx||dy) st.dir = Math.abs(dy)>=Math.abs(dx)?(dy>0?0:1):(dx<0?2:3); };
  face();
  switch(o.type){
    case "npc": return talkNpc(o.npc);
    case "jobcenter": return openSheet("jobcenter");
    case "shop": return openSheet("shop",{shop:o.shop, npc:o.npc, tab:"buy"});
    case "door": return travelMap(o.to,o.tx,o.ty);
    case "gate": {
      if(!o.fieldRoute||MAPS[st.mapId].kind!=="field"||!MAPS[st.mapId].objects.includes(o)||Math.max(Math.abs(o.x-st.pos.x),Math.abs(o.y-st.pos.y))>1)return;
      if(!nationalRouteAvailable(st,curHub(),o.toHub))return say([["",nationalRouteUnlockReason(curHub(),o.toHub)]]);
      return travelHub(o.toHub,o.tx,o.ty,o.to);
    }
    case "station": return openSheet("rail",{stationId:o.id});
    case "box": return openBox(o);
    case "sign": { const a=AREAS[o.area]; const b=Object.values(BOSSES).find(x=>x.areaId===o.area);
      return say([["案内板",`${a.name}（${o.area}）。強度q${a.q}・推奨レベル${a.q}。`+(b?`この奥に地域ボス「${b.name}」（推奨レベル${b.q}）。`:"")],["案内板",a.lore]]); }
    case "boss": return bossPrompt(o.boss);
    case "rest": return openSheet("rest");
    case "inn": return openSheet("inn",{label:o.label});
    case "board": return openSheet("party");
    case "shelf": return openSheet("record");
    case "bench": return say([["もえ",st.moeRank>=1?"ここから見る夕焼け、配信の最後に話したくなるね。":"夕焼けがきれい。……旅に出る前に、この景色を覚えておきたいな。"],[st.profile.name,"また帰ってこよう。"]]);
    case "tower": return say([["","放送塔が空へ伸びている。"]]);
    case "landmark": return say([["案内板","唐津の海辺。新しい土地の声を聞く旅が、ここから始まる。"],["もえ","街の人に、どんな景色を届けたいか聞いてみよう。"]]);
  }
}
function talkNpc(id){
  const st=G.st, n=NPCS[id], p=st.profile.name;
  if(id==="moe") return openSheet("moe");
  let lines;
  if(!st.talked[id]){ lines=n.first(p); st.talked[id]=true; unlockSide(st);
    if(n.rep) lines.push(["",`${n.name}と話した。応援者帳に記録された（親密度1）。`]); }
  else if(n.after && ((id==="akari"&&st.quests.S01==="complete")||(id==="sota"&&st.quests.S02==="complete"))) lines=n.after(p);
  else lines=n.normal(p);
  if(n.questId){ const q=QUESTS[n.questId]; lines=st.quests[n.questId]==="complete"?[[n.name,NATIONWIDE_STORIES[q.hub].resolution]]:[...lines,["",`やる事「${q.name}」で街外の調査を受けられます。`]]; }
  commit(); say(lines);
}
function openBox(o){
  const st=G.st; if(st.boxes[o.box]) return say([["","箱は開いている。記念カードは記録から見られます。"]]);
  const hub=o.box.slice(0,4); const rep = hub==="KY01"?"akari":"sota"; const sq = hub==="KY01"?"S01":"S02";
  const okA = o.box.endsWith("A") && st.talked[rep]; const okB = o.box.endsWith("B") && st.quests[sq]==="complete";
  if(!(okA||okB)) return say([["",o.box.endsWith("A")?`この箱は、${NPCS[rep].name}と初めて話すと開けられる。`:`この箱は、任意依頼${sq}を終えると開けられる。`]]);
  st.boxes[o.box]=true; st.tickets+=40; st.cards.push(o.box);
  const ev=ITEM_EVENTS[o.box.slice(0,4)+"-BOX-"+o.box.slice(-1)]; let extra=[];
  if(ev){ const g=giveItem(st,ev[0],ev[1]); const nm=ITEMS[ev[0]].name;
    if(g.got) extra.push(["",`道具「${nm}」×${g.got}も入っていた！（非売品）`]); if(g.vaulted) extra.push(["",`道具袋がいっぱいのため、${nm}×${g.vaulted}はアイテム金庫へ送った。`]); if(g.kept) extra.push(["",`金庫もいっぱいのため、${nm}×${g.kept}は宿屋の預かり所へ送った。`]); }
  commit(); SND.sfx("ok");
  say([["",`応援箱を開けた！ チケット＋40、記念カード「${BOX_CARDS[o.box]}」を手に入れた。`],...extra]);
}
function bossPrompt(bid){
  const st=G.st, b=BOSSES[bid]; if(MAPS[st.mapId].kind!=="field"||!b) return; const qid=Object.keys(QUESTS).find(k=>QUESTS[k].boss===bid);
  if(st.bossDefeated[bid]) return say([["","乱れは静まっている。図鑑から記録を見られます。"]]);
  if(st.quests[qid]!=="bossReady") return say([["",`奥から大きな重なりを感じる（${b.name}・推奨レベル${b.q}）。依頼「${qid}」を受けて通常敵を倒すと挑戦できます。`]]);
  openSheet("boss",{bid});
}
function say(lines, after){ if(G.st?.heroine?.name)lines=lines.map(([who,line])=>[who==="もえ"?charName(G.st,"moe"):who,String(line).replace(/雪餅羽[ ]?もえ|のわんもえ|もえ/g,charName(G.st,"moe"))]); G.dlg={lines, i:0, after}; render(); }
function renderDialog(){
  const d=G.dlg; if(!d) return "";
  const [sp,tx]=d.lines[d.i];
  return `<div class="overlay dlg-ov" role="dialog" aria-modal="true" aria-label="会話">
    <div class="win dlg">${sp?`<div class="speaker">${esc(sp)}</div>`:""}<p class="dlg-text">${esc(tx)}</p>
    <div class="row3"><button class="btn" data-a="dlgBack" ${d.i?"":"disabled"}>戻る</button>
    <button class="btn" data-a="dlgSkip">省略</button>
    <button class="btn primary" id="dlgNext" data-a="dlgNext">${d.i<d.lines.length-1?"次へ ▼":"閉じる"}</button></div>
    <div class="small">${d.i+1}／${d.lines.length}</div></div></div>`;
}
function playScene(id, after){ const sc=SCENES[id]; if(id.startsWith("RANK_")) SND.sfx("rank"); if(id==="RANK_D2"){ SND.play("ending"); const a0=after; after=()=>{ exploreBgm(); if(a0) a0(); }; } G.st.scenes[id]=true; commit(); say([["",`― ${sc.title} ―`],...sc.lines(G.st.profile.name)], after); }

/* ---- 移動 ---- */
function travelMap(to,tx,ty,save=true){
  const st=G.st; st.mapId=to; st.pos={x:tx,y:ty}; G.walk.path=[]; G.fol={x:tx,y:ty};
  if(!st.visitedMaps.includes(to)) st.visitedMaps.push(to);
  const hub=MAPS[to].hub; if(!st.visitedHubs.includes(hub)) st.visitedHubs.push(hub);
  if(save) commit(); G.sheet=null; exploreBgm(); render();
}
function travelHub(to,tx,ty,mapId=to){
  const st=G.st; const first=!st.visitedHubs.includes(to);
  travelMap(mapId,tx,ty,false);
  const j=JOIN_PLAN.find(x=>x.hub===to);
  const joined=j&&joinMember(st,j.cid);
  commit();
  if(joined){ say([["",`${HUBS[to]?HUBS[to].name:j.pref}で${CHARS[j.cid].full}と出会った。`],["",`${CHARS[j.cid].full}が仲間に加わった。`]]); return; }
  if(first && to==="KY02") say([["",`${HUBS[to].name}に着いた。港の風と倉庫の匂いがする。`],["もえ","ここが北九州……。港の音、配信に入れたら素敵だね。"]]);
}

/* ---- 戦闘 ---- */
function startBattle(run){
  G.auto=false; clearTimeout(G.autoT); G.autoLast=null; G.logExpanded=false;
  const st=G.st; if(!run||MAPS[st.mapId].kind!=="field") return; st.run=run; st.runSeq=run.seq;
  for(const e of run.enemies) if(!e.boss) st.seen[e.id]=true;
  run.log=[`${run.enemies.map(e=>e.display).join("と")}が現れた！`];
  startTurnCue(run);
  if(typeof petTurnStart==="function")petTurnStart(st,run);
  G.cmd={}; G.sheet=null;
  if(run.state==="won"){G.screen="battle";toResult();return;}
  commit(); SND.sfx("enc");
  if(reducedMotion()){ G.screen="battle"; render(); }
  else { const f=document.createElement("div"); f.className="flash"; document.body.appendChild(f); setTimeout(()=>{ f.remove(); G.screen="battle"; render(); },380); }
  SND.play(run.kind==="boss"?"boss":"battle");
}
function partyCard(m,i,run){
  const sel=G.cmd.actor===i; const pct=Math.round(100*m.hp/m.maxHP);
  const ko=m.hp<=0;
  const badges=[ko?"戦闘不能":isLow(m.hp,m.maxHP)?"体力わずか":"",m.acted?"行動済":"", m.ward?`防護${m.ward}`:"", m.guard?"ガード中":""].filter(Boolean);
  return `<button class="pcard ${sel?"on":""} ${ko?"ko":""} ${isLow(m.hp,m.maxHP)?"low":""} ${m.acted?"done":""}" data-a="pickActor" data-i="${i}" ${ko||m.acted||run.state!=="input"?"aria-disabled=\"true\"":""}>
    <canvas class="party-portrait" data-char="${m.cid}" width="128" height="160" aria-hidden="true"></canvas><span class="pline"><b>${sel?"▶":""}${esc(m.name)}</b><span class="pjob">${esc(JOBS[m.job].name)} 熟練度${m.R}</span></span><span class="pbadges">${badges.map(t=>`<span class="pst">${t}</span>`).join("")}</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="pstat">体力<b>${m.hp}</b>/${m.maxHP} MP<b>${m.c}</b></span>
  </button>`;
}
function cueText(run){
  if(!run.cue) return "";
  const kindName={guard:"2人がガード",comment:"2人が応援コメント",damage:"2人が攻撃"}[run.cue.kind];
  if(run.cue.active) return `<div class="cue on">ため中：${kindName} ${run.cue.bits.length}/2 → 強攻撃20%減</div>`;
  const boss=run.enemies.find(e=>e.boss),step=boss?.cycle[(run.turn-1)%boss.cycle.length];
  if(step?.heavy) return `<div class="cue on">${run.cue.ready?"対処成功：強攻撃20%軽減":"対処未達：強攻撃そのまま"}</div>`;
  return `<div class="cue">対処：${kindName}（ため予告のターン）</div>`;
}
function renderBattle(){
  const st=G.st, run=st.run; if(!run) return "";
  const enemies=run.enemies.map(e=>{
    const pct=Math.round(100*e.hp/e.maxHP);
    return `<div class="ecard ${e.hp<=0?"down":""} ${e.boss?"isboss":""}" id="ec${e.slot}">
      <canvas data-enemy="${e.slot}" width="${e.boss?128:64}" height="${e.boss?128:64}" class="esprite ${e.boss?"boss":""}" aria-hidden="true"></canvas>
      <div class="einfo"><div class="ename">${esc(e.display)}${e.rarity>1?` <span class="rar">${"★".repeat(e.rarity)}${["","通常","やや珍しい","希少","極希少","幻影"][e.rarity]}</span>`:""}</div>
      <span class="bar enemy"><i style="width:${pct}%"></i></span>
      <div class="estat">体力 ${e.hp}/${e.maxHP}・防御力${e.def}</div>
      ${e.hp<=0?`<div class="tele">鎮まった</div>`:""}</div></div>`; }).join("");
  const chain = run.kiraDone?"キラコメ済":`キラコメ${run.chain.stage}/3 次:${["挨拶","作戦","感謝"][run.chain.stage]}`;
  const battleLines=Array.isArray(run.log)?run.log:[];
  return `<section class="battle">
    <div class="bhead"><span>ターン${run.turn}・${esc(DIFFICULTY[run.difficulty].name)}・${run.kind==="boss"?"地域ボス":esc(AREAS[run.areaId].name)}</span><span>コメント連携${run.B}・${chain}</span></div>
    <div class="gauge" aria-label="エール${run.A}"><span>エール</span><span class="bar ale"><i style="width:${run.A}%"></i></span><b>${run.A}</b></div>
    ${run.support&&SUPPORTS[run.support]?`<p class="battle-support small">地域支援：${esc(SUPPORTS[run.support].name)}（${esc(SUPPORTS[run.support].text)}）</p>`:""}
    ${cueText(run)}
    <div class="enemies" data-terrain="${esc(MAPS[st.mapId]?.terrain||"plain")}"><canvas class="stagebg" width="160" height="64" aria-hidden="true"></canvas>${enemies}</div>
    <div class="party">${run.party.map((m,i)=>partyCard(m,i,run)).join("")}</div>
    ${renderCommand(run)}
    <details class="battle-records" ${G.logExpanded?"open":""}><summary>戦闘記録・バッジ</summary><button class="btn" data-a="openSheet" data-k="battleChallenges">挑戦・戦闘バッジ</button>
    <div class="srow"><button class="btn" data-a="battleLogExpand" aria-pressed="${!!G.logExpanded}">${G.logExpanded?"ログを縮小":"ログを拡大"}</button><button class="btn" data-a="openSheet" data-k="battleLog">履歴を見る</button></div>
    <div class="log ${G.logExpanded?"expanded":""}" role="log" aria-live="polite" aria-label="直近の戦闘ログ">${battleLines.slice(G.logExpanded?-8:-3).map((l,i,a)=>`<button class="log-entry" data-a="battleLogLine" data-v="${battleLines.length-a.length+i}">${esc(l)}</button>`).join("")}</div>
    </details>
  </section>`;
}
function renderBattleLog(){
  const lines=(Array.isArray(G.st?.run?.log)?G.st.run.log:[]).slice(-80).reverse();
  const pages=Math.max(1,Math.ceil(lines.length/8));
  const page=Math.min(Math.max(0,Number.isInteger(G.sheetData?.page)?G.sheetData.page:0),pages-1);
  const selected=G.sheetData?.line;
  if(Number.isInteger(selected)&&selected>=0&&selected<lines.length) return `<p class="small">戦闘ログ・${lines.length-selected}件目</p><p>${esc(lines[selected])}</p><button class="btn" data-a="battleLogBack">履歴に戻る</button>`;
  return `<p class="small">直近${lines.length}件・新しい順（${page+1}/${pages}ページ）</p><div class="stack">${lines.slice(page*8,(page+1)*8).map((l,i)=>`<button class="btn" data-a="battleLogLine" data-v="${lines.length-1-(page*8+i)}">${esc(l)}</button>`).join("")||"<p>まだありません。</p>"}</div><div class="srow"><button class="btn" data-a="battleLogPage" data-v="${page-1}" ${page>0?"":"disabled"}>新しい記録</button><button class="btn" data-a="battleLogPage" data-v="${page+1}" ${page+1<pages?"":"disabled"}>古い記録</button></div>`;
}
function skillNeeds(job){ return ({J01:"enemy",J02:"line",J03:"ally",J04:"mode",J05:"enemy",J06:"mode",J07:"none",J08:"ally",J09:"enemy",J10:"none",J11:"none",J12:"none",J13:"ally",J14:"none",J15:"enemy",J16:"enemy",J17:"none",J18:"ally",J19:"enemy",J20:"none",J21:"enemy",J22:"allyOther"})[job]; }
function renderCommand(run){
  if(run.state==="won") return `<div class="win cmd"><p>勝利！ ノイズ体をすべて鎮めた。</p><button class="btn primary wide" data-a="toResult">結果を見る</button></div>`;
  if(run.state==="lost") return `<div class="win cmd"><p class="small">全員が戦闘不能。この戦闘の報酬は0。所持ゴールドの半分を失い、全員の体力とMPを回復して安全な場所へ戻ります。受注・討伐数・経験値・熟練度・所持品は保持。</p><button class="btn primary wide" data-a="defeatReturn">安全な場所へ戻る</button></div>`;
  if(G.auto){
    const al2=run.party.filter(m=>m.hp>0&&!m.acted);
    return `<div class="win cmd autopanel" aria-live="polite">
      <p class="autotitle">オート戦闘中</p>
      <p class="small">敵の予告と残り体力・MPに合わせて行動します。</p>
      <p class="autolast">${G.autoLast?esc(G.autoLast):"考え中…"}</p>
      <p class="small">このターンの未行動：${al2.map(m=>esc(m.name)).join("・")||"なし"}</p>
      <div class="confirmrow"><span></span><button class="btn primary stopauto" data-a="autoOff">中断</button></div></div>`;
  }
  const c=G.cmd; const al=run.party.filter(m=>m.hp>0&&!m.acted);
  if(c.actor==null || !run.party[c.actor] || run.party[c.actor].acted || run.party[c.actor].hp<=0){ c.actor = al.length? al[0].pos : null; c.type=null; }
  const a=run.party[c.actor]; if(!a) return "";
  const S=a.S;
  const entries=[["attack","アタック"],["comment",a.job==="J02"?"コメント整理":"応援コメント"],["skill",JOBS[a.job].skill],["item","道具"],["guard","ガード"],["rest","ひと息つく"],["other","その他"]];
  const chip=(k,v,on,label)=>`<button class="chip ${on?"on":""}" data-a="cmdSet" data-k="${k}" data-v="${v}" aria-pressed="${on}">${on?"▶":""}${label}</button>`;
  const enemyPick=()=>`<span class="chiplabel">対象</span>`+run.enemies.filter(e=>e.hp>0).map(e=>chip("target",e.slot,c.target===e.slot,esc(e.display))).join("");
  const allyPick=(other)=>`<span class="chiplabel">対象</span>`+run.party.filter(m=>m.hp>0&&(!other||m!==a)).map(m=>chip("ally",m.pos,c.ally===m.pos,esc(m.name))).join("");
  const linePick=()=>["greet","plan","thanks"].map(l=>chip("line",l,c.line===l,LINE_NAMES[l])).join("");
  const liveE=run.enemies.filter(e=>e.hp>0); if(liveE.length===1) c.target=liveE[0].slot;
  let sub="", info="";
  if(c.type==="attack") sub=enemyPick();
  if(c.type==="comment"){ sub=linePick(); info=`MP1・エール＋${(a.job==="J02"?22+S:18)+a.commentA}・コメント連携4`+(c.line?`「${COMMENT_LINES[c.line][run.turn%3]}」`:""); }
  if(c.type==="skill"){
    const need=skillNeeds(a.job);
    info=`MP${JOBS[a.job].cost}・${JOBS[a.job].desc(S)}`;
    if(need==="enemy") sub=enemyPick();
    if(need==="ally") sub=allyPick(false);
    if(need==="allyOther") sub=allyPick(true);
    if(need==="line") sub=linePick();
    if(need==="mode"){
      const modes = a.job==="J04"?[["hp","体力補給"],["c","集中補給"]]:[["safe","堅実"],["bold","強気"]];
      sub=modes.map(([k,n])=>chip("mode",k,c.mode===k,n)).join("");
      if(c.mode==="hp") sub+=allyPick(false); if(c.mode==="c") sub+=allyPick(true);
      if(c.mode==="safe"||c.mode==="bold") sub+=enemyPick();
    }
  }
  if(c.type==="item"){
    const usable=(run.bag||[]).filter(e=>e.n>0&&ITEMS[e.id]&&!ITEMS[e.id].petSupply);
    if(!usable.length) sub=`<span class="hint">使える道具を持っていません。ショップで買えます。</span>`;
    else { sub=usable.map(e=>chip("item",e.id,c.item===e.id,`${esc(ITEMS[e.id].name)}×${e.n}`)).join("");
      const it=c.item&&ITEMS[c.item];
      if(it){ const nd=itemNeeds(it); info=`${itemText(it,run.V)}（${ITEM_RARITY[it.stars].slice(0,2)}）${a.pouch&&it.cat!=="攻撃"?"・ポーチで1.5倍":""}`;
        if(nd==="enemy") sub+=`<span class="chipbreak"></span>`+enemyPick(); if(nd==="ally") sub+=`<span class="chipbreak"></span>`+allyPick(false);
        if(nd==="down") sub+=`<span class="chipbreak"></span><span class="chiplabel">対象</span>`+(run.party.filter(m=>m.hp<=0).map(m=>chip("ally",m.pos,c.ally===m.pos,esc(m.name))).join("")||`<span class="hint">戦闘不能の仲間はいません</span>`); } }
  }
  if(c.type==="guard") info="受けるダメージ半分・MP＋1";
  if(c.type==="rest") info=`自分のMP＋${4+a.rest}`;
  if(c.type==="other"){
    sub=chip("o","meter",c.o==="meter",`メーター突破`)+chip("o","family",c.o==="family",`ファミリー応援`)
      +`<button class="chip" data-a="retreat">撤退</button><button class="chip" data-a="pauseBattle">休止</button>`;
    info = c.o==="meter"?`エール80・敵全体に${18+4*run.L+run.V*a.meter}−防御力`: c.o==="family"?`エール40・全員の体力＋${(12+a.family)*run.V}・戦闘不能から復帰`:"";
  }
  const act=buildAct(a);
  let prev = info?`<span class="pinfo">${esc(info)}</span>`:"";
  let ok=false;
  if(act){ const p=planAction(run,c.actor,act); ok=p.ok; prev = (info?`<span class="pinfo">${esc(info)}</span>`:"") + (p.ok? previewText(run,a,p) : `<span class="warn">${esc(p.reason)}</span>`); }
  else if(c.type) prev += `<span class="hint">対象・台詞を選んでください</span>`;
  else prev = `<span class="hint">${esc(a.name)}の行動を選んでください（未行動${al.length}人）</span>`;
  return `<div class="win cmd">
    <div class="cmdgrid">${entries.map(([k,n])=>`<button class="btn ${c.type===k?"on":""}" data-a="cmdType" data-v="${k}">${c.type===k?"▶":""}${esc(n)}</button>`).join("")}</div>
    ${sub?`<div class="chips">${sub}</div>`:""}
    <div class="confirmrow"><div class="preview">${prev}</div><button class="btn auto" data-a="autoOn" ${G.readOnly?"disabled":""}>オート</button><button class="btn primary" data-a="confirmAct" ${act&&ok&&!G.readOnly?"":"disabled"}>確定</button></div></div>`;
}
function buildAct(a){
  const c=G.cmd; if(!c.type) return null;
  if(c.type==="attack") return c.target!=null?{type:"attack",target:c.target}:null;
  if(c.type==="comment") return c.line?{type:"comment",line:c.line}:null;
  if(c.type==="guard") return {type:"guard"};
  if(c.type==="rest") return {type:"rest"};
  if(c.type==="other"){ if(c.o==="meter") return {type:"meter"}; if(c.o==="family") return {type:"family"}; return null; }
  if(c.type==="item"){ const it=c.item&&ITEMS[c.item]; if(!it) return null; const nd=itemNeeds(it);
    if(nd==="enemy") return c.target!=null?{type:"item",item:c.item,target:c.target}:null;
    if(nd==="ally"||nd==="down") return c.ally!=null?{type:"item",item:c.item,ally:c.ally}:null;
    return {type:"item",item:c.item}; }
  if(c.type==="skill"){
    const need=skillNeeds(a.job);
    if(need==="none") return {type:"skill"};
    if(need==="enemy") return c.target!=null?{type:"skill",target:c.target}:null;
    if(need==="ally"||need==="allyOther") return c.ally!=null?{type:"skill",ally:c.ally}:null;
    if(need==="line") return c.line?{type:"skill",line:c.line}:null;
    if(need==="mode"){ if(!c.mode) return null; if(c.mode==="hp"||c.mode==="c") return c.ally!=null?{type:"skill",mode:c.mode,ally:c.ally}:null; return c.target!=null?{type:"skill",mode:c.mode,target:c.target}:null; }
  }
  return null;
}
function previewText(run,a,p){
  const out=[];
  if(p.cost.c) out.push(`MP−${p.cost.c}`); if(p.cost.a) out.push(`エール−${p.cost.a}`); if(p.cost.hp) out.push(`体力−${p.cost.hp}`);
  for(const d of p.dmg){ const e=run.enemies.find(x=>x.slot===d.slot); out.push(`${e.display}に${d.raw}ダメージ${d.raw>=e.hp?"（鎮まる）":""}`); }
  for(const h of p.heal){ const t=run.party[h.pos]; if(h.revive) out.push(`${t.name}が復帰`); else if(h.amt>0) out.push(`${t.name} 体力＋${h.amt}`); }
  for(const g of p.cgain){ if(g.amt>0) out.push(`${run.party[g.pos].name} MP＋${g.amt}`); }
  for(const w of p.ward){ if(w.amt>0) out.push(`${run.party[w.pos].name} 防護＋${w.amt}`); }
  if(p.aGain) out.push(`エール＋${Math.min(p.aGain,100-run.A+p.cost.a)}`);
  if(p.consumeB&&run.B) out.push(`コメント連携${run.B}を使用`);
  if(p.setB!=null) out.push("コメント連携を4に");
  if(p.guard) out.push("受けるダメージ半分・MP＋1");
  if(p.chain){ out.push(p.chain.adv? (run.chain.stage===2?"キラコメ連携が発動！":`連携が進む（${run.chain.stage+1}/3）`) : "連携は進まない"); }
  if(p.chainReset) out.push("この行動で連携は途切れます");
  if(p.cue) out.push("ボス対処に参加");
  return `<span class="pv">${out.map(esc).join("／")}</span>`;
}
function drawEnemies(){
  const run=G.st.run; if(!run) return; const now=Date.now(); const still=reducedMotion();
  const f=still?0:Math.floor(now/500)%2;
  const bg=document.querySelector("canvas.stagebg"); if(bg){ const g=bg.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(ART.stage(run.areaId, still?0:Math.floor(now/400)%4),0,0); }
  document.querySelectorAll("canvas[data-enemy]").forEach(c=>{
    const e=run.enemies.find(x=>x.slot===+c.dataset.enemy); const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.clearRect(0,0,c.width,c.height);
    if(!e||e.hp<=0) return;
    let img = e.boss? ART.enemy(e.id,"",null,run.areaId,f,128,true) : ART.enemy(e.profile,e.species,e.attr,run.areaId,f,64);
    if(G.flash && G.flash.until>now && G.flash.slots.includes(e.slot) && Math.floor(now/60)%2===0) img=ART.flashOf(img);
    g.drawImage(img,0,0);
  });
}
function dealtBy(before){ const run=G.st.run; return run && run.enemies.some(e=>e.hp<before.e[e.slot]); }
function isLow(hp,max){ return hp>0 && hp<=max*0.3; }
function battleFx(before){
  const st=G.st,run=st?.run;if(!run)return;
  if(run.party.some((m,i)=>m.hp<before.p[i])){
    const ko=run.party.some((m,i)=>m.hp<=0&&before.p[i]>0);
    setTimeout(()=>{if(G.st===st&&st.run===run&&G.screen==="battle"&&!document.hidden)SND.sfx(ko?"down":"damage");},dealtBy(before)?320:90);
  }
  if(typeof BATTLE_FX!=="undefined")BATTLE_FX.play(before,run);
}
function pop(el,text,cls){ if(!el) return; const s=document.createElement("span"); s.className="pop "+cls; s.textContent=text; el.appendChild(s); setTimeout(()=>s.remove(),900); }
function startBattleTimer(){ stopBattleTimer(); if(!reducedMotion()) G.battleTimer=setInterval(drawEnemies,250); }
function stopBattleTimer(){ if(G.battleTimer){ clearInterval(G.battleTimer); G.battleTimer=0; } }
function confirmAct(forced){
  const st=G.st, run=st.run; const a=run.party[G.cmd.actor]; const act=forced||buildAct(a); if(!act) return;
  const before={e:Object.fromEntries(run.enemies.map(e=>[e.slot,e.hp])), p:run.party.map(m=>m.hp),fx:{actor:G.cmd.actor,action:{...act},job:a.job}};
  const r=applyAction(run,G.cmd.actor,act);
  if(!r.ok) return toast(r.reason);
  before.fx.events=r.visual||[];
  // 攻撃した時の効果音（通常攻撃・技能・全体攻撃・メーター突破で鳴り分け）
  const dealt = run.enemies.some(e=>e.hp<before.e[e.slot]);
  const killed = run.enemies.some(e=>e.hp<=0&&before.e[e.slot]>0);
  const atkSnd = act.type==="meter"?"meter": !dealt?null : act.type==="attack"?"slash" : run.enemies.filter(e=>e.hp<before.e[e.slot]).length>1?"allhit":"skillhit";
  SND.sfx(atkSnd || (r.log.some(l=>/体力＋|MP＋|防護/.test(l))?"heal":"ok"));
  if(killed && run.state!=="won") setTimeout(()=>SND.sfx("defeat"),180);
  if(r.log.some(l=>l.startsWith("パチパチ"))) SND.sfx("clap");
  if(r.log.some(l=>l.startsWith("キラコメ"))) SND.sfx("kira");
  G.cmd={};
  if(run.state==="won") setTimeout(()=>{if(G.st===st&&st.run===run&&G.screen==="battle"&&run.state==="won")SND.jingle("fanfare","victory");},250);
  if(run.state==="lost") setTimeout(()=>{if(G.st===st&&st.run===run&&G.screen==="battle"&&run.state==="lost")SND.jingle("lose",null);},450);
  commit(); render(); battleFx(before);
}
/* ---- 戦闘オート（中断ボタンまで、戦闘終了まで自動で続く） ---- */
function autoStep(){
  clearTimeout(G.autoT);
  const st=G.st, run=st&&st.run;
  if(!G.auto || G.screen!=="battle" || !run) { G.auto=false; return; }
  if(run.state!=="input"){ G.auto=false; G.autoLast=null; render(); return; }
  if(G.sheet||G.dlg||document.hidden){ G.autoT=setTimeout(autoStep,400); return; }
  const pick=aiChoose(run);
  if(!pick){ G.auto=false; render(); return toast("オートで選べる行動がありません。"); }
  G.autoLast=`${pick.name}：${pick.label}`;
  G.cmd={actor:pick.idx}; G.autoAct=pick.act;
  confirmAct(pick.act);
  if(G.auto && run.state==="input") G.autoT=setTimeout(autoStep, reducedMotion()?250:650);
  else { G.auto=false; render(); }
}
function toResult(){
  const st=G.st, run=st?.run;
  if(G.readOnly||G.screen!=="battle"||G.sheet||G.dlg||!run||run.state!=="won") return;
  const res=applyVictory(st,run);
  st.battleBadges=Array.isArray(st.battleBadges)?st.battleBadges:[];
  const eligible=eligibleBattleBadges(run);
  const newBadges=eligible.filter(id=>!st.battleBadges.includes(id));
  st.battleBadges.push(...newBadges);
  if(res.levelAfter>res.levelBefore && Vof(res.levelAfter)>Vof(res.levelBefore)) res.notes.push("技能・装備の効果量が上昇（V"+Vof(res.levelAfter)+"）");
  const L0=res.levelBefore, L1=levelOf(st.xp,st);
  st.lastResult={seq:run.seq, kind:run.kind, bossId:run.bossId||null, turns:run.turn, ...res,
    itemsUsed:clone(Array.isArray(run.itemHistory)?run.itemHistory:[]), itemsUsedKnown:run.itemHistoryComplete===true, newBadges,
    enemies:run.enemies.map(e=>({name:e.display||e.name, boss:!!e.boss, rarity:e.rarity||0})),
    members:run.party.map(m=>({cid:m.cid, maxBefore:charStats(st,m.cid,L0).maxHP, maxAfter:charStats(st,m.cid,L1).maxHP}))};
  const back=run.returnPos; st.run=null;
  st.mapId=back.map; st.pos={x:back.x,y:back.y};
  commit(); G.screen="result"; render();
  if(res.levelAfter>res.levelBefore) SND.jingle("levelup","victory"); else if(SND.current!=="victory") SND.play("victory");
}
function renderResult(){
  const st=G.st, r=st.lastResult; if(!r) return "";
  const L=levelOf(st.xp,st), up=r.levelAfter>r.levelBefore;
  const pct=(a,b)=>Math.max(0,Math.min(100,Math.round(a/b*100)));
  const xpNow=st.xp-xpFor(L), xpSpan=L<levelLimit(st)?xpFor(L+1)-xpFor(L):1;
  const foes=r.enemies||[];
  const title = r.kind==="boss" ? "ボスを鎮めた！" : "勝利！";
  const sub = (r.turns?`${r.turns}ターン`:"")+(foes.length?`・${foes.map(e=>esc(e.name)).join("、")}を鎮めた`:"");
  const card=(lab,val,cls="")=>`<div class="rstat ${cls}"><span class="rlab">${lab}</span><span class="rval">${val}</span></div>`;
  const mem=(r.members||[]).map(x=>{
    const j=(r.jp||[]).find(y=>y.cid===x.cid)||{gain:0}; const s=charStats(st,x.cid,L); const v=vitalOf(x.cid);
    const jp=jpOf(st,x.cid,s.job), R=rankOf(jp,jobLimit(st,x.cid,s.job)), jpA=jpFor(R), jpB=R<999?jpFor(R+1):jpA+1;
    const low=isLow(v.hp,s.maxHP), down=v.hp<=0;
    return `<div class="rmem ${low||down?"low":""}">
      <div class="rmh"><b>${esc(charName(st,x.cid))}</b><span class="small">${esc(JOBS[s.job].name)}</span>${j.R1>j.R0?`<span class="rbadge">熟練度 ${j.R0}→${j.R1}</span>`:""}</div>
      <div class="gauge"><span>熟練度${R}</span><span class="bar jp"><i style="width:${pct(jp-jpA,jpB-jpA)}%"></i></span><b>＋${j.gain}</b></div>
      <div class="gauge"><span>体力</span><span class="bar"><i style="width:${pct(v.hp,s.maxHP)}%"></i></span><b>${v.hp}/${s.maxHP}</b></div>
      <div class="gauge"><span>MP</span><span class="bar cp"><i style="width:${pct(v.c,s.startC)}%"></i></span><b>${v.c}/${s.startC}</b></div>
      ${up&&x.maxAfter>x.maxBefore?`<p class="small good">最大体力 ${x.maxBefore} → ${x.maxAfter}</p>`:""}
      ${down?`<p class="small warn">戦闘不能。宿屋か蘇生の道具で回復しよう。</p>`:low?`<p class="small warn">体力わずか。回復しておこう。</p>`:""}
    </div>`; }).join("");
  const items=[...(r.items||[]).map(x=>`<li class="ritem"><span class="rst">${"★".repeat(ITEMS[x.id].stars)}</span>${esc(ITEMS[x.id].name)} ×${x.n}<span class="small">（${esc(x.why)}）</span></li>`),
    ...(r.itemsVaulted||[]).map(x=>`<li class="ritem">${esc(ITEMS[x.id].name)} ×${x.n} はアイテム金庫へ</li>`),
    ...(r.itemsKept||[]).map(x=>`<li class="warn">${esc(ITEMS[x.id].name)} ×${x.n} は袋がいっぱいのため宿屋の預かり所へ</li>`),
    ...(r.itemsLost||[]).map(x=>`<li class="warn">${esc(ITEMS[x.id].name)} ×${x.n} は金庫と預かり所もいっぱいで受け取れず</li>`)];
  const gifts=r.gifts.map(g=>`<li class="ritem">専用品「${esc(EQUIP[g].name)}」を贈られた</li>`);
  const usedItems=(r.itemsUsed||[]).map(x=>{
    const effects=[x.hp>0?`体力＋${x.hp}`:"",x.c>0?`MP＋${x.c}`:"",x.revives>0?`復帰${x.revives}人`:""].filter(Boolean);
    const actor=x.actor==="hero"||CHARS[x.actor]?`${esc(charName(st,x.actor))}：`:"";
    return `<li>${Number.isInteger(x.turn)&&x.turn>0?`${x.turn}ターン目・`:""}${actor}${esc(ITEMS[x.id]?.name||x.id)}${effects.length?`（${effects.join("・")}）`:""}</li>`;
  });
  const anyLow=st.roster.some(c=>{const v=vitalOf(c),s=charStats(st,c,L); return v.hp<=0||isLow(v.hp,s.maxHP);});
  return `<section class="result" aria-labelledby="rtitle">
    <div class="rbanner ${r.kind==="boss"?"boss":""}"><h2 id="rtitle">${title}</h2><p>${sub}</p></div>
    ${up?`<div class="rlevel"><b>レベルアップ！</b><span>レベル${r.levelBefore} → <b class="big">${r.levelAfter}</b></span>${Vof(r.levelAfter)>Vof(r.levelBefore)?`<span class="small">技能・装備・道具の効果量が上昇</span>`:""}</div>`:""}
    <div class="rgrid">${card("経験値",`＋${r.xp.toLocaleString()}`)}${card("ゴールド",`＋${r.gold.toLocaleString()}`,"gold")}${r.tickets?card("チケット",`＋${r.tickets.toLocaleString()}`):card("所持金",`${st.gold.toLocaleString()}G`)}</div>
    <div class="gauge rxp"><span>レベル${L}</span><span class="bar xp"><i style="width:${pct(xpNow,xpSpan)}%"></i></span><b>${L<levelLimit(st)?`次まで${Math.max(0,xpSpan-xpNow).toLocaleString()}`:"最大"}</b></div>
    ${r.quest?`<div class="rquest done">依頼「${r.quest} ${esc(QUESTS[r.quest].name)}」完了！</div>`:r.kills&&r.killQuest?`<div class="rquest"><span>依頼 ${r.killQuest} 討伐</span><span class="bar"><i style="width:${pct(r.killNow,r.killNeed)}%"></i></span><b>${r.killNow}/${r.killNeed}</b></div>`:""}
    ${items.length||gifts.length?`<div class="rbox"><h3 class="label">手に入れたもの</h3><ul class="rlist">${[...items,...gifts].join("")}</ul></div>`:""}
    ${renderUsedItemHistory(r,usedItems)}
    ${(r.newBadges||[]).length?`<div class="rbox"><h3 class="label">新しい戦闘バッジ</h3><ul class="rlist">${r.newBadges.map(id=>`<li>${id} ${esc(ITEM_BADGES[id]||GROWTH_BADGES[id]||PARTY_BADGES[id]||ACTION_BADGES[id]||HEAL_BADGES[id]||MP_BADGES[id]||CHEER_BADGES[id]||SPEED_BADGES[id]||ATTACK_BADGES[id]||GUARD_BADGES[id]||DEFENSE_BADGES[id]||EXTRA_BADGES[id]||id)}</li>`).join("")}</ul></div>`:""}
    <button class="btn" data-a="openSheet" data-k="record">戦闘バッジ一覧を見る</button>
    ${r.notes.filter(n=>!/効果量が上昇/.test(n)).map(n=>`<p class="good rnote">${esc(n)}</p>`).join("")}
    <h3 class="label">仲間</h3><div class="rmems">${mem}</div>
    ${anyLow?`<p class="small warn">体力が減っている仲間がいます。次の戦闘へ持ち越すので、道具や宿屋で回復しておこう。</p>`:""}
    <div class="rfoot"><button class="btn primary wide" data-a="resultDone">探索へ</button></div></section>`;
}
function renderUsedItemHistory(result,usedItems){
  if(usedItems.length) return `<div class="rbox"><h3 class="label">この戦闘で使った道具（${usedItems.length}回）</h3><ul class="rlist">${usedItems.join("")}</ul>${result.itemsUsedKnown===true?"":`<p class="small">旧記録のため、使用履歴が一部欠けている可能性があります。</p>`}</div>`;
  return `<div class="rbox"><h3 class="label">この戦闘で使った道具</h3><p class="small">${result.itemsUsedKnown===true?"道具は使いませんでした。":"使用記録がありません（旧保存または履歴が不完全な戦闘）。"}</p></div>`;
}
function resultDone(){
  const st=G.st,r=st.lastResult; G.screen="explore"; keepFlush(); render(); exploreBgm();
  const ids=[];
  if(r?.quest){
    const Q=QUESTS[r.quest];
    if(Q.completeScene) ids.push(Q.completeScene);
    else {
      const legacy={M01:["RANK_D1"],M02:["M02_BOSS","RANK_D2"],M03:["M03_BOSS","RANK_D3"],M04:["M04_BOSS","RANK_C1"],M05:["M05_BOSS","RANK_C2"],M06:["M06_BOSS","RANK_C3"],M07:["M07_BOSS","RANK_B1"],M08:["M08_BOSS","RANK_B2"],S01:["S01_DONE"],S02:["S02_DONE"]};
      ids.push(...(legacy[r.quest]||[]));
    }
  }
  if(st.nationalClear) ids.push("NATIONWIDE_END");
  const pending=ids.filter(id=>SCENES[id]&&!st.scenes[id]);
  const next=()=>{const id=pending.shift(); if(id) playScene(id,next);}; next();
}

/* ---- シート（メニュー） ---- */
function openSheet(k,data={}){ if(G.vaultSaving||G.shopSaving||G.petSaving||G.characterSaving||G.featureSaving) return; G.sheet=k; G.sheetData=data; G.walk.path=[]; render(); const el=$(".sheet"); if(el) el.scrollTop=0; }
function closeSheet(){ if(G.vaultSaving||G.shopSaving||G.petSaving||G.characterSaving||G.featureSaving) return; G.sheet=null; render(); }
function sheetWrap(title, body){ return `<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="win sheet"><div class="sheet-head"><h2 class="label">${esc(title)}</h2><div class="sheet-actions"><button class="btn" data-a="closeSheet" ${G.vaultSaving||G.shopSaving?"disabled":""}>戻る</button>${G.screen==="explore"&&G.st&&!G.st.run?`<button class="btn" data-a="returnToMap">MAPへ戻る</button>`:""}</div></div>${body}</div></div>`; }
function renderSheet(){
  const k=G.sheet; if(!k) return ""; const st=G.st; const d=G.sheetData;
  switch(k){
    case "menu": return sheetWrap("メニュー",renderMainMenu());
    case "about": return sheetWrap("この作品について",`<p>「ポコチャクエスト」は、配信文化を参考にした非公式の創作RPGです。人物・台詞・敵・数値・画像・音はゲーム用の創作で、実在のサービスの配信・課金・アカウント・ランキングとは連携しません。</p><p>アイドルグループを離れたヒロインが、旅を通じてS6を目指す背景は物語の設定です。作中のランクは物語上の到達記録で、実際のランク歴ではありません。</p><p>敵の名前は、配信・応援の言葉とRPGの語感を組み合わせた本作の創作名です。</p><p class="small">gameVersion ${GAME_VERSION}／schemaVersion ${SCHEMA_VERSION}</p>`);
    case "share": return sheetWrap("友だちに教える", renderShare());
    case "settings": return sheetWrap("設定と保存", renderSettings());
    case "nearby": { const near=nearbyObjects(); return sheetWrap("近くを調べる", near.length? `<div class="stack">${near.map(o=>`<button class="btn" data-a="interactId" data-v="${o.id}">${esc(o.label)}</button>`).join("")}</div>` : `<p>近くに調べられるものはありません。オート移動から目的地を選べます。</p>`); }
    case "guide": { const m=MAPS[st.mapId]; return sheetWrap("オート移動", `<p class="small">選ぶと、その場所まで実際に歩きます（途中の遭遇エリアでは抽選があります）。</p><div class="stack">${m.objects.filter(o=>o.type!=="tower").map(o=>{ const a=o.area?AREAS[o.area]:null; return `<button class="btn" data-a="guideTo" data-v="${o.id}">${esc(o.label)}${a?`（推奨レベル${a.q}）`:""}</button>`; }).join("")}</div>`); }
    case "quests": return sheetWrap("やる事", renderQuests());
    case "map": return sheetWrap("全国の旅の地図", renderWorld());
    case "travel": return sheetWrap("街外の道", "<p>街間の徒歩移動は街外MAPの道を進みます。街の出口から出発してください。</p>");
    case "rail": return sheetWrap("新幹線駅",renderRail());
    case "rest": return sheetWrap("休息", `${d.reason?`<p class="warn">${esc(d.reason)}</p>`:""}<p>日付を進めると翌日になります（費用なし）。体力とMPは回復しません。回復は宿屋で。今は${st.day}日目。</p><div class="stack"><button class="btn primary" data-a="doRest">日付を進める</button><button class="btn" data-a="closeSheet">やめる</button></div>`);
    case "party": return sheetWrap("編成", renderParty());
    case "status": return sheetWrap("パーティーのステータス", renderStatus());
    case "inn": { const hub=curHub(); const per=INN_PRICE[hub]||10; const n=st.roster.length; const total=per*n; const can=st.gold>=total;
      return sheetWrap(d.label||"宿屋", `<p>「いらっしゃいませ。お一人さま${per}ゴールド、${n}人で${total}ゴールドです。」</p>
      <p class="small">泊まると翌朝になり、全員の体力とMPが全回復します。所持${st.gold.toLocaleString()}ゴールド → 宿泊後${(st.gold-total).toLocaleString()}ゴールド。</p>
      <ul class="list">${st.roster.map(cid=>{const s=charStats(st,cid,levelOf(st.xp,st)),v=vitalOf(cid); return `<li>${esc(charName(st,cid))}：体力 ${v.hp}/${s.maxHP}・MP ${v.c}/${s.startC}</li>`;}).join("")}</ul>
      ${can?"":`<p class="warn">ゴールドが足りません（あと${total-st.gold}）。通常敵を倒すとゴールドが手に入ります。</p>`}
      <div class="stack"><button class="btn primary" data-a="doInn" ${can?"":"disabled"}>泊まる（${total}ゴールド）</button><button class="btn" data-a="closeSheet">やめる</button></div>`); }
    case "record": return sheetWrap("記録", renderRecord());
    case "goldVault": return sheetWrap("ゴールド金庫", renderGoldVault());
    case "itemVault": return sheetWrap("アイテム金庫", renderItemVault());
    case "battleChallenges": return sheetWrap("挑戦・戦闘バッジ", renderBattleChallenges());
    case "items": return sheetWrap("道具", renderItems());
    case "dex": return sheetWrap("ノイズ図鑑", renderDex());
    case "shop": return sheetWrap(SHOPS[d.shop].name, renderShop());
    case "moe": return sheetWrap("もえ", renderMoe());
    case "boss": { const b=BOSSES[d.bid]; const ps=bossScale(d.bid, st.party.length); const df=DIFFICULTY[st.settings.difficulty]; const pw=x=>Math.ceil(x*df.atk*ps.atk); return sheetWrap("地域ボス", `<p><b>${esc(b.name)}</b>（${d.bid}）　強度q${b.q}・推奨レベル${b.q}。現在レベル${levelOf(st.xp,st)}。</p><p class="small">体力${Math.ceil((100+36*b.q)*df.hp*ps.hp)}（${df.name}）。${st.party.length<4&&(ps.hp<1||ps.atk<1)?`戦闘メンバー${st.party.length}人のため、体力×${ps.hp}・攻撃×${ps.atk}の少人数補正（挑戦時の人数で固定）。`:""}</p><p class="small">行動周期：${(b.cycle||[["s",12+b.q],["a",6+Math.floor(b.q/2)],["c",0],["a",10+3*b.q]]).map(step=>{const t=step.t||step[0],p=step.p??step[1]; return t==="c"?"ため":(t==="s"?"単体攻撃":"全体攻撃")+pw(p);}).join(" → ")}。ため予告中に<b>${b.cue==="damage"?"異なる2人がダメージを与える":b.cue==="comment"?"異なる2人が応援コメント":"異なる2人がガード"}</b>すると、直後の強攻撃が20%減ります。</p><p class="small">報酬：経験値${bossReward(d.bid).xp}・${bossReward(d.bid).gold}ゴールド（経験値は現在の上限まで）。依頼達成報酬は別です。</p><p class="small">敗北・撤退しても受注と討伐数は保持され、再挑戦できます。</p><div class="stack"><button class="btn primary" data-a="bossGo" data-v="${d.bid}">挑戦する</button><button class="btn" data-a="closeSheet">準備する</button></div>`); }
    case "battleLog": return sheetWrap("戦闘ログ", renderBattleLog());
    case "pause": return sheetWrap("休止中", `<p>戦闘はターン${st.run.turn}の入力待ちで保存されています。再開しても撤退・回復・報酬は発生しません。</p><div class="stack"><button class="btn primary" data-a="closeSheet">再開する</button></div>`);
    case "retreat": return sheetWrap("撤退", `<p>撤退は必ず成功します。この戦闘の報酬は0です。遭遇した位置へ戻ります。</p><div class="stack"><button class="btn primary" data-a="doRetreat">撤退する</button><button class="btn" data-a="closeSheet">戦闘を続ける</button></div>`);
  }
  return "";
}
function renderShare(){
  const links=SHARE.links();
  return `<label class="field-label" for="shareUrl">ゲームのURL</label>
    <textarea id="shareUrl" class="input mono" rows="3" readonly>${esc(SHARE.url())}</textarea>
    <div class="stack">
    ${typeof navigator.share==="function"?'<button class="btn" data-a="shareNative">スマホの共有メニューを開く</button>':""}
    <button class="btn" data-a="shareCopy" data-v="url">URLだけコピー</button>
    <button class="btn" data-a="shareCopy" data-v="intro">紹介文つきでコピー</button>
    <a class="btn" href="${esc(links.line)}" target="_blank" rel="noopener noreferrer">LINEで送る</a>
    <a class="btn" href="${esc(links.x)}" target="_blank" rel="noopener noreferrer">Xでポスト</a></div>
    <p class="small">記録（セーブ）は送られません。受け取った人は「はじめから」で遊べます。</p>`;
}
function renderSettings(){
  const st=G.st; const s=st?st.settings:G.tmpSettings||(G.tmpSettings={difficulty:"std",sound:soundPref(),reduceMotion:false});
  const busy = st&&st.run;
  return `<h3 class="label">難易度</h3><p class="small">敵の体力・攻撃力と戦闘開始時のエールだけが変わります。報酬・地域の強さ・物語は共通。戦闘開始時に固定されます。</p>
    <div class="row3">${Object.entries(DIFFICULTY).map(([k,v])=>`<button class="btn ${s.difficulty===k?"on":""}" data-a="setOpt" data-k="difficulty" data-v="${k}" ${busy?"disabled":""}>${s.difficulty===k?"▶ ":""}${v.name}</button>`).join("")}</div>
    <h3 class="label">音と演出</h3>
    <div class="stack"><button class="btn ${soundIsOn()?"on":""}" data-a="toggleSound">${soundIsOn()?"▶ BGM・効果音：ON（タップで消音）":"BGM・効果音：OFF（タップで音あり）"}</button>
    <button class="btn ${s.reduceMotion?"on":""}" data-a="setOpt" data-k="reduceMotion" data-v="${!s.reduceMotion}">${s.reduceMotion?"▶ 演出を減らす：ON":"演出を減らす：OFF"}</button>
    <button class="btn ${s.dock!==false?"on":""}" data-a="setOpt" data-k="dock" data-v="${s.dock===false}">${s.dock!==false?"▶ ジョイコントローラーを表示：ON":"ジョイコントローラーを表示：OFF（タップ操作のみ）"}</button></div>
    <h3 class="label">ジョイコントローラーの配置</h3>
    <p class="small">操作：左の戻るボタン／右のスティック中央で決定</p>
    <p class="small">ジョイコントローラー：探索ではスティックで歩き、決定で近くを調べます。メニュー・戦闘・会話ではスティックでカーソル（▶）を動かし、決定で選び、戻るで閉じます。Bluetoothのゲームコントローラー（Joy-Conなど）にも対応しています。</p>
    ${st?`<h3 class="label">保存</h3><p class="small">行動を確定するたびに、この端末のブラウザ内へ自動保存しています。状態：${esc(G.saveStatus)}</p>
    <p class="small">端末の変更やブラウザのデータ削除の前に、下の「バックアップを表示」で文字列をコピーし、メモ帳などへ保管してください。</p>
    <div class="stack"><button class="btn" data-a="showBackup">バックアップを表示</button></div>
    ${G.sheetData.backup?`<textarea id="backupOut" class="input mono" rows="5" readonly>${esc(G.sheetData.backup)}</textarea><button class="btn" data-a="copyBackup">コピーする</button>`:""}`:""}
    <h3 class="label">復元</h3><p class="small">保管したバックアップの文字列を貼り付けて読み込みます（現在の記録は置き換わります）。</p>
    <textarea id="restoreIn" class="input mono" rows="4" aria-label="バックアップの貼り付け"></textarea>
    <div class="stack"><button class="btn" data-a="restore">貼り付けた記録を読み込む</button>
    ${st&&G.screen!=="title"?`<button class="btn" data-a="toTitle">タイトルへ戻る</button>`:""}</div>
    <h3 class="label">共有</h3><button class="btn" data-a="openSheet" data-k="share">友だちに教える（URLを共有）</button>`;
}
function renderQuests(){
  const st=G.st,hub=curHub(),safe=isSafe();
  const stat={locked:"未解放",available:"受注できる",active:"受注中",bossReady:"ボスに挑戦できる",complete:"完了"};
  const card=([id,Q])=>{
    const s=st.quests[id]||"locked",progress=["active","bossReady","complete"].includes(s)?'討伐 '+(st.qprog[id]||0)+'/'+Q.kills:'';
    let btn="";
    if(s==="available"){
      const can=!st.activeQuest&&hub===Q.hub&&safe;
      btn='<button class="btn primary" data-a="acceptQuest" data-v="'+id+'" '+(can?'':'disabled')+'>受注する</button>'+(can?'':'<p class="small">'+(st.activeQuest?'ほかの依頼を受注中です。':HUBS[Q.hub].name+'の街で受注できます。')+'</p>');
    }
    if(s==="active"||s==="bossReady") btn='<button class="btn" data-a="abandonQuest" data-v="'+id+'">放棄する</button>';
    const lock=s==="locked"?(Q.requires?'「'+QUESTS[Q.requires].name+'」の完了で解放':Q.main?'前の本編依頼の完了で解放':'街の代表と話すと解放'):'';
    return '<div class="qcard '+s+'"><div class="srow"><b>'+id+' '+esc(Q.name)+'</b><span class="tag">'+stat[s]+'</span></div><p class="small">'+esc(HUBS[Q.hub].name)+'・'+(Q.main?'本編':'任意')+' '+progress+'</p><p>'+esc(Q.goal)+'</p>'+(lock?'<p class="small">'+esc(lock)+'</p>':'')+btn+'</div>';
  };
  const entries=Object.entries(QUESTS),local=entries.filter(([id,q])=>q.hub===hub||id===st.activeQuest),other=entries.filter(([id,q])=>q.hub!==hub&&id!==st.activeQuest);
  return '<p class="small">受注は同時に1件。街で依頼を受け、出口から街外へ。地域ボスの討伐で依頼完了・報酬獲得になります。</p>'+local.map(card).join('')+'<details><summary>他の地域の依頼（'+other.length+'件）</summary>'+other.map(card).join('')+'</details>';
}
function renderWorld(){
  const st=G.st; const safe=isSafe();
  let h=`<p class="small">街間は街外MAPの道を歩くか、街の新幹線駅から移動します。地図のボタンは街の出口までの道案内です。</p><div class="stack">`;
  const current=curHub();
  const adjacent=new Set([current]);
  for(const route of NATIONAL_ROUTES.filter(r=>r.status==="playable")){
    if(route.from===current) adjacent.add(route.to);
    if(route.to===current) adjacent.add(route.from);
  }
  for(const [id,H] of Object.entries(HUBS).filter(([id])=>adjacent.has(id))){
    const here=curHub()===id; const visited=st.visitedHubs.includes(id);
    const travel=here?null:worldTravelStatus(st,curHub(),id,safe);
    const itinerary=here?null:nationalItinerary(st,curHub(),id);
    const lockedLegs=itinerary?.slice(1).flatMap((step,i)=>nationalRouteAvailable(st,itinerary[i],step)?[]:[`${HUBS[itinerary[i]].name}→${HUBS[step].name}：${nationalRouteUnlockReason(itinerary[i],step)}`])||[];
    const firstArrivalLegs=itinerary?.slice(1).flatMap((step,i)=>{
      const route=NATIONAL_ROUTES.find(r=>r.status==="playable"&&r.from===itinerary[i]&&r.to===step);
      return route?.firstArrival&&!(st.visitedHubs||[]).includes(step)?[`${HUBS[step].name}の初回到達：${route.firstArrival}から向かってください。`]:[];
    })||[];
    h+=`<div class="qcard"><div class="srow"><b>${id} ${esc(H.pref)}・${esc(H.name)}${H.home?"（故郷）":""}</b><span class="tag">${here?"現在地":visited?"訪問済み":"未訪問"}</span></div>
      ${here?"":`<button class="btn" data-a="worldGo" data-v="${id}" ${travel.available?"":"disabled"}>街外への出口まで歩く</button>${itinerary?.length>2?`<p class="small">経由：${itinerary.map(step=>esc(HUBS[step].name)).join(" → ")}${lockedLegs.length?"（未解放区間あり）":""}</p>${[...lockedLegs,...firstArrivalLegs].map(note=>`<p class="small">${esc(note)}</p>`).join("")}`:""}${travel.reason?`<p class="small">${esc(travel.reason)}</p>`:""}`}</div>`;
  }
  const playablePrefs=NATIONAL_PREFECTURES.filter(p=>(NATIONAL_IMPLEMENTED_HUBS[p.id]||[]).some(id=>Object.hasOwn(HUBS,id)));
  const visitedPrefs=playablePrefs.filter(p=>(NATIONAL_IMPLEMENTED_HUBS[p.id]||[]).some(id=>(st.visitedHubs||[]).includes(id)));
  const playableHubIds=[...new Set(playablePrefs.flatMap(p=>NATIONAL_IMPLEMENTED_HUBS[p.id].filter(id=>Object.hasOwn(HUBS,id))))];
  const visitedHubCount=playableHubIds.filter(id=>(st.visitedHubs||[]).includes(id)).length;
  const regionDirectory=NATIONAL_REGIONS.map(([regionId,regionName])=>{
    const prefs=NATIONAL_PREFECTURES.filter(p=>p.regionId===regionId);
    const withHubs=prefs.filter(p=>Array.isArray(NATIONAL_IMPLEMENTED_HUBS[p.id])&&NATIONAL_IMPLEMENTED_HUBS[p.id].some(id=>Object.hasOwn(HUBS,id))).length;
    return `<details><summary>${esc(regionName)}（拠点あり ${withHubs}/${prefs.length}県）</summary><ul class="list">${prefs.map(p=>{
      const hubs=(NATIONAL_IMPLEMENTED_HUBS[p.id]||[]).filter(id=>Object.hasOwn(HUBS,id));
      return `<li>${p.id} ${esc(p.name)}：${hubs.length?`拠点あり（${hubs.map(id=>esc(HUBS[id].name)).join("・")}）・${visitedPrefs.some(v=>v.id===p.id)?"訪問済み":"未訪問"}`:"地理台帳のみ・移動不可"}</li>`;
    }).join("")}</ul></details>`;
  }).join("");
  const routeDirectory=NATIONAL_ROUTES.filter(r=>r.status==="playable").map(r=>`<li>${esc(HUBS[r.from].name)} ↔ ${esc(HUBS[r.to].name)}：${nationalRouteAvailable(st,r.from,r.to)?"経路解放済み":esc(nationalRouteUnlockReason(r.from,r.to))}${!st.visitedHubs.includes(r.to)&&r.firstArrival?`（初回：${esc(r.firstArrival)}）`:""}</li>`).join("");
  h+=`</div><details><summary>街をつなぐ道（${NATIONAL_ROUTES.length}）</summary><ul class="list">${routeDirectory}</ul></details><p class="small">初めての街へは街外MAPの道から向かいます。訪問済みの街への直行は新幹線駅を利用してください。</p>
    <h3 class="label">全国編の収録状況</h3><p class="small">${NATIONAL_REGIONS.length}地方・${NATIONAL_PREFECTURES.length}都道府県、全51拠点の固有物語と地域ボスを収録。各街の出口から街外へ進み、ボスを鎮めて次の地域へ。全51本の本編依頼で全国編エンディングに到達します。</p>
    <h3 class="label">全国の都道府県</h3><p class="small">拠点ありは${playablePrefs.length}/${NATIONAL_PREFECTURES.length}都道府県。訪問済みは${visitedPrefs.length}/${playablePrefs.length}県・${visitedHubCount}/${playableHubIds.length}拠点。${visitedPrefs.length===47?"全国踏破達成！":"全県を巡ると全国踏破です。"}</p>${regionDirectory}`;
  return h;
}
function worldTravelStatus(st,from,to,safe){
  const route=NATIONAL_ROUTES.find(r=>r.status==="playable"&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from)));
  if(!route) return {available:false,reason:"現在地からの直通経路はありません。隣接する拠点を経由してください。"};
  if(!nationalRouteAvailable(st,from,to)) return {available:false,reason:nationalRouteUnlockReason(from,to)};
  if(!safe) return {available:false,reason:"街外の道を進んでください。"};
  return {available:true,reason:"街の出口まで歩き、街外MAPの道から向かいます。"};
}
function railTravelStatus(st,from,to){
  if(from===to||!Object.hasOwn(HUBS,to)||!(st.visitedHubs||[]).includes(to))return false;
  const path=nationalItinerary(st,from,to);
  return !!path&&path.slice(1).every((hub,i)=>nationalRouteAvailable(st,path[i],hub));
}
function renderRail(){
  const st=G.st,from=curHub();
  return '<p>訪問済みの街へ新幹線で移動します。初めての街へは街外の道を進んでください。</p><div class="stack">'+Object.entries(HUBS).filter(([id])=>railTravelStatus(st,from,id)).map(([id,h])=>`<button class="btn" data-a="railGo" data-v="${id}" ${G.readOnly?"disabled":""}>新幹線で${esc(h.name)}へ</button>`).join('')+'</div>'+(st.visitedHubs.length<2?'<p>まだ移動できる訪問先がありません。</p>':'');
}
function nationalRouteUnlockReason(from,to){
  const route=NATIONAL_ROUTES.find(r=>r.status==="playable"&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from)));
  if(route?.from===from&&route.requiredQuest) return `「${QUESTS[route.requiredQuest].name}」の地域ボス討伐で開きます。`;
  return route?.unlock==="fukuokaClear"?"福岡編の完了後に開きます。":route?.unlock==="karatsuClear"?"唐津編M03の完了後に開きます。":route?.unlock==="sagaCityClear"?"佐賀市編M04の完了後に開きます。":route?.unlock==="saseboClear"?"佐世保市編M05の完了後に開きます。":route?.unlock==="nagasakiClear"?"長崎市編M06の完了後に開きます。":route?.unlock==="kumamotoClear"?"熊本市編M07の完了後に開きます。":route?.unlock==="asoClear"?"阿蘇市編M08の完了後に開きます。":"この先の道はまだ開いていません。";
}
function nationalRouteAvailable(st,from,to){
  return NATIONAL_ROUTES.some(r=>r.status==="playable"&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from))&&(!(r.from===from&&r.requiredQuest)||st.quests?.[r.requiredQuest]==="complete")&&(r.unlock==="always"||r.unlock==="fukuokaClear"&&!!st.fukuokaClear||r.unlock==="karatsuClear"&&st.quests?.M03==="complete"||r.unlock==="sagaCityClear"&&st.quests?.M04==="complete"||r.unlock==="saseboClear"&&st.quests?.M05==="complete"||r.unlock==="nagasakiClear"&&st.quests?.M06==="complete"||r.unlock==="kumamotoClear"&&st.quests?.M07==="complete"||r.unlock==="asoClear"&&st.quests?.M08==="complete"));
}
function nationalItinerary(st,from,to){
  if(!Object.hasOwn(HUBS,from)||!Object.hasOwn(HUBS,to)) return null;
  for(const unlockedOnly of [true,false]){
    const queue=[[from]],seen=new Set([from]);
    for(const path of queue){
      const last=path.at(-1);
      if(last===to) return path;
      for(const route of NATIONAL_ROUTES.filter(r=>r.status==="playable"&&(r.from===last||r.to===last))){
        const next=route.from===last?route.to:route.from;
        if(unlockedOnly&&!nationalRouteAvailable(st,last,next)) continue;
        if(!seen.has(next)&&Object.hasOwn(HUBS,next)){seen.add(next);queue.push([...path,next]);}
      }
    }
  }
  return null;
}
function renderParty(){
  const st=G.st; const d=G.sheetData; const L=levelOf(st.xp,st);
  const locked = !!st.run || !isSafe();
  const lockMsg = st.run?"戦闘中は変更できません。":!isSafe()?"街でのみ変更できます。":"";
  if(d.cid){
    const cid=d.cid; const cur=charStats(st,cid,L);
    if(d.view==="job"){
      return `<p><b>${esc(charName(st,cid))}</b>のジョブ（現在：${esc(JOBS[cur.job].name)}）</p>${lockMsg?`<p class="warn">${lockMsg}</p>`:""}
      <div class="stack">${JOB_IDS.map(j=>{ const nx=charStats(st,cid,L,j,previewEquipFor(st,cid,j)); const jp=jpOf(st,cid,j);
        return `<div class="jcard ${j===cur.job?"on":""}"><div class="srow"><b>${j===cur.job?"▶ ":""}${j} ${esc(JOBS[j].name)}</b><span>熟練度${nx.R}${nx.R>=jobLimit(st,cid,j)?"・最大":`・次まで${jpFor(nx.R+1)-jp}`}</span></div>
        <p class="small">${esc(JOBS[j].field)}｜${esc(JOBS[j].skill)}：MP${JOBS[j].cost}。${esc(JOBS[j].desc(nx.S))}</p>
        <p class="small">変更後：最大体力${nx.maxHP}（今${cur.maxHP}）・最大MP${nx.startC}（今${cur.startC}）・技能強化${nx.S}</p>
        ${j===cur.job?"":`<button class="btn" data-a="setJob" data-c="${cid}" data-v="${j}" ${locked?"disabled":""}>このジョブにする</button>`}</div>`; }).join("")}</div>
      <button class="btn" data-a="partyView" data-c="${cid}" data-v="">人物へ戻る</button>`;
    }
    if(d.view && d.view.startsWith("eq:")){
      const slot=d.view.slice(3); const items=Object.keys(EQUIP).filter(id=>EQUIP[id].slot===slot && (st.owned[id]||0)>0);
      return `<p><b>${esc(charName(st,cid))}</b>の${{w:"武器",a:"防具",acc:"アクセサリー"}[slot]}</p>${lockMsg?`<p class="warn">${lockMsg}</p>`:""}
        <div class="stack"><button class="btn" data-a="setEquip" data-c="${cid}" data-s="${slot}" data-v="" ${locked?"disabled":""}>外す</button>
        ${items.map(id=>{ const it=EQUIP[id]; const mine=st.equip[cid][slot]===id; const avail=availableCount(st,id)+(mine?1:0);
          const elig=!it.job || (it.job===cur.job && cur.R>=it.needR); const eq2={...st.equip[cid],[slot]:id}; const nx=charStats(st,cid,L,null,eq2);
          return `<div class="jcard ${mine?"on":""}"><div class="srow"><b>${mine?"▶ ":""}${esc(it.name)}</b><span>所持${st.owned[id]}・未装備${availableCount(st,id)}</span></div><p class="small">${esc(itemText(it,Vof(levelOf(st.xp,st))))}</p>
          <p class="small">装備後：最大体力${nx.maxHP}・最大MP${nx.startC}・攻撃力${attackPower(nx,L)}・防御力${defensePower(nx,L)}</p>
          ${mine?"":`<button class="btn" data-a="setEquip" data-c="${cid}" data-s="${slot}" data-v="${id}" ${locked||!elig||avail<=0?"disabled":""}>装備する</button>${elig?"":`<p class="small">現在のジョブと熟練では装備できません。</p>`}`}</div>`; }).join("")}</div>
        <button class="btn" data-a="partyView" data-c="${cid}" data-v="">人物へ戻る</button>`;
    }
    const e=st.equip[cid]; const C=CHARS[cid];
    return `<div class="who"><canvas class="sprite-md" data-char="${cid}" width="192" height="288" aria-hidden="true"></canvas><div><b>${esc(cid==="hero"?st.profile.name:C.full)}</b>　${[C.age?C.age+"歳":"",C.from?esc(C.from):""].filter(Boolean).join("・")}<br><span class="small">${cid==="moe"?"経歴":"職歴"}：${esc(C.career)}（ジョブとは別）</span></div></div>
      <dl class="kv"><dt>ジョブ</dt><dd>${esc(JOBS[cur.job].name)}　熟練度${cur.R}・技能強化${cur.S}</dd><dt>体力</dt><dd>${vitalOf(cid).hp}／${cur.maxHP}</dd><dt>MP</dt><dd>${vitalOf(cid).c}／${cur.startC}</dd>
      <dt>武器</dt><dd>${e.w?esc(EQUIP[e.w].name):"なし"}</dd><dt>防具</dt><dd>${e.a?esc(EQUIP[e.a].name):"なし"}</dd><dt>アクセサリー</dt><dd>${e.acc?esc(EQUIP[e.acc].name):"なし"}</dd></dl>
      <div class="stack"><button class="btn" data-a="partyView" data-c="${cid}" data-v="job">職業を変える</button>
      <button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:w">武器</button><button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:a">防具</button><button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:acc">アクセサリー</button>
      <button class="btn" data-a="partyView" data-c="" data-v="">一覧へ</button></div>`;
  }
  const bond = npc => !st.talked[npc]?0: 1 + (npc==="akari"? (st.quests.M01==="complete"?1:0)+(st.quests.S01==="complete"?1:0) : (st.quests.M02==="complete"?1:0)+(st.quests.S02==="complete"?1:0));
  const supOk = supportAvailable(st,"PR01");
  const sagaSupOk = supportAvailable(st,"PR02");
  const nagasakiSupOk = supportAvailable(st,"PR03");
  const partyLocked=G.readOnly||G.screen!=="explore"||G.sheet!=="party"||!!G.dlg||!!st.run||!!G.walk.path.length||!isSafe();
  return `${lockMsg?`<p class="warn">${lockMsg}</p>`:""}<p class="small">出撃は1～4人。先頭が前衛です。加入済みの仲間から選び、待機メンバーとは出撃枠を指定して直接入れ替えられます。</p>
    <h3 class="label">戦闘メンバー</h3><div class="stack">${st.party.map((c,i)=>`<div class="prow"><button class="btn grow" data-a="partyView" data-c="${c}" data-v=""><canvas class="member-art" data-char="${c}" data-full width="128" height="192" aria-hidden="true"></canvas><span>${i+1}. ${esc(charName(st,c))}・${esc(JOBS[st.jobs[c]].name)}</span></button>${i?`<button class="btn sq" data-a="partyUp" data-v="${i}" data-c="${c}" aria-label="${esc(charName(st,c))}を前へ" ${partyLocked?"disabled":""}>↑</button>`:""}${st.party.length>1?`<button class="btn sq" data-a="partyLeave" data-v="${i}" data-c="${c}" aria-label="${esc(charName(st,c))}を待機へ" ${partyLocked?"disabled":""}>待機</button>`:""}</div>`).join("")}</div>
    ${st.roster.length>st.party.length?`<h3 class="label">控え</h3><div class="stack">${st.roster.filter(c=>!st.party.includes(c)).map(c=>`<div class="prow"><button class="btn grow" data-a="partyView" data-c="${c}" data-v=""><canvas class="member-art" data-char="${c}" data-full width="128" height="192" aria-hidden="true"></canvas><span>${esc(charName(st,c))}・${esc(JOBS[st.jobs[c]].name)}</span></button>${st.party.length<4?`<button class="btn" data-a="partyIn" data-v="${c}" ${partyLocked?"disabled":""}>出撃に加える</button>`:""}${st.party.map((target,i)=>`<button class="btn" data-a="partySwap" data-v="${c}" data-i="${i}" data-c="${target}" ${partyLocked?"disabled":""}>${i+1}番の${esc(charName(st,target))}と入替</button>`).join("")}</div>`).join("")}</div>`:""}
    <h3 class="label">地域支援</h3><p class="small">コア応援者がいる県の効果を1つ選べます（戦闘開始時に固定）。</p>
    <div class="stack"><button class="btn ${!st.support?"on":""}" data-a="setSupport" data-v="">${!st.support?"▶ ":""}なし</button>
    <button class="btn ${st.support==="PR01"?"on":""}" data-a="setSupport" data-v="PR01" ${supOk?"":"disabled"}>${st.support==="PR01"?"▶ ":""}福岡：戦闘開始時のエール＋10（灯里 親密度${bond("akari")}/3）</button>
    <button class="btn ${st.support==="PR02"?"on":""}" data-a="setSupport" data-v="PR02" ${sagaSupOk?"":"disabled"}>${st.support==="PR02"?"▶ ":""}佐賀：戦闘開始時のエール＋12（唐津の案内人との会話・M03完了）</button>
    <button class="btn ${st.support==="PR03"?"on":""}" data-a="setSupport" data-v="PR03" ${nagasakiSupOk?"":"disabled"}>${st.support==="PR03"?"▶ ":""}長崎：戦闘開始時のエール＋14（佐世保市の案内人との会話・M05完了）</button></div>`;
}
function previewEquipFor(st,cid,job){ const e={...st.equip[cid]}; for(const s of ["w","a"]){ const it=e[s]&&EQUIP[e[s]]; if(it&&it.job&&it.job!==job) e[s]=null; } return e; }
const PENDING_BADGES={};
const EXTRA_BADGES={...(typeof EXPANDED_BADGES==="undefined"?{}:EXPANDED_BADGES),...(typeof PET_BADGES==="undefined"?{}:PET_BADGES)};
const BADGE_GROUPS=["速攻","攻撃","連携","防御","回復","MP","応援","ペット","道具","成長"];
function eligibleBattleBadges(run){
  return [...(run.itemHistoryComplete===true?itemBattleBadges(run.itemHistory,run):[]),...growthBattleBadges(run),...partyBattleBadges(run),...actionBattleBadges(run),...healBattleBadges(run),...mpBattleBadges(run),...cheerBattleBadges(run),...speedBattleBadges(run),...attackBattleBadges(run),...guardBattleBadges(run),...defenseBattleBadges(run),...(typeof expandedBattleBadges==="function"?expandedBattleBadges(run):[]),...(typeof petBattleBadges==="function"?petBattleBadges(run):[])];
}
const STABLE_BATTLE_BADGES=new Set(["B007","B011","B012","B013","B014","B015","B016","B018","B019","B020","B021","B022","B023","B024","B025","B026","B027","B028","B029","B030","B031","B032","B033","B034","B039","B040","B041","B042","B043","B044","B045","B046","B047","B048","B049","B050","B051","B052","B053","B054","B055","B057","B059","B061","B062","B063","B064","B065","B066","B067","B068","B069","B070","B083","B084","B085","B090","B094","B095","B097","B098"]);
function renderBattleChallenges(){
  const run=G.st.run; if(!run) return "<p>戦闘中だけ確認できます。</p>";
  const names={...ITEM_BADGES,...GROWTH_BADGES,...PARTY_BADGES,...ACTION_BADGES,...HEAL_BADGES,...MP_BADGES,...CHEER_BADGES,...SPEED_BADGES,...ATTACK_BADGES,...GUARD_BADGES,...DEFENSE_BADGES,...EXTRA_BADGES,...PENDING_BADGES};
  const owned=new Set(G.st.battleBadges||[]), f=run.actionFlags||{}, used=Array.isArray(run.itemHistory)?run.itemHistory.length:0;
  const eligible=new Set(eligibleBattleBadges(run));
  const speedImpossible={B001:run.turn>1,B002:run.turn>3,B003:run.turn>5,B004:run.actionHistoryComplete===true&&f.actionCount>run.party.length,B005:run.actionHistoryComplete===true&&f.enemyAttacked===true,B006:run.actionHistoryComplete===true&&f.restUsed===true,B007:run.actionHistoryComplete===true&&run.turn>1&&!f.firstTurnDamage,B008:run.turn>8,B010:run.actionHistoryComplete===true&&f.actionCount>6};
  const itemImpossible=run.itemHistoryComplete===true?{B081:used>0,B082:used>1,B086:f.cheerSpent===true,B088:used>0,B089:used>0}:{};
  const jobCount=new Set(run.party.map(m=>m.job)).size;
  const outside=id=>typeof extraBadgeOutside==="function"&&extraBadgeOutside(run,id)||(id==="B008"||id==="B092"||id==="B098")&&run.kind!=="boss" || id==="B091"&&run.kind!=="field" || ["B023","B032","B042","B055"].includes(id)&&run.party.length<2 || id==="B025"&&jobCount<2 || id==="B094"&&jobCount<3;
  const progress={};
  if(run.actionHistoryComplete===true){
    const count=x=>new Set(Array.isArray(x)?x:[]).size;
    const track=(id,n,total)=>{if(Number.isFinite(n)) progress[id]=`（${Math.min(n,total)}/${total}）`;};
    track("B004",f.actionCount,run.party.length); track("B010",f.actionCount,6);
    track("B021",count(f.actionTypes),3); track("B022",count(f.actionTypes),4);
    track("B023",count(f.actors),2); track("B024",count(f.actors),run.party.length);
    track("B025",count(f.jobs),2); track("B026",count(f.skills),2);
    track("B032",count(f.guardActors),2); track("B042",count(f.healTargets),2);
    track("B055",count(f.mpTargets),2); track("B062",count(f.commentLines),3);
    track("B094",count(f.jobs),3);
  }
  if(run.itemHistoryComplete===true){progress.B082=`（${Math.min(used,1)}/1）`;progress.B084=`（${Math.min(new Set(run.itemHistory.map(x=>x.id)).size,2)}/2）`;}
  if(run.petHistory){progress.B071=`（${Math.min(run.petHistory.actions||0,1)}/1）`;progress.B074=`（${Math.min(run.petHistory.species?.length||0,2)}/2）`;progress.B075=`（${Math.min(run.petHistory.actions||0,2)}/2）`;}
  const status=id=>{
    if(owned.has(id)) return "獲得済み";
    if(Object.hasOwn(PENDING_BADGES,id)) return "獲得不可";
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
  return `<p class="small">条件を満たして勝利すると獲得できます。</p><button class="btn" data-a="battleChallengeFilter" aria-pressed="${onlyActionable}">${onlyActionable?"すべて表示":"今回狙える条件のみ表示"}</button>${suggestion}${sections}`;
}
function renderBadgeRecord(st){
  const implemented={...ITEM_BADGES,...GROWTH_BADGES,...PARTY_BADGES,...ACTION_BADGES,...HEAL_BADGES,...MP_BADGES,...CHEER_BADGES,...SPEED_BADGES,...ATTACK_BADGES,...GUARD_BADGES,...DEFENSE_BADGES,...EXTRA_BADGES};
  const names={...implemented,...PENDING_BADGES};
  const owned=new Set(st.battleBadges||[]), onlyMissing=!!G.sheetData.badgeOnlyUnowned;
  const acquired=Object.keys(names).filter(id=>owned.has(id)).length;
  const sections=BADGE_GROUPS.map((group,i)=>{
    const entries=Array.from({length:10},(_,n)=>`B${String(i*10+n+1).padStart(3,"0")}`).filter(id=>!onlyMissing||!owned.has(id));
    const count=Array.from({length:10},(_,n)=>`B${String(i*10+n+1).padStart(3,"0")}`).filter(id=>owned.has(id)).length;
    return `<h4 class="label">${group} ${count}/10</h4>${entries.length?`<ul class="list">${entries.map(id=>`<li>${owned.has(id)?"● 獲得済み":Object.hasOwn(implemented,id)?"○ 未獲得":"― 獲得不可"} ${id} ${esc(names[id])}</li>`).join("")}</ul>`:`<p class="small">この分野はすべて獲得済みです。</p>`}`;
  });
  return `<h3 class="label">戦闘バッジ</h3><p class="small">獲得${acquired}種。</p><button class="btn" data-a="badgeFilter" aria-pressed="${onlyMissing}">${onlyMissing?"すべて表示":"未獲得のみ表示"}</button>${sections.join("")}`;
}
function renderRecord(){
  const st=G.st; const L=levelOf(st.xp,st);
  const milestones=[["E1","新規開始"],["D1","M01完了"],["D2","M02完了"],["D3","M03完了"],["C1","M04完了"],["C2","M05完了"],["C3","M06完了"],["B1","M07完了"],["B2","M08完了"]];
  return `<dl class="kv"><dt>共通レベル</dt><dd>${L}（経験値 ${st.xp.toLocaleString()}${L<levelLimit(st)?`・次まで${Math.max(0,xpFor(L+1)-st.xp).toLocaleString()}`:"・最大"}）</dd>
    <dt>ヒロインのシナリオ到達ランク</dt><dd>${MOE_RANKS[st.moeRank]}</dd><dt>旅</dt><dd>${st.day}日目</dd></dl>
    <p class="small">もえのランクは物語上の到達記録です。レベル・熟練度・実際の応援ポイントとは別に表示します。</p>
    <ul class="list">${milestones.map(([r,c],i)=>`<li>${i<=st.moeRank?"●":"○"} ${r}：${c}</li>`).join("")}<li>全国の依頼を進めてS6へ。全51本編依頼完了で全国編エンディング。</li></ul>
    ${G.screen==="explore"&&isSafe()?`<h3 class="label">ゴールド金庫</h3><p class="small">全街共通・手数料と利息なし。金庫の残高は買物や敗北時の減額に使われません。</p><button class="btn" data-a="vaultOpen">金庫を開く（${(st.vaultGold||0).toLocaleString()}G）</button>`:""}
    <h3 class="label">仲間</h3><ul class="list">${st.roster.map(c=>{const s=charStats(st,c,L); return `<li>${esc(charName(st,c))}：${esc(JOBS[s.job].name)} 熟練度${s.R}・最大体力${s.maxHP}</li>`;}).join("")}</ul>
    <h3 class="label">九州アルバム</h3><ul class="list">${Object.entries(BOX_CARDS).map(([k,n])=>`<li>${st.cards.includes(k)?"● "+esc(n):"○ 未取得"}</li>`).join("")}</ul>
    <h3 class="label">訪れた拠点</h3><ul class="list">${Object.entries(HUBS).map(([id,h])=>`<li>${st.visitedHubs.includes(id)?"●":"○"} ${esc(h.pref)}・${esc(h.name)}</li>`).join("")}</ul>
    <h3 class="label">応援者帳</h3><ul class="list"><li>灯里（福岡市）：${st.talked.akari?"話を聞いた":"未会話"}</li><li>奏太（北九州市）：${st.talked.sota?"話を聞いた":"未会話"}</li><li>唐津の案内人：${st.talked.karatsuGuide?"話を聞いた":"未会話"}</li><li>佐賀市の案内人：${st.talked.sagaCityGuide?"話を聞いた":"未会話"}</li><li>佐世保市の案内人：${st.talked.saseboGuide?"話を聞いた":"未会話"}</li></ul>
    <h3 class="label">全国の物語</h3><p>本編 ${NATIONWIDE_QUEST_ORDER.filter(id=>st.quests[id]==="complete").length} / ${NATIONWIDE_QUEST_ORDER.length} 完了</p>${st.nationalClear?'<button class="btn primary" data-a="replayStory" data-v="NATIONWIDE_END">全国編エンディングを振り返る</button>':""}<div class="stack">${Object.values(NATIONWIDE_STORIES).filter(s=>st.quests[s.questId]==="complete").map(s=>`<button class="btn" data-a="replayStory" data-v="${QUESTS[s.questId].completeScene}">${esc(HUBS[QUESTS[s.questId].hub].pref)}：${esc(s.title)}</button>`).join("")}</div>
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
  return `<div class="opts">${Object.keys(AREAS).map(a=>`<button class="btn opt ${a===area?"on":""}" data-a="dexNav" data-k="area" data-v="${a}">${a===area?"▶ ":""}${esc(MAPS[a.slice(0,4)]?.name||HUBS[AREAS[a]?.hub]?.name||"海洋")}・${esc(AREAS[a].name)}</button>`).join("")}</div>
    <p class="small">${esc(AREAS[area].name)}：50件中 遭遇済み${seenN}件（${page*10+1}～${page*10+10}件目を表示）</p>
    <div class="stack">${list.slice(page*10,page*10+10).map((e,k)=>`<button class="btn dexrow" data-a="dexNav" data-k="detail" data-v="${area}|${page*10+k}"><span>${st.seen[e.id]?"●":"○"} ${esc(e.name)}</span><span class="small">${esc(e.species)}／${esc(e.attr)}／${"★".repeat(e.rarity)}</span></button>`).join("")}</div>
    <div class="row3"><button class="btn" data-a="dexNav" data-k="page" data-v="${page-1}" ${page>0?"":"disabled"}>前の10件</button><span></span><button class="btn" data-a="dexNav" data-k="page" data-v="${page+1}" ${page<4?"":"disabled"}>次の10件</button></div>`;
}
function renderShop(){
  const st=G.st; const d=G.sheetData; const S=SHOPS[d.shop]; const tab=d.tab||"buy";
  const locked = !!st.run || !!G.shopSaving;
  const head=`<p>所持 ${st.gold.toLocaleString()}ゴールド・道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類</p><div class="row3"><button class="btn ${tab==="buy"?"on":""}" data-a="shopTab" data-v="buy">装備を買う</button><button class="btn ${tab==="item"?"on":""}" data-a="shopTab" data-v="item">道具を買う</button><button class="btn ${tab==="sell"?"on":""}" data-a="shopTab" data-v="sell">売る</button></div>${locked?`<p class="warn">現在は売買できません。</p>`:""}`;
  if(d.item && ITEMS[d.item]){
    const it=ITEMS[d.item]; const qty=d.qty||1; const own=bagCount(st.bag,d.item);
    if(tab==="item"){ const room=itemPurchaseRoom(st,d.item),bagSpace=bagRoom(st.bag,d.item); const total=it.price*qty; const can=!locked&&qty<=room&&st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>（${esc(ITEM_RARITY[it.stars])}）</p><p>${esc(itemText(it,Vof(levelOf(st.xp,st))))}。${it.battleOnly?"戦闘中だけ使えます。":"戦闘中・移動中に使えます。"}</p><p>単価${it.price}ゴールド・所持${own}/${BAG_STACK}</p>${qtyRow(qty,Math.max(1,room))}${qty>bagSpace?`<p class="small">袋に入らない${qty-bagSpace}個はアイテム金庫へ保管します。</p>`:""}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${room<=0?"道具袋と金庫がいっぱいです。":qty>room?`あと${room}個までしか受け取れません。`:st.gold<total?"ゴールドが足りません。":""}</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を買う</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`; }
    const unit=it.sell; const can=!locked&&unit>=0&&qty<=own;
    return head+`<p><b>${esc(it.name)}</b>　所持${own}</p>${unit<0?`<p class="warn">この道具は売れません（${esc(ITEM_ACQ[it.acq])}）。</p>`:`<p>買取単価${unit}ゴールド</p>${qtyRow(qty,Math.max(1,own))}<p>受取${unit*qty}ゴールド → 取引後${(st.gold+unit*qty).toLocaleString()}ゴールド</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を売る</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`;
  }
  if(tab==="item"){
    return head+`<div class="stack">${SHOP_ITEMS.map(id=>{const it=ITEMS[id]; return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(it.name)}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${it.price}ゴールド・${esc(itemText(it,Vof(levelOf(st.xp,st))))}・所持${bagCount(st.bag,id)}</span></button>`;}).join("")}</div><p class="small">道具袋は通常300種類・イベント400種類、1種類99個まで。各県の店で品ぞろえが増えます（この版は福岡の品）。</p>`;
  }
  if(d.item){
    const it=EQUIP[d.item]; const qty=d.qty||1; const own=st.owned[d.item]||0;
    if(tab==="buy"){ const total=it.price*qty,room=shopOffer(st,{shop:d.shop,tab:"buy",item:d.item,qty})?.max||0,can=!locked&&qty<=room&&st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>：${esc(itemText(it,Vof(levelOf(st.xp,st))))}</p><p>単価${it.price}ゴールド・手元${own}個・金庫${bagCount(st.itemVault,d.item)}個（合計上限8）・未装備品${unequippedGearCount(st)}/${UNEQUIPPED_GEAR_MAX}</p>${qtyRow(qty,Math.max(1,room))}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${own+bagCount(st.itemVault,d.item)+qty>8?"金庫の分を含め、同じ装備の所持上限8を超えます。":qty>room?"未装備品の上限300種類を超えます。":st.gold<total?"ゴールドが足りません。":""}</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を買う</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`; }
    const sellable=availableCount(st,d.item); const unit=Math.floor(it.price/2); const can=!locked&&qty<=sellable;
    return head+`<p><b>${esc(it.name)}</b>　所持${own}・装備中${equippedCount(st,d.item)}・売却可能${sellable}</p><p>買取単価${unit}ゴールド${unit===0?"（返却してもゴールドは増えません）":""}</p>${qtyRow(qty,Math.max(1,sellable))}<p>受取${unit*qty}ゴールド → 取引後${(st.gold+unit*qty).toLocaleString()}ゴールド</p>
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can&&sellable>0?"":"disabled"}>${esc(it.name)}×${qty}を売る</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`;
  }
  if(tab==="buy"){
    const ex=[...JOB_IDS.filter(j=>st.gifts.W[j]).map(j=>"JW"+j.slice(1)), ...JOB_IDS.filter(j=>st.gifts.A[j]).map(j=>"JA"+j.slice(1))];
    return head+`<div class="stack">${[...S.items,...ex].map(id=>{const it=EQUIP[id]; const who=st.roster.filter(c=>!it.job||(st.jobs[c]===it.job&&rankOf(jpOf(st,c,it.job),jobLimit(st,c,it.job))>=it.needR)).length; return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(it.name)}</span><span class="small">${it.price}ゴールド・${esc(itemText(it,Vof(levelOf(st.xp,st))))}・装備できる人${who}</span></button>`;}).join("")}</div><p class="small">地域の強化品は各県の店で順次追加されます（この版は福岡の共通品と専用品）。</p>`;
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
  const max=d.tab==="item"?itemPurchaseRoom(st,id):d.tab==="buy"?gearReceiveRoom(st,id):item?own:availableCount(st,id);
  const unit=d.tab==="sell"?(item?ITEMS[id].sell:Math.floor(EQUIP[id].price/2)):(item?ITEMS[id].price:EQUIP[id].price);
  return {shop:d.shop,tab:d.tab,item:id,qty:d.qty,unit,own,max,gold:st.gold};
}
function shopOfferToken(st,d){ const offer=shopOffer(st,d); return offer?checksum(JSON.stringify(offer)):""; }
function canTradeAtShop(d){ return !!G.st&&!G.readOnly&&!G.shopSaving&&G.screen==="explore"&&G.sheet==="shop"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe()&&nearbyObjects().some(o=>o.type==="shop"&&o.shop===d.shop); }
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
function canEditVault(){ return !!G.st&&!G.readOnly&&!G.vaultSaving&&G.screen==="explore"&&G.sheet==="goldVault"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function canViewItemVault(){ return !!G.st&&G.screen==="explore"&&G.sheet==="itemVault"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function canEditItemVault(){ return canViewItemVault()&&!G.readOnly&&!G.vaultSaving; }
function vaultAmountValue(raw,from,to){
  const value=String(raw);
  if(!/^[1-9][0-9]*$/.test(value)) return 0;
  const amount=Number(value);
  return Number.isSafeInteger(amount)&&Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&amount<=from&&Number.isSafeInteger(to+amount)?amount:0;
}
function canEditItems(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="items"&&!G.dlg&&!G.st.run&&!G.walk.path.length; }
function canManageQuests(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="quests"&&!G.dlg&&!G.st.run&&!G.walk.path.length; }
function canTravelFrom(sheet){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet===sheet&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
function dropToken(st,id){ return ITEMS[id]?checksum(JSON.stringify([id,bagCount(st.bag,id),st.bag.length])):""; }
function renderItems(){
  const st=G.st, d=G.sheetData||{}; const L=levelOf(st.xp,st);
  if(d.item && ITEMS[d.item] && bagCount(st.bag,d.item)>0){
    const it=ITEMS[d.item], n=bagCount(st.bag,d.item), nd=itemNeeds(it);
    let use="";
    if(it.battleOnly) use=`<p class="small">攻撃の道具は戦闘中の「道具」から使います。</p>`;
    else if(nd==="allyAll"||nd==="downAll") use=`<button class="btn primary" data-a="itemUse">使う（${nd==="downAll"?"戦闘不能の全員":"全員"}）</button>`;
    else use=`<h3 class="label">誰に使う？</h3>`+st.roster.map(c=>{const s=charStats(st,c,L),v=vitalOf(c); const dis = nd==="down"? v.hp>0 : v.hp<=0; return `<button class="btn ${isLow(v.hp,s.maxHP)?"low":""}" data-a="itemUse" data-c="${c}" ${dis?"disabled":""}>${esc(charName(st,c))}　体力 ${v.hp}/${s.maxHP}・MP ${v.c}/${s.startC}${v.hp<=0?"（戦闘不能）":""}</button>`;}).join("");
    return `<p><b>${esc(it.name)}</b>　×${n}</p><p class="small">${esc(ITEM_RARITY[it.stars])}・${esc(it.cat)}・入手：${esc(ITEM_ACQ[it.acq])}${it.sell>=0?`・売値${it.sell}ゴールド`:"・売却不可"}</p><p>${esc(itemText(it,Vof(levelOf(st.xp,st))))}。${it.battleOnly?"戦闘中だけ使えます。":"戦闘中・移動中に使えます。"}</p>
      <div class="stack">${use}${d.confirmDrop?`<p class="warn">${esc(it.name)}を1個捨てますか？ ${it.acq==="E"?"イベントの品は二度と手に入りません。":""}</p><button class="btn" data-a="itemDropDo" data-drop="${dropToken(st,d.item)}">捨てる</button><button class="btn" data-a="itemDropNo">やめる</button>`:`<button class="btn" data-a="itemDrop">1個捨てる</button>`}<button class="btn" data-a="itemView" data-v="">一覧へ</button></div>`;
  }
  return `<p class="small">道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類（1種類${BAG_STACK}個まで）。回復・蘇生は移動中にも使えます。</p>
    <div class="stack">${st.bag.map(e=>{const it=ITEMS[e.id]; return `<button class="btn dexrow" data-a="itemView" data-v="${e.id}"><span>${esc(it.name)}　×${e.n}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${esc(itemText(it,Vof(levelOf(st.xp,st))))}${it.battleOnly?"（戦闘のみ）":""}</span></button>`;}).join("")||`<p>道具を持っていません。ショップで買えます。</p>`}</div>
    <h3 class="label">アイテム金庫（${itemVaultCount(st)}/${ITEM_VAULT_MAX}）</h3><p class="small">道具と未装備品を全街共通で保管します。${st.pendingGifts?.length?`受取保留の贈り物が${st.pendingGifts.length}件あります。`:""}</p>${st.itemVault.length?`<ul class="list">${st.itemVault.map(e=>`<li>${esc((ITEMS[e.id]||EQUIP[e.id]).name)} ×${e.n}</li>`).join("")}</ul>`:""}${G.screen==="explore"&&isSafe()?`<button class="btn" data-a="itemVaultOpen">金庫の${G.readOnly?"中身を見る":"品物を出し入れ"}</button>`:""}
    ${st.keep&&st.keep.length?`<h3 class="label">宿屋の預かり所（${st.keep.length}/${KEEP_MAX}）</h3><p class="small">安全な場所で、袋またはアイテム金庫に空きがあれば自動的に受け取ります。</p><ul class="list">${st.keep.map(id=>`<li>${esc(ITEMS[id].name)}</li>`).join("")}</ul>`:""}`;
}
function vaultHeldCount(st,id){ return EQUIP[id]?availableCount(st,id):bagCount(st.bag,id); }
function vaultTransferRoom(st,mode,id){
  if(mode==="deposit") return Math.min(vaultHeldCount(st,id),ITEM_VAULT_MAX-itemVaultCount(st));
  const stored=bagCount(st.itemVault,id);
  return EQUIP[id]?Math.min(stored,gearReceiveRoom(st,id,true)):Math.min(stored,bagRoom(st.bag,id));
}
function vaultEntries(st,mode){
  if(mode==="withdraw") return st.itemVault;
  return [...st.bag,...Object.keys(st.owned).filter(id=>EQUIP[id]&&availableCount(st,id)>0).map(id=>({id,n:availableCount(st,id)}))];
}
function vaultCategory(id){ return EQUIP[id]?"gear":ITEMS[id]?.petSupply?"pet":ITEMS[id]?.acq==="E"?"event":"normal"; }
function vaultName(id){ return (ITEMS[id]||EQUIP[id])?.name||id; }
function pendingGiftBlockReason(st,id){
  if((st.owned[id]||0)+bagCount(st.itemVault,id)>=8) return "同じ装備が8個あります";
  if(gearReceiveRoom(st,id)<1&&itemVaultCount(st)>=ITEM_VAULT_MAX) return "手元と金庫が満杯です";
  return "";
}
function renderItemVault(){
  const st=G.st,d=G.sheetData,mode=d.mode==="withdraw"?"withdraw":"deposit",source=vaultEntries(st,mode),query=String(d.query||"").trim().toLocaleLowerCase(),filter=d.filter||"all",list=source.filter(e=>(ITEMS[e.id]||EQUIP[e.id])&&(filter==="all"||filter===vaultCategory(e.id))&&(!query||e.id.toLocaleLowerCase().includes(query)||vaultName(e.id).toLocaleLowerCase().includes(query))),pages=Math.max(1,Math.ceil(list.length/10)),page=Math.max(0,Math.min(pages-1,d.page||0)),id=d.id||"",max=id?vaultTransferRoom(st,mode,id):0,qty=d.qty||1,can=canEditItemVault(),view=canViewItemVault(),p=d.preview;
  return `<p>道具袋 通常${bagKindCount(st.bag,false)}/${BAG_KINDS}種類・イベント${bagKindCount(st.bag,true)}/${EVENT_KINDS}種類・未装備品${unequippedGearCount(st)}/${UNEQUIPPED_GEAR_MAX}種類・金庫 ${itemVaultCount(st)}/${ITEM_VAULT_MAX}個</p>${G.readOnly?`<p class="small">閲覧専用：移動できません。</p>`:""}${st.pendingGifts?.length?`<h3 class="label">受取保留の贈り物</h3><p class="small">同じ装備の上限と手元・金庫の空きを確認して受け取れます。</p><div class="stack">${st.pendingGifts.map(id=>`<div><button class="btn" data-a="pendingGiftClaim" data-v="${id}" ${can&&!G.vaultSaving&&!pendingGiftBlockReason(st,id)?"":"disabled"}>${esc(EQUIP[id].name)}を受け取る</button>${pendingGiftBlockReason(st,id)?`<span class="small">${pendingGiftBlockReason(st,id)}</span>`:""}</div>`).join("")}</div>`:""}<div class="stack"><button class="btn ${mode==="deposit"?"on":""}" data-a="itemVaultMode" data-v="deposit" ${view&&!G.vaultSaving?"":"disabled"}>預け入れ</button><button class="btn ${mode==="withdraw"?"on":""}" data-a="itemVaultMode" data-v="withdraw" ${view&&!G.vaultSaving?"":"disabled"}>引き出し</button></div>
    <div class="stack">${[["all","すべて"],["normal","通常の道具"],["event","イベント限定道具"],["gear","未装備品"],["pet","ペット用品"]].map(([k,label])=>`<button class="btn ${filter===k?"on":""}" data-a="itemVaultFilter" data-v="${k}" aria-pressed="${filter===k}" ${view&&!G.vaultSaving?"":"disabled"}>${label}</button>`).join("")}</div><label class="label" for="itemVaultSearch">名前・IDで検索</label><input id="itemVaultSearch" value="${esc(d.query||"")}" maxlength="60"><button class="btn" data-a="itemVaultSearch" ${view&&!G.vaultSaving?"":"disabled"}>検索</button><div class="stack">${list.slice(page*10,page*10+10).map(e=>`<button class="btn ${id===e.id?"on":""}" data-a="itemVaultSelect" data-v="${e.id}" ${view&&!G.vaultSaving&&!p?"":"disabled"}>${esc(vaultName(e.id))} ×${e.n} <span class="small">${vaultCategory(e.id)==="gear"?"装備":vaultCategory(e.id)==="event"?"イベント限定":"道具"}</span></button>`).join("")||"該当する品はありません。"}</div><div class="row3"><button class="btn" data-a="itemVaultPage" data-v="${page-1}" ${view&&page>0?"":"disabled"}>前の10件</button><span>${page+1}/${pages}ページ</span><button class="btn" data-a="itemVaultPage" data-v="${page+1}" ${view&&page+1<pages?"":"disabled"}>次の10件</button></div>
    ${id&&(ITEMS[id]||EQUIP[id])?`<p>${esc(vaultName(id))}：移動できる数 ${max}個</p><div class="stack">${[["1個",1],["5個",5],["10個",10],[`最大（${max}個）`,max]].filter(([label])=>!label.startsWith("最大")||![1,5,10].includes(max)).map(([label,n])=>`<button class="btn" data-a="itemVaultQty" data-v="${n}" ${can&&!p&&n>=1&&n<=max?"":"disabled"}>${label}</button>`).join("")}</div><p>選択 ${qty}個</p>${p?`<p>${EQUIP[id]?"未装備":"袋"} ${p.bagBefore}→${p.bagAfter}個／金庫 ${p.vaultBefore}→${p.vaultAfter}個</p><button class="btn primary" data-a="itemVaultCommit" data-token="${p.token}" ${can?"":"disabled"}>移動を確定</button><button class="btn" data-a="itemVaultEdit" ${can?"":"disabled"}>選び直す</button>`:`<button class="btn primary" data-a="itemVaultPreview" ${can&&qty<=max?"":"disabled"}>数量を確認</button>`}`:""}<button class="btn" data-a="itemVaultBack" ${G.vaultSaving?"disabled":""}>道具へ戻る</button>`;
}
function qtyRow(q,max){ return `<div class="row3"><button class="btn" data-a="shopQty" data-v="${q-1}" ${q>1?"":"disabled"}>−</button><span class="qty">数量 ${q}個（最大${max}個）</span><button class="btn" data-a="shopQty" data-v="${q+1}" ${q<max?"":"disabled"}>＋</button></div>`; }
function renderMoe(){
  const st=G.st; const r=MOE_RANKS[st.moeRank];
  const line = st.moeRank===0?"まずは福岡の声を整えよう。放送塔の丘の奥で、大きな重なりが起きてるみたい。":st.moeRank===1?"北九州の街外へ行こう。港に響く声の乱れを、一緒に鎮めたいな。":st.moeRank===2?"福岡、ありがとう。唐津でも、一人ずつの声に返事をしていきたい。":st.moeRank===3?"唐津の声を聞けたね。次は佐賀市で、街の声をつなごう。":st.moeRank===4?"佐賀市の声も届けられたね。次は佐世保市で港からの返事を聞こう。":"佐世保市の返事も届けられたね。次の旅に向けて準備しよう。";
  const read=Object.keys(SCENES).filter(k=>st.scenes[k]);
  return `<div class="who"><canvas class="sprite-md" data-char="moe" width="192" height="288" aria-hidden="true"></canvas><div><b>${esc(charName(st,"moe"))}</b><br><span class="small">メインライバー・シナリオ到達ランク ${r}</span></div></div>
    <p class="dlg-text">「${esc(line)}」</p>
    <h3 class="label">物語を読み返す</h3><div class="stack">${read.length?read.map(k=>`<button class="btn" data-a="replay" data-v="${k}">${esc(SCENES[k].title)}</button>`).join(""):`<p class="small">まだありません。</p>`}</div>`;
}
/* ===== 操作の受付 ===== */
const ACT = {
  shareCopy(el){ return SHARE.copy(el.dataset.v==="intro"); },
  shareNative(){ return SHARE.native(); },
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
    const snd=soundIsOn(),previous=G.st; G.st=newGame(v.value, G.newGame.gender); await seedSaveGeneration(G.st,previous); if(G.tmpSettings) Object.assign(G.st.settings,G.tmpSettings); G.st.settings.sound=snd; G.st.settings.soundV=2; G.st.settings.padSide=padSide(); G.soundWant=null;
    await commit(); G.starting=false; G.hasSave=true;
    G.screen="explore"; exploreBgm(); render(); playScene("HS00");
  },
  async continue(){ const s=await loadSave(); if(!s) return toast("記録が見つかりません。"); const hadStream=!!s.state.stream||Object.values(s.state.quests||{}).includes("combatDone"),oldPos=s.state.pos&&{x:s.state.pos.x,y:s.state.pos.y}; G.st=migrate(s.state); if(typeof applySoundSettings==="function")applySoundSettings(G.st.settings); G.walk={path:[],prog:0,pending:null};G.walkPlan=null;G.sheetHistory=[]; G.dlg=null; G.sheet=null; G.cmd={}; G.auto=false;clearTimeout(G.autoT); G.soundWant=null; setSave(s.fromPrev?"前の記録から復旧":s.storage==="local"?"保存済み":"保存済み"); if(G.st.settings.sound===false&&SND.on) SND.setOn(false); else if(G.st.settings.sound!==false&&!SND.on) SND.setOn(true);
    if(G.st.run){ G.screen="battle"; SND.play(G.st.run.kind==="boss"?"boss":"battle"); } else { G.screen="explore"; exploreBgm(); }
    render(); const notices=[]; if(s.fromPrev) notices.push("前の記録から再開しました。設定からバックアップを確認できます。"); if(hadStream&&!G.st.stream) notices.push("討伐済みの依頼を完了しました。報酬を受け取っています。"); if(!oldPos||oldPos.x!==G.st.pos.x||oldPos.y!==G.st.pos.y) notices.push("保存位置を現在の地形に合わせて拠点の安全地帯へ戻しました。"); if(notices.length) toast(notices.join(" ")); },
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
  itemVaultFilter(el){ if(!canViewItemVault()||G.vaultSaving||!["all","normal","event","gear","pet"].includes(el.dataset.v)) return; G.sheetData.filter=el.dataset.v; G.sheetData.page=0; G.sheetData.id=null; G.sheetData.preview=null; render(); },
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
  doTravel(){ return toast("街間は街外MAPの道を歩くか、新幹線駅から移動してください。"); },
  worldGo(el){
    if(!canTravelFrom("map")||MAPS[G.st.mapId].kind!=="town")return;
    const status=worldTravelStatus(G.st,curHub(),el.dataset.v,true);if(!status.available)return toast(status.reason);
    const exit=MAPS[G.st.mapId].objects.find(o=>o.fieldExit&&!o.oceanRoute);
    if(!exit)return toast("街の出口が見つかりません。");
    G.sheet=null;render();walkTo(exit.x,exit.y);
  },
  railGo(el){
    if(!canTravelFrom("rail")||MAPS[G.st.mapId].kind!=="town"||!nearbyObjects().some(o=>o.type==="station"&&o.id===G.sheetData.stationId)||!railTravelStatus(G.st,curHub(),el.dataset.v))return;
    const to=el.dataset.v,[x,y]=MAPS[to].safeAnchor;G.sheet=null;travelHub(to,x,y);
  },
  doInn(el){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="inn"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; const total=(INN_PRICE[curHub()]||10)*st.roster.length; if(st.gold<total) return toast(`ゴールドが足りません（あと${total-st.gold}）。`); el.disabled=true; G.sheet=null; st.gold-=total; restoreAll(st); st.day++; commit(); render(); SND.sfx("heal"); say([["",`${total}ゴールドを払って泊まった。`],["",`${st.day}日目の朝。全員の体力とMPが全回復した！`]]); },
  doRest(){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="rest"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; G.sheet=null; st.day++; commit(); render(); toast(`${st.day}日目の朝になった。`); },
  acceptQuest(el){ if(!canManageQuests()) return; const st=G.st, id=el.dataset.v, q=QUESTS[id]; if(!q||st.quests[id]!=="available"||st.activeQuest||curHub()!==q.hub||!isSafe()) return toast("依頼の状態が変わりました。選び直してください。");
    el.disabled=true;
    st.quests[id]="active"; st.activeQuest=id; st.qprog[id]=st.qprog[id]||0; commit(); G.sheet=null; render();
    if(q.introScene) return playScene(q.introScene);
    say([["",`依頼「${id} ${QUESTS[id].name}」を受けた。`],["もえ",id==="M01"?"呼びかけと紹介の順番が重なってる……。始まりと返事の順番を取り戻そう。":id==="M02"?"港の声を、ひとつずつ届けたいな。":id==="M03"?"唐津の海辺で聞いた返事を、街に届けたいな。":id==="M04"?"佐賀市の川沿いと駅前で、街の声を集めよう。":id==="M05"?"佐世保市の港沿いと坂道で、届いた返事を集めよう。":id==="M06"?"長崎市の港と丘で、街の声を届けよう。":id==="M07"?"熊本市の川辺と石垣で、届いた声を集めよう。":id==="M08"?"阿蘇市の風の中で、返事を集めよう。":"一緒に考えよう。"],["",QUESTS[id].goal]]); },
  abandonQuest(el){ if(!canManageQuests()) return; const st=G.st, id=el.dataset.v; if(!QUESTS[id]||st.activeQuest!==id||!["active","bossReady"].includes(st.quests[id])) return toast("依頼の状態が変わりました。選び直してください。"); el.disabled=true; st.quests[id]="available"; st.qprog[id]=0; st.activeQuest=null; commit(); render(); toast("依頼を放棄した。受注費は戻りません。"); },
  bossGo(el){ const st=G.st,bid=el.dataset.v,qid=Object.keys(QUESTS).find(k=>QUESTS[k].boss===bid); if(!st||G.readOnly||G.screen!=="explore"||G.sheet!=="boss"||G.sheetData.bid!==bid||G.dlg||st.run||G.walk.path.length||!qid||st.activeQuest!==qid||st.quests[qid]!=="bossReady"||st.bossDefeated[bid]||MAPS[st.mapId].kind!=="field"||!nearbyObjects().some(o=>o.type==="boss"&&o.boss===bid)) return toast("ボスへの挑戦条件が変わりました。調べ直してください。"); el.disabled=true; startBattle(createBossRun(st,bid)); },
  pickActor(el){ const i=+el.dataset.i; const m=G.st.run.party[i]; if(m.hp<=0||m.acted) return; G.cmd={actor:i}; render(); },
  cmdType(el){ const t=el.dataset.v; G.cmd={actor:G.cmd.actor, type:t}; render(); },
  cmdSet(el){ const k=el.dataset.k; let v=el.dataset.v; if(k==="target"||k==="ally") v=+v; G.cmd[k]=v; if(k==="mode"||k==="item"){ delete G.cmd.ally; } render(); },
  confirmAct(el){ el.disabled=true; confirmAct(); },
  autoOn(){ const run=G.st.run; if(!run||run.state!=="input") return; G.auto=true; G.autoLast=null; G.cursorSig="autoOff||||||"; render(); SND.sfx("ok"); G.autoT=setTimeout(autoStep,300); },
  autoOff(){ G.auto=false; clearTimeout(G.autoT); G.autoLast=null; G.cmd={}; G.cursorSig=null; render(); SND.sfx("cancel"); toast("オートを中断しました。手動で操作できます。"); },
  toResult(){ toResult(); },
  resultDone(){ resultDone(); },
  replayStory(el){ const id=el.dataset.v,st=G.st; if(G.screen!=="explore"||G.sheet!=="record"||G.dlg||st.run||!SCENES[id]) return; const q=Object.values(QUESTS).find(q=>q.completeScene===id); if(id==="NATIONWIDE_END"?!st.nationalClear:!q||st.quests[Object.keys(QUESTS).find(k=>QUESTS[k]===q)]!=="complete") return; G.sheet=null; say([["",SCENES[id].title],...SCENES[id].lines(st.profile.name)]); },
  defeatReturn(){ const st=G.st; const run=st.run; if(run.bag) st.bag=clone(run.bag); st.run=null; const m=MAPS[MAPS[run.returnPos.map].hub]; st.mapId=m.hub; st.pos={x:m.safeAnchor[0],y:m.safeAnchor[1]}; G.fol={...st.pos};
    const lost=Math.floor(st.gold/2); st.gold-=lost; restoreAll(st); commit(); G.screen="explore"; exploreBgm(); render(); say([["",`安全な場所へ運ばれた。所持ゴールドの半分（${lost}）を失った。`],["","全員の体力とMPが回復した。"]]); },
  retreat(){ openSheet("retreat"); },
  doRetreat(){ const st=G.st; const run=st.run; storeVitals(st,run); if(run.bag) st.bag=clone(run.bag); st.run=null; st.mapId=run.returnPos.map; st.pos={x:run.returnPos.x,y:run.returnPos.y}; G.sheet=null; commit(); G.screen="explore"; exploreBgm(); render(); toast("撤退した。"); },
  pauseBattle(){ commit(); openSheet("pause"); },
  setOpt(el){ if(G.sheet!=="settings"||G.dlg||G.st?.run||G.walk.path.length)return;const k=el.dataset.k;let v=el.dataset.v;if(!["difficulty","reduceMotion","follow","dock"].includes(k))return;if(k==="difficulty"){if(!Object.hasOwn(DIFFICULTY,v))return;}else{if(!["true","false"].includes(v))return;v=v==="true";}const s=G.st?G.st.settings:(G.tmpSettings=G.tmpSettings||{difficulty:"std",sound:soundPref(),reduceMotion:false});s[k]=v;if(G.st)commit();render(); },
  toggleSound(){ const want=!soundIsOn(); const on=SND.setOn(want); G.soundWant=want; try{ localStorage.setItem("tlr-kyushu-sound", want?"1":"0"); }catch(e){}
    if(G.st){ G.st.settings.sound=want; commit(); } if(G.tmpSettings) G.tmpSettings.sound=want;
    if(want&&!on) toast("この端末では音を出せませんでした。消音で続けます。"); render(); },
  showBackup(){ G.sheetData.backup=JSON.stringify({app:"toplivermichi-kyushu",version:GAME_VERSION,state:G.st}); render(); },
  copyBackup(){ const t=$("#backupOut"); try{ navigator.clipboard.writeText(t.value).then(()=>toast("コピーしました。メモ帳などへ貼り付けて保管してください。"),()=>{t.select();toast("文字列を選択しました。コピーしてください。");}); }catch(e){ t.select(); toast("文字列を選択しました。コピーしてください。"); } },
  async restore(){ if(G.readOnly||G.sheet!=="settings") return toast("この画面では復元できません。"); const t=$("#restoreIn"); if(!t) return toast("復元欄がありません。"); const raw=(t.value||"").trim(); if(raw.length>5000000) return toast("大きすぎます（上限5,000,000バイト）。");
    try{ const o=JSON.parse(raw); if(o.app!=="toplivermichi-kyushu"||!o.state||o.state.schemaVersion!==SCHEMA_VERSION||!o.state.profile) throw 0; validateState(o.state);
      const oldPos=o.state.pos&&{x:o.state.pos.x,y:o.state.pos.y},next=migrate(o.state),previous=G.st,previousStatus=G.saveStatus; await seedSaveGeneration(next,previous); G.st=next;
      let saved=false; try{ saved=await commit(); }catch(e){}
      if(!saved){ G.st=previous; setSave(previousStatus); return toast("記録を保存できませんでした。元の記録を維持しています。バックアップの文字列を保管してください。"); }
      if(typeof applySoundSettings==="function")applySoundSettings(G.st.settings); G.auto=false; clearTimeout(G.autoT); G.walk={path:[],prog:0,pending:null};G.walkPlan=null;G.sheetHistory=[]; G.dlg=null; G.cmd={}; G.hasSave=true; G.sheet=null; G.screen=G.st.run?"battle":"explore"; render(); toast("記録を読み込みました。"+(!oldPos||oldPos.x!==next.pos.x||oldPos.y!==next.pos.y?" 保存位置を現在の地形に合わせて拠点の安全地帯へ戻しました。":"")); }
    catch(e){ toast("読み込めませんでした。文字列が途中で切れていないか確認してください。"); } },
  partyView(el){ G.sheetData={cid:el.dataset.c||null, view:el.dataset.v||""}; render(); drawMiniSprites(); },
  partyUp(el){ if(!canEditParty()) return; const st=G.st,i=Number(el.dataset.v),c=el.dataset.c; if(!Number.isInteger(i)||i<1||i>=st.party.length||st.party[i]!==c) return toast("編成が変わりました。選び直してください。"); [st.party[i-1],st.party[i]]=[st.party[i],st.party[i-1]]; commit(); render(); },
  partyLeave(el){ if(!canEditParty()) return; const st=G.st,i=Number(el.dataset.v),c=el.dataset.c; if(!Number.isInteger(i)||i<0||i>=st.party.length||st.party[i]!==c) return toast("編成が変わりました。選び直してください。"); if(st.party.length<=1) return toast("最後の1人は待機にできません。"); st.party.splice(i,1); commit(); render(); toast(`${charName(st,c)}を待機にした。`); },
  partyIn(el){ if(!canEditParty()) return; const st=G.st,c=el.dataset.v; if(!st.roster.includes(c)||st.party.includes(c)||st.party.length>=4) return toast("この仲間は追加できません。編成を確認してください。"); st.party.push(c); commit(); render(); toast(`${charName(st,c)}を戦闘メンバーに入れた。`); },
  partySwap(el){ if(!canEditParty()) return; const st=G.st,c=el.dataset.v,i=Number(el.dataset.i),old=el.dataset.c; if(!Number.isInteger(i)||i<0||i>=st.party.length||st.party[i]!==old||!st.roster.includes(c)||st.party.includes(c)) return toast("編成が変わりました。選び直してください。"); st.party[i]=c; commit(); render(); toast(`${charName(st,old)}と${charName(st,c)}を入れ替えた。`); },
  setJob(el){ if(!canEditParty()) return; const st=G.st,cid=el.dataset.c,j=el.dataset.v; if(!st.roster.includes(cid)||!Object.hasOwn(JOBS,j)||G.sheetData.cid!==cid||G.sheetData.view!=="job") return; const nextEquip=previewEquipFor(st,cid,j); if(!equipmentSetFits(st,cid,nextEquip)) return toast("未装備品が300種類を超えます。金庫へ預けてください。"); st.jobs[cid]=j; st.equip[cid]=nextEquip;
    for(const [s,id] of [["w","CW01"],["a","CA01"]]) if(!st.equip[cid][s]&&availableCount(st,id)>0) st.equip[cid][s]=id;
    commit(); G.sheetData={cid,view:""}; render(); drawMiniSprites(); toast(`${charName(st,cid)}のジョブを${JOBS[j].name}にした。`); },
  setEquip(el){ if(!canEditParty()) return; const st=G.st,cid=el.dataset.c,s=el.dataset.s,id=el.dataset.v||null; if(!st.roster.includes(cid)||!["w","a","acc"].includes(s)||G.sheetData.cid!==cid||G.sheetData.view!==`eq:${s}`) return; if(id&&(!Object.hasOwn(EQUIP,id)||EQUIP[id].slot!==s)) return; if(id){ const it=EQUIP[id], cur=charStats(st,cid,levelOf(st.xp,st)); if(it.job&&(it.job!==cur.job||cur.R<it.needR)) return toast("現在の職業と熟練度では装備できません。"); } if(id&&availableCount(st,id)<=0&&st.equip[cid][s]!==id) return toast("未装備の在庫がありません。"); if(!equipmentChangeFits(st,cid,s,id)) return toast("未装備品が300種類を超えます。金庫へ預けてください。"); st.equip[cid][s]=id; commit(); G.sheetData={cid,view:""}; render(); drawMiniSprites(); },
  setSupport(el){ if(!canEditParty()) return; const v=el.dataset.v||null; if(v!==null&&!supportAvailable(G.st,v)) return toast("この地域支援はまだ使えません。"); G.st.support=v; commit(); render(); },
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
  replay(el){const st=G.st,id=el.dataset.v;if(!st||G.screen!=="explore"||G.sheet!=="moe"||G.dlg||st.run||!Object.hasOwn(SCENES,id)||!st.scenes?.[id])return;G.sheet=null;say([["",SCENES[id].title],...SCENES[id].lines(st.profile.name)]);},

};
function drawMiniSprites(){
  document.querySelectorAll("canvas[data-char]").forEach(c=>{ SEMIREAL_ART.portrait(c,c.dataset.char,undefined,c.hasAttribute("data-full")); });
  document.querySelectorAll("canvas[data-dex]").forEach(c=>{ const [a,i]=c.dataset.dex.split("|"); const e=enemyDef(a,+i); const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(ART.enemy(e.profile,e.species,e.attr,a,0),0,0); });
}
function validateState(s){
  if(typeof validateOceanState==="function")validateOceanState(s);
  const okNum=v=>Number.isFinite(v)&&v>=0;
  if(!okNum(s.xp)||!okNum(s.gold)||!okNum(s.tickets)||!MAPS[s.mapId]||!Array.isArray(s.roster)||!Array.isArray(s.party)||s.party.length<1||s.party.length>4||new Set(s.party).size!==s.party.length||s.party.some(c=>!CHARS[c]||!s.roster.includes(c))) throw new Error("bad");
  if(s.vaultGold!==undefined&&(!Number.isSafeInteger(s.vaultGold)||s.vaultGold<0)) throw new Error("bad vault");
  if(s.itemVault!==undefined&&(!Array.isArray(s.itemVault)||s.itemVault.some(e=>!ITEMS[e.id]&&!EQUIP[e.id]||!Number.isSafeInteger(e.n)||e.n<1)||itemVaultCount(s)>ITEM_VAULT_MAX||new Set(s.itemVault.map(e=>e.id)).size!==s.itemVault.length||s.itemVault.some(e=>EQUIP[e.id]&&(s.owned[e.id]||0)+e.n>8))) throw new Error("bad item vault");
  if(s.pendingGifts!==undefined&&(!Array.isArray(s.pendingGifts)||s.pendingGifts.some(id=>!EQUIP[id])||new Set(s.pendingGifts).size!==s.pendingGifts.length)) throw new Error("bad pending gifts");
  for(const c of s.party) if(!JOBS[s.jobs[c]]) throw new Error("bad job");
}
function padSide(){ return "right"; }
function soundIsOn(){ if(G.soundWant!=null) return G.soundWant; if(G.st&&G.st.settings) return G.st.settings.sound!==false; return soundPref(); }
function soundPref(){ try{ return localStorage.getItem("tlr-kyushu-sound")!=="0"; }catch(e){ return true; } }
function supportAvailable(st,id){
  if(typeof SUPPORT_REQUIREMENTS!=="undefined"&&Object.hasOwn(SUPPORT_REQUIREMENTS,id)){const r=SUPPORT_REQUIREMENTS[id];return !!r.quest&&st.quests?.[r.quest]==="complete"&&(!r.extra||st.quests?.[r.extra]==="complete")&&(!r.npc||!!st.talked?.[r.npc]);}
  if(id==="PR01") return !!st.talked?.akari&&st.quests?.M01==="complete"&&st.quests?.S01==="complete";
  if(id==="PR02") return !!st.talked?.karatsuGuide&&st.quests?.M03==="complete";
  if(id==="PR03") return !!st.talked?.saseboGuide&&st.quests?.M05==="complete";
  return false;
}
function migrate(s){
  migrateGrowth(s);
  s.gameVersion=GAME_VERSION;
  const layoutChanged=s.mapLayoutVersion!==MAP_LAYOUT_VERSION;
  const map=MAPS[s.mapId],p=s.pos;
  if(layoutChanged||!p||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=map.w||p.y>=map.h||!(map.combatDomain==="sea"?".,123w=ESP":".,123w=").includes(map.tiles[p.y]?.[p.x])||map.objects.some(o=>o.x===p.x&&o.y===p.y&&!o.walk)) s.pos={x:map.safeAnchor[0],y:map.safeAnchor[1]};
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
  delete s.stream; // 旧版の配信中セーブは討伐済み依頼として下で引き継ぐ
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
  refreshMainQuests(s);
  for(const [id,q] of Object.entries(QUESTS)){
    if(s.quests[id]==="combatDone"||(q.main&&s.quests[id]!=="complete"&&s.bossDefeated?.[q.boss])) completeQuest(s,id);
  }
  refreshMainQuests(s);
  for(const j of JOIN_PLAN) if(s.visitedHubs.includes(j.hub)&&!s.roster.includes(j.cid)) joinMember(s,j.cid);
  if(s.run&&layoutChanged){
    const field=HUBS[map.hub].fieldMap;
    s.mapId=field; s.pos={x:MAPS[field].safeAnchor[0],y:MAPS[field].safeAnchor[1]};
    s.run.returnPos={map:field,...s.pos};
  }
  s.mapLayoutVersion=MAP_LAYOUT_VERSION; s.gameVersion=GAME_VERSION;
  if(typeof migrateCharacter==="function")migrateCharacter(s);
  if(typeof migratePets==="function")migratePets(s);
  if(typeof migrateOcean==="function")migrateOcean(s);
  if(typeof migrateListeners==="function")migrateListeners(s);
  if(s.support&&!supportAvailable(s,s.support)) s.support=null;
  return s;
}

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]"); if(!el||el.disabled) return;
  if(el.getAttribute("aria-disabled")==="true") return;
  const f=ACT[el.dataset.a]; if(!f) return;
  if(G.oceanSaving||G.characterSaving||G.featureSaving||(G.petSaving&&!el.dataset.a.startsWith("pet")))return;
  if(G.readOnly && !(typeof READ_ONLY_ACTIONS!=="undefined"?READ_ONLY_ACTIONS.has(el.dataset.a):["replayStory","shareCopy","shareNative","openSheet","closeSheet","dlgNext","dlgBack","dlgSkip","toTitle","dexNav","partyView","shopTab","shopItem","vaultOpen","vaultBack"].includes(el.dataset.a))) return toast("別のタブで遊んでいるため、このタブは閲覧のみです。");
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
  if(data&&data.st){ G.st=migrate(data.st); G.screen=["new","stream"].includes(data.screen)?"explore":data.screen; G.hasSave=true; }
  render();
}



