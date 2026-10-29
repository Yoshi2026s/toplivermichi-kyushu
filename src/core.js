/* ===== core: 計算・条件・報酬（状態はJSONで保持し、純粋関数で更新） ===== */
const XP_CAP = 10029900, JP_CAP = 1997996;
const xpFor = L => 10*(L-1)*(L+6);
const jpFor = R => 2*R*(R+1)-4;
function levelOf(xp){ let lo=1,hi=999; while(lo<hi){const m=(lo+hi+1)>>1; if(xpFor(m)<=xp) lo=m; else hi=m-1;} return lo; }
function rankOf(jp){ let lo=1,hi=999; while(lo<hi){const m=(lo+hi+1)>>1; if(jpFor(m)<=jp) lo=m; else hi=m-1;} return lo; }
const Vof = L => 1+Math.floor((L-1)/20);
const Kof = R => R>=10?3:R>=6?2:R>=3?1:0;
const clone = o => JSON.parse(JSON.stringify(o));
const charName = (st,cid) => cid==="hero" ? st.profile.name : CHARS[cid].name;

/* ---- 新規開始（第06D・16節） ---- */
function newGame(name, gender){
  const st = {
    schemaVersion:SCHEMA_VERSION, gameVersion:GAME_VERSION, saveGeneration:0,
    profile:{name, gender}, day:1, slots:6, mapId:"KY01", pos:{x:19,y:19}, dir:0,
    visitedMaps:["KY01"], visitedHubs:["KY01"], xp:0,
    roster:["hero","moe"], party:["hero","moe"], vitals:null,
    jobs:{}, jp:{}, equip:{}, owned:{CW01:8, CA01:8}, pendingGifts:[], favorite:{},
    gold:0, vaultGold:0, tickets:200, gifts:{W:{},A:{}},
    bag:INITIAL_ITEMS.map(([id,n])=>({id,n})), keep:[], itemVault:[], itemsVersion:1,
    quests:{M01:"available", M02:"locked", M03:"locked", M04:"locked", M05:"locked", M06:"locked", M07:"locked", S01:"locked", S02:"locked"}, qprog:{}, activeQuest:null,
    talked:{}, boxes:{}, cards:[], bossDefeated:{}, seen:{}, killCount:{},
    moeRank:0, run:null, runSeq:0, stream:null, lastResult:null, streamBest:{},
    support:null, scenes:{}, fukuokaClear:false,
    settings:{difficulty:"std", sound:true, soundV:2, reduceMotion:false, follow:false}
  };
  for(const c of CHAR_ORDER){
    st.jobs[c]=CHARS[c].initJob; st.jp[c]={};
    st.equip[c]={w:null,a:null,acc:null};
  }
  for(const c of st.roster){ st.equip[c].w="CW01"; st.equip[c].a="CA01"; }
  return st;
}

function transferVaultGold(st,mode,amount){
  if(!["deposit","withdraw"].includes(mode)||!Number.isSafeInteger(amount)||amount<1) return false;
  if(!Number.isSafeInteger(st.gold)||st.gold<0||!Number.isSafeInteger(st.vaultGold)||st.vaultGold<0) return false;
  const from=mode==="deposit"?st.gold:st.vaultGold;
  const to=mode==="deposit"?st.vaultGold:st.gold;
  if(amount>from||!Number.isSafeInteger(to+amount)) return false;
  if(mode==="deposit"){st.gold-=amount;st.vaultGold+=amount;}
  else {st.vaultGold-=amount;st.gold+=amount;}
  return true;
}

/* ---- 能力の導出（第16E・16G・17A節） ---- */
function jpOf(st,cid,job){ return (st.jp[cid]&&st.jp[cid][job])||0; }
function charStats(st, cid, L, jobOverride, equipOverride){
  const job = jobOverride || st.jobs[cid];
  const R = rankOf(jpOf(st,cid,job));
  const V = Vof(L);
  const eq = equipOverride || st.equip[cid];
  const w = eq.w?EQUIP[eq.w]:null, a = eq.a?EQUIP[eq.a]:null, acc = eq.acc?EQUIP[eq.acc]:null;
  const ok = it => it && (!it.job || (it.job===job && R>=it.needR));
  const W = ok(w)?w:null, A = ok(a)?a:null, X = acc;
  const S = Kof(R) + (W && W.job===job ? 1 : 0);
  const supportHP = 0;
  const maxHP = 50+6*(L-1) + 2*Math.floor(R/2) + V*(((A&&A.hp)||0)+((X&&X.hp)||0)+supportHP);
  const startC = Math.min(10, 8+(R>=5?1:0)+((W&&W.c)||0)+((A&&A.c)||0)+((X&&X.c)||0));
  return { job, R, S, V, maxHP, startC,
    wAtk:(W&&W.atk)||0, accAtk:(X&&X.atk)||0, armorD:(A&&A.d)||0,
    commentA:((W&&W.commentA)||0)+((X&&X.commentA)||0),
    rest:((A&&A.rest)||0)+((X&&X.rest)||0),
    meter:((W&&W.meter)||0)+((X&&X.meter)||0),
    family:((W&&W.family)||0)+((X&&X.family)||0),
    pouch:!!(X&&X.pouch), jobWeapon: !!(W && W.job===job) };
}

/* ---- 乱数（抽選値はcommandへ固定する） ---- */
function rand16(){ try{ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]; }catch(e){ return Math.floor(Math.random()*4294967296); } }
function randInt(n){ // 0..n-1 一様（棄却法）
  const lim = Math.floor(4294967296/n)*n; let r; do{ r=rand16(); }while(r>=lim); return r%n;
}

/* ---- 敵（第11・11E・11F・11J節） ---- */
function enemyDef(areaId, idx){ // idx 0..49
  const ar = AREAS[areaId]; const [pn, rr] = ar.list[idx]; const p = PROFILES[pn-1];
  return { id:`EN-${areaId}-${String(idx+1).padStart(3,"0")}`, areaId, profile:p[0], name:`${ar.prefix}の${p[1]}`,
    species:p[2], attr:p[3], type:p[4], baseHP:p[5], baseDEF:p[6], cycle:p[7], trait:p[8], counter:p[9],
    rarity:rr, weight:[0,250,200,125,60,20][rr], q:ar.q };
}
function pickEnemyIndex(areaId, r){ // r: 0..9999
  const ar=AREAS[areaId]; let acc=0;
  for(let i=0;i<50;i++){ acc+=[0,250,200,125,60,20][ar.list[i][1]]; if(r<acc) return i; }
  return 49;
}
function letters(i){ let s=""; i++; while(i>0){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26);} return s; }
function assignLabels(enemies){
  const groups={}; enemies.forEach(e=>{ (groups[e.id]=groups[e.id]||[]).push(e); });
  Object.values(groups).forEach(g=>{ g.sort((a,b)=>a.slot-b.slot); g.forEach((e,i)=>{ e.display = g.length===1? e.name : `${e.name} ${letters(i)}`; }); });
}

/* ---- 戦闘run作成（第07B・08節） ---- */
function buildParty(st, L, supportStartA){
  return st.party.map((cid,pos)=>{
    const s = charStats(st,cid,L);
    const v = (st.vitals&&st.vitals[cid]) || {hp:s.maxHP, c:s.startC};
    return { cid, pos, name:charName(st,cid), job:s.job, R:s.R, S:s.S, maxHP:s.maxHP, hp:Math.max(0,Math.min(s.maxHP,v.hp)), c:Math.max(0,Math.min(10,v.c)),
      ward:0, guard:false, acted:false, pouch:s.pouch, wAtk:s.wAtk, accAtk:s.accAtk, armorD:s.armorD,
      commentA:s.commentA, rest:s.rest, meter:s.meter, family:s.family, valid:0 };
  });
}
function baseRun(st, kind){
  const L = levelOf(st.xp), diff = DIFFICULTY[st.settings.difficulty];
  let A0 = diff.startA; const sup = st.support && SUPPORTS[st.support];
  if(sup) A0 += sup.startA||0;
  return { seq: st.runSeq+1, kind, L, V:Vof(L), difficulty:st.settings.difficulty, support:st.support,
    party: buildParty(st,L), enemies:[], turn:1, A:Math.min(100,A0), B:0,
    chain:{stage:0, members:[]}, kiraDone:false, firstKill:false,
    cue:null, log:[], itemHistory:[], itemHistoryComplete:true,
    actionFlags:{damageHit:false,attackHit:false,multiHit:false,attackFinish:false,skillFinish:false,meterFinish:false,commentAttack:false,ignoreDefHit:false,bigHit:false,actionCount:0,enemyAttacked:false,restUsed:false,firstTurnDamage:false,cheerSpent:false,cheerPeak:Math.min(100,A0),commentLines:[],cheerAction:false,skillUsed:false,mpRestored:false,mpSpent:false,mpTargets:[],mpGuard:false,mpRest:false,mpSkill:false,mpItem:false,mpLow:false,guardUsed:false,guardActors:[],guardHit:false,wardHit:false,zeroHit:false,heavyGuardHit:false,criticalSurvive:false,actors:[],jobs:[],actionTypes:[],skills:[],healTargets:[],healMulti:false,familyHeal:false,itemHeal:false,selfHeal:false,otherHeal:false,fullHeal:false,revived:false,lowHeal:false,cueSolved:false,downSeen:false}, actionHistoryComplete:true,
    state:"input", rewardsApplied:false, bag:clone(st.bag||[]) };
}
function createFieldRun(st, areaId, rolls){ // rolls: {count:0|1, picks:[r0,r1]}
  const run = baseRun(st,"field"); const ar=AREAS[areaId]; const q=ar.q; const diff=DIFFICULTY[run.difficulty];
  run.areaId=areaId; run.q=q; run.hub=areaId.slice(0,4); run.returnPos={map:st.mapId,x:st.pos.x,y:st.pos.y};
  const n = rolls.count+1;
  for(let s=0;s<n;s++){
    const d = enemyDef(areaId, pickEnemyIndex(areaId, rolls.picks[s]));
    const hp = Math.ceil((d.baseHP+12*(q-1))*diff.hp);
    run.enemies.push({ slot:s, id:d.id, name:PROFILES[d.profile.slice(1)-1][1], fullName:d.name, profile:d.profile, species:d.species, attr:d.attr, rarity:d.rarity,
      maxHP:hp, hp, def:d.baseDEF+Math.floor((q-1)/12),
      cycle:d.cycle.map(([t,p])=>({t, p: t==="c"?0:Math.ceil((p+Math.floor(4*(q-1)/5))*diff.atk)})) });
  }
  assignLabels(run.enemies);
  return run;
}
function createBossRun(st, bossId){
  const run = baseRun(st,"boss"); const b=BOSSES[bossId]; const q=b.q; const diff=DIFFICULTY[run.difficulty];
  run.bossId=bossId; run.areaId=b.areaId; run.q=q; run.hub=b.hub; run.returnPos={map:st.mapId,x:st.pos.x,y:st.pos.y};
  // 少人数補正：戦闘開始時の人数で固定（4人で指示書どおり）
  const ps = bossScale(bossId, run.party.length);
  run.partyScale = ps;
  const hp = Math.ceil((100+36*q)*diff.hp*ps.hp);
  run.enemies.push({ slot:0, id:bossId, name:b.name, display:b.name, boss:true, maxHP:hp, hp, def:3+Math.floor(q/10),
    cycle:[{t:"s",p:12+q},{t:"a",p:6+Math.floor(q/2)},{t:"c",p:0},{t:"a",p:10+3*q,heavy:true}], atkMult:diff.atk*ps.atk });
  run.cue = {kind:b.cue, bits:[], ready:false, active:false};
  return run;
}

/* ---- 予告（第08・11D節） ---- */
function alive(run){ return run.party.filter(p=>p.hp>0); }
function pickTarget(run, seed){
  const candidates=run.party.map((p,i)=>({p,i,weight:run.party.length-i})).filter(x=>x.p.hp>0);
  if(!candidates.length) return -1;
  const total=candidates.reduce((n,x)=>n+x.weight,0);
  let cursor=((seed%total)+total)%total;
  for(const x of candidates){ if(cursor<x.weight) return x.i; cursor-=x.weight; }
  return candidates[0].i;
}
function enemyAction(run, e){
  const step = e.cycle[(run.turn-1)%e.cycle.length];
  let power = step.p;
  if(e.boss){
    const cueMult = (step.heavy && run.cue && run.cue.ready) ? 0.8 : 1;
    power = step.t==="c" ? 0 : Math.ceil(step.p * e.atkMult * cueMult);
  }
  const res = { type: step.t, power, heavy: !!step.heavy };
  if(step.t==="s") res.target = pickTarget(run, run.turn-1+e.slot);
  return res;
}
function telegraph(run){ return run.enemies.filter(e=>e.hp>0).map(e=>({slot:e.slot, ...enemyAction(run,e)})); }
function startTurnCue(run){
  if(!run.cue) return;
  if(run.turn%4===3){ run.cue.active=true; run.cue.bits=[]; run.cue.ready=false; }
  else run.cue.active=false;
}

/* ---- 行動の検証と適用（第09・10・10F節） ---- */
function singleDamage(run, actor, extra, enemy, opts={}){
  const L=run.L, V=run.V;
  const def = opts.ignoreDef ? 0 : enemy.def;
  const atk = opts.noGear ? 0 : actor.wAtk + actor.accAtk;
  return Math.max(1, 10+2*L + V*(extra + atk + run.B) - def);
}
function chainAdvance(run, actor, line){
  if(run.kiraDone) return false;
  const st=run.chain.stage, mem=run.chain.members.includes(actor.cid);
  return (line==="greet"&&st===0) || (line==="plan"&&st===1&&!mem) || (line==="thanks"&&st===2&&!mem);
}
function cueProgress(run, actor, kind){
  return !!(run.cue && run.cue.active && !run.cue.ready && run.cue.kind===kind && !run.cue.bits.includes(actor.cid));
}
/* 行動の予測と可否。effects 配列は適用用の差分を表す */
function planAction(run, idx, act){
  const a = run.party[idx]; const S=a.S, V=run.V, L=run.L;
  if(!a || a.hp<=0) return {ok:false, reason:"戦闘不能です。"};
  if(a.acted) return {ok:false, reason:"このターンは行動済みです。"};
  if(run.state!=="input") return {ok:false, reason:"入力待ちではありません。"};
  const al = alive(run); const en = run.enemies.filter(e=>e.hp>0);
  const p = { ok:true, cost:{c:0,a:0,hp:0}, dmg:[], heal:[], cgain:[], ward:[], aGain:0, setB:null, consumeB:false, chain:null, cue:null, text:[], valid:false, kind:act.type };
  const needEnemy = () => { const e = run.enemies.find(x=>x.slot===act.target && x.hp>0); return e; };
  const needAlly = (other) => { const t = run.party[act.ally]; if(!t||t.hp<=0) return null; if(other && t===a) return null; return t; };
  const heal = (t,amt)=>{ const g=Math.min(amt, t.maxHP-t.hp); p.heal.push({pos:t.pos, amt:g}); if(g>0) p.valid=true; return g; };
  const addC = (t,amt,afterPay)=>{ const base = t===a? a.c - p.cost.c : t.c; const g=Math.min(amt, 10-base); p.cgain.push({pos:t.pos, amt:Math.max(0,g)}); if(g>0) p.valid=true; return g; };
  const addWard=(t,amt)=>{ const g=Math.min(amt, 8-t.ward); p.ward.push({pos:t.pos, amt:Math.max(0,g)}); if(g>0) p.valid=true; };
  const gainA=(amt)=>{ const g=Math.min(amt, 100-run.A-p.aGain+p.cost.a); p.aGain+=amt; if(g>0) p.valid=true; };
  const attackSingle=(extra,opts={})=>{
    const e=needEnemy(); if(!e) return false;
    const d=singleDamage(run,a,extra,e,opts); p.dmg.push({slot:e.slot, amt:Math.min(d,e.hp), raw:d}); p.valid=true;
    p.consumeB=true; p.aGain+=8; return true;
  };
  const payC=(n)=>{ if(a.c<n){ p.ok=false; p.reason=`集中力が足りません（必要${n}）。`; return false;} p.cost.c=n; return true; };
  const commentLike=(baseA)=>{
    const line=act.line; if(!LINE_NAMES[line]){ p.ok=false; p.reason="台詞を選んでください。"; return; }
    if(!payC(1)) return;
    const aAmt = baseA + a.commentA;
    const aRoom = 100-run.A; const bChange = run.B!==4;
    const adv = chainAdvance(run,a,line); const cue = cueProgress(run,a,"comment");
    p.aGain += aAmt; p.setB=4; p.chain={line, adv}; p.cue = cue?"comment":null;
    p.valid = aRoom>0 || bChange || adv || cue;
    if(!p.valid){ p.ok=false; p.reason="エール100・コメント連携4で、連携も進まないため効果がありません。"; }
  };
  switch(act.type){
    case "attack":
      if(!attackSingle(0)){ p.ok=false; p.reason="対象の敵を選んでください。"; }
      p.text.push("通常攻撃");
      break;
    case "comment":
      if(a.job==="J02") commentLike(22+S); else commentLike(18);
      break;
    case "guard":
      p.guard=true; p.cgain.push({pos:a.pos, amt:Math.min(1,10-a.c)}); p.cue = cueProgress(run,a,"guard")?"guard":null; p.valid=!!p.cue;
      break;
    case "rest": {
      const g=Math.min(4+a.rest, 10-a.c); if(g<=0){ p.ok=false; p.reason="集中力は最大です。"; break; }
      p.cgain.push({pos:a.pos, amt:g}); p.valid=false; break; }
    case "family": {
      if(run.A<40){ p.ok=false; p.reason="エールが40必要です。"; break; }
      p.cost.a=40; const amt=(12+a.family)*V; let any=false;
      for(const t of run.party){ if(t.hp<=0){ p.heal.push({pos:t.pos, amt:Math.min(amt,t.maxHP), revive:true}); any=true; } else { const g=Math.min(amt,t.maxHP-t.hp); p.heal.push({pos:t.pos,amt:g}); if(g>0) any=true; } }
      p.valid=any; if(!any){ p.ok=false; p.reason="全員の体力が満タンです。"; }
      break; }
    case "meter": {
      if(run.A<80){ p.ok=false; p.reason="エールが80必要です。"; break; }
      p.cost.a=80;
      for(const e of en){ const d=Math.max(1, 18+4*L + V*a.meter - e.def); p.dmg.push({slot:e.slot, amt:Math.min(d,e.hp), raw:d}); }
      p.valid=true; p.all=true; break; }
    case "item": planItem(run,a,act,p,{needEnemy,needAlly,heal,addC,V}); break;
    case "skill": planSkill(run,a,act,p,{needEnemy,needAlly,heal,addC,addWard,attackSingle,payC,commentLike,gainA,S,V,L,al,en}); break;
    default: p.ok=false; p.reason="不明な行動です。";
  }
  // コメント以外の確定行動は連携を0へ
  if(p.ok && !p.chain) p.chainReset = run.chain.stage>0;
  // 攻勢型ボス対処（道具は対処に数えない）
  if(p.ok && !p.item && p.dmg.some(d=>d.amt>0) && cueProgress(run,a,"damage")) p.cue="damage";
  return p;
}
function planSkill(run,a,act,p,h){
  const {S,V,L}=h;
  switch(a.job){
    case "J01": if(!h.payC(3))return; if(!h.attackSingle(8+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} h.addWard(a,2); break;
    case "J02": h.commentLike(22+S); break;
    case "J03": { if(!h.payC(2))return; const t=h.needAlly(); if(!t){p.ok=false;p.reason="対象を選んでください。";return;} h.addWard(t,4+Math.floor(S/2)); if(run.B!==4){p.setB=4;p.valid=true;} else p.setB=4; break; }
    case "J04": {
      if(act.mode==="c"){ if(!h.payC(2))return; const t=h.needAlly(true); if(!t){p.ok=false;p.reason="自分以外の対象を選んでください。";return;} h.addC(t,3+Math.floor(S/2)); }
      else { if(!h.payC(1))return; const t=h.needAlly(); if(!t){p.ok=false;p.reason="対象を選んでください。";return;} h.heal(t,(10+2*S)*V+L); }
      break; }
    case "J05": if(!h.payC(2))return; if(!h.attackSingle(3+S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} p.aGain+=4; break;
    case "J06": {
      if(!h.payC(3))return;
      if(act.mode==="bold"){ if(a.hp < 10*V+1){p.ok=false;p.reason=`強気には体力${10*V+1}以上が必要です。`;return;} p.cost.hp=10*V; if(!h.attackSingle(18+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} }
      else { if(!h.attackSingle(10+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} h.addWard(a,1); }
      break; }
    case "J07": h.addC(a,5); h.addWard(a,2+Math.floor(S/2)); if(!p.valid){p.ok=false;p.reason="集中力も防護も最大のため効果がありません。";} break;
    case "J08": { if(!h.payC(2))return; const t=h.needAlly(); if(!t){p.ok=false;p.reason="回復する対象を選んでください。";return;} h.gainA(24+S); h.heal(t,(8+S)*V); if(!p.valid){p.ok=false;p.reason="効果がありません。";} break; }
    case "J09": if(!h.payC(3))return; if(!h.attackSingle(6+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} h.al.forEach(t=>h.addWard(t,1)); break;
    case "J10": { if(!h.payC(3))return; for(const e of h.en){ const d=Math.max(1,2*L+(5+S)*V-e.def); p.dmg.push({slot:e.slot,amt:Math.min(d,e.hp),raw:d}); } p.valid=true; p.all=true; break; }
    case "J11": if(!h.payC(3))return; h.gainA(16+2*S); h.al.forEach(t=>h.addWard(t,2)); if(!p.valid){p.ok=false;p.reason="効果がありません。";} break;
    case "J12": if(!h.payC(3))return; h.al.forEach(t=>{h.heal(t,(8+S)*V); h.addC(t,1);}); if(!p.valid){p.ok=false;p.reason="効果がありません。";} break;
    case "J13": { if(!h.payC(3))return; const t=h.needAlly(); if(!t){p.ok=false;p.reason="対象を選んでください。";return;} h.heal(t,(18+3*S)*V+2*L); if(!p.valid){p.ok=false;p.reason="対象のHPは満タンです。";} break; }
    case "J14": if(!h.payC(3))return; h.al.filter(t=>t!==a).forEach(t=>h.addC(t,2+Math.floor(S/2))); if(!p.valid){p.ok=false;p.reason="ほかの全員の集中力が最大です。";} break;
    case "J15": if(!h.payC(3))return; if(!h.attackSingle(12+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";} break;
    case "J16": if(!h.payC(2))return; if(!h.attackSingle(4+S,{ignoreDef:true})){p.ok=false;p.reason="対象の敵を選んでください。";} break;
    case "J17": if(!h.payC(3))return; h.al.forEach(t=>h.addWard(t,3+Math.floor(S/2))); if(!p.valid){p.ok=false;p.reason="全員の防護が最大です。";} break;
    case "J18": { if(!h.payC(2))return; const t=h.needAlly(); if(!t){p.ok=false;p.reason="対象を選んでください。";return;} h.heal(t,(12+2*S)*V+2*L); if(run.B!==4)p.valid=true; p.setB=4; if(!p.valid){p.ok=false;p.reason="効果がありません。";} break; }
    case "J19": if(!h.payC(3))return; if(!h.attackSingle(10+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";return;} p.setBAfter=4; break;
    case "J20": if(!h.payC(2))return; h.gainA(12+S); if(run.B!==4)p.valid=true; p.setB=4; h.al.forEach(t=>h.addWard(t,1)); if(!p.valid){p.ok=false;p.reason="効果がありません。";} break;
    case "J21": if(!h.payC(4))return; if(!h.attackSingle(18+2*S)){p.ok=false;p.reason="対象の敵を選んでください。";} break;
    case "J22": { if(!h.payC(3))return; const t=h.needAlly(true); if(!t){p.ok=false;p.reason="自分以外の生存者を選んでください。";return;} h.gainA(14+2*S); h.addC(t,2+Math.floor(S/2)); if(!p.valid){p.ok=false;p.reason="エール100かつ対象の集中力10のため効果がありません。";} break; }
  }
}
/* 確定（validate → reduce）。戻り値はログ配列 */
function applyAction(run, idx, act){
  const p = planAction(run, idx, act);
  if(!p.ok) return {ok:false, reason:p.reason};
  if(run.actionHistoryComplete===true && run.actionFlags){
    if(Number.isInteger(run.actionFlags.actionCount)) run.actionFlags.actionCount++;
    if(act.type==="rest") run.actionFlags.restUsed=true;
    if(p.cost.a>0) run.actionFlags.cheerSpent=true;
    if(act.type==="comment" && Array.isArray(run.actionFlags.commentLines) && !run.actionFlags.commentLines.includes(act.line)) run.actionFlags.commentLines.push(act.line);
    if(act.type==="family" || act.type==="meter") run.actionFlags.cheerAction=true;
    if(act.type==="skill") run.actionFlags.skillUsed=true;
    if(act.type!=="item" && p.cgain.some(g=>g.amt>0)) run.actionFlags.mpRestored=true;
    if(p.cost.c>0) run.actionFlags.mpSpent=true;
    const restored=p.cgain.filter(g=>g.amt>0);
    if(Array.isArray(run.actionFlags.mpTargets)) for(const g of restored){
      const cid=run.party[g.pos].cid;
      if(!run.actionFlags.mpTargets.includes(cid)) run.actionFlags.mpTargets.push(cid);
    }
    if(restored.length && act.type==="guard") run.actionFlags.mpGuard=true;
    if(restored.length && act.type==="rest") run.actionFlags.mpRest=true;
    if(restored.length && act.type==="skill") run.actionFlags.mpSkill=true;
    if(restored.length && act.type==="item") run.actionFlags.mpItem=true;
    if(restored.some(g=>run.party[g.pos].c-(g.pos===idx?p.cost.c:0)<=2)) run.actionFlags.mpLow=true;
    if(act.type==="guard") run.actionFlags.guardUsed=true;
    if(act.type==="guard" && Array.isArray(run.actionFlags.guardActors) && !run.actionFlags.guardActors.includes(run.party[idx].cid)) run.actionFlags.guardActors.push(run.party[idx].cid);
    if(Array.isArray(run.actionFlags.actionTypes) && !run.actionFlags.actionTypes.includes(act.type)) run.actionFlags.actionTypes.push(act.type);
    if(act.type==="skill" && Array.isArray(run.actionFlags.skills) && !run.actionFlags.skills.includes(run.party[idx].job)) run.actionFlags.skills.push(run.party[idx].job);
    if(!run.actionFlags.actors.includes(run.party[idx].cid)) run.actionFlags.actors.push(run.party[idx].cid);
    if(!run.actionFlags.jobs.includes(run.party[idx].job)) run.actionFlags.jobs.push(run.party[idx].job);
    if(p.heal.some(h=>h.revive)) run.actionFlags.revived=true;
    if(p.heal.some(h=>h.amt>0 && !h.revive && run.party[h.pos].hp>0 && run.party[h.pos].hp<=run.party[h.pos].maxHP*0.3)) run.actionFlags.lowHeal=true;
    const healed=p.heal.filter(h=>h.amt>0);
    if(Array.isArray(run.actionFlags.healTargets)) for(const h of healed){
      const cid=run.party[h.pos].cid;
      if(!run.actionFlags.healTargets.includes(cid)) run.actionFlags.healTargets.push(cid);
    }
    if(healed.length>=2) run.actionFlags.healMulti=true;
    if(healed.length && act.type==="family") run.actionFlags.familyHeal=true;
    if(healed.length && act.type==="item") run.actionFlags.itemHeal=true;
    if(healed.some(h=>h.pos===idx)) run.actionFlags.selfHeal=true;
    if(healed.some(h=>h.pos!==idx)) run.actionFlags.otherHeal=true;
    if(healed.some(h=>h.amt>=run.party[h.pos].maxHP-run.party[h.pos].hp)) run.actionFlags.fullHeal=true;
  }
  const a = run.party[idx]; const log=[]; const nm=a.name;
  const label = actLabel(run,a,act);
  log.push(`${nm}の${label}！`);
  a.c -= p.cost.c; run.A -= p.cost.a; if(p.cost.hp){ a.hp -= p.cost.hp; log.push(`${nm}は体力を${p.cost.hp}払った。`); }
  if(a.hp<=0 && run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.downSeen=true;
  // 攻撃
  let killedNow=0;
  let hitCount=0;
  for(const d of p.dmg){
    const e = run.enemies.find(x=>x.slot===d.slot); if(!e||e.hp<=0) continue;
    const real = Math.min(d.raw, e.hp); e.hp -= real; log.push(`${e.display}に${real}ダメージ。`);
    if(real>0){
      hitCount++;
      if(run.actionHistoryComplete===true && run.actionFlags){
        const f=run.actionFlags;
        f.damageHit=true;
        if(act.type==="attack") f.attackHit=true;
        if(p.consumeB && run.B>0) f.commentAttack=true;
        if(act.type==="skill" && a.job==="J16") f.ignoreDefHit=true;
        if(real>=e.maxHP/2) f.bigHit=true;
      }
    }
    if(real>0 && run.turn===1 && run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.firstTurnDamage=true;
    if(e.hp<=0){ killedNow++; log.push(`${e.display}を鎮めた。`); }
  }
  if(run.actionHistoryComplete===true && run.actionFlags){
    if(hitCount>=2) run.actionFlags.multiHit=true;
    if(hitCount>0 && run.enemies.every(e=>e.hp<=0)){
      if(act.type==="attack") run.actionFlags.attackFinish=true;
      if(act.type==="skill") run.actionFlags.skillFinish=true;
      if(act.type==="meter") run.actionFlags.meterFinish=true;
    }
  }
  if(p.consumeB){ run.B=0; }
  if(p.setBAfter){ run.B=p.setBAfter; }
  if(p.aGain>0){ const before=run.A; run.A=Math.min(100,run.A+p.aGain); if(run.A>before) log.push(`エール＋${run.A-before}（${run.A}）`); }
  if(p.setB!=null){ run.B=p.setB; }
  for(const h of p.heal){ const t=run.party[h.pos]; if(h.revive){ t.hp=Math.min(h.amt,t.maxHP); t.acted=true; log.push(`${t.name}が復帰（体力${t.hp}）。`); } else if(h.amt>0){ t.hp+=h.amt; log.push(`${t.name}の体力＋${h.amt}`); } }
  for(const g of p.cgain){ const t=run.party[g.pos]; if(g.amt>0){ t.c=Math.min(10,t.c+g.amt); log.push(`${t.name}の集中力＋${g.amt}`); } }
  for(const w of p.ward){ const t=run.party[w.pos]; if(w.amt>0){ t.ward=Math.min(8,t.ward+w.amt); log.push(`${t.name}に防護${w.amt}`); } }
  if(p.guard){ a.guard=true; log.push(`${nm}は身構えた。`); }
  if(p.item){
    bagRemove(run.bag, p.item, 1);
    if(!Array.isArray(run.itemHistory)) run.itemHistory=[];
    run.itemHistory.push({id:p.item,actor:a.cid,turn:run.turn,
      hp:p.heal.reduce((n,h)=>n+h.amt,0), c:p.cgain.reduce((n,g)=>n+g.amt,0),
      revives:p.heal.filter(h=>h.revive).length});
  }
  // キラコメ連携
  let chainProg=false;
  if(p.chain){
    const {line, adv}=p.chain;
    if(run.kiraDone){ run.chain={stage:0,members:[]}; }
    else if(line==="greet"){ run.chain={stage:1,members:[a.cid]}; chainProg=adv; }
    else if(adv && line==="plan"){ run.chain.stage=2; run.chain.members.push(a.cid); chainProg=true; }
    else if(adv && line==="thanks"){
      chainProg=true; run.kiraDone=true; run.chain={stage:0,members:[]};
      const bonus = run.support==="PR06"?15:10; run.A=Math.min(100,run.A+bonus);
      for(const t of alive(run)) t.ward=Math.min(8,t.ward+2);
      log.push(`キラコメ連携！ 光の文字が流れ、エール＋${bonus}、全員に防護2。`);
    } else { run.chain={stage:0,members:[]}; }
  } else if(p.chainReset){ run.chain={stage:0,members:[]}; }
  // ボス対処
  if(p.cue && run.cue && !run.cue.bits.includes(a.cid)){
    run.cue.bits.push(a.cid);
    if(run.cue.bits.length>=2){ run.cue.ready=true; if(run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.cueSolved=true; log.push("対処成功！ 次の強攻撃が20%軽くなる。"); }
  }
  // 初撃破のパチパチ
  if(killedNow>0 && !run.firstKill && !p.item){ run.firstKill=true; run.A=Math.min(100,run.A+10); log.push("パチパチ！ 拍手でエール＋10。"); }
  if(run.actionHistoryComplete===true && run.actionFlags && Number.isFinite(run.actionFlags.cheerPeak)) run.actionFlags.cheerPeak=Math.max(run.actionFlags.cheerPeak,run.A);
  a.acted=true;
  if(p.valid || chainProg) a.valid++;
  // 勝敗
  if(run.enemies.every(e=>e.hp<=0)){ run.state="won"; log.push("ノイズ体をすべて鎮めた！"); }
  else if(alive(run).every(m=>m.acted)){ log.push(...enemyPhase(run)); }
  run.log = [...(run.log||[]), ...log].slice(-80);
  return {ok:true, log};
}
function actLabel(run,a,act){
  if(act.type==="attack") return "アタック";
  if(act.type==="comment") return (a.job==="J02"?"コメント整理":"応援コメント")+`（${LINE_NAMES[act.line]}）`;
  if(act.type==="guard") return "ガード";
  if(act.type==="rest") return "ひと息つく";
  if(act.type==="family") return "ファミリー応援";
  if(act.type==="meter") return "メーター突破";
  if(act.type==="item") return ITEMS[act.item]?ITEMS[act.item].name:"道具";
  if(act.type==="skill") return JOBS[a.job].skill + (act.mode==="bold"?"（強気）":act.mode==="safe"?"（堅実）":act.mode==="c"?"（集中補給）":act.mode==="hp"?"（体力補給）":"") + (act.line?`（${LINE_NAMES[act.line]}）`:"");
  return "行動";
}
function enemyPhase(run){
  const log=[];
  for(const e of run.enemies.filter(x=>x.hp>0).sort((x,y)=>x.slot-y.slot)){
    const act = enemyAction(run,e);
    if(act.type==="c"){ log.push(`${e.display}は力をためている。`); continue; }
    if(run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.enemyAttacked=true;
    const targets = act.type==="a" ? alive(run) : [run.party[act.target]].filter(Boolean);
    for(const t of targets){
      let inc = Math.max(0, act.power - run.V*(t.armorD + t.ward));
      if(t.guard) inc = Math.ceil(inc/2);
      if(run.actionHistoryComplete===true && run.actionFlags){
        const flags=run.actionFlags;
        if(t.guard) flags.guardHit=true;
        if(t.ward>0) flags.wardHit=true;
        if(inc===0) flags.zeroHit=true;
        if(act.heavy && t.guard) flags.heavyGuardHit=true;
      }
      t.hp = Math.max(0, t.hp-inc);
      if(inc>0 && t.hp>0 && t.hp<=t.maxHP*0.3 && run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.criticalSurvive=true;
      if(t.hp===0 && run.actionHistoryComplete===true && run.actionFlags) run.actionFlags.downSeen=true;
      log.push(`${e.display}の${act.type==="a"?"全体攻撃":"攻撃"}。${t.name}に${inc}。`+(t.hp===0?` ${t.name}は戦闘不能。`:""));
    }
    if(alive(run).length===0){ run.state="lost"; log.push("全員が戦闘不能になった……"); return log; }
  }
  if(run.cue && run.turn%4===0){ run.cue.bits=[]; run.cue.ready=false; }
  for(const m of run.party){ m.guard=false; m.ward=0; m.acted=false; }
  run.turn++; run.chain={stage:0,members:[]};
  startTurnCue(run);
  return log;
}

/* ---- 戦闘報酬（第17B・17H節）。一度だけ適用 ---- */
function applyVictory(st, run){
  const res = { xp:0, gold:0, tickets:0, jp:[], levelBefore:levelOf(st.xp), levelAfter:0, gifts:[], quest:null, kills:0, notes:[] };
  if(run.rewardsApplied) return res;
  storeVitals(st, run); st.bag = clone(run.bag||st.bag||[]); res.items=[]; res.itemsKept=[]; res.itemsLost=[];
  const L0 = levelOf(st.xp); const max0 = Object.fromEntries(st.roster.map(cid=>[cid,charStats(st,cid,L0).maxHP]));
  const n = run.enemies.length;
  if(run.kind==="field"){
    res.xp = Math.min(XP_CAP-st.xp, n*(8+3*run.q)); res.gold = n*(20+2*run.q);
    st.xp += res.xp; st.gold += res.gold;
    for(const e of run.enemies) st.killCount[e.id]=(st.killCount[e.id]||0)+1;
    // 道具のドロップ：倒した敵ごとに1回だけ抽選（1体から最大1個）
    for(const e of run.enemies){ const dr=ITEM_DROPS[e.id]; if(!dr) continue;
      const roll = run.dropRolls && run.dropRolls[e.slot]!=null ? run.dropRolls[e.slot] : randInt(dr[1]);
      if(roll===0) giveItem(st, dr[0], 1, res, `${e.display}が落とした`); }
    // 依頼の討伐数
    const qid = st.activeQuest;
    if(qid && QUESTS[qid].hub===run.hub && ["active"].includes(st.quests[qid])){
      st.qprog[qid]=Math.min(QUESTS[qid].kills,(st.qprog[qid]||0)+n);
      res.kills=n; res.killQuest=qid; res.killNow=st.qprog[qid]; res.killNeed=QUESTS[qid].kills;
      if(st.qprog[qid]>=QUESTS[qid].kills){
        if(QUESTS[qid].main){ st.quests[qid]="bossReady"; res.notes.push(`${qid}：ボスに挑めるようになった。`); }
        else { completeQuest(st,qid,res); }
      }
    }
  }
  // JP
  for(const m of run.party){
    const base = run.turn<=3 ? 12 : 6+2*Math.min(3,m.valid);
    const cur = jpOf(st,m.cid,m.job); const R0=rankOf(cur);
    const gain = Math.min(JP_CAP-cur, base); st.jp[m.cid][m.job]=cur+gain; const R1=rankOf(cur+gain);
    res.jp.push({cid:m.cid, name:m.name, job:m.job, gain, R0, R1});
    if(R0<4 && R1>=4) giftCheck(st,m.job,"W",res);
    if(R0<7 && R1>=7) giftCheck(st,m.job,"A",res);
  }
  if(run.kind==="boss"){
    st.bossDefeated[run.bossId]=true;
    const qid = Object.keys(QUESTS).find(k=>QUESTS[k].boss===run.bossId);
    if(qid && st.quests[qid]==="bossReady"){
      if(QUESTS[qid].stream){ st.quests[qid]="combatDone"; res.notes.push("配信の準備が整った。"); }
      else completeQuest(st,qid,res);
    }
  }
  res.levelAfter = levelOf(st.xp);
  // レベルが上がった分だけ現在の体力も増やす（戦闘不能のままは増やさない）
  for(const cid of st.roster){ const v=st.vitals[cid]; if(v&&v.hp>0){ const d=charStats(st,cid,res.levelAfter).maxHP-max0[cid]; if(d>0) v.hp+=d; } }
  ensureVitals(st);
  run.rewardsApplied = true;
  return res;
}
function giftCheck(st, job, kind, res){
  if(st.gifts[kind][job]) return;
  st.gifts[kind][job]=true; const id=(kind==="W"?"JW":"JA")+job.slice(1);
  const total=(st.owned[id]||0)+bagCount(st.itemVault||[],id);
  if(total<8&&unequippedGearCount(st)<UNEQUIPPED_GEAR_MAX){ st.owned[id]=(st.owned[id]||0)+1; res.gifts.push(id); }
  else if(total<8&&itemVaultAdd(st,id,1)){ res.gifts.push(id); res.notes.push(`${EQUIP[id].name}はアイテム金庫に保管した。`); }
  else { st.pendingGifts=st.pendingGifts||[]; st.pendingGifts.push(id); res.notes.push(`${EQUIP[id].name}は所持上限のため受取保留。安全地帯のアイテム金庫で受け取れる。`); }
}
function claimPendingGift(st,id){
  if(!EQUIP[id]||!st.pendingGifts?.includes(id)||(st.owned[id]||0)+bagCount(st.itemVault||[],id)>=8) return null;
  let destination=null;
  if(unequippedGearCount(st)<UNEQUIPPED_GEAR_MAX){ st.owned[id]=(st.owned[id]||0)+1; destination="手元"; }
  else if(itemVaultAdd(st,id,1)) destination="アイテム金庫";
  if(destination) st.pendingGifts.splice(st.pendingGifts.indexOf(id),1);
  return destination;
}
function completeQuest(st, qid, res){
  if(st.quests[qid]==="complete") return;
  const Q=QUESTS[qid]; st.quests[qid]="complete"; st.activeQuest=null;
  const xp = Q.main?40:10, tk = Q.main?200:80;
  const ev = ITEM_EVENTS[qid]; if(ev) giveItem(st, ev[0], ev[1], res, `依頼${qid}の達成`);
  st.xp=Math.min(XP_CAP, st.xp+xp); st.tickets+=tk;
  if(res){ res.xp+=xp; res.tickets+=tk; res.quest=qid; }
  if(qid==="M01"){ st.moeRank=Math.max(st.moeRank,1); st.quests.M02="available"; }
  if(qid==="M02"){ st.moeRank=Math.max(st.moeRank,2); st.fukuokaClear=true; st.quests.M03="available"; }
  if(qid==="M03"){ st.moeRank=Math.max(st.moeRank,3); st.quests.M04="available"; }
  if(qid==="M04"){ st.moeRank=Math.max(st.moeRank,4); st.quests.M05="available"; }
  if(qid==="M05"){ st.moeRank=Math.max(st.moeRank,5); st.quests.M06="available"; }
  if(qid==="M06"){ st.moeRank=Math.max(st.moeRank,6); st.quests.M07="available"; }
  if(qid==="M07") st.moeRank=Math.max(st.moeRank,7);
  unlockSide(st);
}
/* ---- 体力・集中力の持ち越し（ユーザー指定：戦闘後も残り、宿屋で全回復） ---- */
function ensureVitals(st){
  st.vitals=st.vitals||{}; const L=levelOf(st.xp);
  for(const cid of st.roster){ const s=charStats(st,cid,L); const v=st.vitals[cid];
    if(!v) st.vitals[cid]={hp:s.maxHP, c:s.startC};
    else { v.hp=Math.max(0,Math.min(s.maxHP,v.hp)); v.c=Math.max(0,Math.min(s.startC,v.c)); } }
}
function storeVitals(st, run){
  st.vitals=st.vitals||{}; const L=levelOf(st.xp);
  for(const m of run.party){ const s=charStats(st,m.cid,L); st.vitals[m.cid]={hp:Math.max(0,Math.min(s.maxHP,m.hp)), c:Math.max(0,Math.min(s.startC,m.c))}; }
}
function restoreAll(st){ st.vitals={}; ensureVitals(st); }
function joinMember(st,cid){
  if(st.roster.includes(cid)) return false;
  st.roster.push(cid); if(st.party.length<4) st.party.push(cid); joinEquip(st,cid); if(st.vitals) delete st.vitals[cid]; ensureVitals(st); return true;
}
function joinEquip(st,cid){
  for(const [slot,id] of [["w","CW01"],["a","CA01"]]){ if(availableCount(st,id)>0) st.equip[cid][slot]=id; }
}
function unlockSide(st){
  if(st.talked.akari && st.quests.S01==="locked") st.quests.S01="available";
  if(st.talked.sota && st.quests.S02==="locked" && st.quests.M02!=="locked") st.quests.S02="available";
}
function equippedCount(st,id){ let n=0; for(const c of st.roster){ const e=st.equip[c]; if(e.w===id)n++; if(e.a===id)n++; if(e.acc===id)n++; } return n; }
function availableCount(st,id){ return (st.owned[id]||0)-equippedCount(st,id); }
function unequippedGearCount(st){ return Object.keys(st.owned).reduce((n,id)=>n+Math.max(0,availableCount(st,id)),0); }

/* ---- 配信（第13・13A節） ---- */
function newStream(st, hub, host, theme, style){
  return { hub, prefId:HUBS[hub].prefId, requestIds:STREAM_REQ[HUBS[hub].prefId].slice(), host, theme, style,
    hand:0, score:0, used:[], themeBonusUsed:false, picks:[], done:false };
}
function streamPlay(s, act){
  const gain = { first:0, match:0, theme:0 };
  if(!s.used.includes(act)){ gain.first=20; if(s.requestIds[s.hand]===act) gain.match=20;
    if(!s.themeBonusUsed && STREAM_THEMES[s.theme].act===act){ gain.theme=10; s.themeBonusUsed=true; }
    s.used.push(act); }
  const total=gain.first+gain.match+gain.theme; s.score+=total; s.picks.push({act,total}); s.hand++;
  if(s.hand>=4) s.done=true;
  return {gain,total};
}
function streamGrade(score){ return score>=160?"大盛況":score>=120?"好評":score>=80?"目標達成":score>=60?"温かな反応":"もう一歩"; }

/* ---- 名前の検証（第06E節。文字数はユーザー指定で1～12文字） ---- */
const NAME_MAX = 12;
const HW_KANA = "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
const FW_KANA = "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン";
function normalizeName(raw){
  let s = raw.replace(/^[ 　]+|[ 　]+$/g,"");
  s = s.replace(/[A-Za-z0-9]/g, ch=>String.fromCharCode(ch.charCodeAt(0)+0xFEE0));
  let out="";
  for(let i=0;i<s.length;i++){
    const ch=s[i], k=HW_KANA.indexOf(ch);
    if(k>=0){ let f=FW_KANA[k]; const nx=s[i+1];
      if(nx==="ﾞ"){ const v=(f+"゙").normalize("NFC"); if(v.length===1){ f=v; i++; } }
      else if(nx==="ﾟ"){ const v=(f+"゚").normalize("NFC"); if(v.length===1){ f=v; i++; } }
      out+=f; }
    else if(ch==="ﾞ") out+="゙"; else if(ch==="ﾟ") out+="゚";
    else out+=ch;
  }
  return out.normalize("NFC");
}
function graphemes(s){
  try{ if(Intl.Segmenter) return Array.from(new Intl.Segmenter("ja",{granularity:"grapheme"}).segment(s), x=>x.segment); }catch(e){}
  return Array.from(s.normalize("NFC"));
}
function nameCharOk(g){
  if(g.length>2) return false;
  if([...g].length!==1) return false;
  const c=g.codePointAt(0);
  if(c>=0x3041&&c<=0x3096) return true;
  if(c>=0x30A1&&c<=0x30FA) return true;
  if("々〆〇ーゝゞヽヾ".includes(g)) return true;
  if((c>=0xFF21&&c<=0xFF3A)||(c>=0xFF41&&c<=0xFF5A)||(c>=0xFF10&&c<=0xFF19)) return true;
  try{ return /^\p{Script=Han}$/u.test(g); }catch(e){ return (c>=0x4E00&&c<=0x9FFF)||(c>=0x3400&&c<=0x4DBF)||(c>=0x20000&&c<=0x2FFFF)||(c>=0xF900&&c<=0xFAFF); }
}
function validateName(raw){
  const s=normalizeName(raw); const gs=graphemes(s); const errors=[];
  gs.forEach((g,i)=>{ if(!nameCharOk(g)) errors.push(`${i+1}文字目「${/\s/.test(g)?"空白":g}」は使えません（使える文字：ひらがな・カタカナ・漢字・全角英数字）。`); });
  if(gs.length===0) errors.push("名前を入力してください。");
  if(gs.length>NAME_MAX) errors.push(`${gs.length}文字です。${NAME_MAX}文字以内に直してください。`);
  return { value:s, count:gs.length, errors, ok:errors.length===0 };
}

if(typeof module!=="undefined") module.exports={};

/* ---- 戦闘オートのAI（ユーザー指定）：候補行動を複製上で試し、評価が最も高い行動を選ぶ ---- */
function aiCandidates(run, a){
  const out=[]; const en=run.enemies.filter(e=>e.hp>0).map(e=>e.slot);
  const al=run.party.filter(m=>m.hp>0).map(m=>m.pos), others=al.filter(p=>p!==a.pos), all=run.party.map(m=>m.pos);
  en.forEach(t=>out.push({type:"attack",target:t}));
  ["greet","plan","thanks"].forEach(l=>out.push({type:"comment",line:l}));
  out.push({type:"guard"},{type:"rest"},{type:"meter"},{type:"family"});
  // オートでは購入可能な低レア回復品だけを検討する。所持品や乱数は候補探索中に変更しない。
  const downs=run.party.filter(m=>m.hp<=0).map(m=>m.pos);
  for(const e of (run.bag||[])){ const it=ITEMS[e.id]; if(!it||e.n<=0||it.stars>2||it.price<=0||!['S','SD'].includes(it.acq)||it.cat==="攻撃") continue;
    const nd=itemNeeds(it), effect=it.eff[0];
    const needsHelp=m=>m.hp>0&&((effect.includes('hp')&&m.hp<m.maxHP&&(m.hp/m.maxHP<=0.85||aiIncoming(run,m)>=m.hp))||(effect.includes('c')&&m.c/10<=0.7));
    if(nd==="ally") run.party.filter(needsHelp).forEach(m=>out.push({type:"item",item:e.id,ally:m.pos}));
    else if(nd==="down") downs.forEach(p=>out.push({type:"item",item:e.id,ally:p}));
    else if(nd==="downAll"&&downs.length) out.push({type:"item",item:e.id});
    else if(nd==="allyAll"&&run.party.some(needsHelp)) out.push({type:"item",item:e.id}); }
  const need={J01:"enemy",J02:"line",J03:"ally",J04:"mode",J05:"enemy",J06:"mode",J07:"none",J08:"ally",J09:"enemy",J10:"none",J11:"none",J12:"none",J13:"ally",J14:"none",J15:"enemy",J16:"enemy",J17:"none",J18:"ally",J19:"enemy",J20:"none",J21:"enemy",J22:"allyOther"}[a.job];
  if(need==="enemy") en.forEach(t=>out.push({type:"skill",target:t}));
  if(need==="ally") al.forEach(p=>out.push({type:"skill",ally:p}));
  if(need==="allyOther") others.forEach(p=>out.push({type:"skill",ally:p}));
  if(need==="line") ["greet","plan","thanks"].forEach(l=>out.push({type:"skill",line:l}));
  if(need==="none") out.push({type:"skill"});
  if(need==="mode"){
    if(a.job==="J04"){ al.forEach(p=>out.push({type:"skill",mode:"hp",ally:p})); others.forEach(p=>out.push({type:"skill",mode:"c",ally:p})); }
    else en.forEach(t=>{ out.push({type:"skill",mode:"safe",target:t}); out.push({type:"skill",mode:"bold",target:t}); });
  }
  return out;
}
function aiIncoming(run, m){
  if(m.hp<=0) return 0;
  const sim=JSON.parse(JSON.stringify(run)), before=sim.party[m.pos]?.hp;
  if(before==null) return 0;
  enemyPhase(sim);
  return Math.max(0,before-sim.party[m.pos].hp);
}
function aiScore(before, after){
  if(after.state==="won") return 1e6 - after.turn*10;
  if(after.state==="lost") return -1e6;
  let s=0;
  // 敵へのダメージと撃破
  for(const e of after.enemies){ const b=before.enemies.find(x=>x.slot===e.slot); s += (b.hp-e.hp)*4; if(b.hp>0&&e.hp<=0) s+=120; if(e.hp>0) s -= e.hp*0.5; }
  // 味方の生存と体力（敵フェーズ前なら予告から被ダメージを見込む）
  const phaseDone = after.turn>before.turn;
  for(const m of after.party){
    const pred = phaseDone? 0 : aiIncoming(after,m);
    const eff = m.hp - pred;
    if(m.hp<=0) { s-=260; continue; }
    if(eff<=0) s-=220; else s += 150*Math.min(1,eff/m.maxHP) + 40;
    s += Math.min(m.c,10)*3 + (m.c<3?-15:0);
  }
  s += after.A*0.45 + after.B*3;
  if(after.cue && after.cue.ready && !(before.cue&&before.cue.ready)) s+=90;
  if(after.kiraDone && !before.kiraDone) s+=40;
  if(after.chain.stage>before.chain.stage) s+=12*after.chain.stage;
  return s;
}
function aiItemUseful(run,p){
  if(p.heal.some(h=>h.revive)) return true;
  const usefulHP=p.heal.some(h=>{
    const m=run.party[h.pos], need=Math.min(Math.ceil(m.maxHP*0.03),m.maxHP-m.hp);
    return need>0 && h.amt>=need;
  });
  const usefulC=p.cgain.some(g=>g.amt>=1);
  return usefulHP||usefulC;
}
const ITEM_BADGES={B081:"道具を温存",B082:"一つだけの切り札",B083:"備えを生かす",B084:"道具を使い分ける",B085:"回復と補給の準備",B086:"応援を残す",B087:"声援を蓄える",B088:"技術で節約",B089:"自力で補給",B090:"備えと守り"};
function itemBattleBadges(history,run){
  const used=Array.isArray(history)?history.filter(x=>x&&typeof x.id==="string"):[];
  const out=[];
  if(!used.length) out.push("B081");
  if(used.length===1) out.push("B082");
  if(used.length) out.push("B083");
  if(new Set(used.map(x=>x.id)).size>=2) out.push("B084");
  if(used.some(x=>x.hp>0)&&used.some(x=>x.c>0)) out.push("B085");
  if(run?.actionHistoryComplete===true && run.actionFlags){
    const f=run.actionFlags;
    if(!f.cheerSpent) out.push("B086");
    if(run.A>=80) out.push("B087");
    if(!used.length && f.skillUsed) out.push("B088");
    if(!used.length && f.mpRestored) out.push("B089");
    if(used.length && f.guardUsed) out.push("B090");
  }
  return out;
}
const GROWTH_BADGES={B091:"旅路の一勝",B092:"ライバルを越える",B094:"三職業の共演",B095:"二人の物語",B096:"復活から勝利へ",B097:"逆境を乗り越える",B098:"対処成功"};
function growthBattleBadges(run){
  const out=[];
  if(run.kind==="field") out.push("B091");
  if(run.kind==="boss") out.push("B092");
  if(run.actionHistoryComplete===true && run.actionFlags){
    const f=run.actionFlags;
    if(Array.isArray(f.jobs)&&new Set(f.jobs).size>=3) out.push("B094");
    if(Array.isArray(f.actors)&&f.actors.includes("hero")&&f.actors.includes("moe")) out.push("B095");
    if(f.revived && run.party.every(m=>m.hp>0)) out.push("B096");
    if(f.lowHeal) out.push("B097");
    if(run.kind==="boss" && f.cueSolved) out.push("B098");
  }
  return out;
}
const DEFENSE_BADGES={B036:"全員で帰還",B037:"余力を残す",B038:"万全の勝利"};
const GUARD_BADGES={B031:"守りの達人",B032:"交代で守る",B033:"防護がある安心",B034:"無傷の受け止め",B039:"強攻撃への備え",B040:"踏みとどまる"};
function guardBattleBadges(run){
  if(run.actionHistoryComplete!==true || !run.actionFlags) return [];
  const f=run.actionFlags, out=[];
  if(f.guardHit) out.push("B031");
  if(Array.isArray(f.guardActors) && new Set(f.guardActors).size>=2) out.push("B032");
  if(f.wardHit) out.push("B033");
  if(f.zeroHit) out.push("B034");
  if(f.heavyGuardHit) out.push("B039");
  if(f.criticalSurvive) out.push("B040");
  return out;
}
const PARTY_BADGES={B023:"二人で進む",B024:"全員に出番",B025:"職業を合わせる"};
const ACTION_BADGES={B021:"多彩な作戦",B022:"引き出し豊富",B026:"技を使い分ける",B027:"攻撃の二本柱",B028:"攻守の切り替え",B029:"声と技の共演"};
const HEAL_BADGES={B041:"癒やしの手",B042:"仲間を気遣う",B043:"みんなを癒やす",B044:"立て直し",B045:"もう一度一緒に",B046:"ファミリーのぬくもり",B047:"道具で応急手当",B048:"自分も大切に",B049:"あなたを支える",B050:"元気いっぱい"};
const MP_BADGES={B051:"守って補給",B052:"ひと息の価値",B053:"技能で補給",B054:"携帯補給",B055:"MPを分け合う",B056:"MPの余裕",B057:"息切れから復帰",B058:"明日への備え",B059:"自然な補給",B060:"MPを使い切らない"};
const CHEER_BADGES={B061:"最初の声援",B062:"三つの言葉",B063:"挨拶から始まる",B064:"作戦を共有",B065:"感謝の気持ち",B066:"キラコメ完成",B067:"応援が届く",B068:"大きな応援",B069:"満場の応援",B070:"応援を行動に"};
const SPEED_BADGES={B001:"開幕の決着",B002:"短期決着",B003:"安定した進行",B004:"一人一手の決着",B005:"先手必勝",B006:"止まらない攻勢",B007:"初手の一撃",B008:"決戦を駆ける",B010:"少ない手数"};
const ATTACK_BADGES={B011:"基本の一撃",B012:"職業の力",B013:"まとめて攻撃",B014:"基本で締める",B015:"技でフィニッシュ",B016:"突破で締める",B018:"コメントを力に",B019:"防御を突破",B020:"鮮やかな大打撃",B030:"攻めと癒やし"};
function attackBattleBadges(run){
  if(run.actionHistoryComplete!==true || !run.actionFlags) return [];
  const f=run.actionFlags, out=[];
  if(f.attackHit) out.push("B011");
  if(f.skillUsed) out.push("B012");
  if(f.multiHit) out.push("B013");
  if(f.attackFinish) out.push("B014");
  if(f.skillFinish) out.push("B015");
  if(f.meterFinish) out.push("B016");
  if(f.commentAttack) out.push("B018");
  if(f.ignoreDefHit) out.push("B019");
  if(f.bigHit) out.push("B020");
  if(f.damageHit && Array.isArray(f.healTargets) && f.healTargets.length) out.push("B030");
  return out;
}
function speedBattleBadges(run){
  const out=[];
  if(run.turn<=1) out.push("B001");
  if(run.turn<=3) out.push("B002");
  if(run.turn<=5) out.push("B003");
  if(run.kind==="boss" && run.turn<=8) out.push("B008");
  if(run.actionHistoryComplete===true && run.actionFlags){
    const f=run.actionFlags;
    if(Number.isInteger(f.actionCount) && f.actionCount<=run.party.length) out.push("B004");
    if(f.enemyAttacked===false) out.push("B005");
    if(f.restUsed===false) out.push("B006");
    if(f.firstTurnDamage) out.push("B007");
    if(Number.isInteger(f.actionCount) && f.actionCount<=6) out.push("B010");
  }
  return out.sort();
}
function cheerBattleBadges(run){
  const out=[];
  if(run.actionHistoryComplete===true && run.actionFlags){
    const f=run.actionFlags;
    const lines=new Set(Array.isArray(f.commentLines)?f.commentLines:[]);
    if(lines.size) out.push("B061");
    if(["greet","plan","thanks"].every(x=>lines.has(x))) out.push("B062");
    if(lines.has("greet")) out.push("B063");
    if(lines.has("plan")) out.push("B064");
    if(lines.has("thanks")) out.push("B065");
    if(f.cheerAction) out.push("B070");
  }
  if(run.kiraDone) out.push("B066");
  const peak=Math.max(run.A,run.actionFlags?.cheerPeak||0);
  if(peak>=40) out.push("B067");
  if(peak>=80) out.push("B068");
  if(peak>=100) out.push("B069");
  return out.sort();
}
function mpBattleBadges(run){
  const out=[];
  if(run.actionHistoryComplete===true && run.actionFlags){
    const f=run.actionFlags;
    if(f.mpGuard) out.push("B051");
    if(f.mpRest) out.push("B052");
    if(f.mpSkill) out.push("B053");
    if(f.mpItem) out.push("B054");
    if(Array.isArray(f.mpTargets) && new Set(f.mpTargets).size>=2) out.push("B055");
    if(f.mpLow) out.push("B057");
    if(f.mpRestored) out.push("B059");
    if(f.mpSpent && run.party.every(m=>m.c>=1)) out.push("B060");
  }
  if(run.party.every(m=>m.c>=5)) out.push("B056");
  if(run.party.every(m=>m.c>=3)) out.push("B058");
  return out.sort();
}
function healBattleBadges(run){
  if(run.actionHistoryComplete!==true || !run.actionFlags) return [];
  const f=run.actionFlags;
  const targets=new Set(Array.isArray(f.healTargets)?f.healTargets:[]);
  const out=[];
  if(targets.size) out.push("B041");
  if(targets.size>=2) out.push("B042");
  if(f.healMulti) out.push("B043");
  if(f.lowHeal) out.push("B044");
  if(f.revived) out.push("B045");
  if(f.familyHeal) out.push("B046");
  if(f.itemHeal) out.push("B047");
  if(f.selfHeal) out.push("B048");
  if(f.otherHeal) out.push("B049");
  if(f.fullHeal) out.push("B050");
  return out;
}
function actionBattleBadges(run){
  if(run.actionHistoryComplete!==true || !run.actionFlags) return [];
  const types=new Set(Array.isArray(run.actionFlags.actionTypes)?run.actionFlags.actionTypes:[]);
  const skills=new Set(Array.isArray(run.actionFlags.skills)?run.actionFlags.skills:[]);
  const out=[];
  if(types.size>=3) out.push("B021");
  if(types.size>=4) out.push("B022");
  if(skills.size>=2) out.push("B026");
  if(types.has("attack")&&types.has("skill")) out.push("B027");
  if(types.has("guard")&&types.has("skill")) out.push("B028");
  if(types.has("comment")&&types.has("skill")) out.push("B029");
  return out;
}
function partyBattleBadges(run){
  if(run.actionHistoryComplete!==true || !run.actionFlags) return [];
  const actors=new Set(Array.isArray(run.actionFlags.actors)?run.actionFlags.actors:[]);
  const jobs=new Set(Array.isArray(run.actionFlags.jobs)?run.actionFlags.jobs:[]);
  const out=[];
  if(actors.size>=2) out.push("B023");
  if(run.party.length>0 && run.party.every(m=>actors.has(m.cid))) out.push("B024");
  if(jobs.size>=2) out.push("B025");
  return out;
}
function defenseBattleBadges(run){
  const out=[];
  if(run.actionHistoryComplete===true && run.actionFlags && !run.actionFlags.downSeen) out.push("B036");
  if(run.party.every(m=>m.hp>0 && m.hp>=m.maxHP/2)) out.push("B037");
  if(run.party.every(m=>m.hp>0 && m.hp>=m.maxHP)) out.push("B038");
  return out;
}
function aiChoose(run){
  let best=null;
  for(const a of run.party){
    if(a.hp<=0||a.acted) continue;
    for(const act of aiCandidates(run,a)){
      const p=planAction(run,a.pos,act); if(!p.ok) continue;
      if(act.type==="item" && !aiItemUseful(run,p)) continue;
      const sim=JSON.parse(JSON.stringify(run)); sim.log=[];
      const r=applyAction(sim,a.pos,act); if(!r.ok) continue;
      if(act.type==="item"&&sim.state!=="won"){
        const netGain=sim.party.some((m,i)=>m.hp>run.party[i].hp||m.c>run.party[i].c);
        const newDown=sim.party.some((m,i)=>run.party[i].hp>0&&m.hp<=0);
        if(!netGain||newDown) continue;
      }
      let sc=aiScore(run,sim);
      const winning=sim.state==="won";
      if(act.type==="attack") sc+=0.5;            // 同点なら通常攻撃
      if(act.type==="item"){ const it=ITEMS[act.item]; sc -= 10 + 12*it.stars + Math.min(60,Math.max(it.price,it.sell,40)/4); } // 道具は数に限りがあるため控えめに（レアほど温存）
      if(!best||(winning&&!best.winning)||(winning===best.winning&&sc>best.score)) best={idx:a.pos, act, score:sc, winning, label:actLabel(run,a,act), name:a.name};
    }
  }
  return best;
}

/* ---- 道具袋（通常300種類・イベント400種類、各99個。あふれた分は金庫へ） ---- */
function bagCount(bag,id){ const e=(bag||[]).find(x=>x.id===id); return e?e.n:0; }
function bagKindCount(bag,event){ return bag.filter(e=>(ITEMS[e.id]?.acq==="E")===event).length; }
function bagRoom(bag,id){ const e=bag.find(x=>x.id===id); if(e) return Math.max(0,BAG_STACK-e.n); const event=ITEMS[id]?.acq==="E"; return bagKindCount(bag,event)<(event?EVENT_KINDS:BAG_KINDS)?BAG_STACK:0; }
function bagAdd(bag,id,n){ const add=Math.min(n,bagRoom(bag,id)); if(add<=0) return 0; const e=bag.find(x=>x.id===id); if(e) e.n+=add; else bag.push({id,n:add}); return add; }
function bagRemove(bag,id,n){ const i=bag.findIndex(x=>x.id===id); if(i<0) return 0; const r=Math.min(n,bag[i].n); bag[i].n-=r; if(bag[i].n<=0) bag.splice(i,1); return r; }
const ITEM_VAULT_MAX=999;
function itemVaultCount(st){ return (st.itemVault||[]).reduce((n,e)=>n+e.n,0); }
function itemVaultAdd(st,id,n){
  if((!ITEMS[id]&&!EQUIP[id])||!Number.isSafeInteger(n)||n<1) return 0;
  st.itemVault=st.itemVault||[];
  const room=Math.max(0,ITEM_VAULT_MAX-itemVaultCount(st));
  const gearRoom=EQUIP[id]?Math.max(0,8-(st.owned[id]||0)-bagCount(st.itemVault,id)):n;
  const add=Math.min(n,room,gearRoom);
  if(!add) return 0;
  const e=st.itemVault.find(x=>x.id===id); if(e) e.n+=add; else st.itemVault.push({id,n:add});
  return add;
}
function transferVaultItem(st,mode,id,n){
  if(!["deposit","withdraw"].includes(mode)||(!ITEMS[id]&&!EQUIP[id])||!Number.isSafeInteger(n)||n<1||!Array.isArray(st.bag)||!Array.isArray(st.itemVault)) return false;
  const stored=bagCount(st.itemVault,id),total=itemVaultCount(st);
  if(!Number.isSafeInteger(total)||total>ITEM_VAULT_MAX||st.itemVault.some(e=>!ITEMS[e.id]&&!EQUIP[e.id]||!Number.isSafeInteger(e.n)||e.n<1)) return false;
  if(EQUIP[id]){
    if((st.owned[id]||0)+stored>8) return false;
    if(mode==="deposit"){
      if(availableCount(st,id)<n||total+n>ITEM_VAULT_MAX) return false;
      st.owned[id]-=n; itemVaultAdd(st,id,n);
    }else{
      if(stored<n||(st.owned[id]||0)+n>8||unequippedGearCount(st)+n>UNEQUIPPED_GEAR_MAX) return false;
      bagRemove(st.itemVault,id,n); st.owned[id]=(st.owned[id]||0)+n;
    }
    return true;
  }
  if(mode==="deposit"){
    if(bagCount(st.bag,id)<n||total+n>ITEM_VAULT_MAX) return false;
    bagRemove(st.bag,id,n); itemVaultAdd(st,id,n);
  }else{
    if(stored<n||bagRoom(st.bag,id)<n) return false;
    bagRemove(st.itemVault,id,n); bagAdd(st.bag,id,n);
  }
  return true;
}
function giveItem(st,id,n,res,why){
  st.bag=st.bag||[]; st.keep=st.keep||[];
  const got=bagAdd(st.bag,id,n); let rest=n-got, vaulted=0, kept=0;
  if(rest>0){ vaulted=itemVaultAdd(st,id,rest); rest-=vaulted; }
  while(rest>0 && st.keep.length<KEEP_MAX){ st.keep.push(id); rest--; kept++; }
  if(res){ res.items=res.items||[]; res.itemsVaulted=res.itemsVaulted||[]; res.itemsKept=res.itemsKept||[]; res.itemsLost=res.itemsLost||[];
    if(got) res.items.push({id,n:got,why}); if(vaulted) res.itemsVaulted.push({id,n:vaulted}); if(kept) res.itemsKept.push({id,n:kept}); if(rest) res.itemsLost.push({id,n:rest}); }
  return {got,vaulted,kept,lost:rest};
}
function flushKeep(st){ // 預かり所から袋・金庫へ（安全地帯で呼ぶ）
  const moved={bagged:0,vaulted:0};
  if(!st.keep||!st.keep.length) return moved;
  const left=[];
  for(const id of st.keep){
    if(bagAdd(st.bag,id,1)) moved.bagged++;
    else if(itemVaultAdd(st,id,1)) moved.vaulted++;
    else left.push(id);
  }
  st.keep=left; return moved;
}
function itemAmount(it, k, maxHP, V, boost){
  const e=it.eff; let v=0;
  if(k==="hp"){ if(e[0]==="hp"||e[0]==="hpc") v=e[1]*V; else if(e[0]==="hp%"||e[0]==="hpc%") v=Math.ceil(maxHP*e[1]/100); }
  if(k==="rev"){ v=Math.ceil(maxHP*e[1]/100); }
  return boost? Math.ceil(v*1.5) : v;
}
function itemC(it, capRoom){ const e=it.eff; if(e[0]==="c") return e[1]; if(e[0]==="cfull") return capRoom; if(e[0]==="hpc") return e[2]; if(e[0]==="hpc%") return capRoom; return 0; }
function itemNeeds(it){ // 対象の種類
  if(it.cat==="攻撃") return it.target==="敵全体"?"enemyAll":"enemy";
  if(it.cat==="蘇生") return it.target.includes("全員")?"downAll":"down";
  return it.target.includes("全員")?"allyAll":"ally";
}
/* 戦闘中の道具（1行動。エール・コメント連携・JPの有効行動・初撃破エール・ボス対処には数えない） */
function planItem(run,a,act,p,h){
  const it=ITEMS[act.item]; p.item=act.item; p.chain=null;
  if(!it){ p.ok=false; p.reason="道具を選んでください。"; return; }
  if(bagCount(run.bag,it.id)<=0){ p.ok=false; p.reason="その道具は持っていません。"; return; }
  const need=itemNeeds(it), V=h.V, boost=a.pouch && it.cat!=="攻撃";
  const healOne=(t)=>{ const hp=itemAmount(it,"hp",t.maxHP,V,boost); if(hp) h.heal(t,hp); const cc=itemC(it,10-t.c); if(cc) h.addC(t,cc); };
  if(need==="enemy"||need==="enemyAll"){
    const list = need==="enemy" ? [h.needEnemy()].filter(Boolean) : run.enemies.filter(e=>e.hp>0);
    if(!list.length){ p.ok=false; p.reason="対象の敵を選んでください。"; return; }
    for(const e of list){ const d=Math.max(1, it.eff[1]*V - e.def); p.dmg.push({slot:e.slot, amt:Math.min(d,e.hp), raw:d}); }
    if(need==="enemyAll") p.all=true;
  } else if(need==="ally"){ const t=h.needAlly(); if(!t){ p.ok=false; p.reason="対象を選んでください。"; return; } healOne(t); }
  else if(need==="allyAll"){ for(const t of run.party.filter(m=>m.hp>0)) healOne(t); }
  else { // 蘇生
    const downs = run.party.filter(m=>m.hp<=0);
    const list = need==="downAll" ? downs : downs.filter(m=>m.pos===act.ally);
    if(!downs.length){ p.ok=false; p.reason="戦闘不能の仲間がいません。"; return; }
    if(!list.length){ p.ok=false; p.reason="復活させる仲間を選んでください。"; return; }
    for(const t of list) p.heal.push({pos:t.pos, amt:itemAmount(it,"rev",t.maxHP,V,boost), revive:true});
  }
  const effect = p.dmg.length || p.heal.some(x=>x.amt>0||x.revive) || p.cgain.some(x=>x.amt>0);
  if(!effect){ p.ok=false; p.reason="今は効果がありません。"; return; }
  p.valid=false; p.aGain=0;
}
/* 移動中の道具（攻撃道具は使えない）。集中力の上限は最大集中力 */
function useItemField(st, id, cid){
  const it=ITEMS[id]; if(!it) return {ok:false, reason:"道具がありません。"};
  if(it.battleOnly) return {ok:false, reason:"戦闘中だけ使える道具です。"};
  if(st.run) return {ok:false, reason:"戦闘中は戦闘の道具コマンドから使います。"};
  if(bagCount(st.bag,id)<=0) return {ok:false, reason:"その道具は持っていません。"};
  ensureVitals(st); const L=levelOf(st.xp), V=Vof(L), need=itemNeeds(it);
  const all = need==="allyAll"||need==="downAll";
  const targets = all ? st.roster.slice() : [cid];
  const log=[]; let any=false;
  for(const c of targets){
    const s=charStats(st,c,L), v=st.vitals[c]; if(!v) continue; const boost=s.pouch;
    if(need==="down"||need==="downAll"){ if(v.hp>0) continue; v.hp=Math.min(s.maxHP,itemAmount(it,"rev",s.maxHP,V,boost)); any=true; log.push(`${charName(st,c)}が復活（体力${v.hp}）`); continue; }
    if(v.hp<=0){ continue; }
    const hp=Math.min(itemAmount(it,"hp",s.maxHP,V,boost), s.maxHP-v.hp); const cc=Math.min(itemC(it,s.startC-v.c), s.startC-v.c);
    if(hp>0){ v.hp+=hp; any=true; log.push(`${charName(st,c)}の体力＋${hp}`); }
    if(cc>0){ v.c+=cc; any=true; log.push(`${charName(st,c)}の集中力＋${cc}`); }
  }
  if(!any) return {ok:false, reason: (need==="down"||need==="downAll") ? "戦闘不能の仲間がいません。" : "今は効果がありません（戦闘不能の人には回復道具が効きません）。"};
  bagRemove(st.bag,id,1);
  return {ok:true, log};
}
