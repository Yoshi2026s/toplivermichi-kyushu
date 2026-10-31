/* ペット育成・同行・支援。表示プレビューは元の保存データを変更しない。 */
const petBound=n=>Math.max(0,Math.min(100,Number.isFinite(Number(n))?Math.floor(Number(n)):0));
const petSpecies=id=>typeof id==="string"&&Object.hasOwn(PET_SPECIES,id)?PET_SPECIES[id]:null;
function petStage(p){return PET_GROWTH_THRESHOLDS.filter(n=>n<=petBound(p?.bond)).length;}
function petDefault(id){return {id,name:PET_SPECIES[id].name,bond:0,fullness:50,mood:50,clean:50,policy:"heal",daily:{},celebrations:[],details:false,memories:[],preferredSkill:null};}
function petData(st){return st.petState&&st.petState.version===1?st.petState:null;}
function migratePets(st){
  if(!st||typeof st!=="object")return st;
  if(!petData(st)){
    const legacy=st.pets;
    st.petState={version:1,owned:{},companions:[],favorite:null,walkDay:0,travelDay:0,travelPolicy:"balanced"};
    if(legacy&&typeof legacy==="object"){
      const entries=Array.isArray(legacy)?legacy.map((v,i)=>[v?.id||`PT${String(i+1).padStart(2,"0")}`,v]):Object.entries(legacy);
      for(const [key,v] of entries){
        const match=String(v?.speciesId||v?.species||key).match(/^(?:PT|PET|P)[-_]?0*(\d{1,2})$/i),id=petSpecies(key)?key:match?`PT${match[1].padStart(2,"0")}`:null;
        if(!id||!petSpecies(id)||!v||typeof v!=="object")continue;
        st.petState.owned[id]={...petDefault(id),...v,id,bond:petBound(v.bond??v.affection??v.friendly??0)};
      }
      // 元の項目を消さない。識別できない旧形式もバックアップ内に保持する。
    }
  }
  const ps=st.petState;
  if(!Array.isArray(ps.journal))ps.journal=[];ps.journal=ps.journal.filter(e=>e&&Number.isSafeInteger(e.day)&&typeof e.text==="string").slice(-30);
  if(!ps.owned||typeof ps.owned!=="object"||Array.isArray(ps.owned))ps.owned={};
  for(const [id,p] of Object.entries(ps.owned)){
    if(!petSpecies(id)||!p||typeof p!=="object")continue;
    p.id=id;p.name=typeof p.name==="string"&&p.name.trim()?Array.from(p.name.trim()).slice(0,12).join(""):PET_SPECIES[id].name;
    for(const k of ["bond","fullness","mood","clean"])p[k]=petBound(p[k]??(k==="bond"?0:50));
    if(!["heal","support"].includes(p.policy))p.policy="heal";
    if(!PET_SPECIES[id].skills.includes(p.preferredSkill))p.preferredSkill=null;
    if(!p.daily||typeof p.daily!=="object"||Array.isArray(p.daily))p.daily={};
    if(!Array.isArray(p.celebrations))p.celebrations=[];
    if(!Array.isArray(p.memories))p.memories=[];p.memories=[...new Set(p.memories.filter(v=>[1,3,5,8,10].includes(v)))];
  }
  if(!Object.keys(ps.owned).some(id=>petSpecies(id)))ps.owned.PT01=petDefault("PT01");
  if(!Array.isArray(ps.companions))ps.companions=[];
  ps.companions=[...new Set(ps.companions)].filter(id=>petSpecies(id)&&Object.hasOwn(ps.owned,id)).slice(0,2);
  if(!ps.favorite||!petSpecies(ps.favorite)||!Object.hasOwn(ps.owned,ps.favorite))ps.favorite=Object.keys(ps.owned).find(id=>petSpecies(id));
  if(!["balanced","hp","mp"].includes(ps.travelPolicy))ps.travelPolicy="balanced";
  if(!Number.isSafeInteger(ps.walkDay)||ps.walkDay<0)ps.walkDay=0;
  if(!Number.isSafeInteger(ps.travelDay)||ps.travelDay<0)ps.travelDay=0;
  return st;
}
function petOwned(st,id){const owned=petData(st)?.owned,p=owned&&Object.hasOwn(owned,id)?owned[id]:null;return petSpecies(id)&&p?p:null;}
function petProgressCount(st){return Object.entries(QUESTS).filter(([id,q])=>q.main&&st.quests?.[id]==="complete").length;}
function petAdoptPreview(st,id){
  const s=petSpecies(id);if(!s)return {ok:false,reason:"この種類は登録されていません。"};
  if(petOwned(st,id))return {ok:false,reason:"もう家族になっています。"};
  if(petProgressCount(st)<s.unlockCount)return {ok:false,reason:`本編依頼を${s.unlockCount}件終えると出会えます。`};
  if(st.tickets<s.adoptionTickets)return {ok:false,reason:`チケットが${s.adoptionTickets-st.tickets}枚足りません。`};
  return {ok:true,cost:s.adoptionTickets};
}
function adoptPet(st,id){const offer=petAdoptPreview(st,id);if(!offer.ok)return offer;migratePets(st);st.tickets-=offer.cost;st.petState.owned[id]=petDefault(id);return {ok:true,pet:st.petState.owned[id],sound:"petgrow",log:`${PET_SPECIES[id].name}が家族になった。`};}
function petCarePreview(st,id,action,supplyId){
  const p=petOwned(st,id);if(!p||!Object.hasOwn(PET_CARE_TYPES,action))return {ok:false,reason:"ペットとお世話を選び直してください。"};
  if(p.daily[action]===st.day)return {ok:false,reason:"今日は完了しています。"};
  let effects,item=null;
  if(action==="practice")effects={bond:3,mood:2};
  else if(action==="pat")effects={bond:1,mood:3};
  else{
    item=PET_SUPPLIES[supplyId];
    if(!item||item.petSpecies!==id||item.petCare!==action)return {ok:false,reason:"対応する用品を選んでください。"};
    if(bagCount(st.bag,item.id)<1)return {ok:false,reason:bagCount(st.itemVault||[],item.id)?"用品は金庫にあります。用品を選び、数量を確認して引き出してください。":"この用品を持っていません。"};
    effects=item.petEffects;
  }
  const gains=Object.fromEntries(Object.entries(effects).map(([k,n])=>[k,Math.min(n,100-p[k])]));
  if(!Object.values(gains).some(n=>n>0))return {ok:false,reason:"今は効果がありません。用品も今日の回数も消費しません。",gains};
  return {ok:true,gains,item:item?.id||null,consumes:!!item};
}
function carePet(st,id,action,supplyId){const offer=petCarePreview(st,id,action,supplyId);if(!offer.ok)return offer;const p=petOwned(st,id),before=petStage(p);for(const [k,n] of Object.entries(offer.gains))p[k]+=n;if(offer.item)bagRemove(st.bag,offer.item,1);p.daily[action]=st.day;petRemember(st,id,PET_CARE_TYPES[action]+"をした");return {...offer,ok:true,stage:petStage(p),sound:petStage(p)>before?"petgrow":"pet"};}
function petReceivePreview(st,id,n=1){
  if(!ITEMS[id]||!Number.isSafeInteger(n)||n<1)return {ok:false,reason:"用品を確認してください。"};
  const bagged=Math.min(n,bagRoom(st.bag,id)),vaulted=n-bagged;
  if(vaulted>Math.max(0,ITEM_VAULT_MAX-itemVaultCount(st)))return {ok:false,reason:"手持ちとアイテム金庫が満杯です。",bagged:0,vaulted:0};
  return {ok:true,bagged,vaulted,where:vaulted?(bagged?"手持ちと金庫":"金庫"):"手持ち"};
}
function petReceive(st,id,n=1){const preview=petReceivePreview(st,id,n);if(!preview.ok)return preview;const bagged=bagAdd(st.bag,id,preview.bagged),vaulted=preview.vaulted?itemVaultAdd(st,id,preview.vaulted):0;return {...preview,ok:bagged+vaulted===n};}
function petCelebrationPreview(st,id,threshold){
  const p=petOwned(st,id);if(!p||![20,50,80].includes(threshold))return {ok:false,reason:"お祝いを選び直してください。"};
  if(p.celebrations.includes(threshold))return {ok:false,reason:"受取済みです。"};
  if(p.bond<threshold)return {ok:false,reason:`なつき度${threshold}で受け取れます。`};
  const item=`${id}-feed-${threshold===20?1:threshold===50?2:3}`,quantity=3;
  return {...petReceivePreview(st,item,quantity),item,quantity,threshold};
}
function claimPetCelebration(st,id,threshold){const offer=petCelebrationPreview(st,id,threshold);if(!offer.ok)return offer;const r=petReceive(st,offer.item,offer.quantity);if(!r.ok)return r;petOwned(st,id).celebrations.push(threshold);return {...offer,...r,sound:"petgrow"};}
function petWalkPreview(st,id,place){
  const p=petOwned(st,id),where=Object.hasOwn(PET_WALK_PLACES,place)?PET_WALK_PLACES[place]:null;if(!p||!where)return {ok:false,reason:"行き先を選び直してください。"};
  if(st.petState.walkDay===st.day)return {ok:false,reason:"今日のおさんぽは完了。全ペット・全行き先で1日1回です。"};
  const item=`${id}-${where.care}-${where.tier}`,gains={bond:Math.min(2,100-p.bond),mood:Math.min(4,100-p.mood)};
  return {...petReceivePreview(st,item,1),item,quantity:1,gains};
}
function walkPet(st,id,place){const offer=petWalkPreview(st,id,place);if(!offer.ok)return offer;const received=petReceive(st,offer.item,1);if(!received.ok)return received;const p=petOwned(st,id);p.bond+=offer.gains.bond;p.mood+=offer.gains.mood;st.petState.walkDay=st.day;petRemember(st,id,"おさんぽに行った");return {...offer,...received,sound:"pet"};}
function petTravelPreview(st,policy){
  const ps=petData(st),p=ps&&petOwned(st,ps.favorite),rule=Object.hasOwn(PET_TRAVEL_POLICIES,policy)?PET_TRAVEL_POLICIES[policy]:null;
  if(!p||!rule)return {ok:false,reason:"お気に入りのペットと回復方針を選んでください。",targets:[]};
  if(st.run)return {ok:false,reason:"旅のお手伝いは戦闘の外で使えます。",targets:[]};
  if(petStage(p)<3)return {ok:false,reason:"お気に入りが成長3で覚えるMP回復を習得すると使えます。",targets:[]};
  if(ps.travelDay===st.day)return {ok:false,reason:"今日のお手伝いは完了。全ペット共通で1日1回です。",targets:[]};
  const stage=petStage(p),hpRate=(5+stage)*rule.hp,mpRate=(10+stage)*rule.mp,L=levelOf(st.xp,st);
  const targets=st.party.map(cid=>{const stats=charStats(st,cid,L),v=st.vitals?.[cid]||{hp:stats.maxHP,c:stats.startC};return {cid,name:charName(st,cid),alive:v.hp>0,hp:v.hp>0?Math.min(stats.maxHP-v.hp,Math.ceil(stats.maxHP*hpRate/100)):0,mp:v.hp>0?Math.min(stats.startC-v.c,Math.ceil(stats.startC*mpRate/100)):0};});
  if(!targets.some(t=>t.alive))return {ok:false,reason:"生存する回復対象がいません。ペットは蘇生できません。",targets,hpRate,mpRate};
  if(!targets.some(t=>t.hp>0||t.mp>0))return {ok:false,reason:policy==="mp"?"生存メンバーのMPは十分です。HPを回復する場合は『バランス』か『HP重視』を選んでください。":policy==="hp"?"生存メンバーのHPは十分です。MPを回復する場合は『バランス』か『MP重視』を選んでください。":"生存メンバーのHP・MPは十分です。回復不要のため今日の回数は消費しません。",targets,hpRate,mpRate};
  return {ok:true,targets,hpRate,mpRate};
}
function petTravelHelp(st,policy){const offer=petTravelPreview(st,policy);if(!offer.ok)return offer;ensureVitals(st);for(const t of offer.targets){st.vitals[t.cid].hp+=t.hp;st.vitals[t.cid].c+=t.mp;}st.petState.travelDay=st.day;st.petState.travelPolicy=policy;petRemember(st,st.petState.favorite,"旅のお手伝いをした");return offer;}
function preparePetRun(st,run){
  if(!run)return run;
  if(Array.isArray(run.pets)){const ids=new Set();run.pets=run.pets.filter(p=>p&&petSpecies(p.id)&&!ids.has(p.id)&&ids.add(p.id)).slice(0,2).map(p=>({...p,stage:Math.max(1,Math.min(10,Number(p.stage)||1)),rarity:PET_SPECIES[p.id].rarity,policy:p.policy==="support"?"support":"heal"}));return run;}
  if(st)for(const m of run.party){const stats=charStats(st,m.cid,run.L);if(!Number.isFinite(m.maxMP))m.maxMP=stats.startC;}
  const ps=petData(st);run.pets=(ps?.companions||[]).map(id=>{const p=petOwned(st,id);return p?{id,name:p.name,bond:p.bond,stage:petStage(p),policy:p.policy,preferredSkill:p.preferredSkill,rarity:PET_SPECIES[id].rarity}:null;}).filter(Boolean).slice(0,2);
  run.petHistory={actions:0,species:[],healedHP:false,healedMP:false,support:false,targets:[],boostedHit:false,stopped:false};
  return run;
}
function petTurnStart(st,run){
  if(!run||run.state!=="input"||!Number.isInteger(run.turn)||run.turn<1||run.petProcessedTurn===run.turn)return [];
  if(!Array.isArray(run.pets))preparePetRun(st,run);
  run.petProcessedTurn=run.turn;run.petHistory=run.petHistory||{actions:0,species:[],healedHP:false,healedMP:false,support:false,targets:[],boostedHit:false,stopped:false};
  const history=run.petHistory,logs=[];run.petTurnActions=[];
  const members=()=>run.party.filter(m=>m.hp>0);
  for(const pet of run.pets){
    if(run.state!=="input"||!members().length||!run.enemies.some(e=>e.hp>0))break;
    const spec=PET_SPECIES[pet.id];if(!spec)continue;
    const learned=spec.skills.map(id=>PET_SKILLS[id]).filter(s=>s.stage<=pet.stage);
    const ordered=learned.sort((a,b)=>Number(b.id===pet.preferredSkill)-Number(a.id===pet.preferredSkill)||Number(b.family===(pet.policy==="support"?"support":"heal"))-Number(a.family===(pet.policy==="support"?"support":"heal"))||b.stage-a.stage);
    let done=false;
    for(const skill of ordered){
      const targets=members(),scale=pet.stage+pet.rarity;let target=null,amount=0,message="";
      if(skill.kind==="hp"){
        target=targets.filter(t=>t.hp<t.maxHP).sort((a,b)=>a.hp/a.maxHP-b.hp/b.maxHP)[0];
        if(target){amount=Math.min(target.maxHP-target.hp,Math.ceil(target.maxHP*(4+scale)/100));target.hp+=amount;history.healedHP=history.healedHP||amount>0;message=`${target.name}の体力＋${amount}`;}
      }else if(skill.kind==="mp"){
        target=targets.filter(t=>t.c<(t.maxMP||t.startC||10)).sort((a,b)=>a.c-b.c)[0];
        if(target){amount=Math.min((target.maxMP||target.startC||10)-target.c,1+Math.floor(scale/5));target.c+=amount;history.healedMP=history.healedMP||amount>0;message=`${target.name}のMP＋${amount}`;}
      }else if(skill.kind==="attack"){
        const eligible=targets.filter(t=>!(t.petAttackBonus>0));
        if(eligible.length){amount=2+Math.ceil(scale/3);for(const t of eligible)t.petAttackBonus=amount;history.support=true;message=`生存メンバーの攻撃をこのターン＋${amount}`;}
      }else if(skill.kind==="ward"){
        const eligible=targets.filter(t=>t.ward<8);if(eligible.length){amount=1+Math.floor(scale/5);for(const t of eligible)t.ward=Math.min(8,t.ward+amount);history.support=true;message=`生存メンバーに防護＋${amount}`;}
      }else if(skill.kind==="cheer"){
        amount=Math.min(100-run.A,2+Math.floor(scale/2));if(amount>0){run.A+=amount;history.support=true;message=`エール＋${amount}`;}
      }else if(skill.kind==="slow"){
        const enemy=run.enemies.find(e=>e.hp>0&&!e.petSleep&&!e.petConfuse&&run.turn>=(e.petControlReady||0)&&!(e.petStunTurns>0)&&(!e.petStunUntil||run.turn>=e.petStunUntil));
        if(enemy){enemy.petStunTurns=1;enemy.petControlReady=run.turn+3;enemy.petStunUntil=run.turn+3;amount=1;history.support=true;message=`${enemy.display}の次の行動を1回止める`;}
      }
      if(!amount&&["defense","speed","weaken","confuse","sleep"].includes(skill.kind)){const result=petSupportEffect(run,pet,skill);amount=result.amount;message=result.message;}
      if(amount>0){
        run.petTurnActions.push({id:pet.id,name:pet.name,skill:skill.name,effect:message,turn:run.turn});
        history.actions++;if(!history.species.includes(pet.id))history.species.push(pet.id);
        if(target&&!history.targets.includes(target.cid))history.targets.push(target.cid);
        logs.push(`${pet.name}の「${skill.name}」！ ${message}。`);done=true;break;
      }
    }
    if(!done)logs.push(`${pet.name}はそばで見守っている（今は有効な技なし）。`);
  }
  if(logs.length)run.log=[...(run.log||[]),...logs].slice(-80);
  return logs;
}
function petBattleBadges(run){
  const h=run.petHistory;if(!h)return [];
  return [h.actions>0?"B071":null,h.healedHP?"B072":null,h.support?"B073":null,h.species.length>=2?"B074":null,h.actions>=2?"B075":null,h.healedMP?"B076":null,h.targets.includes("hero")?"B077":null,h.targets.includes("moe")?"B078":null,h.boostedHit?"B079":null,h.stopped?"B080":null].filter(Boolean);
}
function petBadgeApplicable(run,id){
  if(!Object.hasOwn(PET_BADGES,id))return true;
  const pets=run.pets||[],skills=pets.flatMap(p=>(PET_SPECIES[p.id]?.skills||[]).map(id=>PET_SKILLS[id]).filter(s=>s.stage<=p.stage));
  const has=kind=>skills.some(s=>s.kind===kind),heal=has("hp")||has("mp");
  if(id==="B071"||id==="B075")return pets.length>0;
  if(id==="B072")return has("hp");if(id==="B073")return skills.some(s=>s.family==="support");
  if(id==="B074")return pets.length>=2;if(id==="B076")return has("mp");
  if(id==="B077")return heal&&run.party.some(m=>m.cid==="hero");
  if(id==="B078")return heal&&run.party.some(m=>m.cid==="moe");
  if(id==="B079")return has("attack");if(id==="B080")return ["slow","sleep","confuse"].some(has);return false;
}
function petSpriteSvg(id,stage=1){
 if(typeof SOFT_ART!=="undefined")return SOFT_ART.petSvg(id,stage);
 const s=PET_SPECIES[id]||PET_SPECIES.PT01,g=Math.max(1,Math.min(10,stage)),k=s.shape,c=s.color;
 const bird=['bird','owl','penguin'].includes(k),water=['seal','otter'].includes(k),long=['rabbit','alpaca','deer'].includes(k);
 const fur=k==='hedgehog'?'<path d="M20 66 10 47 21 47 15 30 28 34 29 19 42 29 49 15 59 29 73 22 75 40 87 39 80 65Z" fill="#78604e"/>':k==='sheep'?Array.from({length:10},(_,i)=>{const a=i*Math.PI/5;return '<circle cx="'+(48+Math.cos(a)*24)+'" cy="'+(53+Math.sin(a)*20)+'" r="12" fill="'+c+'"/>';}).join(''):'';
 const tail=['fox','squirrel','raccoon','panda','cat','wolf','dog'].includes(k)?'<path d="M68 65Q95 64 83 32Q69 37 76 53Q66 48 62 61" fill="'+c+'"/><path d="M83 32Q89 42 86 48L77 45Z" fill="#f8e5c4"/>':'';
 const ears=long?'<path d="M30 32Q17 0 29 4Q38 8 39 31M55 30Q59 1 69 5Q77 13 64 35Z"/><path d="M31 26 29 12M62 26 66 13" stroke="#d5a5a0" stroke-width="4"/>':bird||water||k==='turtle'?'':k==='koala'?'<circle cx="23" cy="34" r="13"/><circle cx="72" cy="34" r="13"/>':'<path d="M25 35 21 12Q34 13 40 30M56 30Q66 13 76 13L71 37Z"/>';
 const wings=bird?'<path d="M28 48Q7 48 19 73L33 66M67 48Q89 48 78 73L64 67"/>':k==='dragon'?'<path d="M27 53 5 27 8 61 28 70M69 53 91 27 88 61 68 70" fill="#7e84b3"/>':'';
 const body=water?'<ellipse cx="48" cy="66" rx="31" ry="17"/><path d="M22 65 8 79 31 76M70 66 88 79 67 78"/>':k==='turtle'?'<ellipse cx="49" cy="61" rx="29" ry="23" fill="#58856c"/><path d="M48 41 63 50V67L48 78 33 67V50Z" fill="#98b17b"/><path d="M33 50 23 48M63 50 76 48M33 67 23 74M63 67 76 74" fill="none"/>':'<ellipse cx="48" cy="63" rx="23" ry="22"/>';
 const head=k==='alpaca'?'<path d="M33 63V35Q25 15 46 15Q64 16 61 35L61 65Z"/>':k==='turtle'?'<ellipse cx="47" cy="33" rx="18" ry="15"/>':'<path d="M23 43Q20 23 47 23Q76 22 74 45Q74 65 49 66Q23 66 23 43Z"/>';
 const mask=['panda','raccoon','owl','penguin'].includes(k)?'<path d="M27 38Q36 29 43 40L41 49 28 49ZM54 40Q65 28 71 38L69 49 56 49Z" fill="#3d414c"/>':k==='cat'?'<path d="M24 33 38 26 39 37 27 42ZM58 26 73 34 69 42 58 36Z" fill="'+(id==='PT20'?'#788899':'#b4774f')+'"/>':'';
 const eyeY=k==='turtle'?34:44;
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="'+s.name+' 成長'+g+'"><defs><radialGradient id="fur-'+id+'-'+g+'" cx="32%" cy="20%" r="85%"><stop stop-color="#fff1d8"/><stop offset=".35" stop-color="'+c+'"/><stop offset="1" stop-color="'+c+'" stop-opacity=".72"/></radialGradient></defs><ellipse cx="49" cy="85" rx="30" ry="5" fill="#102333" opacity=".18"/><g stroke="#34404b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="url(#fur-'+id+'-'+g+')">'+tail+fur+ears+body+wings+'<ellipse cx="35" cy="81" rx="9" ry="5"/><ellipse cx="61" cy="81" rx="9" ry="5"/>'+head+(k==='penguin'?'<ellipse cx="48" cy="65" rx="14" ry="16" fill="#f4e9ce" stroke="none"/>':'')+mask+'<ellipse cx="48" cy="55" rx="14" ry="8" fill="#fff0d6" stroke="none"/>'+[35,60].map(x=>'<ellipse cx="'+x+'" cy="'+eyeY+'" rx="4" ry="5.5" fill="#273747"/><circle cx="'+(x-1)+'" cy="'+(eyeY-2)+'" r="1.5" fill="#fff" stroke="none"/>').join('')+(bird?'<path d="m43 53 5 7 6-7Z" fill="#e5b46c"/>':'<path d="m44 52 4 4 5-4Z" fill="#58474a"/><path d="M48 56v4m-6-1q6 5 12 0" fill="none"/>')+'<path d="M29 53h4m30 0h4" stroke="#d99b94" stroke-width="2.4"/>'+(['dog','fox','wolf','cat','otter'].includes(k)?'<path d="M27 59 18 56M27 62 17 62M68 59 78 56M68 62 79 62" stroke-width=".8"/>':'')+(k==='deer'?'<path d="M32 24 28 9m0 7-7-4M63 24 68 9m0 7 7-4" fill="none" stroke="#a88a64" stroke-width="3"/>':'')+(k==='dragon'?'<path d="M33 28 36 15 43 26M55 26 63 15 65 30" fill="#e3cc90"/>':'')+(g>=5?'<path d="M28 65q20 11 39 0l-3 7q-16 8-32 0Z" fill="#608f98"/><circle cx="49" cy="73" r="4" fill="#edcb7b"/>':'')+(g>=8?'<path d="m38 22-1-10 8 5 5-10 5 10 8-5-2 10Z" fill="#e9cb83"/>':'')+'</g></svg>';
}
// 新規開始への導入。旧セーブ移行は UI 側の migrate ラッパーから実施する。
const petBaseNewGame=newGame;
newGame=function(...args){return migratePets(petBaseNewGame(...args));};

function petRemember(st,id,text){const ps=petData(st),p=petOwned(st,id);if(!ps||!p)return;const stage=petStage(p);p.memories=p.memories||[];for(const n of [1,3,5,8,10])if(stage>=n&&!p.memories.includes(n))p.memories.push(n);ps.journal=[...(ps.journal||[]),{day:st.day,id,text:p.name+'と'+text}].slice(-30);}
function petActivityPreview(st,id,key){const p=petOwned(st,id),rule=Object.hasOwn(PET_ACTIVITIES,key)?PET_ACTIVITIES[key]:null;if(!p||!rule)return {ok:false,reason:'遊びを選び直してください。'};if(p.daily.activity===st.day)return {ok:false,reason:'今日は一緒に遊びました。明日また遊ぼう。'};const gains=Object.fromEntries(Object.entries(rule.gains).map(([k,n])=>[k,Math.min(n,100-p[k])]));return {ok:Object.values(gains).some(n=>n>0),gains,reason:'今は十分に満たされています。'};}
function playPetActivity(st,id,key){const offer=petActivityPreview(st,id,key);if(!offer.ok)return offer;const p=petOwned(st,id);for(const [k,n]of Object.entries(offer.gains))p[k]+=n;p.daily.activity=st.day;petRemember(st,id,PET_ACTIVITIES[key].name);return {...offer,sound:'pet',log:p.name+'はうれしそうに寄り添った。'};}
function petSupportEffect(run,pet,skill){const kind=skill.kind,targets=run.party.filter(m=>m.hp>0),power=2+Math.ceil((pet.stage+pet.rarity)/3);let amount=0,message='';
 if(kind==='defense'||kind==='speed'){const key=kind==='defense'?'petDefenseBonus':'petSpeedBonus',n=kind==='defense'?power:.12;const eligible=targets.filter(t=>!(t[key]>0));if(eligible.length){for(const t of eligible)t[key]=n;amount=n;message=kind==='defense'?'味方全員の防御＋'+power+'（このターン）':'味方全員のすばやさUP・回避率＋12%（このターン）';}}
 else{const enemy=run.enemies.find(e=>e.hp>0&&!e.petSleep&&!e.petConfuse&&!e.petStunTurns&&!(e.petWeaken>0)&&run.turn>=(e.petControlReady||0));if(enemy){amount=1;if(kind==='weaken'){enemy.petWeaken=.25;message=enemy.display+'の攻撃を25%下げる（このターン）';}else{enemy[kind==='sleep'?'petSleep':'petConfuse']=1;enemy.petControlReady=run.turn+3;message=enemy.display+(kind==='sleep'?'は眠りについた（次の行動を1回停止）':'は混乱した（次の行動は自分を攻撃）');}}}
 if(amount>0)run.petHistory.support=true;return {amount,message};}
