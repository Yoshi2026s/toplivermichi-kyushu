/* 画面が変わった後の古い操作は実行しない。進行・保存形式・戦闘計算は変更しない。 */
const ACTION_SCREEN_BUTTONS=new Set(['dlgNext','dlgBack','dlgSkip']);
function currentActionButton(el){return !el?.dataset?.actionEpoch||el.dataset.actionEpoch===String(G.controlEpoch||0);}
const actionSafetyRender=render;
render=function(){
 const result=actionSafetyRender();document.querySelectorAll('[data-a]').forEach(el=>{if(ACTION_SCREEN_BUTTONS.has(el.dataset.a))el.dataset.actionEpoch=String(G.controlEpoch||0);});
 // 案内HUDなど、描画の後半に追加した操作も同じ閲覧制限にそろえる。
 if(typeof syncReadOnlyUi==='function')syncReadOnlyUi();
 const confirm=document.querySelector('#dock .stick-confirm');if(confirm){confirm.disabled=!!(G.readOnly&&['battle','result'].includes(G.screen)&&!G.sheet&&!G.dlg);if(confirm.disabled)confirm.setAttribute('aria-label','閲覧中のため決定できません');}
 return result;
};
for(const name of ['dlgNext','dlgBack','dlgSkip']){const base=ACT[name];ACT[name]=function(el){if(!G.dlg||!Array.isArray(G.dlg.lines)||!G.dlg.lines.length||!currentActionButton(el))return;return base(el);};}
ACTION_SCREEN_BUTTONS.add('interactId');
const actionSafetyInteract=ACT.interactId;
ACT.interactId=function(el){if(!G.st||G.readOnly||G.screen!=='explore'||G.sheet!=='nearby'||G.dlg||G.st.run||G.walk.path.length||!currentActionButton(el)||!nearbyObjects().some(o=>o.id===el.dataset.v))return;return actionSafetyInteract(el);};
function manualBattleContext(){return !!G.st?.run&&G.screen==='battle'&&G.st.run.state==='input'&&!G.sheet&&!G.dlg&&!G.readOnly&&!G.auto;}
for(const name of ['pickActor','cmdType','cmdSet'])ACTION_SCREEN_BUTTONS.add(name);
const actionSafetyActor=ACT.pickActor,actionSafetyType=ACT.cmdType,actionSafetySet=ACT.cmdSet;
ACT.pickActor=function(el){if(!manualBattleContext()||!currentActionButton(el))return;const i=Number(el.dataset.i),m=G.st.run.party[i];if(!Number.isInteger(i)||!m||m.hp<=0||m.acted)return;return actionSafetyActor(el);};
ACT.cmdType=function(el){if(!manualBattleContext()||!currentActionButton(el)||!['attack','comment','skill','item','guard','rest','other'].includes(el.dataset.v))return;return actionSafetyType(el);};
ACT.cmdSet=function(el){
 if(!manualBattleContext()||!currentActionButton(el))return;const run=G.st.run,k=el.dataset.k,v=el.dataset.v,type=G.cmd?.type;
 const kinds={target:['attack','skill','item'],ally:['skill','item'],line:['comment','skill'],mode:['skill'],item:['item'],o:['other']};if(!Object.hasOwn(kinds,k)||!kinds[k].includes(type))return;
 if(k==='target'||k==='ally'){if(!/^(0|[1-9]\d*)$/.test(v))return;const n=Number(v);if(k==='target'?!run.enemies.some(e=>e.slot===n&&e.hp>0):!run.party[n])return;}
 else if(k==='item'){if(!ITEMS[v]||ITEMS[v].petSupply||!run.bag?.some(e=>e.id===v&&e.n>0))return;}
 else if(k==='line'?!Object.hasOwn(COMMENT_LINES,v):k==='mode'?!['hp','c','safe','bold'].includes(v):!['meter','family'].includes(v))return;
 return actionSafetySet(el);
};
ACTION_SCREEN_BUTTONS.add('confirmAct');
const actionSafetyConfirm=ACT.confirmAct;
ACT.confirmAct=function(el){if(!manualBattleContext()||!currentActionButton(el))return;const run=G.st.run,a=run.party[G.cmd?.actor];if(!a||a.hp<=0||a.acted)return;const act=buildAct(a);if(!act)return;const plan=planAction(run,G.cmd.actor,act);if(!plan.ok)return toast(plan.reason);return actionSafetyConfirm(el);};
ACTION_SCREEN_BUTTONS.add('defeatReturn');
const actionSafetyDefeat=ACT.defeatReturn;
ACT.defeatReturn=function(el){if(G.readOnly||G.screen!=='battle'||G.sheet||G.dlg||G.st?.run?.state!=='lost'||!currentActionButton(el))return;return actionSafetyDefeat(el);};
for(const name of ['retreat','doRetreat','pauseBattle'])ACTION_SCREEN_BUTTONS.add(name);
const actionSafetyRetreat=ACT.retreat,actionSafetyRetreatDo=ACT.doRetreat,actionSafetyPause=ACT.pauseBattle;
ACT.retreat=function(el){if(!manualBattleContext()||!currentActionButton(el))return;return actionSafetyRetreat(el);};
ACT.doRetreat=function(el){if(G.readOnly||G.auto||G.screen!=='battle'||G.sheet!=='retreat'||G.dlg||G.st?.run?.state!=='input'||!currentActionButton(el))return;return actionSafetyRetreatDo(el);};
ACT.pauseBattle=function(el){if(!manualBattleContext()||!currentActionButton(el))return;return actionSafetyPause(el);};
ACTION_SCREEN_BUTTONS.add('helpFilter');
const actionSafetyHelpSearch=ACT.helpSearch,actionSafetyHelpFilter=ACT.helpFilter;
function captureHelpDraft(){const input=document.querySelector('#helpSearch');if(!input)return false;const query=input.value.slice(0,100),changed=query!==(G.sheetData.query||'');G.sheetData.query=query;if(changed)G.sheetData.page=0;return changed;}
ACT.helpSearch=function(){if(G.sheet!=='help')return;G.cursorSig=null;const result=actionSafetyHelpSearch();document.querySelector('#helpSearch')?.focus?.({preventScroll:true});return result;};
ACT.helpFilter=function(el){if(G.sheet!=='help'||!currentActionButton(el)||el.dataset.v!=='all'&&!Object.hasOwn(SYSTEM_HELP,el.dataset.v))return;captureHelpDraft();G.cursorSig=null;const result=actionSafetyHelpFilter(el);document.querySelector('.help-categories>summary')?.focus?.({preventScroll:true});return result;};
document.addEventListener('submit',e=>{if(e.target?.matches?.('[data-help-search]')){e.preventDefault();ACT.helpSearch();}});
for(const name of ['helpReset','helpPage'])ACTION_SCREEN_BUTTONS.add(name);
ACT.helpReset=function(el){if(G.sheet!=='help'||!currentActionButton(el))return;G.sheetData={category:'all',query:'',page:0};G.helpQuery={...G.sheetData};G.cursorSig=null;render();document.querySelector('#helpSearch')?.focus?.({preventScroll:true});};
ACT.helpPage=function(el){if(G.sheet!=='help'||!currentActionButton(el))return;const page=Number(el.dataset.v),forward=page>(G.sheetData.page||0);if(!Number.isInteger(page)||page<0)return;const changed=captureHelpDraft(),pages=Math.max(1,Math.ceil(helpResultEntries(G.sheetData).length/4));if(!changed&&page>=pages)return;G.sheetData.page=changed?0:page;G.helpQuery={...G.sheetData};G.cursorSig=null;render();focusPagingControl('[data-a="helpPage"]',G.sheetData.page,forward);};
function focusPagingControl(selector,page,forward){const buttons=[...document.querySelectorAll(selector)].filter(b=>!b.disabled),next=buttons.find(b=>(Number(b.dataset.v)>page)===forward)||buttons[0];next?.focus?.({preventScroll:true});next?.scrollIntoView?.({block:'nearest'});}
ACTION_SCREEN_BUTTONS.add('navPage');
const actionSafetyNavPage=ACT.navPage;
ACT.navPage=function(el){if(!['guide','quests'].includes(G.sheet)||!currentActionButton(el))return;const forward=Number(el.dataset.v)>navigationView().page;G.cursorSig=null;const result=actionSafetyNavPage(el);focusPagingControl('.nav-pages [data-a="navPage"]',navigationView().page,forward);return result;};
