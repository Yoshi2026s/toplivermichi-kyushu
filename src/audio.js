/* ===== platform/audio: 独自作曲の電子音（パルス2声＋三角波ベース＋ノイズ打楽器の4パート） ===== */
const SND = (()=>{
  let ac=null, master=null, bus=null, on=false, cur=null, timer=null, song=null, nextT=0, step=0, waves={}, noiseBuf=null;
  const NOTE={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
  const midi = s => { const m=s.match(/^([A-G][#b]?)(\d)$/); return m? 12*(+m[2]+1)+NOTE[m[1]] : null; };
  const hz = n => 440*Math.pow(2,(n-69)/12);
  const CH={"":[0,4,7],m:[0,3,7],"7":[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],sus4:[0,5,7],dim:[0,3,6]};
  const chord = s => { const m=s.match(/^([A-G][#b]?)(.*)$/); return {root:NOTE[m[1]], q:CH[m[2]]||CH[""]}; };

  /* 曲データ：lead は8分音符ごと（- は伸ばす、. は休符）。chords は1小節ごと */
  const SONGS = {
    title:{ bpm:88, style:"soft", chords:"C G Am Em F C Dm G",
      lead:"E5 - G5 - C6 - B5 A5 | G5 - - - D5 - G5 - | A5 - C6 - E6 - D6 C6 | B5 - - - G5 - - - | A5 - F5 - C6 - A5 - | G5 - E5 - C5 - E5 G5 | F5 - A5 - D6 - C6 A5 | B5 - - - - - . ." },
    fukuoka:{ bpm:120, style:"town", chords:"F C Dm Bb F C Bb C",
      lead:"C5 F5 A5 - G5 F5 E5 F5 | G5 - E5 - C5 - . . | D5 F5 A5 - C6 - A5 G5 | F5 - D5 - Bb4 - . . | C5 F5 A5 - C6 A5 Bb5 C6 | D6 - C6 - G5 - E5 - | F5 G5 A5 - Bb5 A5 G5 F5 | E5 - G5 - C6 - . ." },
    field:{ bpm:132, style:"march", chords:"Dm C Bb A Dm C Bb A7",
      lead:"D5 - A4 - D5 E5 F5 - | E5 - C5 - G5 - E5 - | F5 - D5 - Bb5 - A5 G5 | A5 - - - E5 - C#5 - | D5 - F5 - A5 - D6 - | C6 - G5 - E5 - C5 - | D5 E5 F5 - G5 F5 E5 D5 | C#5 - E5 - A5 - . ." },
    battle:{ bpm:156, style:"battle", chords:"Am F G E Am F Dm E7",
      lead:"A5 - E5 A5 C6 - B5 A5 | F5 - A5 - C6 - A5 F5 | G5 - B5 - D6 - B5 G5 | G#5 - B5 - E6 - D6 B5 | A5 - C6 - E6 - D6 C6 | F6 - E6 - C6 - A5 - | D6 - C6 - A5 - F5 A5 | G#5 - E5 - B5 - E6 -" },
    boss:{ bpm:144, style:"boss", chords:"Em C D B7 Em C Am B7",
      lead:"E5 - - G5 F#5 - E5 - | G5 - E5 - C5 - E5 G5 | A5 - - F#5 D5 - A5 - | B5 - A5 - F#5 - D#5 - | E6 - B5 - G5 - E5 - | C6 - B5 - G5 - E5 G5 | A5 - C6 - E6 - D6 C6 | B5 - - - D#6 - B5 -" },
    stream:{ bpm:126, style:"pop", chords:"G D Em C G D C D",
      lead:"B5 - D6 - G5 - A5 B5 | A5 - F#5 - D5 - . A5 | G5 - B5 - E6 - D6 B5 | C6 - - - G5 - E5 - | D6 - B5 - G5 A5 B5 D6 | F#6 - E6 - D6 - A5 - | E6 - D6 - C6 - B5 A5 | A5 - - - B5 - C6 -" },
    victory:{ bpm:108, style:"town", chords:"C Am F G C Am Dm G",
      lead:"E5 - G5 - C6 - G5 - | A5 - E5 - C5 - E5 - | F5 - A5 - C6 - A5 - | B5 - D6 - G5 - . . | E6 - D6 C6 B5 - C6 - | A5 - - - E5 - A5 - | F5 - E5 - D5 - F5 - | G5 - - - B5 - D6 -" },
    ending:{ bpm:96, style:"soft", chords:"F G Em Am Dm G C C",
      lead:"A5 - - G5 F5 - C6 - | B5 - - A5 G5 - D6 - | E6 - D6 - B5 - G5 - | A5 - - - E5 - A5 - | F5 - A5 - D6 - C6 A5 | B5 - - - G5 - D6 - | E6 - - - D6 - C6 - | C6 - - - - - . ." }
  };
  const seaMelodies=[
    "E5 - G5 B5 A5 - G5 - | F#5 A5 D6 - C6 - A5 - | B5 - G5 E5 D5 - F#5 - | A5 - F#5 D5 E5 - - -",
    "A5 - C6 E6 D6 - C6 - | B5 D6 G6 - E6 - D6 - | C6 - A5 G5 F5 - A5 - | B5 - G5 E5 A5 - - -",
    "G5 B5 D6 - C6 B5 A5 - | E5 G5 C6 - B5 - G5 - | A5 C6 E6 D6 C6 - A5 - | F#5 A5 D6 - G5 - - -",
    "D5 - F5 A5 G5 - E5 - | F5 A5 C6 - Bb5 - G5 - | A5 - F5 D5 E5 - G5 - | C#5 E5 A5 - D5 - - -",
    "C6 - B5 G5 A5 - G5 E5 | F5 - A5 C6 D6 - C6 - | B5 - G5 E5 F5 A5 G5 - | E5 - D5 G5 C6 - - -",
    "E5 - B5 - G5 A5 B5 - | D6 - A5 F#5 G5 - A5 - | C6 E6 D6 B5 A5 - G5 - | F#5 - D5 B4 E5 - - -",
    "C5 E5 G5 A5 G5 - E5 - | D5 G5 A5 C6 A5 - G5 - | E5 G5 C6 D6 C6 - A5 - | G5 E5 D5 G5 C5 - - -",
    "A4 - E5 G5 A5 - B5 - | C6 - G5 E5 D5 - F5 - | E5 A5 C6 B5 A5 - G5 - | E5 - B4 G4 A4 - - -"
  ];
  const seaChords=["Em C D B7","Am F G E7","G C Am D7","Dm Bb C A7","C F Dm G7","Em Am C B7","C G F G","Am Dm E7 Am"];
  for(let i=0;i<8;i++) SONGS['sea_RG'+String(i+1).padStart(2,'0')]={bpm:90+i*4,style:i===6?'town':i===3?'soft':'march',chords:seaChords[i]+' '+seaChords[i],lead:seaMelodies[i]+' | '+seaMelodies[i],leadAlt:seaMelodies[(i+3)%8]+' | '+seaMelodies[i]};
  SONGS.seaBattle={bpm:164,style:'battle',chords:'Dm Bb Gm A7 Dm C Bb A7',lead:'D5 A5 D6 - C6 A5 F5 - | Bb5 F5 D5 F5 A5 - G5 - | G5 D6 Bb5 G5 F5 - D5 - | C#5 E5 A5 C#6 D6 - - - | D6 C6 A5 F5 G5 A5 C6 - | E6 D6 C6 A5 G5 - E5 - | F5 A5 D6 C6 Bb5 - G5 - | C#6 A5 E5 C#5 D5 - - -'};
  // Eight original scene melodies plus nine sea melodies; all loops alternate an arranged response.
  for(const song of Object.values(SONGS)) if(!song.leadAlt) song.leadAlt=song.lead.split('|').reverse().join('|');
  const STYLE = {
    soft:  {bass:"r . . . 5 . . .", arp:"0 1 2 1 0 1 2 1", hat:"", kick:"", snare:"", leadVol:.32, arpVol:.08, bassVol:.5},
    town:  {bass:"r . 5 . r8 . 5 .", arp:"0 1 2 1 0 1 2 1", hat:"x . x . x . x .", kick:"x . . . . . . .", snare:". . . . x . . .", leadVol:.3, arpVol:.09, bassVol:.55},
    march: {bass:"r . r 5 r . r 5", arp:"0 2 1 2 0 2 1 2", hat:"x x x x x x x x", kick:"x . . . x . . .", snare:". . x . . . x .", leadVol:.3, arpVol:.08, bassVol:.55},
    battle:{bass:"r r8 r r8 r r8 r r8", arp:"0 1 2 3 2 1 0 1", hat:"x x x x x x x x", kick:"x . . x x . . .", snare:". . x . . . x .", leadVol:.3, arpVol:.1, bassVol:.6},
    boss:  {bass:"r r r r8 r r r 5", arp:"0 2 0 2 1 2 1 2", hat:"x . x x x . x x", kick:"x . x . x . x .", snare:". . . . x . . x", leadVol:.32, arpVol:.1, bassVol:.65},
    pop:   {bass:"r . r8 . 5 . r8 .", arp:"0 1 2 1 2 1 0 1", hat:"x x x x x x x x", kick:"x . . . x . . .", snare:". . x . . . x .", leadVol:.3, arpVol:.09, bassVol:.55}
  };
  function compile(s){
    const st=STYLE[s.style]; const bars=s.chords.split(" ").map(chord);
    const toks=s.lead.replace(/\|/g," ").trim().split(/\s+/); const lead=[];
    toks.forEach((t,i)=>{ const n=midi(t); if(n!=null){ let len=1; while(toks[i+len]==="-") len++; lead.push({step:i,n,len}); } });
    const pat = p => p? p.split(" ") : [];
    const alt=[]; const alternate=(s.leadAlt||s.lead).replace(/\|/g," ").trim().split(/\s+/);
    alternate.forEach((t,i)=>{const n=midi(t);if(n!=null){let len=1;while(alternate[i+len]==="-")len++;alt.push({step:i,n,len});}});
    return { bpm:s.bpm, steps:bars.length*8, bars, lead, alt, st, bass:pat(st.bass), arp:pat(st.arp), hat:pat(st.hat), kick:pat(st.kick), snare:pat(st.snare) };
  }
  /* 音の通り道：パート別バス → 音色EQ → コンプレッサー → 出力。リバーブとディレイは送りで混ぜる */
  let musicBus=null, sfxBus=null, revIn=null, dlyIn=null, dly=null, duckUntil=0, revOutput=null, delayOutput=null;
  let musicVolume=1,effectVolume=1;
  const activeSources=new Map();
  function trackSource(node,out,cleanup){activeSources.set(node,out===sfxBus?'sfx':'music');node.onended=()=>{activeSources.delete(node);try{node.disconnect();}catch(e){}if(cleanup)cleanup();};}
  function stopSources(group){for(const [node,kind] of activeSources){if(group&&kind!==group)continue;try{node.stop();node.disconnect();}catch(e){}activeSources.delete(node);}}
  const musicGain=()=>0.5*musicVolume;
  function setVolumes(music,effects){
    if(!Number.isFinite(music)||!Number.isFinite(effects))return false;
    musicVolume=Math.max(0,Math.min(1,music));effectVolume=Math.max(0,Math.min(1,effects));
    if(ac&&musicBus){const t=ac.currentTime;musicBus.gain.cancelScheduledValues(t);musicBus.gain.setValueAtTime(musicGain()*(duckUntil>t?.68:1),t);if(duckUntil>t){musicBus.gain.setValueAtTime(musicGain()*.68,duckUntil);musicBus.gain.linearRampToValueAtTime(musicGain(),duckUntil+.38);}sfxBus.gain.setValueAtTime(.75*effectVolume,t);if(revOutput)revOutput.gain.setValueAtTime(.55*musicVolume,t);if(delayOutput)delayOutput.gain.setValueAtTime(.45*musicVolume,t);}
    return true;
  }
  function impulse(sec,decay){ const len=Math.floor(ac.sampleRate*sec), b=ac.createBuffer(2,len,ac.sampleRate);
    for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,decay)*(i<ac.sampleRate*0.012?i/(ac.sampleRate*0.012):1); } } return b; }
  function init(){
    if(ac) return true;
    try{
      ac=new (window.AudioContext||window.webkitAudioContext)({latencyHint:"interactive"});
      const comp=ac.createDynamicsCompressor(); comp.threshold.value=-16; comp.knee.value=12; comp.ratio.value=3.5; comp.attack.value=0.004; comp.release.value=0.18;
      master=ac.createGain(); master.gain.value=0.85; master.connect(comp); comp.connect(ac.destination);
      const low=ac.createBiquadFilter(); low.type="lowshelf"; low.frequency.value=140; low.gain.value=2.5;
      const high=ac.createBiquadFilter(); high.type="highshelf"; high.frequency.value=5200; high.gain.value=-5;
      low.connect(high); high.connect(master);
      musicBus=ac.createGain(); musicBus.gain.value=musicGain(); musicBus.connect(low);
      sfxBus=ac.createGain(); sfxBus.gain.value=0.75*effectVolume; sfxBus.connect(low);
      bus=musicBus;
      // リバーブ（小さめのホール）
      const conv=ac.createConvolver(); conv.buffer=impulse(1.7,2.6); const revLp=ac.createBiquadFilter(); revLp.type="lowpass"; revLp.frequency.value=4200;
      revIn=ac.createGain(); revIn.gain.value=1; const revOut=ac.createGain(); revOutput=revOut; revOut.gain.value=0.55*musicVolume;
      revIn.connect(conv); conv.connect(revLp); revLp.connect(revOut); revOut.connect(low);
      // ディレイ（付点8分のこだま）
      dlyIn=ac.createGain(); dly=ac.createDelay(1.5); dly.delayTime.value=0.3; const fb=ac.createGain(); fb.gain.value=0.3; const dLp=ac.createBiquadFilter(); dLp.type="lowpass"; dLp.frequency.value=2600; const dOut=ac.createGain(); delayOutput=dOut; dOut.gain.value=0.45*musicVolume;
      dlyIn.connect(dly); dly.connect(dLp); dLp.connect(fb); fb.connect(dly); dLp.connect(dOut); dOut.connect(low); dOut.connect(revIn);
      const pulse=d=>{ const N=48, re=new Float32Array(N), im=new Float32Array(N); for(let n=1;n<N;n++) re[n]=2/(n*Math.PI)*Math.sin(n*Math.PI*d)*Math.exp(-n/36); return ac.createPeriodicWave(re,im); };
      waves={p25:pulse(.25), p12:pulse(.125), p50:pulse(.5)};
      noiseBuf=ac.createBuffer(1,ac.sampleRate*1,ac.sampleRate); const nd=noiseBuf.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
      return true;
    }catch(e){ ac=null; return false; }
  }
  /* 1音：オシレーター（2本で厚み）→ 音量エンベロープ → ローパス → 定位 → バス＋送り */
  function voice(f, t, dur, wave, vol, opt={}){
    const need=(opt.detune?2:1)*(opt.vib&&dur>.22?2:1)+(opt.sub?1:0);if(activeSources.size+need>96)return;
    const nodes=[],sources=[];const clean=()=>{if(sources.some(n=>activeSources.has(n)))return;for(const n of nodes)try{n.disconnect();}catch(e){}};
    const out=opt.out||musicBus, A=opt.a??0.006, D=opt.d??0.08, S=opt.sus??0.7, R=opt.r??0.06;
    const g=ac.createGain(), flt=ac.createBiquadFilter(); flt.type="lowpass"; flt.Q.value=opt.q??0.7;
    const cut=opt.cutoff??4000; flt.frequency.setValueAtTime(cut+(opt.fenv||0),t); flt.frequency.exponentialRampToValueAtTime(Math.max(200,cut),t+Math.min(0.25,dur));
    const pan=ac.createStereoPanner?ac.createStereoPanner():null; if(pan) pan.pan.value=opt.pan||0;
    const mk=(det,lvl)=>{ const o=ac.createOscillator(); if(waves[wave]) o.setPeriodicWave(waves[wave]); else o.type=wave; o.frequency.setValueAtTime(f,t); o.detune.value=det;
      if(opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide,t+dur);
      if(opt.vib && dur>0.22){ const l=ac.createOscillator(), lg=ac.createGain(); l.frequency.value=5.2; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.01,t+0.2); l.connect(lg); lg.connect(o.frequency); sources.push(l);nodes.push(lg);trackSource(l,out,clean);l.start(t); l.stop(t+dur+R+0.05); }
      const og=ac.createGain(); og.gain.value=lvl; o.connect(og); og.connect(g); sources.push(o);nodes.push(og);trackSource(o,out,clean);o.start(t); o.stop(t+dur+R+0.05); };
    if(opt.detune){ mk(-opt.detune,0.55); mk(opt.detune,0.55); } else mk(0,1);
    if(opt.sub){ const o=ac.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(f/2,t); const og=ac.createGain(); og.gain.value=0.6; o.connect(og); og.connect(g); sources.push(o);nodes.push(og);trackSource(o,out,clean);o.start(t); o.stop(t+dur+R+0.05); }
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+A); g.gain.linearRampToValueAtTime(vol*S,t+A+D);
    g.gain.setValueAtTime(vol*S,t+Math.max(A+D,dur)); g.gain.linearRampToValueAtTime(0.0001,t+Math.max(A+D,dur)+R);
    nodes.push(g,flt);if(pan)nodes.push(pan);
    g.connect(flt); const last = pan? (flt.connect(pan),pan) : flt; last.connect(out);
    if(opt.rev&&out!==sfxBus){ const s=ac.createGain(); s.gain.value=opt.rev; last.connect(s); s.connect(revIn); nodes.push(s); }
    if(opt.dly&&out!==sfxBus){ const s=ac.createGain(); s.gain.value=opt.dly; last.connect(s); s.connect(dlyIn); nodes.push(s); }
  }
  function noise(t, dur, vol, hp, opt={}){
    if(activeSources.size>=96)return;
    const s=ac.createBufferSource(); s.buffer=noiseBuf; s.playbackRate.value=opt.rate||1;
    const f=ac.createBiquadFilter(); f.type=opt.type||"highpass"; f.frequency.value=hp; f.Q.value=opt.q??0.7;
    const g=ac.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const pan=ac.createStereoPanner?ac.createStereoPanner():null; if(pan) pan.pan.value=opt.pan||0;
    s.connect(f); f.connect(g); const last=pan?(g.connect(pan),pan):g; last.connect(opt.out||musicBus);
    let reverbSend=null;
    if(opt.rev&&(opt.out||musicBus)!==sfxBus){ reverbSend=ac.createGain(); reverbSend.gain.value=opt.rev; last.connect(reverbSend); reverbSend.connect(revIn); }
    trackSource(s,opt.out||musicBus,()=>{for(const n of [f,g,pan,reverbSend])try{n?.disconnect();}catch(e){}});
    s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  }
  function kick(t,out){ voice(165,t,0.13,"sine",1.0,{slide:42,a:0.002,d:0.05,sus:0.6,r:0.12,cutoff:900,out}); noise(t,0.012,0.35,2500,{out}); }
  function snare(t,out){ noise(t,0.16,0.5,1900,{type:"bandpass",q:0.6,rev:0.28,out}); voice(195,t,0.06,"triangle",0.35,{slide:140,a:0.001,d:0.03,sus:0.4,r:0.06,cutoff:1500,out}); }
  function hat(t,k,out){ noise(t,0.035,0.16,7800,{pan:k%2?0.3:-0.3,out}); }
  function schedule(){
    const S=song, sd=60/S.bpm/2;
    while(nextT < ac.currentTime+0.12){
      const i=step%S.steps, bar=Math.floor(i/8), k=i%8, ch=S.bars[bar];
      for(const e of (Math.floor(step/S.steps)%2?S.alt:S.lead)) if(e.step===i) voice(hz(e.n),nextT,sd*e.len*0.92,"p25",S.st.leadVol,{vib:true,detune:6,cutoff:3000,fenv:1800,q:1.2,rev:0.24,dly:0.2,a:0.008,d:0.1,sus:0.72,r:0.1});
      const root=ch.root, bt=S.bass[k];
      if(bt && bt!=="."){ const base=36+root+(root>7?-12:0)+12; const n = bt==="r"?base: bt==="r8"?base+12 : base+7; voice(hz(n),nextT,sd*0.85,"triangle",S.st.bassVol,{sub:true,cutoff:1300,fenv:600,a:0.004,d:0.06,sus:0.85,r:0.05}); }
      const at=S.arp[k]; if(at!=null){ const q=ch.q; const n=60+root+(q[(+at)%q.length])+(+at>=q.length?12:0); voice(hz(n),nextT,sd*0.55,"p12",S.st.arpVol*1.2,{pan:k%2?0.4:-0.4,cutoff:2400,fenv:1200,rev:0.32,a:0.004,d:0.05,sus:0.45,r:0.08}); }
      if(S.hat[k]==="x") hat(nextT,k);
      if(S.kick[k]==="x") kick(nextT);
      if(S.snare[k]==="x") snare(nextT);
      nextT+=sd; step++;
    }
  }
  function play(name){
    if(jingleT){ clearTimeout(jingleT); jingleT=null; }
    if(cur===name && (timer||!on)) return;
    cur=name; stopBgm();
    if(!on||!ac||!SONGS[name]) return;
    song=compile(SONGS[name]); step=0; nextT=ac.currentTime+0.06; if(dly) dly.delayTime.setValueAtTime(Math.min(1.2,60/song.bpm*0.75),ac.currentTime);
    schedule(); timer=setInterval(schedule,25);
  }
  /* ジングル：短い曲を1回鳴らし、終わったら next の曲へ（勝利・レベルアップ・全滅） */
  const JINGLES = {
    fanfare:{ bpm:150, lead:"C5 C5 C5 - C5 - G#4 - A#4 - C5 - A#4 C5 - - | G5 - - - - - . .", bass:"C3 . C3 . C3 . G#2 . A#2 . C3 . A#2 C3 . . | G2 - C3 - C2 - . ." , harm:"E4 E4 E4 - E4 - C4 - D4 - E4 - D4 E4 - - | B4 - - - - - . ." },
    levelup:{ bpm:168, lead:"G5 - B5 - D6 - G6 - | F#6 - D6 - A5 - D6 - | G6 - - - B6 - - - | G6 - - - - - . .", bass:"G3 - . - D3 - . - | D3 - . - F#3 - . - | G3 - . - D3 - . - | G2 - - - - - . .", harm:"D5 - G5 - B5 - D6 - | D6 - A5 - F#5 - A5 - | D6 - - - G6 - - - | D6 - - - - - . ." },
    lose:{ bpm:90, lead:"E5 - D#5 - D5 - C#5 - | C5 - - - B4 - - - | A4 - - - - - . .", bass:"A3 - - - G#3 - - - | F3 - - - E3 - - - | A2 - - - - - . .", harm:"C5 - B4 - A#4 - A4 - | G#4 - - - G4 - - - | E4 - - - - - . ." }
  };
  let jingleT=null;
  function jingle(name, next){
    clearTimeout(jingleT);
    const J=JINGLES[name]; if(!J) return;
    stopBgm(); cur=next||null;
    if(!on||!ac){ return; }
    const sd=60/J.bpm/2; let t0=ac.currentTime+0.05, steps=0;
    const lane=(str,wave,vol,o)=>{ const toks=str.replace(/\|/g," ").trim().split(/\s+/); steps=Math.max(steps,toks.length);
      toks.forEach((tk,i)=>{ const n=midi(tk); if(n==null) return; let len=1; while(toks[i+len]==="-") len++; voice(hz(n),t0+i*sd,sd*len*0.92,wave,vol,{vib:len>2,...o}); }); };
    lane(J.lead,"p25",0.34,{detune:7,cutoff:3400,fenv:2000,q:1.2,rev:0.3,dly:0.15,sus:0.8,r:0.14});
    lane(J.harm,"p12",0.18,{pan:-0.35,cutoff:2600,rev:0.35,sus:0.7,r:0.12});
    lane(J.bass,"triangle",0.5,{sub:true,cutoff:1300,sus:0.9,r:0.08});
    for(let i=0;i<steps;i+=4) kick(t0+i*sd);
    jingleT=setTimeout(()=>{ jingleT=null; if(next){ const n=next; cur=null; play(n); } }, (steps*sd+0.25)*1000);
  }
  function stopBgm(){ if(timer){ clearInterval(timer); timer=null; } stopSources("music"); duckUntil=0; if(musicBus&&ac){ musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setValueAtTime(musicGain(),ac.currentTime); } }
  /* 効果音とジングル */
  const SFX = {
    seaWave:[["noise",.12],[null,.04],["noise",.16]],seaRescue:[["p25",76,.08],["p25",81,.08],["p25",88,.18]],seaTreasure:[["p12",79,.06],["p12",84,.06],["p12",91,.25]],
    pet:[["p25",79,.05],["p25",86,.07],["p12",91,.13]],petgrow:[["p12",84,.08],["p12",91,.1],["p25",96,.18]],
    petCare:[["p25",79,.05],["p25",86,.07],["p12",91,.13]],critical:[["noise",.04],["p12",96,.05],["p25",60,.12]],evade:[["p12",91,.03],["p12",96,.04]],equip:[["p50",72,.05],["p50",84,.08]],
    ok:[["p50",84,.05]], cancel:[["p50",72,.05],["p50",67,.07]], hit:[["noise",.06],["p25",55,.05]],
    heal:[["p25",76,.05],["p25",81,.05],["p25",88,.09]], step:[["noise",.02]], buy:[["p25",79,.05],["p25",84,.09]],
    enc:[["p50",88,.04],["p50",76,.04],["p50",88,.04],["p50",76,.04],["p50",91,.12]],
    clap:[["noise",.03],[null,.03],["noise",.03],[null,.03],["noise",.05]], kira:[["p12",88,.05],["p12",91,.05],["p12",96,.05],["p12",100,.14]],
    win:[["p25",72,.1],["p25",76,.1],["p25",79,.1],["p25",84,.12],[null,.05],["p25",79,.08],["p25",84,.3]],
    lose:[["p25",67,.18],["p25",63,.18],["p25",60,.4]],
    slash:[["noise",.03],["p50",88,.02],["p50",76,.02],["noise",.07],["p50",48,.06]],
    skillhit:[["p12",84,.03],["p12",91,.03],["p12",96,.03],["noise",.08],["p50",52,.05],["p50",45,.08]],
    allhit:[["p25",72,.04],["p25",79,.04],["p25",84,.04],["noise",.06],["noise",.06],["noise",.1],["p50",40,.12]],
    meter:[["p25",60,.05],["p25",67,.05],["p25",72,.05],["p25",79,.05],["p25",84,.05],["p25",91,.08],["noise",.15],["p50",36,.25]],
    defeat:[["p50",79,.04],["p50",72,.04],["p50",67,.04],["noise",.12]], damage:[["noise",.09],["p50",45,.05],["p50",40,.08]], down:[["noise",.12],["p50",50,.08],["p50",43,.1],["p50",36,.22]], level:[["p25",79,.07],["p25",83,.07],["p25",86,.07],["p25",91,.25]],
    rank:[["p25",72,.12],["p25",79,.12],["p25",84,.12],["p25",88,.12],["p25",91,.4]]
  };
  function duckBgm(duration){
    if(!ac||!musicBus||!timer) return;
    const now=ac.currentTime;
    duckUntil=Math.max(duckUntil,now+duration);
    const gain=musicBus.gain;
    if(typeof gain.cancelAndHoldAtTime==="function") gain.cancelAndHoldAtTime(now);
    else { gain.cancelScheduledValues(now); gain.setValueAtTime(Math.min(gain.value,musicGain()),now); }
    gain.linearRampToValueAtTime(musicGain()*.68,now+0.025);
    gain.setValueAtTime(musicGain()*.68,duckUntil);
    gain.linearRampToValueAtTime(musicGain(),duckUntil+0.38);
  }
  function sfx(name){
    if(!on||!ac) return; const parts=SFX[name]||[]; if(!parts.length) return; let t=ac.currentTime+0.01;
    duckBgm(parts.reduce((n,s)=>n+(s[0]==="noise"||s[0]===null?s[1]:s[2]),0)+0.08);
    for(const s of parts){
      if(s[0]==="noise"){ noise(t,s[1]+0.03,0.36,1200,{type:"bandpass",q:0.5,out:sfxBus,rev:0.15}); noise(t,0.02,0.20,5000,{out:sfxBus}); t+=s[1]; }
      else if(s[0]===null){ t+=s[1]; }
      else { voice(hz(s[1]),t,s[2],s[0],0.42,{out:sfxBus,sus:0.8,detune:4,cutoff:4500,fenv:1500,rev:0.18,a:0.002,d:0.03,r:0.05}); t+=s[2]; }
    }
  }
  function outputLevel(value,time){
    if(!ac||!master) return;
    const gain=master.gain,now=ac.currentTime;
    if(typeof gain.cancelAndHoldAtTime==="function") gain.cancelAndHoldAtTime(now);
    else { gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value,now); }
    gain.linearRampToValueAtTime(value,now+time);
  }
  function setOn(v){
    if(v){ if(!init()){ on=false; return false; } if(ac.state==="suspended") ac.resume().catch(()=>{}); if(on) return true; on=true; outputLevel(0.85,0.06); const c=cur; cur=null; if(c) play(c); }
    else { if(!on) return false; on=false; if(jingleT){ clearTimeout(jingleT); jingleT=null; } stopBgm(); stopSources(); outputLevel(0.0001,0.03); }
    return on;
  }
  function suspend(){ if(jingleT){ clearTimeout(jingleT); jingleT=null; } stopBgm(); stopSources(); if(ac&&ac.state==="running") ac.suspend().catch(()=>{}); }
  function resume(){ if(!on||!ac) return; if(ac.state==="suspended") ac.resume().catch(()=>{}); if(timer||jingleT) return; const c=cur; cur=null; if(c) play(c); }
  return { play, jingle, sfx, setOn, setVolumes, suspend, resume, get songs(){return Object.keys(SONGS);},get sourceCount(){return activeSources.size;},get volumes(){return {music:musicVolume,effects:effectVolume};}, get on(){return on;}, get current(){return cur;} };
})();
