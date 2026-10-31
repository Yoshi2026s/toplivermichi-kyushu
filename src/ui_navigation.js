/* 行先・依頼・操作の補助。検索条件と移動予定は実行中だけ保持し、セーブ形式は変えない。 */
const NAV_UI={state:null,serial:0,guide:{filter:'priority',query:'',page:0},quests:{filter:'local',query:'',page:0}};
const NAV_GUIDE_FILTERS=[['priority','おすすめ'],['all','近い順'],['facility','施設'],['people','住人'],['treasure','宝箱'],['exit','街・出口'],['boss','ボス']];
const NAV_QUEST_FILTERS=[['local','今いる街'],['active','受注中'],['available','受注可能'],['main','本編'],['complete','完了'],['all','すべて']];
function navigationView(key=G.sheet){
 if(NAV_UI.state!==G.st){NAV_UI.state=G.st;NAV_UI.guide={filter:'priority',query:'',page:0};NAV_UI.quests={filter:'local',query:'',page:0};NAV_UI.serial++;}
 return NAV_UI[key==='quests'?'quests':'guide'];
}
function navigationWords(value){return String(value||'').normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);}
function navigationMatches(value,query){const hay=String(value).normalize('NFKC').toLocaleLowerCase();return navigationWords(query).every(w=>hay.includes(w));}
function navigationDistances(m,pos=G.st.pos){
 const distances=new Map([[pos.y*m.w+pos.x,0]]),queue=[[pos.x,pos.y]];
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i],d=distances.get(y*m.w+x);
  for(const [dx,dy] of [[0,1],[0,-1],[-1,0],[1,0]]){const nx=x+dx,ny=y+dy,key=ny*m.w+nx;if(nx<0||ny<0||nx>=m.w||ny>=m.h||distances.has(key)||!walkable(m,nx,ny))continue;
   distances.set(key,d+1);const o=objAt(m,nx,ny);if(!(o?.walk&&o.to))queue.push([nx,ny]);
  }
 }
 return distances;
}
function navigationDistance(m,o,distances){
 if(o.walk)return distances.get(o.y*m.w+o.x)??Infinity;
 return Math.min(...[[0,1],[0,-1],[-1,0],[1,0]].map(([dx,dy])=>o.x+dx<0||o.y+dy<0||o.x+dx>=m.w||o.y+dy>=m.h?Infinity:distances.get((o.y+dy)*m.w+o.x+dx)??Infinity));
}
function navigationCategory(o){return o.fieldExit||o.fieldRoute||['gate','station','door'].includes(o.type)?'exit':o.type==='npc'?'people':o.type==='box'?'treasure':o.type==='boss'?'boss':'facility';}
function navigationRows(m=MAPS[G.st.mapId]){
 const st=G.st,distances=navigationDistances(m),low=st.party.some(cid=>{const v=vitalOf(cid),s=charStats(st,cid,levelOf(st.xp,st));return v.hp<s.maxHP*.65||v.c<s.startC*.25;});
 return m.objects.filter(o=>o.type!=='tower'&&o.type!=='sign').map(o=>{
  const category=navigationCategory(o),steps=navigationDistance(m,o,distances);let status='',rank=20;
  if(o.type==='npc'){status=st.talked[o.npc]?'会話済み':'まだ話していません';rank=st.talked[o.npc]?35:10;}
  if(o.type==='box'){status=st.boxes[o.box]?'開封済み':'未開封・条件は現地で確認';rank=st.boxes[o.box]?50:12;}
  if(o.type==='inn'){const cost=(INN_PRICE[m.hub]||10)*st.roster.length;status=(low?'回復をおすすめ・':'')+`宿泊${cost}G`+(st.gold<cost?`（あと${cost-st.gold}G）`:'');rank=low?0:18;}if(o.type==='rest'){status='翌朝まで休む';rank=25;}
  if(o.type==='shop'){status='道具・装備を補充';rank=15;}
  if(o.type==='boss'){const q=Object.entries(QUESTS).find(([,q])=>q.boss===o.boss);status=st.bossDefeated[o.boss]?'討伐済み':q&&st.quests[q[0]]==='bossReady'?'挑戦できます':'依頼の進行が必要';rank=status==='挑戦できます'?0:45;}
  if(o.fieldExit){status=m.kind==='town'?'街外の探索へ':'安全な街へ';rank=st.activeQuest&&m.kind==='town'?1:16;}
  if(o.fieldRoute){const available=nationalRouteAvailable(st,m.hub,o.toHub);status=available?'隣の街への街道':'未解放の道';rank=available?25:55;}
  return {o,category,steps,status,rank};
 });
}
function navigationToolbar(key,filters){const d=navigationView(key);return `<div class="nav-filters" role="group" aria-label="絞り込み">${filters.map(([id,label])=>`<button class="btn" data-a="navFilter" data-v="${id}" aria-pressed="${d.filter===id}">${label}</button>`).join('')}</div><form class="nav-search" data-nav-search><label class="sr-only" for="navSearchInput">${key==='guide'?'行先':'依頼'}を検索</label><input class="input" id="navSearchInput" maxlength="64" autocomplete="off" value="${esc(d.query)}" placeholder="名前・種類・地域を検索"><button type="submit" class="btn">検索</button><button type="button" class="btn" data-a="navClear">解除</button></form>`;}
function navigationPage(key,rows){const d=navigationView(key),pages=Math.max(1,Math.ceil(rows.length/6));d.page=Math.max(0,Math.min(pages-1,d.page));return {rows:rows.slice(d.page*6,d.page*6+6),html:`<div class="nav-pages"><button class="btn" data-a="navPage" data-v="${d.page-1}" ${d.page?'':'disabled'}>前へ</button><span role="status" aria-live="polite">${rows.length}件・${d.page+1}／${pages}</span><button class="btn" data-a="navPage" data-v="${d.page+1}" ${d.page+1<pages?'':'disabled'}>次へ</button></div>`};}
function navigationValidPlan(){const p=G.walkPlan;return p&&p.state===G.st&&p.map===G.st?.mapId?p:null;}
function navigationPlanControls(){const p=navigationValidPlan();if(!p)return '';const paused=p.paused||!G.walk.path.length;return `<div class="nav-plan"><b>${paused?'一時停止':'移動中'}：${esc(p.label||'選んだ地点')}</b><div class="srow"><button class="btn" data-a="${paused?'travelResume':'travelPause'}" data-v="${p.version}" ${G.readOnly?"disabled":""}>${paused?'再開':'一時停止'}</button><button class="btn" data-a="travelCancel" data-v="${p.version}">取り消す</button></div></div>`;}
function navigationRecommendedQuest(){const st=G.st;if(st.activeQuest&&QUESTS[st.activeQuest])return st.activeQuest;return Object.keys(QUESTS).filter(id=>st.quests[id]==='available').sort((a,b)=>(QUESTS[b].hub===curHub()?1:0)-(QUESTS[a].hub===curHub()?1:0)||(QUESTS[b].main?1:0)-(QUESTS[a].main?1:0))[0]||null;}
function navigationQuestShortcut(token){const id=navigationRecommendedQuest();if(!id)return '';const target=navigationQuestTarget(id);return `<div class="nav-goal"><b>次にすること：${esc(QUESTS[id].name)}</b>${target?`<button class="btn" data-a="navQuestGo" data-v="${id}" data-map="${esc(G.st.mapId)}" data-nav-token="${token}" ${G.readOnly?'disabled':''}>${esc(target.label)}へ（${target.steps}歩）</button>`:'<button class="btn" data-a="openSheet" data-k="quests">依頼を確認・受注する</button>'}</div>`;}
function renderNavigationGuide(){
 const m=MAPS[G.st.mapId],d=navigationView('guide');NAV_UI.serial++;const token=NAV_UI.serial;
 const rows=navigationRows(m).filter(r=>(['priority','all'].includes(d.filter)||r.category===d.filter)&&navigationMatches(r.o.label+' '+r.status+' '+({shop:'道具屋 道具店 装備',inn:'宿屋 宿 回復',jobcenter:'職業 転職 ハローワーク',rest:'休憩 回復',npc:'住人',box:'宝箱',boss:'ボス 砦',station:'駅 新幹線'})[r.o.type]+' '+(r.category==='exit'?'出口 街':'')+' '+m.name,d.query));
 rows.sort((a,b)=>Number.isFinite(b.steps)-Number.isFinite(a.steps)||(d.filter==='priority'?a.rank-b.rank:0)||a.steps-b.steps||a.o.label.localeCompare(b.o.label,'ja'));
 const page=navigationPage('guide',rows);
 return `<p class="small">${esc(m.name)}。実際に歩く距離で並びます。街外では敵と遭遇することがあります。</p>${navigationPlanControls()}${navigationQuestShortcut(token)}${navigationToolbar('guide',NAV_GUIDE_FILTERS)}${page.html}<div class="nav-results">${page.rows.map(({o,steps,status})=>`<button class="btn nav-destination" data-a="guideTo" data-v="${esc(o.id)}" data-map="${esc(G.st.mapId)}" data-nav-token="${token}" ${!Number.isFinite(steps)||G.readOnly?'disabled':''}><b>${esc(o.label)}</b><span>${Number.isFinite(steps)?steps?`${steps}歩`:'すぐ近く':'歩ける経路なし'}${status?'・'+esc(status):''}</span></button>`).join('')||'<p>見つかりません。</p><button class="btn" data-a="navReset">検索条件をリセット</button>'}</div><div class="nav-shortcuts"><button class="btn" data-a="openSheet" data-k="quests">やる事</button><button class="btn" data-a="openSheet" data-k="jobcenter">ハローワーク</button><button class="btn" data-a="openSheet" data-k="ocean">航海・海上イベント</button>${m.kind==='field'&&!m.combatDomain?'<button class="btn" data-a="openSheet" data-k="training">街外の実技チャレンジ</button>':''}</div>`;
}
function navigationQuestTarget(id){
 const st=G.st,q=QUESTS[id],m=MAPS[st.mapId];if(!q||['locked','complete'].includes(st.quests[id]))return null;
 let o;
 if(m.kind==='in'||m.combatDomain==='sea')o=m.objects.find(o=>o.oceanReturn||o.type==='door');
 else if(q.hub!==m.hub){
  const itinerary=nationalItinerary(st,m.hub,q.hub);if(!itinerary||itinerary.length<2)return null;
  o=m.kind==='town'?m.objects.find(o=>o.fieldExit):m.objects.find(o=>o.fieldRoute&&o.toHub===itinerary[1]);
  if(o?.fieldRoute&&!nationalRouteAvailable(st,m.hub,o.toHub))return null;
 }else if(st.quests[id]==='available'){if(m.kind==='town')return null;o=m.objects.find(o=>o.fieldExit);}
 else if(m.kind==='town')o=m.objects.find(o=>o.fieldExit);
 else if(st.quests[id]==='bossReady')o=m.objects.find(o=>o.boss===q.boss);
 else{
  const distances=navigationDistances(m);let best=null;
  for(let y=1;y<m.h-1;y++)for(let x=1;x<m.w-1;x++){if(!m.zones[m.tiles[y][x]]||objAt(m,x,y)||!walkable(m,x,y))continue;const steps=distances.get(y*m.w+x);if(steps!==undefined&&steps>0&&(!best||steps<best.steps))best={x,y,steps,label:'街外の探索区域',walk:true};}
  return best;
 }
 if(!o)return null;const steps=navigationDistance(m,o,navigationDistances(m));return Number.isFinite(steps)?{...o,steps}:null;
}
function renderNavigationQuests(){
 const st=G.st,d=navigationView('quests'),hub=curHub(),labels={locked:'未解放',available:'受注可能',active:'受注中',bossReady:'ボスに挑戦',complete:'完了'};NAV_UI.serial++;const token=NAV_UI.serial;
 let rows=Object.entries(QUESTS).filter(([id,q])=>{const status=st.quests[id]||'locked';return (d.filter==='all'||d.filter==='local'&&(q.hub===hub||id===st.activeQuest)||d.filter==='active'&&id===st.activeQuest||d.filter==='available'&&status==='available'||d.filter==='main'&&q.main||d.filter==='complete'&&status==='complete')&&navigationMatches(`${id} ${q.name} ${q.goal} ${HUBS[q.hub].name} ${q.main?"本編":"任意"} ${labels[status]}`,d.query);});
 const rank=id=>id===st.activeQuest?-1:({bossReady:0,active:1,available:2,locked:3,complete:4})[st.quests[id]||'locked'];rows.sort((a,b)=>rank(a[0])-rank(b[0])||(a[1].hub===hub?-1:0)-(b[1].hub===hub?-1:0));const page=navigationPage('quests',rows);
 return `<p class="small">本編 ${Object.entries(QUESTS).filter(([id,q])=>q.main&&st.quests[id]==='complete').length}/${Object.values(QUESTS).filter(q=>q.main).length}件完了。受注は同時に1件。案内は次の地点まで歩きます。</p>${navigationToolbar('quests',NAV_QUEST_FILTERS)}${page.html}${page.rows.map(([id,q])=>{const status=st.quests[id]||'locked',target=navigationQuestTarget(id),canAccept=status==='available'&&!G.readOnly&&!st.activeQuest&&q.hub===hub&&isSafe();return `<article class="qcard nav-quest ${status}"><div class="srow"><b>${esc(q.name)}</b><span class="tag">${labels[status]}</span></div><p class="small">${esc(HUBS[q.hub].name)}・${q.main?'本編':'任意'}${['active','bossReady','complete'].includes(status)?`・討伐 ${Math.min(st.qprog[id]||0,q.kills)}/${q.kills}（残り${Math.max(0,q.kills-(st.qprog[id]||0))}体）`:''}</p>${status==='available'?`<button class="btn primary" data-a="acceptQuest" data-v="${id}" ${canAccept?'':'disabled'}>受注する</button>${canAccept?'':`<p class="small">${G.readOnly?'閲覧中のため受注・変更はできません。':st.activeQuest?'ほかの依頼を受注中です。':esc(HUBS[q.hub].name)+'の街で受注できます。'}</p>`}`:''}${target?`<button class="btn" data-a="navQuestGo" data-v="${id}" data-map="${esc(st.mapId)}" data-nav-token="${token}" ${G.readOnly?'disabled':''}>次の目的地へ：${esc(target.label)}（${target.steps}歩）</button>`:''}<details><summary>依頼の内容・操作</summary><p>${esc(q.goal)}</p>${status==='locked'?`<p class="small">${q.requires?'先に「'+esc(QUESTS[q.requires]?.name||q.requires)+'」を完了してください。':'前の依頼や街の会話を進めると解放されます。'}</p>`:''}${id===st.activeQuest?`<button class="btn" data-a="navAbandon" data-v="${id}" ${G.readOnly?"disabled":""}>依頼を放棄する…</button>`:''}</details></article>`;}).join('')||'<p>条件に合う依頼はありません。</p><button class="btn" data-a="navReset">検索条件をリセット</button>'}`;
}
function updateNavigationHud(){
 if(G.readOnly&&navigationValidPlan()){G.walkPlan.paused=true;G.walk.path=[];G.walk.pending=null;}
 const el=document.querySelector('#navRoute');if(!el)return;const p=navigationValidPlan();el.hidden=!p;if(!p)return;
 const paused=p.paused||!G.walk.path.length;
 if(!el.querySelector('[data-route-name]'))el.innerHTML='<span><b data-route-state></b> <span data-route-name></span><small data-route-steps></small></span><button class="btn" data-route-toggle></button><button class="btn" data-route-cancel data-a="travelCancel" aria-label="目的地を取り消す">取消</button>';
 el.querySelector('[data-route-state]').textContent=G.readOnly?'閲覧中':paused?'一時停止':'移動中';el.querySelector('[data-route-name]').textContent=p.label||'選んだ地点';el.querySelector('[data-route-steps]').textContent=paused?'現在地から道を調べ直して再開':`残り ${G.walk.path.length}歩`;
 const toggle=el.querySelector('[data-route-toggle]'),cancel=el.querySelector('[data-route-cancel]');toggle.dataset.a=paused?'travelResume':'travelPause';toggle.dataset.v=cancel.dataset.v=String(p.version);toggle.disabled=cancel.disabled=G.readOnly;toggle.textContent=paused?'再開':'停止';
}
function updateControlHints(){
 const confirm=document.querySelector('#dock .stick-confirm'),back=document.querySelector('#dock .dock-back');if(!confirm||!back)return;let a='決定',b='戻る';
 if(G.dlg){a=G.dlg.i<G.dlg.lines.length-1?'次へ':'閉じる';b=G.dlg.i>0?'前へ':G.dlg.after||G.dlg.sceneId?'戻る':'閉じる';}
 else if(G.screen==='explore'&&!G.sheet){const p=navigationValidPlan();a=p&&(p.paused||!G.walk.path.length)?'再開':G.walk.path.length?'停止':nearbyObjects().length?'調べる':'案内';b=p&&!p.paused?'停止':'戻る';}
 else if(G.screen==='battle'&&!G.sheet){a=G.auto?'決定':document.querySelector('.cmd [data-a="confirmAct"]:not([disabled])')?'確定':'選ぶ';b=G.auto?'中断':!G.cmd?.type?'休止':'戻る';}
 else if(G.screen==='result'&&!G.sheet)a='MAPへ';
 back.disabled=!!(G.dlg&&(G.dlg.i||0)===0&&(G.dlg.after||G.dlg.sceneId));confirm.textContent=a;confirm.setAttribute('aria-label',a);back.textContent=b;back.setAttribute('aria-label',b);
}
function manualTravelOverride(){if(!G.walkPlan)return;G.walkPlan=null;G.walk.path=G.walk.path.slice(0,1);G.walk.pending=null;updateNavigationHud();updateControlHints();}
function navigationReleaseOnContextChange(){const next={state:G.st,screen:G.screen,sheet:G.sheet,dialog:G.dlg,run:G.st?.run,readonly:G.readOnly},old=NAV_UI.inputContext;if(old&&Object.keys(next).some(k=>next[k]!==old[k])&&typeof PAD!=='undefined')PAD.release?.();NAV_UI.inputContext=next;}
const navigationBaseScene=playScene;
playScene=function(id,after){const result=navigationBaseScene(id,after);if(G.dlg)G.dlg.sceneId=id;updateControlHints();return result;};
const navigationBaseRender=render,navigationBaseSheet=renderSheet,navigationBaseWalk=walkTo,navigationBaseArrive=arrive,navigationBaseOpen=openSheet;
render=function(){navigationReleaseOnContextChange();if(G.walkPlan&&G.screen==='explore'&&!G.st?.run&&(G.walkPlan.state!==G.st||G.walkPlan.map!==G.st.mapId))G.walkPlan=null;G.controlEpoch=(G.controlEpoch||0)+1;const result=navigationBaseRender();if(G.sheet==='navAbandon'){const cancel=document.querySelector('[data-nav-cancel]');if(cancel){document.querySelectorAll('.kfocus').forEach(e=>e.classList.remove('kfocus'));cancel.classList.add('kfocus');cancel.focus({preventScroll:true});G.cursorSig=null;}}updateNavigationHud();updateControlHints();return result;};
renderSheet=function(){if(G.sheet==='guide'&&G.st)return sheetWrap('オート移動',renderNavigationGuide());if(G.sheet==='quests'&&G.st)return sheetWrap('やる事',renderNavigationQuests());if(G.sheet==='navAbandon')return sheetWrap('依頼を放棄する',`<p>「${esc(QUESTS[G.sheetData.id]?.name||"この依頼")}」の討伐数${G.st.qprog[G.sheetData.id]||0}を0に戻します。受注費は戻りません。</p><button class="btn" data-nav-cancel data-a="closeSheet">続ける・戻る</button><button class="btn" data-a="navAbandonDo" data-v="${esc(G.sheetData.id)}" data-nav-token="${G.sheetData.token}" ${G.readOnly?"disabled":""}>放棄する</button>`);return navigationBaseSheet();};
openSheet=function(key,data){if(navigationValidPlan()&&G.walk.path.length)G.walkPlan.paused=true;return navigationBaseOpen(key,data);};
walkTo=function(x,y,pending){
 if(G.st&&G.screen==='explore'&&!G.readOnly){const m=MAPS[G.st.mapId],o=objAt(m,x,y);if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=m.w||y>=m.h||!o&&!walkable(m,x,y))return toast('そこへは行けません。');if(x===G.st.pos.x&&y===G.st.pos.y){manualTravelOverride();return;}const adjacent=o&&!o.walk&&Math.max(Math.abs(x-G.st.pos.x),Math.abs(y-G.st.pos.y))<=1;if(!adjacent&&!bfs(m,G.st.pos.x,G.st.pos.y,(px,py)=>o&&!o.walk?Math.abs(px-x)+Math.abs(py-y)===1:px===x&&py===y,true))return toast('歩ける経路がありません。');}
 const result=navigationBaseWalk(x,y,pending);if(navigationValidPlan()&&!G.walk.path.length&&!G.st.run)G.walkPlan=null;updateNavigationHud();updateControlHints();return result;};
arrive=function(){const sheet=G.sheet,dialog=G.dlg;const result=navigationBaseArrive();const p=G.walkPlan;if(p&&!G.st?.run&&(p.state!==G.st||p.map!==G.st.mapId||!G.walk.path.length&&Math.abs(G.st.pos.x-p.x)+Math.abs(G.st.pos.y-p.y)<=1&&(!p.paused||G.sheet!==sheet||G.dlg!==dialog)))G.walkPlan=null;updateNavigationHud();updateControlHints();return result;};
function navigationCaptureDraft(){const input=document.querySelector('#navSearchInput'),d=navigationView();if(input&&input.value!==d.query){d.query=input.value.slice(0,64);d.page=0;return true;}return false;}
const navigationBaseAbandon=ACT.abandonQuest;
Object.assign(ACT,{
 navFilter(el){if(!['guide','quests'].includes(G.sheet))return;const filters=G.sheet==='guide'?NAV_GUIDE_FILTERS:NAV_QUEST_FILTERS;if(!filters.some(([id])=>id===el.dataset.v))return;navigationCaptureDraft();const d=navigationView();d.filter=el.dataset.v;d.page=0;render();},
 navSearch(){if(!['guide','quests'].includes(G.sheet))return;const input=document.querySelector('#navSearchInput');if(!input)return;const d=navigationView();d.query=input.value.slice(0,64);d.page=0;render();const fresh=document.querySelector('#navSearchInput');fresh?.focus?.({preventScroll:true});fresh?.setSelectionRange?.(d.query.length,d.query.length);},
 navReset(){if(!['guide','quests'].includes(G.sheet))return;const d=navigationView();d.filter='all';d.query='';d.page=0;render();},
 navClear(){if(!['guide','quests'].includes(G.sheet))return;const d=navigationView();d.query='';d.page=0;render();},
 navPage(el){if(!['guide','quests'].includes(G.sheet))return;const page=Number(el.dataset.v);if(!Number.isInteger(page)||page<0||page>1000)return;if(!navigationCaptureDraft())navigationView().page=page;render();},
 guideTo(el){if(!G.st||G.screen!=='explore'||G.dlg||G.st.run||G.readOnly||el.dataset.map&&el.dataset.map!==G.st.mapId||el.dataset.navToken&&el.dataset.navToken!==String(NAV_UI.serial))return;const m=MAPS[G.st.mapId],o=m.objects.find(o=>o.id===el.dataset.v);if(!o)return;const distance=navigationDistance(m,o,navigationDistances(m));if(!Number.isFinite(distance))return toast('歩ける経路がありません。');NAV_UI.serial++;G.sheet=null;G.sheetHistory=[];G.cursorSig=null;render();if(o.walk&&o.x===G.st.pos.x&&o.y===G.st.pos.y)interact(o);else walkTo(o.x,o.y);if(navigationValidPlan())G.walkPlan.label=o.label;updateNavigationHud();updateControlHints();},
 navQuestGo(el){if(!['quests','guide'].includes(G.sheet)||G.screen!=='explore'||G.st?.run||G.dlg||G.readOnly||el.dataset.map!==G.st.mapId||el.dataset.navToken!==String(NAV_UI.serial))return;const target=navigationQuestTarget(el.dataset.v);if(!target)return toast('依頼の状態が変わりました。');NAV_UI.serial++;G.sheet=null;G.sheetHistory=[];G.cursorSig=null;render();walkTo(target.x,target.y);if(navigationValidPlan())G.walkPlan.label=target.label;updateNavigationHud();updateControlHints();},
 travelPause(){const p=navigationValidPlan();if(G.screen!=='explore'||G.st.run||G.dlg||G.readOnly||!p)return;p.paused=true;G.walk.path=G.walk.path.slice(0,1);G.walk.pending=null;updateNavigationHud();updateControlHints();},
 travelResume(el){const p=navigationValidPlan();if(G.screen!=='explore'||G.st.run||G.dlg||G.readOnly||!p||String(p.version)!==el.dataset.v)return;const label=p.label;G.sheet=null;G.sheetHistory=[];G.cursorSig=null;render();walkTo(p.x,p.y);if(navigationValidPlan())G.walkPlan.label=label;updateNavigationHud();updateControlHints();},
 travelCancel(el){const p=navigationValidPlan();if(G.screen!=='explore'||G.st.run||G.dlg||G.readOnly||!p||String(p.version)!==el.dataset.v)return;G.walkPlan=null;G.walk.path=G.walk.path.slice(0,1);G.walk.pending=null;if(G.sheet)render();else{updateNavigationHud();updateControlHints();}},
 navAbandon(el){if(!canManageQuests()||el.dataset.v!==G.st.activeQuest)return;NAV_UI.serial++;G.cursorSig=null;openSheet('navAbandon',{id:el.dataset.v,token:NAV_UI.serial});},
 navAbandonDo(el){if(G.sheet!=='navAbandon'||G.readOnly||G.st?.run||G.dlg||el.dataset.v!==G.st.activeQuest||el.dataset.v!==G.sheetData.id||el.dataset.navToken!==String(G.sheetData.token))return;closeSheet();if(G.sheet==='quests')navigationBaseAbandon(el);}
});
document.addEventListener('submit',e=>{if(e.target?.matches?.('[data-nav-search]')){e.preventDefault();ACT.navSearch();}});
