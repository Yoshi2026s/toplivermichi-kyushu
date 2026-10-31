/* 航海の画面・操作。既存の街間移動と通常図鑑は保持する。 */
const oceanBaseWalkable=walkable,oceanBaseZoneAt=zoneAt,oceanBaseInteract=interact,oceanBaseBgm=exploreBgm,oceanBaseStartBattle=startBattle,oceanBaseSafe=isSafe,oceanBaseExplore=renderExplore;
walkable=function(m,x,y){
  if(m.combatDomain!=="sea")return oceanBaseWalkable(m,x,y);
  if(x<0||y<0||x>=m.w||y>=m.h||!"ESP".includes(m.tiles[y]?.[x]||"?"))return false;
  const o=objAt(m,x,y);return !o||!!o.walk;
};
zoneAt=function(m,x,y){
  if(m.combatDomain!=="sea")return oceanBaseZoneAt(m,x,y);
  if(!"ES".includes(m.tiles[y]?.[x]||"?"))return null;
  const o=objAt(m,x,y);return o?.walk?null:m.encountersByCell[`${x},${y}`]||null;
};
interact=function(o){
  if(o?.oceanRoute){
    if(!G.st||G.readOnly||G.screen!=="explore"||G.st.run||G.dlg||G.lock)return;
    if(!MAPS[G.st.mapId].objects.includes(o)||Math.max(Math.abs(o.x-G.st.pos.x),Math.abs(o.y-G.st.pos.y))>1)return;
    if(!oceanRouteAvailable(G.st,o.oceanRoute))return say([["港の案内人",`この航路は「${QUESTS[OCEAN_ROUTES[o.oceanRoute].quest].name}」の完了後に出航できます。港と街は安全。航路E・海辺Sでは海洋モンスターに遭遇します。`]]);
    SND.sfx("seaWave");
  }
  if(o?.type==="oceanEvent"){
    if(!G.st||G.readOnly||G.screen!=="explore"||G.st.run||G.dlg||G.lock)return;
    if(!MAPS[G.st.mapId].objects.includes(o)||Math.max(Math.abs(o.x-G.st.pos.x),Math.abs(o.y-G.st.pos.y))>1)return;
    return openSheet("ocean",{area:o.oceanArea,returnTo:"guide"});
  }
  return oceanBaseInteract(o);
};
exploreBgm=function(){const m=G.st&&MAPS[G.st.mapId];if(m?.combatDomain==="sea")return SND.play(OCEAN_ROUTES[m.oceanRoute].bgm);return oceanBaseBgm();};
startBattle=function(run){if(run?.oceanArea?currentOceanArea(G.st)!==run.oceanArea:MAPS[G.st?.mapId]?.combatDomain==="sea")return;const result=oceanBaseStartBattle(run);if(G.st?.run===run&&run?.oceanArea)SND.play("seaBattle");return result;};
isSafe=function(){const m=MAPS[G.st.mapId];return m?.combatDomain==="sea"?m.tiles[G.st.pos.y]?.[G.st.pos.x]==="P":oceanBaseSafe();};
renderExplore=function(){const html=oceanBaseExplore(),m=MAPS[G.st.mapId];return m?.combatDomain==="sea"&&isSafe()?html.replace('<span class="tag danger">街外の道</span>','<span class="tag safe">安全な港</span>'):html;};

const oceanBaseOpenSheet=openSheet,oceanBaseCloseSheet=closeSheet,oceanBaseRenderSheet=renderSheet,oceanBaseRenderDex=renderDex,oceanBaseMini=drawMiniSprites;
openSheet=function(k,d={}){if(G.oceanSaving)return;return oceanBaseOpenSheet(k,d);};
closeSheet=function(){if(G.oceanSaving)return;return oceanBaseCloseSheet();};
function oceanDefaultArea(){
  if(G.sheetData.area&&OCEAN_AREAS[G.sheetData.area])return G.sheetData.area;
  return currentOceanArea(G.st)||Object.values(OCEAN_ROUTES).find(r=>r.hub===curHub())?.areas[0]||Object.keys(OCEAN_AREAS)[0];
}
function oceanSheetWrap(title,html){return sheetWrap(title,html).replace('data-a="closeSheet"','data-a="oceanBack"');}
function oceanOverview(){
  const st=G.st,id=oceanDefaultArea(),a=OCEAN_AREAS[id],r=oceanAreaRecord(st,id),route=OCEAN_ROUTES[a.routeId],pending=G.sheetData.pendingEvent;
  const eventLabels={rescue:"漂流者を救助",survey:"海洋敵の調査報告",treasure:"灯台と漂着宝箱"};
  const localMap=MAPS[st.mapId],atSea=localMap.combatDomain==="sea";
  const eventCards=Object.entries(eventLabels).map(([key,label])=>{
    const status=oceanEventAvailability(st,id,key,{readOnly:G.readOnly,busy:!!G.lock||!!G.oceanSaving});
    return `<div class="qcard"><b>${r[key]?"● 完了":"○ 未完了"} ${label}</b><p class="small">${key==="survey"?"同じ海域の海洋敵3体を討伐して報告。報酬：応援ポイント60。":key==="treasure"?"この海域で救助後、灯台の地図を調べる。報酬：120G。":"この海域の海面か案内標で救助。報酬：80G。"}</p>${r[key]?"":`<button class="btn" data-a="oceanEventSelect" data-area="${id}" data-event="${key}" ${status.ok?"":"disabled"}>${label}の確認</button>${status.ok?"":`<p class="small">${esc(status.reason)}</p>`}`}</div>`;
  }).join("");
  return `<p class="small">港と街は安全です。船は指定された航路E・海辺Sだけを進みます。未指定の水面には入れません。既存の街道・物語の条件は変わりません。</p>
    <h3 class="label">${esc(a.name)}</h3><p>適正レベル${a.q}・海洋敵討伐${r.kills}/3体・${esc(OCEAN_THEMES[a.region].name)}</p><p class="small">${esc(a.lore)}</p>
    <div class="srow">${OCEAN_SPECIES.map((name,f)=>`<span><canvas data-ocean-sprite="${id}|${f*10}" width="64" height="64" style="width:48px;height:48px;image-rendering:pixelated" aria-hidden="true"></canvas><br><span class="small">${name}</span></span>`).join("")}</div>
    ${pending&&G.sheetData.opState===st?`<div class="qcard"><b>${esc(eventLabels[pending.event])}を実行します</b><p class="small">報酬はこの海域で一度だけです。</p><button class="btn primary" data-a="oceanEventDo" data-area="${pending.area}" data-event="${pending.event}" data-token="${esc(pending.token)}" ${G.oceanSaving?"disabled":""}>確定する</button><button class="btn" data-a="oceanEventCancel" ${G.oceanSaving?"disabled":""}>やめる</button></div>`:eventCards}
    <button class="btn" data-a="oceanDexOpen" data-area="${id}">海洋モンスター図鑑（65海域・3,250項目）</button>
    ${atSea&&localMap.oceanRoute===a.routeId?`<button class="btn" data-a="oceanMoveArea" data-area="${id}" ${G.readOnly?"disabled":""}>${esc(a.name)}の海面へ歩く</button>`:""}
    <details class="ocean-area-picker"><summary>海域を選ぶ（65海域）</summary>${Object.values(OCEAN_ROUTES).map(v=>`<h3 class="label">${esc(OCEAN_THEMES.find(t=>t.id===v.theme).name)}</h3><div class="stack">${v.areas.map(k=>`<button class="btn ${k===id?"on":""}" data-a="oceanArea" data-area="${k}">${esc(OCEAN_AREAS[k].name)}・Lv${OCEAN_AREAS[k].q}</button>`).join("")}</div>`).join("")}</details>
    <h3 class="label">8地方の新航路</h3><div class="stack">${Object.values(OCEAN_ROUTES).map(v=>{
      const unlocked=oceanRouteAvailable(st,v.id),atPort=st.mapId===v.hub;
      return `<div class="qcard"><b>${esc(v.name)}</b><p class="small">${esc(HUBS[v.hub].name)}の港／${unlocked?"解放済み":`「${esc(QUESTS[v.quest].name)}」完了で解放`}。港1・指定海面27区画。</p><button class="btn" data-a="oceanDepart" data-route="${v.id}" ${unlocked&&atPort&&!G.readOnly?"":"disabled"}>港まで歩いて出発</button>${atPort?"":`<p class="small">${esc(HUBS[v.hub].name)}の街から出発します。</p>`}</div>`;
    }).join("")}</div><p class="small">現在の航路：${atSea?esc(OCEAN_ROUTES[localMap.oceanRoute].name):"陸上"}。戻るとオート移動へ戻ります。</p>`;
}
function oceanDexHtml(){
  const st=G.st,id=oceanDefaultArea(),a=OCEAN_AREAS[id],page=Math.max(0,Math.min(4,Number(G.sheetData.page)||0)),seen=Object.keys(st.seen||{}).filter(k=>k.startsWith("OCN-")).length;
  return `<p>海洋図鑑 ${seen}/${OCEAN_ENEMY_COUNT}項目</p><h3 class="label">${esc(a.name)}（${esc(OCEAN_THEMES[a.region].name)}）</h3><p class="small">出現場所：航路・海辺。推奨レベル${a.q}。港は安全です。</p>
    <div class="row3"><button class="btn" data-a="oceanDexPage" data-page="${page-1}" ${page>0?"":"disabled"}>前の10件</button><span role="status">${page+1}/5ページ</span><button class="btn" data-a="oceanDexPage" data-page="${page+1}" ${page<4?"":"disabled"}>次の10件</button></div>
    <div class="stack">${Array.from({length:10},(_,i)=>{
      const idx=page*10+i,e=oceanEnemyDef(id,idx),known=!!st.seen[e.id];
      return `<div class="qcard"><canvas data-ocean-sprite="${id}|${idx}" width="64" height="64" style="width:64px;height:64px;image-rendering:pixelated" aria-hidden="true"></canvas><b>${known?"● 遭遇済み":"○ 未遭遇"} ${esc(e.name)}</b><p class="small">${esc(e.species)}系・成長${e.stage}/10・推奨レベル${e.q}・討伐${st.killCount[e.id]||0}体</p><p class="small">${esc(e.trait)} ${esc(e.counter)}</p></div>`;
    }).join("")}</div><details class="ocean-area-picker"><summary>別の海域を選ぶ</summary><div class="stack">${Object.values(OCEAN_AREAS).map(v=>`<button class="btn" data-a="oceanDexArea" data-area="${v.id}">${esc(v.name)}</button>`).join("")}</div></details>`;
}
renderSheet=function(){
  if(G.sheet==="ocean")return oceanSheetWrap("航海・海上イベント",oceanOverview());
  if(G.sheet==="oceanDex")return oceanSheetWrap("海洋モンスター図鑑",oceanDexHtml());
  const html=oceanBaseRenderSheet();
  return G.sheet==="guide"?html.replace('<div class="stack">','<div class="stack"><button class="btn" data-a="oceanOpen">航海・海上イベント</button>'):html;
};
renderDex=function(){
  if(OCEAN_AREAS[G.sheetData.area])return oceanDexHtml();
  return oceanBaseRenderDex();
};
drawMiniSprites=function(){
  oceanBaseMini();
  document.querySelectorAll("canvas[data-ocean-sprite]").forEach(c=>{const [id,idx]=c.dataset.oceanSprite.split("|"),e=oceanEnemyDef(id,Number(idx)),g=c.getContext("2d");g.imageSmoothingEnabled=false;g.clearRect(0,0,c.width,c.height);g.drawImage(oceanEnemySprite(e.theme,e.family,0,64),0,0,c.width,c.height);});
};
const oceanBaseDrawMap=drawMap,oceanBaseCharSprite=charSprite;
drawMap=function(){G.oceanDrawing=MAPS[G.st?.mapId]?.combatDomain==="sea";try{return oceanBaseDrawMap();}finally{G.oceanDrawing=false;}};
charSprite=function(cid,dir,frame){if(G.oceanDrawing){if(cid===G.st.party[0])return oceanShipSprite(dir,frame);return oceanEmptySprite();}return oceanBaseCharSprite(cid,dir,frame);};
if(typeof ART!=="undefined")installOceanArt();
function oceanUiCanAct(){return !!G.st&&!G.readOnly&&G.screen==="explore"&&G.sheet==="ocean"&&!G.st.run&&!G.dlg&&!G.lock&&!G.walk.path.length&&!G.oceanSaving&&!document.hidden;}
Object.assign(ACT,{
  oceanOpen(){if(G.screen!=="explore"||G.dlg||G.st?.run)return;openSheet("ocean",{returnTo:"guide"});},
  oceanBack(){if(G.oceanSaving)return;if(G.sheetHistory?.length)return closeSheet();if(G.sheet==="oceanDex")return openSheet("ocean",{area:oceanDefaultArea(),returnTo:"guide"});if(G.sheet==="ocean")return openSheet("guide");},
  oceanArea(el){if(G.sheet!=="ocean"||G.oceanSaving||!Object.hasOwn(OCEAN_AREAS,el.dataset.area))return;G.sheetData={area:el.dataset.area,returnTo:"guide"};render();},
  oceanDexOpen(el){if(!["ocean","dex"].includes(G.sheet)||!Object.hasOwn(OCEAN_AREAS,el.dataset.area))return;openSheet("oceanDex",{area:el.dataset.area,page:0});},
  oceanDexPage(el){if(!["oceanDex","dex"].includes(G.sheet))return;const p=Number(el.dataset.page);if(!Number.isInteger(p)||p<0||p>4)return;G.sheetData.page=p;render();},
  oceanDexArea(el){if(!["oceanDex","dex"].includes(G.sheet)||!Object.hasOwn(OCEAN_AREAS,el.dataset.area))return;G.sheetData={area:el.dataset.area,page:0};render();},
  oceanDepart(el){if(!oceanUiCanAct())return;const r=OCEAN_ROUTES[el.dataset.route];if(!r||G.st.mapId!==r.hub||!oceanRouteAvailable(G.st,r.id))return toast("現在の街の解放済み航路から出発してください。");G.sheet=null;render();walkTo(r.dock[0],r.dock[1]);},
  oceanMoveArea(el){if(!oceanUiCanAct())return;const a=OCEAN_AREAS[el.dataset.area],m=MAPS[G.st.mapId];if(!a||m.oceanRoute!==a.routeId||!oceanRouteAvailable(G.st,a.routeId))return;G.sheet=null;render();walkTo(a.point[0],a.point[1]);},
  oceanEventSelect(el){if(!oceanUiCanAct())return;const id=el.dataset.area,event=el.dataset.event,can=oceanEventAvailability(G.st,id,event);if(!can.ok)return toast(can.reason);G.sheetData.pendingEvent={area:id,event,token:oceanEventToken(G.st,id,event)};G.sheetData.opState=G.st;render();},
  oceanEventCancel(){if(G.sheet!=="ocean"||G.oceanSaving)return;delete G.sheetData.pendingEvent;delete G.sheetData.opState;render();},
  async oceanEventDo(el){
    if(!oceanUiCanAct())return;const st=G.st,d=G.sheetData,p=d.pendingEvent,id=el.dataset.area,event=el.dataset.event;
    if(!p||d.opState!==st||p.area!==id||p.event!==event||el.dataset.token!==p.token||p.token!==oceanEventToken(st,id,event))return toast("イベントの状態が変わりました。確認し直してください。");
    const before={gold:st.gold,tickets:st.tickets,ocean:st.ocean===undefined?undefined:clone(st.ocean)},result=claimOceanEvent(st,id,event);
    if(!result.ok)return toast(result.reason);el.disabled=true;G.oceanSaving=true;
    let saved=false;try{saved=await commit();}catch(e){}
    G.oceanSaving=false;
    if(!saved){st.gold=before.gold;st.tickets=before.tickets;if(before.ocean===undefined)delete st.ocean;else st.ocean=before.ocean;delete d.pendingEvent;delete d.opState;render();return toast("保存できなかったため、イベントと報酬を元に戻しました。保存先の空きを確認して再試行してください。");}
    delete d.pendingEvent;delete d.opState;render();SND.sfx(event==="rescue"?"seaRescue":event==="treasure"?"seaTreasure":"ok");say([...result.lines,["",`${result.gold?`${result.gold}ゴールド`:"応援ポイント60"}を受け取った。この海域では受取済みとして保存した。`]]);
  }
});
