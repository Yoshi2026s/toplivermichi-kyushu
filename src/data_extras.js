/* v5.34: 全地域支援と、状況に応じた架空の観客コメント。旧版本文の復元ではなく新規制作。 */
const LISTENER_CONTEXTS = [
  ["town","街で交わす挨拶"],["explore","知らない道への一歩"],["start","仲間と迎える開幕"],["hit","息を合わせた攻撃"],
  ["critical","ここぞという一撃"],["evade","身をかわした瞬間"],["heal","仲間を気遣う回復"],["mp","次の手に備えるひと息"],
  ["low","苦しい時の支え合い"],["down","倒れた仲間を待つ気持ち"],["pet","小さな相棒の活躍"],["support","遠くから届く応援"],
  ["boss","大きな相手へ向かう勇気"],["sea","潮風の向こうへの旅"],["victory","みんなでつかんだ勝利"],["defeat","もう一度立ち上がる決意"]
];
const LISTENER_ENDINGS = [
  "、ちゃんと見ているよ。","に、こっちも元気をもらった！","を一緒に見守っているよ。","が今日の思い出になった。","、急がず自分たちのペースでね。",
  "に拍手を送ります！","、画面の向こうで応援してる。","が次の人にも届きますように。","、最後まで付き合うよ。","を見て、私も一歩進めそう。",
  "、いい時間をありがとう。","に込めた気持ち、伝わってる。","、仲間がいるっていいね。","があるから旅が続くんだね。","、今日初めて来た人にも伝えたい。",
  "を、またここで見たいな。","、無理せず休みながらいこう。","にそっとエールを送るね。","、遠くの街からも見守ってる。","を大切にする旅が好き。","、小さな一歩も忘れないよ。","が次の返事につながるね。"
];
const LISTENER_TEXTS = LISTENER_CONTEXTS.flatMap(([context,topic],c)=>LISTENER_ENDINGS.map((tail,i)=>({id:`LC${String(c*22+i+1).padStart(3,"0")}`,context,text:topic+tail})));
const LISTENER_NAME_PREFIXES = ["朝露","夕凪","星屑","若葉","木漏れ日","小春","水面","月影","朝焼け","風鈴","雪明かり","麦穂","青空","雨上がり","潮騒","ひだまり","虹色","路地裏","菜の花","深緑","夜風","花便り","白雲","遠雷","あかね","流れ星","さざ波","野ばら","きらめき","春風","秋桜","冬晴れ"];
const LISTENER_NAME_SUFFIXES = ["の旅人","の郵便屋","のしおり","の散歩道","の見守り役","の手帳","の灯り","のこだま","の窓辺","の足音","の案内人","のベンチ","の喫茶室","の便り","の休憩所","の風車"];
const LISTENER_NAMES=LISTENER_NAME_PREFIXES.flatMap(a=>LISTENER_NAME_SUFFIXES.map(b=>a+b));
const LISTENER_SPECIAL_NAMES=["港の見張り番","山の道案内","街角の花屋","旅の記録係","夜行列車の客","風待ちの船乗り","ペットの応援団","湯の里の常連","雪国の郵便屋","木陰の聞き役","お茶屋の休憩係"].flatMap(a=>["東の町","西の町","南の島","北の森","川のほとり","山のふもと","海の向こう"].map(b=>`${b}・${a}`));

/* 九州・沖縄の参照効果を保持し、他地域は全国依頼完了で解放する。 */
const SUPPORT_REQUIREMENTS={PR01:{quest:"S01",extra:"M01",npc:"akari"},PR02:{quest:"M03",npc:"karatsuGuide"},PR03:{quest:"M05",npc:"saseboGuide"}};
for(const [prefId,hubIds] of Object.entries(NATIONAL_IMPLEMENTED_HUBS)){
  const n=Number(prefId.slice(2)); if(n===40||n===41||n===42) continue;
  const pref=NATIONAL_PREFECTURES.find(p=>p.id===prefId),hub=hubIds[0];
  const main=Object.entries(QUESTS).filter(([,q])=>q.main&&q.hub===hub).at(-1)?.[0];
  const key=n===43?"PR04":n===44?"PR05":n===45?"PR06":n===46?"PR07":n===47?"PR08":`SP${String(n).padStart(2,"0")}`;
  const startA=n>=43?16+(n-43)*2:12+Math.min(12,Math.floor(n/3));
  SUPPORTS[key]={name:`${pref.name}の声`,text:`戦闘開始時のエール＋${startA}${n===45?"・キラコメ成功時＋5":""}`,startA,kiraBonus:n===45?5:0,prefId,quest:main};
  SUPPORT_REQUIREMENTS[key]={quest:main};
}
/* 建物を壊さず、既存の到達可能な広場に街施設を置く。 */
for(const [hub,H] of Object.entries(HUBS)){
  const m=MAPS[hub],queue=[m.safeAnchor],seen=new Set([m.safeAnchor.join(",")]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(seen.has(k)||nx<1||ny<1||nx>=m.w-1||ny>=m.h-1||!".,w=".includes(m.tiles[ny][nx])||m.objects.some(o=>o.x===nx&&o.y===ny))continue;seen.add(k);queue.push([nx,ny]);}
  }
  const point=m.reserveSites?.jobcenter||queue.find(([x,y])=>Math.abs(x-m.safeAnchor[0])+Math.abs(y-m.safeAnchor[1])>=4&&!m.objects.some(o=>Math.abs(o.x-x)+Math.abs(o.y-y)<2));
  if(point)m.objects.push({id:`${hub}_jobcenter`,x:point[0],y:point[1],type:"jobcenter",label:"ハローワーク（職業イベント・転職）"});
}
