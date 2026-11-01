/* Original symphonic adventure score: strings, horns, woodwinds, harp and timpani. */
const SND = (()=>{
  let ac=null, master=null, bus=null, on=false, cur=null, timer=null, song=null, nextT=0, step=0, waves={}, noiseBuf=null;
  const NOTE={C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
  const midi = s => { const m=s.match(/^([A-G][#b]?)(\d)$/); return m? 12*(+m[2]+1)+NOTE[m[1]] : null; };
  const hz = n => 440*Math.pow(2,(n-69)/12);
  const CH={"":[0,4,7],m:[0,3,7],"7":[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],sus4:[0,5,7],dim:[0,3,6]};
  const chord = s => { const m=s.match(/^([A-G][#b]?)(.*)$/); return {root:NOTE[m[1]], q:CH[m[2]]||CH[""]}; };

  /* 曲データ：lead は8分音符ごと（- は伸ばす、. は休符）。chords は1小節ごと */
  const SONGS = {
    title:{bpm:96,style:"overture",chords:"D A G A7 D Bm Em A7 G Em A D Em Bm G A7 Bm G A D Em Em A A7 D G A D G D Em A7",
      lead:"D5 - A4 D5 F#5 - A5 - | G5 - F#5 E5 D5 - A4 - | B4 - D5 G5 A5 B5 - A5 | C#6 - A5 - E5 - - - | F#5 - A5 - D6 - C#6 B5 | A5 - F#5 E5 D5 - F#5 - | G5 A5 B5 - A5 G5 E5 - | F#5 - E5 - C#5 - A4 - | B4 - D5 - F#5 - A5 - | G5 - E5 - B4 - - - | A4 - C#5 E5 A5 - G5 - | F#5 - D5 - A4 - - - | G4 - B4 D5 G5 - F#5 E5 | F#5 - A5 - D6 - C#6 - | B5 - A5 G5 F#5 - E5 - | C#5 - E5 A5 C#6 - - - | B4 F#5 B5 - A5 F#5 D5 - | G5 - B5 - D6 - C#6 B5 | A5 - E5 A5 C#6 - B5 A5 | F#5 - D5 F#5 A5 - - - | E5 G5 B5 - A5 G5 F#5 E5 | G5 B5 E6 - D6 B5 A5 - | C#6 - B5 A5 G5 - E5 - | A5 - C#6 - E6 - - - | D6 - A5 D6 F#6 - E6 D6 | B5 - G5 B5 D6 - C#6 B5 | A5 - C#6 E6 D6 C#6 B5 A5 | F#5 - A5 D6 A5 - - - | B5 A5 G5 - D6 - B5 - | A5 F#5 D5 - F#5 - A5 - | G5 - B5 D6 E6 - C#6 - | D6 - - - A5 - C#6 -",
      leadAlt:"D6 - A5 D6 F#6 - E6 D6 | B5 - G5 B5 D6 - C#6 B5 | A5 - C#6 E6 D6 C#6 B5 A5 | F#5 - A5 D6 A5 - - - | B5 A5 G5 - D6 - B5 - | A5 F#5 D5 - F#5 - A5 - | G5 - B5 D6 E6 - C#6 - | D6 - - - A5 - C#6 - | B4 - D5 - F#5 - A5 - | G5 - E5 - B4 - - - | A4 - C#5 E5 A5 - G5 - | F#5 - D5 - A4 - - - | G4 - B4 D5 G5 - F#5 E5 | F#5 - A5 - D6 - C#6 - | B5 - A5 G5 F#5 - E5 - | C#5 - E5 A5 C#6 - - - | B4 F#5 B5 - A5 F#5 D5 - | G5 - B5 - D6 - C#6 B5 | A5 - E5 A5 C#6 - B5 A5 | F#5 - D5 F#5 A5 - - - | E5 G5 B5 - A5 G5 F#5 E5 | G5 B5 E6 - D6 B5 A5 - | C#6 - B5 A5 G5 - E5 - | A5 - C#6 - E6 - - - | D6 - A5 D6 F#6 - E6 D6 | B5 - G5 B5 D6 - C#6 B5 | A5 - C#6 E6 D6 C#6 B5 A5 | F#5 - A5 D6 A5 - - - | B5 A5 G5 - D6 - B5 - | A5 F#5 D5 - F#5 - A5 - | G5 - B5 D6 E6 - C#6 - | D6 - - - A5 - C#6 -"},
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

  // Long-form original scores: theme, contrasting melody, quiet bridge and developed return.
  const DEVELOPMENTS={"fukuoka":{"b":"Bb Dm Gm C Am Dm Gm C","c":"Dm Am Bb F Gm Dm Gm C","lead":"D5 - F5 Bb5 A5 - G5 F5 | A5 - F5 E5 D5 - - - | Bb4 D5 G5 - A5 Bb5 A5 G5 | E5 - G5 - C6 - Bb5 G5 | E5 A5 C6 - B5 A5 G5 E5 | F5 - A5 - D6 C6 A5 F5 | G5 A5 Bb5 - A5 G5 F5 D5 | E5 - G5 Bb5 C6 - - -"},"field":{"b":"F C Gm Dm Bb F Em7 A7","c":"Bb F Gm Dm Eb Bb Gm A7","lead":"A5 - C6 - F6 E6 D6 C6 | G5 - E5 G5 C6 - B5 G5 | Bb5 - A5 G5 D6 - Bb5 A5 | F5 A5 D6 - C6 A5 F5 D5 | Bb4 D5 F5 - A5 G5 F5 D5 | C5 F5 A5 - C6 - A5 G5 | G5 - B5 D6 E6 D6 B5 G5 | A5 - G5 E5 C#5 E5 A5 -"},"battle":{"b":"F Dm G C Am F Bdim E7","c":"Am Em F C Dm Am F E7","lead":"C6 - A5 F5 A5 C6 D6 E6 | F6 E6 D6 A5 F5 - A5 D6 | B5 D6 G6 - F6 D6 B5 G5 | E6 D6 C6 G5 E5 G5 C6 - | E6 - C6 A5 B5 C6 E6 G6 | F6 - E6 C6 A5 - F5 A5 | B5 D6 F6 E6 D6 B5 A5 F5 | G#5 B5 E6 - D6 B5 G#5 E5"},"boss":{"b":"C Am D B7 Em C F#dim B7","c":"Am Em F#dim B7 C Am D B7","lead":"G5 C6 E6 - D6 C6 B5 G5 | A5 - C6 E6 F#6 E6 C6 A5 | F#5 A5 D6 - E6 D6 A5 F#5 | F#5 - D#5 B4 D#5 F#5 A5 - | B5 - G5 E5 F#5 G5 B5 D6 | E6 D6 C6 G5 E5 - G5 C6 | F#5 A5 C6 - E6 C6 A5 F#5 | D#6 - C6 A5 F#5 D#5 B4 -"},"stream":{"b":"C G Am D Em Bm C D","c":"Am Em C G Am Em C D","lead":"G5 - E6 - D6 C6 B5 G5 | B5 D6 G6 - F#6 D6 B5 G5 | A5 C6 E6 - D6 C6 A5 E5 | F#5 A5 D6 - C6 A5 F#5 D5 | G5 - B5 E6 F#6 E6 D6 B5 | D6 - B5 F#5 A5 B5 D6 - | E6 - D6 C6 G5 E5 G5 C6 | A5 - C6 D6 F#6 E6 D6 -"},"victory":{"b":"F C Dm G Am Em F G","c":"Am F C G Dm Am F G","lead":"A5 C6 F6 - E6 D6 C6 A5 | G5 - E5 G5 C6 - - - | A5 D6 F6 - E6 D6 A5 F5 | G5 B5 D6 - E6 D6 B5 G5 | A5 - C6 E6 G6 E6 C6 A5 | B5 - G5 E5 G5 B5 E6 - | F6 E6 D6 C6 A5 - F5 A5 | G5 - B5 D6 C6 - - -"},"ending":{"b":"Bb F Gm C Am Dm Gm C","c":"Dm Am Bb F Gm Dm Gm C","lead":"D6 - - C6 Bb5 - F5 - | A5 - - G5 F5 - C6 - | Bb5 - D6 - F6 - E6 D6 | E6 - - D6 C6 - G5 - | C6 - B5 A5 E5 - A5 - | A5 - F5 D5 F5 A5 D6 - | Bb5 - A5 G5 D6 - Bb5 - | G5 - E5 C5 E5 G5 C6 -"}};
  const noteName=n=>['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((n%12)+12)%12]+(Math.floor(n/12)-1);
  function phrase(chords,seed,quiet=false){return chords.split(' ').map((symbol,bar)=>{const ch=chord(symbol),notes=ch.q.map(n=>60+ch.root+n),a=notes[(bar+seed)%3],b=notes[(bar+seed+1)%3],c=notes[(bar+seed+2)%3];const patterns=quiet?[[a,'-','-',b,'-',c,'-','.'],['.',a,'-',b,'-','-',c,'-'],[a,'-','-','-',c,'-',b,'-']]:[[a,b,c,'-',b,a,c+12,'-'],[c,'-',b,a,b,c,b,'-'],[a,'-',c,b,a,b,c+12,b],[c,b,a,'.',b,'-',c,'-']];return patterns[(bar+seed)%patterns.length].map(n=>typeof n==='number'?noteName(n):n).join(' ');}).join(' | ');}
  for(const [name,original]of Object.entries(SONGS)){
   if(name==='title')continue;
   const sea=name.startsWith('sea_RG'),battle=name==='battle'||name==='boss'||name==='seaBattle',baseChords=original.chords,main=original.lead;
   const def=DEVELOPMENTS[name]||DEVELOPMENTS[name==='seaBattle'?'battle':name==='sea_RG04'?'ending':'field'];
   const seed=Object.keys(SONGS).indexOf(name),bChords=sea?baseChords.split(' ').slice(4).concat(baseChords.split(' ').slice(0,4)).join(' '):def.b;
   const cChords=sea?baseChords.split(' ').map((c,i)=>i%4===3?c:baseChords.split(' ')[(i+2)%8]).join(' '):def.c;
   const contrast=sea?phrase(bChords,seed):def.lead,bridge=phrase(cChords,seed+1,true),returnMelody=main.split('|').map((bar,i)=>i%4===3?phrase(baseChords.split(' ')[i],seed+i,true):bar.trim()).join(' | ');
   const chordSections=battle?[baseChords,bChords,cChords,baseChords,bChords,baseChords]:[baseChords,bChords,cChords,baseChords];
   const melodySections=battle?[main,contrast,bridge,returnMelody,phrase(bChords,seed+3),main]:[main,contrast,bridge,returnMelody];
   SONGS[name]={...original,chords:chordSections.join(' '),lead:melodySections.join(' | '),leadAlt:melodySections.map((part,i)=>i===0?returnMelody:i===1?phrase(bChords,seed+2):part).join(' | ')};
  }

  // Land exploration has its own forest, mountain, coast, river and lake arrangements.
  function transposeSong(base,shift,bpm,style,swap=false){const bars=base.chords.split(' '),lead=base.lead.split('|').map(s=>s.trim()),alt=base.leadAlt.split('|').map(s=>s.trim());const order=swap?[1,0,2,3]:[0,1,2,3],reorder=a=>order.flatMap(i=>a.slice(i*8,i*8+8));const trans=s=>s.replace(/[A-G][#b]?\d/g,n=>noteName(midi(n)+shift));return {...base,bpm,style,chords:reorder(bars).map(c=>{const m=c.match(/^([A-G][#b]?)(.*)$/);return noteName(60+NOTE[m[1]]+shift).replace(/\d$/,'')+m[2];}).join(' '),lead:trans(reorder(lead).join(' | ')),leadAlt:trans(reorder(alt).join(' | '))};}
  for(const [id,shift,bpm,style,swap]of [['field_forest',-5,94,'soft',true],['field_mountain',2,112,'march',false],['field_coast',5,108,'town',true],['field_river',-2,100,'soft',true],['field_lake',0,86,'soft',false]])SONGS[id]=transposeSong(SONGS.field,shift,bpm,style,swap);
  for(const [id,shift,bpm]of [['town_coast',2,112],['town_forest',5,104],['town_mountain',-3,108]])SONGS[id]=transposeSong(SONGS.fukuoka,shift,bpm,'town',true);
  function sceneForMap(m){if(!m)return 'title';const terrain=m.terrain||'plain';if(m.kind==='field')return SONGS['field_'+terrain]?'field_'+terrain:'field';return ['coast','river','lake'].includes(terrain)?'town_coast':terrain==='forest'?'town_forest':terrain==='mountain'?'town_mountain':'fukuoka';}
  const STYLE = {
    overture:{bass:"r . 5 . r8 . 5 .",arp:"0 1 2 1 0 2 1 2",hat:"",kick:"",snare:". . x . . . x .",leadVol:.3,arpVol:.09,bassVol:.5},
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
    return { bpm:s.bpm, steps:bars.length*8, bars, lead, alt, style:s.style, st, bass:pat(st.bass), arp:pat(st.arp), hat:pat(st.hat), kick:pat(st.kick), snare:pat(st.snare) };
  }
  /* 音の通り道：パート別バス → 音色EQ → コンプレッサー → 出力。リバーブとディレイは送りで混ぜる */
  let musicBus=null, sfxBus=null, revIn=null, dlyIn=null, dly=null, duckUntil=0, revOutput=null, delayOutput=null;
  let musicVolume=1,effectVolume=1;
  const activeSources=new Map();
  const pageHidden=()=>typeof document!=="undefined"&&document.hidden;
  const sourceReleases=new Map(),releasingSources=new Set();
  function trackSource(node,out,cleanup,gain,start=0){
    activeSources.set(node,out===sfxBus?'sfx':'music');if(gain)sourceReleases.set(node,{gain,start});
    node.onended=()=>{activeSources.delete(node);sourceReleases.delete(node);releasingSources.delete(node);try{node.disconnect();}catch(e){}if(cleanup)cleanup();};
  }
  function stopSources(group,fade=false){
    const now=ac?.currentTime||0;
    for(const [node,kind]of activeSources){
      if(group&&kind!==group)continue;
      if(fade&&releasingSources.has(node))continue;
      const release=sourceReleases.get(node);
      if(fade&&release&&release.start<=now){
        try{holdGain(release.gain,now);release.gain.linearRampToValueAtTime(.0001,now+.012);node.stop(now+.02);releasingSources.add(node);continue;}catch(e){}
      }
      try{node.stop();}catch(e){}try{node.disconnect();}catch(e){}
      activeSources.delete(node);sourceReleases.delete(node);releasingSources.delete(node);
    }
  }
  const musicGain=()=>0.5*musicVolume;
  function holdGain(gain,t){
    if(typeof gain.cancelAndHoldAtTime==='function')gain.cancelAndHoldAtTime(t);
    else {gain.cancelScheduledValues(t);gain.setValueAtTime(gain.value,t);}
  }
  function mixMusic(){
    if(!ac||!musicBus)return;
    const t=ac.currentTime,ducked=duckUntil>t,end=t+.025,until=Math.max(duckUntil,end);
    // Direct score and its room/echo returns follow the same envelope.
    for(const [node,level]of [[musicBus,.5],[revOutput,.55],[delayOutput,.45]]){
      if(!node)continue;
      const gain=node.gain,target=level*musicVolume;
      holdGain(gain,t);gain.linearRampToValueAtTime(target*(ducked?.68:1),end);
      if(ducked){gain.setValueAtTime(target*.68,until);gain.linearRampToValueAtTime(target,until+.38);}
    }
  }
  function setVolumes(music,effects){
    if(!Number.isFinite(music)||!Number.isFinite(effects))return false;
    musicVolume=Math.max(0,Math.min(1,music));effectVolume=Math.max(0,Math.min(1,effects));
    if(ac&&musicBus){const t=ac.currentTime;mixMusic();holdGain(sfxBus.gain,t);sfxBus.gain.linearRampToValueAtTime(.75*effectVolume,t+.025);}
    return true;
  }
  function impulse(sec,decay){ const len=Math.floor(ac.sampleRate*sec), b=ac.createBuffer(2,len,ac.sampleRate);
    for(let c=0;c<2;c++){ const d=b.getChannelData(c); for(let i=0;i<len;i++){ const t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,decay)*(i<ac.sampleRate*0.012?i/(ac.sampleRate*0.012):1); } } return b; }
  function init(){
    if(ac) return true;
    try{
      ac=new (window.AudioContext||window.webkitAudioContext)({latencyHint:"interactive"});
      ac.addEventListener?.("statechange",()=>{if(typeof refreshTitleMusic==="function")refreshTitleMusic();});
      const comp=ac.createDynamicsCompressor(); comp.threshold.value=-16; comp.knee.value=12; comp.ratio.value=3.5; comp.attack.value=0.004; comp.release.value=0.18;
      master=ac.createGain(); master.gain.value=0.85; master.connect(comp); comp.connect(ac.destination);
      const low=ac.createBiquadFilter(); low.type="lowshelf"; low.frequency.value=140; low.gain.value=2.5;
      const high=ac.createBiquadFilter(); high.type="highshelf"; high.frequency.value=5200; high.gain.value=-5;
      low.connect(high); high.connect(master);
      musicBus=ac.createGain(); musicBus.gain.value=musicGain(); musicBus.connect(low);
      sfxBus=ac.createGain(); sfxBus.gain.value=0.75*effectVolume; sfxBus.connect(low);
      bus=musicBus;
      // リバーブ（小さめのホール）
      const conv=ac.createConvolver(); conv.buffer=impulse(2.8,2.8); const revLp=ac.createBiquadFilter(); revLp.type="lowpass"; revLp.frequency.value=4200;
      revIn=ac.createGain(); revIn.gain.value=1; const revOut=ac.createGain(); revOutput=revOut; revOut.gain.value=0.55*musicVolume;
      revIn.connect(conv); conv.connect(revLp); revLp.connect(revOut); revOut.connect(low);
      // ディレイ（付点8分のこだま）
      dlyIn=ac.createGain(); dly=ac.createDelay(1.5); dly.delayTime.value=0.3; const fb=ac.createGain(); fb.gain.value=0.3; const dLp=ac.createBiquadFilter(); dLp.type="lowpass"; dLp.frequency.value=2600; const dOut=ac.createGain(); delayOutput=dOut; dOut.gain.value=0.45*musicVolume;
      dlyIn.connect(dly); dly.connect(dLp); dLp.connect(fb); fb.connect(dly); dLp.connect(dOut); dOut.connect(low); dOut.connect(revIn);
      const pulse=d=>{ const N=48, re=new Float32Array(N), im=new Float32Array(N); for(let n=1;n<N;n++) re[n]=2/(n*Math.PI)*Math.sin(n*Math.PI*d)*Math.exp(-n/36); return ac.createPeriodicWave(re,im); };
      const orchestral=(partials)=>{const re=new Float32Array(32),im=new Float32Array(32);partials.forEach((a,i)=>im[i+1]=a);return ac.createPeriodicWave(re,im);};
      waves={p25:pulse(.25),p12:pulse(.125),p50:pulse(.5),strings:orchestral([1,.48,.3,.22,.16,.1,.08,.05]),horn:orchestral([1,.56,.27,.13,.06,.03]),flute:orchestral([1,.07,.12,.025]),harp:orchestral([1,.38,.18,.08,.03])};
      noiseBuf=ac.createBuffer(1,ac.sampleRate*1,ac.sampleRate); const nd=noiseBuf.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=Math.random()*2-1;
      try{initSamples();}catch(e){sampleBanks.clear();}return true;
    }catch(e){ ac=null; return false; }
  }
  const sampleBanks=new Map();let sampleTurns=0,sampleNotes=0,droppedSampleNotes=0;
  function initSamples(){
    if(typeof ORCHESTRA_BANK==='undefined'||typeof atob!=='function')return;
    for(const sample of ORCHESTRA_BANK.samples){const decoded=ORCHESTRA_CODEC.decode(sample),buffer=ac.createBuffer(1,decoded.length,sample.rate);buffer.getChannelData(0).set(decoded);const group=sampleBanks.get(sample.instrument)||[];group.push({...sample,pcm:undefined,ima:undefined,mulaw:undefined,buffer});sampleBanks.set(sample.instrument,group);}
  }
  function sampleVoice(f,t,dur,instrument,vol,opt={}){
    const group=sampleBanks.get(instrument);if(!group)return false;
    const out=opt.out||musicBus;if(activeSources.size>=(out===sfxBus?96:80)){droppedSampleNotes++;return true;}
    const note=69+12*Math.log2(f/440),distance=Math.min(...group.map(s=>Math.abs(s.root-note))),pool=group.filter(s=>Math.abs(Math.abs(s.root-note)-distance)<.01),sample=pool[(sampleTurns++)%pool.length];
    const src=ac.createBufferSource(),gain=ac.createGain(),pan=ac.createStereoPanner?ac.createStereoPanner():null;
    src.buffer=sample.buffer;src.playbackRate.setValueAtTime(2**((note-sample.root)/12),t);src.loop=sample.loopEnd>0;src.loopStart=sample.loopStart;src.loopEnd=sample.loopEnd;
    const release=opt.r??.16,attack=Math.min(opt.a??.012,dur*.2),sustain=opt.sus??.8,level=vol*(opt.expression??1)*(out===sfxBus?1:2);
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(level,t+attack);gain.gain.linearRampToValueAtTime(level*sustain,t+Math.min(dur*.6,attack+.12));gain.gain.setValueAtTime(level*sustain,t+dur);gain.gain.linearRampToValueAtTime(.0001,t+dur+release);
    // Recorded notes must honor the same tone control as synthesized effects.
    const filter=Number.isFinite(opt.cutoff)?ac.createBiquadFilter():null;
    if(filter){filter.type='lowpass';filter.Q.value=opt.q??.7;const cutoff=Math.max(200,Math.min(ac.sampleRate*.45,opt.cutoff));filter.frequency.setValueAtTime(Math.min(ac.sampleRate*.45,cutoff+(opt.fenv||0)),t);filter.frequency.exponentialRampToValueAtTime(cutoff,t+Math.min(.25,dur));src.connect(filter);filter.connect(gain);}else src.connect(gain);
    const last=pan?(gain.connect(pan),pan):gain;if(pan)pan.pan.value=opt.pan||0;last.connect(out);
    const send=out!==sfxBus&&opt.rev?ac.createGain():null;if(send){send.gain.value=opt.rev;last.connect(send);send.connect(revIn);}
    trackSource(src,out,()=>{for(const node of [gain,pan,send,filter])try{node?.disconnect();}catch(e){}},gain.gain,t);src.start(t);src.stop(t+dur+release+.02);sampleNotes++;return true;
  }
  /* 1音：オシレーター（2本で厚み）→ 音量エンベロープ → ローパス → 定位 → バス＋送り */
  function voice(f, t, dur, wave, vol, opt={}){
    if(sampleVoice(f,t,dur,wave,vol,opt))return;
    wave=({oboe:'triangle',cello:'strings',bass:'triangle',trumpet:'horn',pizz:'harp',spiccato:'strings',glock:'sine',timpani:'sine'})[wave]||wave;
    const need=(opt.detune?2:1)*(opt.vib&&dur>.22?2:1)+(opt.sub?1:0);if(activeSources.size+need>96)return;
    const nodes=[],sources=[];const clean=()=>{if(sources.some(n=>activeSources.has(n)))return;for(const n of nodes)try{n.disconnect();}catch(e){}};
    const out=opt.out||musicBus, A=opt.a??0.006, D=opt.d??0.08, S=opt.sus??0.7, R=opt.r??0.06;
    const g=ac.createGain(), flt=ac.createBiquadFilter(); flt.type="lowpass"; flt.Q.value=opt.q??0.7;
    const cut=opt.cutoff??4000; flt.frequency.setValueAtTime(cut+(opt.fenv||0),t); flt.frequency.exponentialRampToValueAtTime(Math.max(200,cut),t+Math.min(0.25,dur));
    const pan=ac.createStereoPanner?ac.createStereoPanner():null; if(pan) pan.pan.value=opt.pan||0;
    const mk=(det,lvl)=>{ const o=ac.createOscillator(); if(waves[wave]) o.setPeriodicWave(waves[wave]); else o.type=wave; o.frequency.setValueAtTime(f,t); o.detune.value=det;
      if(opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide,t+dur);
      if(opt.vib && dur>0.22){ const l=ac.createOscillator(), lg=ac.createGain(); l.frequency.value=5.2; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*0.01,t+0.2); l.connect(lg); lg.connect(o.frequency); sources.push(l);nodes.push(lg);trackSource(l,out,clean,g.gain,t);l.start(t); l.stop(t+dur+R+0.05); }
      const og=ac.createGain(); og.gain.value=lvl; o.connect(og); og.connect(g); sources.push(o);nodes.push(og);trackSource(o,out,clean,g.gain,t);o.start(t); o.stop(t+dur+R+0.05); };
    if(opt.detune){ mk(-opt.detune,0.55); mk(opt.detune,0.55); } else mk(0,1);
    if(opt.sub){ const o=ac.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(f/2,t); const og=ac.createGain(); og.gain.value=0.6; o.connect(og); og.connect(g); sources.push(o);nodes.push(og);trackSource(o,out,clean,g.gain,t);o.start(t); o.stop(t+dur+R+0.05); }
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+A); g.gain.linearRampToValueAtTime(vol*S,t+A+D);
    g.gain.setValueAtTime(vol*S,t+Math.max(A+D,dur)); g.gain.linearRampToValueAtTime(0.0001,t+Math.max(A+D,dur)+R);
    nodes.push(g,flt);if(pan)nodes.push(pan);
    g.connect(flt); const last = pan? (flt.connect(pan),pan) : flt; last.connect(out);
    if(opt.rev&&out!==sfxBus){ const s=ac.createGain(); s.gain.value=opt.rev; last.connect(s); s.connect(revIn); nodes.push(s); }
    if(opt.dly&&out!==sfxBus){ const s=ac.createGain(); s.gain.value=opt.dly; last.connect(s); s.connect(dlyIn); nodes.push(s); }
  }
  function noise(t, dur, vol, hp, opt={}){
    if(activeSources.size>=96)return;
    const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true; s.playbackRate.value=opt.rate||1;
    const f=ac.createBiquadFilter(); f.type=opt.type||"highpass"; f.frequency.value=hp; f.Q.value=opt.q??0.7;
    const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+Math.min(0.003,dur*0.2)); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const pan=ac.createStereoPanner?ac.createStereoPanner():null; if(pan) pan.pan.value=opt.pan||0;
    s.connect(f); f.connect(g); const last=pan?(g.connect(pan),pan):g; last.connect(opt.out||musicBus);
    let reverbSend=null;
    if(opt.rev&&(opt.out||musicBus)!==sfxBus){ reverbSend=ac.createGain(); reverbSend.gain.value=opt.rev; last.connect(reverbSend); reverbSend.connect(revIn); }
    trackSource(s,opt.out||musicBus,()=>{for(const n of [f,g,pan,reverbSend])try{n?.disconnect();}catch(e){}},g.gain,t);
    s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  }
  function kick(t,out){ voice(165,t,0.13,"sine",1.0,{slide:42,a:0.002,d:0.05,sus:0.6,r:0.12,cutoff:900,out}); noise(t,0.012,0.35,2500,{out}); }
  function snare(t,out){ noise(t,0.16,0.5,1900,{type:"bandpass",q:0.6,rev:0.28,out}); voice(195,t,0.06,"triangle",0.35,{slide:140,a:0.001,d:0.03,sus:0.4,r:0.06,cutoff:1500,out}); }
  function hat(t,k,out){ noise(t,0.035,0.16,7800,{pan:k%2?0.3:-0.3,out}); }
  const timing={recoveries:0,skippedSteps:0,lookahead:.40};
  // Every phrase has a distinct orchestration, rhythm and breathing space.
  function arrangement(S,bar,cycle=0){
    const section=Math.floor(bar/8),style=S.style,combat=['battle','boss'].includes(style),quiet=section===2||(style==='soft'&&section!==3),final=section===(combat?5:3),swap=cycle%2;
    const leads=style==='town'?['oboe','flute','strings','oboe']:style==='pop'?['glock','strings','flute','trumpet']:style==='soft'?['flute','cello','oboe','strings']:style==='overture'?['horn','strings','flute','trumpet']:combat?['strings','trumpet','oboe','strings','horn','trumpet']:['horn','strings','flute','trumpet'];
    const lead=swap&&section===0?'flute':leads[section%leads.length];
    return {section,lead,quiet,final,combat,level:(quiet?.66:final?1.08:.88)*(1+.07*Math.sin((bar%8)*Math.PI/7)),tempo:quiet?.98:final?1.015:1,
      bass:quiet?'r . . . 5 . . .':style==='town'?'r . 5 . r8 . 5 .':combat&&section!==1?'r . r8 . 5 r r8 .':'r . . 5 r8 . 5 .',
      arp:quiet?[0,null,2,null,1,null,2,null]:section%2?[0,2,null,1,2,null,0,1]:[0,null,1,2,null,1,2,null],
      rhythm:quiet?'sustain':combat&&section%3!==1?'spiccato':style==='town'&&section!==3?'pizz':['march','overture'].includes(style)&&section===1?'spiccato':style==='pop'&&section%2===0?'pizz':'sustain'};
  }
  function schedule(){
    const S=song,baseStep=60/S.bpm/2,now=ac.currentTime;
    if(nextT<now+.012){const missed=Math.ceil((now+.02-nextT)/baseStep);step+=missed;nextT+=missed*baseStep;timing.recoveries++;timing.skippedSteps+=missed;}
    while(nextT<now+timing.lookahead){
      const i=step%S.steps,bar=Math.floor(i/8),k=i%8,ch=S.bars[bar],cycle=Math.floor(step/S.steps),A=arrangement(S,bar,cycle),sd=baseStep/A.tempo;
      const pulse=.94+.06*Math.sin(step*2.399),t=nextT+.003*(1+Math.sin(step*1.71)),root=ch.root;
      for(const e of(cycle%2?S.alt:S.lead))if(e.step===i){const instrument=A.lead==='horn'&&e.n>76?'trumpet':A.lead;voice(hz(instrument==='cello'?e.n-12:e.n),t,sd*e.len*(A.combat?.86:.96),instrument,.25*A.level*pulse,{pan:instrument==='flute'?-.22:.12,a:.012,sus:.88,r:.15,rev:.22});
        if(A.final&&k<4)voice(hz(e.n-12),t+.006,sd*e.len*.88,'strings',.085,{pan:-.4,a:.04,sus:.8,r:.2,rev:.2});}
      if(A.rhythm==='sustain'&&(k===0||k===4)){
        // Close voice leading avoids the same root-position chord jumping every bar.
        const tones=ch.q.slice(0,3).map((n,j)=>{let note=55+((root+n-7+12)%12);if(j===2&&bar%2)note-=12;return note;});
        for(let j=0;j<3;j++)voice(hz(tones[j]),t,sd*3.8,'strings',.065*A.level,{pan:[-.6,0,.6][j],a:.06,sus:.83,r:.24,rev:.24});
      }else if(A.rhythm!=='sustain'&&([0,2,4,6].includes(k)||A.final&&k===7)){
        const n=60+root+ch.q[(k/2+bar)%3|0];voice(hz(n),t,sd*(A.rhythm==='pizz'?.7:.55),A.rhythm,.15*A.level*pulse,{pan:k%4?-.4:.4,a:.003,r:.08,rev:.18});
      }
      const bt=A.bass.split(' ')[k];if(bt!=='.'){let n=36+root+(root>7?-12:0)+(bt==='5'?7:bt==='r8'?12:0);voice(hz(n),t,sd*(A.quiet?1.8:.88),A.quiet?'cello':'bass',.25*A.level,{pan:-.1,a:.012,sus:.9,r:.14,rev:.12});}
      const at=A.arp[k];if(at!==null){const n=60+root+ch.q[at%ch.q.length]+(k>=4&&A.final?12:0);voice(hz(n),t,sd*.8,A.quiet||S.style==='town'?'harp':A.combat?'spiccato':'harp',.105*A.level*pulse,{pan:k%2?.55:-.55,a:.003,sus:.3,r:.18,rev:.22});}
      // Countermelody enters only after the opening phrases; long notes leave room for the theme.
      if(bar>=4&&!A.quiet&&k===(bar%2?5:1)){const n=60+root+ch.q[(bar+1)%3];voice(hz(n),t,sd*(bar%2?2:3),'oboe',.11*A.level,{pan:-.35,a:.025,sus:.8,r:.2,rev:.18});}
      if(!A.quiet&&(k===0||A.combat&&k===4))voice(hz(36+root),t,sd*1.4,'timpani',.19*A.level,{a:.002,sus:.35,r:.2,rev:.18});
      if(A.combat&&!A.quiet&&(k===2||k===6))noise(t,.12,.065*pulse,1800,{type:'bandpass',pan:.25,rev:.12});
      if(bar%8===7&&k>=6&&!A.quiet){voice(hz(36+root),t,sd*.45,'timpani',.10+(k-6)*.04,{a:.002,r:.12,rev:.15});voice(hz(36+root),t+sd*.5,sd*.4,'timpani',.09,{a:.002,r:.1});}
      if(k===0&&bar%8===0&&bar>0&&!A.quiet)noise(t,sd*3,.05,6200,{rev:.3});
      if(S.style==='town'&&k===6&&bar%4===3||S.style==='soft'&&k===0&&bar%4===0)voice(hz(84+root),t,sd*1.7,'glock',.065,{pan:.3,a:.002,r:.35,rev:.3});
      nextT+=sd;step++;
    }
  }
  function play(name){
    if(!Object.hasOwn(SONGS,name))return;
    if(jingleT){ clearTimeout(jingleT); jingleT=null; }
    if(cur===name && (timer||!on)) return;
    cur=name; stopBgm();
    if(!on||!ac||pageHidden()||!SONGS[name]) return;
    song=compile(SONGS[name]);song.name=name; step=0; nextT=ac.currentTime+0.06; if(dly) dly.delayTime.setValueAtTime(Math.min(1.2,60/song.bpm*0.75),ac.currentTime);
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
    if(!Object.hasOwn(JINGLES,name))return;
    clearTimeout(jingleT);jingleT=null;
    const J=JINGLES[name]; if(!J) return;
    stopBgm(); cur=next||null;
    if(!on||!ac||pageHidden()){ return; }
    const sd=60/J.bpm/2; let t0=ac.currentTime+0.05, steps=0;
    const lane=(str,wave,vol,o)=>{ const toks=str.replace(/\|/g," ").trim().split(/\s+/); steps=Math.max(steps,toks.length);
      toks.forEach((tk,i)=>{ const n=midi(tk); if(n==null) return; let len=1; while(toks[i+len]==="-") len++; voice(hz(n),t0+i*sd,sd*len*0.92,wave,vol,{vib:len>2,...o}); }); };
    lane(J.lead,"trumpet",0.26,{detune:7,cutoff:3400,fenv:2000,q:1.2,rev:0.3,dly:0.15,sus:0.8,r:0.14});
    lane(J.harm,"strings",0.16,{pan:-0.35,cutoff:2600,rev:0.35,sus:0.7,r:0.12});
    lane(J.bass,"bass",0.3,{sub:true,cutoff:1300,sus:0.9,r:0.08});
    for(let i=0;i<steps;i+=4) kick(t0+i*sd);
    const end=t0+steps*sd+.2;
    let handle;
    const finish=()=>{
      if(jingleT!==handle)return;
      const remaining=end-ac.currentTime;
      if(remaining>0){handle=setTimeout(finish,Math.max(25,remaining*1000));jingleT=handle;return;}
      jingleT=null;if(next){cur=null;play(next);}
    };
    handle=setTimeout(finish,(end-ac.currentTime)*1000);jingleT=handle;
  }
  function stopBgm(){ if(timer){ clearInterval(timer); timer=null; } stopSources("music",true); duckUntil=0; mixMusic(); }
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
    if(!ac||!musicBus||!timer)return;
    duckUntil=Math.max(duckUntil,ac.currentTime+duration);mixMusic();
  }
  // Quiet interface sounds leave the score steady; important events retain ducking.
  const effectLast=new Map();
  const effectProfile=name=>name==='step'?{level:.16,gap:.12,duck:false,cutoff:1800}:
    ['ok','cancel','equip','evade'].includes(name)?{level:.48,gap:.075,duck:false,cutoff:3000}:
    ['seaWave','clap'].includes(name)?{level:.48,gap:.16,duck:false,cutoff:2600}:
    ['damage','down','meter','skillhit','allhit','slash','defeat','enc'].includes(name)?{level:.56,gap:.085,duck:true,cutoff:2600,tone:'triangle'}:
    ['win','rank'].includes(name)?{level:.64,gap:.12,duck:true,cutoff:3200,tone:'trumpet'}:
    ['level','seaRescue','kira'].includes(name)?{level:.76,gap:.12,duck:true,cutoff:3200,tone:'glock'}:
    name==='lose'?{level:.64,gap:.12,duck:true,cutoff:2200,tone:'cello'}:
    {level:.76,gap:.065,duck:true,cutoff:3800};
  function sfx(name){
    if(!on||!ac||pageHidden()||effectVolume===0) return;
    const parts=SFX[name]; if(!Array.isArray(parts)) return;
    const profile=effectProfile(name),now=ac.currentTime,last=effectLast.get(name);
    if(last!==undefined&&now-last<profile.gap) return;
    const needed=parts.reduce((sum,part)=>sum+(part[0]===null?0:part[0]==='noise'&&name!=='step'?2:1),0);
    if([...activeSources.values()].filter(kind=>kind==='sfx').length+needed>24) return;
    effectLast.set(name,now); let t=now+0.01;
    if(profile.duck)duckBgm(parts.reduce((n,s)=>n+(s[0]==="noise"||s[0]===null?s[1]:s[2]),0)+0.08);
    for(const s of parts){
      if(s[0]==="noise"){ noise(t,s[1]+0.03,0.36*profile.level,name==='step'?600:1200,{type:"bandpass",q:0.5,out:sfxBus}); if(name!=='step')noise(t,0.02,0.10*profile.level,3500,{out:sfxBus}); t+=s[1]; }
      else if(s[0]===null){ t+=s[1]; }
      else { voice(hz(s[1]),t,s[2],profile.tone||(['heal','buy','pet','petCare','petgrow','seaTreasure'].includes(name)?'glock':['ok','cancel','equip','evade'].includes(name)?'triangle':s[0]),0.42*profile.level,{out:sfxBus,sus:0.65,cutoff:profile.cutoff,fenv:600,a:0.006,d:0.03,r:0.07}); t+=s[2]; }
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
    if(v){ if(!init()){ on=false; return false; } if(ac.state==="suspended"||ac.state==="interrupted") ac.resume().catch(()=>{}); if(on) return true; on=true; outputLevel(0.85,0.06); const c=cur; cur=null; if(c) play(c); }
    else { if(!on) return false; on=false; if(jingleT){ clearTimeout(jingleT); jingleT=null; } stopBgm(); stopSources(); effectLast.clear(); outputLevel(0.0001,0.03); }
    return on;
  }
  function suspend(){ if(jingleT){ clearTimeout(jingleT); jingleT=null; } stopBgm(); stopSources(); effectLast.clear(); if(ac&&ac.state==="running") ac.suspend().catch(()=>{}); }
  function resume(){ if(!on||!ac) return; if(ac.state==="suspended"||ac.state==="interrupted") ac.resume().catch(()=>{}); if(timer||jingleT) return; const c=cur; cur=null; if(c) play(c); }
  return { sceneForMap,play, jingle, sfx, setOn, setVolumes, suspend, resume, get songs(){return Object.keys(SONGS);},get scores(){return Object.fromEntries(Object.entries(SONGS).map(([id,s])=>[id,{bars:s.chords.split(' ').length,bpm:s.bpm,seconds:s.chords.split(' ').length*240/s.bpm}]));},get instrumentation(){return {sampledInstruments:sampleBanks.size,sampleNotes,droppedSampleNotes};},get metrics(){return {...timing};},get sourceCount(){return activeSources.size;},get volumes(){return {music:musicVolume,effects:effectVolume};}, get playing(){return !!(on&&ac?.state==="running"&&timer&&!pageHidden());}, get on(){return on;}, get current(){return cur;} };
})();
