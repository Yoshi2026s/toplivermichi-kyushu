/* 能力比較・継承技・固有必殺技・ハローワーク。入力を確定する直前にも条件を照合する。 */
const characterBaseAttackPower=attackPower,characterBaseDefensePower=defensePower;
attackPower=function(stats,L){return stats.attackPower??characterBaseAttackPower(stats,L);};
defensePower=function(stats,L){return stats.defensePower??characterBaseDefensePower(stats,L);};
const characterBaseRenderSheet=renderSheet;
renderSheet=function(){
  if(["jobcenter","jobCenter"].includes(G.sheet))return sheetWrap("ハローワーク",renderJobcenter());
  if(G.sheet==="battleSkills")return sheetWrap("追加技・継承技・固有必殺技",renderExpandedSkillSheet());
  if(G.sheet==="training")return sheetWrap("街外の実技チャレンジ",renderTrainingSheet());
  if(G.sheet==="characterSkills")return sheetWrap("能力と習得技",renderCharacterSkills());
  return characterBaseRenderSheet();
};
const characterBaseRenderStatus=renderStatus;
renderStatus=function(){
  const st=G.st,L=levelOf(st.xp,st);
  return characterBaseRenderStatus()+`<details class="status-details"><summary>5つの能力と職業特性</summary><div class="stack">${st.roster.map(cid=>{
    const s=charStats(st,cid,L);return `<section class="qcard"><b>${esc(charName(st,cid))}</b><dl class="kv">${Object.entries(ABILITY_NAMES).map(([id,name])=>`<dt>${name}</dt><dd>${s[id]||0}</dd>`).join("")}<dt>攻撃力</dt><dd>${s.attackPower||0}</dd><dt>防御力</dt><dd>${s.defensePower||0}</dd><dt>会心率</dt><dd>${Math.round((s.criticalRate||0)*1000)/10}%</dd><dt>回避率</dt><dd>${Math.round((s.evasionRate||0)*1000)/10}%</dd></dl><p class="small">${esc(JOB_TRAITS[s.job].name)}：${esc(JOB_TRAITS[s.job].text)}</p><button class="btn" data-a="characterSkills" data-c="${cid}">習得技と条件</button></section>`;
  }).join("")}</div></details>`;
};
const characterBaseRenderCommand=renderCommand;
renderCommand=function(run){
  let html=characterBaseRenderCommand(run);
  if(!run?.expanded||G.auto||run.state!=="input")return html;
  const actor=run.party[G.cmd.actor];if(!actor)return html;
  html=html.replace(`MP${JOBS[actor.job].cost}・`,`MP${Math.max(0,JOBS[actor.job].cost-(actor.trait?.mpDiscount||0))}・`);
  if(actor.trait?.meterDiscount)html=html.replace("エール80・",`エール${80-actor.trait.meterDiscount}・`);
  const ready=availableBattleSkills(run,actor).length;
  return html+(ready?`<button class="btn wide" data-a="expandedSkillsOpen" ${G.readOnly?"disabled":""}>追加技・継承技・固有必殺技（${ready}件）</button>`:"");
};
function characterCanUseFacility(){return !!G.st&&!G.readOnly&&G.screen==="explore"&&!G.dlg&&!G.st.run&&!G.walk.path.length&&isSafe()&&nearbyObjects().some(o=>o.type==="jobcenter");}
function characterCanManage(){return characterCanUseFacility()&&["jobcenter","jobCenter"].includes(G.sheet)&&!G.characterSaving;}
function characterJobToken(st,cid,job){return JSON.stringify([st.saveGeneration,st.mapId,st.pos,cid,job,st.jobs[cid],st.equip[cid],st.owned,st.itemVault,st.jobEvents[job]]);}
async function characterMutate(fn){
  if(G.characterSaving||G.readOnly)return false;const st=G.st,before=clone(st);G.characterSaving=true;
  try{const result=fn(st);if(result===false)return false;const saved=await commit();if(!saved){G.st=before;toast("保存できなかったため、変更を戻しました。");return false;}return result??true;}
  finally{G.characterSaving=false;render();}
}
function renderJobcenter(){
  const st=G.st,d=G.sheetData,can=characterCanUseFacility(),view=d.view||"events";
  const nav=`<p>職業体験3段階で転職を解放。無料・レベル制限なし。</p>${can?"":'<p class="warn">転職と職業体験は、街のハローワークのそばで行います。</p>'}<div class="row3"><button class="btn ${view==="events"?"on":""}" data-a="jobcenterView" data-v="events">職業イベント</button><button class="btn ${view==="change"?"on":""}" data-a="jobcenterView" data-v="change">転職する</button></div>`;
  if(view==="events"&&st.jobEvent){
    const e=st.jobEvent,event=JOB_EVENTS[e.job],q=event.stages[e.stage],token=jobEventToken(st);
    return nav+`<h3 class="label">${esc(event.name)} ${e.stage+1}/3</h3><p>${esc(q.question)}</p>${e.wrong!=null?`<p class="warn">${esc(q.advice)}</p>`:""}<div class="stack">${q.options.map((label,i)=>`<button class="btn" data-a="jobEventAnswer" data-v="${i}" data-token="${esc(token)}" ${can?"":"disabled"}>${esc(label)}</button>`).join("")}</div><button class="btn" data-a="jobEventCancel" data-token="${esc(token)}" ${can?"":"disabled"}>この体験を中断して選び直す</button><p class="small">途中経過は保存され、どの街のハローワークでも続けられます。</p>`;
  }
  const query=String(d.query||"").normalize("NFKC").toLowerCase().trim(),words=query.split(/\s+/).filter(Boolean),list=JOB_IDS.filter(job=>words.every(w=>(JOBS[job].name+JOBS[job].field+JOB_EVENTS[job].name).normalize("NFKC").toLowerCase().includes(w)));
  const pages=Math.max(1,Math.ceil(list.length/6)),page=Math.min(Math.max(0,d.page||0),pages-1),cid=st.roster.includes(d.cid)?d.cid:st.roster[0];
  let html=nav+`${listSearchForm('job')}`;
  if(view==="change")html+=`<h3 class="label">転職する仲間</h3><div class="opts">${st.roster.map(id=>`<button class="btn ${id===cid?"on":""}" data-a="jobcenterActor" data-c="${id}">${esc(charName(st,id))}</button>`).join("")}</div>`;
  html+=`<div class="stack">${list.slice(page*6,page*6+6).map(job=>{
    const event=JOB_EVENTS[job],done=st.jobEvents[job]===true,s=charStats(st,cid,levelOf(st.xp,st),job,previewEquipFor(st,cid,job));
    return `<section class="qcard"><b>${esc(JOBS[job].name)} ${done?"体験済み":"未体験"}</b><p>${esc(view==="events"?event.name:JOB_TRAITS[job].name)}</p><p class="small">${esc(view==="events"?event.intro:JOB_TRAITS[job].text)}</p>${view==="events"?`<button class="btn" data-a="jobEventStart" data-v="${job}" ${can&&!done?"":"disabled"}>この職業を体験する</button>`:`<p class="small">変更後：体力${s.maxHP}・攻撃${s.attackPower}・防御${s.defensePower}・熟練度${s.R}。前職専用装備は外します。</p><button class="btn" data-a="characterJobSet" data-c="${cid}" data-v="${job}" data-old="${st.jobs[cid]}" data-token="${esc(characterJobToken(st,cid,job))}" ${can&&done&&st.jobs[cid]!==job?"":"disabled"}>${esc(charName(st,cid))}をこの職業へ</button>`}</section>`;
  }).join("")||'<p>見つかりません。解除で検索をリセットできます。</p>'}</div><div class="row3"><button class="btn" data-a="jobcenterPage" data-v="${page-1}" ${page>0?"":"disabled"}>前へ</button><span>${page+1}/${pages}</span><button class="btn" data-a="jobcenterPage" data-v="${page+1}" ${page+1<pages?"":"disabled"}>次へ</button></div>`;
  return html;
}
function renderCharacterSkills(){
  const st=G.st,cid=st.roster.includes(G.sheetData.cid)?G.sheetData.cid:st.roster[0],L=levelOf(st.xp,st),s=charStats(st,cid,L);
  return `<h3 class="label">${esc(charName(st,cid))}</h3><p>${esc(JOB_TRAITS[s.job].name)}：${esc(JOB_TRAITS[s.job].text)}</p><p>固有必殺技：${esc(SIGNATURES[cid].name)}。Lv5・戦闘3ターン目から、MP4・エール50で1戦闘に1回。</p><p class="small">職業技は熟練度3で継承できます。追加技はLvと職業熟練度の両方で習得し、転職後も残ります。</p><ul class="list">${(st.learnedJobs[cid]||[]).map(job=>`<li>継承：${esc(JOBS[job].skill)}</li>`).join("")||"<li>継承した職業技はまだありません。</li>"}${Object.values(EXTRA_SKILLS).filter(e=>e.job===s.job||st.learnedSkills[cid]?.includes(e.id)).map(e=>`<li>${st.learnedSkills[cid]?.includes(e.id)?"●":"○"} ${esc(e.name)}：${esc(e.description)}</li>`).join("")}</ul>`;
}
function expandedActionFromSheet(){
  const run=G.st?.run,d=G.sheetData;if(!run||G.sheet!=="battleSkills"||d.seq!==run.seq||d.turn!==run.turn)return null;
  const a=run.party[d.actor],entry=a&&availableBattleSkills(run,a).find(e=>e.id===d.skill);if(!entry)return null;
  const act={type:entry.type};if(entry.type==="inherit")act.job=entry.job;if(entry.type==="extra")act.skillId=entry.id;
  if(d.target!=null)act.target=d.target;if(d.ally!=null)act.ally=d.ally;if(d.line)act.line=d.line;if(d.mode)act.mode=d.mode;
  return act;
}
function expandedSkillEntries(run,actor,query){const words=String(query||'').normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);return availableBattleSkills(run,actor).filter(e=>words.every(w=>(e.name+' '+e.description).normalize('NFKC').toLocaleLowerCase().includes(w)));}
function expandedSkillListDescription(entry){return entry.type==='extra'?entry.description.replace(/^Lv[^。]+で習得。/,''):entry.description;}
function renderExpandedSkillSheet(){
  const run=G.st?.run,d=G.sheetData;if(!run||d.seq!==run.seq||d.turn!==run.turn)return '<p>戦闘状態が変わりました。一覧を閉じて選び直してください。</p>';
  const a=run.party[d.actor];if(!a||a.hp<=0||a.acted)return '<p>この仲間は今、行動できません。</p>';
  const query=String(d.query||''),list=expandedSkillEntries(run,a,query),selected=list.find(e=>e.id===d.skill);
  if(!selected){
    const pages=Math.max(1,Math.ceil(list.length/5)),page=Math.min(Math.max(0,d.page||0),pages-1);
    return `<p>${esc(a.name)}の技（MP${a.c}/${a.maxMP||10}・エール${run.A}）</p>${listSearchForm('skill')}<div class="stack">${list.slice(page*5,page*5+5).map(e=>{
      const ready=a.cooldowns?.[e.type==="extra"?e.id:e.type==="inherit"?"inherit:"+e.job:"signature"]||0;
      return `<button class="btn" data-a="expandedSkillPick" data-v="${e.id}">${esc(e.name)}${ready>run.turn?`（再使用まで${ready-run.turn}ターン）`:e.type==="signature"&&a.signatureUsed?"（この戦闘で使用済み）":""}<br><span class="small">${esc(expandedSkillListDescription(e))}</span></button>`;
    }).join("")||"<p>該当する技がありません。</p>"}</div><div class="row3"><button class="btn" data-a="expandedSkillPage" data-v="${page-1}" ${page>0?"":"disabled"}>前へ</button><span>${page+1}/${pages}</span><button class="btn" data-a="expandedSkillPage" data-v="${page+1}" ${page+1<pages?"":"disabled"}>次へ</button></div>`;
  }
  let need=selected.type==="signature"?"none":selected.type==="inherit"?skillNeeds(selected.job):selected.need;
  let targets="";const button=(key,value,label)=>`<button class="btn ${d[key]===value?"on":""}" aria-pressed="${d[key]===value}" data-a="expandedSkillTarget" data-k="${key}" data-v="${value}">${esc(label)}</button>`;
  const enemies=()=>run.enemies.filter(e=>e.hp>0).map(e=>button("target",e.slot,e.display)).join("");
  const allies=other=>run.party.filter(m=>m.hp>0&&(!other||m!==a)).map(m=>button("ally",m.pos,m.name)).join("");
  if(need==="enemy")targets=enemies();if(need==="ally")targets=allies(false);if(need==="allyOther")targets=allies(true);
  if(need==="line")targets=["greet","plan","thanks"].map(line=>button("line",line,LINE_NAMES[line])).join("");
  if(need==="mode"){
    const modes=selected.job==="J04"?[["hp","体力補給"],["c","MP補給"]]:[["safe","堅実"],["bold","強気"]];targets=modes.map(([key,label])=>button("mode",key,label)).join("");
    if(["hp","c"].includes(d.mode))targets+=allies(d.mode==="c");if(["safe","bold"].includes(d.mode))targets+=enemies();
  }
  const act=expandedActionFromSheet(),p=act&&planAction(run,a.pos,act);
  return `<h3 class="label">${esc(selected.name)}</h3><p>${esc(selected.description)}</p>${targets?`<div class="stack" role="group" aria-label="対象・使い方">${targets}</div>`:''}<p>${p?.ok?previewText(run,a,p):esc(p?.reason||"対象を選んでください。")}</p><button class="btn primary" data-a="expandedSkillConfirm" ${p?.ok&&!G.readOnly?"":"disabled"}>この技を確定</button><button class="btn" data-a="expandedSkillBack">技一覧へ戻る</button>`;
}
function renderTrainingSheet(){
  const can=G.screen==="explore"&&!G.st.run&&!G.dlg&&MAPS[G.st.mapId].kind==="field";
  return `<p>街外の標的で、10ターン以内の実技に挑みます。全戦闘でオート利用可。5ターン以内の勝利で「締め前の余裕」を狙えます。</p>${can?"":'<p class="warn">街の出口から街外へ出てから挑戦できます。</p>'}<div class="stack">${JOB_IDS.map(job=>`<button class="btn" data-a="trainingStart" data-v="${job}" ${can&&!G.readOnly?"":"disabled"}>${esc(JOBS[job].name)}の実技${G.st.trainingWins?.[job]?"（達成済み）":""}</button>`).join("")}</div>`;
}
Object.assign(ACT,{
  jobcenterView(el){if(!["jobcenter","jobCenter"].includes(G.sheet)||!["events","change"].includes(el.dataset.v))return;G.sheetData={view:el.dataset.v};render();},
  jobcenterSearch(){if(!["jobcenter","jobCenter"].includes(G.sheet))return;G.sheetData.query=$("#jobcenterSearch")?.value||"";G.sheetData.page=0;render();},
  jobcenterPage(el){if(!["jobcenter","jobCenter"].includes(G.sheet))return;const n=Number(el.dataset.v);if(!Number.isInteger(n)||n<0)return;G.sheetData.page=n;render();},
  jobcenterActor(el){if(!["jobcenter","jobCenter"].includes(G.sheet)||!G.st.roster.includes(el.dataset.c))return;G.sheetData.cid=el.dataset.c;render();},
  jobEventStart(el){if(!characterCanManage()||G.st.jobEvent)return;return characterMutate(st=>startJobEvent(st,el.dataset.v));},
  jobEventAnswer(el){if(!characterCanManage())return;return characterMutate(st=>{const r=answerJobEvent(st,Number(el.dataset.v),el.dataset.token);if(!r.ok)return false;if(r.complete)toast(`${JOBS[r.job].name}へ転職できるようになりました。`);return true;});},
  jobEventCancel(el){if(!characterCanManage()||el.dataset.token!==jobEventToken(G.st))return;return characterMutate(st=>{st.jobEvent=null;return true;});},
  characterJobSet(el){
    if(!characterCanManage())return;const cid=el.dataset.c,job=el.dataset.v,st=G.st;
    if(G.sheetData.view!=="change"||cid!==(G.sheetData.cid||st.roster[0])||el.dataset.token!==characterJobToken(st,cid,job)||!canChangeJob(st,cid,job)||st.jobs[cid]!==el.dataset.old||st.jobs[cid]===job)return;
    const equip=previewEquipFor(st,cid,job);if(!equipmentSetFits(st,cid,equip))return toast("未装備品の上限を超えます。金庫へ整理してください。");
    return characterMutate(next=>{next.jobs[cid]=job;next.equip[cid]=equip;ensureVitals(next);toast(`${charName(next,cid)}は${JOBS[job].name}になった。`);return true;});
  },
  characterSkills(el){if(!G.st.roster.includes(el.dataset.c))return;G.sheet="characterSkills";G.sheetData={cid:el.dataset.c};render();},
  expandedSkillsOpen(){const run=G.st?.run;if(G.readOnly||G.screen!=="battle"||G.sheet||G.dlg||!run||run.state!=="input")return;const a=run.party[G.cmd.actor];if(!a||a.hp<=0||a.acted)return;G.auto=false;clearTimeout(G.autoT);G.sheet="battleSkills";G.sheetData={actor:a.pos,seq:run.seq,turn:run.turn};render();},
  expandedSkillSearch(){if(G.sheet!=="battleSkills")return;G.sheetData.query=$("#expandedSkillSearch")?.value||"";G.sheetData.page=0;render();},
  expandedSkillPage(el){if(G.sheet!=="battleSkills")return;const n=Number(el.dataset.v);if(!Number.isInteger(n)||n<0)return;G.sheetData.page=n;render();},
  expandedSkillPick(el){if(G.sheet!=="battleSkills")return;const run=G.st?.run,a=run?.party[G.sheetData.actor];if(!a||!availableBattleSkills(run,a).some(e=>e.id===el.dataset.v))return;G.sheetData.skill=el.dataset.v;delete G.sheetData.target;delete G.sheetData.ally;delete G.sheetData.mode;delete G.sheetData.line;render();},
  expandedSkillTarget(el){if(G.sheet!=="battleSkills"||!["target","ally","line","mode"].includes(el.dataset.k))return;G.sheetData[el.dataset.k]=["target","ally"].includes(el.dataset.k)?Number(el.dataset.v):el.dataset.v;render();},
  expandedSkillBack(){if(G.sheet!=="battleSkills")return;delete G.sheetData.skill;render();},
  expandedSkillConfirm(){if(G.readOnly||G.screen!=="battle"||G.dlg||G.sheet!=="battleSkills")return;const act=expandedActionFromSheet(),run=G.st?.run,d=G.sheetData;if(!act||!run||run.state!=="input"||!planAction(run,d.actor,act).ok)return;G.cmd={actor:d.actor};G.sheet=null;confirmAct(act);},
  trainingStart(el){if(G.readOnly||G.screen!=="explore"||G.sheet!=="training"||G.dlg||G.st.run||G.walk.path.length||MAPS[G.st.mapId].kind!=="field")return;const run=createTrainingRun(G.st,el.dataset.v);if(run)startBattle(run);}
});
