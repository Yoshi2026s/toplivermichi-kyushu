/* 表示用の時刻は保存せず、直近の文・名の重複回避だけを対象セーブへ保存する。 */
function migrateListeners(st){
  const old=st.listenerHistory||{};
  st.listenerHistory={texts:Array.isArray(old.texts)?old.texts.filter(x=>LISTENER_TEXTS.some(t=>t.id===x)).slice(-12):[],names:Array.isArray(old.names)?old.names.filter(x=>typeof x==="string").slice(-24):[],sequence:Number.isSafeInteger(old.sequence)&&old.sequence>=0?old.sequence:0};
  return st.listenerHistory;
}
function createListenerBatch(st,context,count=3,now=0){
  if(!LISTENER_CONTEXTS.some(([id])=>id===context)||!Number.isInteger(count)||count<1||count>5)return [];
  const h=migrateListeners(st),texts=LISTENER_TEXTS.filter(t=>t.context===context),batch=[],spacing=650+(h.sequence%8)*50;
  for(let i=0;i<count;i++){
    const available=texts.filter(t=>!h.texts.includes(t.id)),pool=available.length?available:texts;
    const text=pool[(h.sequence*7+i*3)%pool.length];
    const names=["sea","pet","boss","support"].includes(context)?[...LISTENER_SPECIAL_NAMES,...LISTENER_NAMES]:LISTENER_NAMES;
    let index=(h.sequence*37+i*17)%names.length;
    for(let tries=0;tries<names.length&&h.names.includes(names[index]);tries++)index=(index+1)%names.length;
    const name=names[index],delay=i*spacing;
    batch.push({id:`${h.sequence}-${i}`,name,text:text.text,start:now+delay,end:now+delay+5000,context});
    h.texts.push(text.id);h.texts=h.texts.slice(-12);h.names.push(name);h.names=h.names.slice(-24);h.sequence++;
  }
  return batch;
}
function visibleListenerComments(batch,now){return batch.filter(c=>now>=c.start&&now<c.end);}
const LISTENER_RUNTIME={state:null,key:"",batch:[],timer:null,last:null};
function clearListenerComments(){
  if(LISTENER_RUNTIME.timer)clearTimeout(LISTENER_RUNTIME.timer);
  LISTENER_RUNTIME.timer=null;LISTENER_RUNTIME.batch=[];LISTENER_RUNTIME.key="";
  if(typeof document!=="undefined")document.getElementById("listenerComments")?.remove();
}
function updateListenerDisplay(){
  if(LISTENER_RUNTIME.timer)clearTimeout(LISTENER_RUNTIME.timer);
  LISTENER_RUNTIME.timer=null;
  if(!G.st||G.sheet||G.dlg||document.hidden||!G.st.settings.listenerComments||!["battle","result","explore"].includes(G.screen))return;
  const now=performance.now(),visible=visibleListenerComments(LISTENER_RUNTIME.batch,now).slice(-1);
  let box=document.getElementById("listenerComments");
  if(!box){box=document.createElement("aside");box.id="listenerComments";box.className="listener-comments";box.setAttribute("aria-live","polite");box.setAttribute("aria-label","リスナーの応援");(document.querySelector?.(".result-details")||document.querySelector?.(".battle,.result,.explore")||document.body).appendChild(box);}
  box.innerHTML=visible.map(c=>`<div class="listener-comment"><span>${esc(c.name)}</span><p>${esc(c.text)}</p></div>`).join("");
  const next=LISTENER_RUNTIME.batch.flatMap(c=>[c.start,c.end]).filter(t=>t>now).sort((a,b)=>a-b)[0];
  if(next!==undefined)LISTENER_RUNTIME.timer=setTimeout(updateListenerDisplay,Math.max(20,next-now+5));
}
function observeListenerScene(){
  if(!G.st||G.readOnly||G.sheet||G.dlg||document.hidden||G.st.settings.listenerComments===false){clearListenerComments();return;}
  const st=G.st,run=st.run,prior=LISTENER_RUNTIME.last;
  let context=G.screen==="result"?"victory":G.screen==="battle"?(run?.kind==="boss"?"boss":"start"):MAPS[st.mapId]?.combatDomain==="sea"?"sea":MAPS[st.mapId]?.kind==="field"?"explore":"town";
  if(run?.state==="lost")context="defeat";
  const hp=run?.party.reduce((n,m)=>n+m.hp,0)||0,enemyHP=run?.enemies.reduce((n,m)=>n+m.hp,0)||0;
  const key=[G.screen,st.mapId,run?.seq,run?.turn,run?.actionFlags?.actionCount,st.lastResult?.seq].join("|");
  if(prior&&prior.seq===run?.seq&&G.screen==="battle"&&run?.state!=="lost"){
    if(run.party.some(m=>m.hp<=0))context="down";else if(run.party.some(m=>m.hp<=m.maxHP*.3))context="low";
    else if(hp>prior.hp)context="heal";else if(enemyHP<prior.enemyHP)context="hit";
    else if(run.petProcessedTurn===run.turn)context="pet";else if(run.turn!==prior.turn)context="mp";
    if(run.actionFlags?.critical&&!prior.critical||run.actionFlags?.critCount>prior.critCount)context="critical";
    if(run.actionFlags?.evaded&&!prior.evaded||run.actionFlags?.evadeCount>prior.evadeCount)context="evade";
  }
  if(LISTENER_RUNTIME.state!==st){clearListenerComments();LISTENER_RUNTIME.state=st;}
  if(key!==LISTENER_RUNTIME.key){
    clearListenerComments();LISTENER_RUNTIME.key=key;
    if(st.settings.listenerComments!==false){st.settings.listenerComments=true;LISTENER_RUNTIME.batch=createListenerBatch(st,context,context==="boss"?5:context==="town"?1:3,performance.now());}
  }
  LISTENER_RUNTIME.last={seq:run?.seq,turn:run?.turn,hp,enemyHP,critical:!!run?.actionFlags?.critical,evaded:!!run?.actionFlags?.evaded,critCount:run?.actionFlags?.critCount||0,evadeCount:run?.actionFlags?.evadeCount||0};
  updateListenerDisplay();
}
if(typeof document!=="undefined")document.addEventListener?.("visibilitychange",()=>{
  if(document.hidden)clearListenerComments();else observeListenerScene();
});
