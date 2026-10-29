/* ペット育成・同行・支援。表示プレビューは元の保存データを変更しない。 */
const petBound=n=>Math.max(0,Math.min(100,Number.isFinite(Number(n))?Math.floor(Number(n)):0));
const petSpecies=id=>typeof id==="string"&&Object.hasOwn(PET_SPECIES,id)?PET_SPECIES[id]:null;
function petStage(p){return PET_GROWTH_THRESHOLDS.filter(n=>n<=petBound(p?.bond)).length;}
function petDefault(id){return {id,name:PET_SPECIES[id].name,bond:0,fullness:50,mood:50,clean:50,policy:"heal",daily:{},celebrations:[],details:false};}
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
  if(!ps.owned||typeof ps.owned!=="object"||Array.isArray(ps.owned))ps.owned={};
  for(const [id,p] of Object.entries(ps.owned)){
    if(!petSpecies(id)||!p||typeof p!=="object")continue;
    p.id=id;p.name=typeof p.name==="string"&&p.name.trim()?Array.from(p.name.trim()).slice(0,12).join(""):PET_SPECIES[id].name;
    for(const k of ["bond","fullness","mood","clean"])p[k]=petBound(p[k]??(k==="bond"?0:50));
    if(!["heal","support"].includes(p.policy))p.policy="heal";
    if(!p.daily||typeof p.daily!=="object"||Array.isArray(p.daily))p.daily={};
    if(!Array.isArray(p.celebrations))p.celebrations=[];
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
function carePet(st,id,action,supplyId){const offer=petCarePreview(st,id,action,supplyId);if(!offer.ok)return offer;const p=petOwned(st,id),before=petStage(p);for(const [k,n] of Object.entries(offer.gains))p[k]+=n;if(offer.item)bagRemove(st.bag,offer.item,1);p.daily[action]=st.day;return {...offer,ok:true,stage:petStage(p),sound:petStage(p)>before?"petgrow":"pet"};}
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
function walkPet(st,id,place){const offer=petWalkPreview(st,id,place);if(!offer.ok)return offer;const received=petReceive(st,offer.item,1);if(!received.ok)return received;const p=petOwned(st,id);p.bond+=offer.gains.bond;p.mood+=offer.gains.mood;st.petState.walkDay=st.day;return {...offer,...received,sound:"pet"};}
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
function petTravelHelp(st,policy){const offer=petTravelPreview(st,policy);if(!offer.ok)return offer;ensureVitals(st);for(const t of offer.targets){st.vitals[t.cid].hp+=t.hp;st.vitals[t.cid].c+=t.mp;}st.petState.travelDay=st.day;st.petState.travelPolicy=policy;return offer;}
function preparePetRun(st,run){
  if(!run||Array.isArray(run.pets))return run;
  if(st)for(const m of run.party){const stats=charStats(st,m.cid,run.L);if(!Number.isFinite(m.maxMP))m.maxMP=stats.startC;}
  const ps=petData(st);run.pets=(ps?.companions||[]).map(id=>{const p=petOwned(st,id);return p?{id,name:p.name,bond:p.bond,stage:petStage(p),policy:p.policy,rarity:PET_SPECIES[id].rarity}:null;}).filter(Boolean).slice(0,2);
  run.petHistory={actions:0,species:[],healedHP:false,healedMP:false,support:false,targets:[],boostedHit:false,stopped:false};
  return run;
}
function petTurnStart(st,run){
  if(!run||run.state!=="input"||!Number.isInteger(run.turn)||run.turn<1||run.petProcessedTurn===run.turn)return [];
  if(!Array.isArray(run.pets))preparePetRun(st,run);
  run.petProcessedTurn=run.turn;run.petHistory=run.petHistory||{actions:0,species:[],healedHP:false,healedMP:false,support:false,targets:[],boostedHit:false,stopped:false};
  const history=run.petHistory,logs=[];
  const members=()=>run.party.filter(m=>m.hp>0);
  for(const pet of run.pets){
    if(run.state!=="input"||!members().length||!run.enemies.some(e=>e.hp>0))break;
    const spec=PET_SPECIES[pet.id];if(!spec)continue;
    const learned=spec.skills.map(id=>PET_SKILLS[id]).filter(s=>s.stage<=pet.stage);
    const ordered=learned.sort((a,b)=>Number(b.family===(pet.policy==="support"?"support":"heal"))-Number(a.family===(pet.policy==="support"?"support":"heal"))||b.stage-a.stage);
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
        const enemy=run.enemies.find(e=>e.hp>0&&!(e.petStunTurns>0)&&(!e.petStunUntil||run.turn>=e.petStunUntil));
        if(enemy){enemy.petStunTurns=1;enemy.petStunUntil=run.turn+3;amount=1;history.support=true;message=`${enemy.display}の次の行動を1回止める`;} 
      }
      if(amount>0){
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
  if(id==="B079")return has("attack");if(id==="B080")return has("slow");return false;
}
function petSpriteSvg(id,stage=1){
  const s=PET_SPECIES[id]||PET_SPECIES.PT01,g=Math.max(1,Math.min(10,stage)),color=s.color;
  const long=["rabbit","deer","alpaca"].includes(s.shape),wings=["bird","owl","penguin","dragon"].includes(s.shape),ears=long?'<path d="M15 16V3h5v13M27 16V3h5v13"/>':'<path d="M12 17V8l9 8M27 16l8-8v10"/>';
  const shell=s.shape==="turtle"?'<ellipse cx="24" cy="30" rx="15" ry="11" fill="#55785b"/><path d="m24 22 6 5v7l-6 5-6-5v-7z" fill="#91ab6f"/>':'';
  const spots=["cat","panda","raccoon","hedgehog"].includes(s.shape)?'<path d="M10 18h8v7h-8M30 18h8v7h-8" fill="#55545d"/>':'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="${s.name} 成長${g}"><g stroke="#25364b" stroke-width="2" fill="${color}">${ears}<ellipse cx="24" cy="31" rx="${11+Math.floor(g/3)}" ry="11"/>${wings?'<path d="m12 26-9 6 10 5M36 26l9 6-10 5"/>':''}<rect x="10" y="14" width="28" height="22" rx="10"/>${spots}${shell}<path d="M15 40h7M27 40h7"/><circle cx="18" cy="23" r="2" fill="#25364b"/><circle cx="30" cy="23" r="2" fill="#25364b"/><path d="m21 29 3 2 3-2" fill="none"/>${g>=5?'<path d="m15 35 9 4 9-4" stroke="#d6b44d" stroke-width="3"/>':''}${g>=8?'<path d="m19 11 2-5 3 4 4-5 2 6z" fill="#e5c45d"/>':''}</g></svg>`;
}
// 新規開始への導入。旧セーブ移行は UI 側の migrate ラッパーから実施する。
const petBaseNewGame=newGame;
newGame=function(...args){return migratePets(petBaseNewGame(...args));};
