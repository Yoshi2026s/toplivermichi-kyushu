/* 共通の設定・作成・解説・移動再開。追加画面は既存の保存・操作受付に統合する。 */
function applySoundSettings(settings={}){
  if(typeof SND.setVolumes==="function")SND.setVolumes(Number.isFinite(settings.musicVolume)?settings.musicVolume:1,Number.isFinite(settings.effectVolume)?settings.effectVolume:1);
  if(settings.sound===false&&SND.on)SND.setOn(false);else if(settings.sound!==false&&!SND.on)SND.setOn(true);
}
function renderRegionalSupportOptions(st){
  const lock=G.readOnly||G.screen!=="explore"||G.sheet!=="party"||G.dlg||st.run||G.walk.path.length||!isSafe();
  return `<h3 class="label">地域支援</h3><p class="small">旅でつながった声を1つ選びます。効果は戦闘開始時に固定。現在：${esc(st.support?SUPPORTS[st.support]?.name||"なし":"なし")}</p><button class="btn" data-a="setSupport" data-v="" ${lock?"disabled":""}>支援なし</button><details><summary>全47地域の支援と解放条件</summary><div class="stack">${Object.entries(SUPPORTS).map(([id,s])=>{const r=SUPPORT_REQUIREMENTS[id],ok=supportAvailable(st,id);return `<button class="btn ${st.support===id?"on":""}" data-a="setSupport" data-v="${id}" aria-pressed="${st.support===id}" ${lock||!ok?"disabled":""}>${esc(s.name)}：${esc(s.text)}<br><span class="small">${ok?"解放済み":`「${esc(QUESTS[r?.quest]?.name||"地域の依頼")}」完了${r?.npc?"・街の代表との会話":""}${r?.extra?"・本編依頼完了":""}`}</span></button>`;}).join("")}</div></details>`;
}
function extraBadgeOutside(run,id){
  if(typeof petBadgeApplicable==="function"&&!petBadgeApplicable(run,id))return true;
  const pets=run.pets||[],n=Number(id.slice(1));
  if(n>=71&&n<=80){if(!pets.length)return true;if(id==="B074"&&pets.length<2)return true;if(id==="B077"&&!run.party.some(m=>m.cid==="hero"))return true;if(id==="B078"&&!run.party.some(m=>m.cid==="moe"))return true;}
  if(["B009","B093"].includes(id)&&run.kind!=="challenge")return true;
  if(["B017","B035"].includes(id)&&!run.expanded)return true;
  if(id==="B099"&&run.L<5)return true;
  if(id==="B100"&&!run.party.some(m=>(m.learnedSkills||[]).length||(m.learnedJobs||[]).length))return true;
  return false;
}
const systemBaseRenderParty=renderParty;
for(const id of Object.keys(EXTRA_BADGES))if(!["B009","B093"].includes(id))STABLE_BATTLE_BADGES.add(id);
renderParty=function(){let html=systemBaseRenderParty();if(!G.sheetData.cid){const index=html.indexOf('<h3 class="label">地域支援</h3>');if(index>=0)html=html.slice(0,index);html=html+renderRegionalSupportOptions(G.st);}return html;};
const systemBaseGuideSheet=renderSheet;
renderSheet=function(){let html=systemBaseGuideSheet();if(G.sheet==="guide"&&MAPS[G.st.mapId].kind==="field"&&!MAPS[G.st.mapId].combatDomain)html=html.replace('<div class="stack">','<div class="stack"><button class="btn" data-a="openSheet" data-k="training">街外の実技チャレンジ</button>');return html;};

function validateSetup(n){
  const hero=validateName(n.name),partner=validateName(n.heroine?.name||"");
  if(!hero.ok)return hero.errors[0];if(!partner.ok)return "ヒロイン："+partner.errors[0];
  if(!["男性","女性"].includes(n.gender)||!["男性","女性"].includes(n.heroine?.gender))return "主人公とヒロインの性別を選んでください。";
  if(!Object.hasOwn(CAREERS,n.careerId||""))return "職歴を選んでください。";
  if(hero.value.normalize("NFKC").toLocaleLowerCase()===partner.value.normalize("NFKC").toLocaleLowerCase())return "主人公とヒロインには別の名前を付けてください。";
  return "";
}
function captureSetup(){const n=G.newGame,inp=$("#nameInput");if(inp){if(n.step===2)n.heroine.name=inp.value;else n.name=inp.value;}const c=$("#careerSelect");if(c)n.careerId=c.value;}
renderNew=function(){
  const n=G.newGame,partner=n.step===2,name=partner?n.heroine.name:n.name,gender=partner?n.heroine.gender:n.gender;
  if(n.step===3)return `<section class="win"><h2 class="label">ふたりの旅の確認</h2><dl class="kv"><dt>主人公</dt><dd>${esc(n.name)}・${esc(n.gender)}</dd><dt>職歴</dt><dd>${esc(CAREERS[n.careerId].name)}</dd><dt>記念装備</dt><dd>${esc(EQUIP[CAREERS[n.careerId].weapon].name)}／${esc(EQUIP[CAREERS[n.careerId].armor].name)}</dd><dt>ヒロイン</dt><dd>${esc(n.heroine.name)}・${esc(n.heroine.gender)}</dd></dl><p class="small">性別で能力や結末は変わりません。職歴は記念装備に反映され、初期の職業はアイドルオタクです。</p><button class="btn primary" data-a="startGame">このふたりで始める</button><button class="btn" data-a="newBack">ヒロイン設定に戻る</button></section>`;
  return `<section class="win"><h2 class="label">${partner?"ヒロインの設定（2／3）":"主人公の設定（1／3）"}</h2><label class="field-label" for="nameInput">名前（全角1～${NAME_MAX}文字）</label><input id="nameInput" class="input" autocomplete="off" value="${esc(name)}" aria-describedby="nameHelp"><div id="nameHelp" class="small" aria-live="polite"></div><fieldset class="gender"><legend>性別</legend>${["男性","女性"].map(g=>`<button class="btn ${gender===g?"on":""}" data-a="pickGender" data-step="${n.step}" data-v="${g}" aria-pressed="${gender===g}">${g}</button>`).join("")}</fieldset>${partner?'<p class="small">この名前で会話・ステータス・物語を表示します。</p>':`<label for="careerSelect" class="field-label">これまでの職歴</label><select id="careerSelect" class="input">${Object.entries(CAREERS).map(([id,c])=>`<option value="${id}" ${n.careerId===id?"selected":""}>${esc(c.name)}</option>`).join("")}</select><p class="small">33種類の職歴から選べます。職歴ごとに武器と防具が1つずつ付属します。</p>`}<canvas id="heroPrev" width="192" height="288" class="sprite-lg" aria-hidden="true"></canvas><button class="btn primary" id="toConfirm" data-a="newNext">${partner?"確認へ":"ヒロイン設定へ"}</button><button class="btn" data-a="${partner?"newBack":"toTitle"}">${partner?"主人公設定に戻る":"タイトルへ戻る"}</button></section>`;
};
mountNew=function(){
  const n=G.newGame,inp=$("#nameInput"),canvas=$("#heroPrev"),gender=n.step===2?n.heroine.gender:n.gender;
  if(canvas&&gender)SOFT_ART.portrait(canvas,n.step===2?"moe":"hero",gender,true);
  if(!inp)return;
  const update=()=>{captureSetup();const v=validateName(inp.value),help=$("#nameHelp");help.textContent=n.composing?"変換中":`${v.count}／${NAME_MAX}文字${!v.ok&&inp.value?"・"+v.errors[0]:""}`;const b=$("#toConfirm");if(b)b.disabled=!!n.composing||!v.ok||!gender;};
  inp.addEventListener("compositionstart",()=>{n.composing=true;update();});inp.addEventListener("compositionend",()=>{n.composing=false;update();});inp.addEventListener("input",e=>{if(!e.isComposing){n.composing=false;update();}});$("#careerSelect")?.addEventListener("change",captureSetup);update();
};
Object.assign(ACT,{
  newGame(){if(G.screen!=="title"||G.starting)return;G.newGame={name:"",gender:null,careerId:"CR01",heroine:{name:"ヒロイン",gender:"女性"},step:1,composing:false};G.screen="new";render();},
  pickGender(el){if(G.screen!=="new"||![1,2].includes(G.newGame.step)||G.newGame.composing||Number(el.dataset.step)!==G.newGame.step||!["男性","女性"].includes(el.dataset.v))return;captureSetup();if(G.newGame.step===2)G.newGame.heroine.gender=el.dataset.v;else G.newGame.gender=el.dataset.v;render();},
  newNext(){const n=G.newGame;if(G.screen!=="new"||n.composing||![1,2].includes(n.step))return;captureSetup();const v=validateName(n.step===2?n.heroine.name:n.name);if(!v.ok)return toast(v.errors[0]);if(n.step===1){if(!n.gender)return toast("性別を選んでください。");n.name=v.value;n.step=2;}else{n.heroine.name=v.value;const error=validateSetup(n);if(error)return toast(error);n.step=3;}render();},
  newBack(){if(G.screen!=="new"||G.starting||G.newGame.composing)return;captureSetup();G.newGame.step=Math.max(1,G.newGame.step-1);render();},
  async startGame(el){
    const n=G.newGame;if(G.screen!=="new"||n.step!==3||n.composing||G.starting)return;const error=validateSetup(n);if(error)return toast(error);
    G.starting=true;el.disabled=true;const previous=G.st,previousStatus=G.saveStatus;
    try{G.st=newGame(validateName(n.name).value,n.gender,{careerId:n.careerId,heroine:{name:validateName(n.heroine.name).value,gender:n.heroine.gender}});await seedSaveGeneration(G.st,previous);Object.assign(G.st.settings,G.tmpSettings||{});G.st.settings.sound=soundIsOn();G.st.settings.padSide=padSide();G.st.settings.listenerComments=true;applySoundSettings(G.st.settings);const saved=await commit();if(saved===false){G.st=previous;setSave(previousStatus);toast("保存できませんでした。前の冒険を保持しています。");return;}G.hasSave=true;G.screen="explore";G.sheet=null;G.dlg=null;G.walk={path:[],prog:0,pending:null};G.walkPlan=null;G.sheetHistory=[];exploreBgm();render();playScene("HS00");}catch(e){G.st=previous;toast("開始できませんでした。設定を確認してください。");}finally{G.starting=false;}
  }
});

const SYSTEM_HELP={
  walk:{name:"街と街外・移動",text:"街と室内は安全です。「街外へ」で出口まで歩き、街外MAPの道から隣の街外へ進んで街に入ります。街間の直行は新幹線駅から訪問済みの街へ乗る場合だけです。地図は街の出口までの徒歩案内です。地面のタップ、スティック、キーボードで移動できます。オート移動は実際に歩いて向かい、遭遇で中断します。移動速度は設定で通常／高速を選べます。"},
  quest:{name:"依頼と物語",text:"街で依頼を受け、街外の通常敵を必要数倒すと地域ボスへ挑めます。討伐で依頼が完了し次の地域への道が開きます。完了した会話は記録から再読できます。"},
  battle:{name:"戦闘・対処・オート",text:"攻撃、職業技能、追加技能、応援、ガード、MP回復、道具、必殺技を使えます。全戦闘でオートを使用でき、中断すると手動に戻ります。通常の敵の次行動予告は表示しません。地域ボスのため中は説明された対処を異なる2人で行います。"},
  job:{name:"職業とハローワーク",text:"各街のハローワークで職業ごとの3段階イベントに参加します。完了した職業へ転職できます。熟練度と習得済みの技能は維持されます。新しい職業に合わない専用装備は外れます。街外の実技課題は10ターン以内の勝利を目指します。"},
  stats:{name:"能力・会心・回避",text:"体力、ちから、身の守り、すばやさ、魅力の5能力があります。職業特性と装備が能力や行動に反映されます。会心は敵防御を無視し1.5倍。敵の痛恨は防御・防護を無視しますがガードは有効です。具体的な能力は状態画面で比較できます。"},
  skills:{name:"追加技能と必殺技",text:"レベルと職業熟練度を満たすと追加技能を習得します。継承枠へ装備すると他の職業でも使えます。再使用までの残りターンと消費MPを確認してください。人物固有の必殺技は必要なエールを蓄えて使います。"},
  pets:{name:"ペットのお世話と成長",text:"22種類のペットは★1〜★5。高レアほどお迎え・用品が高価で、なつき度はゆっくり育つ分、技が強力です。育成の端数も保存され、すでに育った段階は下がりません。10段階に成長し、段階1・3・5・8で4つの技を習得します。最大2匹が戦闘で毎ターン最初に行動します。回復・攻撃・防御・すばやさ強化・敵の攻撃低下・混乱・睡眠など、種類と成長で支援内容が変わります。街の控え室・ペットショップで交流・用品購入・家族のお迎えができます。ごはん・遊ぶ・お手入れ・休憩・練習・なでるは別々の日次記録です。用品不要の交流遊びは3種類から1日1回。なつき度20・50・80のお祝いは空きがある時に受け取れます。"},
  petTravel:{name:"おさんぽと旅のお手伝い",text:"ひだまりの庭・にぎやかな広場・小川のほとりから行き先を選びます。全ペットで1日1回。用品の保管先と実際の増加量を確認して出発します。旅のお手伝いはバランス・HP・MP重視から選び、生存者だけを回復します。翌日になると日次回数が戻ります。"},
  sea:{name:"航海と海洋図鑑",text:"8地方の安全な港から指定された航路へ出航します。海上や海辺では敵に遭遇します。65海域ごとに魚・クラゲ・カニ・ウミガメ・海竜の5系統10段階があり、計3250項目を図鑑で確認できます。未指定の海面は航行できません。"},
  seaEvents:{name:"救助・調査・漂着宝箱",text:"各海域で漂流者救助80ゴールド、海洋敵3体討伐後の調査報告60チケット、救助後の漂着宝箱120ゴールドを各1回受け取れます。"},
  badges:{name:"戦闘バッジ100種",text:"速さ・攻撃・作戦・防御・回復・MP・応援・ペット・道具・成長の10分野です。有効な行動と実際の回復やダメージを記録し、勝利時に保存します。対象外・今回達成不可・勝利で確定・獲得済みを区別します。敗北や撤退では取得しません。"},
  items:{name:"持ち物と金庫",text:"道具は300種類、イベント品400種類、各99個。未装備品は300種類、同じ装備は装備中と金庫を合わせ8個まで。共通アイテム金庫は全カテゴリ合計999個です。ペット用品も分類して出し入れできます。購入前に数量・合計・残金・受取先を確認します。"},
  save:{name:"保存とバックアップ",text:"冒険の進行は自動保存されます。設定でバックアップ文字列を控え、端末変更前に保管してください。"},
  sound:{name:"音・演出・コメント",text:"BGMと効果音の音量を個別に保存できます。応援コメントは設定で表示を切り替えられます。"}
};
const helpNormalize=s=>String(s||"").normalize("NFKC").toLocaleLowerCase().trim();
function helpResultEntries(d){const category=Object.hasOwn(SYSTEM_HELP,d.category)?d.category:'all',words=helpNormalize(d.query).split(/\s+/).filter(Boolean);return Object.entries(SYSTEM_HELP).filter(([id,h])=>(category==='all'||category===id)&&words.every(w=>helpNormalize(h.name+' '+h.text).includes(w)));}
function renderSystemHelp(){
 const d=G.sheetData,category=Object.hasOwn(SYSTEM_HELP,d.category)?d.category:'all',entries=helpResultEntries(d),pages=Math.max(1,Math.ceil(entries.length/4)),page=Math.max(0,Math.min(pages-1,Number.isInteger(d.page)?d.page:0));d.page=page;
 return `<form class="help-search" data-help-search><label for="helpSearch" class="field-label">解説を検索</label><input id="helpSearch" class="input" maxlength="100" value="${esc(d.query||'')}"><button type="submit" class="btn">検索</button><button type="button" class="btn" data-a="helpReset">解除</button></form>
 <details class="help-categories"><summary>分野：${category==='all'?'すべて':esc(SYSTEM_HELP[category].name)}</summary><div class="opts" role="group" aria-label="解説の分野">${[['all','すべて'],...Object.entries(SYSTEM_HELP).map(([id,h])=>[id,h.name])].map(([id,name])=>`<button class="btn opt" data-a="helpFilter" data-v="${id}" aria-pressed="${category===id}">${esc(name)}</button>`).join('')}</div></details>
 ${entries.length?entries.slice(page*4,page*4+4).map(([,h])=>`<section class="qcard"><h3 class="label">${h.name}</h3><p>${h.text}</p></section>`).join(''):'<p>見つかりません。解除で検索条件をリセットできます。</p>'}
 <div class="row3"><button class="btn" data-a="helpPage" data-v="${page-1}" ${page===0?'disabled':''}>前へ</button><span role="status" aria-live="polite">${entries.length}件・${page+1}／${pages}</span><button class="btn" data-a="helpPage" data-v="${page+1}" ${page+1>=pages?'disabled':''}>次へ</button></div>`;
}
const systemBaseRenderSheet=renderSheet;
renderSheet=function(){if(G.sheet==="help")return sheetWrap("解説",renderSystemHelp());return systemBaseRenderSheet();};
const systemBaseSettings=renderSettings;
renderSettings=function(){const s=G.st?.settings||G.tmpSettings||{};return systemBaseSettings()+`<h3 class="label">音量を個別に調整</h3>${[["musicVolume","BGM"],["effectVolume","効果音"]].map(([key,label])=>`<p>${label}：${Math.round((s[key]??1)*100)}％</p><div class="opts">${[0,.25,.5,.75,1].map(n=>`<button class="btn opt" data-a="soundVolume" data-k="${key}" data-v="${n}" aria-pressed="${(s[key]??1)===n}">${n*100}％</button>`).join("")}</div>`).join("")}<h3 class="label">移動と応援</h3><button class="btn" data-a="moveSpeed">移動速度：${s.moveSpeed==="fast"?"高速":"通常"}</button><button class="btn" data-a="listenerToggle">リスナーコメント：${s.listenerComments===false?"OFF":"ON"}</button>`;};
const systemBaseRender=render;
render=function(){systemBaseRender();observeListenerScene();};
const systemBaseCharSprite=charSprite;
charSprite=function(cid,dir,frame){if(G.oceanDrawing)return systemBaseCharSprite(cid,dir,frame);if(cid==="moe"&&G.st?.heroine)return ART.person("partner",PAL.violet,PAL.cream,dir,frame,{long:G.st.heroine.gender!=="男性",ribbon:G.st.heroine.gender!=="男性"?PAL.coral:null});return systemBaseCharSprite(cid,dir,frame);};
const systemBaseOpen=openSheet,systemBaseClose=closeSheet;
openSheet=function(k,data={}){if(G.petSaving||G.oceanSaving||G.characterSaving||G.vaultSaving||G.shopSaving||G.featureSaving)return;if(k==="voyage")k="ocean";if(G.sheet&&G.sheet!==k){G.sheetHistory=G.sheetHistory||[];G.sheetHistory.push({key:G.sheet,data:{...G.sheetData},scroll:$(".sheet")?.scrollTop||0});G.sheetHistory=G.sheetHistory.slice(-12);}return systemBaseOpen(k,data);};
closeSheet=function(){if(G.petSaving||G.oceanSaving||G.characterSaving||G.vaultSaving||G.shopSaving||G.featureSaving)return;const previous=G.sheetHistory?.pop();if(previous){G.sheet=previous.key;G.sheetData=previous.data;render();const sheet=$(".sheet");if(sheet)sheet.scrollTop=previous.scroll;}else systemBaseClose();};
Object.assign(ACT,{
  openHelp(){if(G.petSaving||G.oceanSaving||G.characterSaving||G.vaultSaving)return;openSheet("help",G.helpQuery||{});},
  helpFilter(el){if(G.sheet!=="help"||(el.dataset.v!=="all"&&!Object.hasOwn(SYSTEM_HELP,el.dataset.v)))return;G.sheetData.category=el.dataset.v;G.sheetData.page=0;G.helpQuery={...G.sheetData};render();},
  helpSearch(){if(G.sheet!=="help")return;G.sheetData.query=String($("#helpSearch")?.value||"").slice(0,100);G.sheetData.page=0;G.helpQuery={...G.sheetData};render();},
  helpPage(el){if(G.sheet!=="help")return;const p=Number(el.dataset.v);if(!Number.isInteger(p)||p<0||p>3)return;G.sheetData.page=p;G.helpQuery={...G.sheetData};render();},
  soundVolume(el){if(G.screen!=="title"&&(!G.st||G.st.run)||G.sheet!=="settings"||G.readOnly||!["musicVolume","effectVolume"].includes(el.dataset.k))return;const n=Number(el.dataset.v);if(![0,.25,.5,.75,1].includes(n))return;const s=G.st?.settings||(G.tmpSettings=G.tmpSettings||{});s[el.dataset.k]=n;applySoundSettings(s);if(G.st)commit();render();},
  moveSpeed(){if(G.sheet!=="settings"||G.readOnly||G.st?.run)return;const s=G.st?.settings||(G.tmpSettings=G.tmpSettings||{});s.moveSpeed=s.moveSpeed==="fast"?"normal":"fast";if(G.st)commit();render();},
  listenerToggle(){if(G.sheet!=="settings"||G.readOnly)return;const s=G.st?.settings||(G.tmpSettings=G.tmpSettings||{});s.listenerComments=s.listenerComments===false;if(!s.listenerComments)clearListenerComments();if(G.st)commit();render();}
});
const systemBaseTitle=ACT.toTitle;
ACT.toTitle=function(){clearListenerComments();G.sheetHistory=[];G.walkPlan=null;G.walk={path:[],prog:0,pending:null};G.walkPlan=null;G.sheetHistory=[];G.auto=false;clearTimeout(G.autoT);G.lock=false;return systemBaseTitle();};

/* オート移動は目的地を保持し、戦闘後に現在位置から再計算する。 */
const systemBaseWalkTo=walkTo,systemBaseStartBattle=startBattle,systemBaseGuide=renderSheet;
walkTo=function(x,y,pending){if(G.st&&G.screen==="explore"&&!G.readOnly){G.walkPlanSeq=(G.walkPlanSeq||0)+1;G.walkPlan={state:G.st,map:G.st.mapId,x,y,version:G.walkPlanSeq,paused:false};}return systemBaseWalkTo(x,y,pending);};
startBattle=function(run){const result=systemBaseStartBattle(run);if(G.st?.run===run&&G.walkPlan&&G.st===G.walkPlan.state&&G.st.mapId===G.walkPlan.map)G.walkPlan.paused=true;return result;};
renderSheet=function(){let html=systemBaseGuide();if(G.sheet==="guide"&&G.walkPlan?.paused&&G.walkPlan.map===G.st.mapId){const v=G.walkPlan.version;html=html.replace('</div></div>',`<div class="stack"><button class="btn" data-a="walkResume" data-v="${v}">中断したオート移動を再開</button><button class="btn" data-a="walkCancel" data-v="${v}">目的地を取り消す</button></div></div></div>`);}return html;};
Object.assign(ACT,{
  walkResume(el){const p=G.walkPlan;if(G.screen!=="explore"||G.sheet!=="guide"||G.dlg||G.st.run||G.readOnly||!p||p.state!==G.st||p.map!==G.st.mapId||String(p.version)!==el.dataset.v)return;G.sheet=null;G.sheetHistory=[];render();walkTo(p.x,p.y);},
  walkCancel(el){if(G.screen!=="explore"||G.sheet!=="guide"||G.readOnly||!G.walkPlan||G.walkPlan.state!==G.st||String(G.walkPlan.version)!==el.dataset.v)return;G.walkPlan=null;G.walk={path:[],prog:0,pending:null};G.walkPlan=null;G.sheetHistory=[];render();}
});
document.addEventListener("visibilitychange",()=>{if(document.hidden)clearListenerComments();});

// Leave the complete menu stack without replaying a previous sheet.
ACT.returnToMap=function(){
  if(systemOperationPending()||G.screen!=="explore"||!G.st||G.st.run||G.dlg||!G.sheet)return;
  G.sheet=null;G.sheetData={};G.sheetHistory=[];G.cursorSig=null;render();
};
