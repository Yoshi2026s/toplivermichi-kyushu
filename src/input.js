/* ===== input: ジョイコントローラー（画面上のスティック＋決定/戻る、ゲームパッド、キーボード） ===== */
const PAD = (()=>{
  let dir=null, repeatT=0, lastMove=0;            // dir: 0下 1上 2左 3右
  const VEC=[[0,1],[0,-1],[-1,0],[1,0]];
  const isMoveMode=()=> G.screen==="explore" && !G.sheet && !G.dlg && G.st && !G.readOnly;

  let cancelStick=()=>{};
  /* ---- 画面上のスティック ---- */
  function mount(){
    const dock=document.getElementById("dock"); if(!dock || dock.dataset.ready) return; dock.dataset.ready="1";
    const base=dock.querySelector(".stick"), knob=dock.querySelector(".knob");
    let pid=null,centerTap=false,origin=null,stickDir=null,pressEpoch;
    const upd=e=>{
      const r=base.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, R=r.width*0.34;
      let dx=e.clientX-origin.x, dy=e.clientY-origin.y; const d=Math.hypot(dx,dy);
      if(d>R){ dx=dx/d*R; dy=dy/d*R; }
      knob.style.transform=`translate(${dx}px,${dy}px)`;
      const mag=Math.hypot(dx,dy)/R;
      if(d>=6)centerTap=false;
      // Small start zone, smaller release zone, and an angular margin prevent thumb jitter.
      const dead=stickDir==null?0.18:0.10;
      let next=mag<dead?null:Math.abs(dx)>Math.abs(dy)?(dx<0?2:3):(dy<0?1:0);
      if(next!=null&&stickDir!=null&&next!==stickDir){
        const along=stickDir===2?-dx:stickDir===3?dx:stickDir===1?-dy:dy;
        const across=stickDir<2?Math.abs(dx):Math.abs(dy);
        if(along>0&&across<along*1.30)next=stickDir;
      }
      stickDir=next; setDir(next, "stick");
    };
    base.addEventListener("pointerdown",e=>{ if(pid!==null)return; if(e.button!=null&&e.button!==0)return; pid=e.pointerId;pressEpoch=G.controlEpoch; const r=base.getBoundingClientRect(); const central=!!e.target.closest(".stick-confirm"); origin=central?{x:e.clientX,y:e.clientY}:{x:r.left+r.width/2,y:r.top+r.height/2}; stickDir=null; centerTap=!!e.target.closest(".stick-confirm"); base.setPointerCapture(pid); base.classList.add("on"); SND.sfx("step"); upd(e); e.preventDefault(); });
    base.addEventListener("pointermove",e=>{ if(e.pointerId===pid) upd(e); });
    const end=e=>{ if(e.pointerId!==pid) return; const confirm=e.type==="pointerup"&&centerTap&&pressEpoch===G.controlEpoch; pid=null; centerTap=false; origin=null; stickDir=null; base.classList.remove("on"); knob.style.transform=""; setDir(null,"stick"); if(confirm)pressA(); };
    cancelStick=()=>{pid=null;centerTap=false;origin=null;stickDir=null;};
    base.addEventListener("pointerup",end); base.addEventListener("pointercancel",end); base.addEventListener("lostpointercapture",end);
    dock.querySelector(".stick-confirm").addEventListener("click",e=>{if(e.detail===0)pressA();});
    dock.querySelector("[data-pad=back]").addEventListener("click",()=>pressB());
    requestAnimationFrame(tick);
  }
  const sources={};
  function setDir(d, src){
    sources[src]=d;
    const nd = ["key","gamepad","stick"].map(s=>sources[s]).find(x=>x!=null) ?? null;
    if(nd===dir) return;
    if(nd!=null&&isMoveMode()&&typeof manualTravelOverride==="function")manualTravelOverride();
    dir=nd; updateArrow();
    if(dir==null){ if(isMoveMode() && G.walk.path.length>1) G.walk.path=G.walk.path.slice(0,1); return; }
    if(!isMoveMode()){ moveCursor(dir); repeatT=performance.now()+300; }
  }
  function updateArrow(){ const a=document.querySelector("#dock .stick"); if(a) a.dataset.dir = dir==null?"":["下","上","左","右"][dir]; }

  /* 毎フレーム：移動の継続、カーソルの連続移動、ゲームパッドの読み取り */
  let prevBtn={},gamepadRearm=false;
  function tick(now){
    if(document.hidden||!document.hasFocus()){ requestAnimationFrame(tick); return; }
    pollGamepad();
    if(dir!=null){
      if(isMoveMode()){
        if(!G.walk.path.length){
          const st=G.st, m=MAPS[st.mapId]; st.dir=dir; const nx=st.pos.x+VEC[dir][0], ny=st.pos.y+VEC[dir][1];
          if(walkable(m,nx,ny)){ G.walk.path=[{x:nx,y:ny}]; G.walk.prog=0; G.walk.pending=null; }
          else if(now-lastMove>400){ lastMove=now; const o=objAt(m,nx,ny); if(o){ refreshHere(); } }
        }
      } else if(now>repeatT){ moveCursor(dir); repeatT=now+125; }
    }
    requestAnimationFrame(tick);
  }

  /* ---- カーソル（▶）の移動：今見えている一番手前の画面の中だけで動く ---- */
  function scope(){ const d=document.querySelector(".dlg-ov"); if(d) return d; const s=document.querySelector(".overlay"); if(s) return s; return G.screen==="explore"&&document.body?document.body:document.getElementById("screen"); }
  function focusables(sc){
    return [...sc.querySelectorAll("button,input,textarea,select,summary,a[href],[data-a]")].filter(el=>{
      if(el.disabled||el.getAttribute("aria-disabled")==="true") return false;
      if(el.closest("[hidden]")) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0;
    });
  }
  function current(sc){ const a=document.activeElement;if(a&&a!==document.body&&sc.contains(a)&&focusables(sc).includes(a))return a;return sc.querySelector(".kfocus"); }
  function setCursor(el){
    document.querySelectorAll(".kfocus").forEach(x=>x.classList.remove("kfocus"));
    if(!el) return; el.classList.add("kfocus");
    try{ el.focus({preventScroll:true}); }catch(e){}
    el.scrollIntoView({block:"nearest",inline:"nearest"});
    G.cursorSig = sig(el);if(typeof updateControlHints==="function")updateControlHints();
  }
  function sig(el){ return [el.dataset.a,el.dataset.k,el.dataset.v,el.dataset.i,el.dataset.c,el.dataset.s,el.id].join("|"); }
  function moveCursor(d){
    const sc=scope(); if(!sc) return; const list=focusables(sc); if(!list.length) return;
    const cur=current(sc);
    if(!cur || !list.includes(cur)){
      const pref = sc.querySelector(".cmd") ? list.find(el=>el.closest(".cmd")) : sc.querySelector(".sheet") ? list.find(el=>["guideTo","navQuestGo"].includes(el.dataset.a))||list.find(el=>el.closest(".sheet")&&!["closeSheet","returnToMap"].includes(el.dataset.a)) : null;
      setCursor(pref||list[0]); SND.sfx("ok"); return; }
    const r=cur.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
    let best=null, bs=Infinity;
    for(const el of list){ if(el===cur) continue; const q=el.getBoundingClientRect(), x=q.left+q.width/2, y=q.top+q.height/2;
      const dx=x-cx, dy=y-cy; let main, side;
      if(d===0){ main=dy; side=dx; } else if(d===1){ main=-dy; side=dx; } else if(d===2){ main=-dx; side=dy; } else { main=dx; side=dy; }
      if(main<=4) continue; const s=main+Math.abs(side)*2.2; if(s<bs){ bs=s; best=el; } }
    if(best){ setCursor(best); SND.sfx("step"); }
  }
  /* 再描画の後、同じボタンへカーソルを戻す */
  function restore(){
    if(!G.cursorSig || isMoveMode()) return;
    const sc=scope(); if(!sc) return; const el=focusables(sc).find(e=>sig(e)===G.cursorSig);
    if(el){ el.classList.add("kfocus"); try{ el.focus({preventScroll:true}); }catch(e){} } else G.cursorSig=null;
  }

  /* ---- 決定（A）と戻る（B） ---- */
  function pressA(){
    const sc=scope();
    if(isMoveMode()){
      if(G.walkPlan&&(G.walkPlan.paused||!G.walk.path.length)&&typeof ACT.travelResume==='function')return ACT.travelResume({dataset:{v:String(G.walkPlan.version)}});
      if(G.walk.path.length&&typeof ACT.travelPause==='function')return ACT.travelPause();
      const near=nearbyObjects();if(!near.length)return openSheet('guide');if(near.length===1)return interact(near[0]);return openSheet('nearby');
    }
    if(G.dlg){const b=document.getElementById('dlgNext');if(b)b.click();return;}
    const cur=sc&&current(sc);
    if(cur?.id==='navSearchInput'&&typeof ACT.navSearch==='function')return ACT.navSearch();
    if(G.screen==='battle'&&!G.sheet&&!G.auto){
      const confirm=document.querySelector('.cmd [data-a="confirmAct"]:not([disabled])');
      if(confirm&&(!cur||cur.getAttribute?.('aria-pressed')==='true')){confirm.click();return;}
      if(!cur&&!G.cmd?.type){const attack=document.querySelector('.cmdgrid [data-v="attack"]');if(attack){attack.click();return;}}
    }
    if(cur&&focusables(sc).includes(cur)){cur.click();return;}
    moveCursor(0);const next=current(sc);if(next&&focusables(sc).includes(next))next.click();
  }
  function pressB(){
    if(G.dlg){if(G.dlg.i>0)ACT.dlgBack();else if(!G.dlg.after&&!G.dlg.sceneId)ACT.dlgSkip();else SND.sfx('cancel');return;}
    if(G.sheet==='battleSkills'&&G.sheetData?.skill&&typeof ACT.expandedSkillBack==='function'){ACT.expandedSkillBack();if(!G.sheetData?.skill)return;}
    if(G.sheet){const back=document.querySelector('.overlay [data-a=closeSheet]')||document.querySelector('.overlay .sheet-head [data-a=oceanBack]');if(back)back.click();return;}
    if(G.screen==='result'){ACT.resultDone();return;}
    if(G.screen==='battle'&&G.auto){ACT.autoOff();return;}
    if(G.screen==='battle'&&G.st?.run?.state==='input'){
      const c=G.cmd;
      const targetChoice=c.target!=null&&G.st.run.enemies?.filter(e=>e.hp>0).length!==1;
      if(targetChoice||c.ally!=null){delete c.target;delete c.ally;}
      else if(c.item||c.mode||c.line||c.o){delete c.item;delete c.mode;delete c.line;delete c.o;}
      else if(c.type)G.cmd={actor:c.actor};
      else if(typeof ACT.pauseBattle==='function'){ACT.pauseBattle();return;}
      G.cursorSig=null;render();SND.sfx('cancel');return;
    }
    if(isMoveMode()){if(typeof ACT.travelPause==='function'&&G.walkPlan)return ACT.travelPause();G.walk.path=G.walk.path.slice(0,1);G.walk.pending=null;return;}
    SND.sfx('cancel');
  }

  /* ---- ゲームパッド（Joy-Con・Proコントローラー・一般のコントローラー） ---- */
  function pollGamepad(){
    let pads=[]; try{ pads=navigator.getGamepads?[...navigator.getGamepads()].filter(Boolean):[]; }catch(e){}
    if(!pads.length){ prevBtn={}; if(sources.gamepad!=null) setDir(null,"gamepad"); return; }
    const gp=pads[0]; const b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
    let d=null;
    if(b(12)) d=1; else if(b(13)) d=0; else if(b(14)) d=2; else if(b(15)) d=3;
    else { const x=gp.axes[0]||0, y=gp.axes[1]||0; if(Math.hypot(x,y)>0.5) d = Math.abs(x)>Math.abs(y)?(x<0?2:3):(y<0?1:0); }
    // 任天堂系は右ボタン(標準1番)が決定、それ以外は下ボタン(標準0番)が決定
    const nin=/joy-?con|nintendo|pro controller|057e/i.test(gp.id||"");
    const aIdx=nin?1:0, bIdx=nin?0:1;
    const now={a:b(aIdx), b:b(bIdx), start:b(9)};
    if(gamepadRearm){prevBtn=now;if(d==null&&!Object.values(now).some(Boolean))gamepadRearm=false;setDir(null,"gamepad");return;}
    setDir(d,"gamepad");
    const back=now.b&&!prevBtn.b,confirm=now.a&&!prevBtn.a,start=now.start&&!prevBtn.start;prevBtn=now;
    if(back){pressB();return;}
    if(confirm){pressA();return;}
    if(start&&isMoveMode()) openSheet("menu");
  }
  window.addEventListener("gamepadconnected",e=>toast(`コントローラーを接続しました（${(e.gamepad.id||"").slice(0,24)}）`));

  /* ---- キーボード（パソコンでの確認用） ---- */
  const KEYS={ArrowDown:0,ArrowUp:1,ArrowLeft:2,ArrowRight:3,s:0,w:1,a:2,d:3};
  document.addEventListener("keydown",e=>{
    const t=e.target;
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.key==="Tab"&&(G.sheet||G.dlg)){
      const sc=scope(),list=sc?focusables(sc):[],active=document.activeElement;
      const i=list.indexOf(active);
      if(!list.length){ e.preventDefault(); return; }
      if(i<0||(!e.shiftKey&&i===list.length-1)||(e.shiftKey&&i===0)){
        e.preventDefault(); list[e.shiftKey?list.length-1:0].focus({preventScroll:true});
      }
      return;
    }
    if(e.key==="Escape"&&(G.sheet||G.dlg)){e.preventDefault();if(!e.repeat)pressB();return;}
    if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.tagName==="SUMMARY"||t.isContentEditable)) return;
    if(t?.tagName==="BUTTON"&&(e.key==="Enter"||e.key===" ")){if(e.repeat)e.preventDefault();return;}
    if(KEYS[e.key]!=null){ e.preventDefault(); if(!e.repeat) setDir(KEYS[e.key],"key"); return; }
    if(e.key==="Enter"||e.key===" "||e.key==="z"){ e.preventDefault(); if(!e.repeat) pressA(); }
    if(e.key==="Escape"||e.key==="x"||e.key==="Backspace"){ e.preventDefault(); if(!e.repeat) pressB(); }
  });
  document.addEventListener("keyup",e=>{ if(KEYS[e.key]!=null && sources.key===KEYS[e.key]) setDir(null,"key"); });
  // 別タブや別アプリへ移った間に取り逃したキー解放を残さない。
  function releaseInput(){
    if(typeof cancelStick==="function")cancelStick();
    for(const src of ["key","gamepad","stick"]) sources[src]=null;
    setDir(null,"key"); prevBtn={};gamepadRearm=true;
    if(G.walkPlan)G.walkPlan.paused=true;
    if(G.walk){ G.walk.path=[]; G.walk.prog=0; G.walk.pending=null; }
    const base=document.querySelector("#dock .stick"), knob=document.querySelector("#dock .knob");
    if(base) base.classList.remove("on");
    if(knob) knob.style.transform="";if(typeof updateControlHints==="function")updateControlHints();if(typeof updateNavigationHud==="function")updateNavigationHud();
  }
  window.addEventListener("blur",releaseInput);
  document.addEventListener("visibilitychange",()=>{ if(document.hidden) releaseInput(); });
  document.addEventListener("pointerdown",e=>{ if(!e.target.closest("#dock")){ document.querySelectorAll(".kfocus").forEach(x=>x.classList.remove("kfocus")); G.cursorSig=null; } },true);

  /* BGMは初期ON：ブラウザの制限で、最初に画面へ触れた時に鳴らし始める */
  function wantSound(){ if(G.soundWant!=null) return G.soundWant; if(G.st && G.st.settings && G.st.settings.sound===false) return false; return soundPref(); }
  const unlock=e=>{ if(e?.target?.closest?.('[data-a="titleMusic"]'))return; if(SND.on) SND.resume(); else if(wantSound()) SND.setOn(true); if(typeof refreshTitleMusic==="function")refreshTitleMusic(); };
  ["pointerdown","keydown","touchend"].forEach(ev=>document.addEventListener(ev,unlock,{capture:true,passive:true}));
  return { mount, restore, pressA, pressB, release:releaseInput };
})();

if(window.claude&&window.claude.hot&&window.claude.hot.ready) window.claude.hot.ready(()=>boot()); else boot();
