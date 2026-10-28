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
    try{ const prev=await DB.get("auto"); await DB.putPair(rec, prev&&prev.gen<rec.gen?prev:null); setSave("保存済み"); }
    catch(e){ try{ localStorage.setItem("tlr-kyushu-auto", JSON.stringify(rec)); setSave("保存済み（簡易保存）"); }catch(e2){ setSave("未保存：この端末では保存できません。設定からバックアップを書き出してください。"); } }
  });
  return saveChain;
}
async function loadSave(){
  const valid = r => r && r.state && checksum(r.state)===r.sum;
  let rec=null, prev=null;
  try{ rec=await DB.get("auto"); prev=await DB.get("auto-prev"); }catch(e){}
  if(!valid(rec)){ try{ const ls=JSON.parse(localStorage.getItem("tlr-kyushu-auto")||"null"); if(valid(ls)) rec=ls; }catch(e){} }
  if(valid(rec)) return {state:JSON.parse(rec.state), time:rec.time};
  if(valid(prev)) return {state:JSON.parse(prev.state), time:prev.time, fromPrev:true};
  return null;
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
function streamPending(){ return Object.keys(QUESTS).find(k=>G.st.quests[k]==="combatDone"); }
function objective(){
  const st=G.st; const q=st.activeQuest;
  if(streamPending()) return `${streamPending()}：配信で80点以上を目指す（依頼帳から開始）`;
  if(q){ const Q=QUESTS[q]; if(st.quests[q]==="bossReady") return `${q}：${BOSSES[Q.boss].name}に挑む（${MAPS[Q.hub].name}の奥地）`; return `${q}：通常敵 ${st.qprog[q]||0}/${Q.kills}体（${HUBS[Q.hub].name}のA1～A3）`; }
  const avail=["M01","M02","M03","M04"].find(k=>st.quests[k]==="available"); if(avail) return `依頼帳で「${avail} ${QUESTS[avail].name}」を受ける（2枠）`;
  if(st.quests.M04==="complete") return "佐賀市編クリア！ 続きの地域は開発中です";
  if(st.quests.M03==="complete") return curHub()==="KY03"?"唐津編クリア！ 東門から佐賀市へ進めます":"佐賀市でM04を受け、街の声を集めよう";
  if(st.fukuokaClear) return curHub()==="KY03"?"唐津でM03を受け、海辺の探索区域へ進もう":"福岡編クリア！ 北九州の東門から唐津へ進めます";
  return "探索して仲間を育てよう";
}

/* ===== 画面の描画 ===== */
function render(){
  const root=$("#screen"); if(!root) return;
  stopBattleTimer();
  const s=G.screen;
  let html="";
  if(s==="title") html=renderTitle();
  else if(s==="new") html=renderNew();
  else if(s==="explore") html=renderExplore();
  else if(s==="battle") html=renderBattle();
  else if(s==="result") html=renderResult();
  else if(s==="stream") html=renderStream();
  root.innerHTML = html + renderSheet() + renderDialog() + `<div id="toast" class="toast" role="status" hidden></div>`;
  if(s==="explore") mountCanvas();
  document.body.classList.toggle("in-battle", s==="battle"); document.body.classList.toggle("in-explore", s==="explore");
  if(s==="battle"){ drawEnemies(); startBattleTimer(); }
  if(s==="new") mountNew();
  if(s==="title") drawTitleArt();
  drawMiniSprites();
  const dockOff = s==="new" || (G.st? G.st.settings.dock===false : (G.tmpSettings&&G.tmpSettings.dock===false));
  document.body.classList.toggle("no-dock", !!dockOff);
  document.body.classList.toggle("stick-left", padSide()==="left");
  document.body.classList.toggle("reduce-motion", !!(G.st&&G.st.settings.reduceMotion));
  const dh=document.querySelector("#dock .hint"); if(dh) dh.textContent = (s==="explore"&&!G.sheet&&!G.dlg)?"スティック：移動／決定：調べる":"スティック：カーソル／決定・戻る";
  if(G.dlg){ const b=$("#dlgNext"); if(b) b.focus({preventScroll:true}); }
  PAD.restore();
}
function statusBar(){
  const st=G.st; const m=MAPS[st.mapId];
  return `<header class="status">
    <div class="srow"><span class="place">${esc(m.name)}</span><span>${st.day}日目・残り${st.slots}枠</span></div>
    <div class="goal">${esc(objective())}</div>
    <div class="srow small"><span>レベル${levelOf(st.xp)}・${st.gold.toLocaleString()}ゴールド・チケット${st.tickets.toLocaleString()}</span><span>もえ ${MOE_RANKS[st.moeRank]}</span></div>
    <div class="small" aria-live="polite">保存：<span id="saveStat">${esc(G.saveStatus)}</span>${G.readOnly?"（別のタブで操作中のため閲覧のみ）":""}</div>
  </header>`;
}

/* ---- タイトル ---- */
function renderTitle(){
  return `<section class="title-screen">
    <canvas id="titleArt" width="160" height="64" aria-hidden="true"></canvas>
    <h1 class="logo"><span class="main">トップライバーへの道</span><span class="sub">九州編</span></h1>
    <p class="lead">元アイドルのもえをS6へ導く、昭和風ドットRPG。</p>
    <div class="menu">
      <button class="btn primary" data-a="newGame">はじめから</button>
      <button class="btn" data-a="continue" ${G.hasSave?"":"disabled"}>つづきから${G.hasSave?"":"（記録なし）"}</button>
      <button class="btn" data-a="openSheet" data-k="settings">設定</button>
      <button class="btn" data-a="openSheet" data-k="about">この作品について</button>
    </div>
    <p class="note">配信文化を参考にした非公式の創作ゲームです。実在のサービス・アカウントとは連携しません。BGMと効果音は最初からONです（画面に触れると鳴り始めます。設定で消音にできます）。</p>
    <p class="note">この開発版の収録範囲：第1章 福岡（M01・M02）＋佐賀県唐津市のM03、佐賀市のM04と各配信まで。佐賀市の先は未収録です。</p>
  </section>`;
}
function drawTitleArt(){
  const c=$("#titleArt"); if(!c) return; const g=c.getContext("2d"); g.imageSmoothingEnabled=false;
  g.drawImage(ART.stage("KY02-A3",1),0,0);
  g.drawImage(ART.person("hero",PAL.ink,PAL.red,0,0,{}),58,34);
  g.drawImage(ART.person("moe",PAL.violet,PAL.cream,0,0,{long:true,ribbon:PAL.coral}),80,34);
  g.drawImage(ART.object("tower",1),134,6);
}

/* ---- 主人公設定（第06D・06E節） ---- */
function renderNew(){
  const n=G.newGame;
  if(n.step===2){
    const v=validateName(n.name);
    return `<section class="win">
      <h2 class="label">確認</h2>
      <canvas id="heroPrev" width="16" height="24" class="sprite-lg" aria-hidden="true"></canvas>
      <dl class="kv"><dt>名前</dt><dd>${esc(v.value)}（${v.count}文字）</dd><dt>性別</dt><dd>${esc(n.gender)}</dd>
      <dt>初期ジョブ</dt><dd>アイドルオタク</dd><dt>背景</dt><dd>32歳・福岡県福岡市出身・職歴は社会福祉士</dd></dl>
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
    <canvas id="heroPrev" width="16" height="24" class="sprite-lg" aria-hidden="true"></canvas>
    <div class="stack"><button class="btn primary" id="toConfirm" data-a="newNext">確認へ</button>
    <button class="btn" data-a="toTitle">タイトルへ戻る</button></div>
  </section>`;
}
function mountNew(){
  const pv=$("#heroPrev"); if(pv){ const g=pv.getContext("2d"); g.clearRect(0,0,16,24); if(G.newGame.gender) g.drawImage(heroSprite(0,0,G.newGame.gender),0,0); }
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
  return `<button class="pstrip" data-a="openSheet" data-k="status" aria-label="パーティーのステータスを開く"><span class="pstop"><span>レベル${levelOf(st.xp)}・${st.gold.toLocaleString()}ゴールド・もえ ${MOE_RANKS[st.moeRank]}</span><span class="pmore">ステータス ▶</span></span>${st.party.map(cid=>{ const L=levelOf(st.xp), s=charStats(st,cid,L), v=vitalOf(cid);
    return `<span class="pmini ${v.hp<=0?"ko":""} ${isLow(v.hp,s.maxHP)?"low":""}"><span class="pmline"><b>${esc(charName(st,cid))}</b><span class="small">体力${v.hp}/${s.maxHP} 集中力${v.c}</span></span><span class="bar"><i style="width:${Math.round(100*v.hp/s.maxHP)}%"></i></span></span>`; }).join("")}</button>`;
}
function renderStatus(){
  const st=G.st; const L=levelOf(st.xp);
  const head=`<dl class="kv"><dt>共通レベル</dt><dd>${L}</dd><dt>経験値</dt><dd>${st.xp.toLocaleString()}${L<999?`（次のレベルまで ${(xpFor(L+1)-st.xp).toLocaleString()}）`:"（最大）"}</dd>
    <dt>所持ゴールド</dt><dd>${st.gold.toLocaleString()}</dd><dt>もえの到達ランク</dt><dd>${MOE_RANKS[st.moeRank]}</dd></dl>
    <p class="small">体力と集中力は戦闘後も持ち越します。宿屋に泊まると全員が全回復します。</p>`;
  const cards=st.roster.map(cid=>{
    const s=charStats(st,cid,L), v=vitalOf(cid), e=st.equip[cid], jp=jpOf(st,cid,s.job), C=CHARS[cid];
    const inParty=st.party.includes(cid);
    const eqName=id=>id?esc(EQUIP[id].name):"なし";
    return `<section class="scard ${v.hp<=0?"ko":""} ${isLow(v.hp,s.maxHP)?"low":""}">
      <div class="who"><canvas class="sprite-md" data-char="${cid}" width="16" height="24" aria-hidden="true"></canvas>
        <div><b class="sname">${esc(cid==="hero"?st.profile.name:C.full)}</b><br><span class="small">${inParty?"戦闘メンバー":"控え"}${v.hp<=0?"・戦闘不能":""}</span></div></div>
      <dl class="kv">
        <dt>レベル</dt><dd>${L}</dd>
        <dt>職業（ジョブ）</dt><dd>${esc(JOBS[s.job].name)}</dd>
        <dt>ジョブ熟練度</dt><dd>${s.R}${s.R<999?`（次まで ${jpFor(s.R+1)-jp}）`:"（最大）"}</dd>
        <dt>体力（HP）</dt><dd><span class="bar wide"><i style="width:${Math.round(100*v.hp/s.maxHP)}%"></i></span>${v.hp}／最大${s.maxHP}</dd>
        <dt>集中力（CP）</dt><dd>${v.c}／最大${s.startC}</dd>
        <dt>攻撃力</dt><dd>${attackPower(s,L)}</dd>
        <dt>防御力</dt><dd>${defensePower(s,L)}</dd>
        <dt>技能</dt><dd>${esc(JOBS[s.job].skill)}（集中力${JOBS[s.job].cost}・技能強化${s.S}）</dd>
        <dt>武器</dt><dd>${eqName(e.w)}</dd><dt>防具</dt><dd>${eqName(e.a)}</dd><dt>アクセサリー</dt><dd>${eqName(e.acc)}</dd>
      </dl></section>`; }).join("");
  return head+`<div class="stack">${cards}</div><p class="small">攻撃力＝通常攻撃で与える基本ダメージ（敵の防御力を引く前）。防御力＝敵の攻撃1回ごとに減らせるダメージ。</p>`;
}
function heroSprite(dir,frame,gender){ const f=(gender||G.st.profile.gender)==="女性"; return ART.person("hero",f?PAL.brown:PAL.ink,PAL.red,dir,frame,{long:f}); }
function charSprite(cid,dir,frame){ if(cid==="hero") return heroSprite(dir,frame); if(cid==="moe") return ART.person("moe",PAL.violet,PAL.cream,dir,frame,{long:true,ribbon:PAL.coral}); const c=CHARS[cid]; return ART.person(cid,c.hair,c.coat,dir,frame,{long:["mio","kayo","tsumugi"].includes(cid)}); }

/* ---- 探索 ---- */
function renderExplore(){
  const st=G.st; const m=MAPS[st.mapId];
  const near=nearbyObjects();
  const zone=zoneAt(m,st.pos.x,st.pos.y);
  const ar=zone?AREAS[zone]:null;
  return `<section class="explore">
    <header class="xhead">
      <div class="srow"><span class="place">${esc(m.name)}</span><span>${st.day}日目・残り${st.slots}枠</span></div>
      <div class="goal">${esc(objective())}</div>
      <div class="xsave small" aria-live="polite">保存：<span id="saveStat">${esc(G.saveStatus)}</span>${G.readOnly?"（閲覧のみ）":""}</div>
    </header>
    <div class="mapwrap"><canvas id="map" aria-label="${esc(m.name)}の地図。地面をタップすると移動します。"></canvas></div>
    <div class="here">${ar?`<span class="tag danger">遭遇エリア</span> ${esc(ar.name)}（推奨レベル${ar.q}）`:`<span class="tag safe">安全地帯</span> ${esc(m.name)}`}${near.length?`<span class="small">／近く：${near.map(o=>esc(o.label)).join("・")}</span>`:""}</div>
    ${partyStrip()}
    <nav class="menu-grid" aria-label="メニュー">
      <button class="btn" data-a="openSheet" data-k="quests">依頼帳</button>
      <button class="btn" data-a="openSheet" data-k="guide">道しるべ</button>
      <button class="btn" data-a="openSheet" data-k="map">地図</button>
      <button class="btn" data-a="openSheet" data-k="items">道具</button>
      <button class="btn" data-a="openSheet" data-k="status" aria-label="ステータス"><span class="lw">ステータス</span><span class="sw">状態</span></button>
      <button class="btn" data-a="openSheet" data-k="party">編成</button>
      <button class="btn" data-a="openSheet" data-k="record">記録</button>
      <button class="btn" data-a="openSheet" data-k="dex">図鑑</button>
      <button class="btn" data-a="openSheet" data-k="settings">設定</button>
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
  cv.width=G.vw*16; cv.height=G.vh*16; cv.style.width=(G.vw*16*G.scale)+"px"; cv.style.height=(G.vh*16*G.scale)+"px";
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
  const cv=G.cv; if(!cv||!cv.isConnected) return; const g=cv.getContext("2d"); g.imageSmoothingEnabled=false;
  const st=G.st, m=MAPS[st.mapId]; const cam=camera(); const now=performance.now();
  const still=st.settings.reduceMotion; const f=still?0:Math.floor(now/320)%4, f2=still?0:Math.floor(now/600)%2;
  g.fillStyle=PAL.ink; g.fillRect(0,0,cv.width,cv.height);
  const layer=ART.mapLayer(st.mapId,f);
  const sx=Math.max(0,cam.x), sy=Math.max(0,cam.y), w=Math.min(cv.width,layer.width-sx), h=Math.min(cv.height,layer.height-sy);
  g.drawImage(layer,sx,sy,w,h,sx-cam.x,sy-cam.y,w,h);
  const sprites=[];
  for(const o of m.objects){
    let img;
    if(o.type==="npc"){ const n=NPCS[o.npc]; img = o.npc==="moe"? charSprite("moe",0,f2*2) : ART.person(o.npc,n.sprite[1],n.sprite[0],0,f2*2,{long:["akari","chiyo","misuzu"].includes(o.npc)}); }
    else if(o.type==="shop"){ const n=NPCS[o.npc]; sprites.push({y:o.y-0.1,img:ART.object("shop",0),x:o.x}); img=ART.person(o.npc,n.sprite[1],n.sprite[0],0,f2*2); }
    else if(o.type==="inn"){ sprites.push({y:o.y-0.1,img:ART.object("inn",f),x:o.x}); img=ART.person("innkeeper",PAL.slate,PAL.navy,0,f2*2); }
    else if(o.type==="box") img=ART.object(st.boxes[o.box]?"boxOpen":"box",f);
    else if(o.type==="boss"){ if(st.bossDefeated[o.boss]) continue; img=ART.object("boss",f); }
    else img=ART.object(o.type,f);
    sprites.push({y:o.y,x:o.x,img});
  }
  const moving=G.walk.path.length>0; const wf=moving?Math.floor(now/166)%4:0;
  const pp=playerPixel();
  // 2人目の追従表示（表示のみ。判定は先頭だけ）
  const fol=G.fol; const lead=st.party[0], second=st.party[1];
  if(second && fol && (fol.x!==st.pos.x||fol.y!==st.pos.y||moving)){
    let fx=fol.x*16, fy=fol.y*16; let tx=fol.x, ty=fol.y;
    if(moving){ tx=st.pos.x; ty=st.pos.y; fx+=(tx-fol.x)*16*G.walk.prog; fy+=(ty-fol.y)*16*G.walk.prog; }
    const dx=(moving?tx:st.pos.x)-fol.x, dy=(moving?ty:st.pos.y)-fol.y; const fd = dy>0?0:dy<0?1:dx<0?2:dx>0?3:st.dir;
    sprites.push({y:fy/16, px:{x:Math.round(fx),y:Math.round(fy)}, img:charSprite(second,fd,moving?(wf+2)%4:0)});
  }
  sprites.push({y:pp.y/16+0.01, px:pp, img:charSprite(lead,st.dir,wf)});
  sprites.sort((a,b)=>a.y-b.y);
  for(const s of sprites){ const x=s.px?s.px.x:s.x*16, y=s.px?s.px.y:s.y*16; g.drawImage(s.img,x-cam.x,y-8-cam.y); }
  if(moving){ const d=G.walk.path[G.walk.path.length-1]; const bl=Math.floor(now/250)%2; g.strokeStyle=bl?PAL.cream:PAL.gold; g.strokeRect(d.x*16-cam.x+3.5,d.y*16-cam.y+3.5,9,9); }
}
function startLoop(){
  cancelAnimationFrame(G.raf); G.lastTs=0;
  const STEP=160;
  const loop=ts=>{
    if(G.screen!=="explore"||document.hidden){ G.raf=0; return; }
    const dt = G.lastTs? Math.min(100, ts-G.lastTs) : 16; G.lastTs=ts; G.frame++;
    const w=G.walk;
    if(w.path.length && !G.dlg && !G.sheet && !G.lock){
      const n=w.path[0]; const dx=n.x-G.st.pos.x, dy=n.y-G.st.pos.y; G.st.dir = dy>0?0:dy<0?1:dx<0?2:3;
      w.prog+=dt/STEP;
      if(w.prog>=1){ w.prog=0; w.path.shift(); G.fol={...G.st.pos}; G.st.pos={x:n.x,y:n.y}; arrive(); }
    }
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
  const lx=(e.clientX-r.left)*(G.cv.width/r.width)+cam.x, ly=(e.clientY-r.top)*(G.cv.height/r.height)+cam.y;
  walkTo(Math.floor(lx/16), Math.floor((ly+4)/16));
}
function arrive(){
  const st=G.st, m=MAPS[st.mapId]; const zone=zoneAt(m,st.pos.x,st.pos.y);
  if(SND.current!==(zone?"field":"fukuoka")) exploreBgm();
  if(zone){
    // 第07A・23G節：危険タイル到着ごとに1/24の独立抽選（戦えるメンバーがいない時は抽選しない）
    const canFight = st.party.some(c=>vitalOf(c).hp>0);
    if(canFight && randInt(24)===0){
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
function exploreBgm(){ const st=G.st; if(!st) return SND.play("title"); const m=MAPS[st.mapId]; SND.play(zoneAt(m,st.pos.x,st.pos.y)?"field":"fukuoka"); }
function refreshHere(){ if(G.screen==="explore" && !G.sheet){ const el=$(".here"); if(el){ const tmp=document.createElement("div"); tmp.innerHTML=renderExplore(); const n=tmp.querySelector(".here"); el.innerHTML=n.innerHTML; } const g=$(".goal"); if(g) g.textContent=objective(); } }

/* ---- 調べる・会話 ---- */
function interact(o){
  const st=G.st; G.walk.path=[];
  const face=()=>{ const dx=o.x-st.pos.x, dy=o.y-st.pos.y; if(dx||dy) st.dir = Math.abs(dy)>=Math.abs(dx)?(dy>0?0:1):(dx<0?2:3); };
  face();
  switch(o.type){
    case "npc": return talkNpc(o.npc);
    case "shop": return openSheet("shop",{shop:o.shop, npc:o.npc, tab:"buy"});
    case "door": return travelMap(o.to,o.tx,o.ty);
    case "gate": return nationalRouteAvailable(st,curHub(),o.to)?openSheet("travel",{to:o.to,tx:o.tx,ty:o.ty}):say([["",o.to==="KY03"?"唐津への道は福岡編の完了後に開きます。":"この先の道はまだ開いていません。"]]);
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
    if(g.got) extra.push(["",`道具「${nm}」×${g.got}も入っていた！（非売品）`]); if(g.kept) extra.push(["",`道具袋がいっぱいのため、${nm}×${g.kept}は宿屋の預かり所へ送った。`]); }
  commit(); SND.sfx("ok");
  say([["",`応援箱を開けた！ チケット＋40、記念カード「${BOX_CARDS[o.box]}」を手に入れた。`],...extra]);
}
function bossPrompt(bid){
  const st=G.st, b=BOSSES[bid]; const qid=Object.keys(QUESTS).find(k=>QUESTS[k].boss===bid);
  if(st.bossDefeated[bid]) return say([["","乱れは静まっている。図鑑から記録を見られます。"]]);
  if(st.quests[qid]!=="bossReady") return say([["",`奥から大きな重なりを感じる（${b.name}・推奨レベル${b.q}）。依頼「${qid}」を受けて通常敵を倒すと挑戦できます。`]]);
  openSheet("boss",{bid});
}
function say(lines, after){ G.dlg={lines, i:0, after}; render(); }
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
function travelMap(to,tx,ty){
  const st=G.st; st.mapId=to; st.pos={x:tx,y:ty}; G.walk.path=[]; G.fol={x:tx,y:ty};
  if(!st.visitedMaps.includes(to)) st.visitedMaps.push(to);
  const hub=MAPS[to].hub; if(!st.visitedHubs.includes(hub)) st.visitedHubs.push(hub);
  commit(); G.sheet=null; render();
}
function travelHub(to,tx,ty){
  const st=G.st; if(st.slots<1){ return openSheet("rest",{reason:"旅程枠が足りません。休息すると翌日6枠になります。"}); }
  st.slots-=1; const first=!st.visitedHubs.includes(to);
  travelMap(to,tx,ty);
  const j=JOIN_PLAN.find(x=>x.hub===to);
  if(j && joinMember(st,j.cid)){ commit(); say([["",`${HUBS[to]?HUBS[to].name:j.pref}で${CHARS[j.cid].full}と出会った。`],["",`${CHARS[j.cid].full}が仲間に加わった。`]]); return; }
  if(first && to==="KY02") say([["",`${HUBS[to].name}に着いた。港の風と倉庫の匂いがする。`],["もえ","ここが北九州……。港の音、配信に入れたら素敵だね。"]]);
}

/* ---- 戦闘 ---- */
function startBattle(run){
  G.auto=false; clearTimeout(G.autoT); G.autoLast=null;
  const st=G.st; st.run=run; st.runSeq=run.seq;
  for(const e of run.enemies) if(!e.boss) st.seen[e.id]=true;
  run.log=[`${run.enemies.map(e=>e.display).join("と")}が現れた！`];
  G.cmd={}; G.sheet=null;
  commit(); SND.sfx("enc");
  if(st.settings.reduceMotion){ G.screen="battle"; render(); }
  else { const f=document.createElement("div"); f.className="flash"; document.body.appendChild(f); setTimeout(()=>{ f.remove(); G.screen="battle"; render(); },380); }
  SND.play(run.kind==="boss"?"boss":"battle");
}
function partyCard(m,i,run){
  const sel=G.cmd.actor===i; const pct=Math.round(100*m.hp/m.maxHP);
  const ko=m.hp<=0;
  const badges=[ko?"戦闘不能":m.acted?"行動済":"", m.ward?`防護${m.ward}`:"", m.guard?"ガード中":""].filter(Boolean);
  return `<button class="pcard ${sel?"on":""} ${ko?"ko":""} ${isLow(m.hp,m.maxHP)?"low":""} ${m.acted?"done":""}" data-a="pickActor" data-i="${i}" ${ko||m.acted||run.state!=="input"?"aria-disabled=\"true\"":""}>
    <span class="pline"><b>${sel?"▶":""}${esc(m.name)}</b><span class="pjob">${esc(JOBS[m.job].name)} 熟練度${m.R}</span>${badges.map(t=>`<span class="pst">${t}</span>`).join("")}</span>
    <span class="bar"><i style="width:${pct}%"></i></span>
    <span class="pstat">体力<b>${m.hp}</b>/${m.maxHP} 集中力<b>${m.c}</b></span>
  </button>`;
}
function cueText(run){
  if(!run.cue) return "";
  const kindName={guard:"2人がガード",comment:"2人が応援コメント",damage:"2人が攻撃"}[run.cue.kind];
  if(run.cue.active) return `<div class="cue on">ため中：${kindName} ${run.cue.bits.length}/2 → 強攻撃20%減</div>`;
  if(run.turn%4===0) return `<div class="cue on">${run.cue.ready?"対処成功：強攻撃20%軽減":"対処未達：強攻撃そのまま"}</div>`;
  return `<div class="cue">対処：${kindName}（3・7・11…ターン）</div>`;
}
function renderBattle(){
  const st=G.st, run=st.run; if(!run) return "";
  const enemies=run.enemies.map(e=>{
    const pct=Math.round(100*e.hp/e.maxHP);
    return `<div class="ecard ${e.hp<=0?"down":""} ${e.boss?"isboss":""}" id="ec${e.slot}">
      <canvas data-enemy="${e.slot}" width="${e.boss?64:32}" height="${e.boss?64:32}" class="esprite ${e.boss?"boss":""}" aria-hidden="true"></canvas>
      <div class="einfo"><div class="ename">${esc(e.display)}${e.rarity>1?` <span class="rar">${"★".repeat(e.rarity)}${["","通常","やや珍しい","希少","極希少","幻影"][e.rarity]}</span>`:""}</div>
      <span class="bar enemy"><i style="width:${pct}%"></i></span>
      <div class="estat">体力 ${e.hp}/${e.maxHP}・防御力${e.def}</div>
      ${e.hp<=0?`<div class="tele">鎮まった</div>`:""}</div></div>`; }).join("");
  const chain = run.kiraDone?"キラコメ済":`キラコメ${run.chain.stage}/3 次:${["挨拶","作戦","感謝"][run.chain.stage]}`;
  const last = (run.log||[]).slice(-3);
  return `<section class="battle">
    <div class="bhead"><span>ターン${run.turn}・${esc(DIFFICULTY[run.difficulty].name)}・${run.kind==="boss"?"地域ボス":esc(AREAS[run.areaId].name)}</span><span>コメント連携${run.B}・${chain}</span></div>
    <div class="gauge" aria-label="エール${run.A}"><span>エール</span><span class="bar ale"><i style="width:${run.A}%"></i></span><b>${run.A}</b></div>
    ${run.support&&SUPPORTS[run.support]?`<p class="battle-support small">地域支援：${esc(SUPPORTS[run.support].name)}（${esc(SUPPORTS[run.support].text)}）</p>`:""}
    ${cueText(run)}
    <div class="enemies"><canvas class="stagebg" width="160" height="64" aria-hidden="true"></canvas>${enemies}</div>
    <div class="party">${run.party.map((m,i)=>partyCard(m,i,run)).join("")}</div>
    ${renderCommand(run)}
    <button class="log" data-a="openSheet" data-k="battleLog" aria-live="polite" aria-label="戦闘ログ（タップで直近6件）">${last.map(l=>`<span>${esc(l)}</span>`).join("")}</button>
  </section>`;
}
function skillNeeds(job){ return ({J01:"enemy",J02:"line",J03:"ally",J04:"mode",J05:"enemy",J06:"mode",J07:"none",J08:"ally",J09:"enemy",J10:"none",J11:"none",J12:"none",J13:"ally",J14:"none",J15:"enemy",J16:"enemy",J17:"none",J18:"ally",J19:"enemy",J20:"none",J21:"enemy",J22:"allyOther"})[job]; }
function renderCommand(run){
  if(run.state==="won") return `<div class="win cmd"><p>勝利！ ノイズ体をすべて鎮めた。</p><button class="btn primary wide" data-a="toResult">結果を見る</button></div>`;
  if(run.state==="lost") return `<div class="win cmd"><p class="small">全員が戦闘不能。この戦闘の報酬は0。所持ゴールドの半分を失い、全員の体力と集中力を回復して安全な場所へ戻ります。受注・討伐数・経験値・熟練度・所持品は保持。</p><button class="btn primary wide" data-a="defeatReturn">安全な場所へ戻る</button></div>`;
  if(G.auto){
    const al2=run.party.filter(m=>m.hp>0&&!m.acted);
    return `<div class="win cmd autopanel" aria-live="polite">
      <p class="autotitle">オート戦闘中</p>
      <p class="small">AIが状況を見て、敵の予告・体力・集中力・エールから一番よい行動を選んでいます。</p>
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
  if(c.type==="comment"){ sub=linePick(); info=`集中力1・エール＋${(a.job==="J02"?22+S:18)+a.commentA}・コメント連携4`+(c.line?`「${COMMENT_LINES[c.line][run.turn%3]}」`:""); }
  if(c.type==="skill"){
    const need=skillNeeds(a.job);
    info=`集中力${JOBS[a.job].cost}・${JOBS[a.job].desc(S)}`;
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
    const usable=(run.bag||[]).filter(e=>e.n>0&&ITEMS[e.id]);
    if(!usable.length) sub=`<span class="hint">使える道具を持っていません。ショップで買えます。</span>`;
    else { sub=usable.map(e=>chip("item",e.id,c.item===e.id,`${esc(ITEMS[e.id].name)}×${e.n}`)).join("");
      const it=c.item&&ITEMS[c.item];
      if(it){ const nd=itemNeeds(it); info=`${itemText(it,run.V)}（${ITEM_RARITY[it.stars].slice(0,2)}）${a.pouch&&it.cat!=="攻撃"?"・ポーチで1.5倍":""}`;
        if(nd==="enemy") sub+=`<span class="chipbreak"></span>`+enemyPick(); if(nd==="ally") sub+=`<span class="chipbreak"></span>`+allyPick(false);
        if(nd==="down") sub+=`<span class="chipbreak"></span><span class="chiplabel">対象</span>`+(run.party.filter(m=>m.hp<=0).map(m=>chip("ally",m.pos,c.ally===m.pos,esc(m.name))).join("")||`<span class="hint">戦闘不能の仲間はいません</span>`); } }
  }
  if(c.type==="guard") info="受けるダメージ半分・集中力＋1";
  if(c.type==="rest") info=`自分の集中力＋${4+a.rest}`;
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
  if(p.cost.c) out.push(`集中力−${p.cost.c}`); if(p.cost.a) out.push(`エール−${p.cost.a}`); if(p.cost.hp) out.push(`体力−${p.cost.hp}`);
  for(const d of p.dmg){ const e=run.enemies.find(x=>x.slot===d.slot); out.push(`${e.display}に${d.raw}ダメージ${d.raw>=e.hp?"（鎮まる）":""}`); }
  for(const h of p.heal){ const t=run.party[h.pos]; if(h.revive) out.push(`${t.name}が復帰`); else if(h.amt>0) out.push(`${t.name} 体力＋${h.amt}`); }
  for(const g of p.cgain){ if(g.amt>0) out.push(`${run.party[g.pos].name} 集中力＋${g.amt}`); }
  for(const w of p.ward){ if(w.amt>0) out.push(`${run.party[w.pos].name} 防護＋${w.amt}`); }
  if(p.aGain) out.push(`エール＋${Math.min(p.aGain,100-run.A+p.cost.a)}`);
  if(p.consumeB&&run.B) out.push(`コメント連携${run.B}を使用`);
  if(p.setB!=null) out.push("コメント連携を4に");
  if(p.guard) out.push("受けるダメージ半分・集中力＋1");
  if(p.chain){ out.push(p.chain.adv? (run.chain.stage===2?"キラコメ連携が発動！":`連携が進む（${run.chain.stage+1}/3）`) : "連携は進まない"); }
  if(p.chainReset) out.push("この行動で連携は途切れます");
  if(p.cue) out.push("ボス対処に参加");
  return `<span class="pv">${out.map(esc).join("／")}</span>`;
}
function drawEnemies(){
  const run=G.st.run; if(!run) return; const now=Date.now(); const still=G.st.settings.reduceMotion;
  const f=still?0:Math.floor(now/500)%2;
  const bg=document.querySelector("canvas.stagebg"); if(bg){ const g=bg.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(ART.stage(run.areaId, still?0:Math.floor(now/400)%4),0,0); }
  document.querySelectorAll("canvas[data-enemy]").forEach(c=>{
    const e=run.enemies.find(x=>x.slot===+c.dataset.enemy); const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.clearRect(0,0,c.width,c.height);
    if(!e||e.hp<=0) return;
    let img = e.boss? ART.enemy(e.id,"",null,run.areaId,f,64,true) : ART.enemy(e.profile,e.species,e.attr,run.areaId,f);
    if(G.flash && G.flash.until>now && G.flash.slots.includes(e.slot) && Math.floor(now/60)%2===0) img=ART.flashOf(img);
    g.drawImage(img,0,0);
  });
}
function dealtBy(before){ const run=G.st.run; return run && run.enemies.some(e=>e.hp<before.e[e.slot]); }
function isLow(hp,max){ return hp>0 && hp<=max*0.3; }
function battleFx(before){
  const run=G.st.run; if(!run) return;
  const hurt=run.party.some((m,i)=>m.hp<before.p[i]);
  if(hurt){
    const ko=run.party.some((m,i)=>m.hp<=0&&before.p[i]>0);
    setTimeout(()=>SND.sfx(ko?"down":"damage"),dealtBy(before)?380:90);
    if(!G.st.settings.reduceMotion){ const sc=document.querySelector(".battle"); if(sc){ sc.classList.remove("quake"); void sc.offsetWidth; sc.classList.add("quake"); setTimeout(()=>sc.classList.remove("quake"),420); }
      const fl=document.createElement("div"); fl.className="hurtflash"; document.body.appendChild(fl); setTimeout(()=>fl.remove(),260); }
  }
  if(G.st.settings.reduceMotion) return;
  const slots=[];
  run.enemies.forEach(e=>{ const d=before.e[e.slot]-e.hp; if(d>0){ slots.push(e.slot); pop($("#ec"+e.slot),`-${d}`,"dmg"); } });
  run.party.forEach((m,i)=>{ const d=m.hp-before.p[i]; const el=document.querySelector(`.pcard[data-i="${i}"]`); if(d<0){ pop(el,`${d}`,"hurt"); el&&el.classList.add("shake"); } else if(d>0) pop(el,`+${d}`,"heal"); });
  if(slots.length){ G.flash={slots, until:Date.now()+360}; let n=0; const t=setInterval(()=>{ drawEnemies(); if(++n>7) clearInterval(t); },60); }
}
function pop(el,text,cls){ if(!el) return; const s=document.createElement("span"); s.className="pop "+cls; s.textContent=text; el.appendChild(s); setTimeout(()=>s.remove(),900); }
function startBattleTimer(){ stopBattleTimer(); if(!G.st.settings.reduceMotion) G.battleTimer=setInterval(drawEnemies,250); }
function stopBattleTimer(){ if(G.battleTimer){ clearInterval(G.battleTimer); G.battleTimer=0; } }
function confirmAct(forced){
  const st=G.st, run=st.run; const a=run.party[G.cmd.actor]; const act=forced||buildAct(a); if(!act) return;
  const before={e:Object.fromEntries(run.enemies.map(e=>[e.slot,e.hp])), p:run.party.map(m=>m.hp)};
  const r=applyAction(run,G.cmd.actor,act);
  if(!r.ok) return toast(r.reason);
  // 攻撃した時の効果音（通常攻撃・技能・全体攻撃・メーター突破で鳴り分け）
  const dealt = run.enemies.some(e=>e.hp<before.e[e.slot]);
  const killed = run.enemies.some(e=>e.hp<=0&&before.e[e.slot]>0);
  const atkSnd = act.type==="meter"?"meter": !dealt?null : act.type==="attack"?"slash" : run.enemies.filter(e=>e.hp<before.e[e.slot]).length>1?"allhit":"skillhit";
  SND.sfx(atkSnd || (r.log.some(l=>/体力＋|集中力＋|防護/.test(l))?"heal":"ok"));
  if(killed && run.state!=="won") setTimeout(()=>SND.sfx("defeat"),180);
  if(r.log.some(l=>l.startsWith("パチパチ"))) SND.sfx("clap");
  if(r.log.some(l=>l.startsWith("キラコメ"))) SND.sfx("kira");
  G.cmd={};
  if(run.state==="won") setTimeout(()=>SND.jingle("fanfare","victory"),250);
  if(run.state==="lost") setTimeout(()=>SND.jingle("lose",null),450);
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
  if(G.auto && run.state==="input") G.autoT=setTimeout(autoStep, st.settings.reduceMotion?250:650);
  else { G.auto=false; render(); }
}
function toResult(){
  const st=G.st, run=st.run; const res=applyVictory(st,run);
  st.battleBadges=Array.isArray(st.battleBadges)?st.battleBadges:[];
  const newBadges=run.itemHistoryComplete===true?itemBattleBadges(run.itemHistory).filter(id=>!st.battleBadges.includes(id)):[];
  st.battleBadges.push(...newBadges);
  if(res.levelAfter>res.levelBefore && Vof(res.levelAfter)>Vof(res.levelBefore)) res.notes.push("技能・装備の効果量が上昇（V"+Vof(res.levelAfter)+"）");
  const L0=res.levelBefore, L1=levelOf(st.xp);
  st.lastResult={seq:run.seq, kind:run.kind, bossId:run.bossId||null, turns:run.turn, ...res,
    itemsUsed:clone(Array.isArray(run.itemHistory)?run.itemHistory:[]), newBadges,
    enemies:run.enemies.map(e=>({name:e.display||e.name, boss:!!e.boss, rarity:e.rarity||0})),
    members:run.party.map(m=>({cid:m.cid, maxBefore:charStats(st,m.cid,L0).maxHP, maxAfter:charStats(st,m.cid,L1).maxHP}))};
  const back=run.returnPos; st.run=null;
  st.mapId=back.map; st.pos={x:back.x,y:back.y};
  commit(); G.screen="result"; render();
  if(res.levelAfter>res.levelBefore) SND.jingle("levelup","victory"); else if(SND.current!=="victory") SND.play("victory");
}
function renderResult(){
  const st=G.st, r=st.lastResult; if(!r) return "";
  const L=levelOf(st.xp), up=r.levelAfter>r.levelBefore;
  const pct=(a,b)=>Math.max(0,Math.min(100,Math.round(a/b*100)));
  const xpNow=st.xp-xpFor(L), xpSpan=L<999?xpFor(L+1)-xpFor(L):1;
  const foes=r.enemies||[];
  const title = r.kind==="boss" ? "ボスを鎮めた！" : "勝利！";
  const sub = (r.turns?`${r.turns}ターン`:"")+(foes.length?`・${foes.map(e=>esc(e.name)).join("、")}を鎮めた`:"");
  const card=(lab,val,cls="")=>`<div class="rstat ${cls}"><span class="rlab">${lab}</span><span class="rval">${val}</span></div>`;
  const mem=(r.members||[]).map(x=>{
    const j=(r.jp||[]).find(y=>y.cid===x.cid)||{gain:0}; const s=charStats(st,x.cid,L); const v=vitalOf(x.cid);
    const jp=jpOf(st,x.cid,s.job), R=rankOf(jp), jpA=jpFor(R), jpB=R<999?jpFor(R+1):jpA+1;
    const low=isLow(v.hp,s.maxHP), down=v.hp<=0;
    return `<div class="rmem ${low||down?"low":""}">
      <div class="rmh"><b>${esc(charName(st,x.cid))}</b><span class="small">${esc(JOBS[s.job].name)}</span>${j.R1>j.R0?`<span class="rbadge">熟練度 ${j.R0}→${j.R1}</span>`:""}</div>
      <div class="gauge"><span>熟練度${R}</span><span class="bar jp"><i style="width:${pct(jp-jpA,jpB-jpA)}%"></i></span><b>＋${j.gain}</b></div>
      <div class="gauge"><span>体力</span><span class="bar"><i style="width:${pct(v.hp,s.maxHP)}%"></i></span><b>${v.hp}/${s.maxHP}</b></div>
      <div class="gauge"><span>集中力</span><span class="bar cp"><i style="width:${pct(v.c,s.startC)}%"></i></span><b>${v.c}/${s.startC}</b></div>
      ${up&&x.maxAfter>x.maxBefore?`<p class="small good">最大体力 ${x.maxBefore} → ${x.maxAfter}</p>`:""}
      ${down?`<p class="small warn">戦闘不能。宿屋か蘇生の道具で回復しよう。</p>`:low?`<p class="small warn">体力わずか。回復しておこう。</p>`:""}
    </div>`; }).join("");
  const items=[...(r.items||[]).map(x=>`<li class="ritem"><span class="rst">${"★".repeat(ITEMS[x.id].stars)}</span>${esc(ITEMS[x.id].name)} ×${x.n}<span class="small">（${esc(x.why)}）</span></li>`),
    ...(r.itemsKept||[]).map(x=>`<li class="warn">${esc(ITEMS[x.id].name)} ×${x.n} は袋がいっぱいのため宿屋の預かり所へ</li>`),
    ...(r.itemsLost||[]).map(x=>`<li class="warn">${esc(ITEMS[x.id].name)} ×${x.n} は預かり所もいっぱいで受け取れず</li>`)];
  const gifts=r.gifts.map(g=>`<li class="ritem">専用品「${esc(EQUIP[g].name)}」を贈られた</li>`);
  const usedItems=(r.itemsUsed||[]).map(x=>{
    const effects=[x.hp>0?`体力＋${x.hp}`:"",x.c>0?`集中力＋${x.c}`:"",x.revives>0?`復帰${x.revives}人`:""].filter(Boolean);
    const actor=x.actor==="hero"||CHARS[x.actor]?`${esc(charName(st,x.actor))}：`:"";
    return `<li>${Number.isInteger(x.turn)&&x.turn>0?`${x.turn}ターン目・`:""}${actor}${esc(ITEMS[x.id]?.name||x.id)}${effects.length?`（${effects.join("・")}）`:""}</li>`;
  });
  const anyLow=st.roster.some(c=>{const v=vitalOf(c),s=charStats(st,c,L); return v.hp<=0||isLow(v.hp,s.maxHP);});
  return `<section class="result" aria-labelledby="rtitle">
    <div class="rbanner ${r.kind==="boss"?"boss":""}"><h2 id="rtitle">${title}</h2><p>${sub}</p></div>
    ${up?`<div class="rlevel"><b>レベルアップ！</b><span>レベル${r.levelBefore} → <b class="big">${r.levelAfter}</b></span>${Vof(r.levelAfter)>Vof(r.levelBefore)?`<span class="small">技能・装備・道具の効果量が上昇</span>`:""}</div>`:""}
    <div class="rgrid">${card("経験値",`＋${r.xp.toLocaleString()}`)}${card("ゴールド",`＋${r.gold.toLocaleString()}`,"gold")}${r.tickets?card("チケット",`＋${r.tickets.toLocaleString()}`):card("所持金",`${st.gold.toLocaleString()}G`)}</div>
    <div class="gauge rxp"><span>レベル${L}</span><span class="bar xp"><i style="width:${pct(xpNow,xpSpan)}%"></i></span><b>${L<999?`次まで${(xpSpan-xpNow).toLocaleString()}`:"最大"}</b></div>
    ${r.quest?`<div class="rquest done">依頼「${r.quest} ${esc(QUESTS[r.quest].name)}」完了！</div>`:r.kills&&r.killQuest?`<div class="rquest"><span>依頼 ${r.killQuest} 討伐</span><span class="bar"><i style="width:${pct(r.killNow,r.killNeed)}%"></i></span><b>${r.killNow}/${r.killNeed}</b></div>`:""}
    ${items.length||gifts.length?`<div class="rbox"><h3 class="label">手に入れたもの</h3><ul class="rlist">${[...items,...gifts].join("")}</ul></div>`:""}
    ${usedItems.length?`<div class="rbox"><h3 class="label">この戦闘で使った道具（${usedItems.length}回）</h3><ul class="rlist">${usedItems.join("")}</ul></div>`:""}
    ${(r.newBadges||[]).length?`<div class="rbox"><h3 class="label">新しい戦闘バッジ</h3><ul class="rlist">${r.newBadges.map(id=>`<li>${id} ${esc(ITEM_BADGES[id]||id)}</li>`).join("")}</ul></div>`:""}
    ${r.notes.filter(n=>!/効果量が上昇/.test(n)).map(n=>`<p class="good rnote">${esc(n)}</p>`).join("")}
    <h3 class="label">仲間</h3><div class="rmems">${mem}</div>
    ${anyLow?`<p class="small warn">体力が減っている仲間がいます。次の戦闘へ持ち越すので、道具や宿屋で回復しておこう。</p>`:""}
    <div class="rfoot"><button class="btn primary wide" data-a="resultDone">探索へ</button></div></section>`;
}
function resultDone(){
  const r=G.st.lastResult; G.screen="explore"; keepFlush(); render(); exploreBgm();
  if(r && r.quest==="M01" && !G.st.scenes.RANK_D1) playScene("RANK_D1");
  else if(r && r.quest==="S01" && !G.st.scenes.S01_DONE) playScene("S01_DONE");
  else if(r && r.quest==="S02" && !G.st.scenes.S02_DONE) playScene("S02_DONE");
  else if(r && r.bossId==="B01" && !G.st.scenes.M02_BOSS) playScene("M02_BOSS");
  else if(r && r.bossId==="B02" && !G.st.scenes.M03_BOSS) playScene("M03_BOSS");
  else if(r && r.bossId==="B03" && !G.st.scenes.M04_BOSS) playScene("M04_BOSS");
}

/* ---- 配信（第13・14節） ---- */
function renderStream(){
  const st=G.st, s=st.stream; if(!s) return "";
  const req=s.requestIds;
  const theme=STREAM_THEMES[s.theme];
  if(s.done){
    const pass=s.score>=80;
    return statusBar()+`<section class="win stream">
      <h2 class="label">22時00分　締め</h2><p class="big">${s.score}点・${esc(streamGrade(s.score))}</p>
      <div class="meter"><i style="width:${Math.min(100,s.score/170*100)}%"></i><span class="line" style="left:${80/170*100}%"></span></div>
      <p>${pass?"目標80点を達成！":"80点に届かなかった。要望に合う行動を、まだ使っていない順に選ぶと点が伸びます。"}</p>
      <div class="stack">${pass?`<button class="btn primary" data-a="streamFinish">配信を終える</button>`:`<button class="btn primary" data-a="streamRetry">同じ配信に再挑戦（0枠）</button><button class="btn" data-a="streamLeave">いったん終える（配信待ちを保持）</button>`}</div></section>`;
  }
  const comments = [`初見です！ ${STREAM_ACTS[req[s.hand]].req}`, "こんばんは〜", s.hand>0?`${STREAM_ACTS[s.picks[s.hand-1].act].name}よかった！`:s.hub==="KY04"?"佐賀市から見てます":s.prefId==="PR02"?"唐津から見てます":"港から見てます"];
  return statusBar()+`<section class="win stream">
    <div class="srow"><span class="label">${s.hub==="KY04"?"佐賀市の声便":s.prefId==="PR02"?"唐津の声便":"九州エール便"}</span><span>${STREAM_TIMES[s.hand]}（${s.hand+1}／4手番）</span></div>
    <p class="small">メインライバー：もえ　配信サポート：${esc(charName(st,s.host))}　テーマ：${esc(theme.name)}　${s.style==="voice"?"声中心":"映像あり"}</p>
    <div class="meter" aria-label="得点${s.score}"><i style="width:${Math.min(100,s.score/170*100)}%"></i><span class="line" style="left:${80/170*100}%"></span></div>
    <div class="srow small"><span>得点 ${s.score}</span><span>目標 80</span></div>
    <div class="comments">${comments.map(c=>`<div class="cmt">${esc(c)}</div>`).join("")}</div>
    <p class="req">要望：「${esc(STREAM_ACTS[req[s.hand]].req)}」</p>
    <div class="stack">${Object.entries(STREAM_ACTS).map(([k,v])=>{ const used=s.used.includes(k); const pts = used?0:20+(req[s.hand]===k?20:0)+(!s.themeBonusUsed&&theme.act===k?10:0);
      return `<button class="btn opt" data-a="streamAct" data-v="${k}">${esc(v.name)}${used?"（使用済み・0点）":`（＋${pts}点）`}</button>`; }).join("")}</div>
  </section>`;
}
function streamAct(k){
  const st=G.st, s=st.stream; const r=streamPlay(s,k);
  const lines=s.hub==="KY04"?{first:"はじめまして。今日は佐賀市から配信しています。",local:"川沿いの道と駅前を歩き、街灯の広場まで来ました。",reply:"質問ありがとう。佐賀市の好きな景色も教えてください。",thanks:"街で聞いた声を、これからも大切にします。ありがとう。",like:"いいねの光が、街灯と並んで見えるよ。",kira:"キラコメが広場に届いたみたい。ありがとう。"}:s.prefId==="PR02"?{first:"はじめまして。今日は唐津の海辺から配信しています。",local:"海辺の小径と見晴らし台を歩いてきました。潮風が心地いいです。",reply:"質問ありがとう。皆さんが見たい景色も教えてください。",thanks:"唐津から届いた返事、ひとつずつ覚えておきます。ありがとう。",like:"いいねの光、海辺まで届いてるよ。",kira:"キラコメが波に映るみたい。ありがとう。"}:{first:"はじめましての人も、ゆっくりしていってね。今日は港の話をするよ。",local:"北九州の港は、夜になると灯りが波に映ってきれいなんです。",reply:"質問ありがとう！ 好きな場所は……灯台の段丘かな。",thanks:"今日来てくれた人、本当にありがとう。全部の声、覚えておくね。",like:"いいねの光、順番に灯っていくね！",kira:"キラコメ、届いてる！ 光の文字がきれい。"};
  SND.sfx(r.total?"ok":"cancel");
  if(s.done){ s.best=Math.max(st.streamBest[s.prefId]||0,s.score); st.streamBest[s.prefId]=s.best; }
  commit(); say([["もえ",lines[k]],["",`${STREAM_ACTS[k].name}：初使用${r.gain.first}＋要望一致${r.gain.match}＋テーマ${r.gain.theme}＝${r.total}点`]]);
}
function streamFinish(){
  const st=G.st; const qid=streamPending();
  if(!st||G.readOnly||G.screen!=="stream"||!st.stream?.done||st.stream.score<80||!qid||st.quests[qid]!=="combatDone"||QUESTS[qid].hub!==st.stream.hub) return toast("配信の状態が変わりました。依頼帳を確認してください。");
  st.stream=null;
  const res={xp:0,tickets:0}; completeQuest(st,qid,res);
  commit(); G.screen="explore"; exploreBgm(); render();
  toast(`${qid}完了：経験値＋${res.xp}・チケット＋${res.tickets}`);
  if(qid==="M02") playScene("RANK_D2");
  if(qid==="M03") playScene("RANK_D3");
  if(qid==="M04") playScene("RANK_C1");
}

/* ---- シート（メニュー） ---- */
function openSheet(k,data={}){ G.sheet=k; G.sheetData=data; G.walk.path=[]; render(); const el=$(".sheet"); if(el) el.scrollTop=0; }
function closeSheet(){ G.sheet=null; render(); }
function sheetWrap(title, body){ return `<div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="win sheet"><div class="sheet-head"><h2 class="label">${esc(title)}</h2><button class="btn" data-a="closeSheet">戻る</button></div>${body}</div></div>`; }
function renderSheet(){
  const k=G.sheet; if(!k) return ""; const st=G.st; const d=G.sheetData;
  switch(k){
    case "about": return sheetWrap("この作品について",`<p>「トップライバーへの道 九州編」は、配信文化を参考にした非公式の創作RPGです。人物・台詞・敵・数値・画像・音はゲーム用の創作で、実在のサービスの配信・課金・アカウント・ランキングとは連携しません。</p><p>雪餅羽もえ（のわんもえ）の「おやすみセカイ元メンバー・脱退後にPocochaでS6を目指す」という背景は、物語の設定です。作中のランクは物語上の到達記録で、実際のランク歴ではありません。</p><p>敵の名前は、配信・応援の言葉とRPGの語感を組み合わせた本作の創作名です。</p><p class="small">gameVersion ${GAME_VERSION}／schemaVersion ${SCHEMA_VERSION}</p>`);
    case "settings": return sheetWrap("設定と保存", renderSettings());
    case "nearby": { const near=nearbyObjects(); return sheetWrap("近くを調べる", near.length? `<div class="stack">${near.map(o=>`<button class="btn" data-a="interactId" data-v="${o.id}">${esc(o.label)}</button>`).join("")}</div>` : `<p>近くに調べられるものはありません。道しるべから目的地を選べます。</p>`); }
    case "guide": { const m=MAPS[st.mapId]; return sheetWrap("道しるべ", `<p class="small">選ぶと、その場所まで実際に歩きます（途中の遭遇エリアでは抽選があります）。</p><div class="stack">${m.objects.filter(o=>o.type!=="tower").map(o=>{ const a=o.area?AREAS[o.area]:null; return `<button class="btn" data-a="guideTo" data-v="${o.id}">${esc(o.label)}${a?`（推奨レベル${a.q}）`:""}</button>`; }).join("")}</div>`); }
    case "quests": return sheetWrap("依頼帳", renderQuests());
    case "map": return sheetWrap("全国の旅の地図", renderWorld());
    case "travel": return sheetWrap("移動", `<p>${esc(HUBS[d.to].name)}へ向かいますか？（旅程枠1を使います。残り${st.slots}枠）</p><div class="stack"><button class="btn primary" data-a="doTravel">向かう</button><button class="btn" data-a="closeSheet">やめる</button></div>`);
    case "rest": return sheetWrap("休息", `${d.reason?`<p class="warn">${esc(d.reason)}</p>`:""}<p>日付を進めると翌日になり、旅程枠が6に戻ります（費用なし）。体力と集中力は回復しません。回復は宿屋で。今は${st.day}日目・残り${st.slots}枠。</p><div class="stack"><button class="btn primary" data-a="doRest">日付を進める</button><button class="btn" data-a="closeSheet">やめる</button></div>`);
    case "party": return sheetWrap("編成", renderParty());
    case "status": return sheetWrap("パーティーのステータス", renderStatus());
    case "inn": { const hub=curHub(); const per=INN_PRICE[hub]||10; const n=st.roster.length; const total=per*n; const can=st.gold>=total;
      return sheetWrap(d.label||"宿屋", `<p>「いらっしゃいませ。お一人さま${per}ゴールド、${n}人で${total}ゴールドです。」</p>
      <p class="small">泊まると翌朝になり、全員の体力と集中力が全回復し、旅程枠が6に戻ります。所持${st.gold.toLocaleString()}ゴールド → 宿泊後${(st.gold-total).toLocaleString()}ゴールド。</p>
      <ul class="list">${st.roster.map(cid=>{const s=charStats(st,cid,levelOf(st.xp)),v=vitalOf(cid); return `<li>${esc(charName(st,cid))}：体力 ${v.hp}/${s.maxHP}・集中力 ${v.c}/${s.startC}</li>`;}).join("")}</ul>
      ${can?"":`<p class="warn">ゴールドが足りません（あと${total-st.gold}）。通常敵を倒すとゴールドが手に入ります。</p>`}
      <div class="stack"><button class="btn primary" data-a="doInn" ${can?"":"disabled"}>泊まる（${total}ゴールド）</button><button class="btn" data-a="closeSheet">やめる</button></div>`); }
    case "record": return sheetWrap("記録", renderRecord());
    case "items": return sheetWrap("道具", renderItems());
    case "dex": return sheetWrap("ノイズ図鑑", renderDex());
    case "shop": return sheetWrap(SHOPS[d.shop].name, renderShop());
    case "moe": return sheetWrap("もえ", renderMoe());
    case "boss": { const b=BOSSES[d.bid]; const ps=bossScale(d.bid, st.party.length); const df=DIFFICULTY[st.settings.difficulty]; const pw=x=>Math.ceil(x*df.atk*ps.atk); return sheetWrap("地域ボス", `<p><b>${esc(b.name)}</b>（${d.bid}）　強度q${b.q}・推奨レベル${b.q}。現在レベル${levelOf(st.xp)}。</p><p class="small">体力${Math.ceil((100+36*b.q)*df.hp*ps.hp)}（${df.name}）。${st.party.length<4&&(ps.hp<1||ps.atk<1)?`戦闘メンバー${st.party.length}人のため、体力×${ps.hp}・攻撃×${ps.atk}の少人数補正（挑戦時の人数で固定）。`:""}</p><p class="small">行動周期：1人へ攻撃${pw(12+b.q)} → 全員へ攻撃${pw(6+Math.floor(b.q/2))} → ため → 全員へ強攻撃${pw(10+3*b.q)}。ため予告中に<b>異なる2人がガード</b>すると、直後の強攻撃が20%減ります（静観型）。</p><p class="small">敗北・撤退しても受注と討伐数は保持され、0枠で再挑戦できます。</p><div class="stack"><button class="btn primary" data-a="bossGo" data-v="${d.bid}">挑戦する</button><button class="btn" data-a="closeSheet">準備する</button></div>`); }
    case "streamSetup": return sheetWrap("配信の準備", renderStreamSetup());
    case "battleLog": return sheetWrap("戦闘ログ", `<div class="stack">${((G.st.run&&G.st.run.log)||[]).slice(-6).map(l=>`<p>${esc(l)}</p>`).join("")||"<p>まだありません。</p>"}</div>`);
    case "pause": return sheetWrap("休止中", `<p>戦闘はターン${st.run.turn}の入力待ちで保存されています。再開しても撤退・回復・報酬は発生しません。</p><div class="stack"><button class="btn primary" data-a="closeSheet">再開する</button></div>`);
    case "retreat": return sheetWrap("撤退", `<p>撤退は必ず成功します。この戦闘の報酬は0、旅程枠も使いません。遭遇した位置へ戻ります。</p><div class="stack"><button class="btn primary" data-a="doRetreat">撤退する</button><button class="btn" data-a="closeSheet">戦闘を続ける</button></div>`);
  }
  return "";
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
    <div class="row3 padside">${[["right","スティック右・A/B左（標準）"],["left","スティック左・A/B右"]].map(([k,n])=>`<button class="btn ${padSide()===k?"on":""}" data-a="setPad" data-v="${k}" aria-pressed="${padSide()===k}">${padSide()===k?"▶ ":""}${n}</button>`).join("")}</div>
    <p class="small">ジョイコントローラー：探索ではスティックで歩き、決定で近くを調べます。メニュー・戦闘・会話ではスティックでカーソル（▶）を動かし、決定で選び、戻るで閉じます。Bluetoothのゲームコントローラー（Joy-Conなど）にも対応しています。</p>
    ${st?`<h3 class="label">保存</h3><p class="small">行動を確定するたびに、この端末のブラウザ内へ自動保存しています（直近2世代）。状態：${esc(G.saveStatus)}</p>
    <p class="small">端末の変更やブラウザのデータ削除の前に、下の「バックアップを表示」で文字列をコピーし、メモ帳などへ保管してください。</p>
    <div class="stack"><button class="btn" data-a="showBackup">バックアップを表示</button></div>
    ${G.sheetData.backup?`<textarea id="backupOut" class="input mono" rows="5" readonly>${esc(G.sheetData.backup)}</textarea><button class="btn" data-a="copyBackup">コピーする</button>`:""}`:""}
    <h3 class="label">復元</h3><p class="small">保管したバックアップの文字列を貼り付けて読み込みます（現在の記録は置き換わります）。</p>
    <textarea id="restoreIn" class="input mono" rows="4" aria-label="バックアップの貼り付け"></textarea>
    <div class="stack"><button class="btn" data-a="restore">貼り付けた記録を読み込む</button>
    ${st&&G.screen!=="title"?`<button class="btn" data-a="toTitle">タイトルへ戻る</button>`:""}</div>`;
}
function renderQuests(){
  const st=G.st; const hub=curHub(); const safe=isSafe();
  const stat={locked:"未解放",available:"受注できる",active:"受注中",bossReady:"ボスに挑戦できる",combatDone:"配信待ち",complete:"完了"};
  let h=`<p class="small">受注は同時に1件。本編・任意とも受注時に旅程枠2を使います（残り${st.slots}枠）。</p>`;
  for(const [id,Q] of Object.entries(QUESTS)){
    const s=st.quests[id]; const prog = ["active","bossReady","combatDone","complete"].includes(s)?`討伐 ${st.qprog[id]||0}/${Q.kills}`:"";
    let btn="";
    if(s==="available"){ const can = !st.activeQuest && hub===Q.hub && safe; btn=`<button class="btn primary" data-a="acceptQuest" data-v="${id}" ${can?"":"disabled"}>受注する（2枠）</button>${can?"":`<p class="small">${st.activeQuest?"ほかの依頼を受注中です。":`${HUBS[Q.hub].name}の安全地帯で受注できます。`}</p>`}`; }
    if(s==="active"||s==="bossReady") btn=`<button class="btn" data-a="abandonQuest" data-v="${id}">放棄する（受注費は戻りません）</button>`;
    if(s==="combatDone") btn=`<button class="btn primary" data-a="openSheet" data-k="streamSetup" ${hub===Q.hub&&safe?"":"disabled"}>配信を始める（0枠）</button>${hub===Q.hub?"":`<p class="small">${HUBS[Q.hub].name}で始められます。</p>`}`;
    const lockNote = s==="locked"? (Q.main?"前の本編依頼の完了で解放":`代表の住民（${NPCS[Q.npc].name}）と初めて話すと解放`):"";
    h+=`<div class="qcard ${s}"><div class="srow"><b>${id} ${esc(Q.name)}</b><span class="tag">${stat[s]}</span></div><p class="small">${esc(HUBS[Q.hub].name)}・${Q.main?"本編":"任意"}　${prog}</p><p>${esc(Q.goal)}</p>${lockNote?`<p class="small">${lockNote}</p>`:""}${btn}</div>`;
  }
  return h;
}
function renderWorld(){
  const st=G.st; const safe=isSafe();
  let h=`<p class="small">拠点間の移動は旅程枠1。安全地帯から出発できます。</p><div class="stack">`;
  for(const [id,H] of Object.entries(HUBS)){
    const here=curHub()===id; const visited=st.visitedHubs.includes(id);
    const route=!here&&nationalRouteAvailable(st,curHub(),id)&&(!["KY03","KY04"].includes(id)||visited);
    h+=`<div class="qcard"><div class="srow"><b>${id} ${esc(H.pref)}・${esc(H.name)}${H.home?"（故郷）":""}</b><span class="tag">${here?"現在地":visited?"訪問済み":"未訪問"}</span></div>
      ${here?"":`<button class="btn" data-a="worldGo" data-v="${id}" ${safe&&route?"":"disabled"}>${id==="KY03"&&!visited?"初回は北九州の東門から":id==="KY04"&&!visited?"初回は唐津の東門から":"向かう（1枠）"}</button>`}</div>`;
  }
  h+=`</div><h3 class="label">この先の拠点</h3><ul class="list dim">${FUTURE_HUBS.map(([id,n,p])=>`<li>${id} ${p}・${n}　未解放</li>`).join("")}</ul>
    <h3 class="label">全国編の準備状況</h3><p class="small">${NATIONAL_REGIONS.length}地方・${NATIONAL_PREFECTURES.length}都道府県の地理台帳を準備中。現在遊べるのは福岡県の福岡市・北九州市、佐賀県の唐津市（M03まで）と佐賀市（M04まで）です。その先は未収録です。</p>`;
  return h;
}
function nationalRouteAvailable(st,from,to){
  return NATIONAL_ROUTES.some(r=>r.status==="playable"&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from))&&(r.unlock==="always"||r.unlock==="fukuokaClear"&&!!st.fukuokaClear||r.unlock==="karatsuClear"&&st.quests?.M03==="complete"));
}
function renderParty(){
  const st=G.st; const d=G.sheetData; const L=levelOf(st.xp);
  const locked = !!st.run || !isSafe() || !!streamPending();
  const lockMsg = st.run?"戦闘中は変更できません。":!isSafe()?"安全地帯でのみ変更できます。":streamPending()?"配信待ちの間はジョブと装備を変更できません。":"";
  if(d.cid){
    const cid=d.cid; const cur=charStats(st,cid,L);
    if(d.view==="job"){
      return `<p><b>${esc(charName(st,cid))}</b>のジョブ（現在：${esc(JOBS[cur.job].name)}）</p>${lockMsg?`<p class="warn">${lockMsg}</p>`:""}
      <div class="stack">${JOB_IDS.map(j=>{ const nx=charStats(st,cid,L,j,previewEquipFor(st,cid,j)); const jp=jpOf(st,cid,j);
        return `<div class="jcard ${j===cur.job?"on":""}"><div class="srow"><b>${j===cur.job?"▶ ":""}${j} ${esc(JOBS[j].name)}</b><span>熟練度${nx.R}${nx.R>=999?"・最大":`・次まで${jpFor(nx.R+1)-jp}`}</span></div>
        <p class="small">${esc(JOBS[j].field)}｜${esc(JOBS[j].skill)}：集中力${JOBS[j].cost}。${esc(JOBS[j].desc(nx.S))}</p>
        <p class="small">変更後：最大体力${nx.maxHP}（今${cur.maxHP}）・最大集中力${nx.startC}（今${cur.startC}）・技能強化${nx.S}</p>
        ${j===cur.job?"":`<button class="btn" data-a="setJob" data-c="${cid}" data-v="${j}" ${locked?"disabled":""}>このジョブにする</button>`}</div>`; }).join("")}</div>
      <button class="btn" data-a="partyView" data-c="${cid}" data-v="">人物へ戻る</button>`;
    }
    if(d.view && d.view.startsWith("eq:")){
      const slot=d.view.slice(3); const items=Object.keys(EQUIP).filter(id=>EQUIP[id].slot===slot && (st.owned[id]||0)>0);
      return `<p><b>${esc(charName(st,cid))}</b>の${{w:"武器",a:"防具",acc:"アクセサリー"}[slot]}</p>${lockMsg?`<p class="warn">${lockMsg}</p>`:""}
        <div class="stack"><button class="btn" data-a="setEquip" data-c="${cid}" data-s="${slot}" data-v="" ${locked?"disabled":""}>外す</button>
        ${items.map(id=>{ const it=EQUIP[id]; const mine=st.equip[cid][slot]===id; const avail=availableCount(st,id)+(mine?1:0);
          const elig=!it.job || (it.job===cur.job && cur.R>=it.needR); const eq2={...st.equip[cid],[slot]:id}; const nx=charStats(st,cid,L,null,eq2);
          return `<div class="jcard ${mine?"on":""}"><div class="srow"><b>${mine?"▶ ":""}${esc(it.name)}</b><span>所持${st.owned[id]}・未装備${availableCount(st,id)}</span></div><p class="small">${esc(itemText(it,Vof(levelOf(st.xp))))}</p>
          <p class="small">装備後：最大体力${nx.maxHP}・最大集中力${nx.startC}・攻撃力${attackPower(nx,L)}・防御力${defensePower(nx,L)}</p>
          ${mine?"":`<button class="btn" data-a="setEquip" data-c="${cid}" data-s="${slot}" data-v="${id}" ${locked||!elig||avail<=0?"disabled":""}>装備する</button>${elig?"":`<p class="small">現在のジョブと熟練では装備できません。</p>`}`}</div>`; }).join("")}</div>
        <button class="btn" data-a="partyView" data-c="${cid}" data-v="">人物へ戻る</button>`;
    }
    const e=st.equip[cid]; const C=CHARS[cid];
    return `<div class="who"><canvas class="sprite-md" data-char="${cid}" width="16" height="24" aria-hidden="true"></canvas><div><b>${esc(cid==="hero"?st.profile.name:C.full)}</b>　${[C.age?C.age+"歳":"",C.from?esc(C.from):""].filter(Boolean).join("・")}<br><span class="small">${cid==="moe"?"経歴":"職歴"}：${esc(C.career)}（ジョブとは別）</span></div></div>
      <dl class="kv"><dt>ジョブ</dt><dd>${esc(JOBS[cur.job].name)}　熟練度${cur.R}・技能強化${cur.S}</dd><dt>体力</dt><dd>${vitalOf(cid).hp}／${cur.maxHP}</dd><dt>集中力</dt><dd>${vitalOf(cid).c}／${cur.startC}</dd>
      <dt>武器</dt><dd>${e.w?esc(EQUIP[e.w].name):"なし"}</dd><dt>防具</dt><dd>${e.a?esc(EQUIP[e.a].name):"なし"}</dd><dt>アクセサリー</dt><dd>${e.acc?esc(EQUIP[e.acc].name):"なし"}</dd></dl>
      <div class="stack"><button class="btn" data-a="partyView" data-c="${cid}" data-v="job">ジョブを変える</button>
      <button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:w">武器</button><button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:a">防具</button><button class="btn" data-a="partyView" data-c="${cid}" data-v="eq:acc">アクセサリー</button>
      <button class="btn" data-a="partyView" data-c="" data-v="">一覧へ</button></div>`;
  }
  const bond = npc => !st.talked[npc]?0: 1 + (npc==="akari"? (st.quests.M01==="complete"?1:0)+(st.quests.S01==="complete"?1:0) : (st.quests.M02==="complete"?1:0)+(st.quests.S02==="complete"?1:0));
  const supOk = st.talked.akari && st.quests.M01==="complete" && st.quests.S01==="complete";
  const sagaSupOk = st.talked.karatsuGuide && st.quests.M03==="complete";
  const partyLocked=G.readOnly||G.screen!=="explore"||G.sheet!=="party"||!!G.dlg||!!st.run||!!G.walk.path.length||!isSafe();
  return `${lockMsg?`<p class="warn">${lockMsg}</p>`:""}<p class="small">出撃は1～4人。先頭が前衛です。加入済みの仲間から選び、待機メンバーとは出撃枠を指定して直接入れ替えられます。</p>
    <h3 class="label">戦闘メンバー</h3><div class="stack">${st.party.map((c,i)=>`<div class="prow"><button class="btn grow" data-a="partyView" data-c="${c}" data-v="">${i+1}. ${esc(charName(st,c))}・${esc(JOBS[st.jobs[c]].name)}</button>${i?`<button class="btn sq" data-a="partyUp" data-v="${i}" data-c="${c}" aria-label="${esc(charName(st,c))}を前へ" ${partyLocked?"disabled":""}>↑</button>`:""}${st.party.length>1?`<button class="btn sq" data-a="partyLeave" data-v="${i}" data-c="${c}" aria-label="${esc(charName(st,c))}を待機へ" ${partyLocked?"disabled":""}>待機</button>`:""}</div>`).join("")}</div>
    ${st.roster.length>st.party.length?`<h3 class="label">控え</h3><div class="stack">${st.roster.filter(c=>!st.party.includes(c)).map(c=>`<div class="prow"><button class="btn grow" data-a="partyView" data-c="${c}" data-v="">${esc(charName(st,c))}・${esc(JOBS[st.jobs[c]].name)}</button>${st.party.length<4?`<button class="btn" data-a="partyIn" data-v="${c}" ${partyLocked?"disabled":""}>出撃に加える</button>`:""}${st.party.map((target,i)=>`<button class="btn" data-a="partySwap" data-v="${c}" data-i="${i}" data-c="${target}" ${partyLocked?"disabled":""}>${i+1}番の${esc(charName(st,target))}と入替</button>`).join("")}</div>`).join("")}</div>`:""}
    <h3 class="label">地域支援</h3><p class="small">コア応援者がいる県の効果を1つ選べます（戦闘開始時に固定）。</p>
    <div class="stack"><button class="btn ${!st.support?"on":""}" data-a="setSupport" data-v="">${!st.support?"▶ ":""}なし</button>
    <button class="btn ${st.support==="PR01"?"on":""}" data-a="setSupport" data-v="PR01" ${supOk?"":"disabled"}>${st.support==="PR01"?"▶ ":""}福岡：戦闘開始時のエール＋10（灯里 親密度${bond("akari")}/3）</button>
    <button class="btn ${st.support==="PR02"?"on":""}" data-a="setSupport" data-v="PR02" ${sagaSupOk?"":"disabled"}>${st.support==="PR02"?"▶ ":""}佐賀：戦闘開始時のエール＋12（唐津の案内人との会話・M03完了）</button></div>`;
}
function previewEquipFor(st,cid,job){ const e={...st.equip[cid]}; for(const s of ["w","a"]){ const it=e[s]&&EQUIP[e[s]]; if(it&&it.job&&it.job!==job) e[s]=null; } return e; }
function renderRecord(){
  const st=G.st; const L=levelOf(st.xp);
  const milestones=[["E1","新規開始"],["D1","M01完了"],["D2","M02完了"],["D3","M03完了"],["C1","M04完了"]];
  return `<dl class="kv"><dt>共通レベル</dt><dd>${L}（経験値 ${st.xp.toLocaleString()}${L<999?`・次まで${(xpFor(L+1)-st.xp).toLocaleString()}`:"・最大"}）</dd>
    <dt>もえのシナリオ到達ランク</dt><dd>${MOE_RANKS[st.moeRank]}</dd><dt>旅</dt><dd>${st.day}日目</dd></dl>
    <p class="small">もえのランクは物語上の到達記録です。レベル・熟練度・実際の応援ポイントとは別に表示します。</p>
    <ul class="list">${milestones.map(([r,c],i)=>`<li>${i<=st.moeRank?"●":"○"} ${r}：${c}</li>`).join("")}<li class="dim">…S6：M16完了（この版には未収録）</li></ul>
    <h3 class="label">仲間</h3><ul class="list">${st.roster.map(c=>{const s=charStats(st,c,L); return `<li>${esc(charName(st,c))}：${esc(JOBS[s.job].name)} 熟練度${s.R}・最大体力${s.maxHP}</li>`;}).join("")}</ul>
    <h3 class="label">九州アルバム</h3><ul class="list">${Object.entries(BOX_CARDS).map(([k,n])=>`<li>${st.cards.includes(k)?"● "+esc(n):"○ 未取得"}</li>`).join("")}</ul>
    <h3 class="label">訪れた拠点</h3><ul class="list">${Object.entries(HUBS).map(([id,h])=>`<li>${st.visitedHubs.includes(id)?"●":"○"} ${esc(h.pref)}・${esc(h.name)}</li>`).join("")}</ul>
    <h3 class="label">応援者帳</h3><ul class="list"><li>灯里（福岡市）：${st.talked.akari?"話を聞いた":"未会話"}</li><li>奏太（北九州市）：${st.talked.sota?"話を聞いた":"未会話"}</li><li>唐津の案内人：${st.talked.karatsuGuide?"話を聞いた":"未会話"}</li></ul>
    <h3 class="label">配信記録</h3><p>福岡の最高得点：${st.streamBest.PR01!=null?st.streamBest.PR01+"点":"未配信"}／佐賀の最高得点：${st.streamBest.PR02!=null?st.streamBest.PR02+"点":"未配信"}</p>
    ${st.lastResult?`<h3 class="label">直前の戦闘結果</h3><p class="small">経験値＋${st.lastResult.xp}・${st.lastResult.gold}ゴールド・${st.lastResult.jp.map(j=>`${esc(j.name)} 熟練度経験値＋${j.gain}`).join("、")}</p>`:""}`;
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
  const locked = !!st.run || !!streamPending();
  const head=`<p>所持 ${st.gold.toLocaleString()}ゴールド・道具袋 ${st.bag.length}/${BAG_KINDS}種類</p><div class="row3"><button class="btn ${tab==="buy"?"on":""}" data-a="shopTab" data-v="buy">装備を買う</button><button class="btn ${tab==="item"?"on":""}" data-a="shopTab" data-v="item">道具を買う</button><button class="btn ${tab==="sell"?"on":""}" data-a="shopTab" data-v="sell">売る</button></div>${locked?`<p class="warn">配信待ちの間は売買できません。</p>`:""}`;
  if(d.item && ITEMS[d.item]){
    const it=ITEMS[d.item]; const qty=d.qty||1; const own=bagCount(st.bag,d.item);
    if(tab==="item"){ const room=bagRoom(st.bag,d.item); const total=it.price*qty; const can=!locked&&qty<=room&&st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>（${esc(ITEM_RARITY[it.stars])}）</p><p>${esc(itemText(it,Vof(levelOf(st.xp))))}。${it.battleOnly?"戦闘中だけ使えます。":"戦闘中・移動中に使えます。"}</p><p>単価${it.price}ゴールド・所持${own}/${BAG_STACK}</p>${qtyRow(qty,Math.max(1,room))}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${room<=0?(own?"1種類9個までです。":"道具袋が20種類でいっぱいです。"):qty>room?`あと${room}個までしか入りません。`:st.gold<total?"ゴールドが足りません。":""}</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を買う</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`; }
    const unit=it.sell; const can=!locked&&unit>=0&&qty<=own;
    return head+`<p><b>${esc(it.name)}</b>　所持${own}</p>${unit<0?`<p class="warn">この道具は売れません（${esc(ITEM_ACQ[it.acq])}）。</p>`:`<p>買取単価${unit}ゴールド</p>${qtyRow(qty,Math.max(1,own))}<p>受取${unit*qty}ゴールド → 取引後${(st.gold+unit*qty).toLocaleString()}ゴールド</p>`}
      <div class="stack"><button class="btn primary" data-a="shopDo" data-offer="${shopOfferToken(st,d)}" ${can?"":"disabled"}>${esc(it.name)}×${qty}を売る</button><button class="btn" data-a="shopItem" data-v="">一覧へ</button></div>`;
  }
  if(tab==="item"){
    return head+`<div class="stack">${SHOP_ITEMS.map(id=>{const it=ITEMS[id]; return `<button class="btn dexrow" data-a="shopItem" data-v="${id}"><span>${esc(it.name)}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${it.price}ゴールド・${esc(itemText(it,Vof(levelOf(st.xp))))}・所持${bagCount(st.bag,id)}</span></button>`;}).join("")}</div><p class="small">道具袋は20種類まで、1種類9個まで。各県の店で品ぞろえが増えます（この版は福岡の品）。</p>`;
  }
  if(d.item){
    const it=EQUIP[d.item]; const qty=d.qty||1; const own=st.owned[d.item]||0;
    if(tab==="buy"){ const total=it.price*qty; const can=!locked && own+qty<=8 && st.gold>=total;
      return head+`<p><b>${esc(it.name)}</b>：${esc(itemText(it,Vof(levelOf(st.xp))))}</p><p>単価${it.price}ゴールド・所持${own}/8</p>${qtyRow(qty,8-own)}<p>合計${total}ゴールド → 取引後${(st.gold-total).toLocaleString()}ゴールド</p>${can?"":`<p class="warn">${own+qty>8?"所持上限8を超えます。":st.gold<total?"ゴールドが足りません。":""}</p>`}
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
  const max=d.tab==="item"?bagRoom(st.bag,id):d.tab==="buy"?8-own:item?own:availableCount(st,id);
  const unit=d.tab==="sell"?(item?ITEMS[id].sell:Math.floor(EQUIP[id].price/2)):(item?ITEMS[id].price:EQUIP[id].price);
  return {shop:d.shop,tab:d.tab,item:id,qty:d.qty,unit,own,max,gold:st.gold};
}
function shopOfferToken(st,d){ const offer=shopOffer(st,d); return offer?checksum(JSON.stringify(offer)):""; }
function canTradeAtShop(d){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="shop"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&!streamPending()&&isSafe()&&nearbyObjects().some(o=>o.type==="shop"&&o.shop===d.shop); }
function itemText(it,V){ return it.text.replace(/(\d+)×V/g,(m,n)=>String(+n*V)).replace("−防御のダメージ","から敵の防御力を引いたダメージ"); }
function keepFlush(){ const st=G.st; if(!st||G.readOnly||G.screen!=="explore"||G.sheet||G.dlg||st.run||!st.keep||!st.keep.length||!isSafe()) return 0; const n=flushKeep(st); if(n){ commit(); toast(`預かり所から道具を${n}個受け取った。`); } return n; }
function canEditParty(){ return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="party"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe(); }
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
  return `<p class="small">道具袋 ${st.bag.length}/${BAG_KINDS}種類（1種類${BAG_STACK}個まで）。回復・蘇生は移動中にも使えます。</p>
    <div class="stack">${st.bag.map(e=>{const it=ITEMS[e.id]; return `<button class="btn dexrow" data-a="itemView" data-v="${e.id}"><span>${esc(it.name)}　×${e.n}　<span class="small">${"★".repeat(it.stars)}</span></span><span class="small">${esc(itemText(it,Vof(levelOf(st.xp))))}${it.battleOnly?"（戦闘のみ）":""}</span></button>`;}).join("")||`<p>道具を持っていません。ショップで買えます。</p>`}</div>
    ${st.keep&&st.keep.length?`<h3 class="label">宿屋の預かり所（${st.keep.length}/${KEEP_MAX}）</h3><p class="small">袋に空きができると、安全な場所で自動的に受け取ります。</p><ul class="list">${st.keep.map(id=>`<li>${esc(ITEMS[id].name)}</li>`).join("")}</ul>`:""}`;
}
function qtyRow(q,max){ return `<div class="row3"><button class="btn" data-a="shopQty" data-v="${q-1}" ${q>1?"":"disabled"}>−</button><span class="qty">数量 ${q}個（最大${max}個）</span><button class="btn" data-a="shopQty" data-v="${q+1}" ${q<max?"":"disabled"}>＋</button></div>`; }
function renderMoe(){
  const st=G.st; const r=MOE_RANKS[st.moeRank];
  const line = st.moeRank===0?"まずは福岡の声を整えよう。放送塔の丘の奥で、大きな重なりが起きてるみたい。":st.moeRank===1?"北九州の港で、初めての採点配信をしたいな。準備、手伝ってくれる？":st.moeRank===2?"福岡、ありがとう。唐津でも、一人ずつの声に返事をしていきたい。":st.moeRank===3?"唐津の声を聞けたね。次は佐賀市で、街の声をつなごう。":"佐賀市の声も届けられたね。次の旅に向けて準備しよう。";
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
  async continue(){ const s=await loadSave(); if(!s) return toast("記録が見つかりません。"); G.st=migrate(s.state); G.soundWant=null; if(G.st.settings.sound===false&&SND.on) SND.setOn(false); else if(G.st.settings.sound!==false&&!SND.on) SND.setOn(true); if(s.fromPrev) toast("最新の記録が壊れていたため、1つ前の世代から復元しました。");
    if(G.st.run){ G.screen="battle"; SND.play(G.st.run.kind==="boss"?"boss":"battle"); } else if(G.st.stream){ G.screen="stream"; SND.play("stream"); } else { G.screen="explore"; exploreBgm(); }
    render(); },
  toTitle(){ G.sheet=null; G.screen="title"; G.dlg=null; SND.play("title"); render(); },
  openSheet(el){ openSheet(el.dataset.k); }, closeSheet(){ closeSheet(); },
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
  doTravel(){ if(!canTravelFrom("travel")) return; const d=G.sheetData; if(!HUBS[d.to]||curHub()===d.to||!nationalRouteAvailable(G.st,curHub(),d.to)||!nearbyObjects().some(o=>o.type==="gate"&&o.to===d.to&&o.tx===d.tx&&o.ty===d.ty)) return toast("移動先が変わりました。門を調べ直してください。"); G.sheet=null; travelHub(d.to,d.tx,d.ty); },
  worldGo(el){ if(!canTravelFrom("map")) return; const to=el.dataset.v; if(!Object.hasOwn(HUBS,to)||curHub()===to||!nationalRouteAvailable(G.st,curHub(),to)||["KY03","KY04"].includes(to)&&!G.st.visitedHubs.includes(to)) return toast("行先を選び直してください。"); const map=MAPS[to]; if(!map||!Array.isArray(map.safeAnchor)) return toast("この行先にはまだ移動できません。"); const s=map.safeAnchor; G.sheet=null; travelHub(to,s[0],s[1]); },
  doInn(el){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="inn"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; const total=(INN_PRICE[curHub()]||10)*st.roster.length; if(st.gold<total) return toast(`ゴールドが足りません（あと${total-st.gold}）。`); el.disabled=true; G.sheet=null; st.gold-=total; restoreAll(st); st.day++; st.slots=6; commit(); render(); SND.sfx("heal"); say([["",`${total}ゴールドを払って泊まった。`],["",`${st.day}日目の朝。全員の体力と集中力が全回復した！`]]); },
  doRest(){ if(G.readOnly||G.screen!=="explore"||G.sheet!=="rest"||G.dlg||G.st.run||!isSafe()) return; const st=G.st; G.sheet=null; st.day++; st.slots=6; commit(); render(); toast(`${st.day}日目の朝。旅程枠が6に戻った。`); },
  acceptQuest(el){ if(!canManageQuests()) return; const st=G.st, id=el.dataset.v, q=QUESTS[id]; if(!q||st.quests[id]!=="available"||st.activeQuest||curHub()!==q.hub||!isSafe()) return toast("依頼の状態が変わりました。選び直してください。"); if(st.slots<2) return openSheet("rest",{reason:"受注には旅程枠2が必要です。"});
    el.disabled=true;
    st.slots-=2; st.quests[id]="active"; st.activeQuest=id; st.qprog[id]=st.qprog[id]||0; commit(); G.sheet=null; render();
    say([["",`依頼「${id} ${QUESTS[id].name}」を受けた。`],["もえ",id==="M01"?"呼びかけと紹介の順番が重なってる……。始まりと返事の順番を取り戻そう。":id==="M02"?"港の声を、ひとつずつ届けたいな。":id==="M03"?"唐津の海辺で聞いた返事を、配信でも届けたいな。":id==="M04"?"佐賀市の川沿いと駅前で、街の声を集めよう。":"一緒に考えよう。"],["",QUESTS[id].goal]]); },
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
      const next=migrate(o.state); G.auto=false; clearTimeout(G.autoT); G.walk={path:[],prog:0,pending:null}; G.dlg=null; G.cmd={}; G.st=next; await commit(); G.hasSave=true; G.sheet=null; G.screen=G.st.run?"battle":"explore"; render(); toast("記録を読み込みました。"); }
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
  setSupport(el){ if(!canEditParty()||streamPending()) return; const v=el.dataset.v||null; if(v!==null&&!Object.hasOwn(SUPPORTS,v)) return; if(v==="PR01"&&!(G.st.talked.akari&&G.st.quests.M01==="complete"&&G.st.quests.S01==="complete")) return toast("この地域支援はまだ使えません。"); if(v==="PR02"&&!(G.st.talked.karatsuGuide&&G.st.quests.M03==="complete")) return toast("この地域支援はまだ使えません。"); G.st.support=v; commit(); render(); },
  dexNav(el){ const k=el.dataset.k, v=el.dataset.v; if(k==="area"){ G.sheetData={area:v,page:0}; } else if(k==="page"){ G.sheetData.page=+v; } else { G.sheetData.detail=v||null; } render(); drawMiniSprites(); const s=$(".sheet"); if(s) s.scrollTop=0; },
  shopTab(el){ if(G.sheet!=="shop"||!["buy","item","sell"].includes(el.dataset.v)) return; G.sheetData.tab=el.dataset.v; G.sheetData.item=null; render(); },
  shopItem(el){ if(G.sheet!=="shop") return; const id=el.dataset.v||null; if(id&&(!Object.hasOwn(ITEMS,id)&&!Object.hasOwn(EQUIP,id))) return; G.sheetData.item=id; G.sheetData.qty=1; render(); },
  shopQty(el){ if(G.sheet!=="shop") return; const q=Number(el.dataset.v), offer=shopOffer(G.st,G.sheetData); if(!offer||!Number.isSafeInteger(q)||q<1||q>offer.max) return toast("数量を選び直してください。"); G.sheetData.qty=q; render(); },
  shopDo(el){ const st=G.st,d=G.sheetData; if(!canTradeAtShop(d)) return toast("この場所では売買できません。"); const offer=shopOffer(st,d); if(!offer||!el.dataset.offer||el.dataset.offer!==shopOfferToken(st,d)||offer.max<offer.qty||offer.unit<0||!Number.isSafeInteger(offer.unit)||(offer.tab!=="sell"&&st.gold<offer.unit*offer.qty)) return toast("内容が変わりました。商品と数量を選び直してください。");
    el.disabled=true; const q=offer.qty,id=offer.item,it=ITEMS[id]||EQUIP[id];
    if(ITEMS[id]){ if(offer.tab==="sell"){ bagRemove(st.bag,id,q); st.gold+=offer.unit*q; } else { st.gold-=offer.unit*q; bagAdd(st.bag,id,q); } }
    else if(offer.tab==="sell"){ st.owned[id]-=q; st.gold+=offer.unit*q; }
    else { st.gold-=offer.unit*q; st.owned[id]=(st.owned[id]||0)+q; }
    d.item=null; commit(); SND.sfx("buy"); render(); toast(`${it.name}×${q}を${offer.tab==="sell"?"売った":"買った"}。`); },
  replay(el){ G.sheet=null; playScene(el.dataset.v); },
  ssSet(el){ G.sheetData[el.dataset.k]=el.dataset.v; render(); },
  streamStart(){ const st=G.st, d=G.sheetData, qid=streamPending(); if(!st||G.readOnly||G.screen!=="explore"||G.sheet!=="streamSetup"||!qid||QUESTS[qid].hub!==curHub()||!STREAM_REQ[HUBS[curHub()].prefId]||!st.roster.includes(d.host)||!STREAM_THEMES[d.theme]||!["video","voice"].includes(d.style)) return toast("配信の開始条件が変わりました。依頼帳を確認してください。"); st.stream=newStream(st,curHub(),d.host,d.theme,d.style); commit(); G.sheet=null; G.screen="stream"; SND.play("stream"); render(); },
  streamAct(el){ streamAct(el.dataset.v); },
  streamRetry(){ const s=G.st.stream; Object.assign(s,{hand:0,score:0,used:[],themeBonusUsed:false,picks:[],done:false}); commit(); render(); },
  streamLeave(){ G.st.stream=null; commit(); G.screen="explore"; exploreBgm(); render(); },
  streamFinish(){ streamFinish(); }
};
function drawMiniSprites(){
  document.querySelectorAll("canvas[data-char]").forEach(c=>{ const g=c.getContext("2d"); g.clearRect(0,0,16,24); const id=c.dataset.char; g.drawImage(id==="moe"?ART.person("moe",PAL.violet,PAL.cream,0,0,{long:true,ribbon:PAL.coral}):charSprite(id,0,0),0,0); });
  document.querySelectorAll("canvas[data-dex]").forEach(c=>{ const [a,i]=c.dataset.dex.split("|"); const e=enemyDef(a,+i); const g=c.getContext("2d"); g.imageSmoothingEnabled=false; g.drawImage(ART.enemy(e.profile,e.species,e.attr,a,0),0,0); });
}
function validateState(s){
  const okNum=v=>Number.isFinite(v)&&v>=0;
  if(!okNum(s.xp)||!okNum(s.gold)||!okNum(s.tickets)||!MAPS[s.mapId]||!Array.isArray(s.roster)||!Array.isArray(s.party)||s.party.length<1||s.party.length>4||new Set(s.party).size!==s.party.length||s.party.some(c=>!CHARS[c]||!s.roster.includes(c))) throw new Error("bad");
  for(const c of s.party) if(!JOBS[s.jobs[c]]) throw new Error("bad job");
}
function padSide(){ const s=G.st?G.st.settings:G.tmpSettings; if(s&&(s.padSide==="left"||s.padSide==="right")) return s.padSide; try{ const v=localStorage.getItem("tlr-kyushu-pad"); if(v==="left"||v==="right") return v; }catch(e){} return "right"; }
function soundIsOn(){ if(G.soundWant!=null) return G.soundWant; if(G.st&&G.st.settings) return G.st.settings.sound!==false; return soundPref(); }
function soundPref(){ try{ return localStorage.getItem("tlr-kyushu-sound")!=="0"; }catch(e){ return true; } }
function migrate(s){
  if(!s.itemsVersion){ s.bag=INITIAL_ITEMS.map(([id,n])=>({id,n})); s.keep=[]; s.itemsVersion=1; s.gameVersion=GAME_VERSION; }
  if(s.run&&!s.run.bag) s.run.bag=clone(s.bag);
  if(s.run){
    if(!Array.isArray(s.run.itemHistory)){ s.run.itemHistory=[]; s.run.itemHistoryComplete=false; }
    else if(s.run.itemHistoryComplete!==true) s.run.itemHistoryComplete=false;
  }
  if(s.lastResult&&!Array.isArray(s.lastResult.itemsUsed)) s.lastResult.itemsUsed=[];
  if(!Array.isArray(s.battleBadges)) s.battleBadges=[];
  if(s.settings&&s.settings.soundV!==2){ s.settings.sound=true; s.settings.soundV=2; }
  if(s.vitals===undefined) s.vitals=null;
  s.jobs.moe=s.jobs.moe||"J08"; s.jp.moe=s.jp.moe||{}; s.equip.moe=s.equip.moe||{w:null,a:null,acc:null};
  s.settings=Object.assign({difficulty:"std",sound:soundPref(),reduceMotion:false},s.settings||{});
  s.scenes=s.scenes||{}; s.cards=s.cards||[];
  if(!s.quests.M03) s.quests.M03=s.quests.M02==="complete"||s.fukuokaClear?"available":"locked";
  if(!s.quests.M04) s.quests.M04=s.quests.M03==="complete"?"available":"locked";
  return s;
}

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]"); if(!el||el.disabled) return;
  if(el.getAttribute("aria-disabled")==="true") return;
  const f=ACT[el.dataset.a]; if(!f) return;
  if(G.readOnly && !["openSheet","closeSheet","dlgNext","dlgBack","dlgSkip","toTitle","dexNav","partyView","shopTab","shopItem"].includes(el.dataset.a)) return toast("別のタブで遊んでいるため、このタブは閲覧のみです。");
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


